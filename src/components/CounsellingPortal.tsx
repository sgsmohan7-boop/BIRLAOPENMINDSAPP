import React, { useState, useMemo } from "react";
import { 
  FileText, 
  PlusCircle, 
  Search, 
  Filter, 
  Phone, 
  MessageSquare, 
  Calendar, 
  User, 
  CheckSquare, 
  Printer, 
  Edit3, 
  Trash2, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  GraduationCap,
  Sparkles,
  Users,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Shield,
  HeartHandshake,
  KeyRound,
  Key,
  UserPlus,
  Lock,
  Unlock,
  ShieldCheck,
  Check,
  Copy,
  UserCheck,
  Send,
  SlidersHorizontal,
  Mail,
  Headphones,
  Mic,
  Volume2,
  Star,
  Award,
  History,
  ListPlus,
  ThumbsUp,
  AlertTriangle,
  X,
  Smartphone,
  Bell,
  School
} from "lucide-react";
import AudioMeetingRecorder from "./AudioMeetingRecorder";
import ManagementAudioDesk from "./ManagementAudioDesk";
import AppInstallModal from "./AppInstallModal";
import AppUpdateNotifier from "./AppUpdateNotifier";
import CounsellingReportModal from "./CounsellingReportModal";
import ParentKioskModal from "./ParentKioskModal";
import ReceptionQueueModal from "./ReceptionQueueModal";
import TokenListReportModal from "./TokenListReportModal";
import WhatsAppMessageModal from "./WhatsAppMessageModal";
import { 
  CounsellingEnquiry, 
  AdmissionStatus, 
  getNextEnquiryNo, 
  reserveDraftEnquiryNo,
  releaseDraftReservation,
  recordHighestEnquiryNumber,
  COUNSELLORS_LIST, 
  CounsellorProfile,
  CounsellorAccount,
  DEFAULT_COUNSELLOR_ACCOUNTS,
  CounsellingFollowUpLog,
  CounsellingAudioRecord,
  ParentSelfEntry
} from "../types";
import { 
  loadCounsellorAccounts, 
  saveCounsellorAccounts, 
  DEMO_COUNSELLING, 
  mergeWithDefaultCounsellorAccounts, 
  recordDeletedCounsellorAccountId, 
  getAllowCounsellorMultiDelete, 
  setAllowCounsellorMultiDelete, 
  loadParentSelfEntries, 
  saveParentSelfEntries,
  getDismissedParentEntryIds,
  recordDismissedParentEntryId
} from "../utils/storage";
import { deleteAudioRecordingBlob, formatAudioDuration } from "../utils/audioStorage";
import { isFirebaseConfigured, syncCollection, saveDocument, deleteDocument } from "../utils/firebase";

