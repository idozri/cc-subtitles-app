'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  videoSrc: string;
  transcription: TranscriptionJson;
  initialFontFamily?: string;
  projectId?: string;
  projectStatus?: string;
  sourceLanguageName?: string;
  sourceLanguageCode?: string;
  onDirtyChange?: (dirty: boolean) => void;
  initialExportJobId?: string | null;
  initialExportedUrl?: string | null;
  layout?: 'split' | 'stacked';
  showDesktopSettings?: boolean;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const TranscriptionEditor: React.FC<TranscriptionEditorProps> = ({
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
}) => {
  const router = useRouter();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [lines, setLines] = useState<TranscriptionLineData[]>([]);
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

  const gatherVisibleLanguages = (): string[] => {
    return Object.entries(visibleLanguages)
      .filter(([, on]) => on)
      .map(([code]) => code)
      .filter(Boolean);
  };

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
  }, [transcription]);

  // Notify parent when dirty state changes
  useEffect(() => {
    if (onDirtyChange) onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  // Listen for visibility changes from the parent component
  useEffect(() => {
    const updateVisibility = () => {
      if (typeof window !== 'undefined' && (window as any).__visibleLangs) {
        setVisibleLanguages({ ...(window as any).__visibleLangs });
      }
    };

    // Initial update
    updateVisibility();

    // Listen for changes (polling approach since we can't directly observe window object changes)
    const interval = setInterval(updateVisibility, 100);

    return () => clearInterval(interval);
  }, []);

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
    // Only show original text if the source language is visible
    if (src && codes.includes(src)) {
      return activeLine.text ?? '';
    }
    return '';
  }, [activeLine, sourceLanguageCode, visibleLanguages]);

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

  // Auto-scroll to active line (only after user interaction)
  useEffect(() => {
    if (activeId === -1 || !scrollAreaRef.current || !hasUserInteracted) return;

    const activeElement = scrollAreaRef.current.querySelector(
      `[data-line-id="${activeId}"]`
    );

    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeId, hasUserInteracted]);

  const markDirty = () => setIsDirty(true);

  const applyLineText = (id: number, newText: string) => {
    setLines((prev) =>
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
    markDirty();
  };

  const applyTranslationText = (id: number, lang: string, newText: string) => {
    setLines((prev) =>
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
    markDirty();
  };

  const adjustStart = (id: number, delta: number) => {
    setLines((prev) => {
      const updated = prev.map((l) =>
        l.id === id
          ? { ...l, start: clamp(l.start + delta, 0, l.end - 0.01) }
          : l
      );
      return [...updated].sort((a, b) => a.start - b.start);
    });
    markDirty();
  };

  const adjustEnd: (id: number, delta: number) => void = (id, delta) => {
    setLines((prev) => {
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
    markDirty();
  };

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
    const idx = lines.findIndex((l) => l.id === id);
    if (idx === -1) return;
    const original = lines[idx];
    // Can't split after the last word
    if (wordIndex < 0 || wordIndex >= original.words.length - 1) return;

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
      id: nextGeneratedId(),
      start: newStart,
      end: original.end,
      text: rightWords.map((w) => w.word).join(' '),
      words: rightWords,
    };

    setLines((prev) => {
      const arr = [...prev];
      arr[idx] = updatedOriginal;
      arr.splice(idx + 1, 0, newLine);
      return [...arr].sort((a, b) => a.start - b.start);
    });

    setCropLineId(null);
    markDirty();
  };

  const editWord = (id: number, wordIndex: number, newValue: string) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const words = [...l.words];
        words[wordIndex] = { ...words[wordIndex], word: newValue };
        return { ...l, words, text: words.map((w) => w.word).join(' ') };
      })
    );
    markDirty();
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
    const fromIdx = lines.findIndex((l) => l.id === fromId);
    const toIdx = lines.findIndex((l) => l.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    // Ensure order: merge source into target; target keeps earlier start and later end
    const firstIdx = Math.min(fromIdx, toIdx);
    const secondIdx = Math.max(fromIdx, toIdx);
    const first = lines[firstIdx];
    const second = lines[secondIdx];

    const mergedWords = [...first.words, ...second.words];
    const merged: TranscriptionLineData = {
      id: first.id,
      start: Math.min(first.start, second.start),
      end: Math.max(first.end, second.end),
      words: mergedWords,
      text: mergedWords.map((w) => w.word).join(' '),
    };

    setLines((prev) => {
      const arr = [...prev];
      arr[firstIdx] = merged;
      arr.splice(secondIdx, 1);
      return [...arr].sort((a, b) => a.start - b.start);
    });

    setDragOverId(null);
    setDragSourceId(null);
    markDirty();
  };

  const deleteLine = (id: number) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
    if (cropLineId === id) setCropLineId(null);
    markDirty();
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

    // Collect all translation language codes currently present in the document
    const existingLangCodes = Array.from(
      new Set(lines.flatMap((l) => Object.keys(l.translations || {})))
    );
    const translationPlaceholders: Record<string, string> | undefined =
      existingLangCodes.length > 0
        ? existingLangCodes.reduce<Record<string, string>>((acc, code) => {
            acc[code] = '';
            return acc;
          }, {})
        : undefined;

    const newLine: TranscriptionLineData = {
      id: nextGeneratedId(),
      start,
      end,
      text,
      words,
      translations: translationPlaceholders,
    };

    setLines((prevLines) => {
      const arr = [...prevLines];
      arr.splice(insertIndex, 0, newLine);
      return [...arr].sort((a, b) => a.start - b.start);
    });

    setIsAddLineOpen(false);
    setPendingNewLine(null);
    markDirty();
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

  const pickExportLanguageCode = (): string | null => {
    const visible = gatherVisibleLanguages();
    const src = (sourceLanguageCode || '').trim();
    const nonSource = visible.find((c) => c && c !== src);
    if (nonSource) return nonSource;
    return src || visible[0] || null;
  };

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

  const getLineTextForLanguage = (
    line: TranscriptionLineData,
    code: string
  ): string => {
    const src = (sourceLanguageCode || '').trim();
    if (code === src) return (line.text || '').trim();
    return (line.translations?.[code] || '').trim();
  };

  const buildPlainTextForLanguage = (code: string): string => {
    return lines
      .map((l) => getLineTextForLanguage(l, code))
      .filter((t) => t.length > 0)
      .join('\n');
  };

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

  const handleExportText = () => {
    const code = pickExportLanguageCode();
    if (!code) return;
    const txt = buildPlainTextForLanguage(code);
    downloadTextFile(
      `${projectId || 'export'}-${code}.txt`,
      txt,
      'text/plain;charset=utf-8'
    );
  };

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
  }, [activeLine, sourceLanguageCode, visibleLanguages]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      setExportUrl(null);
      // Collect languages to export: prefer explicitly visible languages.
      // If none are toggled, fall back to all translation codes present.
      const visible = gatherVisibleLanguages();
      const sourceKey = (sourceLanguageCode || sourceLanguageName || '').trim();
      let languages = visible
        .map((c) => String(c || '').trim())
        .filter((c) => !!c && c !== sourceKey);
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
  };

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

  // Bridge: allow page header export controls to trigger editor handlers
  useEffect(() => {
    const onDownload = () => handleDownloadVideo();
    const onVideo = () => handleExport();
    const onText = () => handleExportText();
    const onSrt = () => handleExportSrt();
    const onVtt = () => handleExportVtt();
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
  }, [
    projectId,
    lines,
    visibleLanguages,
    sourceLanguageCode,
    sourceLanguageName,
    fontFamily,
    subtitleScale,
    subtitlePosition,
    subtitleBackground,
    subtitleOutline,
    color1,
    color2,
  ]);

  if (true) {
    return (
      <div className="space-y-4 relative">
        <Card className="sticky top-0 z-10">
          <CardContent className="pt-4">
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
              />
              {/* Mobile Settings Button */}
              <div className="lg:hidden absolute top-4 right-4 z-30">
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
              </div>
              {/* Add Line Modal */}
              <AddLineDialog
                open={isAddLineOpen}
                onOpenChange={setIsAddLineOpen}
                pending={pendingNewLine}
                onSubmit={commitNewLine}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="flex flex-col">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">
                Transcription Lines
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
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
                    <DropdownMenu>
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
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <ScrollArea ref={scrollAreaRef} className="h-full pr-3">
              <div className="space-y-3">
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
};

export default TranscriptionEditor;
