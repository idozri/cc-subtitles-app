export enum ProjectStatus {
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  TRANSCRIBING = 'transcribing',
  READY = 'ready',
  FAILED = 'failed',
  FAILED_TRANSCRIPTION = 'failed_transcription',
}

export interface Project {
  _id: string;
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  userId: string;
  status: ProjectStatus;
  uploadId?: string;
  s3Key?: string;
  chunkSize?: number;
  duration?: string;
  subtitleCount: number;
  language?: string;
  translateToEnglish: boolean;
  originalLanguage?: string;
  transcriptionId?: string;
  transcriptionJsonUrl?: string;
  errorMessage?: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  thumbnailUrl?: string;
  createdAt: string;
  updatedAt: string;
  srcUrl?: string;
  exportedVideoUrl?: string;
  exportJobId?: string;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  language: string;
  translateToEnglish?: boolean;
  deviceId?: string;
  thumbnailDataUrl?: string;
  durationSeconds?: number;
}

export interface ProjectWithUpload extends Project {
  upload?: {
    uploadId: string;
    key: string;
    chunkSize: number;
  };
}
