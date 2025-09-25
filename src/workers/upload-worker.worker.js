// JavaScript version of the upload worker for better Next.js compatibility
import { UploadWorker } from './upload-worker';

// Initialize the upload worker
const uploadWorker = new UploadWorker();

// Set the progress callback to send messages to main thread
uploadWorker.setProgressCallback((response) => {
  self.postMessage(response);
});

// Handle messages from the main thread
self.onmessage = async (event) => {
  try {
    const message = event.data;
    console.log('Upload worker received message:', message);

    // Process the message
    const response = await uploadWorker.handleMessage(message);

    if (response) {
      // Send response back to main thread
      self.postMessage(response);
    }
  } catch (error) {
    console.error('Upload worker error:', error);

    // Send error response
    const errorResponse = {
      type: 'ERROR',
      projectId: event.data.projectId || '',
      uploadId: event.data.uploadId || '',
      error: error.message,
      step: 'Worker error occurred',
    };

    self.postMessage(errorResponse);
  }
};

// Handle worker errors
self.onerror = (error) => {
  console.error('Upload worker error:', error);

  const errorMessage =
    typeof error === 'string'
      ? error
      : error?.message || 'Unknown worker error';

  const errorResponse = {
    type: 'ERROR',
    error: errorMessage,
    step: 'Worker error occurred',
  };

  self.postMessage(errorResponse);
};

// Handle unhandled promise rejections
self.onunhandledrejection = (event) => {
  console.error('Upload worker unhandled rejection:', event.reason);

  const errorResponse = {
    type: 'ERROR',
    error: event.reason?.message || 'Unhandled promise rejection',
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
