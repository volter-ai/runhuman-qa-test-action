import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runQATest } from '../src/api-client';
import { mockSuccessResponse, mockAuthError, mockTimeoutError } from './fixtures/mock-responses';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  setFailed: vi.fn(),
  setOutput: vi.fn(),
}));

describe('API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runQATest', () => {
    it('should call /api/run endpoint with correct parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      global.fetch = mockFetch;

      const response = await runQATest({
        apiKey: 'qa_live_test123',
        apiUrl: 'https://test.runhuman.com',
        url: 'https://example.com',
        description: 'Test login functionality',
        outputSchema: {
          loginWorks: { type: 'boolean', description: 'Does login work?' },
        },
        targetDurationMinutes: 5,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.runhuman.com/api/run',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer qa_live_test123',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('"url":"https://example.com"'),
        })
      );

      expect(response.status).toBe('completed');
      expect(response.result?.success).toBe(true);
    });

    it('should handle 401 authentication errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockAuthError);
      global.fetch = mockFetch;

      await expect(
        runQATest({
          apiKey: 'invalid_key',
          apiUrl: 'https://test.runhuman.com',
          url: 'https://example.com',
          description: 'Test',
          outputSchema: {},
        })
      ).rejects.toThrow('Authentication failed');
    });

    it('should handle 408 timeout errors', async () => {
      const mockFetch = vi.fn().mockResolvedValue(mockTimeoutError);
      global.fetch = mockFetch;

      await expect(
        runQATest({
          apiKey: 'qa_live_test123',
          apiUrl: 'https://test.runhuman.com',
          url: 'https://example.com',
          description: 'Test',
          outputSchema: {},
        })
      ).rejects.toThrow('Test timeout');
    });

    it('should include optional parameters when provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      global.fetch = mockFetch;

      await runQATest({
        apiKey: 'qa_live_test123',
        apiUrl: 'https://test.runhuman.com',
        url: 'https://example.com',
        description: 'Test',
        outputSchema: {},
        targetDurationMinutes: 10,
        allowDurationExtension: true,
        maxExtensionMinutes: 5,
      });

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.targetDurationMinutes).toBe(10);
      expect(body.allowDurationExtension).toBe(true);
      expect(body.maxExtensionMinutes).toBe(5);
    });
  });
});
