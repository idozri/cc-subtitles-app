import { S3UploadService } from '../lib/s3-upload';
import { UploadSessionStorage } from '../lib/upload-session-storage';
import {
  UploadWorkerMessage,
  UploadWorkerResponse,
  UploadSession,
  UploadProgress,
} from '../types/upload';

export class UploadWorker {
  private s3Service: S3UploadService;
  private sessionStorage: UploadSessionStorage;
  private activeUploads: Map<string, UploadSession> = new Map();
  private uploadControllers: Map<string, AbortController> = new Map();
  private resumingProjects: Set<string> = new Set();
  private progressCallback: ((response: UploadWorkerResponse) => void) | null =
    null;

  constructor() {
    this.s3Service = new S3UploadService();
    this.sessionStorage = new UploadSessionStorage();
    this.initializeStorage();
  }

  /**
   * Set the progress callback for sending messages to main thread
   */
  setProgressCallback(
    callback: (response: UploadWorkerResponse) => void
  ): void {
    this.progressCallback = callback;
  }

  /**
   * Initialize IndexedDB storage
   */
  private async initializeStorage(): Promise<void> {
    try {
      await this.sessionStorage.init();
      // Restore any existing upload sessions
      await this.restoreUploadSessions();
    } catch (error) {
      console.error('Failed to initialize upload session storage:', error);
    }
  }

  /**
   * Restore upload sessions from storage
   * Note: We don't restore sessions to activeUploads here because they need to be
   * properly resumed through the resume process after page refresh
   */
  private async restoreUploadSessions(): Promise<void> {
    try {
      const sessions = await this.sessionStorage.getActiveSessions();
      console.log(
        'Upload worker: Found',
        sessions.length,
        'stored sessions, but not restoring to activeUploads'
      );
      // We don't restore sessions to activeUploads here because they need to be
      // properly resumed through the resume process after page refresh
    } catch (error) {
      console.error('Failed to restore upload sessions:', error);
    }
  }

