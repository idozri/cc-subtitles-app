'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Project, ProjectStatus } from '@/types/project';
import { useProjectStore } from '@/lib/store/project';
import { toast } from '@/hooks/use-toast';
import {
  Play,
  FileVideo,
  FileAudio,
  Languages,
  Calendar,
  AlertCircle,
  CheckCircle,
  Upload,
  Settings,
  X,
  HardDrive,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { getProjectsSocket } from '@/lib/socket';
import Link from 'next/link';

interface ProjectCardProps {
  project: Project;
  uploadStatus: string;
  uploadProgress: number;
  onCancelProject?: (projectId: string) => Promise<void>;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'uploading':
    case 'processing':
    case 'transcribing':
      return 'secondary';
    case 'ready':
      return 'default';
    case 'failed':
    case 'failed_transcription':
      return 'destructive';
    default:
      return 'secondary';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'uploading':
      return <Upload className="w-4 h-4" />;
    case 'processing':
      return <Settings className="w-4 h-4" />;
    case 'transcribing':
      return <Languages className="w-4 h-4" />;
    case 'ready':
      return <CheckCircle className="w-4 h-4" />;
    case 'failed':
    case 'failed_transcription':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <FileVideo className="w-4 h-4" />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'uploading':
      return 'Uploading...';
    case 'processing':
      return 'Processing...';
    case 'transcribing':
      return 'Transcribing...';
    case 'ready':
      return 'Ready';
    case 'failed':
      return 'Failed';
    case 'failed_transcription':
      return 'Transcription Failed';
    default:
      return 'Unknown';
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export function ProjectCard({
  project,
  uploadStatus,
  uploadProgress,
  onCancelProject,
}: ProjectCardProps) {
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>('transcribing');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Worker functionality removed - resume uploads not supported
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  useEffect(() => {
    // 1) If already ready, update local status and do not open socket
    if (project.status === ProjectStatus.READY) {
      setLiveStatus('ready');
      // Ensure local store reflects ready
      updateProject(project._id, { status: ProjectStatus.READY });
      return;
    }

    // 2) Ensure monitoring is running if not ready
    (async () => {
      try {
        await fetch(`/api/transcription/ensure-monitoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ projectId: project._id }),
        });
      } catch (err) {
        // non-fatal; socket updates may still arrive if already monitoring
        console.warn('ensure-monitoring failed', err);
      }
    })();

    const socket = getProjectsSocket();
    socket.emit('project:subscribe', project._id);

    const onUpdate = (payload: any) => {
      debugger;
      if (payload?.projectId !== project._id) return;
      if (payload?.status) setLiveStatus(payload.status);
    };

    socket.on('project:update', onUpdate);
    return () => {
      socket.emit('project:unsubscribe', project._id);
      socket.off('project:update', onUpdate);
    };
  }, [project._id, project.status, updateProject]);

  const effectiveStatus = liveStatus || uploadStatus || project.status;

  const handleCancelProject = async () => {
    if (!onCancelProject) return;

    setIsCancelling(true);
    try {
      await onCancelProject(project._id);
    } catch (error) {
      console.error('Failed to cancel project:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryTranscription = async () => {
    setIsRetrying(true);
    try {
      const resp = await fetch(`/api/transcription/retry-transcription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId: project._id }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({} as any));
        throw new Error(data.error || 'Retry failed');
      }
      toast({
        title: 'Retry started',
        description: 'Transcription retry initiated.',
      });
    } catch (err) {
      toast({
        title: 'Retry failed',
        description:
          err instanceof Error ? err.message : 'Could not retry transcription.',
        variant: 'destructive',
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDeleteProject = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/projects/${project._id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete project');
      }

      // Remove project from local store
      deleteProject(project._id);

      toast({
        title: 'Project Deleted',
        description: 'The project has been deleted successfully.',
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete the project. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenFilePicker = () => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = '';
    fileInputRef.current.click();
  };

  const handleFileSelected: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    // Resume functionality removed with workers
    toast({
      title: 'Resume Not Available',
      description:
        'Upload resumption is not supported. Please restart the upload.',
      variant: 'destructive',
    });
  };

  const isFailed =
    effectiveStatus === 'failed' || effectiveStatus === 'failed_transcription';
  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {project.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {getStatusIcon(effectiveStatus)}
            <Badge
              variant={getStatusVariant(effectiveStatus)}
              className={
                !isFailed && effectiveStatus !== 'ready' ? 'text-primary' : ''
              }
            >
              {getStatusText(effectiveStatus)}
              {(effectiveStatus === 'processing' ||
                effectiveStatus === 'transcribing' ||
                effectiveStatus === 'uploading') && (
                <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full ml-2 text-primary" />
              )}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Thumbnail / Icon */}
        <div className="w-full aspect-video bg-accent/30 rounded-md overflow-hidden relative flex items-center justify-center">
          {project.thumbnailUrl ? (
            <Image
              src={project.thumbnailUrl}
              alt={project.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority={false}
              className="object-contain"
            />
          ) : project.mimeType?.startsWith('audio/') ? (
            <div className="flex items-center justify-center text-muted-foreground">
              <FileAudio className="w-12 h-12" />
            </div>
          ) : (
            <div className="flex items-center justify-center text-muted-foreground">
              <FileVideo className="w-12 h-12" />
            </div>
          )}
        </div>
        {/* Hidden file input for resume */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelected}
          accept="video/*,audio/*"
        />
        {/* Upload Progress */}
        {effectiveStatus === 'uploading' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Upload Progress</span>
              <span className="font-medium">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Project Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileVideo className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">File:</span>
            <span className="font-medium truncate">{project.fileName}</span>
          </div>

          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Size:</span>
            <span className="font-medium">
              {formatFileSize(project.fileSize)}
            </span>
          </div>

          {project.duration && (
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{project.duration}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Language:</span>
            <span className="font-medium">{project.originalLanguage}</span>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Created:</span>
            <span className="font-medium">{formatDate(project.createdAt)}</span>
          </div>

          {project.subtitleCount > 0 && (
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Subtitles:</span>
              <span className="font-medium">{project.subtitleCount}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {effectiveStatus === 'ready' && (
            <>
              <Button className="flex-1" asChild>
                <Link href={`/projects/${project._id}`}>View Project</Link>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isDeleting}>
                    {isDeleting ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Project</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will permanently delete this project and all
                      its files. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteProject}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Yes, Delete Project
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {effectiveStatus === 'uploading' && (
            <Button variant="outline" disabled className="flex-1">
              Uploading...
            </Button>
          )}

          {effectiveStatus === 'processing' && (
            <Button variant="outline" disabled className="flex-1">
              Processing...
            </Button>
          )}

          {effectiveStatus === 'transcribing' && (
            <Button variant="outline" disabled className="flex-1">
              Transcribing...
            </Button>
          )}

          {effectiveStatus === 'failed' &&
            project.uploadId &&
            project.s3Key && (
              <Button
                onClick={handleOpenFilePicker}
                variant="outline"
                className="flex-1"
                disabled={isResuming}
              >
                {isResuming ? 'Resuming…' : 'Resume Upload'}
              </Button>
            )}
          {effectiveStatus === 'failed_transcription' && (
            <Button
              onClick={handleRetryTranscription}
              className="flex-1"
              disabled={isRetrying}
            >
              {isRetrying ? 'Retrying…' : 'Retry Transcription'}
            </Button>
          )}

          {/* Cancel Button for non-ready projects */}
          {effectiveStatus !== 'ready' && onCancelProject && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="ml-auto"
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Cancel
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will cancel the current upload/processing and
                    permanently delete this project. All uploaded files and
                    progress will be lost. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Project</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelProject}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Cancel & Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
