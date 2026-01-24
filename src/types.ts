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

export type ScreenSizeConfig = 'desktop' | 'laptop' | 'tablet' | 'mobile' | { width: number; height: number };

export interface QATestRequest {
  apiKey: string;
  apiUrl: string;
  url: string;
  description: string;
  outputSchema?: Record<string, unknown>;
  targetDurationMinutes?: number;
  allowDurationExtension?: boolean;
  maxExtensionMinutes?: number | false;
  additionalValidationInstructions?: string;
  canCreateGithubIssues?: boolean;
  githubRepo: string;
  screenSize?: ScreenSizeConfig;
}

export interface QATestResponse {
  status: string;
  result?: ExtractedResult;
  error?: string;
  costUsd?: number | null;
  testDurationSeconds?: number | null;
  testerData?: PlaywrightData;
  testerResponse?: string;
  testerAlias?: string;
  testerAvatarUrl?: string;
  testerColor?: string;
  jobId?: string;
}

export interface ParsedInputs {
  apiKey: string;
  apiUrl: string;
  url: string;
  description: string;
  outputSchema?: Record<string, unknown>;
  targetDurationMinutes?: number;
  allowDurationExtension?: boolean;
  maxExtensionMinutes?: number | false;
  additionalValidationInstructions?: string;
  canCreateGithubIssues?: boolean;
  failOnError: boolean;
  failOnTimeout: boolean;
  githubRepo: string;
  screenSize?: ScreenSizeConfig;
}

// Response from POST /api/jobs (create job)
export interface CreateJobResponse {
  jobId: string;
  message?: string;
}

// Job status values
export type JobStatus = 'pending' | 'waiting' | 'working' | 'completed' | 'incomplete' | 'abandoned' | 'rejected' | 'error';

// Response from GET /api/jobs/{jobId} (poll status)
export interface JobStatusResponse {
  id: string;
  status: JobStatus;
  result?: ExtractedResult;
  error?: string;
  reason?: string;
  costUsd?: number | null;
  testDurationSeconds?: number | null;
  testerData?: PlaywrightData;
  testerResponse?: string;
  testerAlias?: string;
  testerAvatarUrl?: string;
  testerColor?: string;
  jobUrl?: string;
  targetDurationMinutes?: number;
  totalExtensionMinutes?: number;
  responseDeadline?: string;
}
