'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  MoreHorizontal,
  Share,
  Settings,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import VideoPlayer from './video-player';
import SubtitleTrack from './subtitle-track';
import { useToast } from '@/hooks/use-toast';

interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface LanguageTrack {
  language: string;
  languageCode: string;
  flag: string;
  subtitles: Subtitle[];
  enabled: boolean;
}

interface ProjectInterfaceProps {
  projectId: string;
}

const ProjectInterface: React.FC<ProjectInterfaceProps> = ({ projectId }) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [languageTracks, setLanguageTracks] = useState<LanguageTrack[]>([]);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  // Load project data
  useEffect(() => {
    const loadProject = async () => {
      try {
        // Mock API call - replace with actual endpoint
        const response = await fetch(`/api/projects/${projectId}`);

        if (!response.ok) {
          throw new Error('Project not found');
        }

        const projectData = await response.json();

        setProjectName(projectData.name || 'Untitled Project');
        setVideoUrl(projectData.srcUrl || '/mock-video-url');

        // Use the language tracks from the API response
        const tracks: LanguageTrack[] =
          projectData.languageTracks?.map((track: any) => ({
            language: track.language,
            languageCode: track.languageCode,
            flag: track.flag,
            subtitles: track.subtitles,
            enabled: true,
          })) || [];

        console.log(projectData);
        setLanguageTracks(tracks);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading project:', error);
        toast({
          title: 'Error Loading Project',
          description: 'Failed to load project data. Please try again.',
          variant: 'destructive',
        });
        setIsLoading(false);
      }
    };

    loadProject();
  }, [projectId, toast]);

  const handleLanguageToggle = (languageCode: string, enabled: boolean) => {
    setLanguageTracks((prev) =>
      prev.map((track) =>
        track.languageCode === languageCode ? { ...track, enabled } : track
      )
    );
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
  };

  const handleExport = () => {
    // Mock export functionality
    toast({
      title: 'Export Started',
      description: 'Your subtitles are being prepared for download.',
    });
  };

  const handleProjectNameClick = () => {
    setIsEditingProjectName(true);
    setEditingProjectName(projectName);
  };

  const handleProjectNameSave = () => {
    if (editingProjectName.trim()) {
      setProjectName(editingProjectName.trim());
      setIsEditingProjectName(false);
      toast({
        title: 'Project Name Updated',
        description: 'Your project name has been saved.',
      });
    }
  };

  const handleProjectNameCancel = () => {
    setIsEditingProjectName(false);
    setEditingProjectName(projectName);
  };

  const handleProjectNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProjectNameSave();
    } else if (e.key === 'Escape') {
      handleProjectNameCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingProjectName && projectNameInputRef.current) {
      projectNameInputRef.current.focus();
      projectNameInputRef.current.select();
    }
  }, [isEditingProjectName]);

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-65px)] bg-background items-center">
        <div className="flex-1 max-w-2xl mx-auto px-4 py-8 items-center">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold mb-4">Loading Project</h2>
            <p className="text-muted-foreground">
              Please wait while we load your project...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => router.push('/projects')}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            {isEditingProjectName ? (
              <div className="flex items-center gap-2">
                <input
                  ref={projectNameInputRef}
                  type="text"
                  value={editingProjectName}
                  onChange={(e) => setEditingProjectName(e.target.value)}
                  onKeyDown={handleProjectNameKeyDown}
                  className="font-semibold bg-transparent border-b border-primary focus:outline-none focus:border-primary-foreground px-1 py-0.5 min-w-[200px]"
                  placeholder="Enter project name"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleProjectNameSave}
                  className="h-6 w-6 text-green-600 hover:text-green-700"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleProjectNameCancel}
                  className="h-6 w-6 text-red-600 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h1
                  className="font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={handleProjectNameClick}
                >
                  {projectName}
                </h1>
                <Edit2
                  className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-primary"
                  onClick={handleProjectNameClick}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Star className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            className="bg-primary text-primary-foreground"
          >
            <Share className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Video Player */}
        <div className="bg-card rounded-xl p-4">
          <VideoPlayer
            src={videoUrl}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            className="aspect-video max-w-2xl mx-auto"
          />
        </div>

        {/* Language Selection */}
        {languageTracks.length > 0 && (
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <h2 className="text-lg font-semibold">Languages</h2>
              </div>
              <Button variant="outline" size="sm">
                + Translate
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {languageTracks.map((track) => (
                <SubtitleTrack
                  key={track.languageCode}
                  language={track.language}
                  languageCode={track.languageCode}
                  flag={track.flag}
                  subtitles={track.subtitles}
                  currentTime={currentTime}
                  enabled={track.enabled}
                  onToggle={handleLanguageToggle}
                  onSeek={handleSeek}
                />
              ))}
            </div>
          </div>
        )}

        {/* Subtitles Customization */}
        {languageTracks.length > 0 && (
          <div className="bg-card rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Button variant="outline" size="sm">
                  Subtitles
                </Button>
                <Button variant="ghost" size="sm">
                  Customize
                </Button>
              </div>
              <Button variant="outline" size="sm">
                + Add Subtitle
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectInterface;
