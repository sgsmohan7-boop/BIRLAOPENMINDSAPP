import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadBucketCommand
} from "@aws-sdk/client-s3";
import { getAudioRecordingBlob } from "./audioStorage";

export interface R2Credentials {
  bucketName: string;
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const DEFAULT_R2_CREDENTIALS: R2Credentials = {
  bucketName: "counselling-audio-vault",
  accountId: "d187b1ea25b7d75547bf80c6ce3eb73a",
  accessKeyId: "adbe1437ad4446d68ccc22d3de5c637c",
  secretAccessKey: "8714919d92ebbe30eac2b6386c30a41cc9b5c340fa0f32afa1b8e7ade23ee603"
};

const STORAGE_KEY = "bomis_cloudflare_r2_config_v2";

export function loadR2Credentials(): R2Credentials {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bucketName: (parsed.bucketName || DEFAULT_R2_CREDENTIALS.bucketName).trim(),
        accountId: (parsed.accountId || DEFAULT_R2_CREDENTIALS.accountId).trim(),
        accessKeyId: (parsed.accessKeyId || DEFAULT_R2_CREDENTIALS.accessKeyId).trim(),
        secretAccessKey: (parsed.secretAccessKey || DEFAULT_R2_CREDENTIALS.secretAccessKey).trim()
      };
    }
  } catch (_) {}
  return DEFAULT_R2_CREDENTIALS;
}

export function saveR2Credentials(creds: R2Credentials): void {
  try {
    const trimmed = {
      bucketName: (creds.bucketName || DEFAULT_R2_CREDENTIALS.bucketName).trim(),
      accountId: (creds.accountId || DEFAULT_R2_CREDENTIALS.accountId).trim(),
      accessKeyId: (creds.accessKeyId || DEFAULT_R2_CREDENTIALS.accessKeyId).trim(),
      secretAccessKey: (creds.secretAccessKey || DEFAULT_R2_CREDENTIALS.secretAccessKey).trim()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (_) {}
}

export function createBrowserR2Client(creds: R2Credentials): S3Client | null {
  const accountId = (creds.accountId || "").trim();
  const accessKeyId = (creds.accessKeyId || "").trim();
  const secretAccessKey = (creds.secretAccessKey || "").trim();

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export const R2_CORS_POLICY_JSON = JSON.stringify([
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
], null, 2);

/**
 * Test R2 connection directly from browser
 */
export async function testR2ConnectionDirect(creds: R2Credentials): Promise<{ success: boolean; message: string; isCorsError?: boolean }> {
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) {
      return {
        success: false,
        message: "Missing Account ID, Access Key ID, or Secret Access Key."
      };
    }

    const command = new ListObjectsV2Command({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      MaxKeys: 1
    });

    await s3.send(command);
    return {
      success: true,
      message: `Direct Browser Connection to Cloudflare R2 Bucket "${creds.bucketName}" verified successfully!`
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const errName = err?.name || "";

    if (errName === "SignatureDoesNotMatch" || errMsg.includes("SignatureDoesNotMatch")) {
      return {
        success: false,
        message: "Cloudflare R2 Secret Access Key does not match. Please verify your R2 token in Cloudflare Dashboard."
      };
    }
    if (errName === "NoSuchBucket" || errMsg.includes("NoSuchBucket")) {
      return {
        success: false,
        message: `Bucket "${creds.bucketName}" does not exist in Cloudflare R2.`
      };
    }
    if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError") || errMsg.includes("CORS") || errName === "TypeError") {
      return {
        success: false,
        isCorsError: true,
        message: `Network/CORS Notice: Please ensure CORS is enabled on bucket "${creds.bucketName}" in Cloudflare R2 Settings (Allowed Origins: *).`
      };
    }
    return {
      success: false,
      message: `Cloudflare R2 Connection Failed: ${errMsg}`
    };
  }
}

/**
 * List files from R2 directly in browser
 */
export async function listR2FilesDirect(creds: R2Credentials): Promise<any[]> {
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) return [];

    const command = new ListObjectsV2Command({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      MaxKeys: 100
    });

    const result = await s3.send(command);
    const bucket = creds.bucketName || "counselling-audio-vault";
    const accountId = creds.accountId || DEFAULT_R2_CREDENTIALS.accountId;

    return (result.Contents || []).map((c) => ({
      key: c.Key,
      name: c.Key,
      size: c.Size,
      lastModified: c.LastModified,
      streamUrl: `/api/audios/${c.Key}`,
      r2DirectUrl: `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${c.Key}`
    }));
  } catch (err) {
    console.warn("Direct R2 file listing warning:", err);
    return [];
  }
}

