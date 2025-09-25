'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Plus, Scissors, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import LanguageBlock from '@/components/language-block';

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionLineData {
  id: number;
  start: number;
  end: number;
  text: string;
  words: WordTiming[];
  // Optional per-language translations attached by the editor layer
  translations?: Record<string, string>;
  // Pending per-language placeholders shown while streaming
  pending?: Record<string, boolean>;
}

interface TranscriptionLineProps {
  line: TranscriptionLineData;
  isActive: boolean;
  onAdjustStart: (id: number, delta: number) => void;
  onAdjustEnd: (id: number, delta: number) => void;
  onSeek: (time: number) => void;
  onBeginCrop?: (id: number) => void;
  onCropWord?: (id: number, wordIndex: number) => void;
  isCropping?: boolean;
  onEditWord?: (id: number, wordIndex: number, newValue: string) => void;
  onEditLineText?: (id: number, newValue: string) => void;
  onDeleteLine?: (id: number) => void;
  // Drag & drop
  draggable?: boolean;
  onDragStart?: (id: number) => void;
  onDragOver?: (id: number) => void;
  onDrop?: (id: number) => void;
  isDragOver?: boolean;
  className?: string;
  // Disable controls based on neighbor constraints
  disableStartDecrement?: boolean;
  disableStartIncrement?: boolean;
  disableEndDecrement?: boolean;
  disableEndIncrement?: boolean;
  // Display mode: show word chips for editing, or a single line text
  displayMode?: 'words' | 'line';
  // When true, render only the header/controls without the text body.
  renderOnlyControls?: boolean;
  // Language/translation integration
  sourceLanguageName?: string;
  sourceLanguageCode?: string;
  onApplyTranslationText?: (id: number, lang: string, newText: string) => void;
  onRetranslateLine?: (id: number, lang: string) => void;
  retranslateInFlight?: Record<string, boolean>;
}

const formatTimestamp = (seconds: number): string => {
  const totalSeconds = Math.max(0, seconds);
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const secsInt = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  const millis = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 1000)
    .toString()
    .padStart(3, '0');
  return `${minutes}:${secsInt}.${millis}`;
};

