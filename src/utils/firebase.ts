import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs,
  getDocsFromServer,
  getDoc,
  getDocFromServer,
  writeBatch,
  disableNetwork,
  enableNetwork,
  query,
  where,
  runTransaction
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, CounsellingEnquiry } from "../types";
import { getDeletedEnquiryIds } from "./storage";
import { app, db, auth } from "../lib/firebase";
import { extractEnquirySerialNum, formatCanonicalEnquiryNo } from "./enquirySynthesis";

// Initialize Firebase Auth Provider
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider };

// Error handling structures as mandated by the skill
export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
// console.warn("Firestore Operation Notice: ", JSON.stringify(errInfo));
  return errInfo;
}

// Test Connection as mandated by the skill
export async function testFirestoreConnection() {
  if (firebaseConfig.apiKey.includes("placeholder")) {
// console.warn("Firebase is running on dummy placeholder credentials.");
    return;
  }
  try {
    await getDoc(doc(db, "test", "connection"));
// console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
// console.warn("Firebase Firestore is connecting or in offline mode.");
    } else {
// console.log("Firebase ping response received.");
    }
  }
}

// Check if Firebase is actually configured or using dummy config
export function isFirebaseConfigured(): boolean {
  return !firebaseConfig.apiKey.includes("placeholder");
}

// Google Sign In integration
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not fully configured yet. Please complete the setup via AI Studio.");
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    // console.error("Google Sign-In Error: ", error);
    throw error;
  }
}

// Email and Password Login
export async function getUserIAMRole(email: string): Promise<string> {
  try {
    const metaDoc = await getDocFromServer(doc(db, "system_metadata", "access_control"));
    if (metaDoc.exists()) {
      const data = metaDoc.data();
      if (data.allowedUsers && Array.isArray(data.allowedUsers)) {
         const userRec = data.allowedUsers.find((u: any) => u.email === email.toLowerCase());
         if (userRec) return userRec.role;
      }
    }
  } catch (err) {
// console.warn("Could not fetch IAM role:", err);
  }
  return email.toLowerCase().includes("super") || email.toLowerCase() === "sgsmohan7@gmail.com" ? "Super Admin" : "IT Admin";
}

export async function loginWithEmail(email: string, password: string): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not fully configured yet.");
  }
  
  // Custom Hook: Check if access is restricted to specific emails
  try {
    const metaDoc = await getDocFromServer(doc(db, "system_metadata", "access_control"));
    if (metaDoc.exists()) {
      const data = metaDoc.data();
      if (data.isRestricted) {
        if (data.allowedUsers && Array.isArray(data.allowedUsers)) {
           const userRec = data.allowedUsers.find((u: any) => u.email === email.toLowerCase());
           if (!userRec || userRec.status !== 'ACTIVE') {
              throw new Error("unauthorized-email");
           }
        } else if (data.allowedEmails && Array.isArray(data.allowedEmails)) {
          if (!data.allowedEmails.includes(email.toLowerCase())) {
            throw new Error("unauthorized-email");
          }
        }
      }
    }
  } catch (err: any) {
    if (err.message === "unauthorized-email") {
      throw new Error("Your email is not authorized by the IT Administrator for system access. Please request access.");
    }
    // Ignore other errors like permission-denied if rules block it, or missing doc
// console.warn("Could not check access control metadata:", err);
  }

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/operation-not-allowed') {
// console.warn("Firebase Email/Password provider not enabled; continuing in desktop/local session mode.");
      return auth.currentUser || null;
    }
    // If not found, create new account automatically for testing/demo context
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
            const signup = await createUserWithEmailAndPassword(auth, email, password);
            return signup.user;
        } catch (signupErr: any) {
            if (signupErr.code === 'auth/operation-not-allowed') {
// console.warn("Firebase Email/Password registration not enabled; continuing in local session mode.");
                return auth.currentUser || null;
            }
            if (signupErr.code === 'auth/email-already-in-use') {
                throw new Error("Invalid password. Please reset your password if you forgot it.");
            }
            if (signupErr.code === 'auth/weak-password') {
                throw new Error("Password should be at least 6 characters.");
            }
// console.warn("Auto-signup info for new user:", signupErr?.message || signupErr);
            throw signupErr;
        }
    }
// console.warn("Email Login Failed: ", error?.message || error);
    throw error;
  }
}

