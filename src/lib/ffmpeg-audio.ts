'use client';

let ffmpegInstance: any | null = null;
let loadPromise: Promise<void> | null = null;

export type AudioExtractProgress = {
  ratio: number;
};

export async function ensureFfmpegLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      console.log('Loading FFmpeg...');
      const mod = (await import('@ffmpeg/ffmpeg')) as any;
      console.log('FFmpeg module loaded:', mod);

      const create = mod.createFFmpeg || mod.default?.createFFmpeg;
      const FFmpegClass = mod.FFmpeg || mod.default?.FFmpeg;

      // Avoid using workers as requested
      if (typeof create === 'function') {
        console.log('Using createFFmpeg...');
        ffmpegInstance = create({ log: true, worker: false });
      } else if (typeof FFmpegClass === 'function') {
        console.log('Using FFmpeg class...');
        ffmpegInstance = new FFmpegClass({ log: true, worker: false });
      } else {
        throw new Error('FFmpeg module did not expose createFFmpeg/FFmpeg');
      }

      console.log('FFmpeg instance created, loading...');
      await ffmpegInstance.load();
      console.log('FFmpeg loaded successfully');
    } catch (error) {
      console.error('FFmpeg loading failed:', error);
      throw error;
    }
  })();

  return loadPromise;
}

export async function extractAudioFromVideo(
  file: File,
  onProgress?: (p: AudioExtractProgress) => void
): Promise<File> {
  console.log(
    'extractAudioFromVideo called with file:',
    file.name,
    file.size,
    file.type
  );

  await ensureFfmpegLoaded();

  if (!ffmpegInstance) {
    throw new Error('FFmpeg failed to initialize');
  }

  console.log('FFmpeg instance ready, starting extraction...');

  if (typeof ffmpegInstance.setProgress === 'function' && onProgress) {
    ffmpegInstance.setProgress(({ ratio }: { ratio: number }) => {
      onProgress({ ratio: Math.min(1, Math.max(0, ratio || 0)) });
    });
  }

  const inputName = 'input_video';
  const outputName = 'output_audio.m4a';

  // Write input file into ffmpeg FS or via writeFile API
  const fetchMod = (await import('@ffmpeg/ffmpeg')) as any;
  const fetchFileFn =
    fetchMod.fetchFile ||
    fetchMod.default?.fetchFile ||
    (async (input: Blob | ArrayBuffer) =>
      new Uint8Array(
        input instanceof Blob
          ? await input.arrayBuffer()
          : (input as ArrayBuffer)
      ));
  const fileData = await fetchFileFn(file);
  if (typeof ffmpegInstance.FS === 'function') {
    ffmpegInstance.FS('writeFile', inputName, fileData);
  } else if (typeof ffmpegInstance.writeFile === 'function') {
    await ffmpegInstance.writeFile(inputName, fileData);
  } else {
    throw new Error('FFmpeg instance does not support writing files');
  }

  // Run ffmpeg to extract audio using AAC codec into .m4a container
  // -vn: no video, -ac 2: stereo, -ar 44100: sample rate, -b:a 192k: bitrate
  const args = [
    '-i',
    inputName,
    '-vn',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-b:a',
    '192k',
    '-c:a',
    'aac',
    outputName,
  ];

  console.log('Running FFmpeg with args:', args);

  try {
    if (typeof ffmpegInstance.run === 'function') {
      await ffmpegInstance.run(...args);
    } else if (typeof ffmpegInstance.exec === 'function') {
      await ffmpegInstance.exec(args);
    } else {
      throw new Error('FFmpeg instance does not support command execution');
    }
    console.log('FFmpeg execution completed');
  } catch (error) {
    console.error('FFmpeg execution failed:', error);
    throw error;
  }

  let data: any;
  if (typeof ffmpegInstance.FS === 'function') {
    data = ffmpegInstance.FS('readFile', outputName);
  } else if (typeof ffmpegInstance.readFile === 'function') {
    data = await ffmpegInstance.readFile(outputName);
  } else {
    throw new Error('FFmpeg instance does not support reading files');
  }

  // Create a File object with a reasonable name
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const audioFile = new File([data.buffer], `${baseName}.m4a`, {
    type: 'audio/mp4',
  });

  // Cleanup FS entries to free memory
  try {
    if (typeof ffmpegInstance.FS === 'function') {
      ffmpegInstance.FS('unlink', inputName);
      ffmpegInstance.FS('unlink', outputName);
    } else if (typeof ffmpegInstance.unlink === 'function') {
      await ffmpegInstance.unlink(inputName);
      await ffmpegInstance.unlink(outputName);
    }
  } catch {}

  return audioFile;
}
