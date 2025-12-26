import * as core from '@actions/core';

export function handleError(error: unknown): never {
  if (error instanceof Error) {
    // Add helpful context to common errors
    let message = error.message;

    if (message.includes('ENOTFOUND') || message.includes('ECONNREFUSED')) {
      message =
        `Network error: Cannot reach Runhuman API. ${message}\n` +
        'Check your api-url input and network connectivity.';
    }

    if (message.includes('Invalid API key')) {
      message += '\n\nGet your API key at: https://runhuman.com/playground';
    }

    core.setFailed(message);

    // Add error annotation
    core.error(message);

    // Debug stack trace
    if (error.stack) {
      core.debug(error.stack);
    }
  } else {
    const unknownError = `Unknown error: ${String(error)}`;
    core.setFailed(unknownError);
    core.error(unknownError);
  }

  process.exit(1);
}