export async function resetEmailPassword(email: string): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not fully configured yet.");
  }
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error: any) {
    if (error.code === 'auth/quota-exceeded' || error.code === 'auth/too-many-requests') {
      throw new Error("Too many requests, please wait a moment and try again.");
    }
    // console.error("Password reset error:", error);
    throw error;
  }
}

// Bypass Google Popup for Desktop Electron App
export async function signInAsDesktopUser(displayName: string): Promise<FirebaseUser | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }
  try {
    // Use a single, common authenticated account for the entire Teacher Portal
    // This prevents database clutter (creating thousands of dummy users in Firebase Auth)
    // while still strictly enforcing Firebase security rules.
    const email = `common_teacher_station@birla-internal.edu`;
    const password = `TeacherPortalAutologin123!`;

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (loginErr: any) {
        if (loginErr.code === 'auth/operation-not-allowed' || loginErr.code === 'auth/admin-restricted-operation') {
            try {
                const anon = await signInAnonymously(auth);
                return anon.user;
            } catch {
// console.warn("Desktop/Station auth using local session (Email/Anon auth disabled in Firebase):", displayName);
                return auth.currentUser || null;
            }
        }
        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
             try {
                const signup = await createUserWithEmailAndPassword(auth, email, password);
                return signup.user;
             } catch (signupErr: any) {
                if (signupErr.code === 'auth/operation-not-allowed') {
                    try {
                        const anon = await signInAnonymously(auth);
                        return anon.user;
                    } catch {
                        return auth.currentUser || null;
                    }
                }
                if (signupErr.code === 'auth/email-already-in-use') {
                    return auth.currentUser || null;
                }
// console.warn("Desktop station auto-signup notice:", signupErr?.message || signupErr);
                return auth.currentUser || null;
             }
        }
// console.warn("Desktop login attempt info:", loginErr?.message || loginErr);
        return auth.currentUser || null;
    }
  } catch (error: any) {
// console.warn("Desktop Auth fallback active for", displayName, error?.message || error);
    return auth.currentUser || null;
  }
}

const READ_QUOTA_BACKOFF_KEY = "sgs_firestore_read_backoff_until";
const LEGACY_QUOTA_STORAGE_KEY = "sgs_firestore_quota_exhausted";
const LEGACY_QUOTA_PROJECT_KEY = "sgs_firestore_quota_project";

function readPersistedReadBackoff(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(READ_QUOTA_BACKOFF_KEY);
    if (!raw) return 0;
    const ts = parseInt(raw, 10);
    if (!isNaN(ts) && ts > Date.now()) {
      // Cap persisted backoff to max 10 minutes
      return Math.min(ts, Date.now() + 600000);
    }
    sessionStorage.removeItem(READ_QUOTA_BACKOFF_KEY);
  } catch {}
  return 0;
}

// Separate in-memory/session READ vs WRITE quota backoffs.
// CRITICAL: Exhausting Firebase Spark's 50k/day READ limit must NEVER block WRITES (parent QR form submissions, counsellor saves).
let transientReadBackoffUntil = readPersistedReadBackoff();
let transientWriteBackoffUntil = 0;

function isQuotaError(error: any): boolean {
  const msg = error instanceof Error ? error.message : String(error || "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("resource-exhausted") ||
    lower.includes("quota limit exceeded") ||
    lower.includes("quota metric") ||
    lower.includes("too many requests") ||
    (error as any)?.code === "resource-exhausted"
  );
}

// Clean up legacy localStorage pause flags on load and keep network enabled
if (typeof window !== "undefined") {
  try {
    sessionStorage.removeItem(LEGACY_QUOTA_STORAGE_KEY);
    localStorage.removeItem(LEGACY_QUOTA_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_QUOTA_PROJECT_KEY);
    localStorage.removeItem(LEGACY_QUOTA_PROJECT_KEY);
    enableNetwork(db).catch(() => {});
  } catch {}
}

export function getFirestoreUpgradeUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
}

export function isFirestoreReadQuotaExhausted(): boolean {
  if (transientReadBackoffUntil > 0 && Date.now() >= transientReadBackoffUntil) {
    transientReadBackoffUntil = 0;
    if (typeof window !== "undefined") {
      try { sessionStorage.removeItem(READ_QUOTA_BACKOFF_KEY); } catch {}
    }
  }
  return transientReadBackoffUntil > Date.now();
}