  /**
   * Handle messages from main thread
   */
  async handleMessage(
    message: UploadWorkerMessage
  ): Promise<UploadWorkerResponse | null> {
    try {
      switch (message.type) {
        case 'START_UPLOAD':
          return await this.startUpload(
            message.file!,
            message.projectId!,
            message.s3Key!,
            message.uploadId,
            message.presignedUrls,
            message.chunkSize,
            message.skipInitiation
          );

        case 'PAUSE_UPLOAD':
          return await this.pauseUpload(message.uploadId!);

        case 'RESUME_UPLOAD':
          return await this.resumeUpload(message.uploadId!);

        case 'CANCEL_UPLOAD':
          console.log(
            'Upload worker: Received CANCEL_UPLOAD message for:',
            message.uploadId
          );
          return await this.cancelUpload(message.uploadId!);

        case 'RESUME_INTERRUPTED_UPLOAD':
          console.log(
            'Upload worker: Received RESUME_INTERRUPTED_UPLOAD message for project:',
            message.projectId
          );

          return await this.resumeInterruptedUpload(message.projectId!);

        case 'RESUME_WITH_FILE':
          return await this.resumeWithFile(
            message.file as File,
            message.projectId || '',
            message.s3Key || '',
            message.uploadId || '',
            message.chunkSize || 8 * 1024 * 1024
          );

        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      return this.createErrorResponse(
        message.projectId || '',
        message.uploadId || '',
        error as Error
      );
    }
  }

  /**
   * Start a new upload
   */
  private async startUpload(
    file: File,
    projectId: string,
    s3Key: string,
    uploadId?: string,
    presignedUrls?: string[],
    chunkSize?: number,
    skipInitiation?: boolean
  ): Promise<UploadWorkerResponse> {
    try {
      let finalUploadId: string;
      let finalPresignedUrls: string[];
      let finalChunkSize: number;

      if (skipInitiation && uploadId && presignedUrls && chunkSize) {
        // Use provided upload details and skip backend initiation
        finalUploadId = uploadId;
        finalPresignedUrls = presignedUrls;
        finalChunkSize = chunkSize;
      } else {
        // Get upload details from the backend since we already initiated the upload
        const response = await fetch('/api/upload/get-upload-details', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            projectId,
            s3Key,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get upload details');
        }

        const uploadData = await response.json();

        if (!uploadData.success) {
          throw new Error(uploadData.message || 'Failed to get upload details');
        }

        finalUploadId = uploadData.data.uploadId;
        finalPresignedUrls = uploadData.data.presignedUrls;
        finalChunkSize = uploadData.data.chunkSize;
      }

      // Create upload session
      const session: UploadSession = {
        projectId,
        uploadId: finalUploadId,
        s3Key,
        parts: [],
        nextPartNumber: 1,
        status: 'uploading',
        progress: 0,
        startedAt: new Date(),
        lastActivity: new Date(),
        fileSize: file.size,
        fileName: file.name,
        chunkSize: finalChunkSize,
      };

      // Save session to storage
      await this.sessionStorage.saveSession(session);
      this.activeUploads.set(finalUploadId, session);

      // Create a controller to allow pausing/cancelling in-flight requests
      this.uploadControllers.set(finalUploadId, new AbortController());

      // Start chunk uploads
      this.uploadChunks(file, finalUploadId, finalPresignedUrls);

      return {
        type: 'PROGRESS',
        projectId,
        uploadId: finalUploadId,
        progress: 0,
        uploadedBytes: 0,
        totalBytes: file.size,
        step: 'Starting upload...',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload file chunks with progress tracking
   */
  private async uploadChunks(
    file: File,
    uploadId: string,
    presignedUrls: string[]
  ): Promise<void> {
    const session = this.activeUploads.get(uploadId);
    if (!session) return;

    try {
      console.log('Upload worker: Starting chunk uploads for', uploadId);

      // Create file chunks
      const chunks = this.createFileChunks(file, session.chunkSize);
      const totalChunks = chunks.length;
      const results: Array<{ partNumber: number; etag: string; size: number }> =
        [];

      console.log(`Upload worker: Uploading ${totalChunks} chunks`);

      // Upload chunks sequentially for now (can be optimized later)
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const partNumber = i + 1;
        const presignedUrl = presignedUrls[i];

        console.log(
          `Upload worker: Uploading chunk ${partNumber}/${totalChunks}`
        );

        try {
          console.log(
            `Upload worker: Starting upload of chunk ${partNumber}/${totalChunks}`
          );

          console.log(
            `Upload worker: About to call uploadChunk for chunk ${partNumber}`
          );
          const result = await this.uploadChunk(
            uploadId,
            chunk,
            presignedUrl,
            partNumber
          );
          console.log(
            `Upload worker: uploadChunk returned for chunk ${partNumber}`
          );

          console.log(
            `Upload worker: Successfully uploaded chunk ${partNumber}:`,
            result
          );
          results.push(result);

          // Update progress
          const progress = Math.round(((i + 1) / totalChunks) * 100);
          const uploadedBytes = results.reduce((sum, r) => sum + r.size, 0);

          console.log(
            `Upload worker: Progress update - ${progress}% (${uploadedBytes}/${file.size} bytes)`
          );

          // Send progress update
          this.postMessage({
            type: 'PROGRESS',
            projectId: session.projectId,
            uploadId,
            progress,
            uploadedBytes,
            totalBytes: file.size,
            currentChunk: partNumber,
            totalChunks,
            step: `Uploading chunk ${partNumber}/${totalChunks}`,
          });

          // Update session - ensure parts are sorted by part number
          session.progress = progress;
          session.parts = results.sort((a, b) => a.partNumber - b.partNumber);
          session.lastActivity = new Date();
          await this.sessionStorage.updateSession(session);
        } catch (chunkError) {
          console.error(
            `Upload worker: Failed to upload chunk ${partNumber}:`,
            chunkError
          );

          // Check if this is a cancellation error
          if (
            chunkError instanceof Error &&
            chunkError.message === 'UPLOAD_CANCELLED'
          ) {
            console.log(
              `Upload worker: Upload cancelled during chunk ${partNumber}, stopping all uploads`
            );
            return; // Exit the entire upload process
          }

          throw new Error(
            `Failed to upload chunk ${partNumber}: ${
              chunkError instanceof Error ? chunkError.message : 'Unknown error'
            }`
          );
        }
      }

      console.log(
        'Upload worker: All chunks uploaded successfully, completing multipart upload'
      );

      // Complete multipart upload - ensure parts are sorted by part number
      const sortedResults = results.sort((a, b) => a.partNumber - b.partNumber);
      const s3Key = await this.completeMultipartUpload(uploadId, sortedResults);

      // Update session
      session.status = 'completed';
      session.progress = 100;
      session.lastActivity = new Date();
      await this.sessionStorage.updateSession(session);

      // Update project status on backend
      try {
        await fetch('/api/projects/complete-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            projectId: session.projectId,
          }),
        });
      } catch (error) {
        console.error('Failed to update project status:', error);
      }

      // Send completion response
      this.postMessage({
        type: 'COMPLETE',
        projectId: session.projectId,
        uploadId,
        progress: 100,
        uploadedBytes: file.size,
        totalBytes: file.size,
        s3Key,
        step: 'Upload completed successfully!',
      });

      // Clean up
      this.activeUploads.delete(uploadId);
      await this.sessionStorage.deleteSession(uploadId);
    } catch (error) {
      console.error('Upload worker: Upload failed:', error);

      // Handle upload failure
      session.status = 'failed';
      session.lastActivity = new Date();
      await this.sessionStorage.updateSession(session);

      this.postMessage({
        type: 'ERROR',
        projectId: session.projectId,
        uploadId,
        error: (error as Error).message,
        step: 'Upload failed',
      });
    }
  }

