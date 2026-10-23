// IndexedDB Crash-Resilience Vault for Counselling Meeting Recordings
// Protects long 1-2 hour meetings from accidental tab closures, power cuts, or browser crashes.

const DB_NAME = "counselling_audio_resilience_db";
const DB_VERSION = 1;
const STORE_NAME = "active_meeting_recovery";

export interface RecoveredMeetingSession {
  recoveryKey: string;
  enquiryNo?: string;
  studentName?: string;
  counsellorName?: string;
  selectedLanguage?: string;
  durationSeconds: number;
  liveSpeechTranscript: string;
  audioBlob: Blob;
  mimeType: string;
  timestamp: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB is not available in this environment"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "recoveryKey" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Periodically save a recovery snapshot of the in-progress audio meeting
 */
export async function saveMeetingRecoverySnapshot(data: RecoveredMeetingSession): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[RecoveryVault] Snapshot error:", err);
  }
}

/**
 * Check if there is an unfinalized/interrupted meeting recording
 */
export async function getActiveMeetingRecovery(): Promise<RecoveredMeetingSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as RecoveredMeetingSession[];
        if (results && results.length > 0) {
          // Sort by latest timestamp
          results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(results[0]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[RecoveryVault] Get active recovery error:", err);
    return null;
  }
}

/**
 * Clear the recovery snapshot after a successful upload/save
 */
export async function clearMeetingRecovery(recoveryKey?: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      if (recoveryKey) {
        store.delete(recoveryKey);
      } else {
        store.clear();
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[RecoveryVault] Clear recovery error:", err);
  }
}
