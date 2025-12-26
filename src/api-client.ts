import * as core from '@actions/core';
import type { QATestRequest, QATestResponse } from './types';

export async function runQATest(request: QATestRequest): Promise<QATestResponse> {
  const endpoint = `${request.apiUrl}/api/run`;

  core.debug(`Calling ${endpoint}`);

  const requestBody = {
    url: request.url,
    description: request.description,
    outputSchema: request.outputSchema,
    targetDurationMinutes: request.targetDurationMinutes,
    allowDurationExtension: request.allowDurationExtension,
    maxExtensionMinutes: request.maxExtensionMinutes,
    githubRepo: request.githubRepo,
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${request.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'runhuman-github-action/1.0.0',
      },
      body: JSON.stringify(requestBody),
      // 10 minute timeout (endpoint has same timeout)
      signal: AbortSignal.timeout(600000),
    });

    // Handle non-200 responses
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }

      if (response.status === 408) {
        throw new Error(
          'Test timeout: Test did not complete within 10 minutes. ' +
            'This may indicate the tester is unavailable or taking longer than expected.'
        );
      }

      if (response.status === 401) {
        throw new Error(
          'Authentication failed: Invalid API key. ' +
            'Make sure your RUNHUMAN_API_KEY secret is set correctly.'
        );
      }

      throw new Error(
        `API request failed (${response.status}): ${errorData.error || errorData.message || errorText}`
      );
    }

    const data = (await response.json()) as QATestResponse;

    core.debug(`Response status: ${data.status}`);
    if (data.result) {
      core.debug(`Test success: ${data.result.success}`);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout: The connection to RunHuman API timed out after 10 minutes.');
      }
      throw error;
    }
    throw new Error(`Unexpected error: ${String(error)}`);
  }
}
