'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

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

export interface TranscriptionLineData {
  id: number;
  start: number;
  end: number;
  text: string;
  words: TranscriptionJsonWord[];
  translations?: Record<string, string>;
  pending?: Record<string, boolean>;
}

interface UseTranscriptionEditorProps {
  transcription: TranscriptionJson;
  projectId?: string;
  sourceLanguageCode?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

interface UseTranscriptionEditorReturn {
  // State
  lines: TranscriptionLineData[];
  isDirty: boolean;
  isSaving: boolean;
  isCroppingMode: boolean;
  cropLineId: number | null;
  dragOverId: number | null;
  dragSourceId: number | null;
  isAddLineOpen: boolean;
  pendingNewLine: PendingNewLine | null;
  retranslateInFlight: Record<string, boolean>;
  visibleLanguages: Record<string, boolean>;
  currentTime: number;

  // Computed values
  activeId: number;
  activeLine: TranscriptionLineData | undefined;
  activeLineText: string;
  activeSubtitles: Array<{ code: string; text: string }>;
  hasAnyTranslations: boolean;
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setLines: React.Dispatch<React.SetStateAction<TranscriptionLineData[]>>;
  setIsCroppingMode: (mode: boolean) => void;
  setCropLineId: (id: number | null) => void;
  setDragOverId: (id: number | null) => void;
  setDragSourceId: (id: number | null) => void;
  setIsAddLineOpen: (open: boolean) => void;
  setPendingNewLine: (line: PendingNewLine | null) => void;
  setRetranslateInFlight: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setVisibleLanguages: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  setCurrentTime: (time: number) => void;

  // Line operations
  applyLineText: (id: number, newText: string) => void;
  applyTranslationText: (id: number, lang: string, newText: string) => void;
  adjustStart: (id: number, delta: number) => void;
  adjustEnd: (id: number, delta: number) => void;
  editWord: (id: number, wordIndex: number, newValue: string) => void;
  deleteLine: (id: number) => void;
  mergeLines: (fromId: number, toId: number) => void;
  cropAtWord: (id: number, wordIndex: number) => void;
  beginCrop: (id: number) => void;
  commitLinesUpdate: (
    updater: (prev: TranscriptionLineData[]) => TranscriptionLineData[]
  ) => void;

  // Line insertion
  insertLineAtStart: () => void;
  insertLineBetween: (index: number) => void;
  commitNewLine: (rawText: string) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Save
  handleSave: () => Promise<void>;

  // Retranslation
  retranslateLine: (lineId: number, lang: string) => Promise<void>;

  // Language utilities
  gatherVisibleLanguages: () => string[];

