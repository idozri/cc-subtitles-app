'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Subtitle {
  id: string;
  start: number;
  end: number;
  text: string;
}

interface SubtitleTrackProps {
  language: string;
  languageCode: string;
  flag: string;
  subtitles: Subtitle[];
  currentTime: number;
  enabled: boolean;
  onToggle: (languageCode: string, enabled: boolean) => void;
  onSeek: (time: number) => void;
  className?: string;
}

const SubtitleTrack: React.FC<SubtitleTrackProps> = ({
  language,
  languageCode,
  flag,
  subtitles,
  currentTime,
  enabled,
  onToggle,
  onSeek,
  className,
}) => {
  const getCurrentSubtitle = () => {
    return subtitles.find(
      (sub) => currentTime >= sub.start && currentTime <= sub.end
    );
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const currentSubtitle = getCurrentSubtitle();

  return (
    <div className={cn('subtitle-track p-4 space-y-3', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{flag}</span>
          <span className="font-medium">{language}</span>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => onToggle(languageCode, checked)}
        />
      </div>

      {/* Current Subtitle Display */}
      {enabled && (
        <div className="space-y-2">
          <div className="min-h-[50px] sm:min-h-[60px] flex items-center justify-center bg-muted/30 rounded-lg p-2 sm:p-3">
            {currentSubtitle ? (
              <p className="text-center text-sm sm:text-lg font-medium">
                {currentSubtitle.text}
              </p>
            ) : (
              <p className="text-center text-xs sm:text-sm text-muted-foreground">
                No subtitles at current time
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Timeline</span>
              <span>{formatTime(currentTime)}</span>
            </div>

            <div className="space-y-1 max-h-32 overflow-y-auto">
              {subtitles.slice(0, 5).map((subtitle) => {
                const isActive =
                  currentTime >= subtitle.start && currentTime <= subtitle.end;
                const isPast = currentTime > subtitle.end;

                return (
                  <div
                    key={subtitle.id}
                    className={cn(
                      'flex items-center justify-between p-2 sm:p-2 rounded text-xs sm:text-sm cursor-pointer transition-colors',
                      isActive && 'bg-primary/20 border-l-2 border-primary',
                      isPast && 'opacity-50',
                      !isActive && !isPast && 'hover:bg-muted/50'
                    )}
                    onClick={() => onSeek(subtitle.start)}
                  >
                    <div className="flex-1">
                      <p className="font-medium truncate text-xs sm:text-sm">
                        {subtitle.text}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(subtitle.start)} -{' '}
                        {formatTime(subtitle.end)}
                      </p>
                    </div>

                    {isActive && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-6 h-6 ml-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeek(subtitle.start);
                        }}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubtitleTrack;
