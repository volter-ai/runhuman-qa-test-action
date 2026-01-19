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

    const response = await runQATest({
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
