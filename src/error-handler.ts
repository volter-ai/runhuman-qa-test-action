import * as core from '@actions/core';

export function handleError(error: unknown): never {
  if (error instanceof Error) {
    // Add helpful context to common errors
    let message = error.message;

    // Include error code if present (e.g., ENOTFOUND, ECONNREFUSED)
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code) {
      message = `${message} (${errorWithCode.code})`;
    }

    // Node.js fetch stores the actual error in error.cause
    const errorWithCause = error as Error & { cause?: unknown };
    if (errorWithCause.cause) {
      const cause = errorWithCause.cause;
      let causeMessage: string;
      if (cause instanceof Error) {
        causeMessage = cause.message;
      } else if (typeof cause === 'object' && cause !== null) {
        causeMessage = JSON.stringify(cause);
      } else {
        causeMessage = String(cause);
      }
      message = `${message}: ${causeMessage}`;
    }

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
