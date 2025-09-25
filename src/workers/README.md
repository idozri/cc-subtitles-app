# Upload Worker System

## Overview

The Upload Worker System provides background file uploads using Web Workers for non-blocking S3 multipart uploads. This system allows users to start uploads and navigate away while uploads continue in the background.

## Architecture

```
Main Thread (React) ←→ Web Worker ←→ S3 Upload Service
     ↓                    ↓              ↓
  UI Updates        Background      Multipart Upload
  Progress Bar      Processing      Chunk Management
  User Controls     Session Mgmt    Retry Logic
```

## Key Features

- **Background Processing**: Uploads continue even when user navigates away
- **Multipart Upload**: Large files are split into configurable chunks (8-32MB)
- **Progress Tracking**: Real-time progress updates with byte-level precision
- **Resumable Uploads**: Upload sessions persist in IndexedDB for recovery
- **Pause/Resume**: Users can pause and resume uploads at any time
- **Error Handling**: Comprehensive error handling with retry logic
- **Parallel Processing**: Multiple chunks uploaded simultaneously for better performance

## Components

### 1. Upload Types (`types/upload.ts`)

Defines all TypeScript interfaces for the upload system:

- `UploadWorkerMessage`: Messages sent to the worker
- `UploadWorkerResponse`: Responses from the worker
- `UploadSession`: Upload session data
- `UploadProgress`: Progress tracking data
- `UploadError`: Error classification and handling

### 2. S3 Upload Service (`lib/s3-upload.ts`)

Core upload logic:

- Multipart upload initiation
- Chunk upload with retry logic
- Progress tracking and status updates
- Upload session management
- Error handling and recovery

### 3. Upload Session Storage (`lib/upload-session-storage.ts`)

IndexedDB-based persistence:

- Upload session storage and retrieval
- Session recovery after page reloads
- Automatic cleanup of expired sessions
- Database management and optimization

### 4. Upload Worker (`workers/upload-worker.ts`)

Main worker class:

- Message handling and routing
- Upload orchestration
- Session management
- Progress reporting

### 5. Worker Entry Point (`workers/upload-worker.worker.ts`)

Web Worker initialization:

- Worker setup and configuration
- Message event handling
- Error handling and logging
- Periodic cleanup tasks

### 6. React Hook (`hooks/use-upload-worker.ts`)

Easy integration with React components:

- Worker lifecycle management
- State synchronization
- Upload control methods
- Progress and error tracking

## Usage

### Basic Usage

```typescript
import { useUploadWorker } from '@/hooks/use-upload-worker';

function MyComponent() {
  const {
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    activeUploads,
    uploadProgress,
    uploadErrors,
  } = useUploadWorker();

  const handleFileUpload = async (file: File) => {
    const uploadId = await startUpload(file, 'project-123', 'videos/video.mp4');
    if (uploadId) {
      console.log('Upload started:', uploadId);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => handleFileUpload(e.target.files[0])}
      />

      {Array.from(activeUploads.entries()).map(([uploadId, session]) => (
        <div key={uploadId}>
          <p>
            {session.fileName} - {uploadProgress.get(uploadId)?.progress || 0}%
          </p>
          <button onClick={() => pauseUpload(uploadId)}>Pause</button>
          <button onClick={() => resumeUpload(uploadId)}>Resume</button>
          <button onClick={() => cancelUpload(uploadId)}>Cancel</button>
        </div>
      ))}
    </div>
  );
}
```

### Advanced Configuration

```typescript
import { DEFAULT_UPLOAD_CONFIG } from '@/types/upload';

// Custom upload configuration
const customConfig = {
  ...DEFAULT_UPLOAD_CONFIG,
  chunkSize: 16 * 1024 * 1024, // 16MB chunks
  maxConcurrentChunks: 5, // Upload 5 chunks simultaneously
  maxRetries: 5, // Retry failed chunks 5 times
  retryDelay: 2000, // Start with 2 second delay
};
```

## API Reference

### Upload Worker Hook

#### Methods

- `startUpload(file, projectId, s3Key)`: Start a new upload
- `pauseUpload(uploadId)`: Pause an active upload
- `resumeUpload(uploadId)`: Resume a paused upload
- `cancelUpload(uploadId)`: Cancel an upload completely

#### State

- `activeUploads`: Map of active upload sessions
- `uploadProgress`: Map of upload progress data
- `uploadErrors`: Map of upload error messages

#### Utilities

- `getUploadSession(uploadId)`: Get upload session details
- `isUploading(uploadId)`: Check if upload is in progress
- `getUploadProgress(uploadId)`: Get current progress percentage

### Upload Session

```typescript
interface UploadSession {
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
```

### Upload Progress

```typescript
interface UploadProgress {
  projectId: string;
  progress: number; // 0-100 percentage
  uploadedBytes: number; // Bytes uploaded so far
  totalBytes: number; // Total file size
  currentChunk: number; // Current chunk being uploaded
  totalChunks: number; // Total number of chunks
  estimatedTimeRemaining?: number; // Estimated completion time
  speed?: number; // Upload speed in bytes/second
}
```

