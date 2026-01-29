import * as core from '@actions/core';
import * as github from '@actions/github';
import type { QATestRequest, QATestResponse, CreateJobResponse, JobStatusResponse, JobStatus } from './types';

/**
 * Build metadata with source tracking for the QA test action
 */
function buildMetadata(): Record<string, unknown> {
  const context = github.context;

  return {
    source: 'qa-test-action',
    sourceCreatedAt: new Date().toISOString(),
    githubAction: {
      actionName: 'qa-test-action',
      runId: context.runId?.toString(),
      workflowName: context.workflow,
      triggerEvent: context.eventName,
      actor: context.actor,
    },
  };
}

// Terminal states that indicate the job is done
const TERMINAL_STATES: JobStatus[] = ['completed', 'error', 'abandoned', 'incomplete', 'rejected'];

// Polling configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds between polls (matches MCP server)
const DEFAULT_MAX_WAIT_MS = 600000; // 10 minutes default (fallback when no job data available)
const BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer for claiming + API latency

/**
 * Calculate maximum wait time based on job data (accounts for time extensions)
 */
function calculateMaxWaitMs(
  targetDurationMinutes: number | undefined,
  totalExtensionMinutes: number | undefined,
  responseDeadline: string | undefined
): number {
  // If we have a deadline, use it + buffer
  if (responseDeadline) {
    const deadlineMs = new Date(responseDeadline).getTime();
    const nowMs = Date.now();
    const remainingMs = deadlineMs - nowMs;
    // Use at least DEFAULT_MAX_WAIT_MS even if deadline is past
    return Math.max(remainingMs + BUFFER_MS, DEFAULT_MAX_WAIT_MS);
  }

  // Calculate based on target + extensions + buffer
  if (targetDurationMinutes !== undefined) {
    const totalMinutes = targetDurationMinutes + (totalExtensionMinutes || 0);
    const totalMs = totalMinutes * 60 * 1000;
    return totalMs + BUFFER_MS;
  }

  return DEFAULT_MAX_WAIT_MS;
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for network errors (ECONNRESET, ETIMEDOUT, etc.)
 * Uses exponential backoff: 1s, 2s, 4s delays
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const isNetworkError =
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('ETIMEDOUT') ||
        lastError.message.includes('socket hang up') ||
        lastError.message.includes('fetch failed');

      if (!isNetworkError || attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelayMs * Math.pow(2, attempt);
      core.warning(
        `Network error (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError.message}. Retrying in ${delay}ms...`
      );
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Create a QA test job via the async API
 */
async function createJob(request: QATestRequest): Promise<string> {
  const endpoint = `${request.apiUrl}/api/jobs`;

  core.debug(`Creating job at ${endpoint}`);

  const requestBody = {
    url: request.url,
    description: request.description,
    ...(request.outputSchema !== undefined && { outputSchema: request.outputSchema }),
    targetDurationMinutes: request.targetDurationMinutes,
    allowDurationExtension: request.allowDurationExtension,
    maxExtensionMinutes: request.maxExtensionMinutes,
    additionalValidationInstructions: request.additionalValidationInstructions,
    canCreateGithubIssues: request.canCreateGithubIssues,
    repoName: request.githubRepo,
    ...(request.screenSize !== undefined && { screenSize: request.screenSize }),
    metadata: buildMetadata(),
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'runhuman-github-action/1.0.0',
      Connection: 'close',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage: string;

    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.error || errorData.message || JSON.stringify(errorData);
    } catch {
      errorMessage = errorText || '(empty response body)';
    }

    core.error(`Failed to create job:`);
    core.error(`  Status: ${response.status} ${response.statusText}`);
    core.error(`  URL: ${endpoint}`);
    core.error(`  Body: ${errorText || '(empty)'}`);

    if (response.status === 401) {
      throw new Error(
        'Authentication failed: Invalid API key. ' +
          'Make sure your RUNHUMAN_API_KEY secret is set correctly.'
      );
    }

    throw new Error(`Failed to create job (${response.status}): ${errorMessage}`);
  }

  const data = (await response.json()) as CreateJobResponse;

  if (!data.jobId) {
    throw new Error('API did not return a job ID');
  }

  return data.jobId;
}

/**
 * Get the status of a job
 */
async function getJobStatus(apiUrl: string, apiKey: string, jobId: string): Promise<JobStatusResponse> {
  const endpoint = `${apiUrl}/api/job/${jobId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'runhuman-github-action/1.0.0',
        Connection: 'close',
      },
    });
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    const errorCause = fetchError instanceof Error && fetchError.cause ? ` Cause: ${JSON.stringify(fetchError.cause)}` : '';
    core.error(`Network error fetching job status:`);
    core.error(`  URL: ${endpoint}`);
    core.error(`  Error: ${errorMessage}${errorCause}`);
    throw new Error(`Network error checking job status: ${errorMessage}${errorCause}`);
  }

  if (!response.ok) {
    const errorText = await response.text();

    if (response.status === 404) {
      throw new Error(`Job ${jobId} not found`);
    }

    core.error(`HTTP error fetching job status:`);
    core.error(`  URL: ${endpoint}`);
    core.error(`  Status: ${response.status} ${response.statusText}`);
    core.error(`  Body: ${errorText || '(empty)'}`);

    throw new Error(`Failed to get job status (${response.status}): ${errorText || response.statusText}`);
  }

  return (await response.json()) as JobStatusResponse;
}

/**
 * Result from waitForCompletion including timeout status
 */
interface WaitResult {
  job: JobStatusResponse;
  timedOut: boolean;
}

/**
 * Poll for job completion with dynamic timeout that accounts for time extensions
 */
async function waitForCompletion(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  initialTargetMinutes?: number
): Promise<WaitResult> {
  const startTime = Date.now();
  let lastStatus: JobStatus | null = null;
  // Initial max wait: use target duration + buffer, or default
  let maxWaitMs = initialTargetMinutes
    ? initialTargetMinutes * 60 * 1000 + BUFFER_MS
    : DEFAULT_MAX_WAIT_MS;

  while (true) {
    const elapsed = Date.now() - startTime;
    const status = await withRetry(() => getJobStatus(apiUrl, apiKey, jobId));

    // Dynamically update maxWaitMs based on job data (handles extensions)
    const newMaxWaitMs = calculateMaxWaitMs(
      status.targetDurationMinutes,
      status.totalExtensionMinutes,
      status.responseDeadline
    );
    if (newMaxWaitMs > maxWaitMs) {
      core.info(`⏱️ Time extension detected, extending timeout to ${Math.round(newMaxWaitMs / 60000)} minutes`);
      maxWaitMs = newMaxWaitMs;
    }

    // Log status changes
    if (status.status !== lastStatus) {
      core.info(`Job ${jobId} status: ${status.status} (${Math.round(elapsed / 1000)}s elapsed)`);
      lastStatus = status.status;
    }

    if (TERMINAL_STATES.includes(status.status)) {
      return { job: status, timedOut: false };
    }

    // Check timeout - return instead of throwing
    if (elapsed > maxWaitMs) {
      core.warning(`Job did not complete within ${Math.round(maxWaitMs / 60000)} minutes`);
      return { job: status, timedOut: true };
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Result from runQATest including timeout status
 */
export interface QATestResult {
  response: QATestResponse;
  timedOut: boolean;
}

/**
 * Run a QA test - creates job and polls for completion
 */
export async function runQATest(request: QATestRequest): Promise<QATestResult> {
  // Step 1: Create the job (with retry for network errors)
  const jobId = await withRetry(() => createJob(request));
  core.info(`✅ Job created: ${jobId}`);

  // Step 2: Poll for completion (pass target duration for initial timeout calculation)
  core.info('⏳ Waiting for human tester...');
  const { job: finalStatus, timedOut } = await waitForCompletion(
    request.apiUrl,
    request.apiKey,
    jobId,
    request.targetDurationMinutes
  );

  // Step 3: Log completion status
  if (timedOut) {
    core.warning(`⚠️ Job ${jobId} timed out (status: ${finalStatus.status})`);
  } else if (finalStatus.status === 'completed') {
    core.info(`✅ Job ${jobId} completed successfully`);
  } else {
    core.warning(`⚠️ Job ${jobId} ended with status: ${finalStatus.status}`);
    if (finalStatus.error) {
      core.warning(`Error: ${finalStatus.error}`);
    }
    if (finalStatus.reason) {
      core.warning(`Reason: ${finalStatus.reason}`);
    }
  }

  // Step 4: Convert to QATestResponse format
  return {
    response: {
      status: finalStatus.status,
      result: finalStatus.result,
      error: finalStatus.error || finalStatus.reason,
      costUsd: finalStatus.costUsd,
      testDurationSeconds: finalStatus.testDurationSeconds,
      testerData: finalStatus.testerData,
      testerResponse: finalStatus.testerResponse,
      testerAlias: finalStatus.testerAlias,
      testerAvatarUrl: finalStatus.testerAvatarUrl,
      testerColor: finalStatus.testerColor,
      jobId: finalStatus.id,
    },
    timedOut,
  };
}
