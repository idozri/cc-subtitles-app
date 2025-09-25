'use client';

export async function generateVideoThumbnail(
  file: File,
  seekTimeSeconds: number = 1,
  outputType: string = 'image/jpeg',
  quality: number = 0.8
): Promise<Blob> {
  if (!file.type.startsWith('video/')) {
    throw new Error('generateVideoThumbnail requires a video file');
  }

  return new Promise<Blob>((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true as any;

    const objectUrl = URL.createObjectURL(file);
    let cleanupDone = false;

    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    const handleError = (err?: any) => {
      cleanup();
      reject(err || new Error('Failed to generate thumbnail'));
    };

    const captureFrame = () => {
      try {
        const intrinsicWidth = video.videoWidth || 1280;
        const intrinsicHeight = video.videoHeight || 720;

        // Scale down very large frames to avoid browser canvas limits and ensure full-frame capture
        // Keep aspect ratio and do not crop. This fixes cases where landscape videos appeared partially captured.
        const longSide = Math.max(intrinsicWidth, intrinsicHeight);
        const MAX_LONG_SIDE = 1280; // reasonable thumbnail max for quality vs size
        const scale = Math.min(1, MAX_LONG_SIDE / longSide);
        const targetWidth = Math.max(1, Math.round(intrinsicWidth * scale));
        const targetHeight = Math.max(1, Math.round(intrinsicHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');

        // Draw the entire source video frame into the canvas, scaled to fit without cropping
        ctx.drawImage(
          video,
          0,
          0,
          intrinsicWidth,
          intrinsicHeight,
          0,
          0,
          targetWidth,
          targetHeight
        );
        canvas.toBlob(
          (blob) => {
            if (!blob) return handleError(new Error('Canvas toBlob failed'));
            cleanup();
            resolve(blob);
          },
          outputType,
          quality
        );
      } catch (e) {
        handleError(e);
      }
    };

    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration < seekTimeSeconds) {
        // If the video is very short, capture from the start
        captureFrame();
      } else {
        const target = Math.min(
          seekTimeSeconds,
          Math.max(0, video.duration - 0.1)
        );
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          captureFrame();
        };
        video.addEventListener('seeked', onSeeked);
        try {
          video.currentTime = target;
        } catch {
          // Fallback if setting currentTime throws
          captureFrame();
        }
      }
    });

    video.addEventListener('error', () =>
      handleError(new Error('Video error'))
    );
    video.src = objectUrl;
  });
}
