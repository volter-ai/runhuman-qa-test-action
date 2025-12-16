import type { QATestResponse } from '../../src/types';

export const mockSuccessResponse: QATestResponse = {
  status: 'completed',
  result: {
    success: true,
    explanation: 'Login functionality works correctly. Successfully logged in with valid credentials.',
    data: {
      loginWorks: true,
      errorMessagesDisplayCorrectly: true,
    },
  },
  costUsd: 0.396,
  testDurationSeconds: 220,
  jobId: 'test_job_123',
};

export const mockFailureResponse: QATestResponse = {
  status: 'completed',
  result: {
    success: false,
    explanation: 'Login button is not clickable. Page layout issue detected.',
    data: {
      loginWorks: false,
      issue: 'Button overlapped by header',
    },
  },
  costUsd: 0.18,
  testDurationSeconds: 100,
  jobId: 'test_job_456',
};

export const mockErrorResponse: QATestResponse = {
  status: 'error',
  error: 'System error: Unable to load the test URL',
  jobId: 'test_job_789',
};

export const mockTimeoutError = {
  ok: false,
  status: 408,
  text: async () => JSON.stringify({ error: 'Request Timeout' }),
};

export const mockAuthError = {
  ok: false,
  status: 401,
  text: async () => JSON.stringify({ error: 'Invalid API key' }),
};

export const mockServerError = {
  ok: false,
  status: 500,
  text: async () => JSON.stringify({ error: 'Internal server error' }),
};
