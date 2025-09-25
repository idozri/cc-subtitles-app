'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export interface PendingNewLine {
  start: number;
  end: number;
  insertIndex: number;
}

interface AddLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: PendingNewLine | null;
  onSubmit: (text: string) => void;
}

const AddLineDialog: React.FC<AddLineDialogProps> = ({
  open,
  onOpenChange,
  pending,
  onSubmit,
}) => {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add new subtitle line</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            placeholder="Type subtitle text..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-24"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => onSubmit(text)} disabled={!pending}>
              Add line
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddLineDialog;