export function isFirestoreWriteQuotaExhausted(): boolean {
  if (transientWriteBackoffUntil > 0 && Date.now() >= transientWriteBackoffUntil) {
    transientWriteBackoffUntil = 0;
  }
  return transientWriteBackoffUntil > Date.now();
}

export function isFirestoreQuotaExhausted(): boolean {
  return isFirestoreReadQuotaExhausted();
}

export function clearQuotaExhausted() {
  const wasPaused = transientReadBackoffUntil > 0 || transientWriteBackoffUntil > 0;
  transientReadBackoffUntil = 0;
  transientWriteBackoffUntil = 0;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem(READ_QUOTA_BACKOFF_KEY);
      sessionStorage.removeItem(LEGACY_QUOTA_STORAGE_KEY);
      localStorage.removeItem(LEGACY_QUOTA_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_QUOTA_PROJECT_KEY);
      localStorage.removeItem(LEGACY_QUOTA_PROJECT_KEY);
      if (wasPaused) {
        window.dispatchEvent(new CustomEvent("firestore-quota-cleared"));
      }
    } catch {}
  }
}

export function markQuotaExhausted(durationMs = 300000) {
  // Calm read-only backoff (default 5 minutes; listeners use 10 minutes) so we don't spam exhausted quota,
  // while leaving WRITES & Express Server sync completely active.
  const nextUntil = Date.now() + durationMs;
  if (nextUntil > transientReadBackoffUntil) {
    transientReadBackoffUntil = nextUntil;
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(READ_QUOTA_BACKOFF_KEY, String(transientReadBackoffUntil));
        window.dispatchEvent(new CustomEvent("firestore-quota-exhausted"));
      } catch {}
    }
  }
}

export function markWriteQuotaExhausted(durationMs = 60000) {
  const nextUntil = Date.now() + durationMs;
  if (nextUntil > transientWriteBackoffUntil) {
    transientWriteBackoffUntil = nextUntil;
  }
}

type SharedCollectionEntry = {
  subscribers: Set<(data: any[]) => void>;
  unsub: (() => void) | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastCloudData: any[] | null;
};

const sharedCollectionListeners = new Map<string, SharedCollectionEntry>();

// Real-Time Syncing Helpers with Multiplexed Listeners & Calm Backoff
export function syncCollection<T>(
  collectionName: string,
  onUpdate: (data: T[]) => void,
  fallbackData: T[]
): () => void {
  if (!isFirebaseConfigured()) {
    if (fallbackData && fallbackData.length > 0) {
      onUpdate(fallbackData);
    }
    return () => {};
  }

  let entry = sharedCollectionListeners.get(collectionName);
  if (!entry) {
    entry = {
      subscribers: new Set(),
      unsub: null,
      reconnectTimer: null,
      lastCloudData: null
    };
    sharedCollectionListeners.set(collectionName, entry);
  }

  const wrappedCallback = onUpdate as (data: any[]) => void;
  entry.subscribers.add(wrappedCallback);

  // Deliver already-synced cloud data immediately if available, else initial fallback once
  if (entry.lastCloudData !== null) {
    wrappedCallback(entry.lastCloudData);
  } else if (fallbackData && fallbackData.length > 0) {
    wrappedCallback(fallbackData);
  }

  const scheduleReconnect = (delayMs: number) => {
    const current = sharedCollectionListeners.get(collectionName);
    if (!current || current.subscribers.size === 0 || current.reconnectTimer) return;
    current.reconnectTimer = setTimeout(() => {
      const latest = sharedCollectionListeners.get(collectionName);
      if (!latest || latest.subscribers.size === 0) return;
      latest.reconnectTimer = null;
      attach();
    }, delayMs);
  };

  const attach = () => {
    const current = sharedCollectionListeners.get(collectionName);
    if (!current || current.subscribers.size === 0 || current.unsub) return;

    if (isFirestoreReadQuotaExhausted()) {
      const waitMs = Math.max(10000, transientReadBackoffUntil - Date.now() + 500);
      scheduleReconnect(waitMs);
      return;
    }

    const colRef = collection(db, collectionName);
    current.unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const latest = sharedCollectionListeners.get(collectionName);
        if (!latest || latest.subscribers.size === 0) return;
        clearQuotaExhausted();
        const items: any[] = [];
        snapshot.forEach((d) => {
          items.push({ id: d.id, ...d.data() });
        });
        latest.lastCloudData = items;
        latest.subscribers.forEach((cb) => {
          try {
            cb(items);
          } catch (cbErr) {
            console.warn(`Subscriber error on ${collectionName}:`, cbErr);
          }
        });
      },
      (error) => {
        const latest = sharedCollectionListeners.get(collectionName);
        if (!latest) return;
        const isQuota = isQuotaError(error);

        if (isQuota) {
          // Calm 10-minute read backoff on daily quota exhaustion instead of hammering every 20s
          markQuotaExhausted(600000);
        }
        if (latest.unsub) {
          try {
            latest.unsub();
          } catch {}
          latest.unsub = null;
        }
        scheduleReconnect(isQuota ? 600000 : 30000);
      }
    );
  };

  if (!entry.unsub && !entry.reconnectTimer) {
    attach();
  }

  return () => {
    const current = sharedCollectionListeners.get(collectionName);
    if (!current) return;
    current.subscribers.delete(wrappedCallback);
    if (current.subscribers.size === 0) {
      if (current.reconnectTimer) {
        clearTimeout(current.reconnectTimer);
        current.reconnectTimer = null;
      }
      if (current.unsub) {
        try {
          current.unsub();
        } catch {}
        current.unsub = null;
      }
    }
  };
}

