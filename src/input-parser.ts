import * as core from '@actions/core';
import * as github from '@actions/github';
import type { ParsedInputs, ScreenSizeConfig } from './types';

export function parseInputs(): ParsedInputs {
  // Required inputs
  const apiKey = core.getInput('api-key', { required: true });
  const url = core.getInput('url', { required: true });
  const description = core.getInput('description', { required: true });
  const outputSchemaInput = core.getInput('output-schema', { required: false });

  // Validate API key format
  if (!apiKey.startsWith('qa_live_')) {
    throw new Error(
      'Invalid API key format. API key must start with "qa_live_". ' +
        'Get your API key at: https://runhuman.com/playground'
    );
  }

  // Parse output schema if provided (accept JSON string or object)
  let outputSchema: Record<string, unknown> | undefined;
  if (outputSchemaInput) {
    try {
      if (typeof outputSchemaInput === 'string') {
        outputSchema = JSON.parse(outputSchemaInput);
      } else {
        outputSchema = outputSchemaInput as Record<string, unknown>;
      }
    } catch (error) {
      throw new Error(
        `Invalid output-schema: Must be valid JSON. ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (typeof outputSchema !== 'object' || Array.isArray(outputSchema)) {
      throw new Error('Invalid output-schema: Must be a JSON object');
    }
  }

  // Optional inputs
  const apiUrl = core.getInput('api-url') || 'https://runhuman.com';
  const targetDurationStr = core.getInput('target-duration-minutes');
  const allowExtensionStr = core.getInput('allow-duration-extension');
  const maxExtensionStr = core.getInput('max-extension-minutes');
  const failOnErrorStr = core.getInput('fail-on-error');
  const additionalValidationInstructions = core.getInput('additional-validation-instructions') || undefined;
  const canCreateGithubIssuesStr = core.getInput('can-create-github-issues');

  // Parse numeric/boolean inputs
  let targetDurationMinutes: number | undefined;
  if (targetDurationStr) {
    targetDurationMinutes = parseInt(targetDurationStr, 10);
    if (isNaN(targetDurationMinutes) || targetDurationMinutes < 1 || targetDurationMinutes > 60) {
      throw new Error('target-duration-minutes must be between 1 and 60');
    }
  }

  const allowDurationExtension = allowExtensionStr === 'true';

  let maxExtensionMinutes: number | false | undefined;
  if (maxExtensionStr) {
    if (maxExtensionStr === 'false') {
      maxExtensionMinutes = false;
    } else {
      maxExtensionMinutes = parseInt(maxExtensionStr, 10);
      if (isNaN(maxExtensionMinutes)) {
        throw new Error('max-extension-minutes must be a number or "false"');
      }
    }
  }

  const failOnError = failOnErrorStr !== 'false';
  const canCreateGithubIssues = canCreateGithubIssuesStr === 'true';

  // Parse screen size input
  const screenSizeStr = core.getInput('screen-size') || 'desktop';
  let screenSize: ScreenSizeConfig | undefined;
  const validPresets = ['desktop', 'laptop', 'tablet', 'mobile'];
  if (validPresets.includes(screenSizeStr)) {
    screenSize = screenSizeStr as ScreenSizeConfig;
  } else {
    // Try parsing as JSON for custom dimensions
    try {
      const parsed = JSON.parse(screenSizeStr);
      if (typeof parsed === 'object' && parsed !== null && 'width' in parsed && 'height' in parsed) {
        const width = Number(parsed.width);
        const height = Number(parsed.height);
        if (!isNaN(width) && !isNaN(height) && width >= 320 && width <= 3840 && height >= 240 && height <= 2160) {
          screenSize = { width, height };
        } else {
          throw new Error('Screen size dimensions must be: width 320-3840, height 240-2160');
        }
      } else {
        throw new Error('Custom screen size must have width and height properties');
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          `Invalid screen-size: "${screenSizeStr}". Use preset (desktop, laptop, tablet, mobile) or JSON {"width": N, "height": N}`
        );
      }
      throw error;
    }
  }

  // Get current GitHub repo from context
  const { owner, repo } = github.context.repo;
  const githubRepo = `${owner}/${repo}`;

  return {
    apiKey,
    apiUrl,
    url,
    description,
    outputSchema,
    targetDurationMinutes,
    allowDurationExtension,
    maxExtensionMinutes,
    additionalValidationInstructions,
    canCreateGithubIssues,
    failOnError,
    githubRepo,
    screenSize,
  };
}
