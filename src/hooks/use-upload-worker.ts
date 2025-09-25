import { useCallback, useEffect, useState } from 'react';
import {
  UploadWorkerMessage,
  UploadWorkerResponse,
  UploadSession,
  UploadProgress,
} from '@/types/upload';
import { useProjectStore } from '@/lib/store/project';
import { ProjectStatus } from '@/types/project';
import { uploadWorkerManager } from '@/workers/upload-worker-manager';
import { toast } from '@/hooks/use-toast';

export interface UseUploadWorkerReturn {
  // Upload control methods
  startUpload: (
    file: File,
    projectId: string,
    s3Key: string,
    uploadId?: string,
    presignedUrls?: string[],
    chunkSize?: number
  ) => Promise<string | null>;
  pauseUpload: (uploadId: string) => Promise<void>;
  resumeUpload: (uploadId: string) => Promise<void>;
  cancelUpload: (uploadId: string) => Promise<void>;
  resumeUploadWithFile: (
    file: File,
    projectId: string,
    s3Key: string,
    uploadId: string,
    chunkSize?: number
  ) => Promise<void>;

  // Upload state
  activeUploads: Map<string, UploadSession>;
  uploadProgress: Map<string, UploadProgress>;
  uploadErrors: Map<string, string>;

  // Utility methods
  getUploadSession: (uploadId: string) => UploadSession | undefined;
  isUploading: (uploadId: string) => boolean;
  getUploadProgress: (uploadId: string) => number;
}

