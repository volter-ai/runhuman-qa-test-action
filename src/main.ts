import * as core from '@actions/core';
import { runQATest } from './api-client';
import { parseInputs } from './input-parser';
import { formatOutputs, formatSummary } from './output-formatter';
import { handleError } from './error-handler';

async function run(): Promise<void> {
  try {
    // Parse and validate inputs
    core.info('🚀 Starting Runhuman QA test...');
    const inputs = parseInputs();

    // Display test configuration
    core.info(`📍 Testing URL: ${inputs.url}`);
    core.info(`📝 Description: ${inputs.description}`);
    core.info(`⏱️  Target duration: ${inputs.targetDurationMinutes || 5} minutes`);
    core.info(`🔗 API endpoint: ${inputs.apiUrl}`);

    // Call Runhuman API (creates job and polls for completion)
    const startTime = Date.now();

    const { response, timedOut } = await runQATest({
      apiKey: inputs.apiKey,
      apiUrl: inputs.apiUrl,
      url: inputs.url,
      description: inputs.description,
      outputSchema: inputs.outputSchema,
      targetDurationMinutes: inputs.targetDurationMinutes,
      allowDurationExtension: inputs.allowDurationExtension,
      maxExtensionMinutes: inputs.maxExtensionMinutes,
      additionalValidationInstructions: inputs.additionalValidationInstructions,
      canCreateGithubIssues: inputs.canCreateGithubIssues,
      githubRepo: inputs.githubRepo,
      screenSize: inputs.screenSize,
    });

    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // Set timed-out output
    core.setOutput('timed-out', timedOut ? 'true' : 'false');

    // Handle timeout case
    if (timedOut) {
      core.warning(`⚠️ Test timed out after ${elapsed}s`);

      // Set outputs even for timeout (partial data may be available)
      formatOutputs(response);
      await formatSummary(response, inputs.url);

      if (inputs.failOnTimeout) {
        core.setFailed(`Test timed out after ${Math.round(elapsed / 60)} minutes`);
      } else {
        core.warning('Test timed out, but fail-on-timeout is false - workflow will continue');
      }
      return;
    }

    core.info(`✅ Test completed in ${elapsed}s`);

    // Set outputs
    formatOutputs(response);

    // Create job summary (markdown)
    await formatSummary(response, inputs.url);

    // Determine if we should fail the workflow
    const shouldFail = inputs.failOnError && (response.status !== 'completed' || !response.result?.success);

    if (shouldFail) {
      const failReason = response.status !== 'completed' ? `Test ${response.status}` : 'Test failed';
      core.setFailed(`${failReason}: ${response.result?.explanation || response.error || 'Unknown error'}`);
    } else {
      core.info('✅ Test passed successfully!');
    }
  } catch (error) {
    handleError(error);
  }
}

run();
