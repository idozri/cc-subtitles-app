'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { POPULAR_FONTS } from '@/lib/fonts';
import { useFontsStore } from '@/lib/store/fonts';

interface GoogleFont {
  family: string;
  category: string;
  variants: string[];
  files: Record<string, string>;
}

interface FontPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (fontFamily: string) => void;
  currentFont?: string;
}

const loadFontFace = (family: string, url: string) => {
  const id = `gf-${family.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return; // already loaded
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
};

const googleCssUrl = (family: string) =>
  `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family
  )}:wght@400;500;600;700&display=swap`;

export const FontPickerModal: React.FC<FontPickerModalProps> = ({
  open,
  onOpenChange,
  onSelect,
  currentFont,
}) => {
  const [fonts, setFonts] = useState<GoogleFont[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recent = useFontsStore((s) => s.recent);
  const addRecent = useFontsStore((s) => s.addRecent);
  const clearRecent = useFontsStore((s) => s.clearRecent);
  // Debounced search that fetches from API only when querying
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setFonts([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/google-fonts?q=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error('Failed fetching fonts');
        const data = await res.json();
        setFonts(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setError('Could not load fonts');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [open, query]);

  useEffect(() => {
    if (currentFont) {
      loadFontFace(currentFont, googleCssUrl(currentFont));
    }
  }, [currentFont]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return fonts
      .filter((f) => f.family.toLowerCase().includes(q))
      .slice(0, 200);
  }, [fonts, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select a font</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Search fonts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {!query && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Popular</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {POPULAR_FONTS.map((f) => (
                    <button
                      key={f.family}
                      type="button"
                      className="border rounded-md p-3 text-left hover:bg-muted/50"
                      onClick={() => {
                        addRecent(f.family);
                        onSelect(f.family);
                        onOpenChange(false);
                      }}
                    >
                      <div className="text-sm font-medium truncate">
                        {f.family}
                      </div>
                      <div
                        className={`text-xs text-muted-foreground truncate ${f.className}`}
                      >
                        The quick brown fox jumps over the lazy dog
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {recent.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Recent</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recent.map((family) => (
                      <button
                        key={family}
                        type="button"
                        className="border rounded-md p-3 text-left hover:bg-muted/50"
                        onClick={() => {
                          addRecent(family);
                          onSelect(family);
                          onOpenChange(false);
                        }}
                      >
                        <div className="text-sm font-medium truncate">
                          {family}
                        </div>
                        <div
                          className="text-xs text-muted-foreground truncate"
                          style={{
                            fontFamily: `'${family}', system-ui, sans-serif`,
                          }}
                        >
                          The quick brown fox jumps over the lazy dog
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {loading && (
            <div className="text-sm text-muted-foreground">Loading fonts…</div>
          )}
          {error && <div className="text-sm text-destructive">{error}</div>}

          {!loading && !error && query && (
            <ScrollArea className="h-80 pr-3">
              <div className="space-y-2">
                {filtered.map((f) => (
                  <div
                    key={f.family}
                    className="flex items-center justify-between border rounded-md p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {f.family}
                      </div>
                      <div
                        className="text-xs text-muted-foreground truncate"
                        style={{
                          fontFamily: `'${f.family}', system-ui, sans-serif`,
                        }}
                        onMouseEnter={() =>
                          loadFontFace(f.family, googleCssUrl(f.family))
                        }
                      >
                        The quick brown fox jumps over the lazy dog
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        addRecent(f.family);
                        loadFontFace(f.family, googleCssUrl(f.family));
                        onSelect(f.family);
                        onOpenChange(false);
                      }}
                    >
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FontPickerModal;
