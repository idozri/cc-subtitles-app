'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TranscriptionLineData {
  id: number;
  start: number;
  end: number;
  text: string;
  words: Array<{ word: string; start: number; end: number }>;
  translations?: Record<string, string>;
  pending?: Record<string, boolean>;
}

interface InlineTranscriptionEditorProps {
  currentTime: number;
  lines: TranscriptionLineData[];
  onEditLine: (id: number, newText: string) => void;
  onAddLine: (start: number, end: number, text: string) => void;
  onExitEditing: () => void;
  sourceLanguageCode?: string;
}

const InlineTranscriptionEditor: React.FC<InlineTranscriptionEditorProps> = ({
  currentTime,
  lines,
  onEditLine,
  onAddLine,
  onExitEditing,
  sourceLanguageCode,
}) => {
  const [editingText, setEditingText] = useState('');
  const [isAddingNewLine, setIsAddingNewLine] = useState(false);
  const [newLineText, setNewLineText] = useState('');
  const [newLineStart, setNewLineStart] = useState(0);
  const [newLineEnd, setNewLineEnd] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasInitializedRef = useRef(false);

  // Find the active line at current time
  const activeLine = useMemo(() => {
    return lines.find(
      (line) => currentTime >= line.start && currentTime <= line.end
    );
  }, [lines, currentTime]);

  // Find gaps where we can add new lines - memoized to prevent unnecessary recalculations
  const gap = useMemo(() => {
    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];
      const gapDuration = nextLine.start - currentLine.end;

      if (
        gapDuration >= 1 &&
        currentTime >= currentLine.end &&
        currentTime <= nextLine.start
      ) {
        return {
          start: currentLine.end,
          end: nextLine.start,
          gapDuration: gapDuration,
        };
      }
    }

    // Check if we can add at the beginning
    if (
      lines.length > 0 &&
      lines[0].start >= 1 &&
      currentTime <= lines[0].start
    ) {
      return {
        start: 0,
        end: lines[0].start,
        gapDuration: lines[0].start,
      };
    }

    return null;
  }, [lines, currentTime]);

  useEffect(() => {
    // Only initialize once when the component first mounts
    if (!hasInitializedRef.current) {
      if (activeLine) {
        setEditingText(activeLine.text);
        setIsAddingNewLine(false);
      } else if (gap) {
        setIsAddingNewLine(true);
        setNewLineText('');
        setNewLineStart(gap.start);
        setNewLineEnd(gap.end);
      } else {
        setIsAddingNewLine(false);
        setEditingText('');
      }
      hasInitializedRef.current = true;
    }
  }, []); // Empty dependency array - only run once on mount

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [activeLine, isAddingNewLine]);

  const handleSave = () => {
    if (activeLine && editingText.trim()) {
      onEditLine(activeLine.id, editingText.trim());
    } else if (isAddingNewLine && newLineText.trim()) {
      onAddLine(newLineStart, newLineEnd, newLineText.trim());
    }
    onExitEditing();
  };

  const handleCancel = () => {
    onExitEditing();
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {activeLine ? 'Edit Transcription Line' : 'Add New Line'}
              </h3>
              <div className="text-sm text-muted-foreground">
                Time: {formatTime(currentTime)}
              </div>
            </div>

            {activeLine ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div>
                    Duration: {formatTime(activeLine.start)} -{' '}
                    {formatTime(activeLine.end)}
                  </div>
                  <div>
                    Gap: {(activeLine.end - activeLine.start).toFixed(1)}s
                  </div>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={editingText}
                  onChange={(e) => setEditingText(e.target.value)}
                  placeholder="Enter transcription text..."
                  className="min-h-[100px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSave();
                    } else if (e.key === 'Escape') {
                      handleCancel();
                    }
                  }}
                />
              </div>
            ) : gap ? (
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <div>
                    Gap: {formatTime(gap.start)} - {formatTime(gap.end)}
                  </div>
                  <div>Duration: {gap.gapDuration.toFixed(1)}s</div>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={newLineText}
                  onChange={(e) => setNewLineText(e.target.value)}
                  placeholder="Enter new transcription text..."
                  className="min-h-[100px] resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSave();
                    } else if (e.key === 'Escape') {
                      handleCancel();
                    }
                  }}
                />
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transcription line or gap found at this time.</p>
                <p className="text-sm">
                  Click on a different part of the video.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              {(activeLine || gap) && (
                <Button
                  onClick={handleSave}
                  disabled={!editingText.trim() && !newLineText.trim()}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </Button>
              )}
            </div>

            <div className="text-xs text-muted-foreground">
              <p>Press Ctrl/Cmd + Enter to save, or Escape to cancel</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InlineTranscriptionEditor;
