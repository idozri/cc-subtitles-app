'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import FileUpload from './file-upload';
import VideoPlayer from './video-player';
import SubtitleTrack from './subtitle-track';
import LanguagePreSubmit from './language-pre-submit';
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

const SubtitleExtractionInterface: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [currentTime, setCurrentTime] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreSubmit, setShowPreSubmit] = useState(false);
  const [languageTracks, setLanguageTracks] = useState<LanguageTrack[]>([]);
  const [projectName, setProjectName] = useState('Untitled Project');
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState('');
  const projectNameInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Mock subtitle data
  const mockSubtitles = {
    pt: [
      { id: '1', start: 0, end: 2, text: 'Fica aqui!' },
      { id: '2', start: 2, end: 4, text: 'Puxa, puxa!' },
      { id: '3', start: 4, end: 6, text: 'Vamos continuar!' },
      { id: '4', start: 6, end: 8, text: 'Muito bem!' },
      { id: '5', start: 8, end: 10, text: 'Perfeito!' },
    ],
    en: [
      { id: '1', start: 0, end: 2, text: 'Stay here!' },
      { id: '2', start: 2, end: 4, text: 'Pull, pull!' },
      { id: '3', start: 4, end: 6, text: "Let's continue!" },
      { id: '4', start: 6, end: 8, text: 'Very good!' },
      { id: '5', start: 8, end: 10, text: 'Perfect!' },
    ],
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setShowPreSubmit(true);
  };

  const handlePreSubmitCancel = () => {
    setSelectedFile(null);
    setShowPreSubmit(false);
    setVideoUrl('');
  };

  const handleGenerate = async (opts: {
    file: File;
    language: string;
    translateToEnglish: boolean;
  }) => {
    setShowPreSubmit(false);
    setIsProcessing(true);

    // Create a URL for the video preview
    const url = URL.createObjectURL(opts.file);
    setVideoUrl(url);

    // Mock API call to extract subtitles - in real implementation, pass opts.language and opts.translateToEnglish
    setTimeout(() => {
      const tracks: LanguageTrack[] = [
        {
          language: 'Portuguese',
          languageCode: 'pt',
          flag: '🇧🇷',
          subtitles: mockSubtitles.pt,
          enabled: true,
        },
      ];

      // Add English track if translation is enabled
      if (opts.translateToEnglish) {
        tracks.push({
          language: 'English',
          languageCode: 'en',
          flag: '🇺🇸',
          subtitles: mockSubtitles.en,
          enabled: true,
        });
      }

      setLanguageTracks(tracks);
      setIsProcessing(false);

      toast({
        title: 'Subtitles Extracted',
        description: `Audio processed in ${opts.language} ${
          opts.translateToEnglish ? 'with English translation' : ''
        }`,
      });
    }, 3000);
  };

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

  if (!selectedFile) {
    return (
      <div className="min-h-screen bg-background">
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
      <div className="min-h-screen bg-background">
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full">
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
                  {projectName} asdfasd
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

        {/* Processing State */}
        {isProcessing && (
          <div className="bg-card rounded-xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Processing Audio</h3>
            <p className="text-muted-foreground">
              Extracting audio and generating subtitles...
            </p>
          </div>
        )}

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

export default SubtitleExtractionInterface;
