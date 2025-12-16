import * as core from '@actions/core';
import type { ParsedInputs } from './types';

export function parseInputs(): ParsedInputs {
  // Required inputs
  const apiKey = core.getInput('api-key', { required: true });
  const url = core.getInput('url', { required: true });
  const description = core.getInput('description', { required: true });
  const outputSchemaInput = core.getInput('output-schema', { required: true });

  // Validate API key format
  if (!apiKey.startsWith('qa_live_')) {
    throw new Error(
      'Invalid API key format. API key must start with "qa_live_". ' +
        'Get your API key at: https://runhuman.com/playground'
    );
  }

  // Parse output schema (accept JSON string or object)
  let outputSchema: Record<string, unknown>;
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

  // Optional inputs
  const apiUrl = core.getInput('api-url') || 'https://runhuman.com';
  const targetDurationStr = core.getInput('target-duration-minutes');
  const allowExtensionStr = core.getInput('allow-duration-extension');
  const maxExtensionStr = core.getInput('max-extension-minutes');
  const failOnErrorStr = core.getInput('fail-on-error');

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

  return {
    apiKey,
    apiUrl,
    url,
    description,
    outputSchema,
    targetDurationMinutes,
    allowDurationExtension,
    maxExtensionMinutes,
    failOnError,
  };
}