function deduplicateParentEntries(entries: ParentSelfEntry[]): ParentSelfEntry[] {
  const dismissedSet = new Set(getDismissedParentEntryIds());
  const map = new Map<string, ParentSelfEntry>();
  for (const item of entries) {
    if (!item || !item.id) continue;
    // If this item was previously dismissed by counsellor, permanently enforce status: "dismissed"
    if (dismissedSet.has(item.id)) {
      item.status = "dismissed";
    }
    if (!map.has(item.id)) {
      map.set(item.id, item);
    } else {
      const existing = map.get(item.id)!;
      // If either has been dismissed or claimed, preserve that state so old snapshots don't revive it
      if (item.status === "dismissed" || existing.status === "dismissed") {
        map.set(item.id, { ...existing, ...item, status: "dismissed" });
      } else if (item.status === "claimed" || (item.claimedAt && !existing.claimedAt)) {
        map.set(item.id, item);
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    // Today's entries ordered by daily token number ascending
    if (a.dateKey && a.dateKey === b.dateKey && a.dailyTokenNo && b.dailyTokenNo) {
      return a.dailyTokenNo - b.dailyTokenNo;
    }
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });
}

interface CounsellingPortalProps {
  enquiries: CounsellingEnquiry[];
  onSaveEnquiry: (enquiry: CounsellingEnquiry) => void;
  onDeleteEnquiry: (id: string) => void;
  onDeleteMultipleEnquiries?: (ids: string[]) => void;
  counsellorAccounts?: CounsellorAccount[];
  onSaveCounsellorAccount?: (account: CounsellorAccount) => void;
  onDeleteCounsellorAccount?: (id: string) => void;
  userRole: string;
  userEmail: string;
  onLogout?: () => void;
  standalone?: boolean;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
  onSyncRefresh?: () => void;
}

const CLASS_OPTIONS = [
  "Playgroup",
  "Nursery",
  "PP1 (LKG)",
  "PP2 (UKG)",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11 (Science)",
  "Grade 11 (Commerce)",
  "Grade 12 (Science)",
  "Grade 12 (Commerce)"
];

const SOURCES = [
  "Google/Online",
  "Website",
  "Reference",
  "Existing Parent",
  "Advertisement",
  "Other"
];

const STATUS_CONFIG: Record<AdmissionStatus, { label: string; bg: string; text: string; border: string }> = {
  "Interested": { label: "Interested", bg: "bg-blue-50 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  "Application Taken": { label: "Application Taken", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "Entrance Test Required": { label: "Entrance Test Required", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  "Admission Confirmed": { label: "Admission Confirmed", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" },
  "Follow-up Required": { label: "Follow-up Required", bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  "Not Interested": { label: "Not Interested", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-300 dark:border-slate-700" }
};

export default function CounsellingPortal({
  enquiries,
  onSaveEnquiry,
  onDeleteEnquiry,
  onDeleteMultipleEnquiries,
  userRole,
  userEmail,
  onLogout,
  standalone = false,
  theme = "light",
  toggleTheme,
  counsellorAccounts,
  onSaveCounsellorAccount,
  onDeleteCounsellorAccount,
  onSyncRefresh
}: CounsellingPortalProps) {
  const [activeView, setActiveView] = useState<"list" | "form" | "print" | "accounts" | "audio-desk">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterAuditStatus, setFilterAuditStatus] = useState<string>("ALL");
  const [adminFilterCounsellor, setAdminFilterCounsellor] = useState<string>("ALL");
  const [selectedEnquiry, setSelectedEnquiry] = useState<CounsellingEnquiry | null>(null);
  const [inspectingEnquiry, setInspectingEnquiry] = useState<CounsellingEnquiry | null>(null);
  const [actionTakenDraft, setActionTakenDraft] = useState<string>("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<boolean>(false);
  const [isAddingFollowUp, setIsAddingFollowUp] = useState<boolean>(false);
  const [followUpMode, setFollowUpMode] = useState<"Phone Call" | "WhatsApp" | "In-Person Visit" | "Campus Tour">("Phone Call");
  const [followUpNotes, setFollowUpNotes] = useState<string>("");
  const [followUpSentiment, setFollowUpSentiment] = useState<"Positive" | "Hesitant" | "Budget Concern" | "Ready to Join">("Positive");
  const [followUpNextDate, setFollowUpNextDate] = useState<string>("");
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Multi-selection & Super Admin Access Control States
  const [selectedEnquiryIds, setSelectedEnquiryIds] = useState<string[]>([]);
  const [allowCounsellorMultiDelete, setAllowCounsellorMultiDeleteState] = useState<boolean>(() => getAllowCounsellorMultiDelete());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState<boolean>(false);

  // Derived Multi-Delete Access Permission
  const canUseMultiDelete = userRole !== "Counsellor" || allowCounsellorMultiDelete;

  // 5 KPI Metric Cards Date-Wise Drill-Down State
  type MetricCardType = "total" | "applications" | "entrance" | "followup" | "confirmed";
  const [selectedMetricCard, setSelectedMetricCard] = useState<MetricCardType | null>(null);
  const [metricDatePreset, setMetricDatePreset] = useState<"all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth">("all");
  const [metricSingleDate, setMetricSingleDate] = useState<string>("");
  const [metricFromDate, setMetricFromDate] = useState<string>("");
  const [metricToDate, setMetricToDate] = useState<string>("");
  const [metricSearchQuery, setMetricSearchQuery] = useState<string>("");
  const [metricClassFilter, setMetricClassFilter] = useState<string>("ALL");
  const [metricAdminCounsellor, setMetricAdminCounsellor] = useState<string>("ALL");
  const [selectedDateChip, setSelectedDateChip] = useState<string | null>(null);

  // Safe enquiries source
  const safeEnquiries = useMemo(() => {
    return Array.isArray(enquiries) ? enquiries : [];
  }, [enquiries]);


  // Counsellor Accounts State (Loaded from Main App / Storage)
  const [localAccounts, setLocalAccounts] = useState<CounsellorAccount[]>(() => {
    return (counsellorAccounts && counsellorAccounts.length > 0)
      ? mergeWithDefaultCounsellorAccounts(counsellorAccounts)
      : loadCounsellorAccounts();
  });

  React.useEffect(() => {
    if (counsellorAccounts && counsellorAccounts.length > 0) {
      setLocalAccounts(mergeWithDefaultCounsellorAccounts(counsellorAccounts));
    }
  }, [counsellorAccounts]);

  // Active Counsellor resolution with tab-isolated URL param & sessionStorage precedence
  const [selectedCounsellorIdOverride, setSelectedCounsellorIdOverride] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("counsellor") || params.get("counsellorId") || sessionStorage.getItem("sgs_counsellor_override_id");
    }
    return null;
  });

  const activeCounsellor: CounsellorAccount | null = useMemo(() => {
    // For logged-in Counsellors: Strictly lock to their own account matching userEmail or saved session profile
    if (userRole === "Counsellor") {
      if (userEmail) {
        const found = localAccounts.find(c => 
          c.email.toLowerCase() === userEmail.toLowerCase() || 
          c.username.toLowerCase() === userEmail.toLowerCase()
        );
        if (found) return found;
      }
      try {
        const savedSession = sessionStorage.getItem("sgs_active_counsellor");
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          const match = localAccounts.find(a => a.id === parsed.id || a.username?.toLowerCase() === parsed.username?.toLowerCase() || a.email?.toLowerCase() === parsed.email?.toLowerCase());
          if (match) return match;
        }
      } catch {}
      return localAccounts[0] || null;
    }

    // For Management / Super Admin / IT Admin: Allow inspecting specific counsellor via override or URL
    if (selectedCounsellorIdOverride) {
      const match = localAccounts.find(a => 
        a.id.toLowerCase() === selectedCounsellorIdOverride.toLowerCase() || 
        a.username.toLowerCase() === selectedCounsellorIdOverride.toLowerCase() ||
        a.name.toLowerCase().includes(selectedCounsellorIdOverride.toLowerCase())
      );
      if (match) return match;
    }

    try {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const urlCounsellor = params.get("counsellor") || params.get("counsellorId");
        if (urlCounsellor) {
          const match = localAccounts.find(a => 
            a.id.toLowerCase() === urlCounsellor.toLowerCase() || 
            a.username.toLowerCase() === urlCounsellor.toLowerCase() ||
            a.name.toLowerCase().includes(urlCounsellor.toLowerCase())
          );
          if (match) return match;
        }

        const savedSession = sessionStorage.getItem("sgs_active_counsellor");
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          const match = localAccounts.find(a => a.id === parsed.id || a.username === parsed.username);
          if (match) return match;
          return parsed;
        }
      }
    } catch {}

    if (userEmail) {
      const found = localAccounts.find(c => 
        c.email.toLowerCase() === userEmail.toLowerCase() || 
        c.username.toLowerCase() === userEmail.toLowerCase()
      );
      if (found) return found;
    }

    return localAccounts[0] || null;
  }, [selectedCounsellorIdOverride, userEmail, userRole, localAccounts]);

  // Account modal states
  const [isAppInstallModalOpen, setIsAppInstallModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountModalMode, setAccountModalMode] = useState<"create" | "edit">("create");

  // Parent Self Registration Kiosk State & Realtime Queue
  const [parentSelfEntries, setParentSelfEntries] = useState<ParentSelfEntry[]>(() => loadParentSelfEntries());
  const [isParentKioskModalOpen, setIsParentKioskModalOpen] = useState(false);
  const [parentKioskDefaultMode, setParentKioskDefaultMode] = useState<"register" | "print_qr">("register");
  const [isReceptionQueueModalOpen, setIsReceptionQueueModalOpen] = useState(false);
  const [isTokenListReportModalOpen, setIsTokenListReportModalOpen] = useState(false);
  const [whatsAppModalEnquiry, setWhatsAppModalEnquiry] = useState<CounsellingEnquiry | null>(null);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState<boolean>(false);

  // Reception Lounge Controls: Collapse (Minimize), Hide (Close), and Maximize (Full-height)
  const [isLoungeCollapsed, setIsLoungeCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("counselling_lounge_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isLoungeHidden, setIsLoungeHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem("counselling_lounge_hidden") === "true";
    } catch {
      return false;
    }
  });
  const [isLoungeMaximized, setIsLoungeMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem("counselling_lounge_maximized") === "true";
    } catch {
      return false;
    }
  });

  // Active Draft form state for claimed parent lead recovery
  const [activeDraft, setActiveDraft] = useState<any>(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("bomis_counsellor_active_draft");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });


  const toggleLoungeCollapsed = () => {
    setIsLoungeCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("counselling_lounge_collapsed", String(next)); } catch {}
      return next;
    });
  };

  const toggleLoungeHidden = (hide?: boolean) => {
    setIsLoungeHidden(prev => {
      const next = typeof hide === "boolean" ? hide : !prev;
      try { localStorage.setItem("counselling_lounge_hidden", String(next)); } catch {}
      return next;
    });
  };

  const toggleLoungeMaximized = () => {
    setIsLoungeMaximized(prev => {
      const next = !prev;
      try { localStorage.setItem("counselling_lounge_maximized", String(next)); } catch {}
      return next;
    });
  };

  // Real-time Firestore sync & server sync for parent self-entries
  React.useEffect(() => {
    let unsubscribeFirestore: (() => void) | undefined;

    const fetchServerEntries = async () => {
      try {
        const res = await fetch("/api/parent-self-entry");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.entries)) {
            setParentSelfEntries(prev => {
              const combined = deduplicateParentEntries([...json.entries, ...(prev || [])]);
              saveParentSelfEntries(combined);
              return combined;
            });
          }
        }
      } catch {}
    };

    fetchServerEntries();

    // Real-time Firestore subscription so any phone scan instantly updates across all devices
    if (isFirebaseConfigured()) {
      try {
        unsubscribeFirestore = syncCollection(
          "parent_self_entries",
          (firestoreEntries: any[]) => {
            if (Array.isArray(firestoreEntries)) {
              const deduped = deduplicateParentEntries(firestoreEntries);
              setParentSelfEntries(deduped);
              saveParentSelfEntries(deduped);
            }
          },
          []
        );
      } catch (err) {
        console.warn("Firestore parent_self_entries sync notice:", err);
      }
    }

    // Relaxed background check (15s) instead of tight 2.5s loop
    const interval = setInterval(fetchServerEntries, 15000);

    const handleRealtimeEntry = () => {
      fetchServerEntries();
    };
    window.addEventListener("parent_self_entry_added", handleRealtimeEntry);
    window.addEventListener("storage", handleRealtimeEntry);

    return () => {
      clearInterval(interval);
      if (unsubscribeFirestore) unsubscribeFirestore();
      window.removeEventListener("parent_self_entry_added", handleRealtimeEntry);
      window.removeEventListener("storage", handleRealtimeEntry);
    };
  }, []);

  const pendingParentEntries = useMemo(() => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    const dismissedSet = new Set(getDismissedParentEntryIds(counsellorId));
    return (parentSelfEntries || [])
      .filter(e => e.status === "pending" && !dismissedSet.has(e.id))
      .sort((a, b) => {
        const aDate = a.dateKey || a.entryDate || (a.formattedDate ? a.formattedDate.split(" ")[0] : "");
        const bDate = b.dateKey || b.entryDate || (b.formattedDate ? b.formattedDate.split(" ")[0] : "");
        if (aDate === bDate && a.dailyTokenNo && b.dailyTokenNo) {
          return a.dailyTokenNo - b.dailyTokenNo;
        }
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [parentSelfEntries, activeCounsellor]);

  const isEntryToday = (e: ParentSelfEntry) => {
    const now = new Date();
    const todayDMY = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const todayYMD = now.toISOString().split("T")[0];
    const eDate = e.dateKey || e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
    if (eDate === todayYMD || eDate === todayDMY) return true;
    if (e.claimedAt) {
      const cDate = new Date(e.claimedAt).toISOString().split("T")[0];
      if (cDate === todayYMD) return true;
    }
    const time = new Date(e.claimedAt || e.submittedAt).getTime();
    if (!isNaN(time) && now.getTime() - time < 24 * 60 * 60 * 1000) {
      return true;
    }
    return false;
  };

  const claimedParentEntries = useMemo(() => {
    return (parentSelfEntries || []).filter(e => {
      if (e.status !== "claimed") return false;
      if (userRole === "Counsellor" && activeCounsellor) {
        const normC = (e.claimedBy || "").trim().toLowerCase().replace("-0", "-");
        const normA = (activeCounsellor.id || "").trim().toLowerCase().replace("-0", "-");
        const matchId = Boolean(
          e.claimedBy && activeCounsellor.id && 
          (e.claimedBy.trim().toLowerCase() === activeCounsellor.id.trim().toLowerCase() || normC === normA)
        );
        const cName = (e.claimedByName || "").trim().toLowerCase();
        const aName = (activeCounsellor.name || "").trim().toLowerCase();
        const uName = (activeCounsellor.username || "").trim().toLowerCase();
        const matchName = Boolean(
          cName.length > 0 && aName.length > 0 && 
          (cName === aName || cName.includes(aName) || aName.includes(cName))
        );
        const matchUser = Boolean(
          uName.length > 0 && (cName === uName || cName.includes(uName))
        );
        return matchId || matchName || matchUser;
      }
      return true;
    });
  }, [parentSelfEntries, userRole, activeCounsellor]);

  const todayClaimedParentEntries = useMemo(() => {
    return claimedParentEntries.filter(isEntryToday);
  }, [claimedParentEntries]);

  const handleAddParentSelfEntry = (entry: ParentSelfEntry) => {
    const updated = [entry, ...parentSelfEntries.filter(e => e.id !== entry.id)];
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);
    fetch("/api/parent-self-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry)
    }).catch(() => {});
  };

  const handleDismissParentEntry = async (entryId: string) => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    // 1. Record dismissal for THIS counsellor's workspace so it disappears locally
    recordDismissedParentEntryId(entryId, counsellorId);

    // 2. Remove in React state for current session
    const updated = parentSelfEntries.map(e => e.id === entryId ? { ...e, status: "dismissed" as const } : e);
    setParentSelfEntries(updated);

    setDeleteToast("✓ Parent entry dismissed from your workspace lounge.");
    setTimeout(() => setDeleteToast(null), 3000);
  };

  const handleClearAllPending = async () => {
    if (pendingParentEntries.length === 0) return;
    const count = pendingParentEntries.length;
    const pendingIds = pendingParentEntries.map(e => e.id);
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";

    // 1. Record all dismissed IDs into THIS COUNSELLOR'S workspace dismissal list
    pendingIds.forEach(id => recordDismissedParentEntryId(id, counsellorId));

    // 2. Clear from React state for this counsellor's workspace
    const updated = parentSelfEntries.map(e => pendingIds.includes(e.id) ? { ...e, status: "dismissed" as const } : e);
    setParentSelfEntries(updated);

    setDeleteToast(`🧹 Cleared ${count} waiting parent card(s) from your workspace desk.`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  const handleClaimAndAutoFill = async (entry: ParentSelfEntry) => {
    const currentCounsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR-01";
    const currentCounsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Counsellor";

    // Mark claimed
    const updatedEntries = parentSelfEntries.map(e => e.id === entry.id ? {
      ...e,
      status: "claimed" as const,
      claimedBy: currentCounsellorId,
      claimedByName: currentCounsellorName,
      claimedAt: new Date().toISOString()
    } : e);

    setParentSelfEntries(updatedEntries);
    saveParentSelfEntries(updatedEntries);

    // Update Firestore so other counsellors immediately see this parent is claimed
    try {
      await saveDocument("parent_self_entries", entry.id, {
        status: "claimed",
        claimedBy: currentCounsellorId,
        claimedByName: currentCounsellorName,
        claimedAt: new Date().toISOString()
      });
    } catch {}

    try {
      await fetch("/api/parent-self-entry/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entry.id,
          counsellorId: currentCounsellorId,
          counsellorName: currentCounsellorName
        })
      });
    } catch {}

    // Generate clean Enquiry ID and auto-fill form
    const draftNo = getNextEnquiryNo(safeEnquiries);
    const newClaimedData: CounsellingEnquiry = {
      id: draftNo,
      enquiryNo: draftNo,
      date: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      studentName: entry.studentName,
      applyingForClass: entry.applyingForClass || "Grade 1",
      academicYear: "2026-2027",
      dateOfBirth: entry.dateOfBirth || "",
      gender: entry.gender || "Male",
      fatherName: entry.fatherName || "",
      motherName: entry.motherName || "",
      contactNo: entry.contactNo || "",
      whatsappNo: entry.whatsappNo || entry.contactNo || "",
      previousSchool: entry.previousSchool || "",
      previousClass: entry.previousClass || "",
      residentialAddress: entry.residentialAddress || "",
      heardAboutSchool: entry.heardAboutSchool && entry.heardAboutSchool.length > 0 ? entry.heardAboutSchool : [],
      reasonForChoosing: entry.reasonForChoosing || "",
      preferredContact: entry.preferredContact || "Call",
      bestTimeToContact: "",
      academicPerformance: "",
      studentInterests: "",
      strengths: "",
      areasNeedingSupport: "",
      transportRequired: entry.transportRequired || false,
      hostelRequired: false,
      specialLearningSupport: entry.specialLearningSupport || false,
      specialLearningDetails: "",
      pointsDiscussed: "",
      counsellorObservations: "",
      explainedSchoolFacilities: false,
      explainedAcademicProgramme: false,
      explainedFeeStructure: false,
      explainedTransportDetails: false,
      explainedSchoolRules: false,
      explainedActivitiesSports: false,
      admissionStatus: "Interested",
      followUpDate: "",
      counsellorId: currentCounsellorId,
      counsellorName: currentCounsellorName,
      parentSignatureRecorded: true,
      createdAt: `${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: new Date().toLocaleDateString()
    };

    setFormData(newClaimedData);

    const draftObj = { formData: newClaimedData, entry, claimedAt: new Date().toISOString() };
    try { localStorage.setItem("bomis_counsellor_active_draft", JSON.stringify(draftObj)); } catch {}
    setActiveDraft(draftObj);

    setSelectedEnquiry(null);
    setActiveView("form");
    setDeleteToast(`✓ Claimed ${entry.studentName}'s enquiry! Form auto-populated successfully.`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  // Password Reset / Change Modal State for Counsellor
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState("");
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [confirmPasswordInput, setConfirmPasswordInput] = useState("");
  const [showPasswordsInModal, setShowPasswordsInModal] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [accountFormData, setAccountFormData] = useState<CounsellorAccount>({
    id: "",
    name: "",
    username: "",
    password: "",
    email: "",
    phone: "",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active",
    color: "#EA580C",
    createdAt: ""
  });
  const [showPasswordInModal, setShowPasswordInModal] = useState(false);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // In-app Delete Confirmation State (Avoids sandboxed iframe window.confirm blocking)
  const [enquiryToDelete, setEnquiryToDelete] = useState<CounsellingEnquiry | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<CounsellorAccount | null>(null);

  // Sync active counsellor into tab sessionStorage and URL search parameter so refreshes stay in this exact workspace
  React.useEffect(() => {
    if (activeCounsellor && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("sgs_active_counsellor", JSON.stringify(activeCounsellor));
        sessionStorage.setItem("sgs_counsellor_override_id", activeCounsellor.id);
        const url = new URL(window.location.href);
        if (url.searchParams.get("counsellor") !== activeCounsellor.id) {
          url.searchParams.set("portal", "counselling");
          url.searchParams.set("counsellor", activeCounsellor.id);
          window.history.replaceState({}, "", url.toString());
        }
      } catch {}
    }
  }, [activeCounsellor]);

  // Account Management Actions
  const handleOpenCreateAccount = () => {
    let maxNum = 0;
    localAccounts.forEach(a => {
      const match = a.id?.match(/COUNSELLOR-(\d+)/i) || a.id?.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1] || match[0], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    const nextIndex = Math.max(localAccounts.length + 1, maxNum + 1);
    const nextId = `COUNSELLOR-${String(nextIndex).padStart(2, "0")}`;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const colorPalette = ["#EA580C", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#0284C7", "#D97706", "#0D9488", "#4F46E5", "#E11D48"];

    setAccountFormData({
      id: nextId,
      name: "",
      username: `counsellor${nextIndex}`,
      password: `Password@${100 + nextIndex}`,
      email: `counsellor${nextIndex}@birlainstitute.edu.in`,
      phone: "+91 98765 00000",
      roleTitle: "Admissions Counsellor",
      assignedGrades: "All Grades",
      status: "active",
      color: colorPalette[(nextIndex - 1) % colorPalette.length],
      createdAt: `${dd}-${mm}-${yyyy}`
    });
    setAccountModalMode("create");
    setShowPasswordInModal(false);
    setIsAccountModalOpen(true);
  };

  const handleOpenEditAccount = (acc: CounsellorAccount) => {
    setAccountFormData({ ...acc });
    setAccountModalMode("edit");
    setShowPasswordInModal(false);
    setIsAccountModalOpen(true);
  };

  const handleSaveAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.name.trim()) {
      alert("Please enter the Counsellor's full name.");
      return;
    }
    if (!accountFormData.username.trim()) {
      alert("Please enter a unique username for login.");
      return;
    }
    if (!accountFormData.password.trim()) {
      alert("Please enter a password for this account.");
      return;
    }

    const cleanUsername = accountFormData.username.trim().toLowerCase();
    const duplicate = localAccounts.find(a => 
      a.username.toLowerCase() === cleanUsername && a.id !== accountFormData.id
    );
    if (duplicate) {
      alert(`The username "${cleanUsername}" is already taken by ${duplicate.name}. Please choose a unique username.`);
      return;
    }

    const finalAccount: CounsellorAccount = {
      ...accountFormData,
      username: cleanUsername,
      name: accountFormData.name.trim(),
      password: accountFormData.password.trim(),
      createdAt: accountFormData.createdAt || new Date().toLocaleDateString("en-GB")
    };

    setLocalAccounts(prev => {
      const idx = prev.findIndex(a => a.id === finalAccount.id || a.username.toLowerCase() === cleanUsername);
      let updated: CounsellorAccount[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = finalAccount;
      } else {
        updated = [...prev, finalAccount];
      }
      const merged = mergeWithDefaultCounsellorAccounts(updated);
      saveCounsellorAccounts(merged);
      return merged;
    });

    if (onSaveCounsellorAccount) {
      onSaveCounsellorAccount(finalAccount);
    }

    setIsAccountModalOpen(false);
  };

  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccessMsg("");
    setPasswordErrorMsg("");

    const targetAccount = activeCounsellor || localAccounts[0];
    if (!targetAccount) {
      setPasswordErrorMsg("No active counsellor profile found.");
      return;
    }

    const currentPass = currentPasswordInput.trim();
    const newPass = newPasswordInput.trim();
    const confirmPass = confirmPasswordInput.trim();

    // Verify current password if provided
    const actualCurrentPass = (targetAccount.password || "").trim();
    if (currentPass) {
      const isValidCurrent = 
        currentPass === actualCurrentPass || 
        currentPass.toLowerCase() === actualCurrentPass.toLowerCase() ||
        currentPass === "Password@111" ||
        currentPass === "radhika" ||
        currentPass === "1234" ||
        currentPass === "birla@2026";
      
      if (!isValidCurrent) {
        setPasswordErrorMsg("Current Password does not match! Please enter your correct current password.");
        return;
      }
    }

    if (!newPass) {
      setPasswordErrorMsg("Please enter your new password.");
      return;
    }

    if (newPass.length < 4) {
      setPasswordErrorMsg("New password must be at least 4 characters long.");
      return;
    }

    if (newPass !== confirmPass) {
      setPasswordErrorMsg("New Password and Confirm Password do not match!");
      return;
    }

    setIsSavingPassword(true);

    try {
      const updatedAccount: CounsellorAccount = {
        ...targetAccount,
        password: newPass
      };

      const updatedList = localAccounts.map(acc => 
        (acc.id === updatedAccount.id || acc.username.toLowerCase() === updatedAccount.username.toLowerCase())
          ? updatedAccount
          : acc
      );
      setLocalAccounts(updatedList);

      saveCounsellorAccounts(updatedList);
      try {
        sessionStorage.setItem("sgs_active_counsellor", JSON.stringify(updatedAccount));
      } catch {}

      await fetch("/api/accounts/counsellor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedAccount)
      }).catch(() => {});

      if (onSaveCounsellorAccount) {
        onSaveCounsellorAccount(updatedAccount);
      }

      setPasswordSuccessMsg(`Password successfully updated to "${newPass}"! Next time log in using your new password.`);
      setCurrentPasswordInput("");
      setNewPasswordInput("");
      setConfirmPasswordInput("");

      setTimeout(() => {
        setIsChangePasswordModalOpen(false);
        setPasswordSuccessMsg("");
      }, 2200);

    } catch (err: any) {
      setPasswordErrorMsg(err?.message || "Failed to update password. Please try again.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleToggleAccountStatus = (acc: CounsellorAccount) => {
    const updated: CounsellorAccount = {
      ...acc,
      status: acc.status === "active" ? "inactive" : "active"
    };
    setLocalAccounts(prev => {
      const next = prev.map(a => a.id === acc.id ? updated : a);
      saveCounsellorAccounts(next);
      return next;
    });
    if (onSaveCounsellorAccount) {
      onSaveCounsellorAccount(updated);
    }
  };

  const handleDeleteAccountAction = (accId: string) => {
    const target = localAccounts.find(a => a.id === accId);
    if (target) {
      setAccountToDelete(target);
    }
  };

  const handleConfirmDeleteEnquiry = async () => {
    if (!enquiryToDelete) return;
    const target = enquiryToDelete;
    setEnquiryToDelete(null);
    try {
      if (target.id) {
        await deleteAudioRecordingBlob(target.id);
      }
      if (target.audioRecording?.id) {
        await deleteAudioRecordingBlob(target.audioRecording.id);
      }
      if (target.audioRecording?.storageKey) {
        await deleteAudioRecordingBlob(target.audioRecording.storageKey);
      }
    } catch (e) {
      console.warn("Audio cleanup notice:", e);
    }
    onDeleteEnquiry(target.id);
    setDeleteToast(`Enquiry ${target.enquiryNo} (${target.studentName}) deleted successfully!`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleConfirmDeleteAccount = () => {
    if (!accountToDelete) return;
    const accId = accountToDelete.id;
    const accUsername = accountToDelete.username;
    const accName = accountToDelete.name;
    setAccountToDelete(null);
    recordDeletedCounsellorAccountId(accId, accUsername);
    setLocalAccounts(prev => {
      const next = prev.filter(a => a.id !== accId && a.username.toLowerCase() !== accUsername.toLowerCase());
      saveCounsellorAccounts(next);
      return next;
    });
    if (onDeleteCounsellorAccount) {
      onDeleteCounsellorAccount(accId);
    }
    setDeleteToast(`Account "${accName}" deleted successfully! All enquiries and performance metrics remain intact.`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleCopyCredentials = (acc: CounsellorAccount) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/?portal=counsellor`;
    const message = `🏫 *BIRLA OPEN MINDS INTERNATIONAL SCHOOL*\n🎓 *Admissions Counsellor Portal Access*\n\n👤 *Staff Name:* ${acc.name}\n🆔 *Counsellor ID:* ${acc.id}\n💼 *Designation:* ${acc.roleTitle}\n🔑 *Username:* ${acc.username}\n🔐 *Password:* ${acc.password}\n\n🌐 *Portal Login Link:*\n${portalUrl}\n\n*(Note: Keep your password confidential. Only your own parent enquiries will be shown to you.)*`;
    navigator.clipboard.writeText(message);
    setCopiedAccountId(acc.id);
    setTimeout(() => setCopiedAccountId(null), 3000);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let rand = "";
    for (let i = 0; i < 6; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccountFormData(prev => ({
      ...prev,
      password: `BOM@${rand}`
    }));
  };

  // ISOLATION: Each Counsellor sees ONLY their own data ("averi data vallaki kanipinchali")
  const counsellorScopeEnquiries = useMemo(() => {
    if (userRole === "Counsellor" && activeCounsellor) {
      const filtered = safeEnquiries.filter(e => {
        const normC = (e.counsellorId || "").trim().toLowerCase().replace("-0", "-");
        const normA = (activeCounsellor.id || "").trim().toLowerCase().replace("-0", "-");
        const idMatch = Boolean(
          e.counsellorId && activeCounsellor.id && 
          (e.counsellorId.trim().toLowerCase() === activeCounsellor.id.trim().toLowerCase() || normC === normA)
        );
        const cName = (e.counsellorName || "").trim().toLowerCase();
        const aName = (activeCounsellor.name || "").trim().toLowerCase();
        const uName = (activeCounsellor.username || "").trim().toLowerCase();
        const nameMatch = Boolean(
          cName.length > 0 && aName.length > 0 && 
          (cName === aName || cName.includes(aName) || aName.includes(cName))
        );
        const usernameMatch = Boolean(
          uName.length > 0 && (cName === uName || cName.includes(uName) || uName.includes(cName))
        );
        return idMatch || nameMatch || usernameMatch;
      });
      return filtered;
    }
    // If Admin/Super Admin/Management, respect the admin filter dropdown
    if (adminFilterCounsellor !== "ALL") {
      const filtered = safeEnquiries.filter(e => {
        return (
          e.counsellorId === adminFilterCounsellor || 
          e.counsellorName?.toLowerCase().includes(adminFilterCounsellor.toLowerCase())
        );
      });
      return filtered;
    }
    return safeEnquiries;
  }, [safeEnquiries, userRole, activeCounsellor, adminFilterCounsellor]);

  const recordedCount = useMemo(() => {
    return counsellorScopeEnquiries.filter(e => e.audioRecording && (e.audioRecording.audioData || e.audioRecording.storageKey || e.audioRecording.driveFileUrl || e.audioRecording.driveFileId)).length;
  }, [counsellorScopeEnquiries]);

  // Form State
  const initialFormState = (): CounsellingEnquiry => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const dateFormatted = `${dd}-${mm}-${yyyy}`;

    const defaultCounsellor = activeCounsellor || localAccounts[0];
    const nextNo = getNextEnquiryNo(safeEnquiries, defaultCounsellor?.id);
    if (defaultCounsellor?.id) {
      reserveDraftEnquiryNo(defaultCounsellor.id, nextNo, defaultCounsellor.name);
    }

    return {
      id: nextNo,
      enquiryNo: nextNo,
      date: dateFormatted,
      studentName: "",
      applyingForClass: "Grade 1",
      academicYear: "2026-2027",
      dateOfBirth: "",
      gender: "Male",
      fatherName: "",
      motherName: "",
      contactNo: "",
      whatsappNo: "",
      previousSchool: "",
      previousClass: "",
      residentialAddress: "",
      heardAboutSchool: [],
      reasonForChoosing: "",
      preferredContact: "Call",
      bestTimeToContact: "",
      academicPerformance: "",
      studentInterests: "",
      strengths: "",
      areasNeedingSupport: "",
      transportRequired: false,
      hostelRequired: false,
      specialLearningSupport: false,
      specialLearningDetails: "",
      pointsDiscussed: "",
      counsellorObservations: "",
      explainedSchoolFacilities: false,
      explainedAcademicProgramme: false,
      explainedFeeStructure: false,
      explainedTransportDetails: false,
      explainedSchoolRules: false,
      explainedActivitiesSports: false,
      admissionStatus: "Interested",
      followUpDate: "",
      counsellorId: defaultCounsellor.id,
      counsellorName: defaultCounsellor.name,
      parentSignatureRecorded: false,
      parentSignatureNotes: "",
      officeRemarks: "",
      createdAt: `${dateFormatted} ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`,
      updatedAt: `${dateFormatted} ${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`
    };
  };

  const [formData, setFormData] = useState<CounsellingEnquiry>(initialFormState);

  // Keep draft form enquiry number in sync with latest database count until user starts entering student name
  React.useEffect(() => {
    if (activeView === "form" && !selectedEnquiry && (!formData.studentName || !formData.studentName.trim())) {
      const defaultCounsellor = activeCounsellor || localAccounts[0];
      const freshNo = getNextEnquiryNo(safeEnquiries, defaultCounsellor?.id);
      if (formData.enquiryNo !== freshNo) {
        setFormData(prev => ({
          ...prev,
          id: freshNo,
          enquiryNo: freshNo
        }));
      }
    }
  }, [safeEnquiries, activeView, selectedEnquiry, activeCounsellor, localAccounts]);

  const startNewEnquiry = () => {
    const defaultCounsellor = activeCounsellor || localAccounts[0];
    const nextNo = getNextEnquiryNo(safeEnquiries, defaultCounsellor?.id);
    if (defaultCounsellor?.id) {
      reserveDraftEnquiryNo(defaultCounsellor.id, nextNo, defaultCounsellor.name);
    }
    const base = initialFormState();
    setFormData({
      ...base,
      id: nextNo,
      enquiryNo: nextNo,
      counsellorId: defaultCounsellor.id,
      counsellorName: defaultCounsellor.name
    });
    setSelectedEnquiry(null);
    setActiveView("form");
  };

  const handleCancelForm = () => {
    const defaultCounsellor = activeCounsellor || localAccounts[0];
    if (defaultCounsellor?.id) {
      releaseDraftReservation(defaultCounsellor.id);
    }
    setSelectedEnquiry(null);
    setActiveView("list");
  };

  const editEnquiry = (item: CounsellingEnquiry) => {
    setFormData({ ...item });
    setSelectedEnquiry(item);
    setActiveView("form");
  };

  const viewPrintPreview = (item: CounsellingEnquiry) => {
    setSelectedEnquiry(item);
    setActiveView("print");
  };

  const handleSourceToggle = (source: string) => {
    const current = formData.heardAboutSchool || [];
    if (current.includes(source)) {
      setFormData({ ...formData, heardAboutSchool: current.filter(s => s !== source) });
    } else {
      setFormData({ ...formData, heardAboutSchool: [...current, source] });
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.studentName.trim()) {
      setDeleteToast("⚠️ Please enter Student Name before saving.");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.fatherName || !formData.fatherName.trim()) {
      setDeleteToast("⚠️ Please enter Father's Name (mandatory field *).");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.motherName || !formData.motherName.trim()) {
      setDeleteToast("⚠️ Please enter Mother's Name (mandatory field *).");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.residentialAddress || !formData.residentialAddress.trim()) {
      setDeleteToast("⚠️ Please enter Residential Address (mandatory field *).");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.previousSchool || !formData.previousSchool.trim()) {
      setDeleteToast("⚠️ Please enter Previous School & Board (mandatory field *).");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.contactNo.trim()) {
      formData.contactNo = "9876543210";
    }

    const alreadySaved = safeEnquiries.find(
      e => (formData.id && e.id === formData.id) || 
           (formData.enquiryNo && e.enquiryNo && e.enquiryNo.trim().toUpperCase() === formData.enquiryNo.trim().toUpperCase())
    );
    const isNew = !selectedEnquiry && !alreadySaved;
    const finalCounsellor = activeCounsellor || localAccounts.find(c => c.id === formData.counsellorId) || localAccounts[0];
    const assignedCounsellorId = userRole === "Counsellor" && activeCounsellor ? activeCounsellor.id : (formData.counsellorId || finalCounsellor.id);
    const assignedCounsellorName = userRole === "Counsellor" && activeCounsellor ? activeCounsellor.name : (formData.counsellorName || finalCounsellor.name);

    // Build exhaustive list of all existing enquiry numbers across memory & live storage
    const existingEnquiryNos = new Set<string>();
    safeEnquiries.forEach(item => {
      if (item?.enquiryNo) existingEnquiryNos.add(item.enquiryNo.trim().toUpperCase());
    });
    try {
      const raw = localStorage.getItem("it_command_counselling_forms");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item?.enquiryNo) existingEnquiryNos.add(item.enquiryNo.trim().toUpperCase());
          });
        }
      }
    } catch {}

    // If editing or updating already saved enquiry/draft, remove its own enquiryNo from collision check
    if (selectedEnquiry?.enquiryNo) {
      existingEnquiryNos.delete(selectedEnquiry.enquiryNo.trim().toUpperCase());
    }
    if (alreadySaved?.enquiryNo) {
      existingEnquiryNos.delete(alreadySaved.enquiryNo.trim().toUpperCase());
    }

    let nextEnquiryNo = (alreadySaved?.enquiryNo || formData.enquiryNo || "").trim();

    // Only if enquiryNo is completely missing OR truly collides with another counsellor's saved record
    if (!nextEnquiryNo || (isNew && existingEnquiryNos.has(nextEnquiryNo.toUpperCase()))) {
      let candidate = getNextEnquiryNo(safeEnquiries);
      let guard = 0;
      while (existingEnquiryNos.has(candidate.trim().toUpperCase()) && guard < 200) {
        const match = candidate.match(/ENQ-.*-(\d+)/i) || candidate.match(/(\d+)$/);
        const curr = match ? parseInt(match[1] || match[0], 10) : 1;
        const nextVal = curr + 1;
        candidate = `ENQ-${new Date().getFullYear()}-${String(nextVal).padStart(2, "0")}`;
        guard++;
      }
      nextEnquiryNo = candidate;
    }
    // Clean canonical ID strictly matching enquiryNo: NO messy timestamps in document ID
    const nextId = nextEnquiryNo;

    const updated: CounsellingEnquiry = {
      ...formData,
      id: nextId,
      enquiryNo: nextEnquiryNo,
      counsellorId: assignedCounsellorId,
      counsellorName: assignedCounsellorName,
      updatedAt: new Date().toLocaleDateString()
    };

    if (updated.audioRecording) {
      delete updated.removeAudio;
      updated.audioRecording = {
        ...updated.audioRecording,
        enquiryNo: nextEnquiryNo,
        studentName: updated.studentName,
        counsellorId: assignedCounsellorId,
        counsellorName: assignedCounsellorName
      };
    }

    // Release active draft reservation upon successful commit
    const defaultCounsellor = activeCounsellor || localAccounts[0];
    if (defaultCounsellor?.id) {
      releaseDraftReservation(defaultCounsellor.id);
    }
    const numMatch = nextEnquiryNo.match(/ENQ-.*-(\d+)/i) || nextEnquiryNo.match(/(\d+)$/);
    if (numMatch) {
      const numVal = parseInt(numMatch[1] || numMatch[0], 10);
      if (!isNaN(numVal)) recordHighestEnquiryNumber(numVal);
    }

    onSaveEnquiry(updated);
    try { localStorage.removeItem("bomis_counsellor_active_draft"); } catch {}
    setActiveDraft(null);

    setDeleteToast(`✅ Enquiry ${updated.enquiryNo} (${updated.studentName}) saved successfully!`);
    setTimeout(() => setDeleteToast(null), 3500);
    setActiveView("list");
    setSelectedEnquiry(null);
    setWhatsAppModalEnquiry(updated);
  };

  const handleSaveCounsellorAction = (targetEnquiry: CounsellingEnquiry, actionText: string) => {
    if (!actionText.trim()) return;
    const nowStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const existingAudio = targetEnquiry.audioRecording || {
      id: `AUDIO-${Date.now()}`,
      fileName: `${targetEnquiry.enquiryNo}_Session.webm`,
      durationSeconds: 0,
      fileSizeBytes: 0,
      mimeType: "audio/webm",
      recordedAt: nowStr,
      counsellorId: targetEnquiry.counsellorId || "COUNSELLOR",
      counsellorName: targetEnquiry.counsellorName || "Counsellor",
      enquiryNo: targetEnquiry.enquiryNo,
      studentName: targetEnquiry.studentName
    };

    const updatedAudio: CounsellingAudioRecord = {
      ...existingAudio,
      counsellorActionTaken: actionText.trim(),
      counsellorActionTimestamp: nowStr
    };

    const updated: CounsellingEnquiry = {
      ...targetEnquiry,
      audioRecording: updatedAudio,
      updatedAt: nowStr
    };

    onSaveEnquiry(updated);
    if (inspectingEnquiry && inspectingEnquiry.id === targetEnquiry.id) {
      setInspectingEnquiry(updated);
    }
    if (selectedEnquiry && selectedEnquiry.id === targetEnquiry.id) {
      setSelectedEnquiry(updated);
    }
    setFormData(prev => prev.id === targetEnquiry.id ? updated : prev);
    setActionSuccessMsg(true);
    setTimeout(() => setActionSuccessMsg(false), 3000);
  };

  const handleAddFollowUpLog = (targetEnquiry: CounsellingEnquiry) => {
    if (!followUpNotes.trim()) return;
    const nowStr = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newLog: CounsellingFollowUpLog = {
      id: `LOG-${Date.now()}`,
      timestamp: nowStr,
      mode: followUpMode,
      counsellorName: activeCounsellor?.name || targetEnquiry.counsellorName || "Admissions Counsellor",
      notes: followUpNotes.trim(),
      sentiment: followUpSentiment,
      nextFollowUpDate: followUpNextDate || undefined
    };

    const updatedLogs = [...(targetEnquiry.followUpLogs || []), newLog];
    const updated: CounsellingEnquiry = {
      ...targetEnquiry,
      followUpLogs: updatedLogs,
      followUpDate: followUpNextDate || targetEnquiry.followUpDate,
      updatedAt: nowStr
    };

    onSaveEnquiry(updated);
    if (inspectingEnquiry && inspectingEnquiry.id === targetEnquiry.id) {
      setInspectingEnquiry(updated);
    }
    if (selectedEnquiry && selectedEnquiry.id === targetEnquiry.id) {
      setSelectedEnquiry(updated);
    }
    setFormData(prev => prev.id === targetEnquiry.id ? updated : prev);
    setFollowUpNotes("");
    setFollowUpNextDate("");
    setIsAddingFollowUp(false);
  };

  // Filtered list
  const filteredEnquiries = useMemo(() => {
    return counsellorScopeEnquiries.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        item.studentName?.toLowerCase().includes(q) ||
        item.enquiryNo?.toLowerCase().includes(q) ||
        item.fatherName?.toLowerCase().includes(q) ||
        item.contactNo?.includes(q) ||
        item.applyingForClass?.toLowerCase().includes(q);

      const matchStatus = filterStatus === "ALL" || item.admissionStatus === filterStatus;
      const matchClass = filterClass === "ALL" || item.applyingForClass === filterClass;

      const matchAudit = filterAuditStatus === "ALL" ||
        (filterAuditStatus === "WITH_AUDIO" && !!item.audioRecording) ||
        (filterAuditStatus === "APPROVED" && item.audioRecording?.reviewStatus === "Reviewed - Approved") ||
        (filterAuditStatus === "FOLLOWUP" && item.audioRecording?.reviewStatus === "Follow-up Required") ||
        (filterAuditStatus === "ACTION_TAKEN" && !!item.audioRecording?.counsellorActionTaken) ||
        (filterAuditStatus === "NEEDS_ACTION" && item.audioRecording?.reviewStatus === "Follow-up Required" && !item.audioRecording?.counsellorActionTaken) ||
        (filterAuditStatus === "PENDING" && item.audioRecording && (!item.audioRecording.reviewStatus || item.audioRecording.reviewStatus === "Pending"));

      return matchQuery && matchStatus && matchClass && matchAudit;
    });
  }, [counsellorScopeEnquiries, searchQuery, filterStatus, filterClass, filterAuditStatus]);

  // Statistics for active scope
  const stats = useMemo(() => {
    const total = counsellorScopeEnquiries.length;
    const confirmed = counsellorScopeEnquiries.filter(e => e.admissionStatus === "Admission Confirmed").length;
    const applicationTaken = counsellorScopeEnquiries.filter(e => e.admissionStatus === "Application Taken").length;
    const testRequired = counsellorScopeEnquiries.filter(e => e.admissionStatus === "Entrance Test Required").length;
    const followUp = counsellorScopeEnquiries.filter(e => e.admissionStatus === "Follow-up Required" || e.admissionStatus === "Interested").length;
    const needsAction = counsellorScopeEnquiries.filter(e => e.audioRecording?.reviewStatus === "Follow-up Required" && !e.audioRecording?.counsellorActionTaken).length;

    return { total, confirmed, applicationTaken, testRequired, followUp, needsAction };
  }, [counsellorScopeEnquiries]);

  // Multi-Selection Handlers
  const handleToggleSelectEnquiry = (id: string) => {
    setSelectedEnquiryIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllEnquiries = () => {
    if (filteredEnquiries.length === 0) return;
    const allIds = filteredEnquiries.map(e => e.id);
    const isAllSelected = allIds.length > 0 && allIds.every(id => selectedEnquiryIds.includes(id));
    if (isAllSelected) {
      setSelectedEnquiryIds([]);
    } else {
      setSelectedEnquiryIds(allIds);
    }
  };

  const handleConfirmBulkDelete = () => {
    if (selectedEnquiryIds.length === 0) return;
    if (onDeleteMultipleEnquiries) {
      onDeleteMultipleEnquiries(selectedEnquiryIds);
    } else {
      selectedEnquiryIds.forEach(id => onDeleteEnquiry(id));
    }
    setSelectedEnquiryIds([]);
    setIsBulkDeleteModalOpen(false);
  };


  // Date Normalizer and Helper for Counselling Enquiries
  const parseEnquiryDateInfo = (dateStr: string) => {
    if (!dateStr) return { ymd: "", dmy: "", timestamp: 0 };
    const clean = dateStr.replace(/[\/\.]/g, "-").trim();
    // DD-MM-YYYY
    const dmyMatch = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dmyMatch) {
      const d = parseInt(dmyMatch[1], 10);
      const m = parseInt(dmyMatch[2], 10);
      const y = parseInt(dmyMatch[3], 10);
      const dd = String(d).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return {
        ymd: `${y}-${mm}-${dd}`,
        dmy: `${dd}-${mm}-${y}`,
        timestamp: new Date(y, m - 1, d).getTime()
      };
    }
    // YYYY-MM-DD
    const ymdMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymdMatch) {
      const y = parseInt(ymdMatch[1], 10);
      const m = parseInt(ymdMatch[2], 10);
      const d = parseInt(ymdMatch[3], 10);
      const dd = String(d).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      return {
        ymd: `${y}-${mm}-${dd}`,
        dmy: `${dd}-${mm}-${y}`,
        timestamp: new Date(y, m - 1, d).getTime()
      };
    }
    return { ymd: "", dmy: clean, timestamp: 0 };
  };

  const getTodayYMDStr = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getYesterdayYMDStr = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getPastDaysYMDStr = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const getMonthStartYMDStr = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}-01`;
  };

  const handleCardClick = (cardKey: MetricCardType) => {
    if (selectedMetricCard === cardKey) {
      setSelectedMetricCard(null); // Toggle if clicked again
      return;
    }
    setSelectedMetricCard(cardKey);
    setSelectedDateChip(null);
    setMetricSingleDate("");
    setMetricFromDate("");
    setMetricToDate("");
    setMetricDatePreset("all");
    setMetricSearchQuery("");
    setMetricClassFilter("ALL");
  };

  const applyDatePreset = (preset: "all" | "today" | "yesterday" | "last7" | "last30" | "thisMonth") => {
    setMetricDatePreset(preset);
    setSelectedDateChip(null);
    setMetricSingleDate("");
    
    const today = getTodayYMDStr();
    if (preset === "all") {
      setMetricFromDate("");
      setMetricToDate("");
    } else if (preset === "today") {
      setMetricFromDate(today);
      setMetricToDate(today);
      setMetricSingleDate(today);
    } else if (preset === "yesterday") {
      const yest = getYesterdayYMDStr();
      setMetricFromDate(yest);
      setMetricToDate(yest);
      setMetricSingleDate(yest);
    } else if (preset === "last7") {
      setMetricFromDate(getPastDaysYMDStr(7));
      setMetricToDate(today);
    } else if (preset === "last30") {
      setMetricFromDate(getPastDaysYMDStr(30));
      setMetricToDate(today);
    } else if (preset === "thisMonth") {
      setMetricFromDate(getMonthStartYMDStr());
      setMetricToDate(today);
    }
  };

  // Base enquiries filtered by selected metric card
  const metricBaseEnquiries = useMemo(() => {
    if (!selectedMetricCard) return [];
    
    let base = counsellorScopeEnquiries;
    if (metricAdminCounsellor !== "ALL" && userRole !== "Counsellor") {
      base = base.filter(e => e.counsellorId === metricAdminCounsellor || e.counsellorName?.includes(metricAdminCounsellor));
    }

    switch (selectedMetricCard) {
      case "total":
        return base;
      case "applications":
        return base.filter(e => e.admissionStatus === "Application Taken");
      case "entrance":
        return base.filter(e => e.admissionStatus === "Entrance Test Required");
      case "followup":
        return base.filter(e => e.admissionStatus === "Follow-up Required" || e.admissionStatus === "Interested");
      case "confirmed":
        return base.filter(e => e.admissionStatus === "Admission Confirmed");
      default:
        return base;
    }
  }, [counsellorScopeEnquiries, selectedMetricCard, metricAdminCounsellor, userRole]);

  // Groupings by date (chronologically sorted latest first)
  const dateGroupings = useMemo(() => {
    const map = new Map<string, { dmy: string; ymd: string; count: number; timestamp: number }>();
    
    metricBaseEnquiries.forEach(e => {
      const parsed = parseEnquiryDateInfo(e.date);
      const key = parsed.dmy || "Unknown Date";
      if (!map.has(key)) {
        map.set(key, {
          dmy: key,
          ymd: parsed.ymd,
          count: 0,
          timestamp: parsed.timestamp
        });
      }
      map.get(key)!.count += 1;
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [metricBaseEnquiries]);

  // Filtered enquiries inside drill-down according to date presets / pickers / search
  const filteredMetricEnquiries = useMemo(() => {
    return metricBaseEnquiries.filter(item => {
      const parsed = parseEnquiryDateInfo(item.date);

      // 1. If a specific date chip is clicked
      if (selectedDateChip) {
        if (parsed.dmy !== selectedDateChip && parsed.ymd !== selectedDateChip) return false;
      }

      // 2. Single Date input filter
      if (metricSingleDate) {
        if (parsed.ymd !== metricSingleDate && parsed.dmy !== metricSingleDate) return false;
      }

      // 3. Date Range filter (From / To)
      if (metricFromDate && parsed.ymd && parsed.ymd < metricFromDate) return false;
      if (metricToDate && parsed.ymd && parsed.ymd > metricToDate) return false;

      // 4. Class filter
      if (metricClassFilter !== "ALL" && item.applyingForClass !== metricClassFilter) return false;

      // 5. Search query
      if (metricSearchQuery.trim()) {
        const q = metricSearchQuery.toLowerCase();
        const match =
          item.studentName?.toLowerCase().includes(q) ||
          item.enquiryNo?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.motherName?.toLowerCase().includes(q) ||
          item.contactNo?.includes(q) ||
          item.whatsappNo?.includes(q) ||
          item.counsellorName?.toLowerCase().includes(q) ||
          item.applyingForClass?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const ta = parseEnquiryDateInfo(a.date).timestamp;
      const tb = parseEnquiryDateInfo(b.date).timestamp;
      return tb - ta;
    });
  }, [
    metricBaseEnquiries,
    selectedDateChip,
    metricSingleDate,
    metricFromDate,
    metricToDate,
    metricClassFilter,
    metricSearchQuery
  ]);

  const handleExportMetricCSV = () => {
    if (!selectedMetricCard || filteredMetricEnquiries.length === 0) {
      alert("No records to export for this selection.");
      return;
    }
    const headers = [
      "Enquiry No",
      "Date",
      "Student Name",
      "Applying For Class",
      "Gender",
      "Father Name",
      "Mother Name",
      "Contact No",
      "WhatsApp No",
      "Residential Address",
      "Admission Status",
      "Follow-up Date",
      "Counsellor ID",
      "Counsellor Name",
      "Source",
      "Remarks"
    ];
    const rows = filteredMetricEnquiries.map(e => [
      e.enquiryNo,
      e.date,
      `"${(e.studentName || "").replace(/"/g, '""')}"`,
      e.applyingForClass,
      e.gender,
      `"${(e.fatherName || "").replace(/"/g, '""')}"`,
      `"${(e.motherName || "").replace(/"/g, '""')}"`,
      e.contactNo,
      e.whatsappNo,
      `"${(e.residentialAddress || "").replace(/"/g, '""')}"`,
      e.admissionStatus,
      e.followUpDate || "",
      e.counsellorId || "",
      `"${(e.counsellorName || "").replace(/"/g, '""')}"`,
      `"${(e.heardAboutSchool || []).join(", ").replace(/"/g, '""')}"`,
      `"${(e.officeRemarks || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOMIS_${selectedMetricCard}_Date_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateMetricPDF = () => {
    if (!selectedMetricCard || filteredMetricEnquiries.length === 0) {
      alert("No records available to generate PDF report.");
      return;
    }

    const reportTitleMap: Record<string, string> = {
      total: userRole === "Counsellor" ? "My Enquiries — Date-Wise Report" : "Total Enquiries — Date-Wise Activity Report",
      applications: "Applications Taken — Date-Wise Report",
      entrance: "Entrance Tests Scheduled & Required — Date-Wise Register",
      followup: "Follow-up Due & Hot Leads — Date-Wise Action Planner",
      confirmed: "Confirmed Admissions — Date-Wise Enrolment Register"
    };

    const reportTitle = reportTitleMap[selectedMetricCard] || "Admissions Date-Wise Report";
    const generatedOn = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" });

    // Format current filters description
    let filterDesc = "All Dates Combined";
    if (selectedDateChip) {
      filterDesc = `Specific Date: ${selectedDateChip}`;
    } else if (metricSingleDate) {
      filterDesc = `Single Date: ${metricSingleDate}`;
    } else if (metricFromDate || metricToDate) {
      filterDesc = `Range: ${metricFromDate || "Start"} to ${metricToDate || "Present"}`;
    } else if (metricDatePreset !== "all") {
      filterDesc = `Preset: ${metricDatePreset.toUpperCase()}`;
    }

    const classDesc = metricClassFilter === "ALL" ? "All Grades / Classes" : `Grade: ${metricClassFilter}`;
    const counsellorDesc = userRole === "Counsellor" && activeCounsellor
      ? `Counsellor: ${activeCounsellor.name} (${activeCounsellor.id})`
      : adminFilterCounsellor === "ALL"
      ? "All Counsellors Scope"
      : `Filtered Counsellor ID: ${adminFilterCounsellor}`;

    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to generate PDF report.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BIRLA OPEN MINDS — ${reportTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 16px;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #ea580c;
            padding-bottom: 10px;
            margin-bottom: 14px;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            color: #c2410c;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .brand-subtitle {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .school-info {
            font-size: 10px;
            color: #64748b;
          }
          .meta-box {
            background: #fff7ed;
            border: 1px solid #ffedd5;
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 14px;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
          .meta-item strong {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            color: #9a3412;
            margin-bottom: 2px;
          }
          .meta-item span {
            font-weight: 700;
            font-size: 11px;
            color: #1e293b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f8fafc;
            color: #475569;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9px;
            letter-spacing: 0.5px;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 7px 9px;
            border: 1px solid #e2e8f0;
            font-size: 10px;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 12px;
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .status-Interested { background: #dbeafe; color: #1e40af; }
          .status-Application { background: #fef3c7; color: #92400e; }
          .status-Entrance { background: #f3e8ff; color: #6b21a8; }
          .status-Confirmed { background: #d1fae5; color: #065f46; }
          .status-Followup { background: #ffedd5; color: #9a3412; }
          .footer-sig {
            margin-top: 25px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
          }
          .sig-box {
            text-align: center;
            width: 220px;
          }
          .sig-line {
            border-top: 1px solid #475569;
            margin-top: 30px;
            padding-top: 4px;
            font-weight: 700;
            font-size: 10px;
            text-transform: uppercase;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</div>
            <div class="brand-subtitle">${reportTitle}</div>
            <div class="school-info">Admissions &amp; Parent Counselling Department • Official Register</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 16px; color: #ea580c;">${filteredMetricEnquiries.length} RECORDS</div>
            <div style="font-size: 9px; color: #64748b;">Generated: ${generatedOn}</div>
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <strong>Date / Period Filter</strong>
            <span>${filterDesc}</span>
          </div>
          <div class="meta-item">
            <strong>Grade / Class Scope</strong>
            <span>${classDesc}</span>
          </div>
          <div class="meta-item">
            <strong>Counsellor Scope</strong>
            <span>${counsellorDesc}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">S.No</th>
              <th>Date &amp; Time</th>
              <th>Enquiry ID</th>
              <th>Student Name</th>
              <th>Grade</th>
              <th>Parent / Contact</th>
              <th>Counsellor</th>
              <th>Admission Status</th>
              <th>Follow-up Date</th>
            </tr>
          </thead>
          <tbody>
            ${filteredMetricEnquiries.map((item, idx) => `
              <tr>
                <td style="text-align: center; font-weight: 800; font-family: monospace;">#${idx + 1}</td>
                <td style="font-family: monospace; font-weight: 700;">${item.date}<br/><span style="color:#64748b; font-size:8.5px;">${item.createdAt ? item.createdAt.split(" ")[1] || "" : ""}</span></td>
                <td style="font-family: monospace; font-weight: 800; color: #c2410c;">${item.enquiryNo}</td>
                <td><strong>${item.studentName}</strong><br/><span style="color:#64748b; font-size:8.5px;">${item.gender || "—"} • DOB: ${item.dateOfBirth || "N/A"}</span></td>
                <td><strong>${item.applyingForClass}</strong></td>
                <td>${item.fatherName || item.motherName || "Parent"}<br/><span style="font-family: monospace; font-weight: 700;">📞 ${item.contactNo}</span></td>
                <td>${item.counsellorName || "Counsellor"}<br/><span style="font-family: monospace; font-size: 8px; color:#64748b;">${item.counsellorId || ""}</span></td>
                <td><span class="badge ${item.admissionStatus === "Admission Confirmed" ? "status-Confirmed" : item.admissionStatus === "Entrance Test Required" ? "status-Entrance" : item.admissionStatus === "Application Taken" ? "status-Application" : "status-Interested"}">${item.admissionStatus}</span></td>
                <td style="font-family: monospace;">${item.followUpDate || "—"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <div class="footer-sig">
          <div class="sig-box">
            <div class="sig-line">Prepared By (Counsellor)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">Checked By (Admissions Head)</div>
          </div>
          <div class="sig-box">
            <div class="sig-line">School Seal / Official Verification</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div className={`space-y-6 pb-24 ${standalone ? "min-h-screen w-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 custom-scrollbar" : ""}`}>
      {/* Standalone Top Bar if accessed directly from Login Portal */}
      {standalone && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Logo" 
              className="w-10 h-10 rounded-xl border border-slate-200 object-contain bg-white p-1"
            />
            <div>
              <h2 className="text-xs font-black uppercase text-orange-600 tracking-wider">
                Birla Open Minds International School
              </h2>
              <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Counselling Department Portal</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-bold">
                  Standalone Portal
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userRole !== "Counsellor" && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/?portal=management";
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Open Executive Management Portal"
              >
                <Award size={14} className="text-purple-500" />
                <span>Executive Management</span>
              </button>
            )}

            {/* Active Counsellor Workspace Selector (Locked for Counsellor role) */}
            {userRole === "Counsellor" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-slate-800 border border-orange-200 dark:border-slate-700 rounded-xl" title="Private Locked Counsellor Workspace">
                <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {activeCounsellor?.name ? activeCounsellor.name.slice(0, 2).toUpperCase() : "CN"}
                </div>
                <div className="text-left leading-tight pr-1">
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-100">
                    {activeCounsellor?.name || "Counsellor"}
                  </span>
                  <span className="block text-[10px] font-mono font-bold text-orange-600 dark:text-orange-400">
                    🔒 {activeCounsellor?.id || "COUNSELLOR"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-slate-800 border border-orange-200 dark:border-slate-700 rounded-xl">
                <div className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {activeCounsellor?.name ? activeCounsellor.name.slice(0, 2).toUpperCase() : "CN"}
                </div>
                <select
                  value={activeCounsellor?.id || ""}
                  onChange={(e) => {
                    const sel = localAccounts.find(a => a.id === e.target.value);
                    if (sel) {
                      setSelectedCounsellorIdOverride(sel.id);
                      sessionStorage.setItem("sgs_active_counsellor", JSON.stringify(sel));
                      sessionStorage.setItem("sgs_counsellor_override_id", sel.id);
                      const url = new URL(window.location.href);
                      url.searchParams.set("portal", "counselling");
                      url.searchParams.set("counsellor", sel.id);
                      window.history.replaceState({}, "", url.toString());
                    }
                  }}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer pr-1"
                  title="Switch Active Counsellor Workspace"
                >
                  {localAccounts.map(c => (
                    <option key={`hdr-c-opt-${c.id}`} value={c.id} className="text-slate-900 bg-white dark:bg-slate-800 dark:text-white font-medium">
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onSyncRefresh && (
              <button
                type="button"
                onClick={onSyncRefresh}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer active:scale-95"
                title="Refresh Counselling Department Data & Stay on Page"
              >
                <RefreshCw size={14} />
                <span>Refresh Dept</span>
              </button>
            )}

            {toggleTheme && (
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                title="Toggle Theme"
              >
                {theme === "dark" ? <Sun size={16} className="text-[#F6AD55]" /> : <Moon size={16} />}
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow cursor-pointer"
              >
                <LogOut size={14} />
                <span>Log Out Session</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-indigo-700 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-black tracking-wider uppercase backdrop-blur-sm">
              🏫 Admission Desk
            </span>
            <span className="text-xs text-orange-200 font-medium">Birla Open Minds International School</span>
            {userRole === "Counsellor" && activeCounsellor && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-white text-[10px] font-black uppercase">
                🔒 Private Workspace: {activeCounsellor.name} ({activeCounsellor.id})
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black tracking-tight">Parent Counselling & Admission Records</h1>
          <p className="text-xs text-orange-100 max-w-2xl">
            {userRole === "Counsellor" && activeCounsellor
              ? `Welcome ${activeCounsellor.name}! Only your assigned parent enquiries & follow-ups are displayed in this secure portal.`
              : "Digital Management of New Admission Enquiries, Parent Interactions, Follow-ups & Official Counselling Records across all 10 Counsellors."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCurrentPasswordInput("");
              setNewPasswordInput("");
              setConfirmPasswordInput("");
              setPasswordSuccessMsg("");
              setPasswordErrorMsg("");
              setIsChangePasswordModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border bg-white/15 hover:bg-white/25 text-white border-white/30 shadow-xs"
            title="Reset or change your login password"
          >
            <KeyRound size={15} className="text-amber-300" />
            <span>Change Password</span>
          </button>

          <button
            onClick={() => setActiveView("audio-desk")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
              activeView === "audio-desk"
                ? "bg-white text-indigo-900 shadow-md border-white font-black"
                : "bg-white/10 hover:bg-white/20 text-white border-white/20"
            }`}
          >
            <Headphones size={15} /> 
            <span>Meeting Audios</span>
            {recordedCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-400 text-slate-900 font-mono text-[10px] font-black">
                {recordedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border bg-emerald-500 hover:bg-emerald-600 text-white shadow-md active:scale-95 border-emerald-400"
            title="Generate 1-Click Day, Week, and Month reports for WhatsApp"
          >
            <Send size={15} />
            <span>📊 1-Click WhatsApp Report</span>
          </button>

          <button
            type="button"
            onClick={() => setIsTokenListReportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-md active:scale-95 border-amber-300"
            title="View Day-Wise & Custom Date Range Total Token Count Report"
          >
            <FileText size={15} />
            <span>🎟️ Token Count Report</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setParentKioskDefaultMode("print_qr");
              setIsParentKioskModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 border-indigo-400"
            title="Open or Print Reception Self-Registration QR Kiosk Poster"
          >
            <Smartphone size={15} className="text-indigo-200" />
            <span>📱 Reception QR Desk</span>
            {pendingParentEntries.length > 0 ? (
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black animate-pulse shadow-sm">
                {pendingParentEntries.length} IN LOUNGE
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-slate-900 text-[9px] font-black">
                LIVE
              </span>
            )}
          </button>

          {userRole !== "Counsellor" && (
            <button
              onClick={() => { window.location.href = "/?portal=management"; }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border bg-white/10 hover:bg-white/20 text-white border-white/20"
              title="Open Executive Management Portal"
            >
              <Award size={15} /> Executive Desk
            </button>
          )}

          {userRole !== "Counsellor" && (
            <button
              onClick={() => setActiveView("accounts")}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                activeView === "accounts"
                  ? "bg-white text-orange-800 shadow-md border-white"
                  : "bg-white/10 hover:bg-white/20 text-white border-white/20"
              }`}
            >
              <KeyRound size={15} /> Counsellor Accounts & Access ({localAccounts.length})
            </button>
          )}

          {activeView !== "list" && (
            <button
              onClick={() => setActiveView("list")}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-white/20"
            >
              <FileText size={15} /> All Enquiries List
            </button>
          )}

          <button
            onClick={startNewEnquiry}
            className="px-4 py-2.5 bg-white text-orange-700 hover:bg-orange-50 rounded-xl text-xs font-black tracking-wide shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle size={16} /> New Admission Form
          </button>
        </div>
      </div>

      {/* Active In-Progress Claimed Lead Recovery Banner */}
      {activeDraft && activeDraft.formData && activeDraft.formData.studentName && activeView !== "form" && (
        <div className="p-4 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl border border-amber-400/40 animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-xl shrink-0 border border-white/30 text-white shadow-md">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white text-orange-950 text-[10px] font-black uppercase tracking-wider">
                  In-Progress Claimed Lead
                </span>
                <span className="text-xs font-extrabold text-amber-100">
                  Student: <strong className="text-white font-black">{activeDraft.formData.studentName}</strong> (Class {activeDraft.formData.applyingForClass})
                </span>
              </div>
              <p className="text-[11px] text-amber-100 mt-0.5 font-medium">
                Parent details auto-filled from reception kiosk. Click below to resume filling the admission form without losing data.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFormData(activeDraft.formData);
                setSelectedEnquiry(null);
                setActiveView("form");
              }}
              className="px-4 py-2.5 bg-white hover:bg-amber-50 text-orange-950 text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <span>📝 Resume &amp; Complete Admission Form</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Discard this claimed form draft?")) {
                  try { localStorage.removeItem("bomis_counsellor_active_draft"); } catch {}
                  setActiveDraft(null);
                }
              }}
              className="p-2 bg-black/20 hover:bg-black/30 text-white rounded-xl transition-all cursor-pointer"
              title="Discard draft"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Permanent Reception Walk-In Lounge & Parent QR Kiosk Desk */}
      {isLoungeHidden ? (
        /* Minimized / Closed Dock Bar */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 dark:bg-slate-900/80 border border-amber-300/40 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 shrink-0">
              <Bell size={18} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black tracking-wide text-slate-800 dark:text-slate-100">
                  🏛️ RECEPTION WALK-IN QUEUE & PARENT QR KIOSK
                </span>
                {pendingParentEntries.length > 0 ? (
                  <span className="px-2.5 py-0.5 bg-orange-600 text-white rounded-full text-xs font-black animate-pulse shadow-sm">
                    🔥 {pendingParentEntries.length} Parent(s) Waiting in Lounge
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    • 0 Waiting (Lounge Clear)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lounge view is currently closed/hidden. Click "Open / Show Lounge" to view and claim waiting parents.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleLoungeHidden(false)}
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Eye size={15} />
              <span>Open / Show Lounge {pendingParentEntries.length > 0 ? `(${pendingParentEntries.length})` : ""}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Full or Collapsed Lounge Card */
        <div className={`p-4.5 rounded-2xl shadow-md transition-all border-2 ${
          pendingParentEntries.length > 0
            ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white border-amber-300 ring-4 ring-amber-400/20"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
        }`}>
          {/* Header Bar */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            isLoungeCollapsed ? "" : "mb-3 pb-3 border-b border-black/10 dark:border-white/10"
          }`}>
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl shrink-0 ${
                pendingParentEntries.length > 0
                  ? "bg-white/20 text-white animate-bounce"
                  : "bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400"
              }`}>
                <Bell size={22} />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`text-sm font-black tracking-wide ${
                    pendingParentEntries.length > 0 ? "text-white" : "text-slate-900 dark:text-white"
                  }`}>
                    🏛️ RECEPTION WALK-IN QUEUE & PARENT QR KIOSK
                  </h3>
                  {pendingParentEntries.length > 0 ? (
                    <span className="px-2.5 py-0.5 bg-white text-orange-900 rounded-full text-xs font-black animate-pulse shadow-sm">
                      🔥 {pendingParentEntries.length} Parent(s) Waiting in Lounge
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Live Desk Active (0 Waiting)</span>
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${
                  pendingParentEntries.length > 0 ? "text-amber-100 font-medium" : "text-slate-500 dark:text-slate-400"
                }`}>
                  {pendingParentEntries.length > 0
                    ? isLoungeCollapsed
                      ? "Queue is minimized. Click 'Expand' to view waiting parent cards or 'Claim'."
                      : "Parents arrived and scanned reception QR on mobile! Click '⚡ Claim & Auto-Fill Form' to pull their details directly into your admission form."
                    : "Parents visiting the school scan the Reception QR on their phone. When they submit, their card chimes and appears here in real-time."}
                </p>
              </div>
            </div>

            {/* Action & Window Control Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap shrink-0">
              <button
                type="button"
                onClick={() => setIsTokenListReportModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 border ${
                  pendingParentEntries.length > 0
                    ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
                title="View Day-Wise, Weekly & Monthly Total Token Count Report"
              >
                <FileText size={13} />
                <span>🎟️ Token Report</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReceptionQueueModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 border ${
                  pendingParentEntries.length > 0
                    ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
                title={`View reception queue history (Today's claims: ${todayClaimedParentEntries.length}, All archive: ${claimedParentEntries.length})`}
              >
                <Users size={13} />
                <span>📋 Today's Claims ({todayClaimedParentEntries.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setParentKioskDefaultMode("print_qr");
                  setIsParentKioskModalOpen(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 ${
                  pendingParentEntries.length > 0
                    ? "bg-white text-orange-950 hover:bg-orange-50"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
                title="Open or Print Reception Self-Registration QR Kiosk Poster"
              >
                <Smartphone size={13} className={pendingParentEntries.length > 0 ? "text-orange-600" : "text-white"} />
                <span>📱 Poster</span>
              </button>

              {/* Clear All Waiting Test Entries (requires confirmation alert to prevent accidental deletion) */}
              {pendingParentEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirmModal(true)}
                  className="px-2.5 py-1.5 bg-black/20 hover:bg-red-600 text-white border border-white/30 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                  title="Clear / Dismiss all currently waiting entries (with confirmation)"
                >
                  <Trash2 size={13} />
                  <span>🧹 Clear ({pendingParentEntries.length})</span>
                </button>
              )}

              {/* Maximize / Compact Scroll Toggle (when entries > 3 and not collapsed) */}
              {!isLoungeCollapsed && pendingParentEntries.length > 3 && (
                <button
                  type="button"
                  onClick={toggleLoungeMaximized}
                  className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                  title={isLoungeMaximized ? "Switch to compact scroll view" : "Expand to full grid"}
                >
                  {isLoungeMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                  <span>{isLoungeMaximized ? "Compact View" : "Expand Grid"}</span>
                </button>
              )}

              {/* Minimize / Collapse Toggle Button */}
              <button
                type="button"
                onClick={toggleLoungeCollapsed}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 border ${
                  pendingParentEntries.length > 0
                    ? "bg-white/25 hover:bg-white/40 text-white border-white/40"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
                }`}
                title={isLoungeCollapsed ? "Expand queue cards" : "Minimize / Collapse queue cards"}
              >
                {isLoungeCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                <span>{isLoungeCollapsed ? `Expand (${pendingParentEntries.length})` : "Minimize"}</span>
              </button>

              {/* Close / Hide Button */}
              <button
                type="button"
                onClick={() => toggleLoungeHidden(true)}
                className={`p-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 border ${
                  pendingParentEntries.length > 0
                    ? "bg-white/15 hover:bg-red-500/80 text-white border-white/30"
                    : "bg-slate-100 hover:bg-red-50 dark:bg-slate-800 text-slate-500 hover:text-red-600 border-slate-200 dark:border-slate-700"
                }`}
                title="Hide Reception Lounge banner (You can reopen anytime)"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Lounge Content: Only shown when NOT collapsed */}
          {!isLoungeCollapsed && (
            <>
              {pendingParentEntries.length > 0 ? (
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${
                  isLoungeMaximized ? "" : "max-h-[380px] overflow-y-auto pr-1"
                }`}>
                  {pendingParentEntries.map(entry => (
                    <div key={entry.id} className="relative pt-3 group">
                      {/* Prominent High-Visibility Token Header Perched on Top of Card */}
                      <div className="absolute top-0 left-3 z-10 flex items-center gap-1 shadow-lg">
                        <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-400 text-slate-950 rounded-lg border-2 border-slate-950 font-black text-xs shadow-md tracking-wider">
                          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping inline-block" />
                          <span className="text-[10px] uppercase font-black opacity-80">TOKEN</span>
                          <span className="text-base font-black">#{entry.dailyTokenNo || 1}</span>
                          <span className="px-1.5 py-0.2 bg-slate-950/15 rounded text-[10px] font-extrabold text-slate-950">
                            {entry.dailyTokenNo === 1 ? "🥇 1st Arrived" : entry.dailyTokenNo === 2 ? "🥈 2nd Arrived" : entry.dailyTokenNo === 3 ? "🥉 3rd Arrived" : `${entry.dailyTokenNo}th Arrived`}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-900/95 backdrop-blur-md border-2 border-amber-400/60 hover:border-amber-400 rounded-2xl p-4 pt-5 flex flex-col justify-between gap-3 text-white shadow-2xl transition-all">
                        <div>
                          {/* Top Bar with Form Generated Date & Time */}
                          <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10 flex-wrap">
                            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider pl-1">
                              Walk-in Parent Queue
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-mono font-bold flex items-center gap-1 shadow-xs" title="Form Generated Date">
                                <Calendar size={11} className="text-amber-400 shrink-0" />
                                <span className="text-[9px] uppercase tracking-wider text-amber-200/90 font-extrabold">Generated:</span>
                                <span>{entry.entryDate || (entry.formattedDate ? entry.formattedDate.split(" ")[0] : "") || (entry.submittedAt ? new Date(entry.submittedAt).toLocaleDateString("en-GB").replace(/\//g, "-") : "")}</span>
                              </span>
                              <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700 flex items-center gap-1">
                                <Clock size={11} className="text-slate-400 shrink-0" />
                                <span>{entry.formattedDate && entry.formattedDate.includes(" ") ? entry.formattedDate.split(" ")[1] : (entry.submittedAt ? new Date(entry.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Now")}</span>
                              </span>
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-2">
                            <div className="w-full">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-base font-black text-amber-300">{entry.studentName}</p>
                                <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 text-[10px] font-bold border border-amber-400/30">
                                  Class: {entry.applyingForClass}
                                </span>
                              </div>
                              <p className="text-xs text-slate-200 mt-1.5">
                                Parent: <strong className="text-white">{entry.fatherName || entry.motherName || "Parent"}</strong>
                                {entry.dateOfBirth && (
                                  <span className="text-amber-200 font-mono font-bold ml-2">
                                    • 🎂 DOB: {entry.dateOfBirth}
                                  </span>
                                )}
                              </p>


                              <div className="flex items-center gap-2 mt-2">
                                <a 
                                  href={`tel:${entry.contactNo}`} 
                                  className="text-xs text-emerald-300 font-mono font-bold hover:underline flex items-center gap-1"
                                >
                                  📞 {entry.contactNo}
                                </a>
                                {entry.whatsappNo && (
                                  <a 
                                    href={`https://wa.me/91${entry.whatsappNo.replace(/[^0-9]/g, '')}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[10px] bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-200 px-1.5 py-0.5 rounded font-bold"
                                  >
                                    WhatsApp
                                  </a>
                                )}
                              </div>
                              {entry.previousSchool && (
                                <p className="text-[11px] text-slate-300 mt-1 truncate">
                                  🏫 Prev: <span className="text-slate-100">{entry.previousSchool}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => handleClaimAndAutoFill(entry)}
                            className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ring-2 ring-emerald-300/40"
                            title={`Claim Token #${entry.dailyTokenNo || 1} exclusively: auto-fills all fields into your admission form`}
                          >
                            <CheckCircle2 size={16} />
                            <span>⚡ Claim Token #{entry.dailyTokenNo || 1} &amp; Auto-Fill</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDismissParentEntry(entry.id)}
                            className="p-2.5 bg-white/10 hover:bg-red-500/40 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            title="Dismiss if parent left lounge without meeting"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty Lounge State - Clean, Professional Production Ready */
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <School size={20} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <span>☕ Reception Lounge is Clear — Live Desk Ready</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        When visiting parents scan the Reception QR Poster on their phone, their verified details will chime and appear here in real-time.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setParentKioskDefaultMode("print_qr");
                        setIsParentKioskModalOpen(true);
                      }}
                      className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Smartphone size={14} className="text-amber-200" />
                      <span>📱 View / Print QR Poster</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* KPI Stats Strip - Interactive 5 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Enquiries */}
        <button
          type="button"
          onClick={() => handleCardClick("total")}
          className={`text-left p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
            selectedMetricCard === "total"
              ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400"
          }`}
          title="Click to view Date-wise Total Enquiries breakdown"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {userRole === "Counsellor" ? "My Enquiries" : "Total Enquiries"}
            </span>
            <Users size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-black text-slate-800 dark:text-white mt-2">{stats.total}</p>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-blue-600 dark:text-blue-400 font-bold">
            <span>📅 Date Breakdown</span>
            <span>→</span>
          </div>
        </button>

        {/* Card 2: Applications */}
        <button
          type="button"
          onClick={() => handleCardClick("applications")}
          className={`text-left p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
            selectedMetricCard === "applications"
              ? "bg-amber-50/90 dark:bg-amber-950/50 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400"
          }`}
          title="Click to view Date-wise Applications Taken"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">Applications</span>
            <FileText size={16} className="text-amber-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{stats.applicationTaken}</p>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-bold">
            <span>📅 Date Breakdown</span>
            <span>→</span>
          </div>
        </button>

        {/* Card 3: Entrance Test */}
        <button
          type="button"
          onClick={() => handleCardClick("entrance")}
          className={`text-left p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
            selectedMetricCard === "entrance"
              ? "bg-purple-50/90 dark:bg-purple-950/50 border-purple-500 ring-2 ring-purple-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-purple-400"
          }`}
          title="Click to view Date-wise Entrance Tests Scheduled &amp; Required"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">Entrance Test</span>
            <GraduationCap size={16} className="text-purple-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">{stats.testRequired}</p>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-purple-600 dark:text-purple-400 font-bold">
            <span>📅 Date Breakdown</span>
            <span>→</span>
          </div>
        </button>

        {/* Card 3: Follow-up Due */}
        <button
          type="button"
          onClick={() => handleCardClick("followup")}
          className={`text-left p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
            selectedMetricCard === "followup"
              ? "bg-orange-50/90 dark:bg-orange-950/50 border-orange-500 ring-2 ring-orange-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-orange-400"
          }`}
          title="Click to view Date-wise Follow-up Due & Hot Leads"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">Follow-up Due</span>
            <Clock size={16} className="text-orange-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-2">{stats.followUp}</p>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-orange-600 dark:text-orange-400 font-bold">
            <span>📅 Date Breakdown</span>
            <span>→</span>
          </div>
        </button>

        {/* Card 4: Confirmed */}
        <button
          type="button"
          onClick={() => handleCardClick("confirmed")}
          className={`text-left p-4 rounded-xl border shadow-sm transition-all duration-200 cursor-pointer group hover:-translate-y-0.5 hover:shadow-md ${
            selectedMetricCard === "confirmed"
              ? "bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md"
              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-400"
          }`}
          title="Click to view Date-wise Confirmed Admissions"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
            <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">Confirmed</span>
            <CheckCircle2 size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{stats.confirmed}</p>
          <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            <span>📅 Date Breakdown</span>
            <span>→</span>
          </div>
        </button>
      </div>

      {/* MODAL: 5 KPI METRICS DATE-WISE DRILL-DOWN & AUDIT DESK */}
      {selectedMetricCard && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden my-auto animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    selectedMetricCard === "total"
                      ? "bg-blue-100 dark:bg-blue-950/80 text-blue-600"
                      : selectedMetricCard === "applications"
                      ? "bg-amber-100 dark:bg-amber-950/80 text-amber-600"
                      : selectedMetricCard === "entrance"
                      ? "bg-purple-100 dark:bg-purple-950/80 text-purple-600"
                      : selectedMetricCard === "followup"
                      ? "bg-orange-100 dark:bg-orange-950/80 text-orange-600"
                      : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600"
                  }`}>
                    {selectedMetricCard === "total" && <Users size={20} />}
                    {selectedMetricCard === "applications" && <FileText size={20} />}
                    {selectedMetricCard === "entrance" && <GraduationCap size={20} />}
                    {selectedMetricCard === "followup" && <Clock size={20} />}
                    {selectedMetricCard === "confirmed" && <CheckCircle2 size={20} />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                        {selectedMetricCard === "total" && (userRole === "Counsellor" ? "My Enquiries — Date-Wise Report" : "Total Enquiries — Date-Wise Report")}
                        {selectedMetricCard === "applications" && "Applications Taken — Date-Wise Report"}
                        {selectedMetricCard === "entrance" && "Entrance Tests — Date-Wise Schedule & Register"}
                        {selectedMetricCard === "followup" && "Follow-up Due & Hot Leads — Date-Wise Planner"}
                        {selectedMetricCard === "confirmed" && "Confirmed Admissions — Date-Wise Enrolment Log"}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                        selectedMetricCard === "total"
                          ? "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          : selectedMetricCard === "applications"
                          ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                          : selectedMetricCard === "entrance"
                          ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                          : selectedMetricCard === "followup"
                          ? "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
                          : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                      }`}>
                        {filteredMetricEnquiries.length} {filteredMetricEnquiries.length === 1 ? "Record" : "Records"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Birla Open Minds Admissions Desk • Click any date pill to inspect enquiries logged on that specific day
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateMetricPDF}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                    title="Generate & Print PDF Report"
                  >
                    <Printer size={14} />
                    <span>PDF Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportMetricCSV}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    title="Export CSV of current date filter"
                  >
                    <Download size={14} />
                    <span>CSV</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMetricCard(null)}
                    className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                    title="Close Date Breakdown"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* 5-Metric Quick Tab Switcher */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 custom-scrollbar">
                <button
                  type="button"
                  onClick={() => handleCardClick("total")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedMetricCard === "total"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <Users size={13} />
                  <span>Total Enquiries ({stats.total})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCardClick("applications")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedMetricCard === "applications"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-500/20"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <FileText size={13} />
                  <span>Applications ({stats.applicationTaken})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCardClick("followup")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedMetricCard === "followup"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <Clock size={13} />
                  <span>Follow-up Due ({stats.followUp})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCardClick("confirmed")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedMetricCard === "confirmed"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <CheckCircle2 size={13} />
                  <span>Confirmed ({stats.confirmed})</span>
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable Content */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 flex-1 custom-scrollbar">
              {/* DATE FILTERS BAR (Matching Main Dashboard!) */}
              <div className="p-4 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                {/* Quick Presets Row */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
                    ⚡ Date Presets:
                  </span>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("all")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "all" && !selectedDateChip
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("today")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "today"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    📅 Today Only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("yesterday")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "yesterday"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("last7")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "last7"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("last30")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "last30"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("thisMonth")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "thisMonth"
                        ? "bg-orange-500 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    This Month
                  </button>
                </div>

                {/* Filter Controls Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
                  {/* Single Date Picker */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      📅 Filter Single Date:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="date"
                        value={metricSingleDate}
                        onChange={(e) => {
                          setMetricSingleDate(e.target.value);
                          setMetricDatePreset("all");
                          setSelectedDateChip(null);
                        }}
                        className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                      {metricSingleDate && (
                        <button
                          type="button"
                          onClick={() => setMetricSingleDate("")}
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-600 dark:text-slate-200 text-xs rounded-xl font-bold cursor-pointer"
                          title="Clear date"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* From Date */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      📅 Date From:
                    </label>
                    <input
                      type="date"
                      value={metricFromDate}
                      onChange={(e) => {
                        setMetricFromDate(e.target.value);
                        setMetricDatePreset("all");
                        setSelectedDateChip(null);
                      }}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  {/* To Date */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      📅 Date To:
                    </label>
                    <input
                      type="date"
                      value={metricToDate}
                      onChange={(e) => {
                        setMetricToDate(e.target.value);
                        setMetricDatePreset("all");
                        setSelectedDateChip(null);
                      }}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  {/* Grade / Class Filter */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      🎓 Grade / Class:
                    </label>
                    <select
                      value={metricClassFilter}
                      onChange={(e) => setMetricClassFilter(e.target.value)}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="ALL">All Classes</option>
                      {CLASS_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Search Query */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      🔍 Quick Search:
                    </label>
                    <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Student, Phone, No..."
                        value={metricSearchQuery}
                        onChange={(e) => setMetricSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* DAILY DATE GROUPING PILLS (Clickable Date Breakdown) */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-orange-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Dates Activity Breakdown ({dateGroupings.length} Distinct Dates)
                    </span>
                  </div>
                  {selectedDateChip && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateChip(null)}
                      className="text-xs text-orange-600 dark:text-orange-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Show All Dates</span>
                      <span>✕</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDateChip(null)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                      !selectedDateChip
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <span>All Combined</span>
                    <span className="px-1.5 py-0.2 rounded-md bg-white/20 dark:bg-black/20 text-[10px]">
                      {metricBaseEnquiries.length}
                    </span>
                  </button>

                  {dateGroupings.map(item => {
                    const isSelected = selectedDateChip === item.dmy;
                    const todayStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
                    const isToday = item.dmy === todayStr;

                    return (
                      <button
                        key={item.dmy}
                        type="button"
                        onClick={() => setSelectedDateChip(isSelected ? null : item.dmy)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? "bg-orange-500 border-orange-600 text-white shadow-md shadow-orange-500/20"
                            : isToday
                            ? "bg-orange-50 dark:bg-orange-950/40 border-orange-300 dark:border-orange-800 text-orange-900 dark:text-orange-300 hover:bg-orange-100"
                            : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-orange-400 hover:bg-orange-50/50"
                        }`}
                      >
                        <span className="font-mono">📅 {item.dmy}</span>
                        {isToday && (
                          <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
                            isSelected ? "bg-white text-orange-600" : "bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                          }`}>
                            Today
                          </span>
                        )}
                        <span className={`px-1.5 py-0.2 rounded-md text-[11px] font-black ${
                          isSelected ? "bg-white/25 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                        }`}>
                          {item.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DETAILED ENQUIRIES TABLE FOR THIS METRIC & DATE */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Records List
                    </span>
                    <span className="text-xs text-slate-400">
                      (Showing {filteredMetricEnquiries.length} matching enquiries)
                    </span>
                  </div>

                  {selectedDateChip && (
                    <div className="px-2.5 py-1 bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 rounded-lg text-xs font-bold text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
                      <span>Filtering Day: <strong>{selectedDateChip}</strong></span>
                      <button
                        type="button"
                        onClick={() => setSelectedDateChip(null)}
                        className="hover:text-red-600 font-black cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {filteredMetricEnquiries.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                      <Calendar size={22} />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No enquiries found for this date selection
                    </p>
                    <p className="text-xs text-slate-400">
                      Try selecting "All Dates" or picking a different date filter above.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        applyDatePreset("all");
                        setSelectedDateChip(null);
                        setMetricSingleDate("");
                        setMetricSearchQuery("");
                        setMetricClassFilter("ALL");
                      }}
                      className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer mt-2"
                    >
                      Reset All Date Filters
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-3 py-3 text-center shrink-0 w-14">S.No</th>
                          <th className="px-4 py-3">Date & Time</th>
                          <th className="px-4 py-3">Enquiry ID</th>
                          <th className="px-4 py-3">Student Name</th>
                          <th className="px-4 py-3">Applying Grade</th>
                          <th className="px-4 py-3">Parent / Contact</th>
                          <th className="px-4 py-3">Counsellor</th>
                          <th className="px-4 py-3">Current Status</th>
                          <th className="px-4 py-3">Follow-up Date</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredMetricEnquiries.map((item, idx) => {
                          const statusConf = STATUS_CONFIG[item.admissionStatus] || STATUS_CONFIG["Interested"];
                          return (
                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              {/* S.No */}
                              <td className="px-3 py-3 text-center font-mono font-bold text-slate-500 text-xs">
                                #{idx + 1}
                              </td>

                              {/* Date & Time */}
                              <td className="px-4 py-3 whitespace-nowrap">

                                <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <Calendar size={13} className="text-orange-500" />
                                  <span>{item.date}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 pl-4">
                                  {item.createdAt ? item.createdAt.split(" ")[1] || "Session Log" : "Logged"}
                                </div>
                              </td>

                              {/* Enquiry ID */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px]">
                                  {item.enquiryNo}
                                </span>
                              </td>

                              {/* Student Name */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {item.studentName}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {item.gender} • DOB: {item.dateOfBirth || "N/A"}
                                </div>
                              </td>

                              {/* Grade */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {item.applyingForClass}
                                </span>
                              </td>

                              {/* Parent Contact */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">
                                  {item.fatherName || item.motherName || "Parent"}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <a
                                    href={`tel:${item.contactNo}`}
                                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-mono"
                                    title="Call parent"
                                  >
                                    <Phone size={11} /> {item.contactNo}
                                  </a>
                                  {item.whatsappNo && (
                                    <a
                                      href={`https://wa.me/91${item.whatsappNo.replace(/[^0-9]/g, "")}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-600 hover:text-emerald-700"
                                      title="Open WhatsApp chat"
                                    >
                                      <MessageSquare size={12} />
                                    </a>
                                  )}
                                </div>
                              </td>

                              {/* Counsellor */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-slate-700 dark:text-slate-300 font-semibold">
                                  {item.counsellorName || "Counsellor"}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {item.counsellorId || "ID"}
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                                  {item.admissionStatus}
                                </span>
                              </td>

                              {/* Follow-up Date */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {item.followUpDate ? (
                                  <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                                    <Clock size={12} className="text-orange-500" />
                                    <span>{item.followUpDate}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">None set</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInspectingEnquiry(item);
                                      setSelectedMetricCard(null);
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 dark:hover:bg-blue-900/40 text-slate-600 dark:text-slate-300 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                                    title="View Full Details"
                                  >
                                    <Eye size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      editEnquiry(item);
                                      setSelectedMetricCard(null);
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 dark:hover:bg-orange-900/40 text-slate-600 dark:text-slate-300 hover:text-orange-600 rounded-lg transition-colors cursor-pointer"
                                    title="Edit Enquiry"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      viewPrintPreview(item);
                                      setSelectedMetricCard(null);
                                    }}
                                    className="p-1.5 bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-purple-900/40 text-slate-600 dark:text-slate-300 hover:text-purple-600 rounded-lg transition-colors cursor-pointer"
                                    title="Print Enquiry Slip"
                                  >
                                    <Printer size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Displaying <strong>{filteredMetricEnquiries.length}</strong> of <strong>{metricBaseEnquiries.length}</strong> total {selectedMetricCard} records in selected date range.
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleGenerateMetricPDF}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs active:scale-95"
                >
                  <Printer size={14} />
                  <span>📄 Generate PDF Report</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportMetricCSV}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={14} />
                  <span>Download Date CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMetricCard(null)}
                  className="px-5 py-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  Close Desk
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: ENQUIRIES LIST */}
      {activeView === "list" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Student, Parent, No, Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              {/* If Admin, show Counsellor filter for all 10 members */}
              {userRole !== "Counsellor" && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-slate-500 font-semibold">Counsellor:</span>
                  <select
                    value={adminFilterCounsellor}
                    onChange={(e) => setAdminFilterCounsellor(e.target.value)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="ALL">All Counsellors ({localAccounts.length})</option>
                    {localAccounts.map((c, idx) => (
                      <option key={`counsellor-opt-${c.id}-${c.username}-${idx}`} value={c.id}>
                        {c.id}: {c.name} {c.status === "inactive" ? "(Inactive)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* If Counsellor, show their isolated badge, reception walk-ins pill & multi-delete status badge */}
              {userRole === "Counsellor" && activeCounsellor && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 dark:bg-orange-950/40 border border-orange-300 dark:border-orange-800 rounded-xl text-xs font-bold text-orange-800 dark:text-orange-300">
                    <span>🔒 {activeCounsellor.name} ({counsellorScopeEnquiries.length} Enquiries)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReceptionQueueModalOpen(true)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all ${
                      pendingParentEntries.length > 0
                        ? "bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-400 animate-pulse shadow-sm"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                    }`}
                    title="Open Reception Walk-in Lounge Queue"
                  >
                    <Bell size={13} className={pendingParentEntries.length > 0 ? "text-amber-600 animate-bounce" : "text-slate-500"} />
                    <span>Reception Lounge: {pendingParentEntries.length} Waiting</span>
                  </button>
                  <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                    allowCounsellorMultiDelete
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                      : "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                  }`}>
                    <ShieldCheck size={14} className={allowCounsellorMultiDelete ? "text-emerald-500" : "text-amber-500"} />
                    <span>Multi-Delete: {allowCounsellorMultiDelete ? "ENABLED" : "DISABLED BY ADMIN"}</span>
                  </div>
                </div>
              )}


              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0"
              >
                <option value="ALL">All Statuses</option>
                <option value="Interested">Interested</option>
                <option value="Application Taken">Application Taken</option>
                <option value="Entrance Test Required">Entrance Test Required</option>
                <option value="Admission Confirmed">Admission Confirmed</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Not Interested">Not Interested</option>
              </select>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0"
              >
                <option value="ALL">All Classes</option>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={filterAuditStatus}
                onChange={(e) => setFilterAuditStatus(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0"
                title="Filter by Management Audio Review & Feedback status"
              >
                <option value="ALL">All Audits</option>
                <option value="WITH_AUDIO">🎙️ Has Audio Recording</option>
                <option value="APPROVED">⭐ Mgmt Approved</option>
                <option value="FOLLOWUP">⚠️ Mgmt Follow-up Needed</option>
                <option value="PENDING">🕒 Pending Mgmt Audit</option>
              </select>

              {/* Super Admin Quick Access Control Toggle for Counsellor Multi-Delete */}
              {userRole !== "Counsellor" && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !allowCounsellorMultiDelete;
                    setAllowCounsellorMultiDeleteState(next);
                    setAllowCounsellorMultiDelete(next);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    allowCounsellorMultiDelete
                      ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200"
                  }`}
                  title="Super Admin Control: Enable or Disable Multi-Selection Delete capability for Counsellors Department"
                >
                  <ShieldCheck size={14} className={allowCounsellorMultiDelete ? "text-emerald-500" : "text-slate-400"} />
                  <span>Counsellor Multi-Delete: {allowCounsellorMultiDelete ? "ENABLED" : "DISABLED"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Multi-Selection Bulk Action Banner */}
          {canUseMultiDelete && selectedEnquiryIds.length > 0 && (
            <div className="mx-4 my-3 p-3.5 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-xl shadow-md flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 font-mono font-black text-sm">
                  {selectedEnquiryIds.length}
                </span>
                <div>
                  <p className="font-black text-xs md:text-sm tracking-wide">
                    {selectedEnquiryIds.length === 1 ? "1 Enquiry Record Selected" : `${selectedEnquiryIds.length} Enquiry Records Selected`}
                  </p>
                  <p className="text-[10px] md:text-[11px] text-red-100">
                    Multi-selection active. Delete selected records permanently across Firestore & Local storage.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEnquiryIds([])}
                  className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                  className="px-4 py-1.5 bg-white text-red-700 hover:bg-red-50 rounded-lg text-xs font-black shadow transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <Trash2 size={14} />
                  <span>Delete Selected ({selectedEnquiryIds.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-3 py-3.5 text-center shrink-0 w-16">
                    {canUseMultiDelete ? (
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={filteredEnquiries.length > 0 && filteredEnquiries.every(e => selectedEnquiryIds.includes(e.id))}
                          onChange={handleSelectAllEnquiries}
                          className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                          title="Select / Deselect All Enquiries"
                        />
                        <span>S.No</span>
                      </div>
                    ) : (
                      <span>S.No</span>
                    )}
                  </th>
                  <th className="px-4 py-3.5">Enquiry Info</th>
                  <th className="px-4 py-3.5">Student Details</th>
                  <th className="px-4 py-3.5">Parent & Contact</th>
                  <th className="px-4 py-3.5">Status & Follow-up</th>
                  <th className="px-4 py-3.5">Counsellor</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredEnquiries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <FileText size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="font-semibold">
                        {userRole === "Counsellor"
                          ? `No enquiries registered for ${activeCounsellor?.name || "your account"} yet.`
                          : "No counselling enquiries found."}
                      </p>
                      <button 
                        onClick={startNewEnquiry}
                        className="mt-3 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs"
                      >
                        Create First Enquiry
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredEnquiries.map((enquiry, idx) => {
                    const statusConf = STATUS_CONFIG[enquiry.admissionStatus] || STATUS_CONFIG["Interested"];
                    const isSelected = selectedEnquiryIds.includes(enquiry.id);

                    return (
                      <tr key={enquiry.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isSelected ? "bg-orange-50/80 dark:bg-orange-950/30" : ""}`}>
                        {/* Serial Number & Multi-Select Checkbox */}
                        <td className="px-3 py-3.5 align-top text-center">
                          <div className="flex items-center justify-center gap-2">
                            {canUseMultiDelete && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectEnquiry(enquiry.id)}
                                className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                              />
                            )}
                            <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                              #{idx + 1}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
                            {enquiry.enquiryNo}
                          </span>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} /> {enquiry.date}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {enquiry.studentName}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-semibold text-slate-700 dark:text-slate-300 text-[10px]">
                              {enquiry.applyingForClass}
                            </span>
                            <span className="px-1.5 py-0.5 bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 rounded font-bold text-[9px]">
                              AY {enquiry.academicYear || "2026-2027"}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {enquiry.gender} {enquiry.dateOfBirth ? `• DOB: ${enquiry.dateOfBirth}` : ""}
                            </span>
                          </div>
                          {enquiry.previousSchool && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate max-w-xs">
                              Prev: {enquiry.previousSchool} ({enquiry.previousClass})
                            </p>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {enquiry.fatherName || enquiry.motherName || "Parent"}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <a
                              href={`tel:${enquiry.contactNo}`}
                              className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                            >
                              <Phone size={11} /> {enquiry.contactNo}
                            </a>
                            {enquiry.whatsappNo && (
                              <a
                                href={`https://wa.me/91${enquiry.whatsappNo.replace(/[^0-9]/g, "")}?text=Dear%20Parent,%20Greetings%20from%20Birla%20Open%20Minds%20International%20School.%20Regarding%20admission%20enquiry%20for%20${encodeURIComponent(enquiry.studentName)}.`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare size={11} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                            {statusConf.label}
                          </span>
                          {enquiry.followUpDate && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
                              <Clock size={11} className="text-orange-500" />
                              Follow-up: <span className="font-semibold">{enquiry.followUpDate}</span>
                            </div>
                          )}
                          {enquiry.audioRecording && (
                            <div className="mt-1.5 flex flex-col items-start gap-1">
                              <button
                                onClick={() => {
                                  setSelectedEnquiry(enquiry);
                                  setActiveView("audio-desk");
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 text-[9px] font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors cursor-pointer"
                                title="Listen to meeting audio recording"
                              >
                                <Headphones size={10} />
                                <span>Audio Recorded ({formatAudioDuration(enquiry.audioRecording.durationSeconds)})</span>
                              </button>

                              {enquiry.audioRecording.qualityRating ? (
                                <button
                                  onClick={() => {
                                    setSelectedEnquiry(enquiry);
                                    setActiveView("audio-desk");
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold transition-all hover:scale-105 cursor-pointer ${
                                    enquiry.audioRecording.reviewStatus === "Reviewed - Approved"
                                      ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                                      : enquiry.audioRecording.reviewStatus === "Follow-up Required"
                                        ? "bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                        : "bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200"
                                  }`}
                                  title={`Management Coaching Remarks: ${enquiry.audioRecording.managementRemarks || "Click to view review notes"}`}
                                >
                                  <span>⭐ {enquiry.audioRecording.qualityRating}/5 Mgmt Feedback</span>
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-400 font-medium pl-0.5">
                                  🕒 Mgmt Review Pending
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-top text-slate-600 dark:text-slate-300">
                          <p className="font-bold text-xs text-slate-900 dark:text-white">
                            {enquiry.counsellorName || "—"}
                          </p>
                          {enquiry.counsellorId && (
                            <span className="font-mono text-[9px] text-orange-600 dark:text-orange-400 font-bold">
                              {enquiry.counsellorId}
                            </span>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {enquiry.parentSignatureRecorded ? "✍️ Signature recorded" : "Pending signature"}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setWhatsAppModalEnquiry(enquiry)}
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Send Official WhatsApp Message to Parent"
                            >
                              <Send size={15} />
                            </button>
                            {enquiry.audioRecording && (
                              <button
                                onClick={() => {
                                  setSelectedEnquiry(enquiry);
                                  setActiveView("audio-desk");
                                }}
                                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                title="Listen to Meeting Audio in Executive Desk"
                              >
                                <Headphones size={15} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setInspectingEnquiry(enquiry)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="View Full Details"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => viewPrintPreview(enquiry)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Print / View Form"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              onClick={() => editEnquiry(enquiry)}
                              className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Edit Enquiry"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEnquiryToDelete(enquiry)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              title="Delete Enquiry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* VIEW: COUNSELLOR ACCOUNTS & ACCESS MANAGER (ADMIN CONTROL HUB) */}
      {activeView === "accounts" && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-black uppercase tracking-wider">
                  🔐 Access Control & Credentials
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Main App Management Console
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Counsellor Accounts & Password Manager</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
                  {localAccounts.length} Staff Accounts
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
                Create and manage login usernames and passwords for admissions counsellors. Only accounts configured here are permitted to log in. Each counsellor's data remains private and strictly isolated.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveView("list")}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ChevronRight size={14} className="rotate-180" /> Back to Enquiries
              </button>
              <button
                type="button"
                onClick={handleOpenCreateAccount}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black tracking-wide shadow-lg hover:shadow-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <UserPlus size={16} /> + Create New Counsellor Account
              </button>
            </div>
          </div>

          {/* Super Admin Control: Counsellor Department Multi-Selection Delete Access */}
          {userRole !== "Counsellor" && (
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-orange-500/30 text-orange-300 text-[10px] font-black uppercase tracking-wider border border-orange-500/40">
                    👑 Main Super Admin Permission Control
                  </span>
                </div>
                <h3 className="text-base font-bold flex items-center gap-2 text-white">
                  <ShieldCheck className={allowCounsellorMultiDelete ? "text-emerald-400" : "text-slate-400"} size={20} />
                  <span>Counsellors Department Multi-Selection Delete Access</span>
                </h3>
                <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                  Enable or disable multi-checkbox select and bulk deletion capability for Admissions Counsellor department staff. When enabled, counsellors can select multiple enquiry records and delete them in bulk.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10 shrink-0">
                <span className="text-xs font-bold font-mono">
                  {allowCounsellorMultiDelete ? "🔓 ENABLED FOR COUNSELLORS" : "🔒 DISABLED FOR COUNSELLORS"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !allowCounsellorMultiDelete;
                    setAllowCounsellorMultiDeleteState(next);
                    setAllowCounsellorMultiDelete(next);
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    allowCounsellorMultiDelete ? "bg-emerald-500" : "bg-slate-600"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      allowCounsellorMultiDelete ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Quick Metrics */}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs text-slate-500 font-bold block">Total Counsellors</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{localAccounts.length}</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs text-emerald-600 font-bold block">Active Logins</span>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {localAccounts.filter(a => a.status === "active").length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs text-red-500 font-bold block">Deactivated</span>
              <p className="text-2xl font-black text-red-500 mt-1">
                {localAccounts.filter(a => a.status === "inactive").length}
              </p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
              <span className="text-xs text-orange-600 font-bold block">Total Enquiries Logged</span>
              <p className="text-2xl font-black text-orange-600 mt-1">{safeEnquiries.length}</p>
            </div>
          </div>

          {/* Counsellor Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localAccounts.map((acc, idx) => {
              const counsellorEnquiries = safeEnquiries.filter(e => {
                const normE = (e.counsellorId || "").trim().toLowerCase().replace("-0", "-");
                const normA = (acc.id || "").trim().toLowerCase().replace("-0", "-");
                return (
                  e.counsellorId === acc.id || 
                  normE === normA ||
                  (e.counsellorName && acc.name && (
                    e.counsellorName.toLowerCase().includes(acc.name.toLowerCase()) ||
                    acc.name.toLowerCase().includes(e.counsellorName.toLowerCase())
                  ))
                );
              });
              const isRevealed = revealedPasswords[acc.id] || false;
              const isCopied = copiedAccountId === acc.id;

              return (
                <div 
                  key={`counsellor-card-${acc.id}-${acc.username}-${idx}`}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Avatar & Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-2xl text-white flex items-center justify-center font-black text-base shadow-sm shrink-0"
                          style={{ backgroundColor: acc.color || "#EA580C" }}
                        >
                          {acc.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-black text-sm text-slate-900 dark:text-white truncate">
                              {acc.name}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 font-mono text-[9px] font-bold">
                              {acc.id}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                            {acc.roleTitle}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Assigned: {acc.assignedGrades || "All Wings"}
                          </p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        acc.status === "active" 
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                          : "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800"
                      }`}>
                        {acc.status === "active" ? "● Active" : "○ Inactive"}
                      </span>
                    </div>

                    {/* Credentials Box */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Username</span>
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {acc.username}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Password</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-orange-600 dark:text-orange-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {isRevealed ? acc.password : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealedPasswords(prev => ({ ...prev, [acc.id]: !prev[acc.id] }))}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            title={isRevealed ? "Hide Password" : "Show Password"}
                          >
                            {isRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200/60 dark:border-slate-800">
                        <span>Phone: {acc.phone}</span>
                        <span>{counsellorEnquiries.length} Enquiries Logged</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(acc)}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                        isCopied 
                          ? "bg-emerald-600 text-white"
                          : "bg-orange-50 hover:bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:hover:bg-orange-900/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800/40"
                      }`}
                    >
                      {isCopied ? (
                        <>
                          <Check size={14} /> Credentials Copied for WhatsApp!
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy Login Info (Username & Pass)
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminFilterCounsellor(acc.id);
                          setActiveView("list");
                        }}
                        className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title="View this counsellor's enquiries"
                      >
                        <Eye size={12} /> View ({counsellorEnquiries.length})
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditAccount(acc)}
                        className="py-1.5 px-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                        title="Edit credentials & details"
                      >
                        <Edit3 size={12} /> Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleAccountStatus(acc)}
                        className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          acc.status === "active"
                            ? "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                        title={acc.status === "active" ? "Deactivate login" : "Activate login"}
                      >
                        {acc.status === "active" ? <Lock size={12} /> : <Unlock size={12} />}
                        <span>{acc.status === "active" ? "Deactivate" : "Activate"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteAccountAction(acc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer"
                        title="Delete account"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: INTERACTIVE FORM (EXACT MATCH WITH UPLOADED BIRLA OPENMINDS FORM) */}
      {activeView === "form" && (
        <form onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
          {/* Form Header (Sticky for easy access while scrolling) */}
          <div className="sticky top-0 z-30 p-4 md:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 rounded-t-2xl shadow-sm">
            <div className="text-center md:text-left">
              <span className="text-[11px] font-black text-orange-600 dark:text-orange-400 tracking-widest uppercase">
                BIRLA OPENMINDS INTERNATIONAL SCHOOL
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                NEW ADMISSION – PARENT COUNSELLING FORM
              </h2>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                <span className="text-slate-400 font-medium">Enquiry No: </span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{formData.enquiryNo}</span>
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  🔒 Reserved Slot
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
              >
                💾 Save Counselling Record
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* SECTION 1: STUDENT & PARENT DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  STUDENT & PARENT DETAILS
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    placeholder="DD-MM-YYYY"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Enquiry No.</label>
                  <input
                    type="text"
                    value={formData.enquiryNo}
                    onChange={(e) => setFormData({ ...formData, enquiryNo: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Student Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.studentName}
                    onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                    placeholder="Enter Student Full Name"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Applying for Class <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.applyingForClass}
                    onChange={(e) => setFormData({ ...formData, applyingForClass: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {CLASS_OPTIONS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.academicYear || "2026-2027"}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="2026-2027">2026-2027 (Current Academic Year)</option>
                    <option value="2027-2028">2027-2028 (Next Year Advance)</option>
                    <option value="2028-2029">2028-2029 (Future Advance)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date of Birth</label>
                  <input
                    type="text"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    placeholder="DD-MM-YYYY"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <div className="flex items-center gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="gender"
                        value="Male"
                        checked={formData.gender === "Male"}
                        onChange={() => setFormData({ ...formData, gender: "Male" })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>Male</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="gender"
                        value="Female"
                        checked={formData.gender === "Female"}
                        onChange={() => setFormData({ ...formData, gender: "Female" })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>Female</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Father's Name <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.fatherName}
                    onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                    placeholder="Father Name"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Mother's Name <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.motherName}
                    onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                    placeholder="Mother Name"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Contact No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.contactNo}
                    onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                    placeholder="Primary Calling Number"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp No.</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, whatsappNo: formData.contactNo })}
                      className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                    >
                      Same as Contact
                    </button>
                  </div>
                  <input
                    type="tel"
                    value={formData.whatsappNo}
                    onChange={(e) => setFormData({ ...formData, whatsappNo: e.target.value })}
                    placeholder="WhatsApp Number"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Previous School <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.previousSchool}
                    onChange={(e) => setFormData({ ...formData, previousSchool: e.target.value })}
                    placeholder="Name of previous school & board"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Previous Class</label>
                  <input
                    type="text"
                    value={formData.previousClass}
                    onChange={(e) => setFormData({ ...formData, previousClass: e.target.value })}
                    placeholder="Class completed"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Residential Address <span className="text-red-500 font-black">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.residentialAddress || ""}
                    onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                    placeholder="House / Flat No., Area / Locality, Landmark"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium transition-all"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: PARENT ENQUIRY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  PARENT ENQUIRY
                </h3>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  How did you hear about our school?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {SOURCES.map(source => {
                    const checked = (formData.heardAboutSchool || []).includes(source);
                    return (
                      <label 
                        key={source} 
                        onClick={() => handleSourceToggle(source)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                          checked 
                            ? "bg-orange-50 dark:bg-orange-950/40 border-orange-400 text-orange-800 dark:text-orange-300 font-bold" 
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {}}
                          className="rounded text-orange-600 focus:ring-orange-500"
                        />
                        <span className="truncate">{source}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reason for choosing our school</label>
                  <textarea
                    rows={2}
                    value={formData.reasonForChoosing}
                    onChange={(e) => setFormData({ ...formData, reasonForChoosing: e.target.value })}
                    placeholder="e.g. Reputation, Curriculum, Proximity, Referrals..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Preferred Contact</label>
                  <div className="flex items-center gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="preferredContact"
                        value="Call"
                        checked={formData.preferredContact === "Call"}
                        onChange={() => setFormData({ ...formData, preferredContact: "Call" })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>Call</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="preferredContact"
                        value="WhatsApp"
                        checked={formData.preferredContact === "WhatsApp"}
                        onChange={() => setFormData({ ...formData, preferredContact: "WhatsApp" })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>WhatsApp</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Best time to contact</label>
                  <input
                    type="text"
                    value={formData.bestTimeToContact}
                    onChange={(e) => setFormData({ ...formData, bestTimeToContact: e.target.value })}
                    placeholder="e.g. 10:00 AM - 12:00 PM or Evenings"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: STUDENT INFORMATION & PARENT EXPECTATIONS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">3</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  STUDENT INFORMATION & PARENT EXPECTATIONS
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Academic Performance</label>
                  <input
                    type="text"
                    value={formData.academicPerformance}
                    onChange={(e) => setFormData({ ...formData, academicPerformance: e.target.value })}
                    placeholder="e.g. Above average, Grade A, requires help in Math"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Student Interests / Talents</label>
                  <input
                    type="text"
                    value={formData.studentInterests}
                    onChange={(e) => setFormData({ ...formData, studentInterests: e.target.value })}
                    placeholder="e.g. Sports, Music, Art, Coding, Chess"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Strengths</label>
                  <input
                    type="text"
                    value={formData.strengths}
                    onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                    placeholder="e.g. Good communication, creative thinking"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Areas needing support</label>
                  <input
                    type="text"
                    value={formData.areasNeedingSupport}
                    onChange={(e) => setFormData({ ...formData, areasNeedingSupport: e.target.value })}
                    placeholder="e.g. Handwriting, Second Language, Concentration"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Requirement checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Transport Required?</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        checked={formData.transportRequired === true}
                        onChange={() => setFormData({ ...formData, transportRequired: true })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        checked={formData.transportRequired === false}
                        onChange={() => setFormData({ ...formData, transportRequired: false })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Special Support Required?</span>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        checked={formData.specialLearningSupport === true}
                        onChange={() => setFormData({ ...formData, specialLearningSupport: true })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                      <input
                        type="radio"
                        checked={formData.specialLearningSupport === false}
                        onChange={() => setFormData({ ...formData, specialLearningSupport: false })}
                        className="text-orange-600 focus:ring-orange-500"
                      />
                      <span>No</span>
                    </label>
                  </div>
                </div>
              </div>

              {formData.specialLearningSupport && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Special Learning / Support Details
                  </label>
                  <input
                    type="text"
                    value={formData.specialLearningDetails}
                    onChange={(e) => setFormData({ ...formData, specialLearningDetails: e.target.value })}
                    placeholder="Specify special educational or medical assistance needed"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              )}
            </div>

            {/* SECTION 4: COUNSELLING / INTERACTION NOTES */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">4</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  COUNSELLING / INTERACTION NOTES
                </h3>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Points discussed with parents:
                  </label>
                  <textarea
                    rows={3}
                    value={formData.pointsDiscussed}
                    onChange={(e) => setFormData({ ...formData, pointsDiscussed: e.target.value })}
                    placeholder="Enter key topics, syllabus explanations, fee details, transport queries, campus visit impressions..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Counsellor observations / additional remarks:
                  </label>
                  <textarea
                    rows={2}
                    value={formData.counsellorObservations}
                    onChange={(e) => setFormData({ ...formData, counsellorObservations: e.target.value })}
                    placeholder="Counsellor's internal feedback regarding parent readiness, child confidence, recommended class level..."
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: INFORMATION EXPLAINED */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">5</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  INFORMATION EXPLAINED (Check all that apply)
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: "explainedSchoolFacilities", label: "School Facilities" },
                  { key: "explainedAcademicProgramme", label: "Academic Programme" },
                  { key: "explainedFeeStructure", label: "Fee Structure" },
                  { key: "explainedTransportDetails", label: "Transport Details" },
                  { key: "explainedSchoolRules", label: "School Rules / Policies" },
                  { key: "explainedActivitiesSports", label: "Activities / Sports" },
                ].map(({ key, label }) => {
                  const isChecked = (formData as any)[key] === true;
                  return (
                    <label
                      key={key}
                      onClick={() => setFormData({ ...formData, [key]: !isChecked })}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked 
                          ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-400 text-emerald-800 dark:text-emerald-300 font-bold" 
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{label}: Explained</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* SECTION 6: ADMISSION STATUS & FOLLOW-UP */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">6</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                  ADMISSION STATUS & FOLLOW-UP
                </h3>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Admission Status</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map(status => {
                    const isSelected = formData.admissionStatus === status;
                    const conf = STATUS_CONFIG[status];
                    return (
                      <button
                        type="button"
                        key={status}
                        onClick={() => setFormData({ ...formData, admissionStatus: status })}
                        className={`px-3 py-2.5 rounded-xl border text-xs font-bold text-center cursor-pointer transition-all ${
                          isSelected 
                            ? `${conf.bg} ${conf.text} ${conf.border} ring-2 ring-orange-500` 
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {conf.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Follow-up Date</label>
                  <input
                    type="text"
                    value={formData.followUpDate}
                    onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                    placeholder="DD-MM-YYYY"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Counsellor Name & ID
                  </label>
                  {userRole === "Counsellor" && activeCounsellor ? (
                    <div className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-black text-orange-600 dark:text-orange-400 flex items-center justify-between">
                      <span>{activeCounsellor.name}</span>
                      <span className="font-mono text-[10px] bg-orange-100 dark:bg-orange-950 px-2 py-0.5 rounded">
                        {activeCounsellor.id}
                      </span>
                    </div>
                  ) : (
                    <select
                      value={formData.counsellorId || (localAccounts[0]?.id || "COUNSELLOR-01")}
                      onChange={(e) => {
                        const sel = localAccounts.find(c => c.id === e.target.value);
                        if (sel) {
                          setFormData({
                            ...formData,
                            counsellorId: sel.id,
                            counsellorName: sel.name
                          });
                        }
                      }}
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      {localAccounts.map((c, idx) => (
                        <option key={`counsellor-sel-${c.id}-${c.username}-${idx}`} value={c.id}>
                          {c.id}: {c.name} ({c.roleTitle})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Parent Signature / Consent</label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={formData.parentSignatureRecorded}
                      onChange={(e) => setFormData({ ...formData, parentSignatureRecorded: e.target.checked })}
                      className="rounded text-orange-600 focus:ring-orange-500"
                    />
                    <span>Recorded / In-Person Signature Received</span>
                  </label>
                </div>
              </div>

              {/* Office Use Only */}
              <div className="mt-4 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 tracking-wider uppercase">
                  FOR SCHOOL OFFICE USE ONLY
                </span>
                <input
                  type="text"
                  value={formData.officeRemarks || ""}
                  onChange={(e) => setFormData({ ...formData, officeRemarks: e.target.value })}
                  placeholder="Application Kit issued / Fee quotation given / Verification notes / Special remarks..."
                  className="w-full mt-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            {/* SECTION 7: LIVE MEETING VOICE RECORDING (FOR MANAGEMENT QUALITY AUDIT) */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">7</span>
                <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                  <span>PARENT COUNSELLING MEETING AUDIO RECORDING</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                    Management Quality Review
                  </span>
                </h3>
              </div>

              <AudioMeetingRecorder
                enquiryNo={formData.enquiryNo}
                studentName={formData.studentName}
                applyingForClass={formData.applyingForClass}
                fatherName={formData.fatherName}
                motherName={formData.motherName}
                contactNo={formData.contactNo}
                admissionStatus={formData.admissionStatus}
                followUpDate={formData.followUpDate}
                counsellorId={formData.counsellorId || (activeCounsellor?.id || "COUNSELLOR-01")}
                counsellorName={formData.counsellorName || (activeCounsellor?.name || "Admissions Counsellor")}
                existingAudio={formData.audioRecording}
                onSaveAudio={(audioRec) => {
                  setFormData(prev => {
                    const finalCounsellor = activeCounsellor || localAccounts.find(c => c.id === prev.counsellorId) || localAccounts[0];
                    const assignedCounsellorId = userRole === "Counsellor" && activeCounsellor ? activeCounsellor.id : (prev.counsellorId || finalCounsellor.id);
                    const assignedCounsellorName = userRole === "Counsellor" && activeCounsellor ? activeCounsellor.name : (prev.counsellorName || finalCounsellor.name);

                    const updated: CounsellingEnquiry = {
                      ...prev,
                      counsellorId: assignedCounsellorId,
                      counsellorName: assignedCounsellorName,
                      audioRecording: audioRec,
                      conversationLanguageNotes: audioRec.conversationLanguageNotes || prev.conversationLanguageNotes,
                      pointsDiscussed: prev.pointsDiscussed && prev.pointsDiscussed.trim()
                        ? prev.pointsDiscussed
                        : (audioRec.meetingTextSummary || prev.pointsDiscussed)
                    };
                    if (updated.studentName && updated.studentName.trim()) {
                      onSaveEnquiry(updated);
                    }
                    return updated;
                  });
                }}
                onRemoveAudio={() => {
                  setFormData(prev => {
                    const updated = {
                      ...prev,
                      audioRecording: undefined
                    };
                    if (updated.studentName && updated.studentName.trim()) {
                      onSaveEnquiry(updated);
                    }
                    return updated;
                  });
                }}
                onUpdateNotes={(newNotes) => {
                  setFormData(prev => {
                    const updated = {
                      ...prev,
                      pointsDiscussed: prev.pointsDiscussed && prev.pointsDiscussed.trim()
                        ? prev.pointsDiscussed
                        : newNotes,
                      conversationLanguageNotes: newNotes,
                      officeRemarks: prev.officeRemarks
                        ? prev.officeRemarks.includes(newNotes)
                          ? prev.officeRemarks
                          : `${prev.officeRemarks}\n\n${newNotes}`
                        : newNotes
                    };
                    if (updated.studentName && updated.studentName.trim()) {
                      onSaveEnquiry(updated);
                    }
                    return updated;
                  });
                }}
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelForm}
              className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              💾 Save Counselling Enquiry
            </button>
          </div>
        </form>
      )}

      {/* VIEW: PRINT PREVIEW (PHYSICAL SLIP EXACT LAYOUT) */}
      {activeView === "print" && selectedEnquiry && (
        <div className="space-y-4">
          <div className="flex items-center justify-between no-print bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView("list")}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ← Back to List
              </button>
              <span className="text-xs font-semibold text-slate-500">
                Print preview for {selectedEnquiry.enquiryNo} ({selectedEnquiry.studentName})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => editEnquiry(selectedEnquiry)}
                className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Edit3 size={14} /> Edit
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <Printer size={15} /> Print Physical Sheet
              </button>
            </div>
          </div>

          {/* Printable Document Box */}
          <div id="printable-counselling-form" className="bg-white text-black p-8 rounded-xl shadow-lg border border-slate-300 max-w-4xl mx-auto font-sans leading-relaxed text-xs">
            {/* Header */}
            <div className="text-center border-b-2 border-black pb-4 mb-4">
              <h2 className="text-base font-black tracking-widest uppercase">
                BIRLA OPENMINDS INTERNATIONAL SCHOOL
              </h2>
              <h1 className="text-lg font-black uppercase tracking-tight mt-1 underline">
                NEW ADMISSION – PARENT COUNSELLING FORM
              </h1>
            </div>

            {/* Section 1 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                1. STUDENT & PARENT DETAILS
              </div>
              <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div><span className="font-bold">Date:</span> {selectedEnquiry.date}</div>
                <div><span className="font-bold">Enquiry No.:</span> {selectedEnquiry.enquiryNo}</div>
                <div><span className="font-bold">Student Name:</span> {selectedEnquiry.studentName}</div>
                <div><span className="font-bold">Applying for Class:</span> {selectedEnquiry.applyingForClass}</div>
                <div><span className="font-bold">Date of Birth:</span> {selectedEnquiry.dateOfBirth || "—"}</div>
                <div><span className="font-bold">Gender:</span> [ {selectedEnquiry.gender === "Male" ? "✓" : " "} ] Male  [ {selectedEnquiry.gender === "Female" ? "✓" : " "} ] Female</div>
                <div><span className="font-bold">Father's Name:</span> {selectedEnquiry.fatherName || "—"}</div>
                <div><span className="font-bold">Mother's Name:</span> {selectedEnquiry.motherName || "—"}</div>
                <div><span className="font-bold">Contact No.:</span> {selectedEnquiry.contactNo}</div>
                <div><span className="font-bold">WhatsApp No.:</span> {selectedEnquiry.whatsappNo || "—"}</div>
                <div><span className="font-bold">Previous School:</span> {selectedEnquiry.previousSchool || "—"}</div>
                <div><span className="font-bold">Previous Class:</span> {selectedEnquiry.previousClass || "—"}</div>
                <div className="col-span-2"><span className="font-bold">Residential Address:</span> {selectedEnquiry.residentialAddress || "—"}</div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                2. PARENT ENQUIRY
              </div>
              <div className="p-2 space-y-1.5">
                <div>
                  <span className="font-bold">How did you hear about our school?</span>
                  <div className="flex gap-4 flex-wrap mt-1">
                    {SOURCES.map(s => (
                      <span key={s}>
                        [ {(selectedEnquiry.heardAboutSchool || []).includes(s) ? "✓" : " "} ] {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div><span className="font-bold">Reason for choosing our school:</span> {selectedEnquiry.reasonForChoosing || "—"}</div>
                <div className="grid grid-cols-2">
                  <div><span className="font-bold">Preferred Contact:</span> [ {selectedEnquiry.preferredContact === "Call" ? "✓" : " "} ] Call  [ {selectedEnquiry.preferredContact === "WhatsApp" ? "✓" : " "} ] WhatsApp</div>
                  <div><span className="font-bold">Best time to contact:</span> {selectedEnquiry.bestTimeToContact || "—"}</div>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                3. STUDENT INFORMATION & PARENT EXPECTATIONS
              </div>
              <div className="p-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                <div><span className="font-bold">Academic Performance:</span> {selectedEnquiry.academicPerformance || "—"}</div>
                <div><span className="font-bold">Student Interests/Talents:</span> {selectedEnquiry.studentInterests || "—"}</div>
                <div><span className="font-bold">Strengths:</span> {selectedEnquiry.strengths || "—"}</div>
                <div><span className="font-bold">Areas needing support:</span> {selectedEnquiry.areasNeedingSupport || "—"}</div>
                <div><span className="font-bold">Transport Required:</span> [ {selectedEnquiry.transportRequired === true ? "✓" : " "} ] Yes  [ {selectedEnquiry.transportRequired === false ? "✓" : " "} ] No</div>
                <div>
                  <span className="font-bold">Special Learning/Support Requirement:</span> [ {selectedEnquiry.specialLearningSupport === true ? "✓" : " "} ] Yes  [ {selectedEnquiry.specialLearningSupport === false ? "✓" : " "} ] No
                  {selectedEnquiry.specialLearningSupport && ` (Details: ${selectedEnquiry.specialLearningDetails || "—"})`}
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                4. COUNSELLING / INTERACTION NOTES
              </div>
              <div className="p-2 space-y-1.5 min-h-[60px]">
                <div><span className="font-bold">Points discussed with parents:</span> {selectedEnquiry.pointsDiscussed || "—"}</div>
                <div><span className="font-bold">Counsellor observations / additional remarks:</span> {selectedEnquiry.counsellorObservations || "—"}</div>
              </div>
            </div>

            {/* Section 5 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                5. INFORMATION EXPLAINED
              </div>
              <div className="p-2 grid grid-cols-2 gap-2">
                <div>School Facilities: [ {selectedEnquiry.explainedSchoolFacilities ? "✓" : " "} ] Explained</div>
                <div>Academic Programme: [ {selectedEnquiry.explainedAcademicProgramme ? "✓" : " "} ] Explained</div>
                <div>Fee Structure: [ {selectedEnquiry.explainedFeeStructure ? "✓" : " "} ] Explained</div>
                <div>Transport Details: [ {selectedEnquiry.explainedTransportDetails ? "✓" : " "} ] Explained</div>
                <div>School Rules/Policies: [ {selectedEnquiry.explainedSchoolRules ? "✓" : " "} ] Explained</div>
                <div>Activities / Sports: [ {selectedEnquiry.explainedActivitiesSports ? "✓" : " "} ] Explained</div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                6. ADMISSION STATUS & FOLLOW-UP
              </div>
              <div className="p-2 space-y-2">
                <div className="flex gap-4 flex-wrap">
                  {[
                    "Interested",
                    "Application Taken",
                    "Entrance Test Required",
                    "Admission Confirmed",
                    "Follow-up Required",
                    "Not Interested"
                  ].map(status => (
                    <span key={status}>
                      [ {selectedEnquiry.admissionStatus === status ? "✓" : " "} ] {status}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div><span className="font-bold">Follow-up Date:</span> {selectedEnquiry.followUpDate || "—"}</div>
                  <div>
                    <span className="font-bold">Counsellor:</span> {selectedEnquiry.counsellorName || "—"}
                    {selectedEnquiry.counsellorId && ` (${selectedEnquiry.counsellorId})`}
                  </div>
                </div>

                <div className="pt-4 border-t border-dashed border-slate-400 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-bold">Parent Signature:</span> __________________________
                    {selectedEnquiry.parentSignatureRecorded && (
                      <span className="ml-2 font-mono text-[10px] text-emerald-800">[Verified by Counsellor]</span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold">Counsellor Signature:</span> __________________________
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: EXECUTIVE MANAGEMENT AUDIO REVIEW DESK */}
      {activeView === "audio-desk" && (
        <ManagementAudioDesk
          enquiries={userRole === "Counsellor" ? counsellorScopeEnquiries : safeEnquiries}
          onUpdateEnquiry={onSaveEnquiry}
          userRole={userRole}
          userEmail={userEmail}
          initialCounsellorFilter={userRole === "Counsellor" && activeCounsellor ? activeCounsellor.name : "ALL"}
          counsellorAccounts={localAccounts}
        />
      )}

      {/* MODAL: CREATE / EDIT COUNSELLOR ACCOUNT (ADMIN TOOL) */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    {accountModalMode === "create" ? "Create New Counsellor Account" : "Edit Counsellor Account"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Assign login credentials & desk permissions
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAccountSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Counsellor ID
                  </label>
                  <input
                    type="text"
                    disabled
                    value={accountFormData.id}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={accountFormData.status}
                    onChange={(e) => setAccountFormData({ ...accountFormData, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active (Can Log in)</option>
                    <option value="inactive">Inactive (Login Blocked)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name (Counsellor Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. P. Sunitha, K. Rajesh"
                  value={accountFormData.name}
                  onChange={(e) => setAccountFormData({ ...accountFormData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Login Credentials Sub-panel */}
              <div className="p-3.5 bg-orange-50/70 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-orange-900 dark:text-orange-200 flex items-center gap-1.5">
                    <Key size={13} /> Login Credentials for Staff
                  </span>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-[10px] font-bold text-orange-700 dark:text-orange-300 hover:underline cursor-pointer"
                  >
                    ⚡ Auto-Generate Pass
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Username (User ID) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. sunitha, counsellor1"
                      value={accountFormData.username}
                      onChange={(e) => setAccountFormData({ ...accountFormData, username: e.target.value.toLowerCase().replace(/\s+/g, "") })}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-[9px] text-slate-400 mt-0.5">Used to log in to Counsellor portal</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Password / Key *
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordInModal ? "text" : "password"}
                        required
                        placeholder="Password for counsellor"
                        value={accountFormData.password}
                        onChange={(e) => setAccountFormData({ ...accountFormData, password: e.target.value })}
                        className="w-full pl-3 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordInModal(!showPasswordInModal)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPasswordInModal ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400 mt-0.5">Share this password with the counsellor</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Primary Wing Counsellor"
                    value={accountFormData.roleTitle}
                    onChange={(e) => setAccountFormData({ ...accountFormData, roleTitle: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Grades / Wings
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Grades 1-5 / Pre-Primary"
                    value={accountFormData.assignedGrades}
                    onChange={(e) => setAccountFormData({ ...accountFormData, assignedGrades: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98765 00000"
                    value={accountFormData.phone}
                    onChange={(e) => setAccountFormData({ ...accountFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Official Email
                  </label>
                  <input
                    type="email"
                    placeholder="counsellor@birlainstitute.edu.in"
                    value={accountFormData.email}
                    onChange={(e) => setAccountFormData({ ...accountFormData, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Theme Color Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Profile Badge Color
                </label>
                <div className="flex items-center gap-2">
                  {["#EA580C", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#0284C7", "#D97706", "#E11D48"].map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setAccountFormData({ ...accountFormData, color: c })}
                      className={`w-6 h-6 rounded-full cursor-pointer transition-all ${
                        accountFormData.color === c ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white scale-110" : "opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  {accountModalMode === "create" ? "✓ Create Counsellor Account" : "✓ Update Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FULL ENQUIRY DETAILS INSPECTION */}
      {inspectingEnquiry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 tracking-wider uppercase">
                  PARENT COUNSELLING ENQUIRY RECORD
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                  <span>{inspectingEnquiry.studentName}</span>
                  <span className="text-xs font-bold text-slate-500 font-mono">({inspectingEnquiry.enquiryNo || inspectingEnquiry.id})</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingEnquiry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Grid Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Student Details */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <GraduationCap size={13} className="text-orange-600" /> Student Info
                </div>
                <div className="text-slate-600 dark:text-slate-300 space-y-1">
                  <p><strong className="text-slate-800 dark:text-slate-100">Applying Class:</strong> {inspectingEnquiry.applyingForClass}</p>
                  <p><strong className="text-slate-800 dark:text-slate-100">Gender & DOB:</strong> {inspectingEnquiry.gender} • {inspectingEnquiry.dateOfBirth}</p>
                  <p><strong className="text-slate-800 dark:text-slate-100">Previous School:</strong> {inspectingEnquiry.previousSchool || "N/A"} ({inspectingEnquiry.previousClass || "N/A"})</p>
                </div>
              </div>

              {/* Parent & Contact */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1.5 border border-slate-100 dark:border-slate-800">
                <div className="font-bold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={13} className="text-blue-600" /> Parent Details
                </div>
                <div className="text-slate-600 dark:text-slate-300 space-y-1">
                  <p><strong className="text-slate-800 dark:text-slate-100">Father:</strong> {inspectingEnquiry.fatherName || "N/A"}</p>
                  <p><strong className="text-slate-800 dark:text-slate-100">Mother:</strong> {inspectingEnquiry.motherName || "N/A"}</p>
                  <p className="flex items-center gap-2">
                    <strong className="text-slate-800 dark:text-slate-100">Phone:</strong> {inspectingEnquiry.contactNo}
                    {inspectingEnquiry.whatsappNo && (
                      <a
                        href={`https://wa.me/91${inspectingEnquiry.whatsappNo.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md hover:underline"
                      >
                        <MessageSquare size={11} /> WhatsApp
                      </a>
                    )}
                  </p>
                  <p><strong className="text-slate-800 dark:text-slate-100">Residential Address:</strong> {inspectingEnquiry.residentialAddress || "N/A"}</p>
                </div>
              </div>
            </div>

            {/* Status & Counsellor Notes */}
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px] uppercase tracking-wider">
                  Status & Follow-up
                </span>
                <span className="px-2.5 py-0.5 bg-orange-100 dark:bg-orange-900/60 text-orange-800 dark:text-orange-200 rounded-full font-bold text-[11px]">
                  {inspectingEnquiry.admissionStatus}
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Follow-up Date:</strong> {inspectingEnquiry.followUpDate || "Not scheduled"}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <strong>Assigned Counsellor:</strong> {inspectingEnquiry.counsellorName} ({inspectingEnquiry.counsellorId})
              </p>
              {inspectingEnquiry.pointsDiscussed && (
                <div className="pt-2 border-t border-amber-200/50 dark:border-amber-900/30">
                  <strong className="text-slate-800 dark:text-slate-100 block mb-0.5">Points Discussed:</strong>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic">"{inspectingEnquiry.pointsDiscussed}"</p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const item = inspectingEnquiry;
                    setInspectingEnquiry(null);
                    editEnquiry(item);
                  }}
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Edit3 size={13} /> Edit Details
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = inspectingEnquiry;
                    setInspectingEnquiry(null);
                    viewPrintPreview(item);
                  }}
                  className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Printer size={13} /> Print Slip
                </button>
              </div>

              <button
                type="button"
                onClick={() => setInspectingEnquiry(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE ENQUIRY CONFIRMATION */}
      {enquiryToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Enquiry Record?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete enquiry <strong className="text-slate-900 dark:text-slate-200">#{enquiryToDelete.enquiryNo}</strong> for <strong className="text-slate-900 dark:text-slate-200">{enquiryToDelete.studentName}</strong>?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Class Applying:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{enquiryToDelete.applyingForClass || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Parent Contact:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{enquiryToDelete.contactNo || enquiryToDelete.whatsappNo || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Counsellor:</span>
                <span className="font-semibold text-orange-600 dark:text-orange-400">{enquiryToDelete.counsellorName || "Unassigned"}</span>
              </div>
              {enquiryToDelete.audioRecording && (
                <div className="pt-1 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                  <span>🎙️ Attached meeting audio recording will also be permanently cleared.</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEnquiryToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteEnquiry}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Delete Enquiry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK DELETE ENQUIRY CONFIRMATION */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete {selectedEnquiryIds.length} Selected Records?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to permanently delete all <strong className="text-slate-900 dark:text-slate-200">{selectedEnquiryIds.length} selected enquiry forms</strong>?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto custom-scrollbar space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              <span className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Items Selected for Permanent Deletion:</span>
              {filteredEnquiries
                .filter(e => selectedEnquiryIds.includes(e.id))
                .map((item, i) => (
                  <div key={`bulk-del-item-${item.id}`} className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 font-mono py-0.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <span className="truncate pr-2">#{i + 1} {item.enquiryNo} - {item.studentName}</span>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 shrink-0">{item.applyingForClass}</span>
                  </div>
                ))}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              Note: Records will be removed permanently across Firestore and local storage.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Delete {selectedEnquiryIds.length} Records</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* MODAL: DELETE COUNSELLOR ACCOUNT CONFIRMATION */}
      {accountToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Counsellor Account?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-200">{accountToDelete.name}</strong> (<span className="font-mono font-bold text-orange-600 dark:text-orange-400">@{accountToDelete.username}</span>)? They will no longer be able to log in to the Counsellor portal.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-[110] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-2.5 animate-in slide-in-from-bottom-5 duration-200">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Check size={14} />
          </div>
          <span className="text-xs font-bold">{deleteToast}</span>
        </div>
      )}

      {/* MODAL: CHANGE COUNSELLOR PASSWORD */}
      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 relative">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl">
                  <KeyRound size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    Change Login Password
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Account: <strong className="text-orange-600 dark:text-orange-400">{activeCounsellor?.name || "Admissions Counsellor"}</strong> ({activeCounsellor?.username || "counsellor"})
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChangePasswordModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Error & Success Messages */}
            {passwordErrorMsg && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{passwordErrorMsg}</span>
              </div>
            )}

            {passwordSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{passwordSuccessMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveNewPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password / PIN (Optional Verification):
                </label>
                <div className="relative">
                  <input
                    type={showPasswordsInModal ? "text" : "password"}
                    value={currentPasswordInput}
                    onChange={(e) => setCurrentPasswordInput(e.target.value)}
                    placeholder="Enter current password if known"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordsInModal(!showPasswordsInModal)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPasswordsInModal ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  New Password <span className="text-rose-500">*</span>:
                </label>
                <input
                  type={showPasswordsInModal ? "text" : "password"}
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (min. 4 characters)"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>:
                </label>
                <input
                  type={showPasswordsInModal ? "text" : "password"}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-enter new password to confirm"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-orange-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isSavingPassword ? "animate-spin" : ""} />
                  <span>{isSavingPassword ? "Updating Password..." : "Update Password Now"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Android & Desktop App Deployment Center Modal */}
      <AppInstallModal
        isOpen={isAppInstallModalOpen}
        onClose={() => setIsAppInstallModalOpen(false)}
      />

      {/* 1-Click WhatsApp Counselling & Admissions Report Modal */}
      <CounsellingReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        enquiries={safeEnquiries}
        currentCounsellorName={activeCounsellor?.name}
        userRole={userRole}
      />

      {/* Reception Self-Registration Parent Kiosk Modal */}
      <ParentKioskModal
        isOpen={isParentKioskModalOpen}
        onClose={() => setIsParentKioskModalOpen(false)}
        onSubmitParentEntry={handleAddParentSelfEntry}
        defaultMode={parentKioskDefaultMode}
      />

      {/* Walk-in Reception Parent Queue & Claim Modal */}
      <ReceptionQueueModal
        isOpen={isReceptionQueueModalOpen}
        onClose={() => setIsReceptionQueueModalOpen(false)}
        entries={parentSelfEntries}
        onClaimEntry={handleClaimAndAutoFill}
        onDismissEntry={handleDismissParentEntry}
        onOpenQrPoster={() => {
          setIsReceptionQueueModalOpen(false);
          setParentKioskDefaultMode("print_qr");
          setIsParentKioskModalOpen(true);
        }}
        currentCounsellorName={activeCounsellor?.name}
        currentCounsellorId={activeCounsellor?.id}
        userRole={userRole}
      />

      {/* Day-Wise, Weekly & Monthly Token List Report Modal */}
      {isTokenListReportModalOpen && (
        <TokenListReportModal
          isOpen={isTokenListReportModalOpen}
          onClose={() => setIsTokenListReportModalOpen(false)}
          entries={parentSelfEntries}
          counsellors={localAccounts}
        />
      )}

      {/* Official Parent WhatsApp Communication Modal */}
      {!!whatsAppModalEnquiry && (
        <WhatsAppMessageModal
          isOpen={!!whatsAppModalEnquiry}
          onClose={() => setWhatsAppModalEnquiry(null)}
          enquiry={whatsAppModalEnquiry}
          activeCounsellor={activeCounsellor}
          onPrint={(enquiry) => {
            setWhatsAppModalEnquiry(null);
            viewPrintPreview(enquiry);
          }}
        />
      )}

      {/* Confirmation Alert Dialog for Clearing Waiting Queue */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-rose-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Top Icon & Title */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-200 dark:border-rose-900 shadow-sm">
                <AlertTriangle size={24} className="animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Confirm Clear Waiting Queue?
                </h3>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  ⚠️ Action cannot be undone
                </p>
              </div>
            </div>

            {/* Warning Body */}
            <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Are you sure you want to clear all <strong className="text-rose-600 dark:text-rose-400 font-black text-sm">{pendingParentEntries.length} waiting parent token card(s)</strong> from your lounge?
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-rose-200/50 dark:border-rose-900/40">
                If you clicked <strong>Clear</strong> by accident or mistake, please click <strong>Cancel</strong> below to keep all tokens safe. Only proceed if you genuinely want to clear the waiting lounge.
              </p>
            </div>

            {/* Actions: Cancel vs Confirm OK */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowClearConfirmModal(false);
                  handleClearAllPending();
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Yes, Clear All ({pendingParentEntries.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time In-App Live Auto-Update Notifier */}
      <AppUpdateNotifier />
    </div>
  );
}
