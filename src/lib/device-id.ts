/**
 * Device identification utility
 * Generates a unique device identifier based on browser fingerprinting
 */

const DEVICE_ID_KEY = 'cc-subtitles-device-id';

/**
 * Generate a device ID based on browser characteristics
 * This creates a reasonably unique identifier for the current device/browser
 */
function generateDeviceId(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('Device fingerprint', 2, 2);
  }

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
    navigator.hardwareConcurrency || 0,
    (navigator as any).deviceMemory || 0,
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Get or create a device ID for this browser/device
 * The ID is stored in localStorage and persists across sessions
 */
export function getDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    // Fallback if localStorage is not available
    console.warn(
      'Could not access localStorage for device ID, using session-based ID'
    );
    return generateDeviceId();
  }
}

/**
 * Get current user agent string
 */
export function getUserAgent(): string {
  return navigator.userAgent;
}
