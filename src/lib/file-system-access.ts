'use client';

/**
 * File System Access API utilities for saving and retrieving video files locally
 * Note: File System Access API is only available in Chromium-based browsers (Chrome, Edge)
 * Files are also stored in IndexedDB for persistence across page refreshes
 */

const DB_NAME = 'cc-subtitles-fs-handles';
const DB_VERSION = 2; // Increment version to trigger upgrade
const STORE_NAME = 'file-handles';
const FILE_STORE_NAME = 'video-files'; // New store for actual file storage

interface FileHandleRecord {
  projectId: string;
  handle?: FileSystemFileHandle; // Optional - may not be available
  fileName: string;
  savedAt: number;
  fileSize: number;
}

interface FileRecord {
  projectId: string;
  file: File;
  fileName: string;
  mimeType: string;
  savedAt: number;
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showSaveFilePicker' in window &&
    'indexedDB' in window
  );
}

/**
 * Check if IndexedDB is supported
 */
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * Initialize IndexedDB database with both stores
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create file handles store (for File System Access API handles)
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'projectId' });
      }

      // Create video files store (for actual File objects)
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        const fileStore = db.createObjectStore(FILE_STORE_NAME, {
          keyPath: 'projectId',
        });
        // Add index for cleanup operations
        fileStore.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
  });
}

/**
 * Save video file directly to IndexedDB
 * This is the primary method for storing files - works across all browsers
 * @param file The file to save
 * @param projectId The project ID to associate with this file
 * @returns The project ID
 */
export async function saveFileToIndexedDB(
  file: File,
  projectId: string
): Promise<string> {
  if (!isIndexedDBSupported()) {
    throw new Error('IndexedDB is not supported in this browser');
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);

    const record: FileRecord = {
      projectId,
      file, // Store the File object directly - IndexedDB supports this
      fileName: file.name,
      mimeType: file.type,
      savedAt: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        // Handle quota exceeded error
        if (request.error?.name === 'QuotaExceededError') {
          reject(new Error('Storage quota exceeded. Please free up space.'));
        } else {
          reject(request.error);
        }
      };
    });

    console.log(
      `File saved to IndexedDB for project ${projectId}: ${file.name} (${(
        file.size /
        1024 /
        1024
      ).toFixed(2)} MB)`
    );
    return projectId;
  } catch (error: any) {
    console.error('Failed to save file to IndexedDB:', error);
    throw error;
  }
}

/**
 * Retrieve video file from IndexedDB and create object URL
 * @param projectId The project ID
 * @returns Object URL for the file, or null if not found
 */
export async function getFileUrlFromIndexedDB(
  projectId: string
): Promise<string | null> {
  if (!isIndexedDBSupported()) {
    return null;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);

    const record = await new Promise<FileRecord | null>((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (!record || !record.file) {
      return null;
    }

    // Create object URL from the stored File
    return URL.createObjectURL(record.file);
  } catch (error) {
    console.error('Failed to retrieve file from IndexedDB:', error);
    return null;
  }
}

/**
 * Get file from IndexedDB without creating URL
 * @param projectId The project ID
 * @returns File object or null if not found
 */
export async function getFileFromIndexedDB(
  projectId: string
): Promise<File | null> {
  if (!isIndexedDBSupported()) {
    return null;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);

    const record = await new Promise<FileRecord | null>((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    return record?.file || null;
  } catch (error) {
    console.error('Failed to retrieve file from IndexedDB:', error);
    return null;
  }
}

/**
 * Save a file using File System Access API (optional) and store in IndexedDB
 * @param file The file to save
 * @param projectId The project ID to associate with this file
 * @param suggestedName Optional suggested filename for File System Access API
 * @returns The project ID
 */
export async function saveFileWithFileSystemAccess(
  file: File,
  projectId: string,
  suggestedName?: string
): Promise<string> {
  // Always save to IndexedDB first (works in all browsers)
  await saveFileToIndexedDB(file, projectId);

  // Optionally save using File System Access API if supported
  if (isFileSystemAccessSupported()) {
    try {
      // Show save file picker
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: suggestedName || file.name,
        types: [
          {
            description: 'Video Files',
            accept: {
              'video/*': ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
            },
          },
        ],
      });

      // Write file to the selected location
      const writable = await fileHandle.createWritable();
      await writable.write(file);
      await writable.close();

      // Store handle in IndexedDB (optional - for future use)
      const db = await openDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: FileHandleRecord = {
        projectId,
        handle: fileHandle,
        fileName: file.name,
        savedAt: Date.now(),
        fileSize: file.size,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(record);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error: any) {
      // User cancelled the save dialog - this is OK, file is still in IndexedDB
      if (error.name === 'AbortError') {
        console.log(
          'File System Access API save cancelled, but file is stored in IndexedDB'
        );
      } else {
        console.warn(
          'File System Access API save failed, but file is stored in IndexedDB:',
          error
        );
      }
    }
  }

  return projectId;
}

/**
 * Retrieve a file handle from IndexedDB and create an object URL for playback
 * This now prioritizes IndexedDB file storage over File System Access API handles
 * @param projectId The project ID
 * @returns Object URL for the file, or null if not found
 */
export async function getFileUrlFromHandle(
  projectId: string
): Promise<string | null> {
  // First try to get file from IndexedDB (most reliable)
  const indexedDBUrl = await getFileUrlFromIndexedDB(projectId);
  if (indexedDBUrl) {
    return indexedDBUrl;
  }

  // Fallback to File System Access API handle if available
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const record = await new Promise<FileHandleRecord | null>(
      (resolve, reject) => {
        const request = store.get(projectId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }
    );

    if (!record || !record.handle) {
      return null;
    }

    // Read file from handle
    const file = await record.handle.getFile();
    return URL.createObjectURL(file);
  } catch (error) {
    console.error('Failed to retrieve file handle:', error);
    return null;
  }
}

/**
 * Check if a file exists in IndexedDB for a project
 * @param projectId The project ID
 * @returns True if file exists, false otherwise
 */
export async function hasFileInIndexedDB(projectId: string): Promise<boolean> {
  if (!isIndexedDBSupported()) {
    return false;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);

    const exists = await new Promise<boolean>((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });

    return exists;
  } catch (error) {
    console.error('Failed to check file in IndexedDB:', error);
    return false;
  }
}