## Configuration

### Chunk Size Optimization

The system automatically adjusts chunk sizes based on file size:

- **Small files (< 100MB)**: 8MB chunks
- **Medium files (100MB - 1GB)**: 16MB chunks
- **Large files (> 1GB)**: 32MB chunks

### Concurrent Uploads

- **Default**: 3 chunks uploaded simultaneously
- **Configurable**: Adjust based on server capacity and user connection
- **Optimization**: Parallel uploads improve overall performance

### Retry Logic

- **Exponential Backoff**: Retry delays increase with each attempt
- **Configurable Attempts**: Default 3 retries per chunk
- **Smart Recovery**: Failed chunks are retried automatically

## Error Handling

### Error Types

- `NETWORK_ERROR`: Connection issues, retryable
- `CHUNK_UPLOAD_FAILED`: Individual chunk failures, retryable
- `UPLOAD_INIT_FAILED`: Initialization problems, retryable
- `UPLOAD_COMPLETE_FAILED`: Completion issues, retryable
- `VALIDATION_ERROR`: File validation failures, not retryable

### Recovery Strategies

- **Automatic Retry**: Failed chunks retry with exponential backoff
- **Session Persistence**: Upload progress saved for recovery
- **Graceful Degradation**: Partial failures don't affect successful chunks
- **User Feedback**: Clear error messages with recovery options

## Performance Considerations

### Memory Management

- **Chunk Streaming**: Files are processed in chunks to minimize memory usage
- **Session Cleanup**: Expired sessions are automatically removed
- **Resource Limits**: Configurable limits prevent memory leaks

### Network Optimization

- **Parallel Uploads**: Multiple chunks uploaded simultaneously
- **Connection Reuse**: HTTP connections are reused when possible
- **Progress Throttling**: Progress updates are throttled to prevent UI lag

### Browser Compatibility

- **Web Worker Support**: Requires modern browsers with Web Worker support
- **IndexedDB Support**: Session persistence requires IndexedDB
- **Fallback Options**: Graceful degradation for unsupported features

## Security

### S3 Security

- **Presigned URLs**: Secure, time-limited upload URLs
- **Private Bucket**: All uploads go to private S3 bucket
- **Access Control**: User-specific upload paths and permissions

### Client Security

- **File Validation**: File type and size validation
- **Session Isolation**: Upload sessions are user-specific
- **Error Sanitization**: Sensitive information is not exposed in errors

## Testing

### Demo Component

Use the `UploadWorkerDemo` component to test the upload system:

```typescript
import { UploadWorkerDemo } from '@/components/upload-worker-demo';

// Add to your page for testing
<UploadWorkerDemo />;
```

### Testing Scenarios

- **Large File Uploads**: Test with files > 100MB
- **Network Interruptions**: Test pause/resume functionality
- **Browser Navigation**: Test background upload persistence
- **Error Conditions**: Test various failure scenarios
- **Concurrent Uploads**: Test multiple simultaneous uploads

## Troubleshooting

### Common Issues

1. **Worker Not Initializing**

   - Check browser Web Worker support
   - Verify file paths and imports
   - Check console for error messages

2. **Uploads Not Starting**

   - Verify file selection
   - Check project ID and S3 key
   - Ensure worker is properly initialized

3. **Progress Not Updating**

   - Check message handling in worker
   - Verify progress callback registration
   - Check for JavaScript errors

4. **Sessions Not Persisting**
   - Verify IndexedDB support
   - Check storage permissions
   - Verify session cleanup logic

### Debug Mode

Enable debug logging by setting the log level in the worker:

```typescript
// In upload-worker.worker.ts
const DEBUG = true;

if (DEBUG) {
  console.log('Upload worker debug mode enabled');
}
```

## Future Enhancements

### Planned Features

- **Resume from Network Failures**: Automatic resumption after connection loss
- **Upload Queue Management**: Queue multiple files for sequential upload
- **Bandwidth Throttling**: User-configurable upload speed limits
- **Advanced Progress Metrics**: Detailed upload analytics and reporting
- **Cross-Tab Synchronization**: Upload status sync across browser tabs

### Integration Points

- **WebSocket Integration**: Real-time status updates to server
- **Server-Side Processing**: Automatic video processing after upload
- **CloudFront Integration**: CDN optimization for video delivery
- **Analytics Integration**: Upload performance metrics and user behavior

## Contributing

When contributing to the upload worker system:

1. **Follow TypeScript Patterns**: Use strict typing and interfaces
2. **Test Error Scenarios**: Ensure robust error handling
3. **Performance Testing**: Test with large files and slow connections
4. **Browser Compatibility**: Test across different browsers and devices
5. **Documentation**: Update this README for any new features
