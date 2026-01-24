import * as core from '@actions/core';
import type { QATestResponse } from './types';

export function formatOutputs(response: QATestResponse): void {
  // Set all outputs
  core.setOutput('status', response.status);
  core.setOutput('success', response.result?.success ? 'true' : 'false');

  if (response.result) {
    core.setOutput('result', JSON.stringify(response.result));
    core.setOutput('explanation', response.result.explanation);
    core.setOutput('data', JSON.stringify(response.result.data));
  }

  if (response.costUsd != null) {
    core.setOutput('cost-usd', response.costUsd.toString());
  }

  if (response.testDurationSeconds != null) {
    core.setOutput('duration-seconds', response.testDurationSeconds.toString());
  }

  if (response.jobId) {
    core.setOutput('job-id', response.jobId);
  }

  if (response.error) {
    core.setOutput('error', response.error);
  }

  if (response.testerAlias) {
    core.setOutput('tester-alias', response.testerAlias);
  }

  if (response.testerAvatarUrl) {
    core.setOutput('tester-avatar-url', response.testerAvatarUrl);
  }

  if (response.testerColor) {
    core.setOutput('tester-color', response.testerColor);
  }

  if (response.testerData) {
    core.setOutput('tester-data', JSON.stringify(response.testerData));
  }

  if (response.testerResponse) {
    core.setOutput('tester-response', response.testerResponse);
  }
}

export async function formatSummary(response: QATestResponse, testedUrl: string): Promise<void> {
  const summary = core.summary;

  // Header
  summary.addHeading('🧪 Runhuman QA Test Results', 2);

  // Status badge
  const statusEmoji = response.status === 'completed' && response.result?.success ? '✅' : '❌';
  summary.addRaw(`${statusEmoji} **Status:** ${response.status}\n\n`);

  // Test details table
  summary.addHeading('Test Details', 3);
  summary.addTable([
    [
      { data: 'Property', header: true },
      { data: 'Value', header: true },
    ],
    ['URL', testedUrl],
    ['Duration', response.testDurationSeconds ? `${response.testDurationSeconds}s` : 'N/A'],
    ['Cost', response.costUsd ? `$${response.costUsd.toFixed(4)}` : 'N/A'],
  ]);

  // Results
  if (response.result) {
    summary.addHeading('Tester Findings', 3);
    summary.addQuote(response.result.explanation);

    if (response.result.data && Object.keys(response.result.data).length > 0) {
      summary.addHeading('Extracted Data', 3);
      summary.addCodeBlock(JSON.stringify(response.result.data, null, 2), 'json');
    }
  }

  // Error details
  if (response.error) {
    summary.addHeading('Error Details', 3);
    summary.addRaw(`\`\`\`\n${response.error}\n\`\`\`\n`);
  }

  // Tester data (if available)
  if (response.testerData) {
    const { screenshots, videoUrl, consoleMessages, networkRequests } = response.testerData;

    if (screenshots && screenshots.length > 0) {
      summary.addHeading('Screenshots', 3);
      summary.addRaw(`${screenshots.length} screenshot(s) captured\n\n`);
    }

    if (videoUrl) {
      summary.addHeading('Session Recording', 3);
      summary.addLink('View video', videoUrl);
      summary.addRaw('\n\n');
    }

    if (consoleMessages && consoleMessages.length > 0) {
      summary.addHeading('Console Messages', 3);
      summary.addRaw(`${consoleMessages.length} console message(s) logged\n\n`);
    }

    if (networkRequests && networkRequests.length > 0) {
      summary.addHeading('Network Requests', 3);
      summary.addRaw(`${networkRequests.length} network request(s) captured\n\n`);
    }
  }

  // Footer
  summary.addRaw('\n---\n');
  summary.addRaw('Powered by [Runhuman](https://runhuman.com) - Human-powered QA testing\n');

  await summary.write();
}
