import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {}

if (typeof window !== "undefined") {
  const isFirestoreAssertion = (err: any) => {
    const str = String(err?.message || err?.reason?.message || err?.reason || err || "");
    return str.includes("INTERNAL ASSERTION FAILED") || str.includes("ca9") || str.includes("b815");
  };

  window.addEventListener("unhandledrejection", (event) => {
    if (isFirestoreAssertion(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("Handled transient Firestore watch stream assertion:", event.reason?.message || event.reason);
    }
  });

  window.addEventListener("error", (event) => {
    if (isFirestoreAssertion(event.error) || isFirestoreAssertion(event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn("Handled transient Firestore stream assertion:", event.message);
    }
  });
}

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let firestoreDb: any;
const dbId = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? firebaseConfig.firestoreDatabaseId
  : "(default)";

try {
  let localCacheCfg: any;
  try {
    localCacheCfg = (typeof window !== "undefined" && typeof indexedDB !== "undefined")
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache();
  } catch {
    localCacheCfg = memoryLocalCache();
  }
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: localCacheCfg,
  }, dbId);
} catch {
  try {
    firestoreDb = getFirestore(app, dbId);
  } catch {
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
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
  }
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
// console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}
