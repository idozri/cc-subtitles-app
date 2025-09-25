// Export worker classes and types
export { UploadWorker } from './upload-worker';
export { uploadWorker } from './upload-worker.worker';

// Export types
export type {
  UploadWorkerMessage,
  UploadWorkerResponse,
  UploadSession,
  FileChunk,
  UploadedChunk,
  MultipartUploadInit,
  UploadProgress,
  UploadError,
  UploadConfig,
} from '@/types/upload';

// Export constants
export { DEFAULT_UPLOAD_CONFIG } from '@/types/upload';
