/**
 * Tests for device ID utility
 */

import { getDeviceId, getUserAgent } from './device-id';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock document.createElement
const mockCanvas = {
  getContext: jest.fn(() => ({
    textBaseline: '',
    font: '',
    fillText: jest.fn(),
  })),
  toDataURL: jest.fn(() => 'data:image/png;base64,mock'),
};
Object.defineProperty(document, 'createElement', {
  value: jest.fn(() => mockCanvas),
});

// Mock navigator
Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  writable: true,
});

Object.defineProperty(navigator, 'language', {
  value: 'en-US',
  writable: true,
});

Object.defineProperty(navigator, 'hardwareConcurrency', {
  value: 8,
  writable: true,
});

Object.defineProperty(navigator, 'deviceMemory', {
  value: 8,
  writable: true,
});

// Mock screen
Object.defineProperty(screen, 'width', {
  value: 1920,
  writable: true,
});

Object.defineProperty(screen, 'height', {
  value: 1080,
  writable: true,
});

// Mock Date
const mockDate = new Date('2023-01-01T00:00:00Z');
jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

describe('Device ID Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDeviceId', () => {
    it('should return a device ID from localStorage if available', () => {
      const mockDeviceId = 'abc123def456';
      localStorageMock.getItem.mockReturnValue(mockDeviceId);

      const deviceId = getDeviceId();

      expect(deviceId).toBe(mockDeviceId);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(
        'cc-subtitles-device-id'
      );
    });

    it('should generate and store a new device ID if not in localStorage', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const deviceId = getDeviceId();

      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
      expect(deviceId.length).toBeGreaterThan(0);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cc-subtitles-device-id',
        deviceId
      );
    });

    it('should return a consistent device ID for the same browser fingerprint', () => {
      localStorageMock.getItem.mockReturnValue(null);

      const deviceId1 = getDeviceId();
      const deviceId2 = getDeviceId();

      expect(deviceId1).toBe(deviceId2);
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const deviceId = getDeviceId();

      expect(deviceId).toBeDefined();
      expect(typeof deviceId).toBe('string');
    });
  });

  describe('getUserAgent', () => {
    it('should return the current user agent string', () => {
      const userAgent = getUserAgent();

      expect(userAgent).toBe(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );
    });
  });
});
