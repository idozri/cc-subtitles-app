import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUploadWorker } from '@/hooks/use-upload-worker';

export const UploadWorkerDemo: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState('demo-project-123');
  const [s3Key, setS3Key] = useState('demo/video.mp4');
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    activeUploads,
    uploadProgress,
    uploadErrors,
    isUploading,
    getUploadProgress,
  } = useUploadWorker();

  // Log when hook is initialized
  React.useEffect(() => {
    console.log('UploadWorkerDemo: Hook initialized');
    console.log('UploadWorkerDemo: Active uploads:', activeUploads);
    console.log('UploadWorkerDemo: Upload progress:', uploadProgress);
    console.log(
      'UploadWorkerDemo: Active uploads keys:',
      Array.from(activeUploads.keys())
    );
    console.log(
      'UploadWorkerDemo: Upload progress keys:',
      Array.from(uploadProgress.keys())
    );
    setIsInitialized(true);
  }, [activeUploads, uploadProgress]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('UploadWorkerDemo: File selected:', file.name, file.size);
      setSelectedFile(file);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    console.log(
      'UploadWorkerDemo: Starting upload for file:',
      selectedFile.name
    );

    try {
      const uploadId = await startUpload(selectedFile, projectId, s3Key);
      if (uploadId) {
        console.log('UploadWorkerDemo: Upload started with ID:', uploadId);
      } else {
        console.error(
          'UploadWorkerDemo: Failed to start upload - no upload ID returned'
        );
      }
    } catch (error) {
      console.error('UploadWorkerDemo: Error starting upload:', error);
    }
  };

  const handlePauseUpload = async (uploadId: string) => {
    console.log('UploadWorkerDemo: Pausing upload:', uploadId);
    try {
      await pauseUpload(uploadId);
      console.log('UploadWorkerDemo: Upload paused successfully');
    } catch (error) {
      console.error('UploadWorkerDemo: Error pausing upload:', error);
    }
  };

  const handleResumeUpload = async (uploadId: string) => {
    console.log('UploadWorkerDemo: Resuming upload:', uploadId);
    try {
      await resumeUpload(uploadId);
      console.log('UploadWorkerDemo: Upload resumed successfully');
    } catch (error) {
      console.error('UploadWorkerDemo: Error resuming upload:', error);
    }
  };

  const handleCancelUpload = async (uploadId: string) => {
    console.log('UploadWorkerDemo: Cancelling upload:', uploadId);
    try {
      await cancelUpload(uploadId);
      console.log('UploadWorkerDemo: Upload cancelled successfully');
    } catch (error) {
      console.error('UploadWorkerDemo: Error cancelling upload:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600)
      return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Debug Info */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Debug Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-700">
          <p>Hook Initialized: {isInitialized ? '✅ Yes' : '❌ No'}</p>
          <p>Active Uploads: {activeUploads.size}</p>
          <p>Upload Progress Entries: {uploadProgress.size}</p>
          <p>Upload Errors: {uploadErrors.size}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Worker Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <label htmlFor="file-input" className="text-sm font-medium">
              Select Video File
            </label>
            <Input
              id="file-input"
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="cursor-pointer"
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} (
                {formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Project Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="project-id" className="text-sm font-medium">
                Project ID
              </label>
              <Input
                id="project-id"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                placeholder="Enter project ID"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="s3-key" className="text-sm font-medium">
                S3 Key
              </label>
              <Input
                id="s3-key"
                value={s3Key}
                onChange={(e) => setS3Key(e.target.value)}
                placeholder="Enter S3 key"
              />
            </div>
          </div>

          {/* Upload Controls */}
          <div className="flex gap-2">
            <Button
              onClick={handleStartUpload}
              disabled={!selectedFile}
              className="flex-1"
            >
              Start Upload
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Uploads */}
      {activeUploads.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Uploads ({activeUploads.size})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from(activeUploads.entries()).map(([uploadId, session]) => {
              const progress = getUploadProgress(uploadId);
              const error = uploadErrors.get(uploadId);
              const isUploadingStatus = isUploading(uploadId);

              return (
                <div key={uploadId} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{session.fileName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(session.fileSize)} • {session.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {session.status === 'uploading' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePauseUpload(uploadId)}
                        >
                          Pause
                        </Button>
                      )}
                      {session.status === 'paused' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResumeUpload(uploadId)}
                        >
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleCancelUpload(uploadId)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{progress}%</span>
                      <span>
                        {formatFileSize(
                          Math.round((progress / 100) * session.fileSize)
                        )}{' '}
                        / {formatFileSize(session.fileSize)}
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      Error: {error}
                    </div>
                  )}

                  {/* Upload Details */}
                  <div className="text-xs text-muted-foreground">
                    <p>Upload ID: {uploadId}</p>
                    <p>Started: {session.startedAt.toLocaleTimeString()}</p>
                    <p>
                      Last Activity: {session.lastActivity.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Select a video file using the file input above</p>
          <p>2. Configure the Project ID and S3 Key (or use defaults)</p>
          <p>3. Click "Start Upload" to begin the background upload</p>
          <p>
            4. Monitor progress and control uploads using the controls below
          </p>
          <p>5. Uploads continue in the background even if you navigate away</p>
          <p>6. Check the browser console for detailed debug information</p>
        </CardContent>
      </Card>
    </div>
  );
};