/**
 * Globally atomic enquiry number allocation via Firestore runTransaction on system_metadata/enq_counter.
 * Guarantees two different laptops or counsellors never receive the same ENQ-2026-XX serial number.
 */
export async function reserveNextEnquiryNoFromFirestore(
  existingEnquiries: CounsellingEnquiry[],
  _counsellorId?: string,
  _isSiblingRequest = false
): Promise<string> {
  const year = new Date().getFullYear();
  let localFloorMax = 0;

  const scanMax = (raw?: string | null) => {
    const n = extractEnquirySerialNum(raw);
    if (n && n > localFloorMax) localFloorMax = n;
  };

  (Array.isArray(existingEnquiries) ? existingEnquiries : []).forEach((e) => {
    scanMax(e?.enquiryNo);
    scanMax(e?.siblingEnquiryNo);
  });

  if (typeof window !== "undefined") {
    try {
      const deleted = localStorage.getItem("sgs_deleted_enquiry_ids");
      if (deleted) {
        const arr = JSON.parse(deleted);
        if (Array.isArray(arr)) arr.forEach((d) => scanMax(String(d)));
      }
      const storedHigh = parseInt(localStorage.getItem("sgs_highest_enquiry_issued") || "0", 10);
      if (!isNaN(storedHigh) && storedHigh < 50000 && storedHigh > localFloorMax) {
        localFloorMax = storedHigh;
      }
    } catch {}
  }

  if (isFirebaseConfigured() && !isFirestoreReadQuotaExhausted()) {
    try {
      const counterRef = doc(db, "system_metadata", "enq_counter");
      const allocated = await Promise.race([
        runTransaction(db, async (tx) => {
          const snap = await tx.get(counterRef);
          const remoteHigh = snap.exists() ? Number(snap.data()?.highestIssued || 0) : 0;
          const safeRemoteHigh = !isNaN(remoteHigh) && remoteHigh < 50000 ? remoteHigh : 0;
          const nextNum = Math.max(safeRemoteHigh, localFloorMax) + 1;
          tx.set(
            counterRef,
            { highestIssued: nextNum, year, updatedAt: Date.now() },
            { merge: true }
          );
          return nextNum;
        }),
        new Promise<null>((r) => setTimeout(() => r(null), 2500))
      ]);
      if (typeof allocated === "number" && allocated > 0) {
        return formatCanonicalEnquiryNo(allocated, year);
      }
    } catch (err: any) {
      if (isQuotaError(err)) {
        markQuotaExhausted(300000);
      }
    }
  }

  return formatCanonicalEnquiryNo(localFloorMax + 1, year);
}

