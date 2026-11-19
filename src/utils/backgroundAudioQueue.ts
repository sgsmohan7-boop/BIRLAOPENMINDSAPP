import { findAudioRecordingBlob, sanitizeAudioDuration } from "./audioStorage";
import { loadR2Credentials, uploadToR2Direct } from "./cloudflareR2Client";
import { uploadFileToDrive, isDriveConnected } from "./googleDrive";

export type BackgroundUploadPhase =
  | "preparing"
  | "uploading_r2"
  | "uploading_server"
  | "syncing_drive"
  | "done";

export interface BackgroundAudioJob {
  jobKey?: string;
  enquiryId?: string;
  enquiryNo: string;
  recordingId: string;
  storageKey?: string;
  fileName: string;
  mimeType: string;
  durationSeconds: number;
  fileSizeBytes?: number;
  studentName?: string;
  counsellorId?: string;
  counsellorName?: string;
  applyingForClass?: string;
  parentLanguage?: string;
  liveTurnsText?: string;
  meetingTextSummary?: string;
  audioSource?: string;
  runServerTranscribe?: boolean;
  blob?: Blob;
  fallbackBase64Data?: string;
  attemptsMade?: number;
}

export interface BackgroundAudioCompletionResult {
  jobKey: string;
  enquiryId?: string;
  enquiryNo: string;
  recordingId: string;
  fileName: string;
  durationSeconds: number;
  r2Synced: boolean;
  serverAudioUrl?: string;
  driveFileId?: string;
  driveFileUrl?: string;
  driveSyncedAt?: string;
  enhancedTranscript?: string;
  error?: string;
}

export interface BackgroundAudioQueueSnapshot {
  pendingCount: number;
  activeJob: {
    jobKey: string;
    enquiryNo: string;
    studentName?: string;
    fileName: string;
    fileSizeBytes?: number;
    phase: BackgroundUploadPhase;
  } | null;
  queuedJobs: Array<{
    jobKey: string;
    enquiryNo: string;
    studentName?: string;
    fileName: string;
  }>;
  failedJobs: Array<{
    jobKey: string;
    enquiryNo: string;
    studentName?: string;
    fileName: string;
    error: string;
  }>;
  lastCompleted: (BackgroundAudioCompletionResult & { timestamp: number }) | null;
}

const queuedList: BackgroundAudioJob[] = [];
const failedList: Array<{ job: BackgroundAudioJob; error: string }> = [];
let currentActiveJob: {
  job: BackgroundAudioJob;
  phase: BackgroundUploadPhase;
} | null = null;
let lastCompletedResult: (BackgroundAudioCompletionResult & { timestamp: number }) | null = null;
let workerActive = false;
let expressBackendAvailable: boolean | null = null;

const stateListeners = new Set<(snap: BackgroundAudioQueueSnapshot) => void>();
const completionListeners = new Set<(res: BackgroundAudioCompletionResult) => void>();

let globalListenersInitialized = false;

export function buildBackgroundAudioJobKey(params: {
  enquiryNo?: string;
  enquiryId?: string;
  recordingId?: string;
  fileName?: string;
}): string {
  const raw =
    (params.fileName || "").trim() ||
    (params.enquiryNo || "").trim() ||
    (params.enquiryId || "").trim() ||
    (params.recordingId || "").trim() ||
    `audio_${Date.now()}`;
  return raw.toLowerCase();
}

function getSnapshot(): BackgroundAudioQueueSnapshot {
  return {
    pendingCount: (currentActiveJob ? 1 : 0) + queuedList.length,
    activeJob: currentActiveJob
      ? {
          jobKey: currentActiveJob.job.jobKey || buildBackgroundAudioJobKey(currentActiveJob.job),
          enquiryNo: currentActiveJob.job.enquiryNo,
          studentName: currentActiveJob.job.studentName,
          fileName: currentActiveJob.job.fileName,
          fileSizeBytes: currentActiveJob.job.fileSizeBytes,
          phase: currentActiveJob.phase
        }
      : null,
    queuedJobs: queuedList.map((j) => ({
      jobKey: j.jobKey || buildBackgroundAudioJobKey(j),
      enquiryNo: j.enquiryNo,
      studentName: j.studentName,
      fileName: j.fileName
    })),
    failedJobs: failedList.map((f) => ({
      jobKey: f.job.jobKey || buildBackgroundAudioJobKey(f.job),
      enquiryNo: f.job.enquiryNo,
      studentName: f.job.studentName,
      fileName: f.job.fileName,
      error: f.error
    })),
    lastCompleted: lastCompletedResult
  };
}

