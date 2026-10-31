import { AnimatedLoading } from "./components/AnimatedLoading";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import InventoryMaster from "./components/InventoryMaster";
import RoomMaster from "./components/RoomMaster";
import EmployeeMaster from "./components/EmployeeMaster";
import AppUpdateNotifier from "./components/AppUpdateNotifier";

// Lazy-load non-critical portals and modals to reduce initial bundle and boot instantly
const SchoolStoreHub = React.lazy(() => import("./components/SchoolStoreHub"));
const WarrantyTracker = React.lazy(() => import("./components/WarrantyTracker"));
const RaiseTicket = React.lazy(() => import("./components/RaiseTicket"));
const NetworkSpeed = React.lazy(() => import("./components/NetworkSpeed"));
const SettingsView = React.lazy(() => import("./components/Settings"));
const Analytics = React.lazy(() => import("./components/Analytics"));
const TeacherPortal = React.lazy(() => import("./components/TeacherPortal"));
const AiAssistant = React.lazy(() => import("./components/AiAssistant"));
const CctvMonitor = React.lazy(() => import("./components/CctvMonitor"));
const TransportDashboard = React.lazy(() => import("./components/TransportDashboard"));
const DriverPortal = React.lazy(() => import("./components/DriverPortal"));
const StudentPortal = React.lazy(() => import("./components/StudentPortal"));
const CounsellingPortal = React.lazy(() => import("./components/CounsellingPortal"));
const ManagementPortal = React.lazy(() => import("./components/ManagementPortal"));
const GoogleDriveManager = React.lazy(() => import("./components/GoogleDriveManager"));
const CctvNvrStorageModal = React.lazy(() => import("./components/CctvNvrStorageModal"));
const PortalLinksModal = React.lazy(() => import("./components/PortalLinksModal"));
const AppInstallModal = React.lazy(() => import("./components/AppInstallModal"));
const ParentFormMobileOnly = React.lazy(() => import("./components/ParentFormMobileOnly"));
import PortalErrorBoundary from "./components/PortalErrorBoundary";


