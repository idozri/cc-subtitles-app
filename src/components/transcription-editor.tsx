'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import TranscriptionLine, {
  TranscriptionLineData,
} from '@/components/transcription-line';
import { ScrollArea } from '@/components/ui/scroll-area';
import VideoPlayer from '@/components/video-player';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Settings,
  Scissors,
  Download,
  Video,
  FileText,
  FileCode,
  File,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { SettingsContent } from './settings-content';
import AddLineDialog, { PendingNewLine } from './add-line-dialog';
import { useVideoSettingsStore } from '@/lib/store/video-settings';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';

interface TranscriptionJsonWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptionJsonSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words: TranscriptionJsonWord[];
  translations?: Record<string, string>;
  pending?: Record<string, boolean>;
}

interface TranscriptionJson {
  segments: TranscriptionJsonSegment[];
}

interface TranscriptionEditorProps {
  videoSrc?: string;
  transcription: TranscriptionJson;
  initialFontFamily?: string;
  projectId?: string;
  projectStatus?: string;
  sourceLanguageName?: string;
  sourceLanguageCode?: string;
  onDirtyChange?: (dirty: boolean) => void;
  initialExportJobId?: string | null;
  initialExportedUrl?: string | null;
  layout?: 'split' | 'stacked' | 'lines-only';
  showDesktopSettings?: boolean;
  // Hook state props
  currentTime?: number;
  setCurrentTime?: (time: number) => void;
  activeLine?: TranscriptionLineData | undefined;
  activeLineText?: string;
  activeSubtitles?: Array<{ code: string; text: string }>;
  lines?: TranscriptionLineData[];
  setLines?: React.Dispatch<React.SetStateAction<TranscriptionLineData[]>>;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const TranscriptionEditor: React.FC<TranscriptionEditorProps> = React.memo(
  ({
    videoSrc,
    transcription,
    initialFontFamily,
    projectId,
    projectStatus,
    sourceLanguageName,
    sourceLanguageCode,
    onDirtyChange,
    initialExportJobId,
    initialExportedUrl,
    layout = 'split',
    showDesktopSettings = true,
    currentTime: externalCurrentTime,
    setCurrentTime: externalSetCurrentTime,
    activeLine: externalActiveLine,
    activeLineText: externalActiveLineText,
    activeSubtitles: externalActiveSubtitles,
    lines: externalLines,
    setLines: externalSetLines,
  }) => {
    const router = useRouter();
    const { toast } = useToast();
    const [isExporting, setIsExporting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [internalCurrentTime, setInternalCurrentTime] = useState(0);

    // Use external currentTime if provided, otherwise use internal state
    const currentTime = externalCurrentTime ?? internalCurrentTime;
    const setCurrentTime = externalSetCurrentTime ?? setInternalCurrentTime;

    // Use external lines if provided, otherwise use internal state
    const [internalLines, setInternalLines] = useState<TranscriptionLineData[]>(
      []
    );
    const lines = externalLines ?? internalLines;
    const setLines = externalSetLines ?? setInternalLines;
    const [cropLineId, setCropLineId] = useState<number | null>(null);
    const [dragOverId, setDragOverId] = useState<number | null>(null);
    const [dragSourceId, setDragSourceId] = useState<number | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const {
      color1,
      color2,
      fontFamily,
      subtitleScale,
      subtitlePosition,
      subtitleBackground,
      subtitleOutline,
      setColor1,
      setColor2,
      setFontFamily,
      setSubtitleScale,
      setSubtitlePosition,
      setSubtitleBackground,
      setSubtitleOutline,
    } = useVideoSettingsStore();

    // Ensure initialFontFamily can seed the store on first load
    useEffect(() => {
      if (initialFontFamily && !fontFamily) {
        setFontFamily(initialFontFamily);
      }
    }, [initialFontFamily, fontFamily, setFontFamily]);
    const [isAddLineOpen, setIsAddLineOpen] = useState(false);
    const [pendingNewLine, setPendingNewLine] = useState<PendingNewLine | null>(
      null
    );
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCroppingMode, setIsCroppingMode] = useState(false);
    const [exportingJobId, setExportingJobId] = useState<string | null>(null);
    const [exportUrl, setExportUrl] = useState<string | null>(null);
    const [retranslateInFlight, setRetranslateInFlight] = useState<
      Record<string, boolean>
    >({});
    const [hasUserInteracted, setHasUserInteracted] = useState(false);
    const [visibleLanguages, setVisibleLanguages] = useState<
      Record<string, boolean>
    >({});

    // --- History (Undo/Redo) ---
    const UNDO_LIMIT = 6;
    const [undoStack, setUndoStack] = useState<TranscriptionLineData[][]>([]);
    const [redoStack, setRedoStack] = useState<TranscriptionLineData[][]>([]);

    const cloneLines = (
      arr: TranscriptionLineData[]
    ): TranscriptionLineData[] =>
      arr.map((l) => ({
        id: l.id,
        start: l.start,
        end: l.end,
        text: l.text,
        words: l.words.map((w) => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })),
        translations: l.translations ? { ...l.translations } : undefined,
        pending: l.pending ? { ...l.pending } : undefined,
      }));

