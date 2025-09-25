'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import FileUpload from './file-upload';
import LanguagePreSubmit from './language-pre-submit';
import { useToast } from '@/hooks/use-toast';
import { useProjectStore } from '@/lib/store/project';
// Worker functionality removed
import { CreateProjectData } from '@/types/project';
import { cn } from '@/lib/utils';

const SCREEN_HEIGHT = 'min-h-[calc(100vh-65px)]';

const FileUploadInterface: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPreSubmit, setShowPreSubmit] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { addProject } = useProjectStore();
  // Worker functionality removed - direct upload not supported in this component

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setShowPreSubmit(true);
  };

  const handlePreSubmitCancel = () => {
    setSelectedFile(null);
    setShowPreSubmit(false);
  };

  const handleGenerate = async (opts: {
    file: File;
    language: string;
    translateToEnglish: boolean;
  }) => {
    setShowPreSubmit(false);
    setIsProcessing(true);

    try {
      // Create project data
      const projectData: CreateProjectData = {
        title: opts.file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        description: `Video uploaded on ${new Date().toLocaleDateString()}`,
        fileName: opts.file.name,
        fileSize: opts.file.size,
        mimeType: opts.file.type,
        language: opts.language,
        translateToEnglish: opts.translateToEnglish,
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

      const { project, upload } = result.data;

      // Add the new project to the store
      addProject(project);

      // Worker functionality removed - redirect to no-workers page
      toast({
        title: 'Project Created Successfully!',
        description: 'Redirecting to upload page...',
      });

      // Redirect to the no-workers upload page
      router.push(`/projects/new?projectId=${project._id}&s3Key=${upload.key}`);
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: 'Upload Failed',
        description:
          'There was an error uploading your file. Please try again.',
        variant: 'destructive',
      });
      setIsProcessing(false);
      setShowPreSubmit(true);
    }
  };

  if (!selectedFile) {
    return (
      <div className={cn(SCREEN_HEIGHT, 'flex items-center bg-background')}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Video to Subtitles</h1>
            <p className="text-muted-foreground">
              Upload a video or audio file to automatically generate subtitles
              with timestamps
            </p>
          </div>

          <FileUpload onFileSelect={handleFileSelect} />
        </div>
      </div>
    );
  }

  // Show pre-submit panel after file selection
  if (showPreSubmit && selectedFile) {
    return (
      <div className={cn(SCREEN_HEIGHT, 'flex items-center bg-background')}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">
              Configure Subtitle Generation
            </h1>
            <p className="text-muted-foreground">
              Choose your audio language and translation preferences
            </p>
          </div>

          <LanguagePreSubmit
            file={selectedFile}
            onCancel={handlePreSubmitCancel}
            onGenerate={handleGenerate}
          />
        </div>
      </div>
    );
  }

  // Show processing state
  if (isProcessing) {
    return (
      <div className={cn(SCREEN_HEIGHT, 'flex items-center bg-background')}>
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-4">Creating Your Project</h2>
            <p className="text-muted-foreground mb-4">
              Please wait while we set up your project and prepare the upload...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full animate-pulse"
                style={{ width: '60%' }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default FileUploadInterface;
