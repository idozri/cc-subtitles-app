'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Check, X, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableDescriptionProps {
  description?: string;
  onSave: (newDescription: string) => Promise<void>;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

export function EditableDescription({
  description = '',
  onSave,
  className,
  placeholder = 'Add a short description…',
  maxLength = 500,
}: EditableDescriptionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setEditValue(description || ''), [description]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
        setEditValue(description || '');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isEditing, description]);

  const handleSave = async () => {
    const next = editValue.trim();
    if (next === (description || '')) {
      setIsEditing(false);
      return;
    }
    try {
      setIsSaving(true);
      await onSave(next);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      setEditValue(description || '');
    }
  };

  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={cn('flex items-start gap-2', className)}
      >
        <Textarea
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={isSaving}
          className="min-h-[80px]"
        />
        <div className="flex items-center gap-1 pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving}
            className="h-8 w-8 p-0"
            title="Save description"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsEditing(false);
              setEditValue(description || '');
            }}
            disabled={isSaving}
            className="h-8 w-8 p-0"
            title="Cancel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group flex items-start justify-between gap-2 cursor-pointer hover:text-primary transition-colors',
        className
      )}
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      <h2 className="text-muted-foreground text-sm max-w-2xl whitespace-pre-line ">
        {description || placeholder}
      </h2>
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        onClick={() => setIsEditing(true)}
        title="Edit description"
      >
        <Edit3 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default EditableDescription;
