// Upload Worker Message Types
export interface UploadWorkerMessage {
  type:
    | 'START_UPLOAD'
    | 'PAUSE_UPLOAD'
    | 'RESUME_UPLOAD'
    | 'CANCEL_UPLOAD'
    | 'RESUME_INTERRUPTED_UPLOAD'
    | 'RESUME_WITH_FILE';
  file?: File;
  projectId?: string;
  uploadId?: string;
  presignedUrls?: string[];
  s3Key?: string;
  chunkSize?: number;
  skipInitiation?: boolean; // Flag to skip backend initiation
}

export interface UploadWorkerResponse {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR' | 'PAUSED' | 'CANCELLED';
  projectId?: string;
  uploadId?: string;
  progress?: number;
  uploadedBytes?: number;
  totalBytes?: number;
  currentChunk?: number;
  totalChunks?: number;
  estimatedTimeRemaining?: number;
  s3Key?: string;
  error?: string;
  step?: string;
}

// Upload Session Management
export interface UploadSession {
  projectId: string;
  uploadId: string;
  s3Key: string;
  parts: Array<{
    partNumber: number;
    etag: string;
    size: number;
  }>;
  nextPartNumber: number;
  status: 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  startedAt: Date;
  lastActivity: Date;
  fileSize: number;
  fileName: string;
  chunkSize: number;
}

// Chunk Upload Types
export interface FileChunk {
  partNumber: number;
  start: number;
  end: number;
  data: Blob;
}

export interface UploadedChunk {
  partNumber: number;
  etag: string;
  size: number;
}

// S3 Upload Types
export interface MultipartUploadInit {
  uploadId: string;
  s3Key: string;
  presignedUrls: string[];
  chunkSize: number;
}

export interface UploadProgress {
  projectId: string;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  currentChunk: number;
  totalChunks: number;
  estimatedTimeRemaining?: number;
  speed?: number; // bytes per second
}

// Error Types
export interface UploadError {
  type:
    | 'NETWORK_ERROR'
    | 'CHUNK_UPLOAD_FAILED'
    | 'UPLOAD_INIT_FAILED'
    | 'UPLOAD_COMPLETE_FAILED'
    | 'UPLOAD_CANCEL_FAILED'
    | 'VALIDATION_ERROR';
  message: string;
  code?: string;
  retryable: boolean;
  chunkNumber?: number;
}

// Upload Configuration
export interface UploadConfig {
  chunkSize: number;
  maxConcurrentChunks: number;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  apiBaseUrl?: string;
  authToken?: string;
}

// Default Upload Configuration
export const DEFAULT_UPLOAD_CONFIG: UploadConfig = {
  chunkSize: 8 * 1024 * 1024, // 8MB
  maxConcurrentChunks: 3,
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  timeout: 30000, // 30 seconds
};
