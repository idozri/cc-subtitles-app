import { UploadWorker } from './upload-worker';
import { UploadWorkerMessage, UploadWorkerResponse } from '@/types/upload';

// Initialize the upload worker
const uploadWorker = new UploadWorker();

// Set the progress callback to send messages to main thread
uploadWorker.setProgressCallback((response: UploadWorkerResponse) => {
  self.postMessage(response);
});

// Handle messages from the main thread
self.onmessage = async (event: MessageEvent<UploadWorkerMessage>) => {
  try {
    const message = event.data;
    console.log('Upload worker received message:', message);

    // Process the message
    const response = await uploadWorker.handleMessage(
      message as UploadWorkerMessage
    );

    if (response) {
      // Send response back to main thread
      self.postMessage(response);
    }
  } catch (error) {
    console.error('Upload worker error:', error);

    // Send error response
    const errorResponse: UploadWorkerResponse = {
      type: 'ERROR',
      projectId: (event.data as any).projectId || '',
      uploadId: (event.data as any).uploadId || '',
      error: (error as Error).message,
      step: 'Worker error occurred',
    };

    self.postMessage(errorResponse);
  }
};

// Handle worker errors
self.onerror = (error: Event | string) => {
  console.error('Upload worker error:', error);

  const errorMessage =
    typeof error === 'string'
      ? error
      : (error as ErrorEvent)?.message || 'Unknown worker error';

  const errorResponse: UploadWorkerResponse = {
    type: 'ERROR',
    error: errorMessage,
    step: 'Worker error occurred',
  };

  self.postMessage(errorResponse);
};

// Handle unhandled promise rejections
self.onunhandledrejection = (event: PromiseRejectionEvent) => {
  console.error('Upload worker unhandled rejection:', event.reason);

  const errorResponse: UploadWorkerResponse = {
    type: 'ERROR',
    error: (event.reason as Error)?.message || 'Unhandled promise rejection',
    step: 'Worker error occurred',
  };

  self.postMessage(errorResponse);
};

// Clean up expired sessions periodically
setInterval(async () => {
  try {
    await uploadWorker.cleanupExpiredSessions();
  } catch (error) {
    console.error('Failed to cleanup expired sessions:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Log worker initialization
console.log('Upload worker initialized successfully');

// Export for testing purposes (not used in production)
export { uploadWorker };
