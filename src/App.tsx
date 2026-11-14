import { AnimatedLoading } from "./components/AnimatedLoading";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import AppUpdateNotifier from "./components/AppUpdateNotifier";

// Resilient Lazy Import Wrapper: Automatically retries up to 3 times on Vite dev-server rebuilds or transient network hiccups
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  componentName: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const delays = [400, 1000, 2000];
    let lastError: any;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await factory();
      } catch (err: any) {
        lastError = err;
        if (attempt < delays.length) {
          console.warn(`[DynamicImportRetry] Attempt ${attempt + 1} failed for ${componentName}. Retrying in ${delays[attempt]}ms...`);
          await new Promise(r => setTimeout(r, delays[attempt]));
        }
      }
    }
    console.error(`[DynamicImportRetry] All attempts exhausted for ${componentName}:`, lastError);
    throw lastError;
  });
}

// Lazy-load portals and modals to keep initial bundle ultra-light and boot instantly (<500ms)
const Sidebar = lazyWithRetry(() => import("./components/Sidebar"), "Sidebar");
const Dashboard = lazyWithRetry(() => import("./components/Dashboard"), "Dashboard");
const InventoryMaster = lazyWithRetry(() => import("./components/InventoryMaster"), "InventoryMaster");
const RoomMaster = lazyWithRetry(() => import("./components/RoomMaster"), "RoomMaster");
const EmployeeMaster = lazyWithRetry(() => import("./components/EmployeeMaster"), "EmployeeMaster");
const CounsellingPortal = lazyWithRetry(() => import("./components/CounsellingPortal"), "CounsellingPortal");
const ManagementPortal = lazyWithRetry(() => import("./components/ManagementPortal"), "ManagementPortal");
const WarrantyTracker = lazyWithRetry(() => import("./components/WarrantyTracker"), "WarrantyTracker");
const RaiseTicket = lazyWithRetry(() => import("./components/RaiseTicket"), "RaiseTicket");
const SettingsView = lazyWithRetry(() => import("./components/Settings"), "Settings");
const Analytics = lazyWithRetry(() => import("./components/Analytics"), "Analytics");
const TeacherPortal = lazyWithRetry(() => import("./components/TeacherPortal"), "TeacherPortal");
const AiAssistant = lazyWithRetry(() => import("./components/AiAssistant"), "AiAssistant");
const StudentPortal = lazyWithRetry(() => import("./components/StudentPortal"), "StudentPortal");
const GoogleDriveManager = lazyWithRetry(() => import("./components/GoogleDriveManager"), "GoogleDriveManager");
const CctvNvrStorageModal = lazyWithRetry(() => import("./components/CctvNvrStorageModal"), "CctvNvrStorageModal");
const PortalLinksModal = lazyWithRetry(() => import("./components/PortalLinksModal"), "PortalLinksModal");
const AppInstallModal = lazyWithRetry(() => import("./components/AppInstallModal"), "AppInstallModal");
const ParentFormMobileOnly = lazyWithRetry(() => import("./components/ParentFormMobileOnly"), "ParentFormMobileOnly");
import PortalErrorBoundary from "./components/PortalErrorBoundary";


import { loadData, saveData, calculateExpiryDate, resetToDefaults, clearAllData, loadCounselling, saveCounselling, deduplicateEnquiries, loadCounsellorAccounts, saveCounsellorAccounts, mergeWithDemoEnquiries, mergeWithDefaultCounsellorAccounts, recordDeletedCounsellorAccountId, unrecordDeletedCounsellorAccountId, recordDeletedCounsellorAccountIds, recordDeletedEnquiryId, recordDeletedEnquiryIds, getDeletedEnquiryIds, unmarkDeletedEnquiryId, mergeWithDefaultITStaffAccounts, saveITStaffAccounts, loadITStaffAccounts, recordDeletedITStaffAccountId, getUnsyncedEnquiryIds, markEnquiryUnsynced, unmarkEnquiryUnsynced, loadParentSelfEntries, saveParentSelfEntries } from "./utils/storage";
import { isObsoleteOrDuplicateCounsellorAccount, cleanAndNormalizeCounsellorAccounts, normalizeAllEnquiries, normalizeEnquiryCounsellor, normalizeCounsellorIdentity } from "./utils/counsellorNormalizer";
import { synthesizeAndMergeEnquiries, isSameStudentRecord, extractEnquirySerialNum, formatCanonicalEnquiryNo } from "./utils/enquirySynthesis";
import { AlertTriangle, X, Bell, ArrowRight, RefreshCw, Share2, Smartphone } from "lucide-react";
import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, SchoolBranch, getNextTicketId, getNowFormatted, CounsellingEnquiry, CounsellorAccount, ManagementAccount, loadManagementAccounts, saveManagementAccounts, recordDeletedManagementAccountId, unrecordDeletedManagementAccountId, mergeWithDefaultManagementAccounts, ITStaffAccount, ParentSelfEntry, recordHighestEnquiryNumber } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { 
  syncCollection, 
  saveDocument, 
  deleteDocument, 
  isFirebaseConfigured, 
  syncBulkArrayToFirebase, 
  purgeAllCollectionsFromFirebase,
  isFirestoreQuotaExhausted,
  clearQuotaExhausted,
  fetchCollectionDocs,
  fetchPendingParentEntriesFromFirestore,
  prepareEnquiryForFirestore
} from "./utils/firebase";
import { checkBackupStatus, syncAllToMongoBackup, fetchFromMongoBackup, saveToMongoBackup, deleteFromMongoBackup } from "./utils/backupClient";


