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
const MAX_WAIT_MS = 600000; // 10 minutes maximum wait time

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const endpoint = `${apiUrl}/api/jobs/${jobId}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'runhuman-github-action/1.0.0',
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
 * Poll for job completion
 */
async function waitForCompletion(
  apiUrl: string,
  apiKey: string,
  jobId: string,
  maxWaitMs: number = MAX_WAIT_MS
): Promise<JobStatusResponse> {
  const startTime = Date.now();
  let lastStatus: JobStatus | null = null;

  while (true) {
    const elapsed = Date.now() - startTime;
    const status = await getJobStatus(apiUrl, apiKey, jobId);

    // Log status changes
    if (status.status !== lastStatus) {
      core.info(`Job ${jobId} status: ${status.status} (${Math.round(elapsed / 1000)}s elapsed)`);
      lastStatus = status.status;
    }

    if (TERMINAL_STATES.includes(status.status)) {
      return status;
    }

    // Check timeout
    if (elapsed > maxWaitMs) {
      throw new Error(`Job did not complete within ${Math.round(maxWaitMs / 60000)} minutes`);
    }

    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Run a QA test - creates job and polls for completion
 */
export async function runQATest(request: QATestRequest): Promise<QATestResponse> {
  // Step 1: Create the job
  const jobId = await createJob(request);
  core.info(`✅ Job created: ${jobId}`);

  // Step 2: Poll for completion
  core.info('⏳ Waiting for human tester...');
  const finalStatus = await waitForCompletion(request.apiUrl, request.apiKey, jobId);

  // Step 3: Log completion status
  if (finalStatus.status === 'completed') {
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
  };
}
