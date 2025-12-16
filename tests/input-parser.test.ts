import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as core from '@actions/core';
import { parseInputs } from '../src/input-parser';

// Mock @actions/core
vi.mock('@actions/core');

describe('Input Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseInputs', () => {
    it('should parse valid inputs correctly', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'qa_live_test123',
          url: 'https://example.com',
          description: 'Test login',
          'output-schema': '{"loginWorks": {"type": "boolean", "description": "Works?"}}',
          'api-url': 'https://test.runhuman.com',
          'target-duration-minutes': '8',
          'allow-duration-extension': 'true',
          'max-extension-minutes': '5',
          'fail-on-error': 'true',
        };
        return inputs[name] || '';
      });

      const result = parseInputs();

      expect(result.apiKey).toBe('qa_live_test123');
      expect(result.url).toBe('https://example.com');
      expect(result.description).toBe('Test login');
      expect(result.outputSchema).toEqual({
        loginWorks: { type: 'boolean', description: 'Works?' },
      });
      expect(result.apiUrl).toBe('https://test.runhuman.com');
      expect(result.targetDurationMinutes).toBe(8);
      expect(result.allowDurationExtension).toBe(true);
      expect(result.maxExtensionMinutes).toBe(5);
      expect(result.failOnError).toBe(true);
    });

    it('should reject invalid API key format', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'invalid_key_format',
          url: 'https://example.com',
          description: 'Test',
          'output-schema': '{}',
        };
        return inputs[name] || '';
      });

      expect(() => parseInputs()).toThrow('Invalid API key format');
    });

    it('should reject invalid JSON in output-schema', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'qa_live_test123',
          url: 'https://example.com',
          description: 'Test',
          'output-schema': '{invalid json}',
        };
        return inputs[name] || '';
      });

      expect(() => parseInputs()).toThrow('Invalid output-schema: Must be valid JSON');
    });

    it('should reject array as output-schema', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'qa_live_test123',
          url: 'https://example.com',
          description: 'Test',
          'output-schema': '[]',
        };
        return inputs[name] || '';
      });

      expect(() => parseInputs()).toThrow('Invalid output-schema: Must be a JSON object');
    });

    it('should validate target-duration-minutes range', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'qa_live_test123',
          url: 'https://example.com',
          description: 'Test',
          'output-schema': '{}',
          'target-duration-minutes': '100',
        };
        return inputs[name] || '';
      });

      expect(() => parseInputs()).toThrow('target-duration-minutes must be between 1 and 60');
    });

    it('should use default values for optional inputs', () => {
      vi.mocked(core.getInput).mockImplementation((name: string) => {
        const inputs: Record<string, string> = {
          'api-key': 'qa_live_test123',
          url: 'https://example.com',
          description: 'Test',
          'output-schema': '{}',
        };
        return inputs[name] || '';
      });

      const result = parseInputs();

      expect(result.apiUrl).toBe('https://runhuman.com');
      expect(result.targetDurationMinutes).toBeUndefined();
      expect(result.allowDurationExtension).toBe(false);
      expect(result.failOnError).toBe(true);
    });
  });
});
