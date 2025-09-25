'use client';

import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import FontPickerModal from '@/components/font-picker-modal';
import { ColorPicker } from './color-picker';

interface SettingsContentProps {
  color1: string;
  setColor1: (color: string) => void;
  color2: string;
  setColor2: (color: string) => void;
  fontFamily?: string;
  setFontFamily?: (font: string) => void;
  subtitleScale?: number;
  setSubtitleScale?: (scale: number) => void;
  subtitlePosition?: 'top' | 'middle' | 'bottom';
  setSubtitlePosition?: (pos: 'top' | 'middle' | 'bottom') => void;
  subtitleBackground?: 'none' | 'black' | 'white';
  setSubtitleBackground?: (bg: 'none' | 'black' | 'white') => void;
  subtitleOutline?: 'none' | 'thin' | 'medium' | 'thick' | string;
  setSubtitleOutline?: (outline: 'none' | 'thin' | 'medium' | 'thick') => void;
}

export const SettingsContent = ({
  color1,
  setColor1,
  color2,
  setColor2,
  fontFamily,
  setFontFamily,
  subtitleScale = 1,
  setSubtitleScale,
  subtitlePosition = 'bottom',
  setSubtitlePosition,
  subtitleBackground = 'none',
  setSubtitleBackground,
  subtitleOutline = 'none',
  setSubtitleOutline,
}: SettingsContentProps) => {
  const [color1Open, setColor1Open] = useState(false);
  const [color2Open, setColor2Open] = useState(false);
  const [fontModalOpen, setFontModalOpen] = useState(false);
  return (
    <div className="space-y-6 text-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <ColorPicker
          value={color1}
          onChange={setColor1}
          label="Color 1"
          isOpen={color1Open}
          setIsOpen={setColor1Open}
        />
        <ColorPicker
          value={color2}
          onChange={setColor2}
          label="Color 2"
          isOpen={color2Open}
          setIsOpen={setColor2Open}
        />
      </div>
      <div className="space-y-3">
        <label className="block text-muted-foreground text-sm font-medium">
          Font
        </label>
        <button
          type="button"
          className="h-12 w-full rounded-lg border-2 border-border flex items-center justify-between px-4 bg-background hover:border-primary transition-colors duration-200"
          onClick={() => setFontModalOpen(true)}
        >
          <span
            className="text-foreground font-medium truncate text-left"
            style={{
              fontFamily: fontFamily
                ? `'${fontFamily}', system-ui, sans-serif`
                : undefined,
            }}
          >
            {fontFamily || 'Select font'}
          </span>
          <span className="text-xs text-muted-foreground">Change</span>
        </button>
        <FontPickerModal
          open={fontModalOpen}
          onOpenChange={setFontModalOpen}
          currentFont={fontFamily}
          onSelect={(f) => setFontFamily && setFontFamily(f)}
        />
      </div>

      <div className="flex justify-between items-center">
        <label className="block text-muted-foreground text-sm font-medium">
          Size
        </label>
        <RadioGroup
          className="grid grid-cols-4 gap-2"
          value={String(subtitleScale)}
          onValueChange={(v) => setSubtitleScale && setSubtitleScale(Number(v))}
        >
          <div className="flex items-center space-x-2 border rounded-md p-2">
            <RadioGroupItem value="0.75" id="size-075" />
            <Label htmlFor="size-075" className="cursor-pointer text-xs">
              0.75x
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-2">
            <RadioGroupItem value="1" id="size-1" />
            <Label htmlFor="size-1" className="cursor-pointer text-xs">
              1x
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-2">
            <RadioGroupItem value="1.5" id="size-15" />
            <Label htmlFor="size-15" className="cursor-pointer text-xs">
              1.5x
            </Label>
          </div>
          <div className="flex items-center space-x-2 border rounded-md p-2">
            <RadioGroupItem value="2" id="size-2" />
            <Label htmlFor="size-2" className="cursor-pointer text-xs">
              2x
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex justify-between items-center">
        <label className="block text-muted-foreground text-sm font-medium">
          Position
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={subtitlePosition === 'top'}
            onClick={() => setSubtitlePosition && setSubtitlePosition('top')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitlePosition === 'top'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Top"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute left-1 right-1 top-1 h-1.5 rounded-sm bg-white/80" />
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitlePosition === 'middle'}
            onClick={() => setSubtitlePosition && setSubtitlePosition('middle')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitlePosition === 'middle'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Middle"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-1.5 rounded-sm bg-white/80" />
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitlePosition === 'bottom'}
            onClick={() => setSubtitlePosition && setSubtitlePosition('bottom')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitlePosition === 'bottom'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Bottom"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute left-1 right-1 bottom-1 h-1.5 rounded-sm bg-white/80" />
            </div>
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <label className="block text-muted-foreground text-sm font-medium">
          Background
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-pressed={subtitleBackground === 'none'}
            onClick={() =>
              setSubtitleBackground && setSubtitleBackground('none')
            }
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleBackground === 'none'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="No Background"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-4 border border-white/70/50 rounded-sm">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-4 h-0.5 bg-white/70/50 transform rotate-45" />
                  </div>
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitleBackground === 'black'}
            onClick={() =>
              setSubtitleBackground && setSubtitleBackground('black')
            }
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleBackground === 'black'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Black Background"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-4 bg-gray-600 rounded-xs" />
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitleBackground === 'white'}
            onClick={() =>
              setSubtitleBackground && setSubtitleBackground('white')
            }
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleBackground === 'white'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="White Background"
          >
            <div className="relative w-10 h-7 rounded-sm border border-white/70/50">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-4 bg-white rounded-xs" />
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <label className="block text-muted-foreground text-sm font-medium">
          Outline
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={subtitleOutline === 'none'}
            onClick={() => setSubtitleOutline && setSubtitleOutline('none')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleOutline === 'none'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="No Outline"
          >
            <div className="relative w-8 h-6 flex items-center justify-center">
              <span className="text-white text-sm font-bold">A</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-0.5 bg-gray-400" />
              </div>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitleOutline === 'thin'}
            onClick={() => setSubtitleOutline && setSubtitleOutline('thin')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleOutline === 'thin'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Thin Outline"
          >
            <div className="relative w-8 h-6 flex items-center justify-center">
              <span
                className="text-white text-sm font-bold"
                style={{
                  textShadow:
                    '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000',
                }}
              >
                A
              </span>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitleOutline === 'medium'}
            onClick={() => setSubtitleOutline && setSubtitleOutline('medium')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleOutline === 'medium'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Medium Outline"
          >
            <div className="relative w-8 h-6 flex items-center justify-center">
              <span
                className="text-white text-sm font-bold"
                style={{
                  textShadow:
                    '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000',
                }}
              >
                A
              </span>
            </div>
          </button>
          <button
            type="button"
            aria-pressed={subtitleOutline === 'thick'}
            onClick={() => setSubtitleOutline && setSubtitleOutline('thick')}
            className={cn(
              'rounded-md p-1 border transition-colors',
              subtitleOutline === 'thick'
                ? 'border-primary ring-2 ring-ring'
                : 'border-border hover:border-primary'
            )}
            title="Thick Outline"
          >
            <div className="relative w-8 h-6 flex items-center justify-center">
              <span
                className="text-white text-sm font-bold"
                style={{
                  textShadow:
                    '1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000, 0 -1px 0 #000, 1px 0 0 #000, -1px 0 0 #000, 1px 2px 0 #000, -1px -2px 0 #000, 2px 1px 0 #000, -2px -1px 0 #000',
                }}
              >
                A
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