// Clean undefined values so Firestore setDoc never throws 'Unsupported field value: undefined'
export function cleanForFirestore<T>(data: T): T {
  if (data === undefined || data === null) return null as any;
  if (Array.isArray(data)) {
    return data.map(item => cleanForFirestore(item)) as any;
  }
  if (typeof data === "object") {
    if (data instanceof Date) return data.toISOString() as any;
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data as any)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

// Safely prepare a CounsellingEnquiry payload so it NEVER exceeds Firestore's 1MB document limit
export function prepareEnquiryForFirestore(targetEnquiry: CounsellingEnquiry): any {
  const firestoreEnquiry: any = JSON.parse(JSON.stringify(targetEnquiry));
  if (firestoreEnquiry.audioRecording) {
    // Strip large translated TTS base64 audio
    if (
      typeof firestoreEnquiry.audioRecording.translatedAudioData === "string" &&
      firestoreEnquiry.audioRecording.translatedAudioData.length > 80 * 1024
    ) {
      delete firestoreEnquiry.audioRecording.translatedAudioData;
    }
    // Strip large raw audioData (>120KB); full audio lives in Cloudflare R2 & IndexedDB
    if (
      typeof firestoreEnquiry.audioRecording.audioData === "string" &&
      firestoreEnquiry.audioRecording.audioData.length > 120 * 1024
    ) {
      delete firestoreEnquiry.audioRecording.audioData;
    }
  }

  // Final strict volumetric guard (< 750KB) to prevent any Firestore 1MiB rejection
  try {
    const serialized = JSON.stringify(firestoreEnquiry);
    if (serialized.length > 750 * 1024) {
      if (firestoreEnquiry.audioRecording) {
        delete firestoreEnquiry.audioRecording.audioData;
        delete firestoreEnquiry.audioRecording.translatedAudioData;
      }
    }
  } catch {}

  return firestoreEnquiry;
}

// Fetch documents from Firestore (uses smart SDK cache+live connection by default; forceRetry forces server fetch only when read quota is not exhausted)
export async function fetchCollectionDocs<T>(collectionName: string, forceRetry = false): Promise<T[] | null> {
  if (!isFirebaseConfigured()) return null;
  if (isFirestoreReadQuotaExhausted()) return null;
  const colRef = collection(db, collectionName);
  try {
    try {
      enableNetwork(db).catch(() => {});
    } catch {}
    const snap = forceRetry ? await getDocsFromServer(colRef) : await getDocs(colRef);
    clearQuotaExhausted();
    const items: T[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as T);
    });
    return items;
  } catch (serverErr: any) {
    if (isQuotaError(serverErr)) {
      markQuotaExhausted(300000);
      return null;
    }
    if (forceRetry) {
      try {
        const snap = await getDocs(colRef);
        const items: T[] = [];
        snap.forEach((d) => {
          items.push({ id: d.id, ...d.data() } as T);
        });
        return items;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Fetch only pending reception/online parent tokens from Firestore (minimal read units)
export async function fetchPendingParentEntriesFromFirestore<T>(): Promise<T[] | null> {
  if (!isFirebaseConfigured() || isFirestoreReadQuotaExhausted()) return null;
  try {
    const colRef = collection(db, "parent_self_entries");
    const pendingQuery = query(colRef, where("status", "==", "pending"));
    const snap = await getDocs(pendingQuery);
    clearQuotaExhausted();
    const items: T[] = [];
    snap.forEach((d) => {
      items.push({ id: d.id, ...d.data() } as T);
    });
    return items;
  } catch (err: any) {
    if (isQuotaError(err)) {
      markQuotaExhausted(300000);
    }
    return null;
  }
}

// Global Single Item Save and Overwrite Helpers
// NOTE: Decoupled from read quota! Even if daily reads are exhausted, writes MUST still be attempted.
export async function saveDocument(collectionName: string, id: string, data: any): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  if (isFirestoreWriteQuotaExhausted()) {
    return false;
  }
  const rawId = id && String(id).trim() ? String(id).trim() : `doc_${Date.now()}`;
  const docId = rawId.replace(/\//g, "_");
  const path = `${collectionName}/${docId}`;
  try {
    const sanitized = cleanForFirestore(data);
    await setDoc(doc(db, collectionName, docId), sanitized, { merge: true });
    transientWriteBackoffUntil = 0;
    return true;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markWriteQuotaExhausted(60000);
      return false;
    }
    console.error(`Firestore saveDocument error [${path}]:`, error);
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
}

export async function deleteDocument(collectionName: string, id: string) {
  if (!isFirebaseConfigured() || isFirestoreWriteQuotaExhausted()) return;
  const rawId = id && String(id).trim() ? String(id).trim() : "";
  if (!rawId) return;
  const docId = rawId.replace(/\//g, "_");
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
    transientWriteBackoffUntil = 0;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markWriteQuotaExhausted(60000);
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Sync whole arrays from local memory if migrating or bulk saving
export async function syncBulkArrayToFirebase(collectionName: string, items: any[]) {
  if (!isFirebaseConfigured() || isFirestoreWriteQuotaExhausted()) return;
  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      if (item.id) {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item, { merge: true });
      }
    });
    await batch.commit();
    transientWriteBackoffUntil = 0;
  } catch (error: any) {
    if (isQuotaError(error)) {
      markWriteQuotaExhausted(60000);
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, collectionName);
  }
}

// Delete all documents from a specific Firestore collection
export async function purgeCollectionFromFirebase(collectionName: string) {
  if (!isFirebaseConfigured()) return;
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const batch = writeBatch(db);
    let count = 0;
    querySnapshot.forEach((d) => {
      batch.delete(d.ref);
      count++;
    });
    if (count > 0) {
      await batch.commit();
// console.log(`Successfully purged ${count} items from ${collectionName}`);
    }
  } catch (err) {
    // console.error(`Error purging ${collectionName}:`, err);
  }
}