function notifySubscribers() {
  const snap = getSnapshot();
  stateListeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {}
  });
}

function ensureGlobalListeners() {
  if (globalListenersInitialized || typeof window === "undefined") return;
  globalListenersInitialized = true;

  window.addEventListener("beforeunload", (e) => {
    if (currentActiveJob || queuedList.length > 0) {
      const msg = "Meeting audio is still uploading to Cloud Vault in background. Closing now may interrupt upload.";
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    }
  });

  window.addEventListener("online", () => {
    if (failedList.length > 0) {
      setTimeout(() => {
        retryFailedBackgroundAudioUploads();
      }, 1200);
    }
  });
}

function dataUrlToBlob(dataUrl: string, fallbackMime = "audio/webm"): Blob | null {
  try {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    if (dataUrl.startsWith("data:")) {
      const [header, b64] = dataUrl.split(",");
      if (!b64) return null;
      const mimeMatch = header.match(/data:([^;]+)/i);
      const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    }
    return null;
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || "");
      reader.onerror = () => resolve("");
      reader.readAsDataURL(blob);
    } catch {
      resolve("");
    }
  });
}

async function resolveJobBlob(job: BackgroundAudioJob): Promise<Blob | null> {
  if (job.blob && job.blob.size > 0) {
    return job.blob;
  }

  const found = await findAudioRecordingBlob([
    job.storageKey,
    job.recordingId,
    job.fileName,
    job.enquiryNo,
    job.enquiryId,
    job.enquiryNo ? `audio-${job.enquiryNo.trim()}` : undefined,
    job.studentName ? `audio-${job.studentName.toLowerCase().replace(/\s+/g, "_")}` : undefined
  ]);

  if (found instanceof Blob && found.size > 0) {
    return found;
  }
  if (typeof found === "string" && found.length > 40) {
    const converted = dataUrlToBlob(found, job.mimeType || "audio/webm");
    if (converted && converted.size > 0) return converted;
  }

  if (job.fallbackBase64Data && job.fallbackBase64Data.length > 40) {
    const converted = dataUrlToBlob(job.fallbackBase64Data, job.mimeType || "audio/webm");
    if (converted && converted.size > 0) return converted;
  }

  return null;
}