/**
 * Delete a file from IndexedDB
 * @param projectId The project ID
 */
export async function deleteFileFromIndexedDB(
  projectId: string
): Promise<void> {
  if (!isIndexedDBSupported()) {
    return;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`File deleted from IndexedDB for project ${projectId}`);
  } catch (error) {
    console.error('Failed to delete file from IndexedDB:', error);
  }
}

/**
 * Clean up old files from IndexedDB (older than specified days)
 * @param olderThanDays Files older than this many days will be deleted
 * @returns Number of files deleted
 */
export async function cleanupOldFiles(
  olderThanDays: number = 30
): Promise<number> {
  if (!isIndexedDBSupported()) {
    return 0;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(FILE_STORE_NAME);
    const index = store.index('savedAt');

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffTime));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to cleanup old files:', error);
    return 0;
  }
}

/**
 * Get total size of all files in IndexedDB
 * @returns Total size in bytes
 */
export async function getTotalStorageSize(): Promise<number> {
  if (!isIndexedDBSupported()) {
    return 0;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([FILE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(FILE_STORE_NAME);

    let totalSize = 0;

    return new Promise((resolve, reject) => {
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const record = cursor.value as FileRecord;
          totalSize += record.file.size;
          cursor.continue();
        } else {
          resolve(totalSize);
        }
      };

      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to calculate storage size:', error);
    return 0;
  }
}

// Keep existing functions for backward compatibility
export async function updateFileHandleProjectId(
  oldProjectId: string,
  newProjectId: string
): Promise<void> {
  // Update both stores
  if (isIndexedDBSupported()) {
    try {
      const db = await openDB();

      // Update file store
      const fileTransaction = db.transaction([FILE_STORE_NAME], 'readwrite');
      const fileStore = fileTransaction.objectStore(FILE_STORE_NAME);
      const fileRecord = await new Promise<FileRecord | null>(
        (resolve, reject) => {
          const request = fileStore.get(oldProjectId);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        }
      );

      if (fileRecord) {
        fileRecord.projectId = newProjectId;
        await new Promise<void>((resolve, reject) => {
          const request = fileStore.delete(oldProjectId);
          request.onsuccess = () => {
            const putRequest = fileStore.put(fileRecord);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          };
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error('Failed to update file project ID:', error);
    }
  }

  // Update handle store (existing logic)
  if (!isFileSystemAccessSupported()) {
    return;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const oldRecord = await new Promise<FileHandleRecord | null>(
      (resolve, reject) => {
        const request = store.get(oldProjectId);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      }
    );

    if (!oldRecord) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(oldProjectId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    const newRecord: FileHandleRecord = {
      ...oldRecord,
      projectId: newProjectId,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(newRecord);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to update file handle project ID:', error);
    throw error;
  }
}

export async function hasFileHandle(projectId: string): Promise<boolean> {
  // Check IndexedDB first
  const hasFile = await hasFileInIndexedDB(projectId);
  if (hasFile) {
    return true;
  }

  // Fallback to handle check
  if (!isFileSystemAccessSupported()) {
    return false;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const exists = await new Promise<boolean>((resolve, reject) => {
      const request = store.get(projectId);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });

    return exists;
  } catch (error) {
    console.error('Failed to check file handle:', error);
    return false;
  }
}

export async function deleteFileHandle(projectId: string): Promise<void> {
  // Delete from both stores
  await deleteFileFromIndexedDB(projectId);

  if (!isFileSystemAccessSupported()) {
    return;
  }

  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(projectId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Failed to delete file handle:', error);
  }
}
