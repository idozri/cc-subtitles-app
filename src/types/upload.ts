// Upload Progress Types
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

// S3 Upload Types
export interface MultipartUploadInit {
  uploadId: string;
  s3Key: string;
  presignedUrls: string[];
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
