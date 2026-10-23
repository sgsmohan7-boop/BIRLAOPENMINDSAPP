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
  getDoc,
  getDocFromServer,
  writeBatch,
  disableNetwork,
  enableNetwork
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract } from "../types";
import { app, db, auth } from "../lib/firebase";

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

// Real-Time Syncing Helpers
export function syncCollection<T>(
  collectionName: string,
  onUpdate: (data: T[]) => void,
  fallbackData: T[]
): () => void {
  // Immediately provide cached data for instantaneous response on app opening
  if (fallbackData && fallbackData.length > 0) {
    onUpdate(fallbackData);
  }

  if (!isFirebaseConfigured()) {
    return () => {};
  }

  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: T[] = [];
      snapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as T);
      });
      // Deliver authoritative live updates from Firestore
      onUpdate(items);
    },
    (error) => {
      const msg = error instanceof Error ? error.message : String(error || "");
      if (
        msg.includes("resource-exhausted") ||
        msg.includes("Quota limit exceeded") ||
        msg.includes("quota metric") ||
        (error as any)?.code === "resource-exhausted"
      ) {
        markQuotaExhausted();
      }
      if (fallbackData && fallbackData.length > 0) {
        onUpdate(fallbackData);
      }
    }
  );
}

const QUOTA_STORAGE_KEY = "sgs_firestore_quota_exhausted";

export function isFirestoreQuotaExhausted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(QUOTA_STORAGE_KEY) || localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return false;
    const timestamp = parseInt(raw, 10);
    // Quota re-check cooldown: 1 hour
    if (Date.now() - timestamp > 60 * 60 * 1000) {
      sessionStorage.removeItem(QUOTA_STORAGE_KEY);
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markQuotaExhausted() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now()));
    localStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now()));
    window.dispatchEvent(new CustomEvent("firestore-quota-exhausted"));
  } catch {}
}

// Ensure Firestore network is connected on startup
if (typeof window !== "undefined") {
  try {
    enableNetwork(db).catch(() => {});
  } catch {}
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

// Global Single Item Save and Overwrite Helpers
export async function saveDocument(collectionName: string, id: string, data: any) {
  if (!isFirebaseConfigured()) return;
  // If quota was exhausted recently, attempt write but reset if quota is normal
  if (isFirestoreQuotaExhausted()) {
    // Clear quota block on user save attempt to retry write
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(QUOTA_STORAGE_KEY);
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      try {
        enableNetwork(db).catch(() => {});
      } catch {}
    }
  }
  const docId = id && String(id).trim() ? String(id).trim() : `doc_${Date.now()}`;
  const path = `${collectionName}/${docId}`;
  try {
    const sanitized = cleanForFirestore(data);
    await setDoc(doc(db, collectionName, docId), sanitized, { merge: true });
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (
      msg.includes("resource-exhausted") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("quota metric") ||
      error?.code === "resource-exhausted"
    ) {
      markQuotaExhausted();
      return;
    }
    console.error(`Firestore saveDocument error [${path}]:`, error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDocument(collectionName: string, id: string) {
  if (!isFirebaseConfigured() || isFirestoreQuotaExhausted()) return;
  const docId = id && String(id).trim() ? String(id).trim() : "";
  if (!docId) return;
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (
      msg.includes("resource-exhausted") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("quota metric") ||
      error?.code === "resource-exhausted"
    ) {
      markQuotaExhausted();
      return;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Sync whole arrays from local memory if migrating or bulk saving
export async function syncBulkArrayToFirebase(collectionName: string, items: any[]) {
  if (!isFirebaseConfigured() || isFirestoreQuotaExhausted()) return;
  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      if (item.id) {
        const docRef = doc(db, collectionName, item.id);
        batch.set(docRef, item, { merge: true });
      }
    });
    await batch.commit();
  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error || "");
    if (
      msg.includes("resource-exhausted") ||
      msg.includes("Quota limit exceeded") ||
      msg.includes("quota metric") ||
      error?.code === "resource-exhausted"
    ) {
      markQuotaExhausted();
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