    const commitLinesUpdate = useCallback(
      (updater: (prev: TranscriptionLineData[]) => TranscriptionLineData[]) => {
        let didChange = false;
        setLines((prev) => {
          const nextLines = updater(prev);
          if (nextLines === prev) return prev;
          didChange = true;
          setUndoStack((uPrev) => {
            const next = [...uPrev, cloneLines(prev)];
            return next.length > UNDO_LIMIT ? next.slice(1) : next;
          });
          setRedoStack([]);
          return nextLines;
        });
        if (didChange) setIsDirty(true);
      },
      []
    );

    const canUndo = undoStack.length > 0;
    const canRedo = redoStack.length > 0;

    const undo = () => {
      if (!canUndo) return;
      setLines((current) => {
        const prevSnapshot = undoStack[undoStack.length - 1];
        setUndoStack((stack) => stack.slice(0, -1));
        setRedoStack((stack) => {
          const next = [...stack, cloneLines(current)];
          return next.length > UNDO_LIMIT ? next.slice(1) : next;
        });
        return cloneLines(prevSnapshot);
      });
      setIsDirty(true);
    };

    const redo = () => {
      if (!canRedo) return;
      setLines((current) => {
        const nextSnapshot = redoStack[redoStack.length - 1];
        setRedoStack((stack) => stack.slice(0, -1));
        setUndoStack((stack) => {
          const next = [...stack, cloneLines(current)];
          return next.length > UNDO_LIMIT ? next.slice(1) : next;
        });
        return cloneLines(nextSnapshot);
      });
      setIsDirty(true);
    };

    const gatherVisibleLanguages = useCallback((): string[] => {
      return Object.entries(visibleLanguages)
        .filter(([, on]) => on)
        .map(([code]) => code)
        .filter(Boolean);
    }, [visibleLanguages]);

    useEffect(() => {
      // Seed initial export state from props
      if (initialExportJobId && !exportingJobId) {
        setIsExporting(true);
        setExportingJobId(initialExportJobId);
        openExportStream(initialExportJobId);
      }
      if (initialExportedUrl && !exportUrl) {
        setExportUrl(initialExportedUrl);
      }
    }, [initialExportJobId, initialExportedUrl]);

