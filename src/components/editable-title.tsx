'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Edit3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditableTitleProps {
  title: string;
  onSave: (newTitle: string) => Promise<void>;
  className?: string;
  placeholder?: string;
  maxLength?: number;
}

export function EditableTitle({
  title,
  onSave,
  className,
  placeholder = 'Enter title...',
  maxLength = 100,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update edit value when title prop changes
  useEffect(() => {
    setEditValue(title);
  }, [title]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setEditValue(title);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditValue(title);
    setIsEditing(false);
  };

  const handleSave = async () => {
    const trimmedValue = editValue.trim();

    if (trimmedValue === title) {
      setIsEditing(false);
      return;
    }

    if (!trimmedValue) {
      return;
    }

    try {
      setIsSaving(true);
      await onSave(trimmedValue);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save title:', error);
      // Keep editing mode open on error
    } finally {
      setIsSaving(false);
    }
  };

  // Exit edit mode when clicking outside
  useEffect(() => {
    if (!isEditing) return;
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSaving}
          className="text-2xl font-bold h-auto py-2 px-3"
        />
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleSave}
            disabled={isSaving || !editValue.trim()}
            className="h-8 w-8 p-0"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'group flex items-center justify-between gap-2 cursor-pointer hover:text-primary transition-colors',
        className
      )}
      onClick={handleStartEdit}
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      <Button
        size="sm"
        variant="ghost"
        onClick={handleStartEdit}
        className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
        title="Edit title"
      >
        <Edit3 className="h-4 w-4" />
      </Button>
    </div>
  );
}
