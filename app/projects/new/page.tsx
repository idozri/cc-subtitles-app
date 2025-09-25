'use client';

import React, { useState, useEffect } from 'react';
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
  Upload,
  FileVideo,
  Languages,
  ChevronDown,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useProjectStore } from '@/lib/store/project';
import { useUploadWorker } from '@/hooks/use-upload-worker';
import { CreateProjectData } from '@/types/project';
import ModalLanguagePicker from '@/components/modal-language-picker';
import VideoPlayer from '@/components/video-player';
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

const createProjectSchema = z.object({
  title: z.string().min(1, 'Project title is required'),
  description: z.string().optional(),
  language: z.string().min(1, 'Language is required'),
  translateToEnglish: z.boolean(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

export default function NewProjectPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const router = useRouter();
  const { toast } = useToast();
  const { addProject } = useProjectStore();
  const { startUpload } = useUploadWorker();

  const form = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      title: '',
      description: '',
      language: getLastUsedLanguage(),
      translateToEnglish: true,
    },
  });

  const selectedLanguage = findLanguage(form.watch('language'));
  const lastUsedLanguage = getLastUsedLanguage();

  // Create suggestions list with last used language + defaults (deduped)
  const suggestions = React.useMemo(() => {
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

  // Create video URL for preview
  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      const url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);

      // Cleanup URL when component unmounts or file changes
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [selectedFile]);

  const handleFileSelect = (file: File) => {
    if (file) {
      if (!file.type.startsWith('video/')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please select a video file.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedFile(file);

      // Auto-fill title if empty
      if (!form.getValues('title')) {
        form.setValue('title', file.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleLanguageSelect = (selectedLang: Language) => {
    form.setValue('language', selectedLang.code!);
    setLastUsedLanguage(selectedLang.code!);
  };

  const handleSubmit = async (data: CreateProjectFormData) => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please select a video file to upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);

    try {
      // Import device ID utility
      const { getDeviceId } = await import('@/lib/device-id');
      const deviceId = getDeviceId();

      // Create project data
      const projectData: CreateProjectData = {
        ...data,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        deviceId,
      };

      // Create project with upload data via backend API
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        throw new Error('Failed to create project');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Failed to create project');
      }

      const { project } = result.data;

      // Add the new project to the store
      addProject(project);

      // Initiate the upload separately
      const uploadResponse = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          projectId: project._id,
          mimeType: selectedFile.type,
        }),
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to initiate upload');
      }

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        throw new Error(uploadResult.message || 'Failed to initiate upload');
      }

      // Start the upload using the worker with the actual upload data
      const uploadId = await startUpload(
        selectedFile,
        project._id,
        uploadResult.data.key,
        uploadResult.data.uploadId,
        uploadResult.data.presignedUrls,
        uploadResult.data.chunkSize
      );

      if (uploadId) {
        toast({
          title: 'Project Created Successfully!',
          description:
            'Your video is now uploading. You can navigate away from this page.',
        });

        // Redirect to the projects dashboard
        router.push('/projects');
      } else {
        throw new Error('Failed to start upload');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Upload Failed',
        description:
          'There was an error uploading your file. Please try again.',
        variant: 'destructive',
      });
      setIsCreating(false);
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

        <h1 className="text-3xl font-bold">Create New Project</h1>
        <p className="text-muted-foreground mt-2">
          Upload a video and configure subtitle generation settings
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="w-5 h-5" />
            Project Details
          </CardTitle>
          <CardDescription>
            Fill in the project information and select your video file
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="video-file">Video File</Label>

              {selectedFile && videoUrl ? (
                // Video Preview with 9:16 aspect ratio
                <div className="w-full relative">
                  <VideoPlayer
                    src={videoUrl}
                    currentTime={0}
                    onTimeUpdate={() => {}}
                    className="w-full"
                  />
                  <div className="mt-3 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedFile(null);
                        setVideoUrl('');
                        form.setValue('title', '');
                      }}
                      className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/50 hover:bg-destructive/50 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // File Upload Area with 9:16 aspect ratio
                <div className="w-full">
                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
              )}

              {selectedFile && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <FileVideo className="w-4 h-4" />
                  <span>{selectedFile.name}</span>
                  <span>
                    ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
              )}
            </div>

            {/* Project Title */}
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

            {/* Project Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe your project..."
                rows={3}
                {...form.register('description')}
              />
            </div>

            {/* Audio Language Selection */}
            <div className="space-y-3">
              <Label>Audio Language</Label>

              {/* Current Selection */}
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
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Suggestions */}
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

            {/* Translate to English Switch */}
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

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!selectedFile || isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Creating Project...
                </>
              ) : (
                'Create Project & Start Upload'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Language Picker Modal */}
      <ModalLanguagePicker
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSelect={handleLanguageSelect}
        purpose="transcription"
      />
    </div>
  );
}
