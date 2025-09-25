'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, FileAudio, FileVideo, Languages, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectStore } from '@/lib/store/project';
import { CreateProjectData } from '@/types/project';
import ModalLanguagePicker from '@/components/modal-language-picker';
import VideoPlayer from '@/components/video-player';
import AudioPlayer from '@/components/audio-player';
import {
  ALL_LANGUAGES,
  DEFAULT_SUGGESTIONS,
  findLanguage,
  getLastUsedLanguage,
  setLastUsedLanguage,
  Language,
} from '@/lib/languages';
import { cn } from '@/lib/utils';
import FileUpload from '@/components/file-upload';
import Image from 'next/image';
import { S3UploadService } from '@/lib/s3-upload';
import type { UploadProgress } from '@/types/upload';
import { extractAudioFromVideo } from '@/lib/ffmpeg-audio';
import { generateVideoThumbnail } from '@/lib/video-thumbnail';

const createProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  language: z.string().min(1, 'Language is required'),
  translateToEnglish: z.boolean(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export default function NewProjectNoWorkersPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [audioExtractPercent, setAudioExtractPercent] = useState<number | null>(
    null
  );
  const [audioUploadProgress, setAudioUploadProgress] =
    useState<UploadProgress | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { addProject } = useProjectStore();
  const isUploading = !!progress;

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      language: getLastUsedLanguage(),
      translateToEnglish: false,
    },
  });

  const selectedLanguage = findLanguage(form.watch('language'));
  const lastUsedLanguage = getLastUsedLanguage();

  const suggestions = useMemo(() => {
    const suggestionCodes = [
      ...new Set([
        ...(lastUsedLanguage !== 'auto' ? [lastUsedLanguage] : []),
        ...DEFAULT_SUGGESTIONS,
      ]),
    ];
    return suggestionCodes
      .map((code) => findLanguage(code))
      .filter(Boolean) as Language[];
  }, [lastUsedLanguage]);

  useEffect(() => {
    if (!selectedFile) return;
    if (selectedFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
      setAudioUrl('');
      return () => URL.revokeObjectURL(url);
    }
    if (selectedFile.type.startsWith('audio/')) {
      const url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
      setVideoUrl('');
      return () => URL.revokeObjectURL(url);
    }
  }, [selectedFile]);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    if (!isVideo && !isAudio) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a video or audio file.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedFile(file);
    if (!form.getValues('title')) {
      form.setValue('title', file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleLanguageSelect = (selectedLang: Language) => {
    form.setValue('language', selectedLang.code!);
    setLastUsedLanguage(selectedLang.code!);
  };

  const formatBytes = (bytes: number): string => {
    if (!Number.isFinite(bytes)) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${
      sizes[i]
    }`;
  };

  const formatTime = (seconds: number | undefined): string => {
    if (!seconds || !Number.isFinite(seconds)) return '—';
    const s = Math.max(0, Math.round(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}m ${r}s` : `${r}s`;
  };

  const createUploader = (): S3UploadService => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIOS = /iP(ad|hone|od)/.test(ua);
    const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
    const isMobile = /Mobi|Android/i.test(ua);
    const saveData = (navigator as any)?.connection?.saveData === true;

    const maxConcurrentChunks =
      isIOS || isSafari || saveData ? 1 : isMobile ? 2 : 3;
    // Use smaller chunks on iOS/Safari to reduce memory pressure and avoid timeouts
    const chunkSize = isIOS || isSafari ? 5 * 1024 * 1024 : 8 * 1024 * 1024;

    return new S3UploadService({ chunkSize, maxConcurrentChunks });
  };

  const handleSubmit = async (data: CreateProjectFormData) => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a video or audio file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    setProgress({
      projectId: '',
      progress: 0,
      uploadedBytes: 0,
      totalBytes: selectedFile.size,
      currentChunk: 0,
      totalChunks: 0,
    });

    try {
      const { getDeviceId } = await import('@/lib/device-id');
      const deviceId = getDeviceId();

      // If it's a video, create thumbnail BEFORE project create and send as data URL
      let thumbnailDataUrl: string | undefined;
      const isVideo = selectedFile.type.startsWith('video/');
      if (isVideo) {
        try {
          const blob = await generateVideoThumbnail(selectedFile, 1);
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(
            String.fromCharCode(...(new Uint8Array(arrayBuffer) as any))
          );
          const mime = blob.type || 'image/jpeg';
          thumbnailDataUrl = `data:${mime};base64,${base64}`;
        } catch (e) {
          console.warn('Thumbnail generation failed (non-fatal)', e);
        }
      }

      const projectData: CreateProjectData = {
        ...data,
        language: data.language === 'auto' ? '' : data.language,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        deviceId,
        ...(thumbnailDataUrl ? { thumbnailDataUrl } : {}),
      };

      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(async () => ({
          message: await response
            .text()
            .catch(() => 'Failed to create project'),
        }));
        throw new Error(
          `${errorData.message || 'Failed to create project'} (status ${
            response.status
          })`
        );
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to create project');
      }

      const { project } = result.data;
      addProject(project);

      const uploader = createUploader();
      const init = await uploader.initiateMultipartUpload(
        selectedFile,
        project._id,
        ''
      );

      await uploader.uploadChunks(
        selectedFile,
        init.uploadId,
        init.presignedUrls,
        (p) => {
          setProgress(p);
        }
      );

      if (isVideo) {
        // For video files: complete the main upload first
        try {
          await uploader.completeMultipartUpload(init.uploadId);
        } catch (e) {
          console.error('Complete upload failed:', e);
          throw e;
        }

        // Then extract audio and upload separately
        try {
          setAudioExtractPercent(0);
          console.log('Starting audio extraction from video...');

          // Add timeout to prevent hanging
          const audioExtractionPromise = extractAudioFromVideo(
            selectedFile,
            ({ ratio }) => {
              console.log('Audio extraction progress:', ratio);
              setAudioExtractPercent(Math.round((ratio || 0) * 100));
            }
          );

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(
              () =>
                reject(new Error('Audio extraction timeout after 5 minutes')),
              5 * 60 * 1000
            )
          );

          const audioFile = (await Promise.race([
            audioExtractionPromise,
            timeoutPromise,
          ])) as File;
          console.log('Audio extraction completed, file size:', audioFile.size);
          setAudioExtractPercent(100);

          const audioUploader = new S3UploadService({
            apiBaseUrl: '/api/upload-audio',
          });
          const audioInit = await audioUploader.initiateMultipartUpload(
            audioFile,
            project._id,
            ''
          );

          await audioUploader.uploadChunks(
            audioFile,
            audioInit.uploadId,
            audioInit.presignedUrls,
            (p) => {
              setAudioUploadProgress(p);
            }
          );

          await fetch('/api/upload-audio/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              key: audioInit.s3Key,
              uploadId: audioInit.uploadId,
              parts: (
                audioUploader.getUploadSession(audioInit.uploadId)?.parts || []
              ).map((p: any) => ({
                partNumber: p.partNumber,
                etag: p.etag,
                size: p.size,
              })),
            }),
          });
        } catch (audioErr: any) {
          console.error('Audio extraction/upload failed:', audioErr);
          console.error('Audio extraction error details:', {
            message: audioErr.message,
            stack: audioErr.stack,
            name: audioErr.name,
          });
          // Non-fatal; continue
        }
      } else {
        // For audio files: skip regular complete and only send audio complete request
        try {
          await fetch('/api/upload-audio/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              key: init.s3Key,
              uploadId: init.uploadId,
              parts: (
                uploader.getUploadSession(init.uploadId)?.parts || []
              ).map((p: any) => ({
                partNumber: p.partNumber,
                etag: p.etag,
                size: p.size,
              })),
            }),
          });
        } catch (audioErr) {
          console.error('Audio complete request failed:', audioErr);
          throw audioErr; // For audio files, this is critical
        }
      }

      toast({
        title: 'Project Created Successfully!',
        description: 'Your file was uploaded. Generating subtitles...',
      });

      router.push('/projects');
    } catch (error) {
      console.error('Error creating project (no-workers):', error);
      toast({
        title: 'Upload Failed',
        description:
          error instanceof Error
            ? error.message
            : 'There was an error uploading your file. Please try again.',
        variant: 'destructive',
      });
      setIsCreating(false);
      setProgress(null);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Create New Project (No Workers)</h1>
        <p className="text-muted-foreground mt-2">
          Upload a file and generate subtitles without using workers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="w-5 h-5" />
            {isUploading ? 'Uploading Media' : 'Project Details'}
          </CardTitle>
          <CardDescription>
            {isUploading
              ? 'Please wait while we upload your file'
              : 'Fill in the project information and select your video or audio file'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isUploading && progress ? (
            <div className="space-y-4">
              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-between">
                  <div className="flex items-center gap-2">
                    {selectedFile.type.startsWith('audio/') ? (
                      <FileAudio className="w-4 h-4" />
                    ) : (
                      <FileVideo className="w-4 h-4" />
                    )}
                    <span className="truncate max-w-[16rem]">
                      {selectedFile.name}
                    </span>
                  </div>
                  <span>
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
              <div className="space-y-2 p-4 rounded-lg bg-accent/30 border border-border">
                <div className="flex items-center justify-between text-sm">
                  <span>Uploading...</span>
                  <span>{progress.progress}%</span>
                </div>
                <Progress value={progress.progress} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBytes(progress.uploadedBytes)} /{' '}
                    {formatBytes(progress.totalBytes)}
                  </span>
                  <span>ETA {formatTime(progress.estimatedTimeRemaining)}</span>
                </div>
              </div>

              {selectedFile?.type.startsWith('video/') && (
                <>
                  {typeof audioExtractPercent === 'number' && (
                    <div className="space-y-2 p-4 rounded-lg bg-accent/30 border border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span>Extracting audio...</span>
                        <span>{audioExtractPercent}%</span>
                      </div>
                      <Progress value={audioExtractPercent} />
                    </div>
                  )}

                  {audioUploadProgress && (
                    <div className="space-y-2 p-4 rounded-lg bg-accent/30 border border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span>Uploading audio...</span>
                        <span>{audioUploadProgress.progress}%</span>
                      </div>
                      <Progress value={audioUploadProgress.progress} />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {formatBytes(audioUploadProgress.uploadedBytes)} /{' '}
                          {formatBytes(audioUploadProgress.totalBytes)}
                        </span>
                        <span>
                          ETA{' '}
                          {formatTime(
                            audioUploadProgress.estimatedTimeRemaining
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="video-file">Media File</Label>

                {selectedFile && (videoUrl || audioUrl) ? (
                  <div className="w-full relative">
                    {videoUrl ? (
                      <VideoPlayer
                        src={videoUrl}
                        currentTime={0}
                        onTimeUpdate={() => {}}
                        className="w-full"
                      />
                    ) : (
                      <AudioPlayer src={audioUrl} className="w-full" />
                    )}
                    <div className="mt-3 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedFile(null);
                          setVideoUrl('');
                          setAudioUrl('');
                          form.setValue('title', '');
                          setProgress(null);
                          setAudioExtractPercent(null);
                          setAudioUploadProgress(null);
                        }}
                        className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/50 hover:bg-destructive/50 hover:text-destructive z-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="w-full">
                    <FileUpload onFileSelect={handleFileSelect} />
                  </div>
                )}

                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                    {selectedFile.type.startsWith('audio/') ? (
                      <FileAudio className="w-4 h-4" />
                    ) : (
                      <FileVideo className="w-4 h-4" />
                    )}
                    <span>{selectedFile.name}</span>
                    <span>
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder="Enter project title"
                  {...form.register('title')}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe your project..."
                  rows={3}
                  {...form.register('description')}
                />
              </div>

              <div className="space-y-3">
                <Label>Audio Language</Label>
                <button
                  type="button"
                  onClick={() => setOpenModal(true)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                    'bg-accent/50 border-border hover:bg-accent hover:border-primary/50',
                    'text-left'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {selectedLanguage?.image ? (
                      <Image
                        src={`/assets/flags/${selectedLanguage.image}`}
                        alt={`${selectedLanguage.name} flag`}
                        width={16}
                        height={16}
                        className="w-4 h-4 object-cover rounded-sm mr-1"
                      />
                    ) : null}
                    {selectedLanguage?.flag && (
                      <span
                        className="text-lg"
                        style={{
                          display: selectedLanguage?.image ? 'none' : 'inline',
                        }}
                      >
                        {selectedLanguage.flag}
                      </span>
                    )}
                    <div>
                      <div className="font-medium text-foreground">
                        {selectedLanguage?.name || 'Select Language'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedLanguage?.code}
                      </div>
                    </div>
                  </div>
                  <Languages className="h-4 w-4 text-muted-foreground" />
                </button>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Quick select:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((lang) => (
                      <Button
                        key={lang.code}
                        type="button"
                        variant={
                          form.watch('language') === lang.code
                            ? 'default'
                            : 'outline'
                        }
                        size="sm"
                        onClick={() => handleLanguageSelect(lang)}
                        className="h-8 text-xs"
                      >
                        {lang.image ? (
                          <Image
                            src={`/assets/flags/${lang.image}`}
                            alt={`${lang.name} flag`}
                            width={16}
                            height={16}
                            className="w-4 h-4 object-cover rounded-sm mr-1"
                          />
                        ) : null}
                        {lang.flag && (
                          <span
                            className="mr-1"
                            style={{ display: lang.image ? 'none' : 'inline' }}
                          >
                            {lang.flag}
                          </span>
                        )}
                        {lang.name}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setOpenModal(true)}
                      className="h-8 text-xs"
                    >
                      <Languages className="h-3 w-3 mr-1" />
                      More
                    </Button>
                  </div>
                </div>

                {form.formState.errors.language && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.language.message}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between p-4 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="font-medium text-foreground">
                    Translate to English
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Generate English subtitles alongside original language
                  </p>
                </div>
                <Switch
                  checked={form.watch('translateToEnglish')}
                  onCheckedChange={(checked) =>
                    form.setValue('translateToEnglish', checked)
                  }
                />
              </div>

              <Button
                type="submit"
                disabled={!selectedFile || isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                    Generating Subtitles...
                  </>
                ) : (
                  'Generate Subtitles'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <ModalLanguagePicker
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSelect={handleLanguageSelect}
        purpose="transcription"
      />
    </div>
  );
}