export default function App() {
  // Theme state initialization with theme class synchronization
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const saved = localStorage.getItem("santinostech_theme");
      return (saved as "light" | "dark") || "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (theme === "dark") {
      root.classList.add("dark");
      body.classList.add("dark");
    } else {
      root.classList.remove("dark");
      body.classList.remove("dark");
    }
    try {
      localStorage.setItem("santinostech_theme", theme);
    } catch {}

    // Notify Electron about theme change to prevent white flash during refresh!
    if (typeof window !== "undefined" && (window as any).electronAPI?.setTheme) {
      (window as any).electronAPI.setTheme(theme);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Tab-isolated session & tab navigation state retrieval helper
  const getTabSession = () => {
    try {
      if (typeof window === "undefined") return null;
      // Tab-isolated session: read from sessionStorage ONLY so new tabs always start fresh at Login
      const sessionRaw = sessionStorage.getItem("it_pro_session");
      if (sessionRaw) {
        return JSON.parse(sessionRaw);
      }
    } catch {}
    return null;
  };

  const getInitialTab = () => {
    try {
      if (typeof window === "undefined") return "dashboard";
      // 1. Check URL hash first (e.g. #counselling, #management, #inventory, #rooms, etc.)
      if (window.location.hash) {
        const hash = window.location.hash.replace("#", "").trim();
        if (hash) {
          if (hash === "counsellor" || hash === "counselling-dept") return "counselling";
          if (hash === "management-desk" || hash === "management-portal") return "management";
          return hash;
        }
      }
      // 2. Check URL search query params (e.g. ?portal=counselling or ?portal=management)
      const params = new URLSearchParams(window.location.search);
      const urlPortal = params.get("portal") || params.get("tab") || params.get("mode");
      if (urlPortal) {
        if (urlPortal === "counselling" || urlPortal === "counsellor") return "counselling";
        if (urlPortal === "management") return "management";
        if (urlPortal === "teacher") return "teacher-desk";
        if (urlPortal === "admin") return "dashboard";
        return urlPortal;
      }

      // 3. Check clean pathname routing: /counselling, /management, /admin, etc.
      const path = (window.location.pathname || "").toLowerCase().replace(/^\/+/, "").split("/")[0];
      if (path === "counselling" || path === "counsellor") return "counselling";
      if (path === "management") return "management";
      if (path === "teacher" || path === "teachers") return "teacher-desk";
      if (path === "admin" || path === "superadmin") return "dashboard";

      // 4. Check custom domain hostname: e.g. birlaopenmindscounselling.com
      const host = (window.location.hostname || "").toLowerCase();
      if (host.includes("counselling") || host.startsWith("counsellor")) return "counselling";
      if (host.includes("management")) return "management";
      if (host.includes("admin")) return "dashboard";

      // 5. Check sessionStorage (strictly tab-isolated, never cross-tab localStorage)
      const savedTab = sessionStorage.getItem("santinostech_current_tab");
      if (savedTab) return savedTab;

      return "dashboard";
    } catch {
      return "dashboard";
    }
  };

  const checkInitialParentKiosk = () => {
    if (typeof window === "undefined") return false;
    const href = window.location.href.toLowerCase();
    const search = window.location.search.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();

    // Robust check for any mobile QR scanner or link containing parent or kiosk
    return (
      href.includes("parent") ||
      href.includes("kiosk") ||
      search.includes("parent") ||
      search.includes("kiosk") ||
      hash.includes("parent") ||
      hash.includes("kiosk") ||
      path.includes("parent") ||
      path.includes("kiosk")
    );
  };

  const [isParentKioskMode, setIsParentKioskMode] = useState<boolean>(() => checkInitialParentKiosk());

  // Session details states with synchronous initialization
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return getTabSession() !== null;
  });
  const [userBranch, setUserBranch] = useState<SchoolBranch>(() => {
    return getTabSession()?.branch || "Birla Open Minds International School";
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return getTabSession()?.email || "";
  });
  const [userRole, setUserRole] = useState<string>(() => {
    return getTabSession()?.role || "IT Admin";
  });
  const [allowedTabs, setAllowedTabs] = useState<string[] | null>(() => {
    return getTabSession()?.allowedTabs || null;
  });

  const [currentTab, setCurrentTab] = useState<string>(() => {
    return getInitialTab();
  });

  // Sync currentTab to sessionStorage and URL hash so page refresh stays on exact same page in this tab
  useEffect(() => {
    try {
      if (currentTab) {
        sessionStorage.setItem("santinostech_current_tab", currentTab);
        if (typeof window !== "undefined") {
          window.location.hash = `#${currentTab}`;
        }
      }
    } catch {}
  }, [currentTab]);

  // Hash navigation change listener
  useEffect(() => {
    const handleHashChange = () => {
      if (typeof window !== "undefined" && window.location.hash) {
        const hash = window.location.hash.replace("#", "").trim();
        if (hash && hash !== currentTab) {
          setCurrentTab(hash);
        }
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [currentTab]);

  // Security Enforcement for Restricted IT Staff Accounts: Prevent unauthorized URL hash traversal
  useEffect(() => {
    const isMainSuperAdmin = (userEmail || "").toLowerCase().includes("sgsmohan7@gmail.com");
    if (!isMainSuperAdmin && allowedTabs && Array.isArray(allowedTabs) && allowedTabs.length > 0) {
      if (!allowedTabs.includes(currentTab)) {
        console.warn(`[Security Alert] Access denied to tab "${currentTab}". Bouncing to authorized tab "${allowedTabs[0]}".`);
        setCurrentTab(allowedTabs[0]);
      }
    }
  }, [currentTab, allowedTabs, userEmail]);

  // Proactively wipe any legacy cross-tab session leakage from localStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("it_pro_session");
      localStorage.removeItem("santinostech_current_tab");
    } catch {}
  }

  // Core database tables states (synchronously initialized from storage/demo defaults)
  const [tickets, setTickets] = useState<Ticket[]>(() => loadData().tickets);
  const [history, setHistory] = useState<Ticket[]>(() => loadData().history);
  const [inventory, setInventory] = useState<InventoryItem[]>(() => loadData().inventory);
  const [rooms, setRooms] = useState<Room[]>(() => loadData().rooms);
  const [allocations, setAllocations] = useState<EmployeeAllocation[]>(() => loadData().allocations);
  const [warranty, setWarranty] = useState<WarrantyContract[]>(() => loadData().warranty);
  const [counsellingEnquiries, setCounsellingEnquiries] = useState<CounsellingEnquiry[]>(() => loadCounselling());
  const [parentSelfEntries, setParentSelfEntries] = useState<ParentSelfEntry[]>(() => loadParentSelfEntries());
  const [counsellorAccounts, setCounsellorAccounts] = useState<CounsellorAccount[]>(() => loadCounsellorAccounts());
  const [managementAccounts, setManagementAccounts] = useState<ManagementAccount[]>(() => loadManagementAccounts());
  const [itStaffAccounts, setItStaffAccounts] = useState<ITStaffAccount[]>(() => loadITStaffAccounts());
  const [isPortalLinksModalOpen, setIsPortalLinksModalOpen] = useState(false);
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(false);

  // Real-time server pull for accounts and counselling data on authenticated load (never on Parent Kiosk mobile QR form)
  useEffect(() => {
    if (isParentKioskMode || !isLoggedIn) return;
    let active = true;
    const fetchServerAccounts = async () => {
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.accounts && active) {
            const extraDeleted = Array.isArray(json.accounts.deletedCounsellors) ? json.accounts.deletedCounsellors : [];
            if (extraDeleted.length > 0) {
              recordDeletedCounsellorAccountIds(extraDeleted);
            }
            if (Array.isArray(json.accounts.counsellors) && json.accounts.counsellors.length > 0) {
              const merged = mergeWithDefaultCounsellorAccounts(json.accounts.counsellors, extraDeleted);
              setCounsellorAccounts(merged);
              saveCounsellorAccounts(merged);
            }

            const extraMgmtDeleted = Array.isArray(json.accounts.deletedManagement) ? json.accounts.deletedManagement : [];
            if (Array.isArray(json.accounts.management) && json.accounts.management.length > 0) {
              const mergedMgmt = mergeWithDefaultManagementAccounts(json.accounts.management, extraMgmtDeleted);
              setManagementAccounts(mergedMgmt);
              saveManagementAccounts(mergedMgmt);
            }

            const extraItDeleted = Array.isArray(json.accounts.deletedItStaff) ? json.accounts.deletedItStaff : [];
            if (Array.isArray(json.accounts.itStaff)) {
              const mergedIT = mergeWithDefaultITStaffAccounts(json.accounts.itStaff, extraItDeleted);
              setItStaffAccounts(mergedIT);
              saveITStaffAccounts(mergedIT);
            }
          }
        }
      } catch (e) {
        console.warn("Server accounts fetch warning:", e);
      }
    };
    fetchServerAccounts();

    // Always pull live server parent_self_entries (0 Firestore reads) and pull /api/counselling when Firestore is unconfigured or read-quota limited
    const fetchLocalServerParentEntries = async () => {
      try {
        const pRes = await fetch("/api/parent-self-entry");
        if (pRes.ok) {
          const pJson = await pRes.json();
          if (pJson.success && Array.isArray(pJson.entries) && active) {
            setParentSelfEntries(prev => {
              const map = new Map<string, ParentSelfEntry>();
              [...(prev || []), ...pJson.entries].forEach((e: ParentSelfEntry) => {
                if (e && e.id) map.set(e.id, { ...map.get(e.id), ...e });
              });
              const merged = Array.from(map.values());
              saveParentSelfEntries(merged);
              return merged;
            });
          }
        }
      } catch {}
    };
    fetchLocalServerParentEntries();

    const fetchLocalServerCounselling = async () => {
      try {
        const res = await fetch("/api/counselling");
        if (res.ok) {
          const json = await res.json();
          if (json.success && active) {
            if (Array.isArray(json.deletedIds) && json.deletedIds.length > 0) {
              recordDeletedEnquiryIds(json.deletedIds);
            }
            const deletedSet = new Set(getDeletedEnquiryIds().map(x => x.toLowerCase()));
            const serverEnquiries = (Array.isArray(json.enquiries) ? json.enquiries : []).filter((e: any) => {
              if (!e) return false;
              const eId = (e.id || "").toLowerCase();
              const eNo = (e.enquiryNo || "").toLowerCase();
              return (!eId || !deletedSet.has(eId)) && (!eNo || !deletedSet.has(eNo));
            });
            setCounsellingEnquiries(prev => {
              const prevFiltered = (prev || []).filter((e: any) => {
                if (!e) return false;
                const eId = (e.id || "").toLowerCase();
                const eNo = (e.enquiryNo || "").toLowerCase();
                return (!eId || !deletedSet.has(eId)) && (!eNo || !deletedSet.has(eNo));
              });
              const combined = deduplicateEnquiries([...serverEnquiries, ...prevFiltered]);
              saveCounselling(combined);
              return combined;
            });
          }
        }
      } catch (e) {
        console.warn("Server counselling fetch warning:", e);
      }
    };

    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (!isFirebaseConfigured() || isFirestoreQuotaExhausted()) {
      fetchLocalServerCounselling();
    } else {
      // If Firestore snapshot hasn't arrived after 3.5s (e.g. quota exhaustion during attach), pull server cache transparently
      fallbackTimer = setTimeout(() => {
        if (active && cloudFormsRef.current === null) {
          fetchLocalServerCounselling();
        }
      }, 3500);
    }

    const handleQuotaExhaustedEvent = () => {
      if (active) {
        fetchLocalServerParentEntries();
        if (cloudFormsRef.current === null) {
          fetchLocalServerCounselling();
        }
      }
    };
    window.addEventListener("firestore-quota-exhausted", handleQuotaExhaustedEvent);

    return () => {
      active = false;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener("firestore-quota-exhausted", handleQuotaExhaustedEvent);
    };
  }, [isLoggedIn, isParentKioskMode]);

  // Expiring Warranty states
  const [expiringWarranties, setExpiringWarranties] = useState<WarrantyContract[]>([]);
  const [showWarrantyBanner, setShowWarrantyBanner] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false);

  const deletedFormsLoadedRef = React.useRef<boolean>(false);
  const backfilledIdsRef = React.useRef<Set<string>>(new Set());
  const normalizedMigratedIdsRef = React.useRef<Set<string>>(new Set());
  const cloudFormsRef = React.useRef<CounsellingEnquiry[] | null>(null);
  const cloudParentsRef = React.useRef<ParentSelfEntry[] | null>(null);

  const isLegacyTestOrGhostItem = (item: Partial<CounsellingEnquiry> | null | undefined): boolean => {
    if (!item || !item.studentName || !item.studentName.trim()) return true;
    const id = String(item.id || "").trim();
    if (/^(TEST_DELETE_CHECK|TEST_DEBUG_|TEST_ENQ_1|TEST-01)/i.test(id)) return true;
    // Ignore stale sravan October demo records from local JSON caches
    const cname = String(item.counsellorName || "").trim().toLowerCase();
    if (cname === "sravan" || String(item.counsellorId || "").toUpperCase() === "COUNSELLOR-02") {
      if (["dd", "aaa", "wwww", "w", "23", "mohanarao", "wasdfghj", "yokshitha", "test1"].includes(item.studentName.trim().toLowerCase())) {
        return true;
      }
    }
    return false;
  };

  // Identify genuinely unsynced local creations/edits that should be preserved & pushed to Firestore without overwriting colliding students
  const collectPendingUnsyncedLocals = React.useCallback(
    (
      cloudForms: CounsellingEnquiry[],
      cloudParents: ParentSelfEntry[],
      prevLocal: CounsellingEnquiry[],
      deletedSet: Set<string>
    ): CounsellingEnquiry[] => {
      if (!Array.isArray(prevLocal) || prevLocal.length === 0) return [];
      const unsyncedIdSet = new Set(getUnsyncedEnquiryIds().map(x => x.toLowerCase()));
      const pending: CounsellingEnquiry[] = [];

      const findHighestSerial = (): number => {
        let maxN = 0;
        [...cloudForms, ...prevLocal, ...pending].forEach(it => {
          const n = extractEnquirySerialNum(it?.enquiryNo);
          if (n && n > maxN) maxN = n;
        });
        deletedSet.forEach(d => {
          const n = extractEnquirySerialNum(d);
          if (n && n > maxN) maxN = n;
        });
        return maxN;
      };

      for (const localItem of prevLocal) {
        if (!localItem || (!localItem.id && !localItem.enquiryNo)) continue;
        if (isLegacyTestOrGhostItem(localItem)) continue;

        const idLower = (localItem.id || "").trim().toLowerCase();
        const noLower = (localItem.enquiryNo || "").trim().toLowerCase();
        if ((idLower && deletedSet.has(idLower)) || (noLower && deletedSet.has(noLower))) continue;

        const isExplicitlyUnsynced = unsyncedIdSet.has(idLower) || unsyncedIdSet.has(noLower);

        // Cached synthetic parent rows (__pe-...) are derived dynamically from parent_self_entries; never re-push as missing forms unless explicitly saved offline
        if (!isExplicitlyUnsynced && (idLower.includes("__pe-") || idLower.includes("__onl-") || localItem.counsellorObservations === "Walk-in parent registered via kiosk" || localItem.counsellorObservations === "Admissions counselling meeting completed")) {
          if (localItem.sourceParentEntryId || idLower.includes("__")) {
            continue;
          }
        }

        // Match against cloudForms by SAME student (never match a different student who happens to hold same ENQ number)
        const cloudSameStudent = cloudForms.find(cf => isSameStudentRecord(cf, localItem));
        if (cloudSameStudent) {
          // Only keep local edit if explicitly marked unsynced AND strictly newer than cloud version
          const localTs = Number(localItem.updatedAtTimestamp || 0);
          const cloudTs = Number(cloudSameStudent.updatedAtTimestamp || 0);
          if (isExplicitlyUnsynced && localTs > cloudTs) {
            pending.push(localItem);
          } else {
            unmarkEnquiryUnsynced(localItem.id, localItem.enquiryNo);
          }
          continue;
        }

        // Also check if already represented by a parent entry in cloudParents (so claimed tokens don't duplicate/push legacy local ghosts)
        const matchesParent = cloudParents.some(cp => isSameStudentRecord(cp, localItem));
        if (matchesParent && !isExplicitlyUnsynced) {
          continue;
        }

        // If cloudForms already loaded and this local record was NOT explicitly marked unsynced offline on this device,
        // treat cloud as authoritative (prevents stale laptop localStorage cache from resurrecting deleted/renamed records)
        if (cloudForms.length > 0 && !isExplicitlyUnsynced) {
          continue;
        }

        // Genuine offline/unsynced student missing from Firestore! Ensure we never collide/overwrite an existing cloud ENQ document
        let safeDocId = (localItem.enquiryNo || localItem.id).trim();
        const collidingCloud = cloudForms.find(
          cf => (cf.id || "").trim().toLowerCase() === safeDocId.toLowerCase() ||
                (cf.enquiryNo || "").trim().toLowerCase() === safeDocId.toLowerCase()
        );
        if (collidingCloud && !isSameStudentRecord(collidingCloud, localItem)) {
          // Safe auto-reallocate only if already occupied in Firestore by a DIFFERENT student
          const nextNum = findHighestSerial() + 1;
          safeDocId = formatCanonicalEnquiryNo(nextNum);
        }

        pending.push({
          ...localItem,
          id: safeDocId,
          enquiryNo: safeDocId
        });
      }

      return pending;
    },
    []
  );

  // Automatically push any genuinely unsynced local enquiries up to Firestore cleanly
  const pushUnsyncedLocalEnquiriesToCloud = React.useCallback(
    (cloudForms: CounsellingEnquiry[], pendingLocals: CounsellingEnquiry[], deletedSet: Set<string>) => {
      if (!isFirebaseConfigured() || !Array.isArray(pendingLocals) || pendingLocals.length === 0) return;

      const cloudByKey = new Map<string, CounsellingEnquiry>();
      (cloudForms || []).forEach((fItem) => {
        if (!fItem) return;
        const fId = (fItem.id || "").trim().toLowerCase();
        const fNo = (fItem.enquiryNo || "").trim().toLowerCase();
        if (fId) cloudByKey.set(fId, fItem);
        if (fNo) cloudByKey.set(fNo, fItem);
      });

      pendingLocals.forEach((localItem) => {
        if (!localItem || (!localItem.id && !localItem.enquiryNo)) return;
        if (isLegacyTestOrGhostItem(localItem)) return;

        const targetDocId = (localItem.enquiryNo || localItem.id).trim();
        const idLower = (localItem.id || "").trim().toLowerCase();
        const noLower = (localItem.enquiryNo || "").trim().toLowerCase();

        if ((idLower && deletedSet.has(idLower)) || (noLower && deletedSet.has(noLower))) {
          return;
        }

        const cloudMatch = (noLower && cloudByKey.get(noLower)) || (idLower && cloudByKey.get(idLower));
        if (cloudMatch && !isSameStudentRecord(cloudMatch, localItem)) {
          return;
        }

        const localTs = Number(localItem.updatedAtTimestamp || 0);
        const cloudTs = Number(cloudMatch?.updatedAtTimestamp || 0);

        if (!cloudMatch || (localTs > 0 && localTs > cloudTs)) {
          const syncSig = `${targetDocId.toLowerCase()}:${localTs}`;
          if (!backfilledIdsRef.current.has(syncSig)) {
            backfilledIdsRef.current.add(syncSig);
            const { normalized } = normalizeEnquiryCounsellor({
              ...localItem,
              id: targetDocId,
              enquiryNo: localItem.enquiryNo || targetDocId
            });
            const safePayload = prepareEnquiryForFirestore(normalized);
            saveDocument("counselling_forms", targetDocId, safePayload)
              .then((ok) => {
                if (ok) {
                  unmarkEnquiryUnsynced(targetDocId, localItem.id, localItem.enquiryNo);
                } else {
                  backfilledIdsRef.current.delete(syncSig);
                }
              })
              .catch(() => {
                backfilledIdsRef.current.delete(syncSig);
              });
          }
        }
      });
    },
    []
  );

  // Recompute unified cloud-authoritative counselling state from Firestore snapshots
  const computeCloudAuthoritativeEnquiries = React.useCallback(
    (
      cloudForms: CounsellingEnquiry[],
      cloudParents: ParentSelfEntry[],
      prevLocal: CounsellingEnquiry[],
      allowPush: boolean
    ): CounsellingEnquiry[] => {
      const deletedIds = getDeletedEnquiryIds();
      const deletedSet = new Set(deletedIds.map(x => x.toLowerCase()));

      const pendingLocals = collectPendingUnsyncedLocals(cloudForms, cloudParents, prevLocal, deletedSet);
      if (allowPush && pendingLocals.length > 0) {
        pushUnsyncedLocalEnquiriesToCloud(cloudForms, pendingLocals, deletedSet);
      }

      // Combine authoritative Firestore forms + genuinely pending unsynced locals, then run deterministic synthesis
      const formsPlusPending = [...cloudForms];
      pendingLocals.forEach(pItem => {
        const idx = formsPlusPending.findIndex(f => isSameStudentRecord(f, pItem));
        if (idx >= 0) {
          formsPlusPending[idx] = pItem;
        } else {
          formsPlusPending.push(pItem);
        }
      });

      const unified = synthesizeAndMergeEnquiries(formsPlusPending, cloudParents, deletedIds);
      const { enquiries: normalized } = normalizeAllEnquiries(unified);
      return normalized;
    },
    [collectPendingUnsyncedLocals, pushUnsyncedLocalEnquiriesToCloud]
  );

  const handleSyncRefresh = async () => {
    setIsSyncRefreshing(true);
    try {
      // 1. Load cached state first
      const localData = loadData();
      setTickets(localData.tickets);
      setHistory(localData.history);
      setInventory(localData.inventory);
      setRooms(localData.rooms);
      setAllocations(localData.allocations);
      setWarranty(localData.warranty);
      const currentLocalEnquiries = loadCounselling();
      setCounsellingEnquiries(currentLocalEnquiries);
      setCounsellorAccounts(loadCounsellorAccounts());

      // 2. Smart Firestore Pull (uses SDK cache+delta to preserve daily quota) + Express Server fallback
      let firestoreEnquiriesSynced = false;
      if (isFirebaseConfigured()) {
        clearQuotaExhausted();
        try {
          const [cloudDeletedDocs, cloudEnquiries, cloudAccounts, cloudPendingParents] = await Promise.all([
            fetchCollectionDocs<{ id: string; enquiryNo?: string }>("deleted_counselling_forms", false),
            fetchCollectionDocs<CounsellingEnquiry>("counselling_forms", false),
            fetchCollectionDocs<CounsellorAccount>("counsellor_accounts", false),
            fetchPendingParentEntriesFromFirestore<ParentSelfEntry>()
          ]);

          if (Array.isArray(cloudDeletedDocs)) {
            const delIds = cloudDeletedDocs.flatMap(d => [d.id, d.enquiryNo]).filter(Boolean) as string[];
            if (delIds.length > 0) recordDeletedEnquiryIds(delIds);
            deletedFormsLoadedRef.current = true;
          }

          if (Array.isArray(cloudPendingParents)) {
            setParentSelfEntries(prev => {
              const map = new Map<string, ParentSelfEntry>();
              [...(prev || []), ...cloudPendingParents].forEach(p => {
                if (p && p.id) map.set(p.id, p);
              });
              const merged = Array.from(map.values());
              cloudParentsRef.current = merged;
              saveParentSelfEntries(merged);
              return merged;
            });
          }

          if (Array.isArray(cloudEnquiries)) {
            firestoreEnquiriesSynced = true;
            cloudFormsRef.current = cloudEnquiries;
            const effectiveParents = cloudParentsRef.current ?? loadParentSelfEntries();
            setCounsellingEnquiries(prev => {
              const baseLocal = prev && prev.length > 0 ? prev : currentLocalEnquiries;
              const unified = computeCloudAuthoritativeEnquiries(
                cloudEnquiries,
                effectiveParents,
                baseLocal,
                deletedFormsLoadedRef.current
              );
              saveCounselling(unified);
              return unified;
            });
          }

          if (Array.isArray(cloudAccounts) && cloudAccounts.length > 0) {
            const mergedAccs = mergeWithDefaultCounsellorAccounts(cloudAccounts);
            setCounsellorAccounts(mergedAccs);
            saveCounsellorAccounts(mergedAccs);
          }
        } catch (_) {}
      }

      // Always sync Express /api/parent-self-entry (0 Firestore reads), and pull /api/counselling if Firestore was unavailable/quota-paused
      try {
        const pRes = await fetch("/api/parent-self-entry");
        if (pRes.ok) {
          const pJson = await pRes.json();
          if (pJson.success && Array.isArray(pJson.entries)) {
            setParentSelfEntries(prev => {
              const map = new Map<string, ParentSelfEntry>();
              [...(prev || []), ...pJson.entries].forEach((e: ParentSelfEntry) => {
                if (e && e.id) map.set(e.id, { ...map.get(e.id), ...e });
              });
              const merged = Array.from(map.values());
              saveParentSelfEntries(merged);
              return merged;
            });
          }
        }
      } catch (_) {}

      if (!firestoreEnquiriesSynced) {
        try {
          const cRes = await fetch("/api/counselling");
          if (cRes.ok) {
            const cJson = await cRes.json();
            if (cJson.success && Array.isArray(cJson.enquiries)) {
              if (Array.isArray(cJson.deletedIds) && cJson.deletedIds.length > 0) {
                recordDeletedEnquiryIds(cJson.deletedIds);
              }
              const deletedSet = new Set(getDeletedEnquiryIds().map(x => x.toLowerCase()));
              const serverItems = cJson.enquiries.filter((e: any) => {
                if (!e) return false;
                const eId = (e.id || "").toLowerCase();
                const eNo = (e.enquiryNo || "").toLowerCase();
                return (!eId || !deletedSet.has(eId)) && (!eNo || !deletedSet.has(eNo));
              });
              setCounsellingEnquiries(prev => {
                const combined = deduplicateEnquiries([...(prev || []), ...serverItems]);
                saveCounselling(combined);
                return combined;
              });
            }
          }
        } catch (_) {}
      }

      try {
        const aRes = await fetch("/api/accounts");
        if (aRes.ok) {
          const aJson = await aRes.json();
          if (aJson.success && aJson.accounts && Array.isArray(aJson.accounts.counsellors)) {
            const extraDeleted = Array.isArray(aJson.accounts.deletedCounsellors) ? aJson.accounts.deletedCounsellors : [];
            const merged = mergeWithDefaultCounsellorAccounts(aJson.accounts.counsellors, extraDeleted);
            setCounsellorAccounts(merged);
            saveCounsellorAccounts(merged);
          }
        }
      } catch (_) {}

      // Settle time for background listeners
      await new Promise((resolve) => setTimeout(resolve, 600));
    } catch (err) {
      console.error("Sync state refresh failed:", err);
    } finally {
      setIsSyncRefreshing(false);
    }
  };

  // Safely maintain latest tickets for background polling without stale closures
  const ticketsRef = React.useRef(tickets);
  const historyRef = React.useRef(history);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Load datasets on mount (skip test Firestore read on unauthenticated/QR screens to save daily quota)
  useEffect(() => {

    // Load initial local data (cached local state or fallback seeds)
    const localData = loadData();
    setTickets(localData.tickets);
    setHistory(localData.history);
    setInventory(localData.inventory);
    setRooms(localData.rooms);
    setAllocations(localData.allocations);
    setWarranty(localData.warranty);
    setCounsellingEnquiries(loadCounselling());
    setCounsellorAccounts(loadCounsellorAccounts());

    // Auto update automatic notification of latest features (v2.1.0)
    const CURRENT_VERSION = "2.1.0";
    const lastNotified = localStorage.getItem("santinostech_last_version");
    if (lastNotified !== CURRENT_VERSION) {
      const timer = setTimeout(() => {
        setShowUpdateModal(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Automatic daily JSON snapshot backup downloader (RESTRICTED: ONLY FOR MAIN SUPER ADMIN ACCOUNT ON MAIN DASHBOARD)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. User must be logged in
    if (!isLoggedIn) return;

    // 2. User MUST strictly be the Main Super Admin account
    const isMainSuperAdmin = 
      (userEmail || "").toLowerCase().includes("sgsmohan7@gmail.com") ||
      (userEmail || "").toLowerCase().includes("superadmin") ||
      (userRole || "").toLowerCase() === "super admin";
    
    if (!isMainSuperAdmin) return;

    // 3. Must ONLY execute when open on Main Super Admin Command Dashboard ("dashboard" or "admin"), NEVER on sub-portals
    if (currentTab !== "dashboard" && currentTab !== "admin") return;

    // 4. Double check URL parameters and pathnames to prevent any automatic download on sub-portals
    const searchParams = new URLSearchParams(window.location.search);
    const portalParam = (searchParams.get("portal") || searchParams.get("mode") || "").toLowerCase();
    if (portalParam && !["admin", "dashboard"].includes(portalParam)) {
      return;
    }

    const pathStr = (window.location.pathname || "").toLowerCase();
    if (["counselling", "management", "teacher", "student", "counsellor"].some(p => pathStr.includes(p))) {
      return;
    }

    const runAutoBackup = () => {
      try {
        const lastBackupStr = localStorage.getItem("sgs_last_auto_backup_download");
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        
        let shouldBackup = false;
        if (!lastBackupStr) {
          shouldBackup = true;
        } else {
          const lastBackupTime = parseInt(lastBackupStr, 10);
          if (isNaN(lastBackupTime) || now - lastBackupTime >= ONE_DAY_MS) {
            shouldBackup = true;
          }
        }

        if (shouldBackup) {
          const dataToBackup = {
            backupVersion: "1.0",
            downloadedAt: new Date().toISOString(),
            tickets,
            history,
            inventory,
            rooms,
            allocations,
            warranty
          };

          const totalRecords = 
            dataToBackup.tickets.length + 
            dataToBackup.history.length + 
            dataToBackup.inventory.length + 
            dataToBackup.rooms.length + 
            dataToBackup.allocations.length + 
            dataToBackup.warranty.length;
          
          if (totalRecords === 0) {
            const localData = loadData();
            dataToBackup.tickets = localData.tickets;
            dataToBackup.history = localData.history;
            dataToBackup.inventory = localData.inventory;
            dataToBackup.rooms = localData.rooms;
            dataToBackup.allocations = localData.allocations;
            dataToBackup.warranty = localData.warranty;
            
            const localRecords = 
              dataToBackup.tickets.length + 
              dataToBackup.history.length + 
              dataToBackup.inventory.length + 
              dataToBackup.rooms.length + 
              dataToBackup.allocations.length + 
              dataToBackup.warranty.length;
              
            if (localRecords === 0) {
              return;
            }
          }

          // Trigger download for Super Admin only
          const jsonString = JSON.stringify(dataToBackup, null, 2);
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement("a");
          const dateStr = new Date().toISOString().slice(0, 10);
          a.style.display = "none";
          a.href = url;
          a.download = `BIRLA_SUPER_ADMIN_DB_SNAPSHOT_${dateStr}.json`;
          
          document.body.appendChild(a);
          a.click();
          
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          localStorage.setItem("sgs_last_auto_backup_download", String(now));
          console.log("Automatic 24-hour Super Admin backup snapshot downloaded successfully.");
        }
      } catch (err) {
        console.error("Failed to perform automatic Super Admin backup download:", err);
      }
    };

    const timer = setTimeout(runAutoBackup, 5000);
    return () => clearTimeout(timer);
  }, [isLoggedIn, userRole, userEmail, currentTab, tickets, history, inventory, rooms, allocations, warranty]);


  // Google Cloud Data Server Real-Time Synchronization (Role-scoped to minimize daily Firestore read units)
  useEffect(() => {
    if (isParentKioskMode || !isLoggedIn) return;
    if (userRole === "Student") return; // Student portal manages transport_fleet directly
    const isFb = isFirebaseConfigured();
    if (isFb) {
      const localData = loadData();
      const isCounsellingOnlyRole = userRole === "Counsellor";
      const isTeacherRole = userRole === "Teacher";
      const isManagementRole = userRole === "Management";
      const isAdminRole = !isCounsellingOnlyRole && !isTeacherRole && !isManagementRole;

      const itUnsubs = isCounsellingOnlyRole ? [] : [
        syncCollection<Ticket>("tickets", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            setTickets([]);
            return;
          }
          if (Array.isArray(items)) {
            setTickets(items);
            saveData({ tickets: items });
            localStorage.setItem("sgs_last_sync_tickets", new Date().toISOString());
          }
        }, localData.tickets),

        syncCollection<Room>("rooms", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            setRooms([]);
            return;
          }
          if (Array.isArray(items)) {
            setRooms(items);
            saveData({ rooms: items });
            localStorage.setItem("sgs_last_sync_rooms", new Date().toISOString());
          }
        }, localData.rooms),

        ...(!isTeacherRole ? [
          syncCollection<InventoryItem>("inventory", (items) => {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              setInventory([]);
              return;
            }
            if (Array.isArray(items)) {
              setInventory(items);
              saveData({ inventory: items });
              localStorage.setItem("sgs_last_sync_inventory", new Date().toISOString());
            }
          }, localData.inventory)
        ] : []),

        ...(isAdminRole ? [
          syncCollection<Ticket>("history", (items) => {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              setHistory([]);
              return;
            }
            if (Array.isArray(items)) {
              setHistory(items);
              saveData({ history: items });
              localStorage.setItem("sgs_last_sync_history", new Date().toISOString());
            }
          }, localData.history),

          syncCollection<EmployeeAllocation>("allocations", (items) => {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              setAllocations([]);
              return;
            }
            if (Array.isArray(items)) {
              setAllocations(items);
              saveData({ allocations: items });
              localStorage.setItem("sgs_last_sync_allocations", new Date().toISOString());
            }
          }, localData.allocations),

          syncCollection<WarrantyContract>("warranty", (items) => {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              setWarranty([]);
              return;
            }
            if (Array.isArray(items)) {
              setWarranty(items);
              saveData({ warranty: items });
              localStorage.setItem("sgs_last_sync_warranty", new Date().toISOString());
            }
          }, localData.warranty)
        ] : [])
      ];

      const counsellingUnsubs = isTeacherRole ? [] : [
        syncCollection<{ id: string; enquiryNo?: string }>("deleted_counselling_forms", (deletedDocs) => {
          if (Array.isArray(deletedDocs)) {
            deletedFormsLoadedRef.current = true;
            if (deletedDocs.length > 0) {
              const rawIds = deletedDocs.flatMap(d => [d.id, d.enquiryNo]).filter(Boolean) as string[];
              recordDeletedEnquiryIds(rawIds);
            }
            if (cloudFormsRef.current !== null) {
              const effectiveParents = cloudParentsRef.current ?? loadParentSelfEntries();
              setCounsellingEnquiries((prev) => {
                const unified = computeCloudAuthoritativeEnquiries(
                  cloudFormsRef.current || [],
                  effectiveParents,
                  prev || [],
                  true
                );
                saveCounselling(unified);
                return unified;
              });
            }
          }
        }, []),

        syncCollection<ParentSelfEntry>("parent_self_entries", (parentDocs) => {
          if (!Array.isArray(parentDocs)) return;
          cloudParentsRef.current = parentDocs;
          setParentSelfEntries(parentDocs);
          saveParentSelfEntries(parentDocs);
          if (cloudFormsRef.current !== null) {
            setCounsellingEnquiries((prev) => {
              const unified = computeCloudAuthoritativeEnquiries(
                cloudFormsRef.current || [],
                parentDocs,
                prev || [],
                deletedFormsLoadedRef.current
              );
              saveCounselling(unified);
              return unified;
            });
          }
        }, []),

        syncCollection<CounsellingEnquiry>("counselling_forms", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            setCounsellingEnquiries([]);
            return;
          }
          const deletedSet = new Set(getDeletedEnquiryIds().map(x => x.toLowerCase()));
          if (!items) return;

          if (items.length === 0) {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              cloudFormsRef.current = [];
              setCounsellingEnquiries([]);
              saveCounselling([]);
            }
            return;
          }

          // Clean up any legacy timestamp-suffixed or explicitly deleted documents in Firestore
          items.forEach(item => {
            if (item.id && /_(\d{10,})$/.test(item.id)) {
              deleteDocument("counselling_forms", item.id);
            }
            const eId = (item.id || "").toLowerCase();
            const eNo = (item.enquiryNo || "").toLowerCase();
            if ((eId && deletedSet.has(eId)) || (eNo && deletedSet.has(eNo))) {
              if (item.id) deleteDocument("counselling_forms", item.id);
              if (item.enquiryNo) deleteDocument("counselling_forms", item.enquiryNo);
            }
          });

          // Standardize ID & normalize counsellor without dropping colliding students
          const nonDeletedItems = items
            .filter(e => e && (!e.id || !deletedSet.has(e.id.toLowerCase())) && (!e.enquiryNo || !deletedSet.has(e.enquiryNo.toLowerCase())))
            .map(e => {
              const preferredDocId = (e.id && e.id.includes("__")) ? e.id : (e.enquiryNo || e.id);
              const base = { ...e, id: preferredDocId };
              const { normalized, wasChanged } = normalizeEnquiryCounsellor(base);
              if (wasChanged && normalized.id && !normalizedMigratedIdsRef.current.has(normalized.id)) {
                normalizedMigratedIdsRef.current.add(normalized.id);
                saveDocument("counselling_forms", normalized.id, prepareEnquiryForFirestore(normalized)).catch(() => {});
              }
              return normalized;
            });

          cloudFormsRef.current = nonDeletedItems;
          const effectiveParents = cloudParentsRef.current ?? loadParentSelfEntries();

          setCounsellingEnquiries((prev) => {
            const unified = computeCloudAuthoritativeEnquiries(
              nonDeletedItems,
              effectiveParents,
              prev || [],
              deletedFormsLoadedRef.current
            );
            saveCounselling(unified);

            fetch("/api/counselling", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(unified)
            }).catch(() => {});
            return unified;
          });
        }, []),

        syncCollection<CounsellorAccount>("counsellor_accounts", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            setCounsellorAccounts([]);
            return;
          }
          // Actively purge any obsolete duplicate documents like "R SOWJANYA" from Firestore
          (items || []).forEach(item => {
            if (isObsoleteOrDuplicateCounsellorAccount(item)) {
              if (item.id) deleteDocument("counsellor_accounts", item.id).catch(() => {});
              if (item.username) deleteDocument("counsellor_accounts", item.username.toLowerCase()).catch(() => {});
            }
          });
          const merged = mergeWithDefaultCounsellorAccounts(items || []);
          const cleaned = cleanAndNormalizeCounsellorAccounts(merged);
          setCounsellorAccounts(cleaned);
          saveCounsellorAccounts(cleaned);
        }, loadCounsellorAccounts()),

        ...(!isCounsellingOnlyRole ? [
          syncCollection<{ id: string; username?: string }>("deleted_counsellor_accounts", (deletedDocs) => {
            if (deletedDocs && deletedDocs.length > 0) {
              const ids = deletedDocs.map(d => d.id || d.username || "").filter(Boolean);
              recordDeletedCounsellorAccountIds(ids);
              setCounsellorAccounts(prev => mergeWithDefaultCounsellorAccounts(prev, ids));
            }
          }, []),

          syncCollection<{ id: string; lastWipedAt?: number }>("system_metadata", (items) => {
            const statusDoc = items.find(i => i.id === "status");
            if (statusDoc?.lastWipedAt) {
              const localLastWipe = localStorage.getItem("sgs_local_last_wiped") 
                ? parseInt(localStorage.getItem("sgs_local_last_wiped")!, 10) 
                : 0;
              if (statusDoc.lastWipedAt > localLastWipe) {
                localStorage.setItem("sgs_local_last_wiped", String(statusDoc.lastWipedAt));
                clearAllData();
                setTickets([]);
                setHistory([]);
                setInventory([]);
                setRooms([]);
                setAllocations([]);
                setWarranty([]);
              }
            }
          }, [])
        ] : []),
      ];

      const itAccountUnsubs = (isCounsellingOnlyRole || isTeacherRole) ? [] : [
        ...(isAdminRole ? [
          syncCollection<{ id: string; username?: string }>("deleted_it_staff_accounts", (deletedDocs) => {
            if (deletedDocs && deletedDocs.length > 0) {
              const ids = deletedDocs.map(d => d.id || d.username || "").filter(Boolean);
              if (ids.length > 0) recordDeletedITStaffAccountId(ids[0]);
            }
          }, []),

          syncCollection<ITStaffAccount>("it_staff_accounts", (items) => {
            if (localStorage.getItem("sgs_wiping_database") === "true") {
              return;
            }
            const merged = mergeWithDefaultITStaffAccounts(items || []);
            setItStaffAccounts(merged);
            saveITStaffAccounts(merged);
          }, loadITStaffAccounts()),

          syncCollection<{ id: string; username?: string }>("deleted_management_accounts", (deletedDocs) => {
            if (deletedDocs && deletedDocs.length > 0) {
              deletedDocs.forEach(d => {
                if (d.id || d.username) recordDeletedManagementAccountId(d.id, d.username);
              });
              setManagementAccounts(prev => mergeWithDefaultManagementAccounts(prev));
            }
          }, [])
        ] : []),

        syncCollection<ManagementAccount>("management_accounts", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            return;
          }
          const merged = mergeWithDefaultManagementAccounts(items || []);
          setManagementAccounts(merged);
          saveManagementAccounts(merged);
        }, loadManagementAccounts()),
      ];

      const unsubs = [...itUnsubs, ...counsellingUnsubs, ...itAccountUnsubs];

      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    }
  }, [isLoggedIn, isParentKioskMode, userRole]);

  // Sync utility to update documents on Firestore and process deletions with MongoDB dual-write
  const syncUpdates = <T extends { id: string }>(
    col: string,
    newList: T[],
    oldList: T[]
  ) => {
    // 1. Local Storage persistence
    saveData({ [col]: newList });

    const newKeys = new Set(newList.map((i) => i.id));
    const oldMap = new Map((oldList || []).map((i) => [i.id, i]));

    // 2. Principal Firestore sync (Only write items that actually changed; decoupled from read quota)
    if (isFirebaseConfigured()) {
      newList.forEach((item) => {
        const prev = oldMap.get(item.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
          saveDocument(col, item.id, item);
        }
      });
      oldList.forEach((item) => {
        if (!newKeys.has(item.id)) {
          deleteDocument(col, item.id);
        }
      });
    }

    // 3. Mirror to Active Online Replication Node (MongoDB Cluster0)
    newList.forEach((item) => {
      const prev = oldMap.get(item.id);
      if (!prev || JSON.stringify(prev) !== JSON.stringify(item)) {
        saveToMongoBackup(col, item);
      }
    });
    oldList.forEach((item) => {
      if (!newKeys.has(item.id)) {
        deleteFromMongoBackup(col, item.id);
      }
    });
  };

  const handleImportFromBackup = (data: {
    tickets: Ticket[];
    history: Ticket[];
    inventory: InventoryItem[];
    rooms: Room[];
    allocations: EmployeeAllocation[];
    warranty: WarrantyContract[];
  }) => {
    saveData(data);

    setTickets(data.tickets);
    setHistory(data.history);
    setInventory(data.inventory);
    setRooms(data.rooms);
    setAllocations(data.allocations);
    setWarranty(data.warranty);

    if (isFirebaseConfigured()) {
      syncBulkArrayToFirebase("tickets", data.tickets);
      syncBulkArrayToFirebase("history", data.history);
      syncBulkArrayToFirebase("inventory", data.inventory);
      syncBulkArrayToFirebase("rooms", data.rooms);
      syncBulkArrayToFirebase("allocations", data.allocations);
      syncBulkArrayToFirebase("warranty", data.warranty);
    }
  };

  // Update global tickets array + auto persistence
  const handleUpdateTickets = (
    tkts: Ticket[],
    hst?: Ticket[],
    inv?: InventoryItem[],
    rms?: Room[],
    allocs?: EmployeeAllocation[]
  ) => {
    syncUpdates("tickets", tkts, tickets);
    setTickets(tkts);

    if (hst) {
      syncUpdates("history", hst, history);
      setHistory(hst);
    }
    if (inv) {
      syncUpdates("inventory", inv, inventory);
      setInventory(inv);
    }
    if (rms) {
      syncUpdates("rooms", rms, rooms);
      setRooms(rms);
    }
    if (allocs) {
      syncUpdates("allocations", allocs, allocations);
      setAllocations(allocs);
    }
  };

  // Update other arrays + persistence
  const handleUpdateInventory = (inv: InventoryItem[]) => {
    syncUpdates("inventory", inv, inventory);
    setInventory(inv);
  };

  const handleUpdateRooms = (rms: Room[]) => {
    syncUpdates("rooms", rms, rooms);
    setRooms(rms);
  };

  const handleUpdateAllocations = (allocs: EmployeeAllocation[], inv?: InventoryItem[]) => {
    syncUpdates("allocations", allocs, allocations);
    setAllocations(allocs);
    if (inv) {
      syncUpdates("inventory", inv, inventory);
      setInventory(inv);
    }
  };

  const handleUpdateWarranty = (war: WarrantyContract[]) => {
    syncUpdates("warranty", war, warranty);
    setWarranty(war);
  };

  const handleSaveCounselling = (enquiry: CounsellingEnquiry) => {
    const saveTimestamp = Date.now();
    // Guard against ENQ-number collisions with a DIFFERENT student in cloud or current state
    let resolvedNo = (enquiry.enquiryNo || enquiry.id || "").trim();
    const knownPool = cloudFormsRef.current || counsellingEnquiries;
    if (resolvedNo) {
      const colliding = knownPool.find(
        e => e && ((e.id || "").trim().toLowerCase() === resolvedNo.toLowerCase() || (e.enquiryNo || "").trim().toLowerCase() === resolvedNo.toLowerCase())
      );
      if (colliding && !isSameStudentRecord(colliding, enquiry)) {
        let maxN = 0;
        knownPool.forEach(e => {
          const n = extractEnquirySerialNum(e?.enquiryNo);
          if (n && n > maxN) maxN = n;
        });
        resolvedNo = formatCanonicalEnquiryNo(maxN + 1);
      }
    }
    const serial = extractEnquirySerialNum(resolvedNo);
    if (serial) recordHighestEnquiryNumber(serial);

    const cleanEnquiry: CounsellingEnquiry = {
      ...enquiry,
      id: resolvedNo || enquiry.id,
      enquiryNo: resolvedNo || enquiry.enquiryNo,
      updatedAtTimestamp: saveTimestamp
    };

    // Unmark from deleted records & track pending cloud sync until confirmed in Firestore
    unmarkDeletedEnquiryId(cleanEnquiry.id, cleanEnquiry.enquiryNo);
    markEnquiryUnsynced(cleanEnquiry.id, cleanEnquiry.enquiryNo);
    if (isFirebaseConfigured()) {
      deleteDocument("deleted_counselling_forms", (cleanEnquiry.id || "").toLowerCase());
      if (cleanEnquiry.enquiryNo) {
        deleteDocument("deleted_counselling_forms", cleanEnquiry.enquiryNo.toLowerCase());
      }
    }

    // Helper function to persist to Firestore safely without exceeding 1MB doc size
    const saveToFirestore = (targetEnquiry: CounsellingEnquiry) => {
      if (!isFirebaseConfigured()) return;
      const firestoreEnquiry = prepareEnquiryForFirestore(targetEnquiry);
      const targetDocId = (targetEnquiry.enquiryNo || targetEnquiry.id || `ENQ-${Date.now()}`).trim();
      const syncSig = `${targetDocId.toLowerCase()}:${targetEnquiry.updatedAtTimestamp || saveTimestamp}`;
      backfilledIdsRef.current.add(syncSig);

      // Strictly save 1 document per form into canonical counselling_forms collection
      saveDocument("counselling_forms", targetDocId, firestoreEnquiry)
        .then((ok) => {
          if (ok) {
            unmarkEnquiryUnsynced(targetDocId, targetEnquiry.id, targetEnquiry.enquiryNo);
          } else {
            backfilledIdsRef.current.delete(syncSig);
          }
        })
        .catch(() => {
          backfilledIdsRef.current.delete(syncSig);
        });

      // Clean up legacy document if targetEnquiry previously had a timestamp-suffixed ID
      if (enquiry.id && enquiry.id !== targetDocId && /_(\d{10,})$/.test(enquiry.id)) {
        deleteDocument("counselling_forms", enquiry.id);
      }
    };

    // 1. Immediately persist synchronously to LocalStorage & update state
    setCounsellingEnquiries((prev) => {
      const idx = prev.findIndex((e) =>
        isSameStudentRecord(e, cleanEnquiry) &&
        ((e.id === cleanEnquiry.id) || (cleanEnquiry.enquiryNo && e.enquiryNo && e.enquiryNo.toLowerCase() === cleanEnquiry.enquiryNo.toLowerCase()))
      );
      let nextList: CounsellingEnquiry[];
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = cleanEnquiry;
      } else {
        nextList = [cleanEnquiry, ...prev];
      }

      // If this enquiry has audio recording and is part of a sibling admission, ensure linked sibling also gets the shared recording
      if (cleanEnquiry.audioRecording && (cleanEnquiry.isSibling || cleanEnquiry.siblingEnquiryNo)) {
        const sibIdx = nextList.findIndex((o) => 
          o && o.id !== cleanEnquiry.id && (
            (cleanEnquiry.siblingEnquiryNo && (o.enquiryNo || o.id).toLowerCase() === cleanEnquiry.siblingEnquiryNo.toLowerCase()) ||
            (o.siblingEnquiryNo && (cleanEnquiry.enquiryNo || cleanEnquiry.id).toLowerCase() === o.siblingEnquiryNo.toLowerCase())
          )
        );
        if (sibIdx >= 0 && !nextList[sibIdx].audioRecording) {
          const linkedSib: CounsellingEnquiry = {
            ...nextList[sibIdx],
            updatedAtTimestamp: saveTimestamp,
            audioRecording: {
              ...cleanEnquiry.audioRecording,
              id: `${cleanEnquiry.audioRecording.id || nextList[sibIdx].id || nextList[sibIdx].enquiryNo}-SIB`,
              enquiryNo: nextList[sibIdx].enquiryNo || nextList[sibIdx].id,
              studentName: nextList[sibIdx].studentName,
              isJointSiblingSession: true,
              jointSiblingNames: cleanEnquiry.audioRecording.jointSiblingNames || `${cleanEnquiry.studentName} & ${nextList[sibIdx].studentName}`
            }
          };
          nextList[sibIdx] = linkedSib;
          saveToFirestore(linkedSib);
        }
      }

      saveCounselling(nextList);
      return nextList;
    });

    // 2. Save to Firestore
    saveToFirestore(cleanEnquiry);

    // 3. Direct Cloudflare R2 Background Upload (Ensures 24/7 global audio access)
    if (enquiry.audioRecording?.audioData && enquiry.audioRecording.audioData.length > 50) {
      const audioPayload = enquiry.audioRecording.audioData;
      const mimeType = enquiry.audioRecording.mimeType || "audio/webm";
      const r2FileName = enquiry.audioRecording.fileName || `${enquiry.enquiryNo || 'ENQ'}_Meeting_${new Date().toISOString().slice(0, 10)}.webm`;
      import("./utils/cloudflareR2Client")
        .then(({ loadR2Credentials, uploadToR2Direct }) => {
          const creds = loadR2Credentials();
          return uploadToR2Direct(creds, r2FileName, audioPayload, mimeType);
        })
        .catch((err) => console.warn("Background R2 audio auto-upload notice:", err));
    }

    // 4. Express Server API sync + Audio File Storage Vault (for Node.js dev environments)
    try {
      const cleanServerEnquiry = { ...enquiry };
      if (cleanServerEnquiry.audioRecording) {
        cleanServerEnquiry.audioRecording = { ...cleanServerEnquiry.audioRecording };
        delete (cleanServerEnquiry.audioRecording as any).audioData;
      }
      fetch("/api/counselling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanServerEnquiry)
      }).catch(() => {});

      // If audio base64 is present, upload to server disk media vault and attach stream URL
      if (enquiry.audioRecording?.audioData && enquiry.audioRecording.audioData.length > 100) {
        fetch("/api/upload-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enquiryNo: enquiry.enquiryNo,
            id: enquiry.id,
            audioBase64: enquiry.audioRecording.audioData,
            filename: enquiry.audioRecording.fileName || `${enquiry.enquiryNo || 'ENQ'}_Meeting_${new Date().toISOString().slice(0, 10)}.webm`,
            meetingTextSummary: enquiry.audioRecording.meetingTextSummary || "",
            durationSeconds: enquiry.audioRecording.durationSeconds,
            counsellorId: enquiry.counsellorId,
            counsellorName: enquiry.counsellorName,
            studentName: enquiry.studentName
          })
        }).then(r => r.json()).then(res => {
          if (res?.success && res?.audioUrl) {
            const updatedEnquiry: CounsellingEnquiry = {
              ...enquiry,
              audioRecording: {
                ...enquiry.audioRecording!,
                storageKey: enquiry.audioRecording?.storageKey || enquiry.audioRecording?.id || enquiry.id,
                driveFileUrl: res.audioUrl,
                driveFileId: enquiry.audioRecording?.driveFileId || enquiry.id
              }
            };
            // Update state & Firestore with real stream URL
            setCounsellingEnquiries(current => {
              const updatedList = current.map(item => item.id === enquiry.id ? updatedEnquiry : item);
              saveCounselling(updatedList);
              return updatedList;
            });
            saveToFirestore(updatedEnquiry);

            // Also persist clean updatedEnquiry to server
            const cleanUpdated = { ...updatedEnquiry };
            if (cleanUpdated.audioRecording?.audioData) {
              cleanUpdated.audioRecording = { ...cleanUpdated.audioRecording };
              delete (cleanUpdated.audioRecording as any).audioData;
            }
            fetch("/api/counselling", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(cleanUpdated)
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch (_) {}
  };

  const handleDeleteCounselling = (id: string) => {
    setCounsellingEnquiries((prev) => {
      const base = prev && prev.length > 0 ? prev : loadCounselling();
      const target = base.find((e) => e.id === id || e.enquiryNo === id);
      if (target) {
        recordDeletedEnquiryId(target.id, target.enquiryNo);
      } else {
        recordDeletedEnquiryId(id);
      }
      const nextList = base.filter((e) => e.id !== id && e.enquiryNo !== id);
      saveCounselling(nextList);

      try {
        fetch(`/api/counselling/${encodeURIComponent(target?.id || id)}`, { method: "DELETE" }).catch(() => {});
      } catch (_) {}

      if (isFirebaseConfigured()) {
        deleteDocument("counselling_forms", id);
        if (target?.id) {
          deleteDocument("counselling_forms", target.id);
        }
        if (target?.enquiryNo) {
          deleteDocument("counselling_forms", target.enquiryNo);
        }

        const delId = (target?.id || id).toLowerCase();
        saveDocument("deleted_counselling_forms", delId, {
          id: delId,
          enquiryNo: (target?.enquiryNo || id).toLowerCase(),
          deletedAt: Date.now()
        });
      }
      return nextList;
    });
  };

  const handleDeleteMultipleCounselling = (ids: string[]) => {
    if (!Array.isArray(ids) || ids.length === 0) return;
    setCounsellingEnquiries((prev) => {
      const base = prev && prev.length > 0 ? prev : loadCounselling();
      const idsSet = new Set(ids);

      base.forEach((e) => {
        if (idsSet.has(e.id) || idsSet.has(e.enquiryNo)) {
          recordDeletedEnquiryId(e.id, e.enquiryNo);
          try {
            fetch(`/api/counselling/${encodeURIComponent(e.id)}`, { method: "DELETE" }).catch(() => {});
          } catch (_) {}

          if (isFirebaseConfigured()) {
            deleteDocument("counselling_forms", e.id);
            if (e.enquiryNo) {
              deleteDocument("counselling_forms", e.enquiryNo);
            }

            const delId = e.id.toLowerCase();
            saveDocument("deleted_counselling_forms", delId, {
              id: delId,
              enquiryNo: (e.enquiryNo || e.id).toLowerCase(),
              deletedAt: Date.now()
            });
          }
        }
      });

      ids.forEach((id) => {
        recordDeletedEnquiryId(id);
        try {
          fetch(`/api/counselling/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
        } catch (_) {}
        if (isFirebaseConfigured()) {
          deleteDocument("counselling_forms", id);
          const delId = id.toLowerCase();
          saveDocument("deleted_counselling_forms", delId, {
            id: delId,
            enquiryNo: id.toLowerCase(),
            deletedAt: Date.now()
          });
        }
      });

      const nextList = base.filter((e) => !idsSet.has(e.id) && !idsSet.has(e.enquiryNo));
      saveCounselling(nextList);
      return nextList;
    });
  };


  const handleSaveCounsellorAccount = (account: CounsellorAccount) => {
    unrecordDeletedCounsellorAccountId(account.id, account.username);

    setCounsellorAccounts((prev) => {
      const base = prev && prev.length > 0 ? prev : loadCounsellorAccounts();
      const idx = base.findIndex((a) => a.id === account.id);
      let nextList: CounsellorAccount[];
      if (idx >= 0) {
        nextList = [...base];
        nextList[idx] = account;
      } else {
        nextList = [...base, account];
      }
      const merged = mergeWithDefaultCounsellorAccounts(nextList);
      saveCounsellorAccounts(merged);
      if (isFirebaseConfigured()) {
        deleteDocument("deleted_counsellor_accounts", (account.id || "").toLowerCase());
        if (account.username) {
          deleteDocument("deleted_counsellor_accounts", account.username.toLowerCase());
        }
        saveDocument("counsellor_accounts", account.id, account);
      }
      try {
        window.dispatchEvent(new Event("counsellor_accounts_updated"));
      } catch {}
      return merged;
    });

    // Persistent server save
    fetch("/api/accounts/counsellor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account)
    }).catch(err => console.warn("Failed to sync counsellor account to server:", err));
  };

  const handleDeleteCounsellorAccount = (id: string) => {
    setCounsellorAccounts((prev) => {
      const base = prev && prev.length > 0 ? prev : loadCounsellorAccounts();
      const target = base.find((a) => a.id === id || a.username.toLowerCase() === id.toLowerCase());
      if (target) {
        recordDeletedCounsellorAccountId(target.id, target.username);
      } else {
        recordDeletedCounsellorAccountId(id);
      }
      const nextList = base.filter((a) => a.id !== id && a.username.toLowerCase() !== id.toLowerCase());
      saveCounsellorAccounts(nextList);
      if (isFirebaseConfigured()) {
        deleteDocument("counsellor_accounts", id);
        if (target?.id) deleteDocument("counsellor_accounts", target.id);
        const delId = (target?.id || id).toLowerCase();
        saveDocument("deleted_counsellor_accounts", delId, {
          id: delId,
          username: (target?.username || id).toLowerCase(),
          deletedAt: Date.now()
        });
      }
      try {
        window.dispatchEvent(new Event("counsellor_accounts_updated"));
      } catch {}
      return nextList;
    });

    // Persistent server delete
    fetch(`/api/accounts/counsellor/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }).catch(err => console.warn("Failed to delete counsellor account on server:", err));
  };

  const handleSaveManagementAccount = (account: ManagementAccount) => {
    unrecordDeletedManagementAccountId(account.id, account.username);
    setManagementAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase());
      let nextList: ManagementAccount[];
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = account;
      } else {
        nextList = [...prev, account];
      }
      saveManagementAccounts(nextList);
      if (isFirebaseConfigured()) {
        deleteDocument("deleted_management_accounts", (account.id || "").toLowerCase());
        deleteDocument("deleted_management_accounts", (account.username || "").toLowerCase());
        saveDocument("management_accounts", account.id || account.username, account);
      }
      return nextList;
    });

    // Persistent server save
    fetch("/api/accounts/management", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(account)
    }).catch(err => console.warn("Failed to sync management account to server:", err));

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("management_accounts_updated"));
    }
  };

  const handleDeleteManagementAccount = (id: string) => {
    setManagementAccounts((prev) => {
      const target = prev.find((a) => a.id === id || a.username.toLowerCase() === id.toLowerCase());
      if (target) {
        recordDeletedManagementAccountId(target.id, target.username);
      } else {
        recordDeletedManagementAccountId(id);
      }
      const nextList = prev.filter((a) => a.id !== id && a.username.toLowerCase() !== id.toLowerCase());
      saveManagementAccounts(nextList);
      if (isFirebaseConfigured()) {
        deleteDocument("management_accounts", id);
        if (target?.id) deleteDocument("management_accounts", target.id);
        const delId = (target?.id || id).toLowerCase();
        saveDocument("deleted_management_accounts", delId, {
          id: delId,
          username: (target?.username || id).toLowerCase(),
          deletedAt: Date.now()
        });
      }
      return nextList;
    });

    // Persistent server delete
    fetch(`/api/accounts/management/${encodeURIComponent(id)}`, {
      method: "DELETE"
    }).catch(err => console.warn("Failed to delete management account on server:", err));
  };

  const handleWipeDatabase = async () => {
    setIsWiping(true);
    localStorage.setItem("sgs_wiping_database", "true");
    try {
      // 1. Instantly clear data in local Storage to []
      const data = clearAllData();
      
      // 2. Instantly reset local React states to reflect changes on UI
      setTickets([]);
      setHistory([]);
      setInventory([]);
      setRooms([]);
      setAllocations([]);
      setWarranty([]);

      // 3. Purge Firestore Collections if connected
      const wipeTimestamp = Date.now();
      localStorage.setItem("sgs_local_last_wiped", String(wipeTimestamp));
      if (isFirebaseConfigured()) {
        await purgeAllCollectionsFromFirebase();
        await saveDocument("system_metadata", "status", {
          lastWipedAt: wipeTimestamp
        });
      }

      // 4. (No MongoDB Mirror)
      // Removed syncToMongoBackup

      // Settle time for subscription snapshot updates to quiet down before refreshing
      await new Promise((resolve) => setTimeout(resolve, 1500));
      localStorage.removeItem("sgs_wiping_database");
      window.location.reload();
    } catch (err) {
      console.error("Wipe failed:", err);
      localStorage.removeItem("sgs_wiping_database");
      window.location.reload();
    } finally {
      setIsWiping(false);
    }
  };

  const handleRestoreDatabaseMock = () => {
    const data = resetToDefaults();
    
    syncUpdates("tickets", data.tickets, tickets);
    syncUpdates("history", data.history, history);
    syncUpdates("inventory", data.inventory, inventory);
    syncUpdates("rooms", data.rooms, rooms);
    syncUpdates("allocations", data.allocations, allocations);
    syncUpdates("warranty", data.warranty, warranty);

    setTickets(data.tickets);
    setHistory(data.history);
    setInventory(data.inventory);
    setRooms(data.rooms);
    setAllocations(data.allocations);
    setWarranty(data.warranty);
  };

  // Dynamically derive automatic warranty items from Inventory Stock registers
  const allWarranties = React.useMemo(() => {
    const autoContracts: WarrantyContract[] = inventory
      .map((item) => {
        const calculatedExpiry = calculateExpiryDate(item.date, item.warranty);
        const isNoCover = !item.warranty || 
                          item.warranty.toLowerCase().includes("no warranty") || 
                          item.warranty.toLowerCase().includes("no warrenty") || 
                          item.warranty.toLowerCase().trim() === "none" ||
                          item.warranty.toLowerCase().trim() === "no" ||
                          item.warranty.toLowerCase().trim() === "n/a" ||
                          item.warranty.toLowerCase().trim() === "na" ||
                          item.warranty.toLowerCase().trim() === "unprotected" ||
                          item.warranty.toLowerCase().trim() === "no active";
        return {
          id: `INV-WAR-${item.id}`,
          itemName: `${item.itemName} (${item.category})`,
          type: (item.warranty || "").toLowerCase().includes("amc") 
            ? ("AMC (Annual Maintenance)" as const) 
            : ("Hardware Warranty" as const),
          expiryDate: isNoCover ? "No Warranty" : calculatedExpiry,
          vendor: item.vendor || "Unknown Supplier",
          registeredOn: item.date,
          isAutoFromInventory: true,
          isNoWarranty: isNoCover
        };
      })
      .filter((w) => !w.isNoWarranty);

    return autoContracts;
  }, [inventory]);

  // Daily check on load/update of warranty contract items
  useEffect(() => {
    if (allWarranties.length > 0) {
      const parseExpiryDate = (dateStr: string): Date | null => {
        if (!dateStr || typeof dateStr !== "string") return null;
        const parts = dateStr.includes("/") ? dateStr.split("/") : dateStr.split("-");
        if (parts.length !== 3) return null;
        const day = parseInt(parts[0].trim(), 10);
        const month = parseInt(parts[1].trim(), 10) - 1;
        const year = parseInt(parts[2].trim(), 10);
        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
        return new Date(year, month, day);
      };

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      sevenDaysLater.setHours(23, 59, 59, 999);

      const expiring = allWarranties.filter((item) => {
        if (item.isNoWarranty) return false; // skip items without active warranty shield
        const expDate = parseExpiryDate(item.expiryDate);
        if (!expDate) return false;
        
        const cleanExp = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        return cleanExp >= today && cleanExp <= sevenDaysLater;
      });

      if (expiring.length > 0) {
        setExpiringWarranties(expiring);
        setShowWarrantyBanner(true);

        if (typeof window !== "undefined" && "Notification" in window) {
          if (Notification.permission === "granted") {
            const listNames = expiring.map(i => i.itemName).slice(0, 3).join(", ");
            const bodyText = expiring.length > 1
              ? `${expiring.length} contracts are expiring in the next 7 days: ${listNames}...`
              : `Warranty for ${listNames} is expiring within 7 days.`;

            new Notification("🛡️ Warranty Service Expiry Warning", {
              body: bodyText,
              icon: "/it_pwa_icon.png"
            });
          }
        }
      } else {
        setExpiringWarranties([]);
        setShowWarrantyBanner(false);
      }
    }
  }, [allWarranties]);

  const handleRequestNotificationPermission = () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted" && expiringWarranties.length > 0) {
          const listNames = expiringWarranties.map(i => i.itemName).slice(0, 3).join(", ");
          const bodyText = expiringWarranties.length > 1
            ? `${expiringWarranties.length} contracts are expiring in the next 7 days: ${listNames}...`
            : `Warranty for ${listNames} is expiring within 7 days.`;

          new Notification("🛡️ Warranty Service Expiry Warning", {
            body: bodyText,
            icon: "/it_pwa_icon.png"
          });
        }
      });
    }
  };

  // Login handler (strictly tab-isolated session)
  const handleLogin = (branch: SchoolBranch, email: string, role: string, allowedTabsParam?: string[] | null) => {
    setUserBranch(branch);
    setUserEmail(email);
    setUserRole(role);
    setIsLoggedIn(true);

    if (allowedTabsParam && Array.isArray(allowedTabsParam)) {
      setAllowedTabs(allowedTabsParam);
      if (allowedTabsParam.length > 0 && !allowedTabsParam.includes(currentTab)) {
        setCurrentTab(allowedTabsParam[0]);
      }
    } else {
      setAllowedTabs(null);
    }

    const sessionObj = { branch, email, role, allowedTabs: allowedTabsParam || null };
    const sessionStr = JSON.stringify(sessionObj);
    try {
      sessionStorage.setItem("it_pro_session", sessionStr);
      localStorage.removeItem("it_pro_session");
      localStorage.removeItem("santinostech_current_tab");
    } catch {}
  };

  // Logout handler
  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail("");
    try {
      sessionStorage.removeItem("it_pro_session");
      sessionStorage.removeItem("santinostech_current_tab");
      sessionStorage.removeItem("sgs_active_counsellor");
      sessionStorage.removeItem("sgs_counsellor_override_id");
      localStorage.removeItem("it_pro_session");
      localStorage.removeItem("santinostech_current_tab");
      localStorage.removeItem("sgs_active_counsellor");
      if (typeof window !== "undefined" && window.location.hash) {
        window.location.hash = "";
      }
    } catch {}
    setCurrentTab("dashboard");
  };

  // Switch tabs
  const renderTabContent = () => {
    switch (currentTab) {
      case "dashboard":
        return (
          <Dashboard
            tickets={tickets}
            history={history}
            inventory={inventory}
            rooms={rooms}
            allocations={allocations}
            onNavigateTab={setCurrentTab}
            updateTickets={handleUpdateTickets}
          />
        );
      case "raise-ticket":
        return (
          <RaiseTicket
            rooms={rooms}
            tickets={tickets}
            history={history}
            updateTickets={(tkts) => handleUpdateTickets(tkts)}
            jumpToTab={setCurrentTab}
          />
        );
      case "inventory":
        return (
          <InventoryMaster
            inventory={inventory}
            updateInventory={handleUpdateInventory}
          />
        );
      case "emp-assets":
        return (
          <EmployeeMaster
            allocations={allocations}
            inventory={inventory}
            rooms={rooms}
            updateAllocations={handleUpdateAllocations}
          />
        );
      case "room-master":
        return (
          <RoomMaster
            rooms={rooms}
            updateRooms={handleUpdateRooms}
            allocations={allocations}
          />
        );
      case "analytics":
        return (
          <Analytics
            tickets={tickets}
            history={history}
            inventory={inventory}
            rooms={rooms}
          />
        );
      case "warranty-tracker":
        return (
          <WarrantyTracker
            warranty={allWarranties}
            inventory={inventory}
            updateWarranty={handleUpdateWarranty}
          />
        );
      case "ai-assistant":
        return <AiAssistant tickets={tickets} />;
      case "management":
      case "management-desk":
      case "management-portal":
        return (
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <ManagementPortal
              enquiries={counsellingEnquiries}
              onSaveEnquiry={handleSaveCounselling}
              onDeleteEnquiry={handleDeleteCounselling}
              counsellorAccounts={counsellorAccounts}
              managementAccounts={managementAccounts}
              onSaveManagementAccount={handleSaveManagementAccount}
              onDeleteManagementAccount={handleDeleteManagementAccount}
              onSaveCounsellorAccount={handleSaveCounsellorAccount}
              onDeleteCounsellorAccount={handleDeleteCounsellorAccount}
              tickets={tickets}
              rooms={rooms}
              inventory={inventory}
              userRole={userRole}
              userEmail={userEmail}
              theme={theme}
              toggleTheme={toggleTheme}
            />
          </div>
        );
      case "counselling":
      case "counsellor":
      case "counselling-dept":
      case "counselling-portal":
        return (
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <CounsellingPortal
              enquiries={counsellingEnquiries}
              parentSelfEntriesProp={parentSelfEntries}
              onParentSelfEntriesChange={setParentSelfEntries}
              onSaveEnquiry={handleSaveCounselling}
              onDeleteEnquiry={handleDeleteCounselling}
              onDeleteMultipleEnquiries={handleDeleteMultipleCounselling}
              counsellorAccounts={counsellorAccounts}
              onSaveCounsellorAccount={handleSaveCounsellorAccount}
              onDeleteCounsellorAccount={handleDeleteCounsellorAccount}
              userRole={userRole}
              userEmail={userEmail}
              onSyncRefresh={handleSyncRefresh}
            />
          </div>
        );
      case "google-drive":
        return (
          <div className="h-full w-full overflow-y-auto custom-scrollbar">
            <GoogleDriveManager
              userEmail={userEmail}
              userRole={userRole}
              counsellingEnquiries={counsellingEnquiries}
              tickets={tickets}
              history={history}
              inventory={inventory}
              rooms={rooms}
              allocations={allocations}
              warranty={warranty}
              onUpdateEnquiry={handleSaveCounselling}
              theme={theme}
            />
          </div>
        );
      case "portal-links":
        return (
          <div className="h-full w-full overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950/10">
            <PortalLinksModal isEmbedded={true} isOpen={true} onClose={() => setCurrentTab("dashboard")} theme={theme} />
          </div>
        );
      case "cloudflare-r2":
        return (
          <div className="h-full w-full overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950/10">
            <CctvNvrStorageModal isEmbedded={true} />
          </div>
        );
      case "settings":
        return (
          <SettingsView
            userEmail={userEmail}
            userRole={userRole}
            onWipeDatabase={handleWipeDatabase}
            onRestoreDatabaseMock={handleRestoreDatabaseMock}
            onImportFromBackup={handleImportFromBackup}
            tickets={tickets}
            history={history}
            inventory={inventory}
            rooms={rooms}
            allocations={allocations}
            warranty={warranty}
          />
        );
      default:
        if (userRole === "Counsellor") {
          return (
            <div className="h-full w-full overflow-y-auto custom-scrollbar">
              <CounsellingPortal
                enquiries={counsellingEnquiries}
                parentSelfEntriesProp={parentSelfEntries}
                onParentSelfEntriesChange={setParentSelfEntries}
                onSaveEnquiry={handleSaveCounselling}
                onDeleteEnquiry={handleDeleteCounselling}
                onDeleteMultipleEnquiries={handleDeleteMultipleCounselling}
                counsellorAccounts={counsellorAccounts}
                onSaveCounsellorAccount={handleSaveCounsellorAccount}
                onDeleteCounsellorAccount={handleDeleteCounsellorAccount}
                userRole={userRole}
                userEmail={userEmail}
                onSyncRefresh={handleSyncRefresh}
              />
            </div>
          );
        }
        return (
          <Dashboard
            tickets={tickets}
            history={history}
            inventory={inventory}
            rooms={rooms}
            allocations={allocations}
            onNavigateTab={setCurrentTab}
            updateTickets={handleUpdateTickets}
          />
        );
    }
  };

  if (isParentKioskMode) {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <PortalErrorBoundary sectionName="Parent Registration Kiosk" onReset={() => setIsParentKioskMode(true)}>
          <ParentFormMobileOnly
            onSubmitSuccess={(entry) => {
              setCounsellingEnquiries(prev => deduplicateEnquiries([entry as any, ...prev]));
            }}
          />
        </PortalErrorBoundary>
      </React.Suspense>
    );
  }

  if (!isLoggedIn) {
    return (
      <Login 
        onLogin={handleLogin} 
        theme={theme} 
        toggleTheme={toggleTheme} 
        counsellorAccounts={counsellorAccounts} 
        managementAccounts={managementAccounts} 
        onOpenParentKiosk={() => setIsParentKioskMode(true)}
      />
    );
  }

  if (userRole === "Teacher") {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <PortalErrorBoundary sectionName="Teacher Department Desk">
          <TeacherPortal
            rooms={rooms}
            tickets={tickets}
            history={history}
            userBranch={userBranch}
            userEmail={userEmail}
            onLogout={handleLogout}
            updateTickets={handleUpdateTickets}
            theme={theme}
            toggleTheme={toggleTheme}
            onSyncRefresh={handleSyncRefresh}
          />
        </PortalErrorBoundary>
      </React.Suspense>
    );
  }

  if (userRole === "Student") {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <div className="min-h-screen w-full overflow-y-auto bg-slate-100 dark:bg-slate-950 custom-scrollbar">
          <PortalErrorBoundary sectionName="Student & Parent Portal">
            <StudentPortal onLogout={handleLogout} />
          </PortalErrorBoundary>
        </div>
      </React.Suspense>
    );
  }

  if (userRole === "Counsellor") {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <div className="h-screen w-full overflow-y-auto bg-slate-100 dark:bg-slate-950 custom-scrollbar">
          <PortalErrorBoundary sectionName="Parent Counselling & Admissions Department" onReset={handleSyncRefresh}>
            <CounsellingPortal
              enquiries={counsellingEnquiries}
              parentSelfEntriesProp={parentSelfEntries}
              onParentSelfEntriesChange={setParentSelfEntries}
              onSaveEnquiry={handleSaveCounselling}
              onDeleteEnquiry={handleDeleteCounselling}
              onDeleteMultipleEnquiries={handleDeleteMultipleCounselling}
              counsellorAccounts={counsellorAccounts}
              onSaveCounsellorAccount={handleSaveCounsellorAccount}
              onDeleteCounsellorAccount={handleDeleteCounsellorAccount}
              userRole={userRole}
              userEmail={userEmail}
              onLogout={handleLogout}
              standalone={true}
              theme={theme}
              toggleTheme={toggleTheme}
              onSyncRefresh={handleSyncRefresh}
            />
          </PortalErrorBoundary>
        </div>
      </React.Suspense>
    );
  }

  if (userRole === "Management") {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <div className="h-screen w-full overflow-y-auto bg-slate-100 dark:bg-slate-950 custom-scrollbar">
          <PortalErrorBoundary sectionName="Executive Management Portal" onReset={handleSyncRefresh}>
            <ManagementPortal
              enquiries={counsellingEnquiries}
              onSaveEnquiry={handleSaveCounselling}
              onDeleteEnquiry={handleDeleteCounselling}
              counsellorAccounts={counsellorAccounts}
              managementAccounts={managementAccounts}
              onSaveManagementAccount={handleSaveManagementAccount}
              onDeleteManagementAccount={handleDeleteManagementAccount}
              onSaveCounsellorAccount={handleSaveCounsellorAccount}
              onDeleteCounsellorAccount={handleDeleteCounsellorAccount}
              tickets={tickets}
              rooms={rooms}
              inventory={inventory}
              userRole={userRole}
              userEmail={userEmail}
              onLogout={handleLogout}
              standalone={true}
              theme={theme}
              toggleTheme={toggleTheme}
              onSyncRefresh={handleSyncRefresh}
            />
          </PortalErrorBoundary>
        </div>
      </React.Suspense>
    );
  }

  return (
    <div id="app-workspace" className="flex h-screen w-screen overflow-hidden bg-gradient-to-br from-[#FFFDF9] via-[#FDF6EC] to-[#F9E8D2] font-sans selection:bg-[#EA580C] selection:text-white transition-colors duration-200">
      {isWiping && (
        <div className="fixed inset-0 bg-[#3B1505]/85 backdrop-blur-md z-[9999] flex flex-col items-center justify-center text-center p-6 space-y-4 font-sans text-white select-none animate-in fade-in duration-200">
          <div className="w-16 h-16 border-4 border-[#EA580C] border-t-transparent rounded-full animate-spin"></div>
          <div className="space-y-1">
            <h3 className="text-base font-black uppercase tracking-wider text-white">
              🚨 Wiping System Database
            </h3>
            <p className="text-xs text-[#EFE0D1] font-medium max-w-sm leading-relaxed">
              Permanently clearing all service tickets, inventories, assets, and active live sync nodes. Please hold on...
            </p>
          </div>
        </div>
      )}
      {isSyncRefreshing && (
        <div className="fixed inset-0 bg-[#FFFDF9]/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center text-center p-6 space-y-4 font-sans select-none animate-in fade-in duration-200">
          <AnimatedLoading size="w-24 h-24" />
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#3B1505]">
              🔄 Syncing Live Systems
            </h3>
            <p className="text-xs text-[#7A3512] font-medium max-w-sm leading-relaxed">
              Synchronizing active nodes and refreshing local client state...
            </p>
          </div>
        </div>
      )}
      <React.Suspense fallback={<div className="w-64 shrink-0 bg-slate-900" />}>
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          userEmail={userEmail}
          userRole={userRole}
          userBranch={userBranch}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
          onSyncRefresh={handleSyncRefresh}
          allowedTabs={allowedTabs}
        />
      </React.Suspense>
      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {/* Top Header Bar - Cleaned & Uncluttered (Hidden on print) */}
        <div className="bg-[#FFFDF9] border-b border-[#E2CBB5] px-4 py-2 flex items-center justify-between shrink-0 relative z-30 shadow-xs no-print">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-[#3B1505] truncate">
              {currentTab === "portal-links" ? "Staff Department Portal Links Directory" :
               currentTab === "counselling" ? "Parent Counselling & Admission Department" :
               currentTab === "management" ? "Executive Management Portal" :
               currentTab === "inventory-master" ? "Inventory & IT Asset Master" :
               currentTab === "room-master" ? "Room & Location Master" :
               currentTab === "employee-master" ? "Employee & Staff Master" :
               currentTab === "warranty-tracker" ? "Warranty & Service Contracts" :
               currentTab === "raise-ticket" ? "Service Ticket Management" :
               currentTab === "google-drive" ? "Google Drive Cloud Storage" :
               currentTab === "analytics" ? "System Analytics & Performance" :
               currentTab === "settings" ? "System Configuration & Settings" :
               "IT Support Dashboard"}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Default Department Refresh Button */}
            <button
              type="button"
              onClick={handleSyncRefresh}
              disabled={isSyncRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#EA580C] to-[#D94E06] hover:from-[#D94E06] hover:to-[#B83E04] text-white rounded-xl text-xs font-black transition-all shadow-sm cursor-pointer active:scale-95 disabled:opacity-50 font-sans"
              title="Refresh this department's data and stay on current page"
            >
              <RefreshCw size={13} className={isSyncRefreshing ? "animate-spin" : ""} />
              <span>Refresh Department</span>
            </button>
          </div>
        </div>

        {/* Prominent Warranty Expiration Banner */}
        {showWarrantyBanner && expiringWarranties.length > 0 && (
          <div id="warranty-expiry-banner" className="bg-amber-100 border-b border-amber-300 px-4 py-3 flex items-center justify-between text-slate-900 shadow-md relative z-50 animate-fade-in shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                <AlertTriangle size={16} className="animate-pulse" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-amber-900">
                  ⚠️ Warranty Service Alert: {expiringWarranties.length} items expiring within 7 days!
                </p>
                <p className="text-amber-800 font-medium">
                  The following assets require replacement or renewal soon:{" "}
                  <span className="font-bold underline">
                    {expiringWarranties.map(w => `${w.itemName} (${w.expiryDate})`).join(", ")}
                  </span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCurrentTab("warranty-tracker")}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Manage</span>
                <ArrowRight size={12} />
              </button>

              {typeof window !== "undefined" && "Notification" in window && Notification.permission !== "granted" && (
                <button
                  onClick={handleRequestNotificationPermission}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] uppercase tracking-wide rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                  title="Enable Browser Alerts"
                >
                  <Bell size={12} />
                  <span>Notify Me</span>
                </button>
              )}

              <button
                onClick={() => setShowWarrantyBanner(false)}
                className="p-1 px-1.5 hover:bg-amber-200 rounded text-amber-900 hover:text-black transition-all cursor-pointer font-bold text-xs"
                title="Dismiss Alert"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden relative">
          <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center p-8"><AnimatedLoading size="w-16 h-16" /></div>}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full overflow-hidden flex flex-col"
              >
                <PortalErrorBoundary sectionName={`Department View (${currentTab})`}>
                  {renderTabContent()}
                </PortalErrorBoundary>
              </motion.div>
            </AnimatePresence>
          </React.Suspense>
        </div>
      </main>

      {/* Modern "Latest Version & Key Features" Automatic Update Notification Modal */}
      {showUpdateModal && (
        <div id="latest-update-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fade-in text-slate-100 font-sans">
          <div className="bg-slate-900 border border-indigo-500/35 shadow-2xl shadow-indigo-500/10 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col p-6 md:p-8 space-y-6">
            
            {/* Animated Badge & Header */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-indigo-500 p-0.5 shadow-xl">
                <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-2xl">
                  🚀
                </div>
              </div>
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-400/20 rounded-full text-[10px] font-black text-indigo-450 tracking-widest uppercase">
                System Update v2.1.0 - Live!
              </span>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-wide">
                Upgrade Successful & Installed!
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                BIRLA OPEN MINDS INTERNATIONAL SCHOOL Core IT Support System has been successfully upgraded
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div className="space-y-4">
              <p className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">
                ✨ LATEST KEY FEATURES & IMPROVEMENTS:
              </p>

              <div className="space-y-3">
                {/* Feature 1 */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-3">
                  <span className="text-xl shrink-0">📊</span>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-indigo-400">Google Form Service Desk Sync</p>
                    <p className="text-slate-300 leading-relaxed font-semibold">
                      Completely integrate with any public Google Form link. Submissions from teachers will sync automatically to your admin support dashboard within seconds!
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-3">
                  <span className="text-xl shrink-0">💻</span>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-emerald-400">All-Platform Installable App (Desktop & Mobile)</p>
                    <p className="text-slate-300 leading-relaxed font-semibold">
                      Launch this application on any iOS, Android, or PC as an official lightweight app. Installing creates desktop shortcuts and enables support for offline alerts!
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl flex items-start gap-3">
                  <span className="text-xl shrink-0">🛡️</span>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-bold text-amber-400">Active Warranty Watch Alerts</p>
                    <p className="text-slate-300 leading-relaxed font-semibold">
                      Receive live warnings and custom dashboard alerts 7 days before warranties on school laptops, smart projectors, or visualizers expire!
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* How to run as desktop app instructions */}
            <div className="p-4 bg-indigo-950/40 border border-indigo-500/20 rounded-xl space-y-1.5 text-xs">
              <p className="font-bold text-indigo-200 flex items-center gap-1.5">
                🖥️ How to Install & Launch on PC/Network?
              </p>
              <p className="text-[11px] text-indigo-300/95 leading-relaxed font-semibold">
                To install, click the monitor icon in your browser's address bar on Desktop, or use the "INSTALL MOBILE / PC APP" button in the dashboard sidebar on Mobile to get offline support.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => {
                  localStorage.setItem("santinostech_last_version", "2.1.0");
                  setShowUpdateModal(false);
                }}
                className="flex-1 py-3 px-5 bg-gradient-to-r from-emerald-600 to-indigo-650 hover:from-emerald-700 hover:to-indigo-700 font-extrabold text-[#ffffff] rounded-xl text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>Launch & Explore Portal Now</span>
                <ArrowRight size={14} />
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Staff Department Portal Links Modal (Super Admin Directory) */}
      <React.Suspense fallback={null}>
        {isPortalLinksModalOpen && (
          <PortalLinksModal
            isOpen={isPortalLinksModalOpen}
            onClose={() => setIsPortalLinksModalOpen(false)}
            theme={theme}
          />
        )}

        {/* Android & Desktop App Deployment Center Modal */}
        {isAppInstallModalOpen && (
          <AppInstallModal
            isOpen={isAppInstallModalOpen}
            onClose={() => setIsAppInstallModalOpen(false)}
          />
        )}
      </React.Suspense>

      {/* Real-Time In-App Live Auto-Update Notifier */}
      <AppUpdateNotifier />
    </div>
  );
}