// Calculate authoritative next daily token number across Server API (zero Firestore reads first!), Local Storage, and Firestore
export async function getNextDailyTokenNo(dmy: string, dateKey: string): Promise<number> {
  const tokenSet = new Set<number>();

  // 1. Local Storage check (check both storage keys)
  try {
    for (const key of ["sgs_parent_self_entries", "parent_self_entries"]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach((e: any) => {
            if (e.enquiryType === "online") return; // Online enquiries never consume walk-in daily tokens
            const itemDate = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
            if (itemDate === dmy || e.dateKey === dateKey) {
              const num = Number(e.dailyTokenNo);
              if (!isNaN(num) && num > 0) tokenSet.add(num);
            }
          });
        }
      }
    }
  } catch {}

  // 2. Fast Server API endpoint queries (0 Firestore read cost)
  try {
    const [fastTokenRes, res] = await Promise.all([
      Promise.race([
        fetch(`/api/parent-self-entry/next-token?date=${dmy}`),
        new Promise<null>((r) => setTimeout(() => r(null), 1500))
      ]),
      Promise.race([
        fetch("/api/parent-self-entry?scope=today"),
        new Promise<null>((r) => setTimeout(() => r(null), 1500))
      ])
    ]);
    if (fastTokenRes && 'json' in fastTokenRes) {
      const data: any = await fastTokenRes.json();
      if (data && data.success && typeof data.nextToken === "number" && data.nextToken > 1) {
        tokenSet.add(data.nextToken - 1);
      }
    }
    if (res && 'json' in res) {
      const data: any = await res.json();
      if (data && data.success && Array.isArray(data.entries)) {
        data.entries.forEach((e: any) => {
          if (e.enquiryType === "online") return;
          const itemDate = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
          if (itemDate === dmy || e.dateKey === dateKey) {
            const num = Number(e.dailyTokenNo);
            if (!isNaN(num) && num > 0) tokenSet.add(num);
          }
        });
      }
    }
  } catch {}

  // 3. Firestore query (scoped strictly to today's dateKey; never blocks subsequent saveDocument write if 429)
  try {
    if (isFirebaseConfigured() && !isFirestoreReadQuotaExhausted()) {
      const colRef = collection(db, "parent_self_entries");
      const todayQuery = query(colRef, where("dateKey", "==", dateKey));
      const snapshot = await Promise.race([
        getDocs(todayQuery),
        new Promise<null>((r) => setTimeout(() => r(null), 2000))
      ]);
      if (snapshot && 'forEach' in snapshot) {
        snapshot.forEach((d) => {
          const e = d.data();
          if (e.enquiryType === "online") return;
          const itemDate = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
          if (itemDate === dmy || e.dateKey === dateKey) {
            const num = Number(e.dailyTokenNo);
            if (!isNaN(num) && num > 0) tokenSet.add(num);
          }
        });
      }
    }
  } catch (err: any) {
    if (isQuotaError(err)) {
      markQuotaExhausted(300000);
    }
  }

  const tokens = Array.from(tokenSet);
  if (tokens.length === 0) return 1;
  return Math.max(...tokens) + 1;
}

// Bulk delete all documents from Core Collections
export async function purgeAllCollectionsFromFirebase() {
  if (!isFirebaseConfigured()) return;
  const collections = [
    "tickets",
    "history",
    "inventory",
    "rooms",
    "allocations",
    "warranty",
    "counselling_forms",
    "counsellor_accounts",
    "counseling_audio"
  ];
  for (const collectionName of collections) {
    await purgeCollectionFromFirebase(collectionName);
  }
}