/**
 * Upload single file to R2 directly in browser
 */
export async function uploadToR2Direct(
  creds: R2Credentials,
  fileName: string,
  body: Uint8Array | Blob | string,
  contentType = "audio/webm"
): Promise<boolean> {
  // Strict Policy: Cloudflare R2 is 100% reserved for raw meeting audio files (.webm, .mp3, .wav).
  // All text transcripts, notes, and records are managed in Firebase Firestore to save 10GB R2 storage for 1-hour audio.
  if (fileName.toLowerCase().endsWith(".txt") || contentType.includes("text/")) {
    console.log(`[R2 Policy] Skipping text file ${fileName}. Text data belongs exclusively in Firebase Firestore.`);
    return false;
  }

  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) return false;

    let payload: any = body;
    if (typeof body === "string") {
      if (body.startsWith("data:")) {
        const base64 = body.split(",")[1];
        const bstr = atob(base64);
        const u8 = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        payload = u8;
      } else {
        const encoder = new TextEncoder();
        payload = encoder.encode(body);
      }
    }

    const command = new PutObjectCommand({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      Key: fileName,
      Body: payload,
      ContentType: contentType
    });

    await s3.send(command);
    return true;
  } catch (err: any) {
    console.warn(`Direct upload to R2 failed for ${fileName}:`, err?.message || err);
    return false;
  }
}

/**
 * Fetch an audio file from R2 bucket directly into a browser Blob
 */
export async function getR2AudioBlobDirect(
  creds: R2Credentials,
  fileName: string
): Promise<Blob | null> {
  if (!fileName) return null;
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) return null;

    const command = new GetObjectCommand({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      Key: fileName
    });

    const response = await s3.send(command);
    if (response && response.Body) {
      if (typeof (response.Body as any).transformToByteArray === "function") {
        const bytes = await (response.Body as any).transformToByteArray();
        return new Blob([bytes], { type: response.ContentType || "audio/webm" });
      }
      if (typeof (response.Body as any).arrayBuffer === "function") {
        const buf = await (response.Body as any).arrayBuffer();
        return new Blob([buf], { type: response.ContentType || "audio/webm" });
      }
      if (response.Body instanceof Blob) {
        return response.Body;
      }
    }
    return null;
  } catch (err) {
    console.warn(`Direct R2 audio download notice for ${fileName}:`, err);
    return null;
  }
}

/**
 * Direct browser sync of all audio recordings to Cloudflare R2
 */
