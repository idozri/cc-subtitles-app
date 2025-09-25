// Singleton manager for the upload web worker so it persists across route changes
import type { UploadWorkerMessage, UploadWorkerResponse } from '@/types/upload';

type MessageListener = (message: UploadWorkerResponse) => void;

class UploadWorkerManager {
  private static instance: UploadWorkerManager | null = null;
  private worker: Worker | null = null;
  private listeners: Set<MessageListener> = new Set();

  static getInstance(): UploadWorkerManager {
    if (!UploadWorkerManager.instance) {
      UploadWorkerManager.instance = new UploadWorkerManager();
    }
    return UploadWorkerManager.instance;
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;

    // Use the JavaScript worker file for better Next.js compatibility
    this.worker = new Worker(
      new URL('./upload-worker.worker.js', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = (event: MessageEvent<UploadWorkerResponse>) => {
      for (const listener of this.listeners) {
        try {
          listener(event.data);
        } catch (error) {
          // Swallow listener errors to avoid breaking others
          console.error('UploadWorkerManager listener error:', error);
        }
      }
    };

    this.worker.onerror = (error: ErrorEvent) => {
      console.error('Upload worker runtime error:', error);
    };

    return this.worker;
  }

  addMessageListener(listener: MessageListener): () => void {
    this.listeners.add(listener);
    // Ensure worker is created when first listener subscribes
    this.ensureWorker();
    return () => {
      this.listeners.delete(listener);
    };
  }

  postMessage(message: UploadWorkerMessage): void {
    const worker = this.ensureWorker();
    worker.postMessage(message);
  }
}

export const uploadWorkerManager = UploadWorkerManager.getInstance();
