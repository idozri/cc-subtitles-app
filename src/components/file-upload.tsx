'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, Video, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, className }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileSelect(acceptedFiles[0]);
      }
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
      'audio/*': ['.mp3', '.wav', '.aac', '.ogg', '.m4a'],
    },
    multiple: false,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
  });

  const getFileIcon = (fileName: string) => {
    if (fileName.match(/\.(mp4|avi|mov|mkv|webm)$/i)) {
      return <Video className="w-8 h-8 text-primary" />;
    }
    if (fileName.match(/\.(mp3|wav|aac|ogg|m4a)$/i)) {
      return <Music className="w-8 h-8 text-primary" />;
    }
    return <File className="w-8 h-8 text-primary" />;
  };

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200 bg-card/50 backdrop-blur-sm',
        isDragActive && !isDragReject && 'border-primary bg-primary/10',
        isDragReject && 'border-destructive bg-destructive/10',
        !isDragActive &&
          'border-border hover:border-primary/50 hover:bg-card/70',
        className
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-primary/10">
          <Upload className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold">
            {isDragActive
              ? isDragReject
                ? 'Invalid file type'
                : 'Drop your file here'
              : 'Upload Video or Audio File'}
          </h3>

          <p className="text-sm text-muted-foreground">
            Supports MP4, AVI, MOV, MKV, WebM, MP3, WAV, AAC, OGG, M4A
          </p>
        </div>

        <Button variant="secondary" className="mt-2" type="button">
          Choose File
        </Button>
      </div>
    </div>
  );
};

export default FileUpload;