async function processSingleJob(job: BackgroundAudioJob): Promise<void> {
  const jobKey = job.jobKey || buildBackgroundAudioJobKey(job);
  const safeDur = sanitizeAudioDuration(job.durationSeconds, 10);

  currentActiveJob = { job: { ...job, jobKey }, phase: "preparing" };
  notifySubscribers();

  const audioBlob = await resolveJobBlob(job);
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error("Audio data not found in local IndexedDB vault");
  }

  const mimeType = audioBlob.type || job.mimeType || "audio/webm";
  let r2Synced = false;
  let serverAudioUrl: string | undefined;
  let enhancedTranscript: string | undefined;
  let driveFileId: string | undefined;
  let driveFileUrl: string | undefined;
  let driveSyncedAt: string | undefined;

  // 1. Direct Binary Cloudflare R2 Upload (with 3 automatic retries — handles 30–40 min files reliably without base64 overhead)
  currentActiveJob = { job: { ...job, jobKey, fileSizeBytes: audioBlob.size }, phase: "uploading_r2" };
  notifySubscribers();

  try {
    const creds = loadR2Credentials();
    const uint8 = new Uint8Array(await audioBlob.arrayBuffer());
    const retryDelays = [1500, 4000];
    for (let attempt = 1; attempt <= 3; attempt++) {
      const ok = await uploadToR2Direct(creds, job.fileName, uint8, mimeType);
      if (ok) {
        r2Synced = true;
        break;
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, retryDelays[attempt - 1] || 2000));
      }
    }
  } catch (err) {
    console.warn(`[BackgroundAudioQueue] Direct R2 warning for ${job.fileName}:`, err);
  }

  // 2. Express Server Vault + Optional Gemini Enhancement (only if Express server is present on this origin)
  const MAX_SERVER_BASE64_BYTES = 45 * 1024 * 1024;
  if (expressBackendAvailable !== false && audioBlob.size <= MAX_SERVER_BASE64_BYTES) {
    currentActiveJob = { job: { ...job, jobKey, fileSizeBytes: audioBlob.size }, phase: "uploading_server" };
    notifySubscribers();

    const base64Data = await blobToDataUrl(audioBlob);
    if (base64Data) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const resp = await fetch("/api/upload-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enquiryNo: job.enquiryNo || "ENQ-PENDING",
              id: job.recordingId,
              audioBase64: base64Data,
              filename: job.fileName,
              mimeType,
              durationSeconds: safeDur,
              meetingTextSummary: job.meetingTextSummary || "",
              counsellorId: job.counsellorId || "COUNSELLOR-01",
              counsellorName: job.counsellorName || "Admissions Counsellor",
              studentName: job.studentName || "Student Enquiry"
            })
          });
          const ct = (resp.headers.get("content-type") || "").toLowerCase();
          if (!ct.includes("application/json")) {
            expressBackendAvailable = false;
            break;
          }
          expressBackendAvailable = true;
          const res = await resp.json();
          if (res?.success && res?.audioUrl) {
            serverAudioUrl = res.audioUrl;
            if (res.r2Synced) r2Synced = true;
            break;
          }
        } catch {
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1000));
        }
      }

      // Optional non-blocking transcription enhancement (<= 16MB raw blob so JSON stays within Gemini inline limit)
      if (expressBackendAvailable === true && job.runServerTranscribe && audioBlob.size <= 16 * 1024 * 1024) {
        try {
          const resp = await fetch("/api/transcribe-meeting-audio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType,
              liveSpeechText: job.liveTurnsText || "",
              counsellorName: job.counsellorName || "Admissions Counsellor",
              counsellorId: job.counsellorId || "COUNSELLOR-01",
              studentName: job.studentName || "Student Enquiry",
              applyingForClass: job.applyingForClass || "N/A",
              parentLanguage: job.parentLanguage || "English + Regional (Bilingual)"
            })
          });
          const ct = (resp.headers.get("content-type") || "").toLowerCase();
          if (ct.includes("application/json")) {
            const apiRes = await resp.json();
            if (apiRes?.success && apiRes?.transcript) {
              enhancedTranscript = apiRes.transcript;
            }
          }
        } catch {}
      }
    }
  }

  // 3. Silent Google Drive Backup (only if already connected — never pop OAuth prompts in background)
  try {
    if (isDriveConnected()) {
      currentActiveJob = { job: { ...job, jobKey, fileSizeBytes: audioBlob.size }, phase: "syncing_drive" };
      notifySubscribers();
      const driveItem = await uploadFileToDrive({
        name: job.fileName,
        mimeType,
        dataBlob: audioBlob,
        folderType: "Counselling Voice Vault",
        description: `Counselling meeting audio for enquiry #${job.enquiryNo} (${job.studentName || "Student"}), Counsellor: ${job.counsellorName || "Counsellor"}`
      });
      if (driveItem && (driveItem.id || driveItem.webViewLink || driveItem.webContentLink)) {
        driveFileId = driveItem.id;
        const candidateUrl = driveItem.webViewLink || driveItem.webContentLink;
        if (candidateUrl && !candidateUrl.startsWith("blob:")) {
          driveFileUrl = candidateUrl;
        }
        driveSyncedAt = new Date().toISOString();
      }
      const summaryForDrive = enhancedTranscript || job.meetingTextSummary;
      if (summaryForDrive) {
        const textBlob = new Blob([summaryForDrive], { type: "text/plain;charset=utf-8" });
        await uploadFileToDrive({
          name: `${job.fileName}.txt`,
          mimeType: "text/plain",
          dataBlob: textBlob,
          folderType: "Counselling Voice Vault",
          description: `Counselling meeting transcript text report for enquiry #${job.enquiryNo} (${job.studentName || "Student"})`
        }).catch(() => {});
      }
    }
  } catch (driveErr) {
    console.warn("[BackgroundAudioQueue] Drive silent sync notice:", driveErr);
  }

  if (!r2Synced && !serverAudioUrl && !driveFileUrl) {
    throw new Error("Cloud upload could not reach R2 or Server — check internet connection");
  }

  const completion: BackgroundAudioCompletionResult = {
    jobKey,
    enquiryId: job.enquiryId,
    enquiryNo: job.enquiryNo,
    recordingId: job.recordingId,
    fileName: job.fileName,
    durationSeconds: safeDur,
    r2Synced,
    serverAudioUrl,
    driveFileId,
    driveFileUrl,
    driveSyncedAt,
    enhancedTranscript
  };

  lastCompletedResult = { ...completion, timestamp: Date.now() };
  completionListeners.forEach((cb) => {
    try {
      cb(completion);
    } catch {}
  });
}

