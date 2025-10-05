'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseVideoPlayerProps {
  src: string;
  onTimeUpdate?: (time: number) => void;
}

interface UseVideoPlayerReturn {
  // Video state
  currentTime: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  duration: number;
  volume: number;
  isBuffering: boolean;
  hasError: boolean;
  errorMessage: string | null;

  // Video controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  skipBackward: () => void;
  skipForward: () => void;

  // Video ref for direct access
  videoRef: React.RefObject<HTMLVideoElement | null>;

  // User interaction tracking
  hasUserInteracted: boolean;
  setHasUserInteracted: (interacted: boolean) => void;
}

export const useVideoPlayer = ({
  src,
  onTimeUpdate,
}: UseVideoPlayerProps): UseVideoPlayerReturn => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Play function
  const play = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  // Pause function
  const pause = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        play();
      } else {
        pause();
      }
    }
  }, [play, pause]);

  // Seek to specific time
  const seek = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      setHasUserInteracted(true);
    }
  }, []);

  // Set volume
  const handleSetVolume = useCallback((newVolume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  }, []);

  // Skip backward (10 seconds)
  const skipBackward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.max(0, videoRef.current.currentTime - 10);
      seek(newTime);
    }
  }, [seek]);

  // Skip forward (10 seconds)
  const skipForward = useCallback(() => {
    if (videoRef.current) {
      const newTime = Math.min(duration, videoRef.current.currentTime + 10);
      seek(newTime);
    }
  }, [seek, duration]);

  // Handle time updates
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      onTimeUpdate?.(time);
    }
  }, [onTimeUpdate]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsBuffering(false);
      setHasError(false);
      setErrorMessage(null);
    };

    const handleLoadStart = () => {
      setIsBuffering(true);
      setHasError(false);
      setErrorMessage(null);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    const handleError = () => {
      setHasError(true);
      setIsBuffering(false);
      setErrorMessage('Failed to load video');
    };

    const handleTimeUpdateEvent = () => {
      handleTimeUpdate();
    };

    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('error', handleError);
    video.addEventListener('timeupdate', handleTimeUpdateEvent);

    // Set initial volume
    video.volume = volume;

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('error', handleError);
      video.removeEventListener('timeupdate', handleTimeUpdateEvent);
    };
  }, [handleTimeUpdate, volume]);

  // Sync external currentTime changes
  useEffect(() => {
    if (
      videoRef.current &&
      Math.abs(videoRef.current.currentTime - currentTime) > 0.1
    ) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  return {
    currentTime,
    setCurrentTime,
    isPlaying,
    duration,
    volume,
    isBuffering,
    hasError,
    errorMessage,
    play,
    pause,
    togglePlay,
    seek,
    setVolume: handleSetVolume,
    skipBackward,
    skipForward,
    videoRef,
    hasUserInteracted,
    setHasUserInteracted,
  };
};