export async function syncAllRecordingsDirect(
  creds: R2Credentials,
  enquiries: any[],
  onProgress?: (text: string) => void
): Promise<{ success: boolean; syncedCount: number; message: string }> {
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) {
      return { success: false, syncedCount: 0, message: "Missing Cloudflare R2 credentials." };
    }

    onProgress?.("Checking Cloudflare R2 connection...");
    const testResult = await testR2ConnectionDirect(creds);
    if (!testResult.success) {
      return { success: false, syncedCount: 0, message: testResult.message };
    }

    let syncedCount = 0;
    const total = enquiries.length;

    for (let i = 0; i < total; i++) {
      const enq = enquiries[i];
      const rec = enq.audioRecording;
      if (!rec) continue;

      const fileName = rec.fileName || `${enq.enquiryNo || 'ENQ'}_Meeting_${enq.date || 'Record'}.webm`;
      onProgress?.(`Uploading (${syncedCount + 1}): ${fileName}...`);

      let audioBlob: Blob | string | null = null;
      if (rec.id) {
        audioBlob = await getAudioRecordingBlob(rec.id);
      }
      if (!audioBlob && enq.id) {
        audioBlob = await getAudioRecordingBlob(enq.id);
      }

      // If audio blob found in IndexedDB
      if (audioBlob) {
        const ok = await uploadToR2Direct(creds, fileName, audioBlob, rec.mimeType || "audio/webm");
        if (ok) syncedCount++;
      } else if (rec.audioData && typeof rec.audioData === "string" && rec.audioData.length > 50) {
        // Base64 fallback
        const ok = await uploadToR2Direct(creds, fileName, rec.audioData, rec.mimeType || "audio/webm");
        if (ok) syncedCount++;
      } else if (rec.audioUrl && (rec.audioUrl.startsWith("http") || rec.audioUrl.startsWith("/api/audios/"))) {
        // Fetch from existing audioUrl
        try {
          const res = await fetch(rec.audioUrl);
          if (res.ok) {
            const blob = await res.blob();
            const ok = await uploadToR2Direct(creds, fileName, blob, rec.mimeType || "audio/webm");
            if (ok) syncedCount++;
          }
        } catch (_) {}
      }

    }

    return {
      success: true,
      syncedCount,
      message: `Direct Browser Sync completed: Synced ${syncedCount} audio recording(s) to Cloudflare R2 Bucket "${creds.bucketName}"! (Transcripts and notes remain safe in Firebase Firestore)`
    };
  } catch (err: any) {
    return {
      success: false,
      syncedCount: 0,
      message: `Direct Browser Sync error: ${err?.message || err}`
    };
  }
}

/**
 * Delete a specific object from Cloudflare R2
 */
export async function deleteR2FileDirect(creds: R2Credentials, fileName: string): Promise<boolean> {
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) return false;

    const command = new DeleteObjectCommand({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      Key: fileName
    });

    await s3.send(command);
    return true;
  } catch (err) {
    console.warn(`Failed to delete ${fileName} from R2:`, err);
    return false;
  }
}

/**
 * Clean up all .txt files from Cloudflare R2 to ensure the 10GB vault holds strictly audio files.
 * Text files are already securely stored in Firebase Firestore.
 */
export async function purgeTextFilesFromR2(
  creds: R2Credentials,
  onProgress?: (status: string) => void
): Promise<{ success: boolean; deletedCount: number; message: string }> {
  try {
    const s3 = createBrowserR2Client(creds);
    if (!s3) {
      return { success: false, deletedCount: 0, message: "Missing Cloudflare R2 credentials." };
    }

    onProgress?.("Scanning Cloudflare R2 bucket for .txt files...");
    const command = new ListObjectsV2Command({
      Bucket: (creds.bucketName || "counselling-audio-vault").trim(),
      MaxKeys: 1000
    });

    const result = await s3.send(command);
    const textObjects = (result.Contents || []).filter(c => c.Key && c.Key.toLowerCase().endsWith(".txt"));

    if (textObjects.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        message: "No .txt files found in Cloudflare R2 bucket. Bucket is already 100% clean audio storage!"
      };
    }

    let deletedCount = 0;
    for (const obj of textObjects) {
      if (!obj.Key) continue;
      onProgress?.(`Removing text file (${deletedCount + 1}/${textObjects.length}): ${obj.Key}...`);
      const ok = await deleteR2FileDirect(creds, obj.Key);
      if (ok) deletedCount++;
    }

    return {
      success: true,
      deletedCount,
      message: `Cleaned up ${deletedCount} .txt file(s) from Cloudflare R2! R2 bucket is now 100% reserved for Audio recordings.`
    };
  } catch (err: any) {
    return {
      success: false,
      deletedCount: 0,
      message: `Error cleaning text files from R2: ${err?.message || err}`
    };
  }
}
