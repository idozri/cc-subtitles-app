import {
  UploadSession,
  FileChunk,
  UploadedChunk,
  MultipartUploadInit,
  UploadProgress,
  UploadError,
  UploadConfig,
  DEFAULT_UPLOAD_CONFIG,
} from '@/types/upload';

export class S3UploadService {
  private config: UploadConfig;
  private activeUploads: Map<string, UploadSession> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private apiBaseUrl: string;

  constructor(config: Partial<UploadConfig> = {}) {
    this.config = { ...DEFAULT_UPLOAD_CONFIG, ...config };
    // Allow overriding API base URL (e.g., for audio uploads)
    this.apiBaseUrl = (config as UploadConfig).apiBaseUrl || '/api/upload';
  }

  /**
   * Initialize multipart upload with S3
   */
  async initiateMultipartUpload(
    file: File,
    projectId: string,
    s3Key: string
  ): Promise<MultipartUploadInit> {
    try {
      console.log('S3UploadService: Initiating multipart upload...');
      console.log('S3UploadService: API URL:', `${this.apiBaseUrl}/initiate`);

      // Call backend API to initiate multipart upload
      const response = await fetch(`${this.apiBaseUrl}/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          projectId,
          mimeType: file.type,
        }),
        credentials: 'include',
      });

      console.log('S3UploadService: Response status:', response.status);
      console.log(
        'S3UploadService: Response headers:',
        Object.fromEntries(response.headers.entries())
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('S3UploadService: API error:', errorData);
        throw new Error(errorData.message || 'Failed to initiate upload');
      }

      const data = await response.json();
      console.log('S3UploadService: API response data:', data);

      const { uploadId, presignedUrls, chunkSize } = data.data;

      // Use the key returned from the backend, not the frontend-provided s3Key
      const actualS3Key = data.data.key || s3Key;

      const session: UploadSession = {
        projectId,
        uploadId,
        s3Key: actualS3Key, // Use the actual S3 key from backend
        parts: [],
        nextPartNumber: 1,
        status: 'uploading',
        progress: 0,
        startedAt: new Date(),
        lastActivity: new Date(),
        fileSize: file.size,
        fileName: file.name,
        chunkSize,
      };

      this.activeUploads.set(uploadId, session);
      this.abortControllers.set(uploadId, new AbortController());

      return {
        uploadId,
        s3Key: actualS3Key, // Return the actual S3 key
        presignedUrls,
        chunkSize,
      };
    } catch (error) {
      console.error('S3UploadService: Error initiating upload:', error);
      throw this.createUploadError('UPLOAD_INIT_FAILED', error as Error);
    }
  }

  /**
   * Upload file chunks with progress tracking
   */
  async uploadChunks(
    file: File,
    uploadId: string,
    presignedUrls: string[],
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadedChunk[]> {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    const totalChunks = Math.ceil(file.size / session.chunkSize);
    const chunks: FileChunk[] = this.createFileChunks(file, session.chunkSize);
    const results: UploadedChunk[] = [];
    const startTime = Date.now();
    let totalUploadedBytes = 0;

    console.log('S3UploadService: Starting chunk upload:', {
      fileSize: file.size,
      chunkSize: session.chunkSize,
      totalChunks,
      maxConcurrentChunks: this.config.maxConcurrentChunks,
      presignedUrlsCount: presignedUrls.length,
    });

    try {
      // Upload chunks with concurrency control
      for (let i = 0; i < totalChunks; i += this.config.maxConcurrentChunks) {
        const batch = chunks.slice(i, i + this.config.maxConcurrentChunks);
        console.log(
          `S3UploadService: Uploading batch ${
            Math.floor(i / this.config.maxConcurrentChunks) + 1
          }, chunks ${i + 1}-${i + batch.length}`
        );

        const batchPromises = batch.map((chunk, index) =>
          this.uploadChunkWithRetry(
            chunk,
            uploadId,
            presignedUrls[chunk.partNumber - 1],
            (chunkProgress) => {
              // Progress callback for individual chunk upload
              const currentChunkBytes = Math.round(chunk.data.size * (chunkProgress / 100));
              const uploadedBytes = totalUploadedBytes + currentChunkBytes;
              const progress = Math.round((uploadedBytes / file.size) * 100);
              const elapsed = Date.now() - startTime;
              const speed = elapsed > 0 ? uploadedBytes / (elapsed / 1000) : 0;
              const estimatedTimeRemaining =
                speed > 0 ? (file.size - uploadedBytes) / speed : 0;

              const uploadProgress: UploadProgress = {
                projectId: session.projectId,
                progress,
                uploadedBytes,
                totalBytes: file.size,
                currentChunk: results.length,
                totalChunks,
                estimatedTimeRemaining,
                speed,
              };

              if (onProgress) {
                onProgress(uploadProgress);
              }
            }
          )
        );

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);

        // Update total uploaded bytes after batch completes
        totalUploadedBytes = results.reduce(
          (sum, chunk) => sum + chunk.size,
          0
        );

        // Update progress after batch completion
        const progress = Math.round((totalUploadedBytes / file.size) * 100);
        const elapsed = Date.now() - startTime;
        const speed = totalUploadedBytes / (elapsed / 1000);
        const estimatedTimeRemaining =
          speed > 0 ? (file.size - totalUploadedBytes) / speed : 0;

        const uploadProgress: UploadProgress = {
          projectId: session.projectId,
          progress,
          uploadedBytes: totalUploadedBytes,
          totalBytes: file.size,
          currentChunk: results.length,
          totalChunks,
          estimatedTimeRemaining,
          speed,
        };

        console.log('S3UploadService: Progress update:', {
          batch: Math.floor(i / this.config.maxConcurrentChunks) + 1,
          progress: `${progress}%`,
          uploadedBytes: `${totalUploadedBytes}/${file.size}`,
          currentChunk: results.length,
          totalChunks,
          onProgressExists: !!onProgress,
        });

        // Update session
        session.progress = progress;
        session.lastActivity = new Date();
        session.parts = results.map((result, index) => ({
          partNumber: result.partNumber,
          etag: result.etag,
          size: result.size,
        }));

        if (onProgress) {
          console.log(
            'S3UploadService: Calling progress callback with:',
            uploadProgress
          );
          onProgress(uploadProgress);
        } else {
          console.log('S3UploadService: No progress callback provided');
        }
      }

      return results.sort((a, b) => a.partNumber - b.partNumber);
    } catch (error) {
      throw this.createUploadError('CHUNK_UPLOAD_FAILED', error as Error);
    }
  }

  /**
   * Complete multipart upload
   */
  async completeMultipartUpload(uploadId: string): Promise<string> {
    console.log('S3UploadService: Completing multipart upload:', uploadId);
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    try {
      // Call backend API to complete multipart upload
      const response = await fetch(`${this.apiBaseUrl}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: session.s3Key,
          uploadId,
          parts: session.parts,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete upload');
      }

      session.status = 'completed';
      session.progress = 100;
      session.lastActivity = new Date();

      return session.s3Key;
    } catch (error) {
      session.status = 'failed';
      throw this.createUploadError('UPLOAD_COMPLETE_FAILED', error as Error);
    }
  }

