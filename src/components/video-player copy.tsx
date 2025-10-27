'use client';

import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Maximize2,
  Minimize2,
  Loader2,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { getPreloadedFontClassName } from '@/lib/fonts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/components/ui/dialog';
import { SettingsContent } from '@/components/settings-content';
import { useVideoSettingsStore } from '@/lib/store/video-settings';

interface VideoPlayerProps {
  src: string;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  className?: string;
  activeLineText?: string;
  subtitleColor?: string;
  subtitleSecondaryColor?: string;
  subtitleFontFamily?: string;
  subtitleScale?: number;
  subtitlePosition?: 'top' | 'middle' | 'bottom';
  subtitleBackground?: 'none' | 'black' | 'white';
  subtitleOutline?: 'none' | 'thin' | 'medium' | 'thick' | string;
  activeSubtitles?: Array<{ code: string; text: string }>;
  onVideoClick?: (currentTime: number) => void;
  isEditingMode?: boolean;
  onExitEditingMode?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  currentTime,
  onTimeUpdate,
  className,
  activeLineText,
  subtitleColor,
  subtitleFontFamily,
  subtitleScale,
  subtitlePosition = 'bottom',
  subtitleBackground = 'none',
  subtitleOutline = '',
  activeSubtitles,
  subtitleSecondaryColor,
  onVideoClick,
  isEditingMode = false,
  onExitEditingMode,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hideControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSeekingRef = useRef(false);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapSideRef = useRef<'left' | 'right' | 'center' | null>(null);
  const [videoBox, setVideoBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Subtitle settings store (shared across app)
  const {
    color1,
    color2,
    fontFamily,
    subtitleScale: storeSubtitleScale,
    subtitlePosition: storeSubtitlePosition,
    subtitleBackground: storeSubtitleBackground,
    subtitleOutline: storeSubtitleOutline,
    setColor1,
    setColor2,
    setFontFamily,
    setSubtitleScale,
    setSubtitlePosition,
    setSubtitleBackground,
    setSubtitleOutline,
  } = useVideoSettingsStore();

  // Keyboard controls for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if the video player container is focused or if no input is focused
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          (activeElement as HTMLElement).contentEditable === 'true');

      if (isInputFocused) return;