  // Refs
  scrollAreaRef: React.RefObject<HTMLDivElement | null>;
}

interface PendingNewLine {
  start: number;
  end: number;
  insertIndex: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const useTranscriptionEditor = ({
  transcription,
  projectId,
  sourceLanguageCode,
  onDirtyChange,
}: UseTranscriptionEditorProps): UseTranscriptionEditorReturn => {
  const { toast } = useToast();
  const [lines, setLines] = useState<TranscriptionLineData[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCroppingMode, setIsCroppingMode] = useState(false);
  const [cropLineId, setCropLineId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragSourceId, setDragSourceId] = useState<number | null>(null);
  const [isAddLineOpen, setIsAddLineOpen] = useState(false);
  const [pendingNewLine, setPendingNewLine] = useState<PendingNewLine | null>(
    null
  );
  const [retranslateInFlight, setRetranslateInFlight] = useState<
    Record<string, boolean>
  >({});
  const [visibleLanguages, setVisibleLanguages] = useState<
    Record<string, boolean>
  >({});
  const [currentTime, setCurrentTime] = useState(0);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // History (Undo/Redo)
  const UNDO_LIMIT = 6;
  const [undoStack, setUndoStack] = useState<TranscriptionLineData[][]>([]);
  const [redoStack, setRedoStack] = useState<TranscriptionLineData[][]>([]);

  const cloneLines = (arr: TranscriptionLineData[]): TranscriptionLineData[] =>
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

  const undo = useCallback(() => {
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
  }, [canUndo, undoStack]);

  const redo = useCallback(() => {
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
  }, [canRedo, redoStack]);

  const gatherVisibleLanguages = useCallback((): string[] => {
    return Object.entries(visibleLanguages)
      .filter(([, on]) => on)
      .map(([code]) => code)
      .filter(Boolean);
  }, [visibleLanguages]);

  // Initialize lines from transcription
  useEffect(() => {
    if (!transcription || !transcription.segments) {
      setLines([]);
      setIsDirty(false);
      setUndoStack([]);
      setRedoStack([]);
      return;
    }

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
      .sort((a, b) => a.start - b.start);

    // Only update if the data has actually changed
    setLines((prevLines) => {
      if (prevLines.length !== mapped.length) {
        return mapped;
      }

      // Check if any segment has changed
      const hasChanged = prevLines.some((prevLine, index) => {
        const newLine = mapped[index];
        if (!newLine) return true;

        return (
          prevLine.id !== newLine.id ||
          prevLine.start !== newLine.start ||
          prevLine.end !== newLine.end ||
          prevLine.text !== newLine.text ||
          JSON.stringify(prevLine.translations) !==
            JSON.stringify(newLine.translations) ||
          JSON.stringify(prevLine.pending) !== JSON.stringify(newLine.pending)
        );
      });

      return hasChanged ? mapped : prevLines;
    });

    setIsDirty(false);
    setUndoStack([]);
    setRedoStack([]);
  }, [transcription]);

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
          // Check if the objects are actually different to prevent unnecessary updates
          const prevKeys = Object.keys(prev);
          const newKeys = Object.keys(newVisibleLangs);

          if (prevKeys.length !== newKeys.length) {
            return { ...newVisibleLangs };
          }

          const hasChanged = newKeys.some(
            (key) => prev[key] !== newVisibleLangs[key]
          );

          return hasChanged ? { ...newVisibleLangs } : prev;
        });
      }
    };

    // Initial update
    updateVisibility();

    // Use a more efficient approach with a longer interval and proper cleanup
    const interval = setInterval(updateVisibility, 2000);
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
      if (isEditable) return;

      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Computed values
  const activeId = useMemo(() => {
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
      ).id;
    }

    return candidates[0]?.id ?? -1;
  }, [currentTime, lines]);

  const activeLine = useMemo(() => {
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
  }, [currentTime, lines]);

  const activeLineText = useMemo(() => {
    if (!activeLine) return '';
    const src = (sourceLanguageCode || '').trim();
    const codes = gatherVisibleLanguages();
    if (src && codes.includes(src)) {
      return activeLine.text ?? '';
    }
    return '';
  }, [activeLine, sourceLanguageCode, gatherVisibleLanguages]);

  const hasAnyTranslations = useMemo(
    () =>
      lines.some(
        (l) =>
          (l.translations && Object.keys(l.translations).length > 0) ||
          (l.pending && Object.keys(l.pending).length > 0)
      ),
    [lines]
  );

  const activeSubtitles = useMemo(() => {
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
  }, [activeLine, sourceLanguageCode, gatherVisibleLanguages]);

  // Line operations
  const applyLineText = useCallback(
    (id: number, newText: string) => {
      commitLinesUpdate((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const duration = Math.max(0.01, l.end - l.start);
          const tokens = newText.split(/\s+/).filter(Boolean);
          const words = (tokens.length ? tokens : ['']).map((word, i) => {
            const start = l.start + (duration * i) / Math.max(1, tokens.length);
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

  const editWord = useCallback(
    (id: number, wordIndex: number, newValue: string) => {
      commitLinesUpdate((prev) =>
        prev.map((l) => {
          if (l.id !== id) return l;
          const words = [...l.words];
          words[wordIndex] = { ...words[wordIndex], word: newValue };
          return { ...l, words, text: words.map((w) => w.word).join(' ') };
        })
      );
    },
    [commitLinesUpdate]
  );

  const deleteLine = useCallback(
    (id: number) => {
      commitLinesUpdate((prev) => prev.filter((l) => l.id !== id));
      if (cropLineId === id) setCropLineId(null);
    },
    [commitLinesUpdate, cropLineId]
  );

  const mergeLines = useCallback(
    (fromId: number, toId: number) => {
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
    },
    [hasAnyTranslations, commitLinesUpdate, toast]
  );

  const cropAtWord = useCallback(
    (id: number, wordIndex: number) => {
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
    },
    [commitLinesUpdate]
  );

  const beginCrop = useCallback((id: number) => {
    setCropLineId((prev) => (prev === id ? null : id));
    setIsDirty(true);
  }, []);

  // Line insertion
  const insertLineAtStart = useCallback(() => {
    const first = lines[0];
    if (!first) return;
    if (first.start < 1) return;

    setPendingNewLine({ start: 0, end: first.start, insertIndex: 0 });
    setIsAddLineOpen(true);
  }, [lines]);

  const insertLineBetween = useCallback(
    (index: number) => {
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
    },
    [lines]
  );

  const commitNewLine = useCallback(
    (rawText: string) => {
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
    },
    [pendingNewLine, commitLinesUpdate]
  );

  // Save function
  const handleSave = useCallback(async () => {
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
  }, [projectId, transcription, lines, toast]);

  // Retranslation
  const retranslateLine = useCallback(
    async (lineId: number, lang: string) => {
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
                  t0: line.start,
                  t1: line.end,
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
    },
    [projectId, sourceLanguageCode, lines, applyTranslationText, toast]
  );

  return {
    // State
    lines,
    isDirty,
    isSaving,
    isCroppingMode,
    cropLineId,
    dragOverId,
    dragSourceId,
    isAddLineOpen,
    pendingNewLine,
    retranslateInFlight,
    visibleLanguages,
    currentTime,

    // Computed values
    activeId,
    activeLine,
    activeLineText,
    activeSubtitles,
    hasAnyTranslations,
    canUndo,
    canRedo,

    // Actions
    setLines,
    setIsCroppingMode,
    setCropLineId,
    setDragOverId,
    setDragSourceId,
    setIsAddLineOpen,
    setPendingNewLine,
    setRetranslateInFlight,
    setVisibleLanguages,
    setCurrentTime,

    // Line operations
    applyLineText,
    applyTranslationText,
    adjustStart,
    adjustEnd,
    editWord,
    deleteLine,
    mergeLines,
    cropAtWord,
    beginCrop,
    commitLinesUpdate,

    // Line insertion
    insertLineAtStart,
    insertLineBetween,
    commitNewLine,

    // History
    undo,
    redo,

    // Save
    handleSave,

    // Retranslation
    retranslateLine,

    // Language utilities
    gatherVisibleLanguages,

    // Refs
    scrollAreaRef,
  };
};