export const useUploadWorker = (): UseUploadWorkerReturn => {
  const { fetchProjects } = useProjectStore();
  const [activeUploads, setActiveUploads] = useState<
    Map<string, UploadSession>
  >(new Map());
  const [uploadProgress, setUploadProgress] = useState<
    Map<string, UploadProgress>
  >(new Map());
  const [uploadErrors, setUploadErrors] = useState<Map<string, string>>(
    new Map()
  );

  // Handle messages from worker
  const handleWorkerMessage = useCallback(
    async (response: UploadWorkerResponse) => {
      const {
        type,
        projectId,
        uploadId,
        progress,
        uploadedBytes,
        totalBytes,
        currentChunk,
        totalChunks,
        error,
        step,
      } = response;

      console.log('useUploadWorker: Received worker message:', {
        type,
        projectId,
        uploadId,
        progress,
        uploadedBytes,
        totalBytes,
        currentChunk,
        totalChunks,
        step,
      });

      switch (type) {
        case 'PROGRESS':
          if (uploadId && progress !== undefined) {
            console.log(
              'useUploadWorker: Processing PROGRESS message for uploadId:',
              uploadId
            );

            // Always attempt ID mapping for progress messages to ensure we have the real upload ID
            console.log(
              'useUploadWorker: Attempting ID mapping for progress message...'
            );
            // Find the temporary session and update it with the real upload ID
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              console.log(
                'useUploadWorker: Current active uploads:',
                Array.from(newUploads.entries())
              );

              let foundMapping = false;
              // Find session by projectId since that's what we know
              for (const [tempId, session] of newUploads.entries()) {
                if (
                  session.projectId === projectId &&
                  tempId.startsWith('temp_')
                ) {
                  console.log(
                    'useUploadWorker: Found temporary session:',
                    tempId,
                    'mapping to:',
                    uploadId
                  );
                  // Remove the temporary session
                  newUploads.delete(tempId);
                  // Create new session with real upload ID
                  const newSession = { ...session, uploadId };
                  newUploads.set(uploadId, newSession);
                  foundMapping = true;
                  break;
                }
              }

              // If no temporary session found (e.g., after page refresh), create a new session
              if (!foundMapping && !newUploads.has(uploadId)) {
                console.log(
                  'useUploadWorker: No temporary session found, creating new session for resumed upload:',
                  uploadId
                );
                newUploads.set(uploadId, {
                  projectId: projectId || '',
                  uploadId,
                  s3Key: '',
                  parts: [],
                  nextPartNumber: 1,
                  status: 'uploading',
                  progress: progress || 0,
                  fileSize: totalBytes || 0,
                  fileName: '',
                  startedAt: new Date(),
                  lastActivity: new Date(),
                  chunkSize: 0,
                });
              }

              return newUploads;
            });

            setUploadProgress((prev) => {
              console.log(
                'useUploadWorker: Setting upload progress for:',
                uploadId,
                'progress:',
                progress
              );

              return new Map(prev).set(uploadId, {
                projectId: projectId || '',
                progress,
                uploadedBytes: uploadedBytes || 0,
                totalBytes: totalBytes || 0,
                currentChunk: currentChunk || 0,
                totalChunks: totalChunks || 0,
              });
            });

            // Update the active upload session progress
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              const existing = newUploads.get(uploadId);

              if (existing) {
                // Update existing session progress
                existing.progress = progress;
                existing.lastActivity = new Date();
                newUploads.set(uploadId, existing);
              }
              // Note: Session creation is now handled in the ID mapping section above

              return newUploads;
            });

            // Clear any previous errors
            setUploadErrors((prev) => {
              const newErrors = new Map(prev);
              newErrors.delete(uploadId);
              return newErrors;
            });
          }
          break;

        case 'COMPLETE':
          if (uploadId) {
            // Remove from active uploads and progress
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              newUploads.delete(uploadId);
              return newUploads;
            });

            setUploadProgress((prev) => {
              const newProgress = new Map(prev);
              newProgress.delete(uploadId);
              return newProgress;
            });

            // Clear any errors
            setUploadErrors((prev) => {
              const newErrors = new Map(prev);
              newErrors.delete(uploadId);
              return newErrors;
            });

            // Refresh projects from server to get updated status
            fetchProjects().catch((error) => {
              console.error(
                'Failed to refresh projects after upload completion:',
                error
              );
            });
          }
          break;

        case 'ERROR':
          if (uploadId && error) {
            setUploadErrors((prev) => new Map(prev).set(uploadId, error));

            // Update upload status to failed
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              const upload = newUploads.get(uploadId);
              if (upload) {
                upload.status = 'failed';
                newUploads.set(uploadId, upload);
              }
              return newUploads;
            });

            // If this is a resume failure, reset the project status so user can restart
            if (error.includes('Cannot resume upload after page refresh')) {
              console.log(
                'useUploadWorker: Resume failed, resetting project status for:',
                projectId
              );

              // Show toast notification to user
              toast({
                title: 'Upload Resume Failed',
                description:
                  'The upload could not be resumed after page refresh. Please restart the upload.',
                variant: 'destructive',
              });

              // Reset project status to allow restart
              if (projectId) {
                await useProjectStore
                  .getState()
                  .updateProjectStatus(projectId, ProjectStatus.FAILED);
              }

              // Clean up the failed upload session
              setActiveUploads((prev) => {
                const newUploads = new Map(prev);
                newUploads.delete(uploadId);
                return newUploads;
              });

              setUploadProgress((prev) => {
                const newProgress = new Map(prev);
                newProgress.delete(uploadId);
                return newProgress;
              });

              setUploadErrors((prev) => {
                const newErrors = new Map(prev);
                newErrors.delete(uploadId);
                return newErrors;
              });
            }
          }
          break;

        case 'PAUSED':
          if (uploadId) {
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              const upload = newUploads.get(uploadId);
              if (upload) {
                upload.status = 'paused';
                newUploads.set(uploadId, upload);
              }
              return newUploads;
            });
          }
          break;

        case 'CANCELLED':
          if (uploadId) {
            // Remove from all maps
            setActiveUploads((prev) => {
              const newUploads = new Map(prev);
              newUploads.delete(uploadId);
              return newUploads;
            });

            setUploadProgress((prev) => {
              const newProgress = new Map(prev);
              newProgress.delete(uploadId);
              return newProgress;
            });

            setUploadErrors((prev) => {
              const newErrors = new Map(prev);
              newErrors.delete(uploadId);
              return newErrors;
            });
          }
          break;
      }
    },
    []
  );

  // Subscribe to singleton worker messages
  useEffect(() => {
    const unsubscribe =
      uploadWorkerManager.addMessageListener(handleWorkerMessage);
    return () => unsubscribe();
  }, [handleWorkerMessage]);

  // Send message to worker
  const sendMessage = useCallback(
    (message: UploadWorkerMessage): Promise<void> => {
      return new Promise((resolve, reject) => {
        try {
          uploadWorkerManager.postMessage(message);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    },
    []
  );

  // Auto-resume interrupted uploads on mount
  useEffect(() => {
    const resumeInterruptedUploads = async () => {
      try {
        // Get all projects from the store to check for interrupted uploads
        const projects = useProjectStore.getState().projects;

        for (const project of projects) {
          // Check if this project has an interrupted upload by looking at its status
          if (
            project.status === 'uploading' ||
            project.status === 'processing'
          ) {
            console.log(
              'useUploadWorker: Detected potentially interrupted upload for project:',
              project._id
            );

            // Try to resume the upload
            try {
              await sendMessage({
                type: 'RESUME_INTERRUPTED_UPLOAD',
                projectId: project._id,
              });
            } catch (error) {
              console.log(
                'useUploadWorker: Failed to resume upload for project:',
                project._id,
                error
              );
            }
          }
        }
      } catch (error) {
        console.error('useUploadWorker: Error during auto-resume:', error);
      }
    };

    // Wait a bit for the worker to be ready, then check for interrupted uploads
    const timer = setTimeout(resumeInterruptedUploads, 1000);
    return () => clearTimeout(timer);
  }, [sendMessage]);

  // Start upload
  const startUpload = useCallback(
    async (
      file: File,
      projectId: string,
      s3Key: string,
      uploadId?: string,
      presignedUrls?: string[],
      chunkSize?: number
    ): Promise<string | null> => {
      try {
        // Create initial upload session with a temporary ID
        const tempUploadId = `temp_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Create initial upload session
        const session: UploadSession = {
          projectId,
          uploadId: tempUploadId,
          s3Key,
          parts: [],
          nextPartNumber: 1,
          status: 'uploading',
          progress: 0,
          startedAt: new Date(),
          lastActivity: new Date(),
          fileSize: file.size,
          fileName: file.name,
          chunkSize: chunkSize || 8 * 1024 * 1024, // Use provided chunk size or 8MB default
        };

        // Add to active uploads with temporary ID
        setActiveUploads((prev) => new Map(prev).set(tempUploadId, session));

        // Send start message to worker
        await sendMessage({
          type: 'START_UPLOAD',
          file,
          projectId,
          s3Key,
          uploadId,
          presignedUrls,
          chunkSize,
          skipInitiation: !!(uploadId && presignedUrls && chunkSize), // Skip if we have all details
        });

        // Return temporary ID - the real ID will come from the worker response
        return tempUploadId;
      } catch (error) {
        console.error('Failed to start upload:', error);
        return null;
      }
    },
    [sendMessage]
  );

  // Pause upload
  const pauseUpload = useCallback(
    async (uploadId: string): Promise<void> => {
      try {
        await sendMessage({
          type: 'PAUSE_UPLOAD',
          uploadId,
        });
      } catch (error) {
        console.error('Failed to pause upload:', error);
      }
    },
    [sendMessage]
  );

  // Resume upload
  const resumeUpload = useCallback(
    async (uploadId: string): Promise<void> => {
      try {
        await sendMessage({
          type: 'RESUME_UPLOAD',
          uploadId,
        });
      } catch (error) {
        console.error('Failed to resume upload:', error);
      }
    },
    [sendMessage]
  );

  // Cancel upload
  const cancelUpload = useCallback(
    async (uploadId: string): Promise<void> => {
      try {
        await sendMessage({
          type: 'CANCEL_UPLOAD',
          uploadId,
        });
      } catch (error) {
        console.error('Failed to cancel upload:', error);
      }
    },
    [sendMessage]
  );

  // Resume with reselected file
  const resumeUploadWithFile = useCallback(
    async (
      file: File,
      projectId: string,
      s3Key: string,
      uploadId: string,
      chunkSize?: number
    ): Promise<void> => {
      try {
        await sendMessage({
          type: 'RESUME_WITH_FILE',
          file,
          projectId,
          s3Key,
          uploadId,
          chunkSize,
        });
      } catch (error) {
        console.error('Failed to resume with file:', error);
      }
    },
    [sendMessage]
  );

  // Utility methods
  const getUploadSession = useCallback(
    (uploadId: string): UploadSession | undefined => {
      return activeUploads.get(uploadId);
    },
    [activeUploads]
  );

  const isUploading = useCallback(
    (uploadId: string): boolean => {
      const session = activeUploads.get(uploadId);
      return session?.status === 'uploading';
    },
    [activeUploads]
  );

  const getUploadProgress = useCallback(
    (uploadId: string): number => {
      const progress = uploadProgress.get(uploadId);
      return progress?.progress || 0;
    },
    [uploadProgress]
  );

  return {
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    resumeUploadWithFile,
    activeUploads,
    uploadProgress,
    uploadErrors,
    getUploadSession,
    isUploading,
    getUploadProgress,
  };
};