      const video = videoRef.current;
      if (!video) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        // Inline skip logic to ensure we have current values
        isSeekingRef.current = true;
        const newTime = Math.max(0, Math.min(duration, video.currentTime - 10));
        video.currentTime = newTime;
        setInternalCurrentTime(newTime);
        onTimeUpdate(newTime);
        showControlsTemporarily();
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 100);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        // Inline skip logic to ensure we have current values
        isSeekingRef.current = true;
        const newTime = Math.max(0, Math.min(duration, video.currentTime + 10));
        video.currentTime = newTime;
        setInternalCurrentTime(newTime);
        onTimeUpdate(newTime);
        showControlsTemporarily();
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 100);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [duration, onTimeUpdate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      setInternalCurrentTime(currentTime);

      // Only update parent if we're not in the middle of a seek operation
      if (!isSeekingRef.current) {
        onTimeUpdate(currentTime);
      }
    };

    const updateVideoBox = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const vw = video.videoWidth || 0;
      const vh = video.videoHeight || 0;

      if (!vw || !vh) {
        setVideoBox({
          left: 0,
          top: 0,
          width: containerWidth,
          height: containerHeight,
        });
        return;
      }

      const scale = Math.min(containerWidth / vw, containerHeight / vh);
      const width = vw * scale;
      const height = vh * scale;
      const left = (containerWidth - width) / 2;
      const top = (containerHeight - height) / 2;
      setVideoBox({ left, top, width, height });
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      updateVideoBox();
    };

    const handleWaiting = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleStalled = () => {
      setIsBuffering(true);
    };

    const handleError = () => {
      setHasError(true);
      const mediaError = (video as any).error as MediaError | null;
      setErrorMessage(
        mediaError?.message ||
          (mediaError?.code
            ? `Media error code ${mediaError.code}`
            : 'Failed to load video')
      );
      setIsBuffering(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => updateVideoBox(), 0);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('stalled', handleStalled);
    video.addEventListener('error', handleError);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const ro = new ResizeObserver(() => updateVideoBox());
    if (containerRef.current) ro.observe(containerRef.current);
    updateVideoBox();

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('error', handleError);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      ro.disconnect();
    };
  }, [onTimeUpdate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  // Reset buffering/error state when source changes
  useEffect(() => {
    setHasError(false);
    setErrorMessage(null);
    setIsBuffering(true);
  }, [src]);

  // Load Google Font stylesheet dynamically when subtitle font changes
  useEffect(() => {
    if (!subtitleFontFamily) return;
    const id = `gf-${subtitleFontFamily.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      subtitleFontFamily
    )}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [subtitleFontFamily]);

  // Sync external currentTime prop with video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Only update if the difference is significant (more than 0.5 seconds)
    // This indicates an external seek operation (like clicking a transcription line)
    if (Math.abs(video.currentTime - currentTime) > 0.5) {
      isSeekingRef.current = true;
      video.currentTime = currentTime;
      setInternalCurrentTime(currentTime);

      // Update the parent component's currentTime state immediately
      onTimeUpdate(currentTime);

      // Reset the seeking flag after a short delay
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    }
  }, [currentTime, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    showControlsTemporarily();
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    const video = videoRef.current;
    if (!video) return;

    // If we have an onVideoClick handler, use it instead of toggle play
    if (onVideoClick) {
      e.preventDefault();
      e.stopPropagation();
      onVideoClick(video.currentTime);
      return;
    }

    // Default behavior: toggle play
    togglePlay();
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    isSeekingRef.current = true;
    video.currentTime = value[0];
    setInternalCurrentTime(value[0]);
    onTimeUpdate(value[0]);
    showControlsTemporarily();

    // Reset the seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = value[0];
    setVolume(value[0]);
    showControlsTemporarily();
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;

    isSeekingRef.current = true;
    const newTime = Math.max(
      0,
      Math.min(duration, video.currentTime + seconds)
    );
    video.currentTime = newTime;
    setInternalCurrentTime(newTime);
    onTimeUpdate(newTime);
    showControlsTemporarily();

    // Reset the seeking flag after a short delay
    setTimeout(() => {
      isSeekingRef.current = false;
    }, 100);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
    showControlsTemporarily();
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const scheduleHideControls = () => {
    // Clear existing timeout
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    // Set new timeout to hide controls after 3 seconds
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 500);
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    scheduleHideControls();
  };

  const handleMouseMove = () => {
    showControlsTemporarily();
  };

  const handleMouseEnter = () => {
    setShowControls(true);
    scheduleHideControls();
  };

  const handleMouseLeave = () => {
    // Don't immediately hide on mouse leave, let the timeout handle it
    scheduleHideControls();
  };

  // Mobile double-tap gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // Determine which side was tapped
    let tapSide: 'left' | 'right' | 'center';
    if (x < containerWidth * 0.3) {
      tapSide = 'left';
    } else if (x > containerWidth * 0.7) {
      tapSide = 'right';
    } else {
      tapSide = 'center';
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;
    const DOUBLE_TAP_DELAY = 300; // milliseconds

    if (
      timeSinceLastTap < DOUBLE_TAP_DELAY &&
      lastTapSideRef.current === tapSide
    ) {
      // Double tap detected
      e.preventDefault();

      if (tapSide === 'left') {
        skip(-10);
      } else if (tapSide === 'right') {
        skip(10);
      } else if (tapSide === 'center') {
        toggleFullscreen();
      }

      // Reset to prevent triple tap
      lastTapTimeRef.current = 0;
      lastTapSideRef.current = null;
    } else {
      // First tap or different side
      lastTapTimeRef.current = now;
      lastTapSideRef.current = tapSide;
    }
  };

  const preloadedClass = getPreloadedFontClassName(subtitleFontFamily);

  // Compute subtitle font-size relative to the actual rendered video height
  // Reason: ensure text scales with the video box rather than the page/root size
  const computedSubtitleFontSizePx = useMemo(() => {
    const scale = subtitleScale ?? 1;
    if (videoBox) {
      const basePx = videoBox.height * 0.035; // 3.5% of video height
      const clamped = Math.max(10, basePx); // keep readable on tiny videos
      return clamped * scale;
    }
    return 16 * scale; // fallback before metadata/layout is known
  }, [videoBox, subtitleScale]);

  const retryLoad = () => {
    const video = videoRef.current;
    if (!video) return;
    setHasError(false);
    setErrorMessage(null);
    setIsBuffering(true);
    // Reason: reinitialize the media pipeline without changing the URL
    video.load();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-video-bg rounded-lg overflow-hidden aspect-video',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        onClick={handleVideoClick}
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
      />

      {/* Loading Indicator */}
      {(isBuffering || !duration) && !hasError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-black/40 text-white px-3 py-2 rounded-md">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Buffering…</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center">
          <div className="flex items-center gap-3 bg-black/60 text-white px-4 py-3 rounded-md">
            <AlertTriangle className="w-5 h-5" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Unable to load video</span>
              {errorMessage && (
                <span className="text-xs opacity-80">{errorMessage}</span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={retryLoad}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Subtitle Overlay - constrained to actual rendered video area */}
      {(activeSubtitles && activeSubtitles.length > 0
        ? true
        : !!activeLineText) && (
        <div
          className="absolute z-10 pointer-events-none"
          style={
            videoBox
              ? {
                  left: `${videoBox.left}px`,
                  top: `${videoBox.top}px`,
                  width: `${videoBox.width}px`,
                  height: `${videoBox.height}px`,
                }
              : { left: 0, right: 0, top: 0, bottom: 0 }
          }
        >
          <div
            className={cn(
              'absolute left-0 right-0 px-2 sm:px-4 flex justify-center',
              subtitlePosition === 'top' && 'top-4',
              subtitlePosition === 'middle' && 'top-1/2 -translate-y-1/2',
              subtitlePosition === 'bottom' && 'bottom-4'
            )}
          >
            <div className="flex flex-col items-center gap-2 w-full">
              {(activeSubtitles && activeSubtitles.length > 0
                ? activeSubtitles
                : [{ code: 'src', text: activeLineText as string }]
              ).map((item, idx) => (
                <div
                  key={`${item.code}-${idx}`}
                  className={cn(
                    'px-1 py-1 rounded-lg inline-block max-w-full',
                    subtitleBackground === 'none' && 'bg-transparent',
                    subtitleBackground === 'black' &&
                      'bg-black/80 backdrop-blur-sm text-white',
                    subtitleBackground === 'white' &&
                      'bg-white/90 backdrop-blur-sm text-black'
                  )}
                >
                  <p
                    className={cn(
                      'text-center font-medium leading-relaxed break-words whitespace-pre-wrap',
                      preloadedClass
                    )}
                    style={{
                      color:
                        idx === 0
                          ? subtitleColor || '#FFFFFF'
                          : subtitleSecondaryColor ||
                            subtitleColor ||
                            '#FFFFFF',
                      fontFamily: subtitleFontFamily
                        ? `'${subtitleFontFamily}', system-ui, sans-serif`
                        : undefined,
                      fontSize: `${computedSubtitleFontSizePx}px`,
                      textShadow:
                        subtitleOutline === 'none'
                          ? 'none'
                          : subtitleOutline === 'thin'
                          ? '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000'
                          : subtitleOutline === 'medium'
                          ? '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000'
                          : '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 1px 2px 0 #000, -1px -2px 0 #000, 2px 1px 0 #000, -2px -1px 0 #000',
                    }}
                  >
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Editing Mode Overlay */}
      {isEditingMode && (
        <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 shadow-lg border">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Editing Mode</h3>
              <p className="text-sm text-muted-foreground">
                Video is paused for editing. Click "Done" to resume playback.
              </p>
              <Button onClick={onExitEditingMode} className="w-full">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Controls */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent',
          'transition-opacity duration-300 z-20',
          showControls && !isEditingMode ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Top-right Settings Button */}
        <div className="absolute top-2 right-2 z-[9999]">
          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <Button
              variant="outline"
              size="icon"
              type="button"
              className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-background/90"
              onClick={() => setIsSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" />
              <span className="sr-only">Open subtitle settings</span>
            </Button>
            <DialogContent
              container={containerRef.current || undefined}
              className="sm:max-w-md w-11/12 rounded-lg"
            >
              <DialogHeader>
                <DialogTitle>Subtitle Settings</DialogTitle>
              </DialogHeader>
              <SettingsContent
                color1={color1}
                setColor1={setColor1}
                color2={color2}
                setColor2={setColor2}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                subtitleScale={subtitleScale ?? storeSubtitleScale}
                setSubtitleScale={setSubtitleScale}
                subtitlePosition={subtitlePosition ?? storeSubtitlePosition}
                setSubtitlePosition={setSubtitlePosition}
                subtitleBackground={
                  subtitleBackground ?? storeSubtitleBackground
                }
                setSubtitleBackground={setSubtitleBackground}
                subtitleOutline={subtitleOutline || storeSubtitleOutline}
                setSubtitleOutline={setSubtitleOutline}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Center Play Button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="secondary"
            size="icon"
            className="w-16 h-16 rounded-full bg-black/20 backdrop-blur-sm border-white/20"
            type="button"
            onClick={togglePlay}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </Button>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4 bg-neutral-950/50">
          {/* Progress Bar */}
          <div className="mb-2 sm:mb-4">
            <Slider
              value={[internalCurrentTime]}
              max={duration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full transition-all duration-150 ease-in-out"
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => skip(-10)}
                className="text-white hover:bg-white/10 transition-colors duration-150"
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={togglePlay}
                className="text-white hover:bg-white/10 transition-colors duration-150"
              >
                {isPlaying ? (
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
                className="text-white hover:bg-white/10 transition-colors duration-150"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 text-white text-xs sm:text-sm">
              <span>{formatTime(internalCurrentTime)}</span>
              <span>/</span>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <Volume2 className="w-4 h-4 text-white" />
              <Slider
                value={[volume]}
                max={1}
                step={0.1}
                onValueChange={handleVolumeChange}
                className="w-12 sm:w-20 transition-all duration-150 ease-in-out"
              />

              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/10 transition-colors duration-150"
              >
                {isFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
