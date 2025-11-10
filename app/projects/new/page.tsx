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
import {
  ArrowLeft,
  Bot,
  FileAudio,
  FileVideo,
  Languages,
  X,
} from 'lucide-react';
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
import { S3UploadService } from '@/lib/s3-upload';
import type { UploadProgress } from '@/types/upload';
import { extractAudioFromVideo } from '@/lib/ffmpeg-audio';
import { generateVideoThumbnail } from '@/lib/video-thumbnail';
import { client } from '../../api/common/client';
import {
  saveFileWithFileSystemAccess,
  isFileSystemAccessSupported,
} from '@/lib/file-system-access';
import ProjectProcessingOverlay from '@/components/project-processing-overlay';
import { getVideoScaleFormat } from '@/lib/utils/video-utils';
import Image from 'next/image';

const createProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  language: z.string().min(1, 'Language is required'),
  translateToEnglish: z.boolean(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface ProcessingStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  progress?: number;
  uploadProgress?: UploadProgress;
}

export default function NewProjectV2Page() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [currentStepId, setCurrentStepId] = useState<string>('');
  const router = useRouter();
  const { toast } = useToast();
  const { addProject } = useProjectStore();

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      language: '',
      translateToEnglish: false,
    },
  });

  const selectedLanguage = findLanguage(form.watch('language'));

  const createUploader = () =>
    new S3UploadService({ apiBaseUrl: '/api/upload' });

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

  const processVideoFile = async (file: File, projectId: string) => {
    let progressInterval: NodeJS.Timeout | undefined;

    try {
      // Step 1: Extract audio from video
      console.log('Starting audio extraction from video...');
      setCurrentStepId('extract');
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'extract'
            ? { ...step, status: 'in-progress', progress: 0 }
            : step
        )
      );

      // Start a progress simulation in case FFmpeg doesn't report progress
      let simulatedProgress = 0;
      progressInterval = setInterval(() => {
        simulatedProgress = Math.min(95, simulatedProgress + 1);
        setProcessingSteps((prev) =>
          prev.map((step) =>
            step.id === 'extract'
              ? { ...step, progress: simulatedProgress }
              : step
          )
        );
      }, 200);

      const audioExtractionPromise = extractAudioFromVideo(
        file,
        ({ ratio }) => {
          console.log('Audio extraction progress:', ratio);
          if (ratio > 0 && ratio <= 1) {
            clearInterval(progressInterval);
            setProcessingSteps((prev) =>
              prev.map((step) =>
                step.id === 'extract'
                  ? { ...step, progress: Math.round(ratio * 100) }
                  : step
              )
            );
          }
        }
      );

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Audio extraction timeout after 5 minutes')),
          5 * 60 * 1000
        )
      );

      const audioFile = (await Promise.race([
        audioExtractionPromise,
        timeoutPromise,
      ])) as File;

      clearInterval(progressInterval);
      console.log('Audio extraction completed, file size:', audioFile.size);

      // Mark extraction as completed
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'extract'
            ? { ...step, status: 'completed', progress: 100 }
            : step
        )
      );

      // Step 2: Upload audio to S3
      setCurrentStepId('upload');
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'upload'
            ? {
                ...step,
                status: 'in-progress',
                progress: 0,
                uploadProgress: undefined,
              }
            : step
        )
      );

      const audioUploader = new S3UploadService({
        apiBaseUrl: '/api/upload-audio',
      });
      const audioInit = await audioUploader.initiateMultipartUpload(
        audioFile,
        projectId,
        ''
      );

      await audioUploader.uploadChunks(
        audioFile,
        audioInit.uploadId,
        audioInit.presignedUrls,
        (uploadProgress) => {
          console.log('Audio upload progress update:', uploadProgress);
          setProcessingSteps((prev) =>
            prev.map((step) =>
              step.id === 'upload'
                ? { ...step, uploadProgress, progress: uploadProgress.progress }
                : step
            )
          );
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
          lengthSeconds: await getMediaDurationSeconds(audioFile),
        }),
      });

      // Mark upload as completed
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'upload'
            ? { ...step, status: 'completed', progress: 100 }
            : step
        )
      );

      // Step 3: Save video using File System Access API (if supported)
      setCurrentStepId('save');
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'save' ? { ...step, status: 'in-progress' } : step
        )
      );

      // Save video file to IndexedDB (works in all browsers)
      // The file is stored with projectId as the key, so it can be retrieved later
      // This function saves to IndexedDB first, then optionally uses File System Access API
      try {
        await saveFileWithFileSystemAccess(file, projectId, file.name);
        // Note: We don't need to update the project in the database with fileSystemHandleId
        // because the file is stored in IndexedDB with projectId as the key.
        // The project detail page will automatically check IndexedDB for the file.
      } catch (fsError: any) {
        // User cancellation is OK - file might still be in IndexedDB
        if (!fsError.message?.includes('cancelled')) {
          console.error('Failed to save file to IndexedDB:', fsError);
        }
      }

      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'save' ? { ...step, status: 'completed' } : step
        )
      );
    } catch (error: any) {
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      throw error;
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

  const formatTime = (seconds: number): string => {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getMediaDurationSeconds = async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          resolve(Math.round(video.duration));
        };
        video.onerror = () => {
          resolve(0);
        };
        video.src = URL.createObjectURL(file);
      } else if (file.type.startsWith('audio/')) {
        const audio = document.createElement('audio');
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(audio.src);
          resolve(Math.round(audio.duration));
        };
        audio.onerror = () => {
          resolve(0);
        };
        audio.src = URL.createObjectURL(file);
      } else {
        resolve(0);
      }
    });
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
    setIsProcessing(true);

    const isVideo = selectedFile.type.startsWith('video/');
    const isAudioFile = selectedFile.type.startsWith('audio/');

    // Initialize processing steps
    const steps: ProcessingStep[] = [
      {
        id: 'create',
        label: 'Creating project',
        status: 'in-progress',
      },
    ];

    if (isVideo) {
      steps.push(
        {
          id: 'extract',
          label: 'Extracting audio from video',
          status: 'pending',
          progress: 0,
        },
        {
          id: 'upload',
          label: 'Uploading audio',
          status: 'pending',
          progress: 0,
        },
        {
          id: 'save',
          label: 'Saving video locally',
          status: 'pending',
        }
      );
    } else if (isAudioFile) {
      steps.push({
        id: 'upload',
        label: 'Uploading audio',
        status: 'pending',
        progress: 0,
      });
    }

    setProcessingSteps(steps);
    setCurrentStepId('create');

    try {
      const { getDeviceId } = await import('@/lib/device-id');
      const deviceId = getDeviceId();

      // Only get scale format for video files
      const scaleFormat = isVideo
        ? await getVideoScaleFormat(selectedFile)
        : undefined;

      // Generate thumbnail for video files only
      let thumbnailDataUrl: string | undefined;
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
        // Don't send srcUrl - blob URLs are temporary and won't work after refresh
        // The video will be loaded from File System Access API handle instead
        durationSeconds: await getMediaDurationSeconds(selectedFile),
        isAudioFile,
        scaleFormat,
      };

      const response = await client.post('/projects', projectData);
      const result = response.data;
      if (!result.success) {
        throw new Error(result.message || 'Failed to create project');
      }

      const { project } = result.data;
      addProject(project);

      // Mark project creation as completed
      setProcessingSteps((prev) =>
        prev.map((step) =>
          step.id === 'create' ? { ...step, status: 'completed' } : step
        )
      );

      // Process video: extract audio, upload audio, save video locally
      if (isVideo) {
        await processVideoFile(selectedFile, project._id);
      }
      // Process audio: just upload to S3
      else if (isAudioFile) {
        setCurrentStepId('upload');
        setProcessingSteps((prev) =>
          prev.map((step) =>
            step.id === 'upload'
              ? {
                  ...step,
                  status: 'in-progress',
                  progress: 0,
                  uploadProgress: undefined,
                }
              : step
          )
        );

        const audioUploader = new S3UploadService({
          apiBaseUrl: '/api/upload-audio',
        });
        const init = await audioUploader.initiateMultipartUpload(
          selectedFile,
          project._id,
          ''
        );

        await audioUploader.uploadChunks(
          selectedFile,
          init.uploadId,
          init.presignedUrls,
          (uploadProgress) => {
            console.log('Audio upload progress:', uploadProgress);
            setProcessingSteps((prev) =>
              prev.map((step) =>
                step.id === 'upload'
                  ? {
                      ...step,
                      uploadProgress,
                      progress: uploadProgress.progress,
                    }
                  : step
              )
            );
          }
        );

        await fetch('/api/upload-audio/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            key: init.s3Key,
            uploadId: init.uploadId,
            parts: (
              audioUploader.getUploadSession(init.uploadId)?.parts || []
            ).map((p: any) => ({
              partNumber: p.partNumber,
              etag: p.etag,
              size: p.size,
            })),
            lengthSeconds: await getMediaDurationSeconds(selectedFile),
          }),
        });

        setProcessingSteps((prev) =>
          prev.map((step) =>
            step.id === 'upload'
              ? { ...step, status: 'completed', progress: 100 }
              : step
          )
        );
      }

      toast({
        title: 'Project Created Successfully!',
        description: 'Your project has been created. Generating subtitles...',
      });

      router.push('/projects');
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Project Creation Failed',
        description:
          error instanceof Error
            ? error.message
            : 'There was an error creating your project. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setIsCreating(false);
    }
  };

  return (
    <>
      {isProcessing && (
        <ProjectProcessingOverlay
          steps={processingSteps}
          currentStepId={currentStepId}
          projectTitle={form.getValues('title') || 'Untitled Project'}
        />
      )}

      <div className="container mx-auto p-6 max-w-2xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/projects')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileVideo className="w-5 h-5" />
              Project Details
            </CardTitle>
            <CardDescription>
              Fill in the project information and select your video or audio
              file
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="video-file">Media File</Label>
                {selectedFile && (videoUrl || audioUrl) ? (
                  <div className="w-full relative">
                    {videoUrl && (
                      <div className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-lg">
                        <VideoPlayer
                          src={videoUrl}
                          currentTime={0}
                          onTimeUpdate={() => {}}
                          className="w-full aspect-video"
                        />
                      </div>
                    )}
                    {audioUrl && (
                      <div className="w-full">
                        <AudioPlayer src={audioUrl} />
                      </div>
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
                  <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center mt-3">
                    {selectedFile.type.startsWith('video/') ? (
                      <FileVideo className="w-4 h-4" />
                    ) : (
                      <FileAudio className="w-4 h-4" />
                    )}
                    <span className="font-medium">{selectedFile.name}</span>
                    <span className="text-xs">
                      ({formatBytes(selectedFile.size)})
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
                  className={cn(
                    form.formState.errors.title && 'border-destructive'
                  )}
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add a description for your project"
                  className="min-h-[100px]"
                  {...form.register('description')}
                />
              </div>

              <div className="space-y-2">
                <Label>Audio Language</Label>
                <button
                  type="button"
                  onClick={() => setOpenModal(true)}
                  className={cn(
                    'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                    'bg-accent/50 border-border hover:bg-accent hover:border-primary/50',
                    'text-left',
                    form.formState.errors.language && 'border-destructive'
                  )}
                >
                  <div className="flex items-center gap-3">
                    {selectedLanguage?.image ? (
                      <Image
                        src={`/assets/flags/${selectedLanguage.image}`}
                        alt={`${selectedLanguage.name} flag`}
                        width={24}
                        height={24}
                        className="w-8 h-8 object-cover rounded-sm mr-1"
                      />
                    ) : selectedLanguage?.code == 'auto' ? (
                      <Bot className="w-5 h-5" />
                    ) : null}
                    <div>
                      <div className="font-medium text-foreground">
                        {selectedLanguage?.name || 'Select Language'}
                      </div>
                    </div>
                  </div>
                  <Languages className="h-4 w-4 text-muted-foreground" />
                </button>
                {form.formState.errors.language && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.language.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between space-x-2 p-4 border rounded-md">
                <Label
                  htmlFor="translate-to-english"
                  className="cursor-pointer"
                >
                  Translate to English
                </Label>
                <Switch
                  id="translate-to-english"
                  checked={form.watch('translateToEnglish')}
                  onCheckedChange={(checked) =>
                    form.setValue('translateToEnglish', checked)
                  }
                />
              </div>

              <Button
                type="submit"
                disabled={
                  !selectedFile || isCreating || !form.watch('language')
                }
                className="w-full"
              >
                Generate Subtitles
              </Button>
            </form>
          </CardContent>
        </Card>

        <ModalLanguagePicker
          open={openModal}
          onClose={() => setOpenModal(false)}
          onSelect={handleLanguageSelect}
          purpose="transcription"
        />
      </div>
    </>
  );
}
