'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  currentTime?: number;
  onTimeUpdate?: (time: number) => void;
  className?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  currentTime = 0,
  onTimeUpdate,
  className,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSeekingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsBuffering(false);
    };

    const handleTimeUpdate = () => {
      if (!isSeekingRef.current) {
        setInternalCurrentTime(audio.currentTime);
        onTimeUpdate?.(audio.currentTime);
      }
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    const handleError = () => {
      setHasError(true);
      setErrorMessage('Failed to load audio file');
      setIsBuffering(false);
    };

    const handleLoadStart = () => setIsBuffering(true);
    const handleCanPlay = () => setIsBuffering(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTimeUpdate]);

  // Sync external currentTime with internal state
  useEffect(() => {
    if (Math.abs(currentTime - internalCurrentTime) > 0.5) {
      setInternalCurrentTime(currentTime);
      if (audioRef.current) {
        audioRef.current.currentTime = currentTime;
      }
    }
  }, [currentTime, internalCurrentTime]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((error) => {
        console.error('Error playing audio:', error);
        setHasError(true);
        setErrorMessage('Failed to play audio');
      });
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    isSeekingRef.current = true;
    const newTime = value[0];
    audio.currentTime = newTime;
    setInternalCurrentTime(newTime);
    onTimeUpdate?.(newTime);

    // Reset seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newTime = Math.max(
      0,
      Math.min(duration, audio.currentTime + seconds)
    );
    audio.currentTime = newTime;
    setInternalCurrentTime(newTime);
    onTimeUpdate?.(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;

    const newVolume = value[0];
    setVolume(newVolume);
    audio.volume = newVolume;
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number): string => {
    if (!Number.isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center p-8 rounded-lg border bg-destructive/10 border-destructive/20',
          className
        )}
      >
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
          <p className="text-destructive font-medium">Audio Error</p>
          <p className="text-sm text-destructive/80 mt-1">
            {errorMessage || 'Failed to load audio file'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative bg-card rounded-lg border shadow-sm overflow-hidden',
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

      {/* Audio Waveform Placeholder */}
      <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 flex items-center justify-center">
        <div className="flex items-center gap-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-primary/60 rounded-full animate-pulse"
              style={{
                height: `${Math.random() * 40 + 20}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1.5s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="p-4 bg-card border-t">
        {/* Progress Bar */}
        <div className="mb-4">
          <Slider
            value={[internalCurrentTime]}
            max={duration}
            step={0.1}
            onValueChange={handleSeek}
            className="w-full"
          />
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => skip(-10)}
              className="h-8 w-8"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={togglePlay}
              className="h-8 w-8"
              disabled={isBuffering}
            >
              {isBuffering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => skip(10)}
              className="h-8 w-8"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{formatTime(internalCurrentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={toggleMute}
              className="h-8 w-8"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>

            <div className="w-20">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