  /**
   * Pause upload
   */
  pauseUpload(uploadId: string): void {
    const session = this.activeUploads.get(uploadId);
    if (session && session.status === 'uploading') {
      session.status = 'paused';
      session.lastActivity = new Date();

      // Abort current upload operations
      const abortController = this.abortControllers.get(uploadId);
      if (abortController) {
        abortController.abort();
      }
    }
  }

  /**
   * Resume upload
   */
  resumeUpload(uploadId: string): void {
    const session = this.activeUploads.get(uploadId);
    if (session && session.status === 'paused') {
      session.status = 'uploading';
      session.lastActivity = new Date();

      // Create new abort controller for resumed upload
      this.abortControllers.set(uploadId, new AbortController());
    }
  }

  /**
   * Cancel upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    try {
      // Call backend API to abort multipart upload
      const response = await fetch(`${this.apiBaseUrl}/abort`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: session.s3Key,
          uploadId,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to abort upload');
      }

      // Clean up
      this.activeUploads.delete(uploadId);
      this.abortControllers.delete(uploadId);
    } catch (error) {
      throw this.createUploadError('UPLOAD_CANCEL_FAILED', error as Error);
    }
  }

  /**
   * Get upload session
   */
  getUploadSession(uploadId: string): UploadSession | undefined {
    return this.activeUploads.get(uploadId);
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [uploadId, session] of this.activeUploads.entries()) {
      if (now - session.lastActivity.getTime() > maxAge) {
        this.activeUploads.delete(uploadId);
        this.abortControllers.delete(uploadId);
      }
    }
  }

  // Private helper methods

  private calculateOptimalChunkSize(fileSize: number): number {
    let chunkSize = this.config.chunkSize;

    // Adjust based on file size
    if (fileSize > 1024 * 1024 * 1024) {
      // > 1GB
      chunkSize = 32 * 1024 * 1024; // 32MB
    } else if (fileSize > 100 * 1024 * 1024) {
      // > 100MB
      chunkSize = 16 * 1024 * 1024; // 16MB
    }

    return chunkSize;
  }

  private createFileChunks(file: File, chunkSize: number): FileChunk[] {
    const chunks: FileChunk[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const data = file.slice(start, end);

      chunks.push({
        partNumber: i + 1,
        start,
        end,
        data,
      });
    }

    return chunks;
  }

  private async uploadChunkWithRetry(
    chunk: FileChunk,
    uploadId: string,
    presignedUrl: string,
    onChunkProgress?: (progress: number) => void
  ): Promise<UploadedChunk> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.uploadChunk(chunk, presignedUrl, onChunkProgress);
      } catch (error) {
        lastError = error as Error;

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw this.createUploadError(
      'CHUNK_UPLOAD_FAILED',
      lastError!,
      chunk.partNumber
    );
  }

  private async uploadChunk(
    chunk: FileChunk,
    presignedUrl: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadedChunk> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const etag = xhr.getResponseHeader('ETag')?.replace(/"/g, '');
          if (!etag) {
            reject(new Error('No ETag in response'));
            return;
          }

          resolve({
            partNumber: chunk.partNumber,
            etag,
            size: chunk.data.size,
          });
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload aborted'));
      });

      xhr.open('PUT', presignedUrl);
      xhr.send(chunk.data);
    });
  }

  // Keeping the old fetch-based method as a fallback (not used anymore)
  private async uploadChunkFetch(
    chunk: FileChunk,
    presignedUrl: string
  ): Promise<UploadedChunk> {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iP(ad|hone|od)/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

    // On iOS/Safari, avoid setting Content-Type to prevent CORS preflight failures with S3
    // iOS Safari is picky about Blob PUT bodies; convert to ArrayBuffer for reliability
    const useArrayBufferBody = isIOS || isSafari;
    const bodyData = useArrayBufferBody
      ? await chunk.data.arrayBuffer()
      : chunk.data;

    const requestInit: RequestInit = {
      method: 'PUT',
      body: bodyData,
      mode: 'cors',
    };

    if (!(isIOS || isSafari)) {
      requestInit.headers = {
        'Content-Type': 'application/octet-stream',
      } as HeadersInit;
    }

    requestInit.credentials = 'omit';
    requestInit.cache = 'no-store';

    const response = await fetch(presignedUrl, requestInit);

    if (!response.ok) {
      throw new Error(`Chunk upload failed: ${response.statusText}`);
    }

    const etag = response.headers.get('ETag')?.replace(/"/g, '') || '';

    return {
      partNumber: chunk.partNumber,
      etag,
      size: chunk.data.size,
    };
  }

  private createUploadError(
    type: UploadError['type'],
    error: Error,
    chunkNumber?: number
  ): UploadError {
    return {
      type,
      message: error.message,
      code: error.name,
      retryable: type !== 'VALIDATION_ERROR',
      chunkNumber,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
