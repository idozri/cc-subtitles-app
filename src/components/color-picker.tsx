'use client';

import { useState, useEffect, useRef } from 'react';

// Helper function to convert hex to RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
};

// Helper function to convert RGB to hex
const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

// Helper: RGB -> HSV (h: 0-360, s: 0-100, v: 0-100)
const rgbToHsv = (r: number, g: number, b: number) => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h *= 60;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
};

// Helper: HSV -> RGB
const hsvToRgb = (h: number, s: number, v: number) => {
  const hh = (h % 360) / 60;
  const c = (v / 100) * (s / 100);
  const x = c * (1 - Math.abs(((hh % 2) as number) - 1));
  const m = v / 100 - c;

  let r = 0,
    g = 0,
    b = 0;
  if (0 <= hh && hh < 1) {
    r = c;
    g = x;
    b = 0;
  } else if (1 <= hh && hh < 2) {
    r = x;
    g = c;
    b = 0;
  } else if (2 <= hh && hh < 3) {
    r = 0;
    g = c;
    b = x;
  } else if (3 <= hh && hh < 4) {
    r = 0;
    g = x;
    b = c;
  } else if (4 <= hh && hh < 5) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};

// Normalize various HEX inputs to #RRGGBB or return null if invalid
const normalizeHexInput = (input: string): string | null => {
  const raw = input.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(raw)) return `#${raw}`;
  if (/^[0-9A-F]{3}$/.test(raw)) {
    const r = raw[0];
    const g = raw[1];
    const b = raw[2];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
};

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

export const ColorPicker = ({
  value,
  onChange,
  label,
  isOpen,
  setIsOpen,
}: ColorPickerProps) => {
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100); // 0-100
  const [brightness, setBrightness] = useState(100); // HSV Value 0-100
  const [rgb, setRgb] = useState(hexToRgb(value));
  const [isDragging, setIsDragging] = useState(false);
  const [hexInput, setHexInput] = useState<string>(value.toUpperCase());
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync internal HSV state when external hex value changes
  useEffect(() => {
    const { r, g, b } = hexToRgb(value);
    setRgb({ r, g, b });
    setHexInput(value.toUpperCase());

    const { h, s, v } = rgbToHsv(r, g, b);
    setHue(h);
    setSaturation(s);
    setBrightness(v);
  }, [value]);

  const handleColorChange = (
    newHue: number,
    newSaturation: number,
    newBrightness: number
  ) => {
    setHue(newHue);
    setSaturation(newSaturation);
    setBrightness(newBrightness);

    const newRgb = hsvToRgb(newHue, newSaturation, newBrightness);

    setRgb(newRgb);
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newSaturation = Math.max(
      0,
      Math.min(100, Math.round((x / rect.width) * 100))
    );
    const newBrightness = Math.max(
      0,
      Math.min(100, Math.round(100 - (y / rect.height) * 100))
    );
    handleColorChange(hue, newSaturation, newBrightness);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newSaturation = Math.max(
      0,
      Math.min(100, Math.round((x / rect.width) * 100))
    );
    const newBrightness = Math.max(
      0,
      Math.min(100, Math.round(100 - (y / rect.height) * 100))
    );
    handleColorChange(hue, newSaturation, newBrightness);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global mouse events when dragging
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        const colorArea = document.querySelector('.color-area') as HTMLElement;
        if (colorArea) {
          const rect = colorArea.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const newSaturation = Math.max(
            0,
            Math.min(100, Math.round((x / rect.width) * 100))
          );
          const newBrightness = Math.max(
            0,
            Math.min(100, Math.round(100 - (y / rect.height) * 100))
          );
          handleColorChange(hue, newSaturation, newBrightness);
        }
      };

      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };

      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, hue]);

  const handleRgbChange = (newRgb: { r: number; g: number; b: number }) => {
    setRgb(newRgb);
    onChange(rgbToHex(newRgb.r, newRgb.g, newRgb.b));
  };

  return (
    <div className="space-y-3">
      <label className="block text-muted-foreground text-sm font-medium">
        {label}
      </label>

      {/* Color preview button */}
      <div
        className="relative group cursor-pointer"
        onClick={() => setIsOpen(true)}
      >
        {/* Color preview with beautiful styling */}
        <div
          className="h-12 w-full rounded-lg border-2 border-border cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-md hover:shadow-primary/20 group-hover:scale-[1.02]"
          style={{
            backgroundColor: value,
            backgroundSize:
              value === '#FFFFFF' || value === '#ffffff' ? '8px 8px' : 'auto',
            backgroundPosition:
              value === '#FFFFFF' || value === '#ffffff'
                ? '0 0, 0 4px, 4px -4px, -4px 0px'
                : 'auto',
          }}
        >
          {/* Inner shadow for depth */}
          <div className="absolute inset-0 rounded-lg shadow-inner opacity-20" />

          {/* Color value display */}
          <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {value.toUpperCase()}
          </div>
        </div>

        {/* Click indicator */}
        <div className="absolute top-1 left-1 w-2 h-2 bg-white/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {/* Custom Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div
            ref={popoverRef}
            className="relative bg-background border border-border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4"
          >
            <div className="space-y-4">
              {/* Close button */}
              <div className="flex justify-end">
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ✕
                </button>
              </div>
              {/* Color wheel area */}
              <div className="relative">
                <div
                  className="color-area w-full h-48 border border-border relative overflow-hidden cursor-crosshair select-none"
                  style={{
                    // HSV-like square: saturation (x), value (y)
                    background: `linear-gradient(to top, black, transparent), linear-gradient(to right, white, hsl(${hue}, 100%, 50%))`,
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {/* Color picker cursor */}
                  <div
                    className="absolute w-3 h-3 border-2 border-white rounded-full shadow-lg transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{
                      left: `${saturation}%`,
                      top: `${100 - brightness}%`,
                      backgroundColor: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`,
                    }}
                  />
                </div>
              </div>

              {/* Hue slider */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Hue</label>
                <div className="relative h-6 rounded border border-border overflow-hidden">
                  <div
                    className="w-full h-full"
                    style={{
                      background:
                        'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                    }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={hue}
                    onChange={(e) =>
                      handleColorChange(
                        parseInt(e.target.value),
                        saturation,
                        brightness
                      )
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div
                    className="absolute top-0 w-1 h-full bg-white border border-gray-400 transform -translate-x-1/2"
                    style={{ left: `${(hue / 360) * 100}%` }}
                  />
                </div>
              </div>

              {/* RGB inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">R</label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.r}
                    onChange={(e) =>
                      handleRgbChange({
                        ...rgb,
                        r: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">G</label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.g}
                    onChange={(e) =>
                      handleRgbChange({
                        ...rgb,
                        g: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">B</label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={rgb.b}
                    onChange={(e) =>
                      handleRgbChange({
                        ...rgb,
                        b: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full h-8 px-2 text-sm border border-border rounded bg-background"
                  />
                </div>
              </div>

              {/* Hex input */}
              <div>
                <label className="text-xs text-muted-foreground">HEX</label>
                <input
                  type="text"
                  value={hexInput}
                  onChange={(e) => {
                    setHexInput(e.target.value.toUpperCase());
                  }}
                  onBlur={() => {
                    const normalized = normalizeHexInput(hexInput);
                    if (normalized) onChange(normalized);
                    else setHexInput(value.toUpperCase());
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const normalized = normalizeHexInput(hexInput);
                      if (normalized) onChange(normalized);
                      else setHexInput(value.toUpperCase());
                    }
                  }}
                  className="w-full h-8 px-2 text-sm border border-border rounded bg-background font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
