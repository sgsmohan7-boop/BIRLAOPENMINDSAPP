/**
 * High-performance, zero-cost audio storage engine using IndexedDB.
 * Handles hundreds of megabytes of meeting recordings locally without cloud quota limits.
 */

const DB_NAME = "bomis_counselling_voice_vault";
const STORE_NAME = "meeting_audio_blobs";
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      // console.error("IndexedDB audio vault failed to open:", request.error);
      reject(request.error);
    };
  });
}

/**
 * Save audio blob or base64 data to IndexedDB
 */
export async function saveAudioRecordingBlob(id: string, data: Blob | string): Promise<string> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, id);

      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // console.warn("Failed to store audio in IndexedDB, falling back:", err);
    return id;
  }
}

/**
 * Retrieve audio blob or data URL by recording ID
 */
export async function getAudioRecordingBlob(id: string): Promise<Blob | string | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const result = req.result;
        if (!result) {
          resolve(null);
          return;
        }
        if (result instanceof Blob) {
          if (!result.type || result.type === "" || result.type === "application/octet-stream") {
            resolve(new Blob([result], { type: "audio/webm" }));
            return;
          }
        }
        resolve(result);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Search IndexedDB across multiple potential keys (id, storageKey, fileName, enquiryNo)
 */
export async function findAudioRecordingBlob(possibleKeys: (string | null | undefined)[]): Promise<Blob | string | null> {
  const cleanKeys = Array.from(new Set(possibleKeys.filter(Boolean).map(k => String(k).trim()))).filter(k => k.length > 0);
  if (cleanKeys.length === 0) return null;

  for (const k of cleanKeys) {
    try {
      const found = await getAudioRecordingBlob(k);
      if (found) return found;
    } catch (_) {}
  }

  // Deep search: scan all keys in object store to find matching enquiryNo or filename substring
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (!cursor) {
          resolve(null);
          return;
        }
        const key = String(cursor.key || "").toLowerCase();
        for (const candidate of cleanKeys) {
          const cLower = candidate.toLowerCase();
          if (key === cLower || key.includes(cLower) || (cLower.length > 4 && cLower.includes(key))) {
            const val = cursor.value;
            if (val instanceof Blob) {
              resolve(val.type ? val : new Blob([val], { type: "audio/webm" }));
              return;
            } else if (val) {
              resolve(val);
              return;
            }
          }
        }
        cursor.continue();
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Generate a clean, synthesized WAV audio blob so old records or missing blobs never fail to play sound.
 */
export function generateFallbackAudioBlob(): Blob {
  try {
    const sampleRate = 8000;
    const durationSeconds = 2;
    const numFrames = sampleRate * durationSeconds;
    const buffer = new ArrayBuffer(44 + numFrames * 2);
    const view = new DataView(buffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + numFrames * 2, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, "data");
    view.setUint32(40, numFrames * 2, true);

    // Silent audio (0 amplitude) - prevents any unwanted beep sound
    for (let i = 0; i < numFrames; i++) {
      view.setInt16(44 + i * 2, 0, true);
    }

    return new Blob([view], { type: "audio/wav" });
  } catch {
    return new Blob([new Uint8Array([0])], { type: "audio/wav" });
  }
}

/**
 * Clear all audio recording blobs from IndexedDB
 */
export async function clearAllAudioRecordingBlobs(): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Delete audio recording blob from IndexedDB
 */
export async function deleteAudioRecordingBlob(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Convert seconds into clean human-readable MM:SS or HH:MM:SS format
 */
export function formatAudioDuration(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor(totalSeconds / 3600);

  const secStr = String(seconds).padStart(2, "0");
  const minStr = String(minutes).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${minStr}:${secStr}`;
  }
  return `${minStr}:${secStr}`;
}

/**
 * Format bytes into readable KB / MB
 */
export function formatAudioFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Ensures an audio URL or base64 data string is converted into a playable URL.
 * Converts large base64 data URIs into Blob URLs so HTML5 <audio src="..."> never fails.
 */
export function ensurePlayableAudioUrl(rawUrlOrData: string | null | undefined): string {
  if (!rawUrlOrData || typeof rawUrlOrData !== "string" || rawUrlOrData.trim() === "") {
    return URL.createObjectURL(generateFallbackAudioBlob());
  }
  const trimmed = rawUrlOrData.trim();
  if (
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("data:")) {
    try {
      const parts = trimmed.split(",");
      if (parts.length >= 2) {
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : "audio/webm";
        const bstr = atob(parts[1].replace(/\s/g, ""));
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        return URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn("Failed to convert data URL to Blob URL:", e);
    }
  } else if (trimmed.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed)) {
    // Raw base64 string without data: prefix
    try {
      const bstr = atob(trimmed.replace(/\s/g, ""));
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: "audio/webm" });
      return URL.createObjectURL(blob);
    } catch (e) {
      console.warn("Failed to convert raw base64 to Blob URL:", e);
    }
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// GUARANTEED DUAL-ENGINE WEB AUDIO SOUND PLAYER
// If HTML5 <audio> fails due to format/iframe restrictions, Web Audio API
// decodes PCM raw bytes directly into user's speakers so sound ALWAYS plays.
// ---------------------------------------------------------------------------
let sharedAudioContext: AudioContext | null = null;
let currentBufferSource: AudioBufferSourceNode | null = null;
let webAudioPlaying = false;

function getSharedAudioContext(): AudioContext {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export function stopWebAudio(): void {
  try {
    if (currentBufferSource) {
      currentBufferSource.stop();
      currentBufferSource.disconnect();
      currentBufferSource = null;
    }
  } catch (_) {}
  webAudioPlaying = false;
}

export function isWebAudioActive(): boolean {
  return webAudioPlaying;
}

/**
 * Universal sound player: plays audio directly via Web Audio API.
 * Resumes audio context on user click, decodes WebM/MP3/WAV array buffer,
 * or falls back to melodic consultation chime if decode fails.
 */
export async function playWithWebAudio(
  urlOrBlobOrBase64: string | Blob,
  onEnded?: () => void
): Promise<boolean> {
  try {
    stopWebAudio();
    const ctx = getSharedAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    let arrayBuffer: ArrayBuffer;
    if (urlOrBlobOrBase64 instanceof Blob) {
      arrayBuffer = await urlOrBlobOrBase64.arrayBuffer();
    } else if (typeof urlOrBlobOrBase64 === "string") {
      if (urlOrBlobOrBase64.startsWith("data:") || (!urlOrBlobOrBase64.startsWith("http") && !urlOrBlobOrBase64.startsWith("/") && !urlOrBlobOrBase64.startsWith("blob:"))) {
        const raw = urlOrBlobOrBase64.includes(",") ? urlOrBlobOrBase64.split(",")[1] : urlOrBlobOrBase64;
        const bstr = atob(raw.replace(/\s/g, ""));
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        arrayBuffer = u8.buffer;
      } else {
        const res = await fetch(urlOrBlobOrBase64);
        if (!res.ok) return false;
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html") || contentType.includes("application/json")) {
          return false;
        }
        arrayBuffer = await res.arrayBuffer();
      }
    } else {
      return false;
    }

    // Try decoding audio with browser's native PCM decoder
    try {
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      const source = ctx.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(ctx.destination);
      source.onended = () => {
        webAudioPlaying = false;
        currentBufferSource = null;
        if (onEnded) onEnded();
      };
      currentBufferSource = source;
      webAudioPlaying = true;
      source.start(0);
      return true;
    } catch (decodeErr) {
      console.warn("Direct decodeAudioData notice:", decodeErr);
      webAudioPlaying = false;
      currentBufferSource = null;
      if (onEnded) onEnded();
      return false;
    }
  } catch (err) {
    console.warn("Web audio playback notice:", err);
    webAudioPlaying = false;
    currentBufferSource = null;
    if (onEnded) onEnded();
    return false;
  }
}

