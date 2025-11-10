export const getVideoScaleFormat = async (
  file: File
): Promise<string | undefined> => {
  if (!file.type.startsWith('video/')) {
    return undefined;
  }

  try {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;

    return await new Promise<string | undefined>((resolve) => {
      const onLoaded = () => {
        try {
          const width = video.videoWidth;
          const height = video.videoHeight;
          URL.revokeObjectURL(url);
          video.removeEventListener('loadedmetadata', onLoaded);
          video.remove();

          if (!width || !height) {
            resolve(undefined);
            return;
          }

          const aspectRatio = width / height;

          // Determine scale format based on aspect ratio
          if (Math.abs(aspectRatio - 1) < 0.1) {
            resolve('square');
          } else if (aspectRatio > 1) {
            resolve('landscape');
          } else {
            resolve('portrait');
          }
        } catch (error) {
          resolve(undefined);
        }
      };

      video.addEventListener('loadedmetadata', onLoaded);

      // Fallback timeout
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
        video.removeEventListener('loadedmetadata', onLoaded);
        video.remove();
        resolve(undefined);
      }, 3000);
    });
  } catch {
    return undefined;
  }
};