const TranscriptionLine: React.FC<TranscriptionLineProps> = ({
  line,
  isActive,
  onAdjustStart,
  onAdjustEnd,
  onSeek,
  onBeginCrop,
  onCropWord,
  isCropping = false,
  onEditWord,
  onEditLineText,
  onDeleteLine,
  draggable = true,
  onDragStart,
  onDragOver,
  onDrop,
  isDragOver = false,
  className,
  disableStartDecrement = false,
  disableStartIncrement = false,
  disableEndDecrement = false,
  disableEndIncrement = false,
  displayMode = 'words',
  renderOnlyControls = false,
  sourceLanguageName,
  sourceLanguageCode,
  onApplyTranslationText,
  onRetranslateLine,
  retranslateInFlight,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isLineEditing, setIsLineEditing] = useState(false);
  const [lineEditingValue, setLineEditingValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const beginEdit = (wordIndex: number, currentValue: string) => {
    setEditingIndex(wordIndex);
    setEditingValue(currentValue);
  };

  const commitEdit = (wordIndex: number) => {
    if (editingIndex === null) return;
    if (onEditWord && editingValue.trim() !== '') {
      onEditWord(line.id, wordIndex, editingValue.trim());
    }
    setEditingIndex(null);
  };

  const beginLineEdit = () => {
    setIsLineEditing(true);
    setLineEditingValue(line.text);
  };

  const commitLineEdit = () => {
    const newText = lineEditingValue.trim();
    if (onEditLineText) onEditLineText(line.id, newText);
    setIsLineEditing(false);
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!mouseDownPos) return;

    // Check if this was a click (not a drag)
    const deltaX = Math.abs(e.clientX - mouseDownPos.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.y);
    const isClick = deltaX < 5 && deltaY < 5; // 5px threshold for click vs drag

    if (isClick && !isDragging) {
      // Don't seek if clicking on buttons or interactive elements
      const target = e.target as HTMLElement;
      if (!target.closest('button') && !target.closest('input')) {
        // Seek to the exact start time of the line
        onSeek(line.start);
      }
    }

    setMouseDownPos(null);
  };

  const handleLineClick = (e: React.MouseEvent) => {
    // This is now handled by mouse up, but keep as fallback
    if (isDragging) return;

    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }

    onSeek(line.start);
  };

  const hasTranslationsOrPending = useMemo(
    () =>
      (line.translations && Object.keys(line.translations).length > 0) ||
      (line.pending && Object.keys(line.pending).length > 0),
    [line.translations, line.pending]
  );

  return (
    <div
      className={cn(draggable && 'cursor-grab', className)}
      draggable={draggable && !hasTranslationsOrPending}
      onClick={handleLineClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.setData('text/plain', String(line.id));
        onDragStart && onDragStart(line.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver && onDragOver(line.id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop && onDrop(line.id);
        // Reset dragging state after a short delay
        setTimeout(() => setIsDragging(false), 100);
      }}
      onDragEnd={() => {
        // Reset dragging state after a short delay
        setTimeout(() => setIsDragging(false), 100);
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          <span>{formatTimestamp(line.start)}</span>
          <span>:</span>
          <span>{formatTimestamp(line.end)}</span>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          {onBeginCrop && (
            <Button
              type="button"
              size="icon"
              variant={isCropping ? 'default' : 'outline'}
              className="h-6 w-6 sm:h-7 sm:w-7"
              disabled={false}
              onClick={(e) => {
                e.stopPropagation();
                onBeginCrop && onBeginCrop(line.id);
              }}
              title={
                isCropping ? 'Cropping: click a word to split' : 'Crop line'
              }
            >
              <Scissors className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-6 w-6 sm:h-7 sm:w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteLine && onDeleteLine(line.id);
            }}
            title="Delete line"
            aria-label="Delete line"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          <div className="w-px h-4 sm:h-5 bg-border mx-1" />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6 sm:h-7 sm:w-7"
            disabled={disableStartDecrement}
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStart(line.id, -0.1);
            }}
            title="Start -0.1s"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6 sm:h-7 sm:w-7"
            disabled={disableStartIncrement}
            onClick={(e) => {
              e.stopPropagation();
              onAdjustStart(line.id, +0.1);
            }}
            title="Start +0.1s"
          >
            <Plus className="h-3 w-3" />
          </Button>

          <div className="w-px h-4 sm:h-5 bg-border mx-1" />

          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6 sm:h-7 sm:w-7"
            disabled={disableEndDecrement}
            onClick={(e) => {
              e.stopPropagation();
              onAdjustEnd(line.id, -0.1);
            }}
            title="End -0.1s"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6 sm:h-7 sm:w-7"
            disabled={disableEndIncrement}
            onClick={(e) => {
              e.stopPropagation();
              onAdjustEnd(line.id, +0.1);
            }}
            title="End +0.1s"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {!renderOnlyControls &&
        (displayMode === 'words' ? (
          <div className="mt-3 flex flex-wrap gap-1 sm:gap-2">
            {line.words.map((w, idx) => (
              <div key={`${line.id}-${idx}-${w.start}`} className="inline-flex">
                {editingIndex === idx ? (
                  <input
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => commitEdit(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(idx);
                      if (e.key === 'Escape') setEditingIndex(null);
                    }}
                    className="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm border border-border bg-background text-foreground min-w-0"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      isCropping && onCropWord
                        ? onCropWord(line.id, idx)
                        : beginEdit(idx, w.word);
                    }}
                    className={cn(
                      'px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm transition-colors break-words',
                      'bg-muted text-foreground hover:bg-primary hover:text-primary-foreground'
                    )}
                    style={
                      isCropping
                        ? {
                            cursor:
                              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath fill='%23000' d='M9.64 7L12 9.36L14.36 7L16 8.64L13.64 11L16 13.36L14.36 15L12 12.64L9.64 15L8 13.36L10.36 11L8 8.64L9.64 7Z'/%3E%3C/svg%3E\") 12 12, pointer",
                          }
                        : undefined
                    }
                    aria-label={`Edit word at ${formatTimestamp(w.start)}`}
                  >
                    {w.word}
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3">
            {isLineEditing ? (
              <input
                value={lineEditingValue}
                onChange={(e) => setLineEditingValue(e.target.value)}
                onBlur={commitLineEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitLineEdit();
                  if (e.key === 'Escape') setIsLineEditing(false);
                }}
                className="w-full px-3 py-1 rounded-md text-sm border border-border bg-background text-foreground"
                autoFocus
              />
            ) : (
              <button
                type="button"
                className="text-left w-full text-sm leading-relaxed hover:bg-muted/40 rounded-md px-2 py-1 break-words"
                onClick={(e) => {
                  e.stopPropagation();
                  beginLineEdit();
                }}
              >
                {line.text || (
                  <span className="text-muted-foreground">(empty)</span>
                )}
              </button>
            )}
          </div>
        ))}

      {/* Source text block */}
      {displayMode !== 'words' &&
        (() => {
          const sourceKey = sourceLanguageCode || sourceLanguageName || '';
          const showSource =
            typeof window === 'undefined' ||
            (window as any).__visibleLangs?.[sourceKey] !== false;
          if (!showSource) return null;
          const label = sourceLanguageName || 'Source';
          return (
            <LanguageBlock
              label={label}
              text={line.text}
              onCommit={(txt) => onEditLineText && onEditLineText(line.id, txt)}
              dataKey={`${line.id}-src`}
            />
          );
        })()}

      {/* Pending translation placeholders */}
      {line.pending &&
        Object.keys(line.pending).map((lang) =>
          typeof window !== 'undefined' &&
          (window as any).__visibleLangs?.[lang] === false ? null : (
            <div key={`${line.id}-pending-${lang}`} className="mt-2">
              <div className="text-[11px] text-muted-foreground font-medium mb-1">
                {(typeof window !== 'undefined' &&
                  (window as any).__transLangNames?.[lang]) ||
                  lang}
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-md px-2 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Translating…</span>
                  <span className="inline-block h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              </div>
            </div>
          )
        )}

      {/* Existing translations */}
      {line.translations &&
        displayMode !== 'words' &&
        Object.entries(line.translations).map(([lang, txt]) => {
          const visible =
            typeof window === 'undefined' ||
            (window as any).__visibleLangs?.[lang] !== false;
          if (!visible) return null;
          const label =
            (typeof window !== 'undefined' &&
              (window as any).__transLangNames?.[lang]) ||
            lang;
          const reKey = `${line.id}:${lang}`;
          return (
            <LanguageBlock
              key={`${line.id}-${lang}`}
              label={label}
              text={txt}
              onCommit={(val) =>
                onApplyTranslationText &&
                onApplyTranslationText(line.id, lang, val)
              }
              dataKey={`${line.id}-${lang}`}
              onRetranslate={
                onRetranslateLine
                  ? () => onRetranslateLine(line.id, lang)
                  : undefined
              }
              retranslating={
                retranslateInFlight ? !!retranslateInFlight[reKey] : false
              }
            />
          );
        })}
    </div>
  );
};

export default TranscriptionLine;
