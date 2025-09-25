'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText,
  Languages,
  X,
  ChevronDown,
  WandSparkles,
} from 'lucide-react';
import {
  ALL_LANGUAGES,
  DEFAULT_SUGGESTIONS,
  findLanguage,
  getLastUsedLanguage,
  setLastUsedLanguage,
  Language,
} from '@/lib/languages';
import ModalLanguagePicker from './modal-language-picker';
import VideoPlayer from './video-player';
import { cn } from '@/lib/utils';

interface LanguagePreSubmitProps {
  file: File;
  onCancel: () => void;
  onGenerate: (opts: {
    file: File;
    language: string;
    translateToEnglish: boolean;
  }) => void;
}

const LanguagePreSubmit: React.FC<LanguagePreSubmitProps> = ({
  file,
  onCancel,
  onGenerate,
}) => {
  const [language, setLanguage] = useState<string>(() => getLastUsedLanguage());
  const [translateToEnglish, setTranslateToEnglish] = useState<boolean>(true);
  const [openModal, setOpenModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string>('');

  const selectedLanguage = findLanguage(language);
  const lastUsedLanguage = getLastUsedLanguage();

  // Check if the file is a video
  const isVideoFile = file?.type.startsWith('video/');

  // Create video URL for preview
  useEffect(() => {
    if (isVideoFile) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);

      // Cleanup URL when component unmounts
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file, isVideoFile]);

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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleLanguageSelect = (selectedLang: Language) => {
    setLanguage(selectedLang.code!);
  };

  const handleGenerate = () => {
    setLastUsedLanguage(language);
    onGenerate({ file, language, translateToEnglish });
  };

  return (
    <>
      <Card className="w-full max-w-4xl mx-auto bg-card border-border">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/20">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">
                  {file.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Video Preview */}
          {isVideoFile && videoUrl && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Video Preview
              </label>
              <div className="w-full h-90 rounded-lg overflow-hidden">
                <VideoPlayer
                  src={videoUrl}
                  currentTime={0}
                  onTimeUpdate={() => {}}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}

          {/* Audio Language Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-3 block">
              Audio Language
            </label>

            {/* Current Selection */}
            <button
              onClick={() => setOpenModal(true)}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors',
                'bg-accent/50 border-border hover:bg-accent hover:border-primary/50',
                'text-left'
              )}
            >
              <div className="flex items-center gap-3">
                {selectedLanguage?.flag && (
                  <span className="text-lg">{selectedLanguage.flag}</span>
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
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Quick select:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((lang) => (
                  <Button
                    key={lang.code}
                    variant={language === lang.code ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLanguage(lang.code!)}
                    className="h-8 text-xs"
                  >
                    {lang.flag} {lang.name}
                  </Button>
                ))}
                <Button
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
              checked={translateToEnglish}
              onCheckedChange={setTranslateToEnglish}
            />
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            size="lg"
          >
            <WandSparkles className="h-4 w-4 mr-2" />
            Generate Subtitles
          </Button>
        </CardContent>
      </Card>

      {/* Language Picker Modal */}
      <ModalLanguagePicker
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSelect={handleLanguageSelect}
        purpose="transcription"
      />
    </>
  );
};

export default LanguagePreSubmit;