    // If there is an active export job when page loads, attach to its stream
    useEffect(() => {
      if (!exportingJobId || exportUrl) return;
      const es = new EventSource(
        `/api/common/forward-stream?url=/export/stream&jobId=${exportingJobId}`
      );
      es.addEventListener('done', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data || '{}');
          if (data.url) setExportUrl(data.url);
        } catch {}
        setExportingJobId(null);
        es.close();
      });
      return () => es.close();
    }, [exportingJobId, exportUrl]);

    useEffect(() => {
      const mapped: TranscriptionLineData[] = transcription.segments
        .map((s) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          words: s.words,
          translations: s.translations,
          pending: s.pending,
        }))
        // Ensure lines are sorted; also helps gap buttons logic
        .sort((a, b) => a.start - b.start);
      setLines(mapped);
      setIsDirty(false);
      setUndoStack([]);
      setRedoStack([]);
    }, [transcription, setLines]);

    // Notify parent when dirty state changes
    useEffect(() => {
      if (onDirtyChange) onDirtyChange(isDirty);
    }, [isDirty, onDirtyChange]);

    // Listen for visibility changes from the parent component
    useEffect(() => {
      const updateVisibility = () => {
        if (typeof window !== 'undefined' && (window as any).__visibleLangs) {
          const newVisibleLangs = (window as any).__visibleLangs;
          setVisibleLanguages((prev) => {
            // Only update if the values actually changed
            const hasChanged =
              Object.keys(newVisibleLangs).some(
                (key) => prev[key] !== newVisibleLangs[key]
              ) ||
              Object.keys(prev).some(
                (key) => prev[key] !== newVisibleLangs[key]
              );
            return hasChanged ? { ...newVisibleLangs } : prev;
          });
        }
      };

      // Initial update
      updateVisibility();

      // Use a more reasonable polling interval and only when needed
      const interval = setInterval(updateVisibility, 1000); // Reduced from 100ms to 1000ms

      return () => clearInterval(interval);
    }, []);

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        const active = document.activeElement as HTMLElement | null;
        const tag = (active?.tagName || '').toLowerCase();
        const isEditable =
          tag === 'input' ||
          tag === 'textarea' ||
          (active && active.isContentEditable);
        if (isEditable) return; // don't interfere with native text editing

        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const mod = isMac ? e.metaKey : e.ctrlKey;
        if (!mod) return;

        if (e.key === 'z' || e.key === 'Z') {
          if (e.shiftKey) {
            // Redo (Cmd/Ctrl+Shift+Z)
            e.preventDefault();
            redo();
          } else {
            // Undo (Cmd/Ctrl+Z)
            e.preventDefault();
            undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          // Redo (Ctrl+Y)
          e.preventDefault();
          redo();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [undoStack, redoStack]);

    const activeId = useMemo(() => {
      // Use external activeLine if provided
      if (externalActiveLine) {
        console.log('Using external activeLine:', externalActiveLine.id);
        return externalActiveLine.id;
      }

      // Find all lines that could be active at this time
      const candidates = lines.filter(
        (l) => currentTime >= l.start && currentTime <= l.end
      );

      console.log('ActiveId calculation:', {
        currentTime,
        candidatesCount: candidates.length,
        candidates: candidates.map((c) => ({
          id: c.id,
          start: c.start,
          end: c.end,
        })),
      });

      // If multiple candidates, prefer the one that starts closest to currentTime
      if (candidates.length > 1) {
        const selected = candidates.reduce((closest, current) =>
          Math.abs(current.start - currentTime) <
          Math.abs(closest.start - currentTime)
            ? current
            : closest
        );
        console.log('Multiple candidates, selected:', selected.id);
        return selected.id;
      }

      const result = candidates[0]?.id ?? -1;
      console.log('Single candidate or none, result:', result);
      return result;
    }, [currentTime, lines, externalActiveLine]);

    const activeLine = useMemo(() => {
      // Use external activeLine if provided
      if (externalActiveLine) {
        return externalActiveLine;
      }

      // Find all lines that could be active at this time
      const candidates = lines.filter(
        (l) => currentTime >= l.start && currentTime <= l.end
      );

      // If multiple candidates, prefer the one that starts closest to currentTime
      if (candidates.length > 1) {
        return candidates.reduce((closest, current) =>
          Math.abs(current.start - currentTime) <
          Math.abs(closest.start - currentTime)
            ? current
            : closest
        );
      }

      return candidates[0];
    }, [currentTime, lines, externalActiveLine]);

    const activeLineText = useMemo(() => {
      // Use external activeLineText if provided
      if (externalActiveLineText !== undefined) {
        return externalActiveLineText;
      }

      if (!activeLine) return '';
      const src = (sourceLanguageCode || '').trim();
      const codes = gatherVisibleLanguages();
      // Only show original text if the source language is visible
      if (src && codes.includes(src)) {
        return activeLine.text ?? '';
      }
      return '';
    }, [
      activeLine,
      sourceLanguageCode,
      visibleLanguages,
      externalActiveLineText,
    ]);

    // Cropping is only allowed when there are no translations at all
    const hasAnyTranslations = useMemo(
      () =>
        lines.some(
          (l) =>
            (l.translations && Object.keys(l.translations).length > 0) ||
            (l.pending && Object.keys(l.pending).length > 0)
        ),
      [lines]
    );

    useEffect(() => {
      if (hasAnyTranslations && isCroppingMode) setIsCroppingMode(false);
    }, [hasAnyTranslations, isCroppingMode]);

    // LanguageBlock moved to its own component and used inside TranscriptionLine

    const retranslateLine = async (lineId: number, lang: string) => {
      if (!projectId || !sourceLanguageCode) return;
      const line = lines.find((l) => l.id === lineId);
      if (!line) return;
      const key = `${lineId}:${lang}`;
      setRetranslateInFlight((prev) => ({ ...prev, [key]: true }));
      try {
        const resp = await fetch(`/api/common/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            method: 'POST',
            url: '/translate/segment',
            body: {
              projectId,
              src: sourceLanguageCode,
              tgt: lang,
              forceFresh: true,
              segments: [
                {
                  id: String(line.id),
                  start: line.start,
                  end: line.end,
                  text: line.text,
                },
              ],
            },
          }),
        });
        if (!resp.ok) throw new Error('Retranslate failed');
        const json = await resp.json().catch(() => ({} as any));
        const translated = json?.segments?.[0]?.text;
        if (typeof translated === 'string') {
          applyTranslationText(lineId, lang, translated);
        }
      } catch (e) {
        toast({
          title: 'Retranslate failed',
          description: (e as Error).message,
          variant: 'destructive',
        });
      } finally {
        setRetranslateInFlight((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    };

    const renderPendingBlock = (label: string, key?: string) => (
      <div key={key} className="mt-2">
        <div className="text-[11px] text-muted-foreground font-medium mb-1">
          {label}
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-md px-2 py-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Translating…</span>
            <span className="inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );

    // Auto-scroll to active line
    useEffect(() => {
      console.log('Auto-scroll effect triggered:', {
        activeId,
        currentTime,
        hasScrollArea: !!scrollAreaRef.current,
      });

      if (activeId === -1 || !scrollAreaRef.current) return;

      // Add a small delay to prevent excessive scrolling when time changes rapidly
      const timeoutId = setTimeout(() => {
        // Debug: Check if we can find any elements with data-line-id
        const allLineElements =
          scrollAreaRef.current?.querySelectorAll('[data-line-id]');
        console.log('All line elements found:', allLineElements?.length || 0);

        const activeElement = scrollAreaRef.current?.querySelector(
          `[data-line-id="${activeId}"]`
        );

        console.log('Looking for active element:', {
          activeId,
          foundElement: !!activeElement,
          allElements: Array.from(allLineElements || []).map((el) =>
            el.getAttribute('data-line-id')
          ),
        });

        if (activeElement) {
          // Try multiple approaches to ensure scrolling works
          console.log('Attempting to scroll to active element');

          // Method 1: Direct scrollIntoView on the element
          try {
            activeElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest',
            });
            console.log('Method 1: Direct scrollIntoView completed');
          } catch (e) {
            console.log('Method 1 failed:', e);
          }

          // Method 2: Find the viewport within the ScrollArea and scroll manually
          const viewport = scrollAreaRef.current?.querySelector(
            '[data-radix-scroll-area-viewport]'
          );

          console.log('ScrollArea viewport found:', !!viewport);

          if (viewport) {
            try {
              const elementRect = activeElement.getBoundingClientRect();
              const viewportRect = viewport.getBoundingClientRect();

              // Calculate if element is outside viewport
              const isAbove = elementRect.top < viewportRect.top;
              const isBelow = elementRect.bottom > viewportRect.bottom;

              console.log('Viewport check:', {
                isAbove,
                isBelow,
                elementRect,
                viewportRect,
              });

              if (isAbove || isBelow) {
                console.log('Method 2: Manual scroll to center element');
                const elementTop = (activeElement as HTMLElement).offsetTop;
                const elementHeight = (activeElement as HTMLElement)
                  .offsetHeight;
                const viewportHeight = viewport.clientHeight;
                const scrollTop =
                  elementTop - viewportHeight / 2 + elementHeight / 2;

                viewport.scrollTo({
                  top: scrollTop,
                  behavior: 'smooth',
                });
                console.log('Method 2: Manual scroll completed');
              }
            } catch (e) {
              console.log('Method 2 failed:', e);
            }
          } else {
            // Method 3: Fallback - try to scroll the scrollAreaRef itself
            console.log('Method 3: Fallback scroll on scrollAreaRef');
            try {
              const elementTop = (activeElement as HTMLElement).offsetTop;
              const elementHeight = (activeElement as HTMLElement).offsetHeight;
              const containerHeight = scrollAreaRef.current?.clientHeight || 0;
              const scrollTop =
                elementTop - containerHeight / 2 + elementHeight / 2;

              scrollAreaRef.current?.scrollTo({
                top: scrollTop,
                behavior: 'smooth',
              });
              console.log('Method 3: Fallback scroll completed');
            } catch (e) {
              console.log('Method 3 failed:', e);
            }
          }
        }
      }, 100); // 100ms delay

      return () => clearTimeout(timeoutId);
    }, [activeId]);

    const markDirty = useCallback(() => setIsDirty(true), []);

    const applyLineText = useCallback(
      (id: number, newText: string) => {
        commitLinesUpdate((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l;
            const duration = Math.max(0.01, l.end - l.start);
            const tokens = newText.split(/\s+/).filter(Boolean);
            const words = (tokens.length ? tokens : ['']).map((word, i) => {
              const start =
                l.start + (duration * i) / Math.max(1, tokens.length);
              const end =
                i === Math.max(1, tokens.length) - 1
                  ? l.end
                  : l.start + (duration * (i + 1)) / Math.max(1, tokens.length);
              return { word, start, end };
            });
            return { ...l, text: newText, words };
          })
        );
      },
      [commitLinesUpdate]
    );

    const applyTranslationText = useCallback(
      (id: number, lang: string, newText: string) => {
        commitLinesUpdate((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l;
            const nextTranslations = { ...(l.translations || {}) } as Record<
              string,
              string
            >;
            nextTranslations[lang] = newText;
            return { ...l, translations: nextTranslations };
          })
        );
      },
      [commitLinesUpdate]
    );

    const adjustStart = useCallback(
      (id: number, delta: number) => {
        commitLinesUpdate((prev) => {
          const updated = prev.map((l) =>
            l.id === id
              ? { ...l, start: clamp(l.start + delta, 0, l.end - 0.01) }
              : l
          );
          return [...updated].sort((a, b) => a.start - b.start);
        });
      },
      [commitLinesUpdate]
    );

    const adjustEnd = useCallback(
      (id: number, delta: number) => {
        commitLinesUpdate((prev) => {
          const updated = prev.map((l) =>
            l.id === id
              ? {
                  ...l,
                  end: clamp(
                    l.end + delta,
                    l.start + 0.01,
                    Number.MAX_SAFE_INTEGER
                  ),
                }
              : l
          );
          return [...updated].sort((a, b) => a.start - b.start);
        });
      },
      [commitLinesUpdate]
    );

    const nextGeneratedId = () => {
      return lines.reduce((max, l) => (l.id > max ? l.id : max), 0) + 1;
    };

    const insertLineAtStart = () => {
      const first = lines[0];
      if (!first) return;
      if (first.start < 1) return;

      setPendingNewLine({ start: 0, end: first.start, insertIndex: 0 });
      setIsAddLineOpen(true);
    };

    const insertLineBetween = (index: number) => {
      const prev = lines[index];
      const next = lines[index + 1];
      if (!prev || !next) return;
      const gap = next.start - prev.end;
      if (gap < 1) return;

      setPendingNewLine({
        start: prev.end,
        end: next.start,
        insertIndex: index + 1,
      });
      setIsAddLineOpen(true);
    };

    const beginCrop = (id: number) => {
      setCropLineId((prev) => (prev === id ? null : id));
      markDirty();
    };

    const cropAtWord = (id: number, wordIndex: number) => {
      commitLinesUpdate((prev) => {
        const idx = prev.findIndex((l) => l.id === id);
        if (idx === -1) return prev;
        const original = prev[idx];
        if (wordIndex < 0 || wordIndex >= original.words.length - 1)
          return prev;

        const cutFrom = original.words[wordIndex + 1];
        const newStart = cutFrom.start;
        const leftWords = original.words.slice(0, wordIndex + 1);
        const rightWords = original.words.slice(wordIndex + 1);

        const updatedOriginal: TranscriptionLineData = {
          ...original,
          end: newStart,
          text: leftWords.map((w) => w.word).join(' '),
          words: leftWords,
        };

        const newLine: TranscriptionLineData = {
          id: prev.reduce((max, l) => (l.id > max ? l.id : max), 0) + 1,
          start: newStart,
          end: original.end,
          text: rightWords.map((w) => w.word).join(' '),
          words: rightWords,
        };

        const arr = [...prev];
        arr[idx] = updatedOriginal;
        arr.splice(idx + 1, 0, newLine);
        setCropLineId(null);
        return [...arr].sort((a, b) => a.start - b.start);
      });
    };

    const editWord = (id: number, wordIndex: number, newValue: string) => {
      commitLinesUpdate((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const words = [...l.words];
          words[wordIndex] = { ...words[wordIndex], word: newValue };
          return { ...l, words, text: words.map((w) => w.word).join(' ') };
        })
      );
    };

    const mergeLines = (fromId: number, toId: number) => {
      // Block merging when there are translations or pending translations
      if (hasAnyTranslations) {
        toast({
          title: 'Cannot merge lines',
          description: 'Merging is disabled when translations exist.',
          variant: 'destructive',
        });
        return;
      }
      if (fromId === toId) return;
      commitLinesUpdate((prev) => {
        const fromIdx = prev.findIndex((l) => l.id === fromId);
        const toIdx = prev.findIndex((l) => l.id === toId);
        if (fromIdx === -1 || toIdx === -1) return prev;
        const firstIdx = Math.min(fromIdx, toIdx);
        const secondIdx = Math.max(fromIdx, toIdx);
        const first = prev[firstIdx];
        const second = prev[secondIdx];
        const mergedWords = [...first.words, ...second.words];
        const merged: TranscriptionLineData = {
          id: first.id,
          start: Math.min(first.start, second.start),
          end: Math.max(first.end, second.end),
          words: mergedWords,
          text: mergedWords.map((w) => w.word).join(' '),
        };
        const arr = [...prev];
        arr[firstIdx] = merged;
        arr.splice(secondIdx, 1);
        setDragOverId(null);
        setDragSourceId(null);
        return [...arr].sort((a, b) => a.start - b.start);
      });
    };

    const deleteLine = (id: number) => {
      commitLinesUpdate((prev) => prev.filter((l) => l.id !== id));
      if (cropLineId === id) setCropLineId(null);
    };

    const commitNewLine = (rawText: string) => {
      if (!pendingNewLine) return;
      const text = rawText.trim();
      const { start, end, insertIndex } = pendingNewLine;
      const duration = Math.max(0, end - start);
      const tokens = text.length > 0 ? text.split(/\s+/).filter(Boolean) : [];
      const tokenCount = Math.max(1, tokens.length);

      const words = tokens.map((word, i) => {
        const wordStart = start + (duration * i) / tokenCount;
        const wordEnd =
          i === tokens.length - 1
            ? end
            : start + (duration * (i + 1)) / tokenCount;
        return { word, start: wordStart, end: wordEnd };
      });

      commitLinesUpdate((prevLines) => {
        const existingLangCodes = Array.from(
          new Set(prevLines.flatMap((l) => Object.keys(l.translations || {})))
        );
        const translationPlaceholders: Record<string, string> | undefined =
          existingLangCodes.length > 0
            ? existingLangCodes.reduce<Record<string, string>>((acc, code) => {
                acc[code] = '';
                return acc;
              }, {})
            : undefined;

        const newLine: TranscriptionLineData = {
          id: prevLines.reduce((max, l) => (l.id > max ? l.id : max), 0) + 1,
          start,
          end,
          text,
          words,
          translations: translationPlaceholders,
        };

        const arr = [...prevLines];
        arr.splice(insertIndex, 0, newLine);
        return [...arr].sort((a, b) => a.start - b.start);
      });

      setIsAddLineOpen(false);
      setPendingNewLine(null);
    };

    // Navigation/refresh guard when dirty
    useEffect(() => {
      const beforeUnload = (e: BeforeUnloadEvent) => {
        if (!isDirty) return;
        e.preventDefault();
        e.returnValue = '';
      };
      if (isDirty) {
        window.addEventListener('beforeunload', beforeUnload);
      }
      return () => window.removeEventListener('beforeunload', beforeUnload);
    }, [isDirty]);

    // Save to S3 via API (preserve full JSON; update segments and top-level translations)
    const handleSave = async () => {
      if (!projectId) return;
      setIsSaving(true);
      try {
        const out: any = JSON.parse(JSON.stringify(transcription || {}));

        out.segments = lines.map((l) => ({
          id: l.id,
          start: l.start,
          end: l.end,
          words: l.words,
          translations: l.translations,
          text: l.text.trim(),
        }));

        const payload = { json: out };
        const resp = await fetch(`/api/projects/${projectId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to save');
        }
        setIsDirty(false);
        toast({
          title: 'Saved',
          description: 'Transcription saved successfully.',
        });
      } catch (e) {
        toast({
          title: 'Save failed',
          description: (e as Error).message,
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    };

    const pickExportLanguageCode = useCallback((): string | null => {
      const visible = gatherVisibleLanguages();
      const src = (sourceLanguageCode || '').trim();
      const nonSource = visible.find((c: string) => c && c !== src);
      if (nonSource) return nonSource;
      return src || visible[0] || null;
    }, [gatherVisibleLanguages, sourceLanguageCode]);

    const formatTimeSrt = (seconds: number): string => {
      const msTotal = Math.max(0, Math.round(seconds * 1000));
      const ms = msTotal % 1000;
      const totalSeconds = Math.floor(msTotal / 1000);
      const s = totalSeconds % 60;
      const totalMinutes = Math.floor(totalSeconds / 60);
      const m = totalMinutes % 60;
      const h = Math.floor(totalMinutes / 60);
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      const padMs = (n: number) => String(n).padStart(3, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)},${padMs(ms)}`;
    };

    const formatTimeVtt = (seconds: number): string => {
      const msTotal = Math.max(0, Math.round(seconds * 1000));
      const ms = msTotal % 1000;
      const totalSeconds = Math.floor(msTotal / 1000);
      const s = totalSeconds % 60;
      const totalMinutes = Math.floor(totalSeconds / 60);
      const m = totalMinutes % 60;
      const h = Math.floor(totalMinutes / 60);
      const pad = (n: number, w = 2) => String(n).padStart(w, '0');
      const padMs = (n: number) => String(n).padStart(3, '0');
      return `${pad(h)}:${pad(m)}:${pad(s)}.${padMs(ms)}`;
    };

    const getLineTextForLanguage = useCallback(
      (line: TranscriptionLineData, code: string): string => {
        const src = (sourceLanguageCode || '').trim();
        if (code === src) return (line.text || '').trim();
        return (line.translations?.[code] || '').trim();
      },
      [sourceLanguageCode]
    );

    const buildPlainTextForLanguage = useCallback(
      (code: string): string => {
        return lines
          .map((l) => getLineTextForLanguage(l, code))
          .filter((t) => t.length > 0)
          .join('\n');
      },
      [lines, getLineTextForLanguage]
    );

    const buildSrtForLanguage = (code: string): string => {
      const chunks: string[] = [];
      let idx = 1;
      for (const l of lines) {
        const t = getLineTextForLanguage(l, code);
        if (!t) continue;
        chunks.push(String(idx++));
        chunks.push(`${formatTimeSrt(l.start)} --> ${formatTimeSrt(l.end)}`);
        chunks.push(t);
        chunks.push('');
      }
      return chunks.join('\n');
    };

    const buildVttForLanguage = (code: string): string => {
      const chunks: string[] = ['WEBVTT', ''];
      for (const l of lines) {
        const t = getLineTextForLanguage(l, code);
        if (!t) continue;
        chunks.push(`${formatTimeVtt(l.start)} --> ${formatTimeVtt(l.end)}`);
        chunks.push(t);
        chunks.push('');
      }
      return chunks.join('\n');
    };

    const downloadTextFile = (
      filename: string,
      content: string,
      mime = 'text/plain;charset=utf-8'
    ) => {
      try {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Download failed', e);
      }
    };

    const handleExportText = useCallback(() => {
      const code = pickExportLanguageCode();
      if (!code) return;
      const txt = buildPlainTextForLanguage(code);
      downloadTextFile(
        `${projectId || 'export'}-${code}.txt`,
        txt,
        'text/plain;charset=utf-8'
      );
    }, [pickExportLanguageCode, buildPlainTextForLanguage, projectId]);

    const handleExportSrt = () => {
      const code = pickExportLanguageCode();
      if (!code) return;
      const srt = buildSrtForLanguage(code);
      downloadTextFile(
        `${projectId || 'export'}-${code}.srt`,
        srt,
        'application/x-subrip;charset=utf-8'
      );
    };

    const handleExportVtt = () => {
      const code = pickExportLanguageCode();
      if (!code) return;
      const vtt = buildVttForLanguage(code);
      downloadTextFile(
        `${projectId || 'export'}-${code}.vtt`,
        vtt,
        'text/vtt;charset=utf-8'
      );
    };

    const activeSubtitles = useMemo(() => {
      // Use external activeSubtitles if provided
      if (externalActiveSubtitles) {
        return externalActiveSubtitles;
      }

      const codes = gatherVisibleLanguages();
      const out: Array<{ code: string; text: string }> = [];
      if (!activeLine) return out;
      const src = (sourceLanguageCode || '').trim();
      if (src && codes.includes(src)) {
        if (activeLine.text) out.push({ code: src, text: activeLine.text });
      }
      for (const code of codes) {
        if (code === src) continue;
        if (activeLine.translations && activeLine.translations[code]) {
          out.push({ code, text: activeLine.translations[code]! });
        }
      }
      return out;
    }, [
      activeLine,
      sourceLanguageCode,
      gatherVisibleLanguages,
      externalActiveSubtitles,
    ]);

    const handleExport = useCallback(async () => {
      setIsExporting(true);
      try {
        setExportUrl(null);
        // Collect languages to export: prefer explicitly visible languages.
        // If none are toggled, fall back to all translation codes present.
        const visible = gatherVisibleLanguages();
        const sourceKey = (
          sourceLanguageCode ||
          sourceLanguageName ||
          ''
        ).trim();
        let languages = visible
          .map((c: string) => String(c || '').trim())
          .filter((c: string) => !!c && c !== sourceKey);
        if (languages.length === 0) {
          const allCodes = Array.from(
            new Set(
              lines
                .flatMap((l) => Object.keys(l.translations || {}))
                .filter(Boolean)
            )
          );
          languages = allCodes;
        }
        const res = await fetch(`/api/common/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            method: 'POST',
            url: '/export',
            body: {
              projectId,
              languages,
              style: {
                fontFamily,
                subtitleScale,
                subtitlePosition,
                subtitleBackground,
                subtitleOutline,
                color1,
                color2,
              },
            },
          }),
        });
        const { jobId } = await res.json();
        setExportingJobId(jobId);
        openExportStream(jobId);
      } catch (e) {
        console.error(e);
      } finally {
        setIsExporting(false);
      }
    }, [
      gatherVisibleLanguages,
      sourceLanguageCode,
      sourceLanguageName,
      lines,
      projectId,
      fontFamily,
      subtitleScale,
      subtitlePosition,
      subtitleBackground,
      subtitleOutline,
      color1,
      color2,
    ]);

    const openExportStream = async (jobId: string) => {
      const es = new EventSource(
        `/api/common/forward-stream?url=/export/stream&jobId=${jobId}`
      );
      es.addEventListener('done', (ev) => {
        try {
          const data = JSON.parse((ev as MessageEvent).data || '{}');
          if (data.url) setExportUrl(data.url);
        } catch {}
        es.close();
        setExportingJobId(null);
        setIsExporting(false);
      });
    };

    const handleDownloadVideo = async () => {
      setIsDownloading(true);
      if (!projectId) return;
      try {
        const resp = await fetch(`/api/common/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            method: 'GET',
            url: `/projects/${projectId}/exported-video-signed`,
          }),
        });
        if (!resp.ok) return;
        const json = await resp.json().catch(() => null);
        const url = json?.data?.url || json?.url;
        if (!url) return;
        // Force a download by fetching the blob and using a temporary object URL
        const fileResp = await fetch(url, { credentials: 'omit' });
        const blob = await fileResp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `${projectId}-export.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
      } catch (e) {
        console.error(e);
      } finally {
        setIsDownloading(false);
      }
    };

    // Memoize event handlers to prevent recreation on every render
    const onDownload = useCallback(
      () => handleDownloadVideo(),
      [handleDownloadVideo]
    );
    const onVideo = useCallback(() => handleExport(), [handleExport]);
    const onText = useCallback(() => handleExportText(), [handleExportText]);
    const onSrt = useCallback(() => handleExportSrt(), [handleExportSrt]);
    const onVtt = useCallback(() => handleExportVtt(), [handleExportVtt]);

    // Bridge: allow page header export controls to trigger editor handlers
    useEffect(() => {
      document.addEventListener('cc:export:download', onDownload as any);
      document.addEventListener('cc:export:video', onVideo as any);
      document.addEventListener('cc:export:text', onText as any);
      document.addEventListener('cc:export:srt', onSrt as any);
      document.addEventListener('cc:export:vtt', onVtt as any);
      return () => {
        document.removeEventListener('cc:export:download', onDownload as any);
        document.removeEventListener('cc:export:video', onVideo as any);
        document.removeEventListener('cc:export:text', onText as any);
        document.removeEventListener('cc:export:srt', onSrt as any);
        document.removeEventListener('cc:export:vtt', onVtt as any);
      };
    }, [onDownload, onVideo, onText, onSrt, onVtt]);

    const isMobile = useMemo(() => window.innerWidth < 768, []);

    return (
      <div className="space-y-4 relative">
        {/* {layout !== 'lines-only' && videoSrc && (
          <Card className="sticky top-4 z-10">
            <CardContent className="p-0">
              <div className="relative">
                <VideoPlayer
                  src={videoSrc}
                  currentTime={currentTime}
                  onTimeUpdate={(time) => {
                    setCurrentTime(time);
                    setHasUserInteracted(true);
                  }}
                  className="w-full"
                  activeLineText={activeLineText}
                  activeSubtitles={activeSubtitles}
                  subtitleColor={color1}
                  subtitleSecondaryColor={color2}
                  subtitleFontFamily={fontFamily}
                  subtitleScale={subtitleScale}
                  subtitlePosition={subtitlePosition}
                  subtitleBackground={subtitleBackground}
                  subtitleOutline={subtitleOutline}
                /> */}
        {/* Mobile Settings Button */}
        {/* <div className="lg:hidden absolute top-4 right-4 z-30">
                <Dialog
                  open={isSettingsModalOpen}
                  onOpenChange={setIsSettingsModalOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm hover:bg-background/90"
                    >
                      <Settings className="h-4 w-4" />
                      <span className="sr-only">Open subtitle settings</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md w-11/12 rounded-lg">
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
                      subtitleScale={subtitleScale}
                      setSubtitleScale={setSubtitleScale}
                      subtitlePosition={subtitlePosition}
                      setSubtitlePosition={setSubtitlePosition}
                      subtitleBackground={subtitleBackground}
                      setSubtitleBackground={setSubtitleBackground}
                      subtitleOutline={subtitleOutline}
                      setSubtitleOutline={setSubtitleOutline}
                    />
                  </DialogContent>
                </Dialog>
              </div> */}
        {/* Add Line Modal */}
        {/* <AddLineDialog
                  open={isAddLineOpen}
                  onOpenChange={setIsAddLineOpen}
                  pending={pendingNewLine}
                  onSubmit={commitNewLine}
                />
              </div>
            </CardContent>
          </Card>
        )} */}
        <Card className="relative">
          <CardHeader className="text-lg sm:text-xl sticky top-4 bg-card z-10 rounded-t-lg outline outline-border outline-1">
            <div className="absolute h-4 top-[80px] left-0 right-0 bottom-0 z-10 bg-card" />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle>Transcription Lines</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl/Cmd+Z)"
                >
                  <Undo2 className="h-4 w-4 mr-1" />
                  {!isMobile && 'Undo'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Y or Cmd+Shift+Z)"
                >
                  <Redo2 className="h-4 w-4 mr-1" />
                  {!isMobile && 'Redo'}
                </Button>
                {isCroppingMode ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsCroppingMode(false)}
                  >
                    Done
                  </Button>
                ) : (
                  <>
                    {projectStatus === 'ready' && !hasAnyTranslations && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsCroppingMode(true)}
                        title="Split lines by clicking words"
                      >
                        <Scissors className="h-4 w-4" />
                      </Button>
                    )}
                    {isDirty && (
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={isSaving || !projectId}
                      >
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </Button>
                    )}
                    {/* Export moved to page header. Keeping dropdown hidden but functional via document events. */}
                    {/* <DropdownMenu>
                <DropdownMenuTrigger asChild className="cursor-pointer">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs sm:text-sm"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Export</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {exportUrl && (
                    <DropdownMenuItem
                      onClick={handleDownloadVideo}
                      disabled={isDownloading || isExporting}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download video
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleExport}
                    disabled={
                      !projectId || !!exportingJobId || isExporting
                    }
                  >
                    <Video className="h-4 w-4 mr-2" />
                    {exportingJobId ? 'Exporting video…' : 'Export video'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportText}>
                    <FileText className="h-4 w-4 mr-2" />
                    Text
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportSrt}>
                    <FileCode className="h-4 w-4 mr-2" />
                    SRT
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportVtt}>
                    <File className="h-4 w-4 mr-2" />
                    VTT
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu> */}
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea ref={scrollAreaRef} className="w-full">
              <div className="space-y-3 p-4">
                {lines.length > 0 && lines[0].start >= 0.999 && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={insertLineAtStart}
                    >
                      + Add line at start ({lines[0].start.toFixed(1)}s)
                    </Button>
                  </div>
                )}
                {lines.map((line, idx) => (
                  <React.Fragment key={line.id}>
                    <div
                      data-line-id={line.id}
                      className={
                        'rounded-lg border border-border bg-card/60 p-2 sm:p-3 transition-colors cursor-pointer ring-inset ' +
                        (line.id === activeId
                          ? 'ring-2 ring-primary/40 bg-primary/5'
                          : 'hover:bg-muted/40')
                      }
                      onClick={() => {
                        setCurrentTime(line.start);
                        setHasUserInteracted(true);
                      }}
                    >
                      <TranscriptionLine
                        line={line}
                        isActive={line.id === activeId}
                        onAdjustStart={adjustStart}
                        onAdjustEnd={adjustEnd}
                        onSeek={(t) => setCurrentTime(t)}
                        onBeginCrop={undefined}
                        onCropWord={cropAtWord}
                        isCropping={isCroppingMode}
                        onEditWord={editWord}
                        onEditLineText={applyLineText}
                        onDeleteLine={deleteLine}
                        draggable={!hasAnyTranslations}
                        onDragStart={(id) => setDragSourceId(id)}
                        onDragOver={(id) => setDragOverId(id)}
                        onDrop={(id) => mergeLines(dragSourceId ?? id, id)}
                        isDragOver={dragOverId === line.id}
                        displayMode={isCroppingMode ? 'words' : 'line'}
                        renderOnlyControls={!isCroppingMode}
                        disableStartDecrement={(() => {
                          const STEP = 0.1;
                          const prev = lines[idx - 1];
                          if (!prev) return line.start - STEP <= 0;
                          return line.start - STEP <= prev.end;
                        })()}
                        disableStartIncrement={(() => {
                          const STEP = 0.1;
                          const MIN_DURATION = 0.01;
                          return line.start + STEP >= line.end - MIN_DURATION;
                        })()}
                        disableEndDecrement={(() => {
                          const STEP = 0.1;
                          const MIN_DURATION = 0.01;
                          return line.end - STEP <= line.start + MIN_DURATION;
                        })()}
                        disableEndIncrement={(() => {
                          const STEP = 0.1;
                          const next = lines[idx + 1];
                          if (!next) return false;
                          return line.end + STEP >= next.start;
                        })()}
                        sourceLanguageName={sourceLanguageName}
                        sourceLanguageCode={sourceLanguageCode}
                        onApplyTranslationText={applyTranslationText}
                        onRetranslateLine={retranslateLine}
                        retranslateInFlight={retranslateInFlight}
                      />
                    </div>
                    {idx < lines.length - 1 &&
                      lines[idx + 1].start - line.end >= 0.999 && (
                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => insertLineBetween(idx)}
                          >
                            + Add line in gap (
                            {(lines[idx + 1].start - line.end).toFixed(1)}
                            s)
                          </Button>
                        </div>
                      )}
                  </React.Fragment>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  }
);

export default TranscriptionEditor;