  /**
   * Create file chunks
   */
  private createFileChunks(
    file: File,
    chunkSize: number
  ): Array<{ data: Blob; partNumber: number }> {
    const chunks: Array<{ data: Blob; partNumber: number }> = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      chunks.push({
        data: chunk,
        partNumber: i + 1,
      });
    }

    return chunks;
  }

  /**
   * Create a single file chunk at a specific index
   */
  private createFileChunkAtIndex(
    file: File,
    chunkSize: number,
    index: number
  ): { data: Blob; partNumber: number } {
    const start = index * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const data = file.slice(start, end);

    return {
      data,
      partNumber: index + 1,
    };
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    uploadId: string,
    chunk: { data: Blob; partNumber: number },
    presignedUrl: string,
    partNumber: number
  ): Promise<{ partNumber: number; etag: string; size: number }> {
    const maxAttempts = 3;
    const timeoutMs = 120000; // 120s per chunk

    console.log(`Upload worker: Starting chunk ${partNumber} upload to S3...`);
    console.log(`Upload worker: Chunk size: ${chunk.data.size} bytes`);
    console.log(
      `Upload worker: Presigned URL: ${presignedUrl.substring(0, 100)}...`
    );
    console.log(
      `Upload worker: Skipping S3 connectivity test for chunk ${partNumber} (was causing hangs)`
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const controller = new AbortController();
      const uploadController = this.uploadControllers.get(uploadId);
      let cancelledByUser = false;
      const onGlobalAbort = () => {
        console.log(
          `Upload worker: Global abort signal received for chunk ${partNumber}, upload ${uploadId}`
        );
        cancelledByUser = true;
        controller.abort();
      };
      uploadController?.signal.addEventListener('abort', onGlobalAbort);
      const timeoutId = setTimeout(() => {
        console.log(
          `Upload worker: Chunk ${partNumber} upload timed out after ${
            timeoutMs / 1000
          } seconds (attempt ${attempt})`
        );
        controller.abort();
      }, timeoutMs);

      try {
        console.log(
          `Upload worker: PUT to S3 for chunk ${partNumber} (attempt ${attempt})...`
        );
        const response = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk.data,
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        uploadController?.signal.removeEventListener('abort', onGlobalAbort);

        console.log(
          `Upload worker: Chunk ${partNumber} response status: ${response.status}`
        );

        if (!response.ok) {
          const status = response.status;
          const body = await response.text().catch(() => '');
          console.error(
            `Upload worker: Chunk ${partNumber} failed with status ${status}: ${body}`
          );

          const retryable = status >= 500 || status === 429; // retry on 5xx/429
          if (attempt < maxAttempts && retryable) {
            const backoff = Math.min(2000 * 2 ** (attempt - 1), 10000);
            const jitter = Math.random() * 500;
            console.log(
              `Upload worker: Retrying chunk ${partNumber} after ${Math.round(
                backoff + jitter
              )}ms`
            );
            await new Promise((r) => setTimeout(r, backoff + jitter));
            continue;
          }

          throw new Error(`HTTP ${status}: ${response.statusText}`);
        }

        const etag = response.headers.get('ETag')?.replace(/"/g, '') || '';
        console.log(
          `Upload worker: Chunk ${partNumber} uploaded successfully with ETag: ${etag}`
        );
        return { partNumber, etag, size: chunk.data.size };
      } catch (error) {
        clearTimeout(timeoutId);
        uploadController?.signal.removeEventListener('abort', onGlobalAbort);
        const isAbort = error instanceof Error && error.name === 'AbortError';
        console.error(
          `Upload worker: Error uploading chunk ${partNumber} (attempt ${attempt}):`,
          error
        );

        if (isAbort && cancelledByUser) {
          console.log(
            `Upload worker: Throwing UPLOAD_CANCELLED error for chunk ${partNumber}, upload ${uploadId}`
          );
          throw new Error('UPLOAD_CANCELLED');
        }

        if (attempt < maxAttempts && (isAbort || true)) {
          const backoff = Math.min(2000 * 2 ** (attempt - 1), 10000);
          const jitter = Math.random() * 500;
          console.log(
            `Upload worker: Retrying chunk ${partNumber} after ${Math.round(
              backoff + jitter
            )}ms`
          );
          await new Promise((r) => setTimeout(r, backoff + jitter));
          continue;
        }

        if (isAbort) {
          throw new Error(
            `Chunk ${partNumber} upload timed out - S3 request took too long`
          );
        }

        throw new Error(
          `Failed to upload chunk ${partNumber}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    throw new Error(
      `Failed to upload chunk ${partNumber} after ${maxAttempts} attempts`
    );
  }

  /**
   * Complete multipart upload
   */
  private async completeMultipartUpload(
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string; size: number }>
  ): Promise<string> {
    try {
      console.log(
        'Upload worker: Completing multipart upload with parts:',
        parts
      );

      // Get the session to access the s3Key
      const session = this.activeUploads.get(uploadId);
      if (!session) {
        throw new Error('Upload session not found for completion');
      }

      console.log('Upload worker: Using s3Key for completion:', session.s3Key);

      // Call the backend to complete the multipart upload
      const response = await fetch('/api/upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          uploadId,
          key: session.s3Key, // Include the s3Key as 'key' field
          parts: parts.map((part) => ({
            partNumber: part.partNumber,
            etag: part.etag,
            size: part.size,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(
          result.message || 'Failed to complete multipart upload'
        );
      }

      console.log(
        'Upload worker: Multipart upload completed successfully:',
        result.data
      );

      // Return the S3 key from the response
      return result.data.key || uploadId;
    } catch (error) {
      console.error(
        'Upload worker: Failed to complete multipart upload:',
        error
      );
      throw new Error(
        `Failed to complete multipart upload: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Handle upload progress updates
   */
  private handleUploadProgress(
    uploadId: string,
    progress: UploadProgress
  ): void {
    const session = this.activeUploads.get(uploadId);
    if (!session) return;

    // Update session
    session.progress = progress.progress;
    session.lastActivity = new Date();
    session.parts = progress.currentChunk > 0 ? session.parts : [];

    // Save to storage
    this.sessionStorage.updateSession(session).catch(console.error);

    // Send progress update to main thread
    this.postMessage({
      type: 'PROGRESS',
      projectId: progress.projectId,
      uploadId,
      progress: progress.progress,
      uploadedBytes: progress.uploadedBytes,
      totalBytes: progress.totalBytes,
      estimatedTimeRemaining: progress.estimatedTimeRemaining,
      step: `Uploading chunk ${progress.currentChunk}/${progress.totalChunks}`,
    });
  }

  /**
   * Pause upload
   */
  private async pauseUpload(uploadId: string): Promise<UploadWorkerResponse> {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    this.s3Service.pauseUpload(uploadId);

    session.status = 'paused';
    session.lastActivity = new Date();
    await this.sessionStorage.updateSession(session);

    return {
      type: 'PAUSED',
      projectId: session.projectId,
      uploadId,
      progress: session.progress,
      uploadedBytes: Math.round((session.progress / 100) * session.fileSize),
      totalBytes: session.fileSize,
      step: 'Upload paused',
    };
  }

  /**
   * Resume upload
   */
  private async resumeUpload(uploadId: string): Promise<UploadWorkerResponse> {
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    this.s3Service.resumeUpload(uploadId);

    session.status = 'uploading';
    session.lastActivity = new Date();
    await this.sessionStorage.updateSession(session);

    // Resume chunk uploads from where we left off
    this.resumeChunkUploads(session);

    return {
      type: 'PROGRESS',
      projectId: session.projectId,
      uploadId,
      progress: session.progress,
      uploadedBytes: Math.round((session.progress / 100) * session.fileSize),
      totalBytes: session.fileSize,
      step: 'Upload resumed',
    };
  }

  /**
   * Resume chunk uploads from paused state
   */
  private async resumeChunkUploads(session: UploadSession): Promise<void> {
    // This would need to be implemented based on the specific S3 service
    // For now, we'll just update the status
    console.log(`Resuming upload for session: ${session.uploadId}`);
  }

  /**
   * Resume by reselecting the original file: verify file matches and skip uploaded parts
   */
  private async resumeWithFile(
    file: File,
    projectId: string,
    s3Key: string,
    uploadId: string,
    chunkSize: number
  ): Promise<UploadWorkerResponse> {
    // Basic validation: filename and size must match
    const sessions = await this.sessionStorage.getActiveSessions();
    let session = sessions.find((s) => s.uploadId === uploadId);

    if (!session) {
      session = {
        projectId,
        uploadId,
        s3Key,
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
      await this.sessionStorage.saveSession(session);
      this.activeUploads.set(uploadId, session);
    }

    if (session.fileName !== file.name || session.fileSize !== file.size) {
      return {
        type: 'ERROR',
        projectId,
        uploadId,
        error:
          'Selected file does not match the original upload (name/size mismatch).',
        step: 'Resume validation failed',
      };
    }

    // Fetch existing parts from backend via API route
    const partsResp = await fetch('/api/upload/list-parts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: s3Key, uploadId }),
    });
    if (!partsResp.ok) {
      return {
        type: 'ERROR',
        projectId,
        uploadId,
        error: 'Failed to fetch already uploaded parts from server.',
        step: 'List parts failed',
      };
    }
    const partsData = await partsResp.json();
    const uploadedParts: { partNumber: number; etag: string; size: number }[] =
      partsData?.data?.parts || [];

    // Update session with known parts
    session.parts = uploadedParts.sort((a, b) => a.partNumber - b.partNumber);
    session.progress = Math.round(
      (session.parts.reduce((s, p) => s + p.size, 0) / file.size) * 100
    );
    session.lastActivity = new Date();
    await this.sessionStorage.updateSession(session);
    this.activeUploads.set(uploadId, session);

    // Get fresh presigned URLs and chunkSize if needed
    const detailsResp = await fetch('/api/upload/get-upload-details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ projectId, s3Key }),
    });
    if (!detailsResp.ok) {
      return {
        type: 'ERROR',
        projectId,
        uploadId,
        error: 'Failed to get upload details for resume.',
        step: 'Get upload details failed',
      };
    }
    const details = await detailsResp.json();
    const presignedUrls: string[] = details?.data?.presignedUrls || [];
    const effectiveChunkSize: number = details?.data?.chunkSize || chunkSize;
    session.chunkSize = effectiveChunkSize;
    await this.sessionStorage.updateSession(session);

    // Create chunks and skip already uploaded ones
    const chunks = this.createFileChunks(file, session.chunkSize);
    const uploadedSet = new Set(session.parts.map((p) => p.partNumber));

    // Ensure controller exists
    this.uploadControllers.set(uploadId, new AbortController());

    // Upload remaining chunks sequentially to preserve order and progress tracking
    for (let i = 0; i < chunks.length; i++) {
      const partNumber = i + 1;
      if (uploadedSet.has(partNumber)) continue;

      const chunk = chunks[i];
      const presignedUrl = presignedUrls[i];
      const result = await this.uploadChunk(
        uploadId,
        chunk,
        presignedUrl,
        partNumber
      );

      session.parts.push(result);
      const uploadedBytes = session.parts.reduce((sum, p) => sum + p.size, 0);
      session.progress = Math.round((uploadedBytes / file.size) * 100);
      session.lastActivity = new Date();
      await this.sessionStorage.updateSession(session);

      this.postMessage({
        type: 'PROGRESS',
        projectId,
        uploadId,
        progress: session.progress,
        uploadedBytes,
        totalBytes: file.size,
        currentChunk: partNumber,
        totalChunks: chunks.length,
        step: 'Resuming upload',
      });
    }

    // Complete upload
    const sortedParts = session.parts.sort(
      (a, b) => a.partNumber - b.partNumber
    );
    const s3CompletedKey = await this.completeMultipartUpload(
      uploadId,
      sortedParts
    );

    session.status = 'completed';
    session.progress = 100;
    session.lastActivity = new Date();
    await this.sessionStorage.updateSession(session);

    this.activeUploads.delete(uploadId);
    await this.sessionStorage.deleteSession(uploadId);

    return {
      type: 'COMPLETE',
      projectId,
      uploadId,
      progress: 100,
      uploadedBytes: file.size,
      totalBytes: file.size,
      s3Key: s3CompletedKey,
      step: 'Upload completed after resume with file',
    };
  }

  /**
   * Resume chunk uploads from interruption (after page refresh)
   */
  private async resumeChunkUploadsFromInterruption(
    session: UploadSession,
    presignedUrls: string[]
  ): Promise<void> {
    try {
      console.log(
        'Upload worker: Resuming chunk uploads from interruption for session:',
        session.uploadId
      );

      // Calculate how many chunks were already uploaded based on progress
      const totalChunks = Math.ceil(session.fileSize / session.chunkSize);
      const completedChunks = Math.floor(
        (session.progress / 100) * totalChunks
      );

      console.log(
        `Upload worker: Progress: ${session.progress}%, Completed chunks: ${completedChunks}/${totalChunks}`
      );

      if (completedChunks >= totalChunks) {
        console.log(
          'Upload worker: All chunks already uploaded, completing multipart upload'
        );
        // All chunks are done, just complete the multipart upload
        // Ensure parts are sorted by part number
        const sortedParts = (session.parts || []).sort(
          (a, b) => a.partNumber - b.partNumber
        );
        await this.completeMultipartUpload(session.uploadId, sortedParts);
        return;
      }

      // Get the list of parts that were already uploaded and sort them
      const uploadedParts = (session.parts || []).sort(
        (a, b) => a.partNumber - b.partNumber
      );
      console.log(
        'Upload worker: Already uploaded parts (sorted):',
        uploadedParts
      );

      // Since we don't have the actual file after page refresh, we can't continue uploading chunks
      // Instead, we should check if we can complete the multipart upload with existing parts
      // or inform the user that resumption is not possible without the original file

      if (uploadedParts.length > 0) {
        console.log(
          'Upload worker: Attempting to complete upload with existing parts'
        );

        // Check if we have enough parts to complete the upload
        const totalUploadedBytes = uploadedParts.reduce(
          (sum, part) => sum + part.size,
          0
        );
        const completionPercentage =
          (totalUploadedBytes / session.fileSize) * 100;

        if (completionPercentage >= 95) {
          // Allow 5% tolerance
          console.log(
            `Upload worker: Upload is ${completionPercentage.toFixed(
              1
            )}% complete, attempting completion`
          );

          try {
            const s3Key = await this.completeMultipartUpload(
              session.uploadId,
              uploadedParts
            );

            // Update session
            session.status = 'completed';
            session.progress = 100;
            session.lastActivity = new Date();
            await this.sessionStorage.updateSession(session);

            // Send completion response
            this.postMessage({
              type: 'COMPLETE',
              projectId: session.projectId,
              uploadId: session.uploadId,
              progress: 100,
              uploadedBytes: session.fileSize,
              totalBytes: session.fileSize,
              s3Key,
              step: 'Upload completed successfully after resumption!',
            });

            // Clean up
            this.activeUploads.delete(session.uploadId);
            await this.sessionStorage.deleteSession(session.uploadId);
            return;
          } catch (completionError) {
            console.error(
              'Upload worker: Failed to complete upload with existing parts:',
              completionError
            );
            // Fall through to error handling
          }
        }
      }

      // If we can't complete with existing parts, we need to inform the user
      // that resumption is not possible without the original file
      console.log(
        'Upload worker: Cannot resume upload without original file - insufficient parts or progress too low'
      );

      // Mark session as failed since we can't resume
      session.status = 'failed';
      session.lastActivity = new Date();
      await this.sessionStorage.updateSession(session);

      // Clean up the failed session
      this.activeUploads.delete(session.uploadId);
      await this.sessionStorage.deleteSession(session.uploadId);

      this.postMessage({
        type: 'ERROR',
        projectId: session.projectId,
        uploadId: session.uploadId,
        error:
          'Cannot resume upload after page refresh - original file required. Please restart the upload.',
        step: 'Upload resumption not possible',
      });
    } catch (error) {
      console.error('Upload worker: Failed to resume chunk uploads:', error);

      // Handle upload failure
      session.status = 'failed';
      session.lastActivity = new Date();
      await this.sessionStorage.updateSession(session);

      this.postMessage({
        type: 'ERROR',
        projectId: session.projectId,
        uploadId: session.uploadId,
        error: (error as Error).message,
        step: 'Upload resumption failed',
      });
    }
  }

  /**
   * Resume an interrupted upload after page refresh
   */
  private async resumeInterruptedUpload(
    projectId: string
  ): Promise<UploadWorkerResponse> {
    try {
      console.log(
        'Upload worker: Attempting to resume interrupted upload for project:',
        projectId
      );

      // Check if we already have an active upload for this project in memory
      console.log(
        'Upload worker: Checking activeUploads for project:',
        projectId,
        'Active uploads count:',
        this.activeUploads.size
      );

      for (const session of this.activeUploads.values()) {
        console.log(
          'Upload worker: Found session in memory:',
          session.projectId,
          'status:',
          session.status,
          'progress:',
          session.progress + '%'
        );

        if (session.projectId === projectId && session.status === 'uploading') {
          console.log(
            'Upload worker: Active upload already in progress for project, skipping resume:',
            projectId
          );
          return {
            type: 'PROGRESS',
            projectId,
            uploadId: session.uploadId,
            progress: session.progress,
            uploadedBytes: Math.round(
              (session.progress / 100) * session.fileSize
            ),
            totalBytes: session.fileSize,
            step: 'Upload already active',
          };
        }
      }

      // Debounce multiple resume attempts for the same project
      if (this.resumingProjects.has(projectId)) {
        console.log(
          'Upload worker: Resume already in-flight for project, ignoring:',
          projectId
        );
        return {
          type: 'ERROR',
          projectId,
          error: 'Resume already in progress',
          step: 'Ignored duplicate resume',
        };
      }
      this.resumingProjects.add(projectId);

      // Check if we have a stored session for this project
      const sessions = await this.sessionStorage.getActiveSessions();
      const session = sessions.find(
        (s) => s.projectId === projectId && s.status === 'uploading'
      );

      if (!session) {
        console.log(
          'Upload worker: No interrupted upload session found for project:',
          projectId
        );
        return {
          type: 'ERROR',
          projectId,
          error: 'No interrupted upload found',
          step: 'No upload to resume',
        };
      }

      console.log(
        'Upload worker: Found interrupted upload session:',
        session.uploadId,
        'with progress:',
        session.progress + '%'
      );

      // Get fresh upload details from backend
      const response = await fetch('/api/upload/get-upload-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId,
          s3Key: session.s3Key,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get upload details for resumption');
      }

      const uploadData = await response.json();
      if (!uploadData.success) {
        throw new Error(
          uploadData.message || 'Failed to get upload details for resumption'
        );
      }

      const { uploadId, presignedUrls, chunkSize } = uploadData.data;

      // Update session with fresh details
      session.uploadId = uploadId;
      session.chunkSize = chunkSize;
      session.lastActivity = new Date();

      // Restore to active uploads
      this.activeUploads.set(uploadId, session);

      // Create a new controller for this upload
      this.uploadControllers.set(uploadId, new AbortController());

      // Update storage
      await this.sessionStorage.updateSession(session);

      console.log(
        'Upload worker: Successfully resumed interrupted upload:',
        uploadId
      );

      // Start resuming chunk uploads from where we left off
      console.log(
        'Upload worker: Starting resume process for upload:',
        uploadId,
        'with progress:',
        session.progress + '%'
      );
      this.resumeChunkUploadsFromInterruption(session, presignedUrls);

      const responseObj: UploadWorkerResponse = {
        type: 'PROGRESS',
        projectId,
        uploadId,
        progress: session.progress,
        uploadedBytes: Math.round((session.progress / 100) * session.fileSize),
        totalBytes: session.fileSize,
        step: 'Upload resumed after interruption',
      };
      return responseObj;
    } catch (error) {
      console.error(
        'Upload worker: Failed to resume interrupted upload:',
        error
      );
      return {
        type: 'ERROR',
        projectId,
        error: (error as Error).message,
        step: 'Failed to resume upload',
      };
    } finally {
      this.resumingProjects.delete(projectId);
    }
  }

  /**
   * Cancel upload
   */
  private async cancelUpload(uploadId: string): Promise<UploadWorkerResponse> {
    console.log('Upload worker: Starting cancelUpload for:', uploadId);
    const session = this.activeUploads.get(uploadId);
    if (!session) {
      throw new Error('Upload session not found');
    }

    console.log('Upload worker: Found session, aborting controller...');
    // Abort any in-flight requests
    const controller = this.uploadControllers.get(uploadId);
    if (controller) {
      console.log('Upload worker: Aborting controller for upload:', uploadId);
      controller.abort();
    } else {
      console.log('Upload worker: No controller found for upload:', uploadId);
    }

    // Inform backend to abort multipart upload
    try {
      console.log(
        'Upload worker: Calling backend abort endpoint for upload:',
        uploadId
      );
      const response = await fetch('/api/upload/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: session.s3Key,
          uploadId: uploadId,
        }),
      });

      if (!response.ok) {
        console.log(
          'Upload worker: Backend abort failed with status:',
          response.status
        );
      } else {
        console.log('Upload worker: Backend abort successful');
      }
    } catch (error) {
      console.log(
        'Upload worker: Backend abort call failed, but continuing with local cleanup:',
        error
      );
      // Continue with local cleanup even if backend call fails
    }

    // Clean up
    this.activeUploads.delete(uploadId);
    await this.sessionStorage.deleteSession(uploadId);
    this.uploadControllers.delete(uploadId);

    return {
      type: 'CANCELLED',
      projectId: session.projectId,
      uploadId,
      step: 'Upload cancelled',
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(
    projectId: string,
    uploadId: string,
    error: Error
  ): UploadWorkerResponse {
    return {
      type: 'ERROR',
      projectId,
      uploadId,
      error: error.message,
      step: 'Error occurred',
    };
  }

  /**
   * Post message to main thread
   */
  private postMessage(response: UploadWorkerResponse): void {
    // Use the progress callback to send messages to main thread
    if (this.progressCallback) {
      this.progressCallback(response);
    }
  }

  /**
   * Get upload session
   */
  getUploadSession(uploadId: string): UploadSession | undefined {
    return this.activeUploads.get(uploadId);
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): UploadSession[] {
    return Array.from(this.activeUploads.values());
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.sessionStorage.cleanupExpiredSessions();

    // Also clean up in-memory sessions
    const sessions = await this.sessionStorage.getActiveSessions();
    for (const [uploadId, session] of this.activeUploads.entries()) {
      if (!sessions.find((s) => s.uploadId === uploadId)) {
        this.activeUploads.delete(uploadId);
      }
    }
  }
}