async function runQueueWorker() {
  if (workerActive) return;
  workerActive = true;
  ensureGlobalListeners();

  try {
    while (queuedList.length > 0) {
      const nextJob = queuedList.shift()!;
      const jobKey = nextJob.jobKey || buildBackgroundAudioJobKey(nextJob);
      try {
        await processSingleJob(nextJob);
        // Drop any older failure entry for this jobKey on success
        const failIdx = failedList.findIndex((f) => (f.job.jobKey || buildBackgroundAudioJobKey(f.job)) === jobKey);
        if (failIdx >= 0) failedList.splice(failIdx, 1);
      } catch (err: any) {
        const errMsg = err instanceof Error ? err.message : String(err || "Upload failed");
        console.warn(`[BackgroundAudioQueue] Job failed (${nextJob.enquiryNo}):`, errMsg);
        const existingFailIdx = failedList.findIndex((f) => (f.job.jobKey || buildBackgroundAudioJobKey(f.job)) === jobKey);
        if (existingFailIdx >= 0) {
          failedList[existingFailIdx] = { job: nextJob, error: errMsg };
        } else {
          failedList.push({ job: nextJob, error: errMsg });
        }
      } finally {
        currentActiveJob = null;
        notifySubscribers();
      }
    }
  } finally {
    currentActiveJob = null;
    workerActive = false;
    notifySubscribers();
  }
}

/**
 * Enqueue an audio recording for immediate non-blocking background upload to Cloudflare R2 / Server / Drive.
 * Form saving unlocks immediately once the recording is stored locally in IndexedDB.
 */
export function enqueueBackgroundAudioUpload(job: BackgroundAudioJob): string {
  ensureGlobalListeners();
  const jobKey = job.jobKey || buildBackgroundAudioJobKey(job);
  const normalizedJob: BackgroundAudioJob = { ...job, jobKey };

  // Remove any previous failure for the same key
  const failIdx = failedList.findIndex((f) => (f.job.jobKey || buildBackgroundAudioJobKey(f.job)) === jobKey);
  if (failIdx >= 0) failedList.splice(failIdx, 1);

  // Deduplicate / replace queued entry with freshest metadata/blob
  const qIdx = queuedList.findIndex((j) => (j.jobKey || buildBackgroundAudioJobKey(j)) === jobKey);
  if (qIdx >= 0) {
    queuedList[qIdx] = { ...queuedList[qIdx], ...normalizedJob };
  } else if (
    currentActiveJob &&
    (currentActiveJob.job.jobKey || buildBackgroundAudioJobKey(currentActiveJob.job)) === jobKey &&
    !normalizedJob.blob
  ) {
    // Already actively uploading this exact recording without newer blob -> skip duplicate enqueue
    notifySubscribers();
    return jobKey;
  } else {
    queuedList.push(normalizedJob);
  }

  notifySubscribers();
  void runQueueWorker();
  return jobKey;
}

export function isJobInBackgroundAudioQueue(keyOrEnquiryNo: string): boolean {
  if (!keyOrEnquiryNo) return false;
  const target = keyOrEnquiryNo.trim().toLowerCase();
  if (
    currentActiveJob &&
    ((currentActiveJob.job.jobKey || "").toLowerCase() === target ||
      (currentActiveJob.job.enquiryNo || "").trim().toLowerCase() === target ||
      (currentActiveJob.job.fileName || "").trim().toLowerCase() === target)
  ) {
    return true;
  }
  return queuedList.some(
    (j) =>
      (j.jobKey || "").toLowerCase() === target ||
      (j.enquiryNo || "").trim().toLowerCase() === target ||
      (j.fileName || "").trim().toLowerCase() === target
  );
}

export function retryFailedBackgroundAudioUploads(): void {
  if (failedList.length === 0) return;
  const toRetry = failedList.splice(0, failedList.length);
  toRetry.forEach((item) => {
    queuedList.push(item.job);
  });
  notifySubscribers();
  void runQueueWorker();
}

export function dismissFailedBackgroundAudioUploads(): void {
  if (failedList.length === 0) return;
  failedList.splice(0, failedList.length);
  notifySubscribers();
}

export function getBackgroundAudioQueueSnapshot(): BackgroundAudioQueueSnapshot {
  return getSnapshot();
}

export function subscribeBackgroundAudioQueue(
  listener: (snap: BackgroundAudioQueueSnapshot) => void
): () => void {
  stateListeners.add(listener);
  try {
    listener(getSnapshot());
  } catch {}
  return () => {
    stateListeners.delete(listener);
  };
}

export function onBackgroundAudioComplete(
  listener: (res: BackgroundAudioCompletionResult) => void
): () => void {
  completionListeners.add(listener);
  return () => {
    completionListeners.delete(listener);
  };
}