import { loadData, saveData, calculateExpiryDate, resetToDefaults, clearAllData, loadCounselling, saveCounselling, deduplicateEnquiries, loadCounsellorAccounts, saveCounsellorAccounts, mergeWithDemoEnquiries, mergeWithDefaultCounsellorAccounts, recordDeletedCounsellorAccountId, unrecordDeletedCounsellorAccountId, recordDeletedCounsellorAccountIds, recordDeletedEnquiryId, recordDeletedEnquiryIds, getDeletedEnquiryIds, unmarkDeletedEnquiryId, mergeWithDefaultITStaffAccounts, saveITStaffAccounts, loadITStaffAccounts, recordDeletedITStaffAccountId } from "./utils/storage";
import { AlertTriangle, X, Bell, ArrowRight, RefreshCw, Share2, Smartphone } from "lucide-react";
import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, SchoolBranch, getNextTicketId, getNowFormatted, CounsellingEnquiry, CounsellorAccount, ManagementAccount, loadManagementAccounts, saveManagementAccounts, recordDeletedManagementAccountId, unrecordDeletedManagementAccountId, mergeWithDefaultManagementAccounts, ITStaffAccount } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { 
  syncCollection, 
  saveDocument, 
  deleteDocument, 
  isFirebaseConfigured, 
  syncBulkArrayToFirebase, 
  testFirestoreConnection,
  purgeAllCollectionsFromFirebase,
  isFirestoreQuotaExhausted
} from "./utils/firebase";
import { checkBackupStatus, syncAllToMongoBackup, fetchFromMongoBackup, saveToMongoBackup, deleteFromMongoBackup } from "./utils/backupClient";
import { loadR2Credentials, uploadToR2Direct } from "./utils/cloudflareR2Client";


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
      if (path === "driver" || path === "drivers") return "transport-dashboard";
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
  const [counsellorAccounts, setCounsellorAccounts] = useState<CounsellorAccount[]>(() => loadCounsellorAccounts());
  const [managementAccounts, setManagementAccounts] = useState<ManagementAccount[]>(() => loadManagementAccounts());
  const [itStaffAccounts, setItStaffAccounts] = useState<ITStaffAccount[]>(() => loadITStaffAccounts());
  const [isPortalLinksModalOpen, setIsPortalLinksModalOpen] = useState(false);
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(false);

  // Real-time server pull for accounts on load
  useEffect(() => {
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

    const fetchServerCounselling = async () => {
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
              const combined = isFirebaseConfigured() ? prevFiltered : deduplicateEnquiries([...serverEnquiries, ...prevFiltered]);
              saveCounselling(combined);
              return combined;
            });
          }
        }
      } catch (e) {
        console.warn("Server counselling fetch warning:", e);
      }
    };
    fetchServerCounselling();

    return () => { active = false; };
  }, []);

  // Expiring Warranty states
  const [expiringWarranties, setExpiringWarranties] = useState<WarrantyContract[]>([]);
  const [showWarrantyBanner, setShowWarrantyBanner] = useState(false);
  const [showQuotaBanner, setShowQuotaBanner] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [isSyncRefreshing, setIsSyncRefreshing] = useState(false);

  useEffect(() => {
    // Reset any stale quota block from previous sessions
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("sgs_firestore_quota_exhausted");
      localStorage.removeItem("sgs_firestore_quota_exhausted");
    }
    const handleQuota = () => setShowQuotaBanner(true);
    window.addEventListener("firestore-quota-exhausted", handleQuota);
    return () => window.removeEventListener("firestore-quota-exhausted", handleQuota);
  }, []);

  const handleSyncRefresh = async () => {
    setIsSyncRefreshing(true);
    try {
      // Re-trigger loadData and set state to emulate a fresh load
      const localData = loadData();
      setTickets(localData.tickets);
      setHistory(localData.history);
      setInventory(localData.inventory);
      setRooms(localData.rooms);
      setAllocations(localData.allocations);
      setWarranty(localData.warranty);
      setCounsellingEnquiries(loadCounselling());
      setCounsellorAccounts(loadCounsellorAccounts());

      // Settle time for any background listeners and allow beautiful loading visual to settle
      await new Promise((resolve) => setTimeout(resolve, 1200));
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

  // Load datasets on mount
  useEffect(() => {
    testFirestoreConnection();

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
    if (["counselling", "management", "teacher", "driver", "student", "counsellor"].some(p => pathStr.includes(p))) {
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


  // Google Cloud Data Server Real-Time Synchronization (Always Active On App Open)
  useEffect(() => {
    const isFb = isFirebaseConfigured();
    if (isFb) {
      const localData = loadData();
      const unsubs = [
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
        }, localData.inventory),

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
        }, localData.warranty),

        syncCollection<{ id: string; enquiryNo?: string }>("deleted_counselling_forms", (deletedDocs) => {
          if (deletedDocs && deletedDocs.length > 0) {
            const rawIds = deletedDocs.flatMap(d => [d.id, d.enquiryNo]).filter(Boolean) as string[];
            recordDeletedEnquiryIds(rawIds);
            const delSet = new Set(rawIds.map(x => x.toLowerCase()));
            setCounsellingEnquiries((prev) => {
              const current = prev || [];
              const filtered = current.filter((e) => {
                if (!e) return false;
                const eId = (e.id || "").toLowerCase();
                const eNo = (e.enquiryNo || "").toLowerCase();
                return (!eId || !delSet.has(eId)) && (!eNo || !delSet.has(eNo));
              });
              saveCounselling(filtered);
              return filtered;
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
            setCounsellingEnquiries([]);
            saveCounselling([]);
            try {
              fetch("/api/counselling", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify([])
              }).catch(() => {});
            } catch (_) {}
            return;
          }

          // Automatically purge deleted or duplicate documents from Firestore
          items.forEach(item => {
            if (item.id && /_(\d{10,})$/.test(item.id)) {
              deleteDocument("counselling_forms", item.id);
              deleteDocument("counselling", item.id);
            }
            const eId = (item.id || "").toLowerCase();
            const eNo = (item.enquiryNo || "").toLowerCase();
            if ((eId && deletedSet.has(eId)) || (eNo && deletedSet.has(eNo))) {
              if (item.id) {
                deleteDocument("counselling_forms", item.id);
                deleteDocument("counselling", item.id);
              }
              if (item.enquiryNo) {
                deleteDocument("counselling_forms", item.enquiryNo);
                deleteDocument("counselling", item.enquiryNo);
              }
            }
          });

          // Standardize ID strictly to canonical enquiryNo and exclude deleted items
          const nonDeletedItems = items
            .filter(e => e && (!e.id || !deletedSet.has(e.id.toLowerCase())) && (!e.enquiryNo || !deletedSet.has(e.enquiryNo.toLowerCase())))
            .map(e => ({
              ...e,
              id: e.enquiryNo || e.id
            }));

          const deduped = deduplicateEnquiries(nonDeletedItems);
          setCounsellingEnquiries(deduped);
          saveCounselling(deduped);
          fetch("/api/counselling", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(deduped)
          }).catch(() => {});
        }, []),

        syncCollection<{ id: string; username?: string }>("deleted_counsellor_accounts", (deletedDocs) => {
          if (deletedDocs && deletedDocs.length > 0) {
            const ids = deletedDocs.map(d => d.id || d.username || "").filter(Boolean);
            recordDeletedCounsellorAccountIds(ids);
            setCounsellorAccounts(prev => mergeWithDefaultCounsellorAccounts(prev, ids));
          }
        }, []),

        syncCollection<CounsellorAccount>("counsellor_accounts", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            setCounsellorAccounts([]);
            return;
          }
          const merged = mergeWithDefaultCounsellorAccounts(items || []);
          setCounsellorAccounts(merged);
          saveCounsellorAccounts(merged);
        }, loadCounsellorAccounts()),

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
        }, []),

        syncCollection<ManagementAccount>("management_accounts", (items) => {
          if (localStorage.getItem("sgs_wiping_database") === "true") {
            return;
          }
          const merged = mergeWithDefaultManagementAccounts(items || []);
          setManagementAccounts(merged);
          saveManagementAccounts(merged);
        }, loadManagementAccounts()),

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
        }, []),
      ];

      return () => {
        unsubs.forEach((unsub) => unsub());
      };
    }
  }, []);

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

    // 2. Principal Firestore sync (Only write items that actually changed!)
    if (isFirebaseConfigured() && !isFirestoreQuotaExhausted()) {
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
    // Canonical ID normalization: strictly enforce id === enquiryNo
    const cleanEnquiry: CounsellingEnquiry = {
      ...enquiry,
      id: enquiry.enquiryNo || enquiry.id
    };

    // Unmark from deleted records in localStorage and Firestore so newly created/updated enquiries are never hidden
    unmarkDeletedEnquiryId(cleanEnquiry.id, cleanEnquiry.enquiryNo);
    if (isFirebaseConfigured()) {
      deleteDocument("deleted_counselling_forms", (cleanEnquiry.id || "").toLowerCase());
      if (cleanEnquiry.enquiryNo) {
        deleteDocument("deleted_counselling_forms", cleanEnquiry.enquiryNo.toLowerCase());
      }
    }

    // 1. Immediately persist synchronously to LocalStorage & update state
    setCounsellingEnquiries((prev) => {
      const idx = prev.findIndex((e) => e.id === cleanEnquiry.id || (cleanEnquiry.enquiryNo && e.enquiryNo && e.enquiryNo.toLowerCase() === cleanEnquiry.enquiryNo.toLowerCase()));
      let nextList: CounsellingEnquiry[];
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = cleanEnquiry;
      } else {
        nextList = [cleanEnquiry, ...prev];
      }
      saveCounselling(nextList);
      return nextList;
    });

    // Helper function to persist to Firestore safely without exceeding doc size
    const saveToFirestore = (targetEnquiry: CounsellingEnquiry) => {
      if (!isFirebaseConfigured()) return;
      const firestoreEnquiry: any = JSON.parse(JSON.stringify(targetEnquiry));
      // Only delete audioData if it exceeds 350KB to preserve instant cross-device playback
      if (firestoreEnquiry.audioRecording && firestoreEnquiry.audioRecording.audioData) {
        if (typeof firestoreEnquiry.audioRecording.audioData === "string" && firestoreEnquiry.audioRecording.audioData.length > 350 * 1024) {
          delete firestoreEnquiry.audioRecording.audioData;
        }
      }
      const targetDocId = targetEnquiry.enquiryNo || targetEnquiry.id || `ENQ-${Date.now()}`;
      
      // Clean single-document sync: strictly save 1 document per form
      saveDocument("counselling_forms", targetDocId, firestoreEnquiry);
      saveDocument("counselling", targetDocId, firestoreEnquiry);

      // Clean up legacy document if targetEnquiry previously had a timestamp-suffixed ID
      if (enquiry.id && enquiry.id !== targetDocId && /_(\d{10,})$/.test(enquiry.id)) {
        deleteDocument("counselling_forms", enquiry.id);
        deleteDocument("counselling", enquiry.id);
      }
    };

    // 2. Save to Firestore
    saveToFirestore(cleanEnquiry);

    // 3. Direct Cloudflare R2 Background Upload (Ensures 24/7 global audio access)
    if (enquiry.audioRecording?.audioData && enquiry.audioRecording.audioData.length > 50) {
      try {
        const creds = loadR2Credentials();
        const r2FileName = enquiry.audioRecording.fileName || `${enquiry.enquiryNo || 'ENQ'}_Meeting_${new Date().toISOString().slice(0, 10)}.webm`;
        uploadToR2Direct(creds, r2FileName, enquiry.audioRecording.audioData, enquiry.audioRecording.mimeType || "audio/webm")
          .catch((err) => console.warn("Background R2 audio auto-upload notice:", err));
      } catch (_) {}
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
        deleteDocument("counselling", id);
        if (target?.id) {
          deleteDocument("counselling_forms", target.id);
          deleteDocument("counselling", target.id);
        }
        if (target?.enquiryNo) {
          deleteDocument("counselling_forms", target.enquiryNo);
          deleteDocument("counselling", target.enquiryNo);
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
            deleteDocument("counselling", e.id);
            if (e.enquiryNo) {
              deleteDocument("counselling_forms", e.enquiryNo);
              deleteDocument("counselling", e.enquiryNo);
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
          deleteDocument("counselling", id);
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
      const idx = base.findIndex((a) => a.id === account.id || a.username.toLowerCase() === account.username.toLowerCase());
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
      case "school-store":
      case "store-master":
        return <SchoolStoreHub />;
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
      case "network-speed":
        return <NetworkSpeed />;
      case "ai-assistant":
        return <AiAssistant tickets={tickets} />;
      case "cctv-watchdog":
        return <CctvMonitor />;
      case "management":
      case "management-desk":
      case "management-portal":
        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
      case "transport-dashboard":
        return <TransportDashboard />;
      case "google-drive":
        return (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
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
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950/10">
            <PortalLinksModal isEmbedded={true} isOpen={true} onClose={() => setCurrentTab("dashboard")} theme={theme} />
          </div>
        );
      case "cloudflare-r2":
        return (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950/10">
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

  if (userRole === "Driver") {
    return (
      <React.Suspense fallback={<div className="flex h-screen w-screen items-center justify-center bg-slate-900"><AnimatedLoading size="w-16 h-16" /></div>}>
        <div className="min-h-screen w-full overflow-y-auto bg-slate-900 custom-scrollbar">
          <PortalErrorBoundary sectionName="Driver & Transport Portal">
            <DriverPortal onLogout={handleLogout} />
          </PortalErrorBoundary>
        </div>
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
      <main className="flex-1 h-full overflow-hidden flex flex-col">
        {/* Top Header Bar - Cleaned & Uncluttered (Hidden on print) */}
        <div className="bg-[#FFFDF9] border-b border-[#E2CBB5] px-4 py-2 flex items-center justify-between shrink-0 relative z-30 shadow-xs no-print">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-xs md:text-sm font-black uppercase tracking-wider text-[#3B1505] truncate">
              {currentTab === "portal-links" ? "Staff Department Portal Links Directory" :
               currentTab === "school-store" ? "School Store & Material Dispatch Hub" :
               currentTab === "counselling" ? "Parent Counselling & Admission Department" :
               currentTab === "management" ? "Executive Management Portal" :
               currentTab === "inventory-master" ? "Inventory & IT Asset Master" :
               currentTab === "room-master" ? "Room & Location Master" :
               currentTab === "employee-master" ? "Employee & Staff Master" :
               currentTab === "warranty-tracker" ? "Warranty & Service Contracts" :
               currentTab === "raise-ticket" ? "Service Ticket Management" :
               currentTab === "transport-dashboard" ? "Transport & Vehicle Management" :
               currentTab === "google-drive" ? "Google Drive Cloud Storage" :
               currentTab === "cctv-watchdog" ? "CCTV Surveillance Watchdog" :
               currentTab === "analytics" ? "System Analytics & Performance" :
               currentTab === "settings" ? "System Configuration & Settings" :
               currentTab === "network-speed" ? "Network Speed & Connectivity" :
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

        {/* Firestore Free Quota Notice Banner */}
        {showQuotaBanner && (
          <div className="bg-sky-50 dark:bg-slate-900 border-b border-sky-200 dark:border-sky-800/60 px-4 py-2.5 flex items-center justify-between text-slate-800 dark:text-slate-200 text-xs shadow-sm relative z-40 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                <span className="font-semibold text-sky-700 dark:text-sky-400">Cloud Sync Active:</span> Google Cloud Firestore free daily write limit (20,000 writes/day) reached. The app is automatically persisting all tickets, records, and forms to High-Speed Local & Server Storage without any data loss.
              </p>
            </div>
            <button
              onClick={() => setShowQuotaBanner(false)}
              className="px-2.5 py-1 hover:bg-sky-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 dark:hover:text-white transition text-xs font-semibold shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

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
                className="h-full w-full overflow-hidden"
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
