export interface DataFieldDefinition {
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  example?: string | number | boolean | object | null;
}

export type OutputSchema = Record<string, DataFieldDefinition>;

export interface PlaywrightData {
  testDurationSeconds: number;
  consoleMessages: Array<{ type: string; message: string; timestamp: string }>;
  networkRequests: Array<{ url: string; method: string; status?: number; timestamp: string }>;
  clicks: Array<{ x: number; y: number; timestamp: string; element?: string }>;
  screenshots: string[];
  videoUrl?: string;
}

export interface ExtractedResult {
  success: boolean;
  explanation: string;
  data: Record<string, unknown>;
}

export interface QATestRequest {
  apiKey: string;
  apiUrl: string;
  url: string;
  description: string;
  outputSchema: Record<string, unknown>;
  targetDurationMinutes?: number;
  allowDurationExtension?: boolean;
  maxExtensionMinutes?: number | false;
  githubRepo: string;
}

export interface QATestResponse {
  status: string;
  result?: ExtractedResult;
  error?: string;
  costUsd?: number;
  testDurationSeconds?: number;
  testerData?: PlaywrightData;
  jobId?: string;
}

export interface ParsedInputs {
  apiKey: string;
  apiUrl: string;
  url: string;
  description: string;
  outputSchema: Record<string, unknown>;
  targetDurationMinutes?: number;
  allowDurationExtension?: boolean;
  maxExtensionMinutes?: number | false;
  failOnError: boolean;
  githubRepo: string;
}
