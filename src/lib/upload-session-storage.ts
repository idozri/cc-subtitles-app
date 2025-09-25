import { UploadSession } from '@/types/upload';

export class UploadSessionStorage {
  private dbName = 'cc-subtitles-upload-sessions';
  private dbVersion = 1;
  private storeName = 'upload-sessions';
  private db: IDBDatabase | null = null;

  /**
   * Initialize IndexedDB
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'uploadId',
          });

          // Create indexes for efficient queries
          store.createIndex('projectId', 'projectId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('lastActivity', 'lastActivity', { unique: false });
        }
      };
    });
  }

  /**
   * Save upload session
   */
  async saveSession(session: UploadSession): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      // Convert Date objects to ISO strings for storage
      const sessionData = {
        ...session,
        startedAt: session.startedAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
      };

      const request = store.put(sessionData);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get upload session by upload ID
   */
  async getSession(uploadId: string): Promise<UploadSession | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(uploadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          // Convert ISO strings back to Date objects
          const session = {
            ...request.result,
            startedAt: new Date(request.result.startedAt),
            lastActivity: new Date(request.result.lastActivity),
          };
          resolve(session);
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Get upload session by project ID
   */
  async getSessionByProjectId(
    projectId: string
  ): Promise<UploadSession | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('projectId');
      const request = index.get(projectId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result) {
          // Convert ISO strings back to Date objects
          const session = {
            ...request.result,
            startedAt: new Date(request.result.startedAt),
            lastActivity: new Date(request.result.lastActivity),
          };
          resolve(session);
        } else {
          resolve(null);
        }
      };
    });
  }

  /**
   * Update upload session
   */
  async updateSession(session: UploadSession): Promise<void> {
    return this.saveSession(session);
  }

  /**
   * Delete upload session
   */
  async deleteSession(uploadId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(uploadId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get all active upload sessions
   */
  async getActiveSessions(): Promise<UploadSession[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sessions = request.result.map((session: any) => ({
          ...session,
          startedAt: new Date(session.startedAt),
          lastActivity: new Date(session.lastActivity),
        }));
        resolve(sessions);
      };
    });
  }

  /**
   * Get upload sessions by status
   */
  async getSessionsByStatus(
    status: UploadSession['status']
  ): Promise<UploadSession[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll(status);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sessions = request.result.map((session: any) => ({
          ...session,
          startedAt: new Date(session.startedAt),
          lastActivity: new Date(session.lastActivity),
        }));
        resolve(sessions);
      };
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(
    maxAge: number = 24 * 60 * 60 * 1000
  ): Promise<void> {
    const sessions = await this.getActiveSessions();
    const now = Date.now();

    for (const session of sessions) {
      if (now - session.lastActivity.getTime() > maxAge) {
        await this.deleteSession(session.uploadId);
      }
    }
  }

  /**
   * Clear all sessions (useful for testing or reset)
   */
  async clearAllSessions(): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Get database size information
   */
  async getDatabaseInfo(): Promise<{
    totalSessions: number;
    totalSize: number;
  }> {
    const sessions = await this.getActiveSessions();
    const totalSize = sessions.reduce(
      (sum, session) => sum + session.fileSize,
      0
    );

    return {
      totalSessions: sessions.length,
      totalSize,
    };
  }
}
