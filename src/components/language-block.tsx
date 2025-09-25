'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCcw } from 'lucide-react';

export interface LanguageBlockProps {
  label: string;
  text: string;
  onCommit?: (newText: string) => void;
  dataKey?: string;
  onRetranslate?: () => void;
  retranslating?: boolean;
}

const LanguageBlock: React.FC<LanguageBlockProps> = ({
  label,
  text,
  onCommit,
  dataKey,
  onRetranslate,
  retranslating,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(text);

  useEffect(() => {
    setValue(text);
  }, [text]);

  const commit = () => {
    const next = value.trim();
    if (onCommit) onCommit(next);
    setIsEditing(false);
  };

  return (
    <div data-key={dataKey} className="mt-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] text-muted-foreground font-medium">
          {label}
        </div>
        {onRetranslate && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={!!retranslating}
            onClick={(e) => {
              e.stopPropagation();
              onRetranslate();
            }}
            title="Retranslate line"
            aria-label="Retranslate line"
          >
            <RefreshCcw
              className={'h-3 w-3 ' + (retranslating ? 'animate-spin' : '')}
            />
          </Button>
        )}
      </div>
      {onCommit ? (
        isEditing ? (
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="w-full min-h-[36px] px-2 py-1 rounded-md text-sm border border-border bg-background text-foreground whitespace-pre-wrap"
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="text-left w-full text-sm leading-relaxed hover:bg-muted/40 rounded-md px-2 py-1 whitespace-pre-wrap break-words"
            onClick={() => setIsEditing(true)}
          >
            {text || <span className="text-muted-foreground">(empty)</span>}
          </button>
        )
      ) : (
        <div className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-md px-2 py-1 break-words">
          {text}
        </div>
      )}
    </div>
  );
};

export default LanguageBlock;
