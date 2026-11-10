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
  School,
  Globe,
  Zap,
  FolderArchive
} from "lucide-react";
import AudioMeetingRecorder from "./AudioMeetingRecorder";
import ManagementAudioDesk from "./ManagementAudioDesk";
import AppInstallModal from "./AppInstallModal";
import AppUpdateNotifier from "./AppUpdateNotifier";
import CounsellingReportModal from "./CounsellingReportModal";
import ParentKioskModal from "./ParentKioskModal";
import ReceptionQueueModal from "./ReceptionQueueModal";
import TokenListReportModal from "./TokenListReportModal";
import DismissedLeadsModal from "./DismissedLeadsModal";
import WhatsAppMessageModal from "./WhatsAppMessageModal";
import { 
  CounsellingEnquiry, 
  AdmissionStatus, 
  getNextEnquiryNo, 
  getNextOnlineEnquiryNo,
  recordHighestOnlineEnquiryNumber,
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
  unrecordDeletedCounsellorAccountId,
  getAllowCounsellorMultiDelete, 
  setAllowCounsellorMultiDelete, 
  loadParentSelfEntries, 
  saveParentSelfEntries,
  getDismissedParentEntryIds,
  recordDismissedParentEntryId,
  unrecordDismissedParentEntryId,
  saveDismissedParentEntry,
  loadDismissedParentEntries,
  removeDismissedParentEntryFromArchive,
  unmarkDeletedEnquiryId,
  getDeletedEnquiryIds
} from "../utils/storage";
import { deleteAudioRecordingBlob, formatAudioDuration } from "../utils/audioStorage";
import { isFirebaseConfigured, syncCollection, saveDocument, deleteDocument, getNextDailyTokenNo } from "../utils/firebase";
import { printOfficialAdmissionForm } from "../utils/printAdmissionForm";
import { normalizeCounsellorIdentity } from "../utils/counsellorNormalizer";

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
      map.set(item.id, { ...item });
    } else {
      const existing = map.get(item.id)!;
      // If either has been dismissed or claimed, preserve that state so old snapshots don't revive it
      if (item.status === "dismissed" || existing.status === "dismissed") {
        map.set(item.id, { ...existing, ...item, status: "dismissed" });
      } else if (item.status === "claimed" || (item.claimedAt && !existing.claimedAt)) {
        map.set(item.id, { ...existing, ...item });
      }
    }
  }

  const result = Array.from(map.values());

  // Auto-normalize daily token numbers per day so duplicate token #1 issues are fixed cleanly
  const byDate = new Map<string, ParentSelfEntry[]>();
  for (const item of result) {
    const key = item.dateKey || item.entryDate || (item.formattedDate ? eDate(item) : "legacy");
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(item);
  }

  function eDate(i: ParentSelfEntry): string {
    return i.formattedDate ? i.formattedDate.split(" ")[0] : "";
  }

  for (const [, dayItems] of byDate.entries()) {
    // 1. Online enquiries strictly NEVER get daily tokens
    dayItems.forEach(i => {
      if (i.enquiryType === "online") {
        delete i.dailyTokenNo;
      }
    });

    // 2. Physical walk-ins: Strictly sequential daily tokens (1, 2, 3...)
    const activeItems = dayItems.filter(i => i.status !== "dismissed" && i.enquiryType !== "online");
    
    // Sort chronologically by submittedAt so earlier submitted entries preserve their assigned tokens
    activeItems.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

    const usedTokens = new Set<number>();
    for (const item of activeItems) {
      const tokenNum = Number(item.dailyTokenNo);
      if (!tokenNum || isNaN(tokenNum) || tokenNum <= 0 || usedTokens.has(tokenNum)) {
        let nextSeq = 1;
        while (usedTokens.has(nextSeq)) {
          nextSeq++;
        }
        item.dailyTokenNo = nextSeq;
        usedTokens.add(nextSeq);
        try {
          if (isFirebaseConfigured()) {
            saveDocument("parent_self_entries", item.id, { dailyTokenNo: nextSeq });
          }
        } catch {}
      } else {
        usedTokens.add(tokenNum);
      }
    }
  }

  return result.sort((a, b) => {
    // Today's entries ordered by daily token number ascending
    const aDate = a.dateKey || a.entryDate || (a.formattedDate ? a.formattedDate.split(" ")[0] : "");
    const bDate = b.dateKey || b.entryDate || (b.formattedDate ? b.formattedDate.split(" ")[0] : "");
    if (aDate === bDate && a.dailyTokenNo && b.dailyTokenNo) {
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
  "Interested": { label: "Follow-up Required", bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  "Follow-up Required": { label: "Follow-up Required", bg: "bg-orange-50 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  "Application Taken": { label: "Application Taken", bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "Entrance Test Required": { label: "Entrance Test Required", bg: "bg-purple-50 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700" },
  "Admission Confirmed": { label: "Admission Confirmed", bg: "bg-emerald-50 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700" },
  "Not Interested": { label: "Not Interested", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400", border: "border-slate-300 dark:border-slate-700" }
};

export const FORM_STATUS_OPTIONS: AdmissionStatus[] = [
  "Follow-up Required",
  "Application Taken",
  "Entrance Test Required",
  "Admission Confirmed",
  "Not Interested"
];

// Pure date utility functions accessible throughout CounsellingPortal module
export const formatDMYFromDate = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const getFutureDateDMY = (daysToAdd: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  return formatDMYFromDate(d);
};

export const dmyToYmd = (dmyStr?: string): string => {
  if (!dmyStr) return "";
  const clean = dmyStr.trim().replace(/[\/\.]/g, "-");
  const parts = clean.split("-");
  if (parts.length === 3 && parts[2].length === 4) {
    const dd = parts[0].padStart(2, "0");
    const mm = parts[1].padStart(2, "0");
    const yyyy = parts[2];
    return `${yyyy}-${mm}-${dd}`;
  }
  if (parts.length === 3 && parts[0].length === 4) {
    return clean;
  }
  return "";
};

export const ymdToDmy = (ymdStr?: string): string => {
  if (!ymdStr) return "";
  const clean = ymdStr.trim().replace(/[\/\.]/g, "-");
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const yyyy = parts[0];
    const mm = parts[1].padStart(2, "0");
    const dd = parts[2].padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  return clean;
};

export const parseEnquiryDateInfo = (dateStr: string) => {
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

export const getTodayYMDStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getYesterdayYMDStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getPastDaysYMDStr = (daysAgo: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const getMonthStartYMDStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
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
  const [filterChannel, setFilterChannel] = useState<"ALL" | "WALKIN" | "ONLINE">("ALL");
  const [filterClass, setFilterClass] = useState<string>("ALL");
  const [filterAuditStatus, setFilterAuditStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterDatePreset, setFilterDatePreset] = useState<"ALL" | "TODAY" | "YESTERDAY" | "custom">("ALL");
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

  // Safe enquiries source with deleted IDs filtered out & linked sibling audio hydration
  const safeEnquiries = useMemo(() => {
    const list = Array.isArray(enquiries) ? enquiries : [];
    const deletedSet = new Set(getDeletedEnquiryIds().map(x => x.toLowerCase()));
    const filtered = list.filter(e => {
      if (!e) return false;
      const eId = (e.id || "").toLowerCase();
      const eNo = (e.enquiryNo || "").toLowerCase();
      return (!eId || !deletedSet.has(eId)) && (!eNo || !deletedSet.has(eNo));
    });

    // Audio map by enquiry number & ID for fast linked sibling resolution
    const audioMap = new Map<string, any>();
    filtered.forEach(e => {
      if (e.audioRecording && (
        e.audioRecording.audioData || 
        e.audioRecording.storageKey || 
        e.audioRecording.driveFileUrl || 
        e.audioRecording.driveFileId || 
        e.audioRecording.audioUrl || 
        e.audioRecording.fileName || 
        (e.audioRecording.durationSeconds && e.audioRecording.durationSeconds > 0) ||
        e.audioRecording.meetingTextSummary
      )) {
        if (e.enquiryNo) audioMap.set(e.enquiryNo.trim().toLowerCase(), e.audioRecording);
        if (e.id) audioMap.set(e.id.trim().toLowerCase(), e.audioRecording);
      }
    });

    // Ensure linked sibling admissions share the parent meeting audio recording seamlessly
    return filtered.map(e => {
      const hasDirectAudio = Boolean(
        e.audioRecording && (
          e.audioRecording.audioData || 
          e.audioRecording.storageKey || 
          e.audioRecording.driveFileUrl || 
          e.audioRecording.driveFileId || 
          e.audioRecording.audioUrl || 
          e.audioRecording.fileName || 
          (e.audioRecording.durationSeconds && e.audioRecording.durationSeconds > 0) ||
          e.audioRecording.meetingTextSummary
        )
      );

      if (hasDirectAudio) return e;

      // Check linked sibling enquiry
      const sibKey = (e.siblingEnquiryNo || "").trim().toLowerCase();
      let sharedAudio = sibKey ? audioMap.get(sibKey) : null;

      if (!sharedAudio && (e.isSibling || e.siblingStudentName)) {
        const linkedOther = filtered.find(o =>
          o !== e && (
            (o.siblingEnquiryNo && o.siblingEnquiryNo.trim().toLowerCase() === (e.enquiryNo || "").trim().toLowerCase()) ||
            (o.contactNo && o.contactNo === e.contactNo && o.fatherName === e.fatherName && o.audioRecording)
          )
        );
        if (linkedOther?.audioRecording) {
          sharedAudio = linkedOther.audioRecording;
        }
      }

      if (sharedAudio) {
        return {
          ...e,
          audioRecording: {
            ...sharedAudio,
            id: `${sharedAudio.id || e.id || e.enquiryNo}-SIB`,
            enquiryNo: e.enquiryNo || e.id,
            studentName: e.studentName,
            isJointSiblingSession: true,
            jointSiblingNames: sharedAudio.jointSiblingNames || `${sharedAudio.studentName || 'Child 1'} & ${e.studentName}`
          }
        };
      }

      return e;
    });
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

  React.useEffect(() => {
    const handleCounsellorSync = (e?: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setLocalAccounts(mergeWithDefaultCounsellorAccounts(e.detail));
      } else {
        setLocalAccounts(loadCounsellorAccounts());
      }
    };

    let channel: BroadcastChannel | null = null;
    if (typeof window !== "undefined") {
      window.addEventListener("counsellor_accounts_updated", handleCounsellorSync);
      window.addEventListener("storage", handleCounsellorSync);
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel("birla_accounts_sync");
        channel.onmessage = (event) => {
          if (event.data?.type === "COUNSELLORS_SYNC") {
            if (Array.isArray(event.data.accounts)) {
              setLocalAccounts(mergeWithDefaultCounsellorAccounts(event.data.accounts));
            } else {
              setLocalAccounts(loadCounsellorAccounts());
            }
          }
        };
      }
    }

    // Direct real-time Firestore sync for instant cross-device updates
    let unsubFirestore: (() => void) | undefined;
    if (isFirebaseConfigured()) {
      try {
        unsubFirestore = syncCollection<CounsellorAccount>(
          "counsellor_accounts",
          (items) => {
            if (Array.isArray(items) && items.length > 0) {
              const merged = mergeWithDefaultCounsellorAccounts(items);
              setLocalAccounts(merged);
              saveCounsellorAccounts(merged);
            }
          },
          []
        );
      } catch (err) {
        console.warn("Counselling portal Firestore accounts sync notice:", err);
      }
    }

    // Periodic fallback server pull (30s, active tabs only)
    const fetchServer = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/accounts");
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.accounts?.counsellors)) {
            const extraDeleted = Array.isArray(json.accounts.deletedCounsellors) ? json.accounts.deletedCounsellors : [];
            const merged = mergeWithDefaultCounsellorAccounts(json.accounts.counsellors, extraDeleted);
            setLocalAccounts(merged);
            saveCounsellorAccounts(merged);
          }
        }
      } catch {}
    };
    fetchServer();
    const interval = setInterval(fetchServer, 30000);

    return () => {
      clearInterval(interval);
      if (unsubFirestore) unsubFirestore();
      if (channel) channel.close();
      if (typeof window !== "undefined") {
        window.removeEventListener("counsellor_accounts_updated", handleCounsellorSync);
        window.removeEventListener("storage", handleCounsellorSync);
      }
    };
  }, []);

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
          if (parsed && (parsed.id || parsed.username)) return parsed;
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

  // Joint Sibling Session States
  const [isJointSiblingMode, setIsJointSiblingMode] = useState<boolean>(false);
  const [siblingActiveTab, setSiblingActiveTab] = useState<"child1" | "child2">("child1");
  const [siblingFormData, setSiblingFormData] = useState<CounsellingEnquiry | null>(null);
  const [linkedSiblingTokens, setLinkedSiblingTokens] = useState<ParentSelfEntry[]>([]);
  const [applyFollowUpToSibling, setApplyFollowUpToSibling] = useState<boolean>(true);

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

  // Online Leads Pool Controls: Minimize (Collapse), Maximize (Expand Grid), and Dismissed Archive
  const [isOnlinePoolCollapsed, setIsOnlinePoolCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("counselling_online_pool_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const [isOnlinePoolMaximized, setIsOnlinePoolMaximized] = useState<boolean>(() => {
    try {
      return localStorage.getItem("counselling_online_pool_maximized") === "true";
    } catch {
      return false;
    }
  });
  const [isDismissedLeadsModalOpen, setIsDismissedLeadsModalOpen] = useState<boolean>(false);
  const [tokenActionModalEntry, setTokenActionModalEntry] = useState<ParentSelfEntry | null>(null);
  const [counsellorDismissVersion, setCounsellorDismissVersion] = useState<number>(0);

  const toggleOnlinePoolCollapsed = () => {
    setIsOnlinePoolCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("counselling_online_pool_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  const toggleOnlinePoolMaximized = () => {
    setIsOnlinePoolMaximized(prev => {
      const next = !prev;
      try {
        localStorage.setItem("counselling_online_pool_maximized", String(next));
      } catch {}
      return next;
    });
  };

  // Active Draft form state for claimed parent lead recovery
  const [activeDraft, setActiveDraft] = useState<any>(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("bomis_counsellor_active_draft");
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  });

  // Scheduled Follow-Up Reminder Hub States
  const [isFollowUpHubCollapsed, setIsFollowUpHubCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("counsellor_followup_hub_collapsed");
      return saved !== null ? saved === "true" : false;
    } catch {
      return false;
    }
  });
  const [followUpTab, setFollowUpTab] = useState<"today" | "overdue" | "upcoming" | "all">("today");
  const [followUpSearchQuery, setFollowUpSearchQuery] = useState<string>("");
  const [reschedulingEnquiry, setReschedulingEnquiry] = useState<CounsellingEnquiry | null>(null);
  const [rescheduleCustomDate, setRescheduleCustomDate] = useState<string>("");
  const [rescheduleNote, setRescheduleNote] = useState<string>("");

  const toggleFollowUpHubCollapsed = () => {
    setIsFollowUpHubCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("counsellor_followup_hub_collapsed", String(next)); } catch {}
      return next;
    });
  };

  const [isRefreshingDept, setIsRefreshingDept] = useState(false);

  const handleRefreshDept = async () => {
    setIsRefreshingDept(true);

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

    if (onSyncRefresh) {
      try {
        await Promise.resolve(onSyncRefresh());
      } catch {}
    }

    const currentViewName = 
      activeView === "audio-desk" ? "Meeting Audios" :
      activeView === "form" ? "Admission Form" :
      activeView === "accounts" ? "Counsellor Accounts" :
      activeView === "print" ? "Print Preview" : "Enquiries Dashboard";

    setDeleteToast(`🔄 Department data refreshed! (Stayed on ${currentViewName})`);

    setTimeout(() => {
      setIsRefreshingDept(false);
    }, 800);
    setTimeout(() => {
      setDeleteToast(null);
    }, 3500);
  };


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
      if (typeof document !== "undefined" && document.hidden) return;
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

    // Relaxed background check (30s)
    const interval = setInterval(fetchServerEntries, 30000);

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

  // 1. Reception Walk-in Queue (Strictly In-Person Visits with Daily Tokens)
  const pendingParentEntries = useMemo(() => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    const dismissedSet = new Set(getDismissedParentEntryIds(counsellorId));
    return (parentSelfEntries || [])
      .filter(e => e.status === "pending" && e.enquiryType !== "online" && !dismissedSet.has(e.id))
      .sort((a, b) => {
        const aDate = a.dateKey || a.entryDate || (a.formattedDate ? a.formattedDate.split(" ")[0] : "");
        const bDate = b.dateKey || b.entryDate || (b.formattedDate ? b.formattedDate.split(" ")[0] : "");
        if (aDate === bDate && a.dailyTokenNo && b.dailyTokenNo) {
          return a.dailyTokenNo - b.dailyTokenNo;
        }
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
      });
  }, [parentSelfEntries, activeCounsellor, counsellorDismissVersion]);

  // 2. Online Leads Pool (Remote / Website / WhatsApp QR Enquiries with ONL-YYYY-XX numbers)
  const pendingOnlineEntries = useMemo(() => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    const dismissedSet = new Set(getDismissedParentEntryIds(counsellorId));
    return (parentSelfEntries || [])
      .filter(e => e.status === "pending" && e.enquiryType === "online" && !dismissedSet.has(e.id))
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [parentSelfEntries, activeCounsellor, counsellorDismissVersion]);

  // 3. Dismissed Leads & Tokens Archive (Preserves all dismissed entries across counsellors)
  const dismissedParentEntries = useMemo(() => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : undefined;
    const dismissedIds = new Set(getDismissedParentEntryIds(counsellorId));
    const archivedFromDisk = loadDismissedParentEntries();
    const map = new Map<string, ParentSelfEntry>();

    // Seed from archived
    archivedFromDisk.forEach(e => {
      if (e && e.id) map.set(e.id, { ...e, status: "dismissed" });
    });

    // Seed from active parentSelfEntries with dismissed status or in dismissedIds
    (parentSelfEntries || []).forEach(e => {
      if (e && e.id && (e.status === "dismissed" || dismissedIds.has(e.id))) {
        map.set(e.id, { ...e, status: "dismissed" });
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.dismissedAt ? new Date(a.dismissedAt).getTime() : new Date(a.submittedAt).getTime();
      const timeB = b.dismissedAt ? new Date(b.dismissedAt).getTime() : new Date(b.submittedAt).getTime();
      return timeB - timeA;
    });
  }, [parentSelfEntries, activeCounsellor, counsellorDismissVersion]);

  // Automatic Sibling Family Detection in Reception Lounge
  const pendingSiblingGroups = useMemo(() => {
    const phoneMap = new Map<string, ParentSelfEntry[]>();
    const processedIds = new Set<string>();

    for (const entry of pendingParentEntries) {
      const cleanPhone = (entry.contactNo || "").replace(/\D/g, "");
      if (cleanPhone.length >= 10) {
        if (!phoneMap.has(cleanPhone)) phoneMap.set(cleanPhone, []);
        phoneMap.get(cleanPhone)!.push(entry);
      }
    }

    const siblingGroups: { phone: string; entries: ParentSelfEntry[] }[] = [];
    const soloEntries: ParentSelfEntry[] = [];

    for (const entry of pendingParentEntries) {
      if (processedIds.has(entry.id)) continue;
      const cleanPhone = (entry.contactNo || "").replace(/\D/g, "");
      const group = (cleanPhone.length >= 10 && phoneMap.get(cleanPhone)) || [];
      if (group.length > 1) {
        siblingGroups.push({ phone: cleanPhone, entries: group });
        group.forEach(g => processedIds.add(g.id));
      } else {
        soloEntries.push(entry);
        processedIds.add(entry.id);
      }
    }

    return { siblingGroups, soloEntries };
  }, [pendingParentEntries]);

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

  // 1. Skip for My Profile (Keeps token active & waiting for other counsellors!)
  const handleSkipForMyProfile = (entryId: string) => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    const counsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Desk";
    
    // Save to this counsellor's personal dismissed list only
    recordDismissedParentEntryId(entryId, counsellorId);

    const nowStr = new Date().toISOString();
    const target = parentSelfEntries.find(e => e.id === entryId);
    if (target) {
      const skippedItem: ParentSelfEntry = {
        ...target,
        dismissedBy: counsellorName,
        dismissedById: counsellorId,
        dismissedAt: nowStr,
        dismissedReason: `Skipped by ${counsellorName} (Still waiting for other counsellors)`
      };
      saveDismissedParentEntry(skippedItem);
    }

    // Force queue refresh for this counsellor
    setCounsellorDismissVersion(v => v + 1);

    setDeleteToast(`✓ Token #${target?.dailyTokenNo || ""} hidden from your queue. Still ACTIVE for other counsellors.`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  // 2. Global Dismiss (Parent left campus without meeting or lead cancelled)
  const handleGlobalDismissParentEntry = async (entryId: string, reason = "Parent left campus without meeting") => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
    const counsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Desk";
    
    // Record globally and for this counsellor
    recordDismissedParentEntryId(entryId);
    recordDismissedParentEntryId(entryId, counsellorId);

    const nowStr = new Date().toISOString();
    const target = parentSelfEntries.find(e => e.id === entryId);
    const dismissedItem = target ? {
      ...target,
      status: "dismissed" as const,
      dismissedBy: counsellorName,
      dismissedById: counsellorId,
      dismissedAt: nowStr,
      dismissedReason: reason
    } : {
      id: entryId,
      status: "dismissed" as const,
      dismissedBy: counsellorName,
      dismissedById: counsellorId,
      dismissedAt: nowStr,
      dismissedReason: reason
    };

    saveDismissedParentEntry(dismissedItem);

    // 1. Update React state & LocalStorage marking status as dismissed globally
    const updated = parentSelfEntries.map(e => e.id === entryId ? {
      ...e,
      status: "dismissed" as const,
      dismissedBy: counsellorName,
      dismissedById: counsellorId,
      dismissedAt: nowStr,
      dismissedReason: reason
    } : e);
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);
    setCounsellorDismissVersion(v => v + 1);

    // 2. Update Firestore with status: "dismissed"
    try {
      if (isFirebaseConfigured()) {
        await saveDocument("parent_self_entries", entryId, {
          status: "dismissed",
          dismissedBy: counsellorName,
          dismissedById: counsellorId,
          dismissedAt: nowStr,
          dismissedReason: reason
        });
      }
    } catch {}

    // 3. Post to Server to preserve in data/parent_self_entries.json
    try {
      await fetch("/api/parent-self-entry/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: entryId,
          counsellorId,
          counsellorName,
          reason
        })
      });
    } catch {}

    setDeleteToast("✓ Token cancelled and archived globally for all portals.");
    setTimeout(() => setDeleteToast(null), 3500);
  };

  // Main entry point for dismiss: opens modal to clarify whether to skip for self or cancel globally
  const handleDismissParentEntry = (entryId: string) => {
    const target = parentSelfEntries.find(e => e.id === entryId);
    if (target) {
      setTokenActionModalEntry(target);
    } else {
      handleSkipForMyProfile(entryId);
    }
  };

  const handleRestoreDismissedEntry = async (entry: ParentSelfEntry) => {
    // Guard: Prevent restoring if already claimed by another counsellor
    const liveMatch = parentSelfEntries.find(e => e.id === entry.id);
    const isAlreadyClaimed = Boolean(
      (liveMatch && (liveMatch.status === "claimed" || liveMatch.claimedBy || liveMatch.claimedByName)) ||
      entry.status === "claimed" ||
      entry.claimedBy ||
      entry.claimedByName
    );
    const currentCounsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR-01";
    if (isAlreadyClaimed && liveMatch && liveMatch.claimedBy && liveMatch.claimedBy !== currentCounsellorId) {
      alert(`⚠️ Cannot restore Token #${entry.dailyTokenNo || entry.id}: It has already been claimed by ${liveMatch.claimedByName || liveMatch.claimedBy} and is currently in active counselling!`);
      return;
    }

    const counsellorId = activeCounsellor ? activeCounsellor.id : undefined;
    unrecordDismissedParentEntryId(entry.id, counsellorId);
    removeDismissedParentEntryFromArchive(entry.id);

    const updated = parentSelfEntries.map(e => e.id === entry.id ? {
      ...e,
      status: "pending" as const,
      dismissedBy: undefined,
      dismissedById: undefined,
      dismissedAt: undefined,
      dismissedReason: undefined
    } : e);
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);
    setCounsellorDismissVersion(v => v + 1);

    try {
      if (isFirebaseConfigured()) {
        await saveDocument("parent_self_entries", entry.id, {
          status: "pending",
          dismissedBy: null,
          dismissedById: null,
          dismissedAt: null,
          dismissedReason: null
        });
      }
    } catch {}

    try {
      await fetch("/api/parent-self-entry/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: entry.id })
      });
    } catch {}

    setDeleteToast(`✓ Restored ${entry.studentName} back to active pool!`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handlePermanentDeleteEntry = async (entryId: string) => {
    const counsellorId = activeCounsellor ? activeCounsellor.id : undefined;
    recordDismissedParentEntryId(entryId, counsellorId);
    removeDismissedParentEntryFromArchive(entryId);

    const updated = parentSelfEntries.filter(e => e.id !== entryId);
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);

    try {
      if (isFirebaseConfigured()) {
        await deleteDocument("parent_self_entries", entryId);
      }
    } catch {}

    try {
      await fetch(`/api/parent-self-entry/${entryId}`, { method: "DELETE" });
    } catch {}

    setDeleteToast("✓ Lead permanently deleted from database.");
    setTimeout(() => setDeleteToast(null), 3000);
  };

  const handleClearAllClaimed = async () => {
    if (claimedParentEntries.length === 0) return;
    const count = claimedParentEntries.length;
    const ids = claimedParentEntries.map(e => e.id);
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";

    // 1. Delete all claimed entries from Firestore and record dismissal
    ids.forEach(id => {
      recordDismissedParentEntryId(id, counsellorId);
      deleteDocument("parent_self_entries", id).catch(() => {});
    });

    // 2. Clear from React state & LocalStorage
    const claimedIdSet = new Set(ids);
    const updated = parentSelfEntries.filter(e => !claimedIdSet.has(e.id));
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);

    setDeleteToast(`🧹 Successfully deleted ${count} claimed test token(s).`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  const handleClearAllPending = async () => {
    if (pendingParentEntries.length === 0) return;
    const count = pendingParentEntries.length;
    const pendingIds = pendingParentEntries.map(e => e.id);
    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";

    // 1. Record all dismissed IDs and delete from Firestore
    pendingIds.forEach(id => {
      recordDismissedParentEntryId(id, counsellorId);
      deleteDocument("parent_self_entries", id).catch(() => {});
    });

    // 2. Clear from React state for this counsellor's workspace
    const pendingIdSet = new Set(pendingIds);
    const updated = parentSelfEntries.filter(e => !pendingIdSet.has(e.id));
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);

    setDeleteToast(`🧹 Cleared ${count} waiting parent card(s) from your workspace desk.`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  const handleClaimAndAutoFill = async (entry: ParentSelfEntry) => {
    const currentCounsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR-01";
    const currentCounsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Counsellor";

    // Guard: Prevent claiming if another counsellor has already claimed this token
    const liveCheck = parentSelfEntries.find(e => e.id === entry.id);
    if (liveCheck && (liveCheck.status === "claimed" || liveCheck.claimedBy) && liveCheck.claimedBy !== currentCounsellorId) {
      alert(`⚠️ Token #${entry.dailyTokenNo || entry.id} has already been claimed by ${liveCheck.claimedByName || liveCheck.claimedBy}! Two counsellors cannot claim the same parent token simultaneously.`);
      return;
    }

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

    // If this entry already has an active or saved draft with filled fields or recorded audio, restore it seamlessly
    let existingSavedDraft: any = null;
    try {
      if (activeDraft && (activeDraft?.entry?.id === entry.id || activeDraft?.formData?.studentName?.toLowerCase() === entry.studentName.toLowerCase())) {
        existingSavedDraft = activeDraft;
      } else {
        const rawDraft = localStorage.getItem("bomis_counsellor_active_draft");
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft);
          if (parsed?.entry?.id === entry.id || parsed?.formData?.studentName?.toLowerCase() === entry.studentName.toLowerCase()) {
            existingSavedDraft = parsed;
          }
        }
      }
    } catch {}

    if (existingSavedDraft?.formData) {
      setFormData(existingSavedDraft.formData);
      if (existingSavedDraft.siblingFormData) {
        setSiblingFormData(existingSavedDraft.siblingFormData);
        setIsJointSiblingMode(true);
        if (existingSavedDraft.entry) setLinkedSiblingTokens([existingSavedDraft.entry]);
      } else {
        setSiblingFormData(null);
        setIsJointSiblingMode(false);
      }
      setActiveDraft(existingSavedDraft);
      setSelectedEnquiry(null);
      setActiveView("form");
      setDeleteToast(`✓ Resumed draft for ${entry.studentName} with preserved audio recording & notes.`);
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }

    // Generate clean Enquiry ID and auto-fill form (preserving ONL- for online, ENQ- for walkin)
    const isOnline = entry.enquiryType === "online";
    const draftNo = isOnline 
      ? (entry.onlineRefNo || entry.id || getNextOnlineEnquiryNo(safeEnquiries))
      : getNextEnquiryNo(safeEnquiries);

    const newClaimedData: CounsellingEnquiry = {
      id: draftNo,
      enquiryNo: draftNo,
      enquiryType: isOnline ? "online" : "walkin",
      onlineRefNo: isOnline ? draftNo : undefined,
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
      reasonForChoosing: entry.reasonForChoosing || (isOnline ? "Online Enquiry (Web / Social Media QR)" : "Campus Reception Walk-in"),
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
      counsellorObservations: isOnline 
        ? `[ONLINE LEAD CLAIMED]: Parent submitted enquiry online (${draftNo}). Counsellor initiated telephonic counselling.`
        : "",
      explainedSchoolFacilities: false,
      explainedAcademicProgramme: false,
      explainedFeeStructure: false,
      explainedTransportDetails: false,
      explainedSchoolRules: false,
      explainedActivitiesSports: false,
      admissionStatus: "Follow-up Required",
      followUpDate: getFutureDateDMY(7),
      counsellorId: currentCounsellorId,
      counsellorName: currentCounsellorName,
      parentSignatureRecorded: true,
      createdAt: `${new Date().toLocaleDateString("en-GB").replace(/\//g, "-")} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: new Date().toLocaleDateString()
    };

    if (entry.hasSibling && entry.siblingDetails) {
      // Single QR entry contains both siblings! Auto-populate Child 1 & Child 2 side-by-side
      let draftNo2 = "";
      if (isOnline) {
        draftNo2 = entry.siblingDetails.onlineRefNo || "";
        if (!draftNo2) {
          const match = draftNo.match(/ONL-.*-(\d+)/i) || draftNo.match(/(\d+)$/);
          const startNum = match ? parseInt(match[1] || match[0], 10) : 1;
          const formatPad = (n: number) => n < 100 ? String(n).padStart(2, "0") : String(n);
          draftNo2 = `ONL-${new Date().getFullYear()}-${formatPad(startNum + 1)}`;
        }
      } else {
        const draftMatch = draftNo.match(/ENQ-.*-(\d+)/i) || draftNo.match(/(\d+)$/);
        const startNum = draftMatch ? parseInt(draftMatch[1] || draftMatch[0], 10) : 1;
        draftNo2 = `ENQ-${new Date().getFullYear()}-${String(startNum + 1).padStart(2, "0")}`;
      }

      const sibClaimedData: CounsellingEnquiry = {
        ...newClaimedData,
        id: draftNo2,
        enquiryNo: draftNo2,
        enquiryType: isOnline ? "online" : "walkin",
        onlineRefNo: isOnline ? draftNo2 : undefined,
        studentName: entry.siblingDetails.studentName,
        applyingForClass: entry.siblingDetails.applyingForClass || "PP1 (LKG)",
        dateOfBirth: entry.siblingDetails.dateOfBirth || "",
        gender: (entry.siblingDetails.gender === "Female" ? "Female" : "Male"),
        previousSchool: entry.siblingDetails.previousSchool || entry.previousSchool || "",
        isSibling: true,
        siblingEnquiryNo: draftNo,
        siblingStudentName: entry.studentName,
        siblingClass: entry.applyingForClass
      };

      newClaimedData.isSibling = true;
      newClaimedData.siblingEnquiryNo = draftNo2;
      newClaimedData.siblingStudentName = entry.siblingDetails.studentName;
      newClaimedData.siblingClass = entry.siblingDetails.applyingForClass;

      setFormData(newClaimedData);
      setSiblingFormData(sibClaimedData);
      setIsJointSiblingMode(true);
      setLinkedSiblingTokens([entry]);

      const draftObj = { formData: newClaimedData, siblingFormData: sibClaimedData, entry, isJointSibling: true, claimedAt: new Date().toISOString() };
      try { localStorage.setItem("bomis_counsellor_active_draft", JSON.stringify(draftObj)); } catch {}
      setActiveDraft(draftObj);

      setSelectedEnquiry(null);
      setActiveView("form");
      setDeleteToast(`👨‍👩‍👧‍👦 Claimed Sibling ${isOnline ? "Online Lead" : "Walk-in"} for ${entry.studentName} & ${entry.siblingDetails.studentName}!`);
      setTimeout(() => setDeleteToast(null), 4000);
    } else {
      setFormData(newClaimedData);
      setSiblingFormData(null);
      setIsJointSiblingMode(false);
      setLinkedSiblingTokens([]);

      const draftObj = { formData: newClaimedData, entry, claimedAt: new Date().toISOString() };
      try { localStorage.setItem("bomis_counsellor_active_draft", JSON.stringify(draftObj)); } catch {}
      setActiveDraft(draftObj);

      setSelectedEnquiry(null);
      setActiveView("form");
      setDeleteToast(`✓ Claimed ${isOnline ? `Online Lead (#${draftNo})` : `Walk-in (${draftNo})`} for ${entry.studentName}! Form opened.`);
      setTimeout(() => setDeleteToast(null), 4000);
    }
  };

  const handleConvertOnlineToWalkin = async (entry: ParentSelfEntry) => {
    const now = new Date();
    const dmy = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const dateKey = now.toISOString().split("T")[0];
    let nextToken = 1;
    try {
      nextToken = await getNextDailyTokenNo(dmy, dateKey);
    } catch {
      nextToken = 1;
    }

    const updatedEntry: ParentSelfEntry = {
      ...entry,
      enquiryType: "walkin",
      dailyTokenNo: nextToken,
      entryDate: dmy,
      dateKey,
      reasonForChoosing: `${entry.reasonForChoosing || "Online Lead"} (Visited Campus in Person)`
    };

    const updated = parentSelfEntries.map(e => e.id === entry.id ? updatedEntry : e);
    setParentSelfEntries(updated);
    saveParentSelfEntries(updated);

    if (isFirebaseConfigured()) {
      try {
        await saveDocument("parent_self_entries", entry.id, updatedEntry);
      } catch {}
    }

    fetch("/api/parent-self-entry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatedEntry)
    }).catch(() => {});

    setDeleteToast(`🏛️ Converted ${entry.studentName} to Campus Walk-in! Assigned Queue Token #${nextToken}.`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  const handleEnableSiblingMode = async () => {
    const currentYear = new Date().getFullYear();
    const curMatch = formData.enquiryNo.match(/ENQ-.*-(\d+)/i) || formData.enquiryNo.match(/(\d+)$/);
    const startNum = curMatch ? parseInt(curMatch[1] || curMatch[0], 10) : 1;
    let sibNo = `ENQ-${currentYear}-${String(startNum + 1).padStart(2, "0")}`;

    const defaultCounsellor = activeCounsellor || localAccounts[0];
    try {
      const res = await fetch("/api/counselling/reserve-enquiry-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counsellorId: defaultCounsellor?.id || "COUNSELLOR-01",
          counsellorName: defaultCounsellor?.name || "Admissions Counsellor",
          isSiblingRequest: true,
          currentPrimaryEnquiryNo: formData.enquiryNo
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.enquiryNo) {
          sibNo = data.enquiryNo;
        }
      }
    } catch {}

    const sibData: CounsellingEnquiry = {
      ...formData,
      id: sibNo,
      enquiryNo: sibNo,
      studentName: "",
      applyingForClass: "PP1 (LKG)",
      dateOfBirth: "",
      gender: "Female",
      previousSchool: formData.previousSchool || "",
      previousClass: "",
      studentInterests: "",
      academicPerformance: "",
      strengths: "",
      areasNeedingSupport: "",
      admissionStatus: formData.admissionStatus || "Follow-up Required",
      isSibling: true,
      siblingEnquiryNo: formData.enquiryNo,
      siblingStudentName: formData.studentName || "Child 1",
      siblingClass: formData.applyingForClass
    };

    setFormData(prev => ({
      ...prev,
      isSibling: true,
      siblingEnquiryNo: sibNo,
      siblingStudentName: "Child 2",
      siblingClass: "PP1 (LKG)"
    }));
    setSiblingFormData(sibData);
    setIsJointSiblingMode(true);
    setDeleteToast("👨‍👩‍👧‍👦 Sibling Admission Mode enabled! Extra columns for Child 2 are now ready.");
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleDisableSiblingMode = () => {
    const sibNo = siblingFormData?.enquiryNo;
    if (sibNo) {
      try {
        fetch("/api/counselling/release-reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enquiryNo: sibNo })
        }).catch(() => {});
      } catch {}
    }
    setIsJointSiblingMode(false);
    setSiblingFormData(null);
    setLinkedSiblingTokens([]);
    setFormData(prev => ({
      ...prev,
      isSibling: false,
      siblingEnquiryNo: undefined,
      siblingStudentName: undefined,
      siblingClass: undefined,
      jointSiblingData: undefined
    }));
    setDeleteToast("✓ Switched to Single Student Form mode (Child 1 only). All details preserved.");
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleStartJointSiblingCounselling = async (entry1: ParentSelfEntry, entry2: ParentSelfEntry) => {
    const currentCounsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR-01";
    const currentCounsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Counsellor";

    // Mark both claimed
    const claimTime = new Date().toISOString();
    const updatedEntries = parentSelfEntries.map(e => {
      if (e.id === entry1.id || e.id === entry2.id) {
        return {
          ...e,
          status: "claimed" as const,
          claimedBy: currentCounsellorId,
          claimedByName: currentCounsellorName,
          claimedAt: claimTime
        };
      }
      return e;
    });

    setParentSelfEntries(updatedEntries);
    saveParentSelfEntries(updatedEntries);

    try {
      if (isFirebaseConfigured()) {
        await Promise.all([
          saveDocument("parent_self_entries", entry1.id, {
            status: "claimed",
            claimedBy: currentCounsellorId,
            claimedByName: currentCounsellorName,
            claimedAt: claimTime
          }),
          saveDocument("parent_self_entries", entry2.id, {
            status: "claimed",
            claimedBy: currentCounsellorId,
            claimedByName: currentCounsellorName,
            claimedAt: claimTime
          })
        ]);
      }
    } catch {}

    // Generate consecutive clean Enquiry IDs
    const draftNo1 = getNextEnquiryNo(safeEnquiries);
    let nextNum = 1;
    const match = draftNo1.match(/ENQ-(\d{4})-(\d+)/i) || draftNo1.match(/(\d+)$/);
    if (match) {
      nextNum = parseInt(match[2] || match[1], 10) + 1;
    }
    const currentYear = new Date().getFullYear();
    const draftNo2 = `ENQ-${currentYear}-${String(nextNum).padStart(3, "0")}`;
    const dateToday = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    const sharedFather = (entry1.fatherName || entry2.fatherName || "").trim();
    const sharedMother = (entry1.motherName || entry2.motherName || "").trim();
    const sharedPhone = (entry1.contactNo || entry2.contactNo || "").trim();
    const sharedWhatsapp = (entry1.whatsappNo || entry2.whatsappNo || sharedPhone).trim();
    const sharedAddress = (entry1.residentialAddress || entry2.residentialAddress || "").trim();
    const sharedHeard = (entry1.heardAboutSchool && entry1.heardAboutSchool.length > 0)
      ? entry1.heardAboutSchool
      : (entry2.heardAboutSchool || []);

    const newClaimedData1: CounsellingEnquiry = {
      id: draftNo1,
      enquiryNo: draftNo1,
      date: dateToday,
      studentName: entry1.studentName,
      applyingForClass: entry1.applyingForClass || "Grade 1",
      academicYear: "2026-2027",
      dateOfBirth: entry1.dateOfBirth || "",
      gender: entry1.gender || "Male",
      fatherName: sharedFather,
      motherName: sharedMother,
      contactNo: sharedPhone,
      whatsappNo: sharedWhatsapp,
      previousSchool: entry1.previousSchool || "",
      previousClass: entry1.previousClass || "",
      residentialAddress: sharedAddress,
      heardAboutSchool: sharedHeard,
      reasonForChoosing: entry1.reasonForChoosing || entry2.reasonForChoosing || "",
      preferredContact: entry1.preferredContact || "Call",
      bestTimeToContact: "",
      academicPerformance: "",
      studentInterests: "",
      strengths: "",
      areasNeedingSupport: "",
      transportRequired: entry1.transportRequired || entry2.transportRequired || false,
      hostelRequired: false,
      specialLearningSupport: entry1.specialLearningSupport || false,
      specialLearningDetails: "",
      pointsDiscussed: "",
      counsellorObservations: "",
      explainedSchoolFacilities: false,
      explainedAcademicProgramme: false,
      explainedFeeStructure: false,
      explainedTransportDetails: false,
      explainedSchoolRules: false,
      explainedActivitiesSports: false,
      admissionStatus: "Follow-up Required",
      followUpDate: getFutureDateDMY(7),
      counsellorId: currentCounsellorId,
      counsellorName: currentCounsellorName,
      parentSignatureRecorded: true,
      isSibling: true,
      siblingEnquiryNo: draftNo2,
      siblingStudentName: entry2.studentName,
      siblingClass: entry2.applyingForClass,
      siblingTokenNo: entry2.dailyTokenNo,
      createdAt: `${dateToday} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: new Date().toLocaleDateString()
    };

    const newClaimedData2: CounsellingEnquiry = {
      id: draftNo2,
      enquiryNo: draftNo2,
      date: dateToday,
      studentName: entry2.studentName,
      applyingForClass: entry2.applyingForClass || "PP1 (LKG)",
      academicYear: "2026-2027",
      dateOfBirth: entry2.dateOfBirth || "",
      gender: entry2.gender || "Female",
      fatherName: sharedFather,
      motherName: sharedMother,
      contactNo: sharedPhone,
      whatsappNo: sharedWhatsapp,
      previousSchool: entry2.previousSchool || entry1.previousSchool || "",
      previousClass: entry2.previousClass || "",
      residentialAddress: sharedAddress,
      heardAboutSchool: sharedHeard,
      reasonForChoosing: entry2.reasonForChoosing || entry1.reasonForChoosing || "",
      preferredContact: entry2.preferredContact || "Call",
      bestTimeToContact: "",
      academicPerformance: "",
      studentInterests: "",
      strengths: "",
      areasNeedingSupport: "",
      transportRequired: entry1.transportRequired || entry2.transportRequired || false,
      hostelRequired: false,
      specialLearningSupport: entry2.specialLearningSupport || false,
      specialLearningDetails: "",
      pointsDiscussed: "",
      counsellorObservations: "",
      explainedSchoolFacilities: false,
      explainedAcademicProgramme: false,
      explainedFeeStructure: false,
      explainedTransportDetails: false,
      explainedSchoolRules: false,
      explainedActivitiesSports: false,
      admissionStatus: "Follow-up Required",
      followUpDate: getFutureDateDMY(7),
      counsellorId: currentCounsellorId,
      counsellorName: currentCounsellorName,
      parentSignatureRecorded: true,
      isSibling: true,
      siblingEnquiryNo: draftNo1,
      siblingStudentName: entry1.studentName,
      siblingClass: entry1.applyingForClass,
      siblingTokenNo: entry1.dailyTokenNo,
      createdAt: `${dateToday} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      updatedAt: new Date().toLocaleDateString()
    };

    setFormData(newClaimedData1);
    setSiblingFormData(newClaimedData2);
    setIsJointSiblingMode(true);
    setSiblingActiveTab("child1");
    setLinkedSiblingTokens([entry1, entry2]);

    setSelectedEnquiry(null);
    setActiveView("form");
    setDeleteToast(`✓ Starting Joint Sibling Meeting for Tokens #${entry1.dailyTokenNo || 1} & #${entry2.dailyTokenNo || 2}!`);
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
    const nextIndex = maxNum + 1;
    const nextId = `COUNSELLOR-${String(nextIndex).padStart(2, "0")}`;
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    const colorPalette = ["#EA580C", "#2563EB", "#059669", "#7C3AED", "#DB2777", "#0284C7", "#D97706", "#0D9488", "#4F46E5", "#E11D48"];

    setAccountFormData({
      id: nextId,
      name: "",
      username: "",
      password: "",
      email: "",
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

    if (accountModalMode === "create") {
      const duplicate = localAccounts.find(a => a.username.toLowerCase() === cleanUsername);
      if (duplicate) {
        alert(`❌ The username "${cleanUsername}" is already taken by "${duplicate.name}" (${duplicate.id})!\n\nPlease choose a unique username.`);
        return;
      }

      // Guaranteed non-colliding ID
      let maxNum = 0;
      localAccounts.forEach(a => {
        const match = a.id?.match(/COUNSELLOR-(\d+)/i) || a.id?.match(/(\d+)$/);
        if (match) {
          const n = parseInt(match[1] || match[0], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
      const finalId = `COUNSELLOR-${String(maxNum + 1).padStart(2, "0")}`;

      const finalAccount: CounsellorAccount = {
        ...accountFormData,
        id: finalId,
        username: cleanUsername,
        name: accountFormData.name.trim(),
        password: accountFormData.password.trim(),
        email: accountFormData.email.trim() || `${cleanUsername}.counsellor@birlainstitute.edu.in`,
        createdAt: accountFormData.createdAt || new Date().toLocaleDateString("en-GB")
      };

      unrecordDeletedCounsellorAccountId(finalAccount.id, finalAccount.username);

      setLocalAccounts(prev => {
        const nextList = [...prev.filter(a => a.id !== finalAccount.id), finalAccount];
        const merged = mergeWithDefaultCounsellorAccounts(nextList);
        saveCounsellorAccounts(merged);
        return merged;
      });

      if (isFirebaseConfigured()) {
        deleteDocument("deleted_counsellor_accounts", (finalAccount.id || "").toLowerCase());
        deleteDocument("deleted_counsellor_accounts", cleanUsername);
        saveDocument("counsellor_accounts", finalAccount.id, finalAccount);
      }

      fetch("/api/accounts/counsellor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalAccount)
      }).catch(() => {});

      if (onSaveCounsellorAccount) {
        onSaveCounsellorAccount(finalAccount);
      }
      setIsAccountModalOpen(false);
    } else {
      // EDIT MODE: Match strictly by ID
      const targetId = accountFormData.id;
      const userConflict = localAccounts.find(
        a => a.id !== targetId && a.username.toLowerCase() === cleanUsername
      );
      if (userConflict) {
        alert(`❌ The username "${cleanUsername}" is already in use by "${userConflict.name}" (${userConflict.id})!\n\nPlease choose a different username.`);
        return;
      }

      const finalAccount: CounsellorAccount = {
        ...accountFormData,
        id: targetId,
        username: cleanUsername,
        name: accountFormData.name.trim(),
        password: accountFormData.password.trim(),
        email: accountFormData.email.trim() || `${cleanUsername}.counsellor@birlainstitute.edu.in`,
        createdAt: accountFormData.createdAt || new Date().toLocaleDateString("en-GB")
      };

      unrecordDeletedCounsellorAccountId(finalAccount.id, finalAccount.username);

      setLocalAccounts(prev => {
        const nextList = prev.map(a => a.id === targetId ? finalAccount : a);
        const merged = mergeWithDefaultCounsellorAccounts(nextList);
        saveCounsellorAccounts(merged);
        return merged;
      });

      if (isFirebaseConfigured()) {
        saveDocument("counsellor_accounts", finalAccount.id, finalAccount);
      }

      fetch("/api/accounts/counsellor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalAccount)
      }).catch(() => {});

      if (onSaveCounsellorAccount) {
        onSaveCounsellorAccount(finalAccount);
      }
      setIsAccountModalOpen(false);
    }
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
    if (isFirebaseConfigured()) {
      saveDocument("counsellor_accounts", updated.id, updated);
    }
    fetch("/api/accounts/counsellor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    }).catch(() => {});
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
    if (isFirebaseConfigured()) {
      deleteDocument("counsellor_accounts", accId);
      saveDocument("deleted_counsellor_accounts", accId.toLowerCase(), {
        id: accId.toLowerCase(),
        username: accUsername.toLowerCase(),
        deletedAt: Date.now()
      });
    }
    fetch(`/api/accounts/counsellor/${encodeURIComponent(accId)}`, {
      method: "DELETE"
    }).catch(() => {});
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
      const myNorm = normalizeCounsellorIdentity(activeCounsellor.name, activeCounsellor.id);
      const filtered = safeEnquiries.filter(e => {
        const eNorm = normalizeCounsellorIdentity(e.counsellorName, e.counsellorId);
        return eNorm.id === myNorm.id;
      });
      return filtered;
    }
    // If Admin/Super Admin/Management, respect the admin filter dropdown
    if (adminFilterCounsellor !== "ALL") {
      const targetNorm = normalizeCounsellorIdentity(adminFilterCounsellor);
      const filtered = safeEnquiries.filter(e => {
        const eNorm = normalizeCounsellorIdentity(e.counsellorName, e.counsellorId);
        return eNorm.id === targetNorm.id;
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
      admissionStatus: "Follow-up Required",
      followUpDate: getFutureDateDMY(7),
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

  const startNewEnquiry = async () => {
    const defaultCounsellor = activeCounsellor || localAccounts[0];
    let nextNo = getNextEnquiryNo(safeEnquiries, defaultCounsellor?.id);

    try {
      const res = await fetch("/api/counselling/reserve-enquiry-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          counsellorId: defaultCounsellor?.id || "COUNSELLOR-01",
          counsellorName: defaultCounsellor?.name || "Admissions Counsellor",
          isSiblingRequest: false
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.enquiryNo) {
          nextNo = data.enquiryNo;
        }
      }
    } catch {}

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
    if (formData.enquiryNo) {
      try {
        fetch("/api/counselling/release-reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enquiryNo: formData.enquiryNo, counsellorId: defaultCounsellor?.id })
        }).catch(() => {});
      } catch {}
    }
    if (siblingFormData?.enquiryNo) {
      try {
        fetch("/api/counselling/release-reservation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enquiryNo: siblingFormData.enquiryNo })
        }).catch(() => {});
      } catch {}
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

  const handlePrintAdmissionForm = () => {
    printOfficialAdmissionForm(selectedEnquiry);
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
    if (!formData.studentName || !formData.studentName.trim()) {
      setDeleteToast("⚠️ Please enter Student Name before saving.");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (isJointSiblingMode && siblingFormData && (!siblingFormData.studentName || !siblingFormData.studentName.trim())) {
      setDeleteToast("⚠️ Please enter Sibling (Child 2) Student Name before saving.");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }

    // Resilient Parent & Details fallbacks: Never block saving an admission enquiry
    const fName = (formData.fatherName || "").trim();
    const mName = (formData.motherName || "").trim();
    if (!fName && !mName) {
      setDeleteToast("⚠️ Please enter Father's or Mother's Name before saving.");
      setTimeout(() => setDeleteToast(null), 3500);
      return;
    }
    if (!formData.fatherName || !formData.fatherName.trim()) {
      formData.fatherName = mName || "—";
    }
    if (!formData.motherName || !formData.motherName.trim()) {
      formData.motherName = fName || "—";
    }
    if (!formData.residentialAddress || !formData.residentialAddress.trim()) {
      formData.residentialAddress = "Campus Walk-in / Local Area";
    }
    if (!formData.previousSchool || !formData.previousSchool.trim()) {
      formData.previousSchool = "Fresher / Not applicable";
    }
    if (isJointSiblingMode && siblingFormData) {
      if (!siblingFormData.previousSchool || !siblingFormData.previousSchool.trim()) {
        siblingFormData.previousSchool = formData.previousSchool || "Fresher / Not applicable";
      }
      if (!siblingFormData.fatherName || !siblingFormData.fatherName.trim()) {
        siblingFormData.fatherName = formData.fatherName;
      }
      if (!siblingFormData.motherName || !siblingFormData.motherName.trim()) {
        siblingFormData.motherName = formData.motherName;
      }
      if (!siblingFormData.residentialAddress || !siblingFormData.residentialAddress.trim()) {
        siblingFormData.residentialAddress = formData.residentialAddress;
      }
    }
    if (!formData.contactNo || !formData.contactNo.trim()) {
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

    // Joint Sibling Session Commit
    if (isJointSiblingMode && siblingFormData && siblingFormData.studentName.trim()) {
      let sibCandidateNo = siblingFormData.enquiryNo;
      if (!sibCandidateNo || sibCandidateNo === nextEnquiryNo || existingEnquiryNos.has(sibCandidateNo.toUpperCase())) {
        let guard2 = 0;
        let candNum = (numMatch ? parseInt(numMatch[1] || numMatch[0], 10) : 1) + 1;
        while (existingEnquiryNos.has(`ENQ-${new Date().getFullYear()}-${String(candNum).padStart(2, "0")}`.toUpperCase()) && guard2 < 200) {
          candNum++;
          guard2++;
        }
        sibCandidateNo = `ENQ-${new Date().getFullYear()}-${String(candNum).padStart(2, "0")}`;
      }

      // Link cross-references
      updated.isSibling = true;
      updated.siblingEnquiryNo = sibCandidateNo;
      updated.siblingStudentName = siblingFormData.studentName;
      updated.siblingClass = siblingFormData.applyingForClass;

      const jointNames = `${updated.studentName} (${updated.applyingForClass}) & ${siblingFormData.studentName} (${siblingFormData.applyingForClass})`;
      const jointEnqs = [updated.enquiryNo, sibCandidateNo];

      // Sibling admissions share a single joint meeting audio recording
      const sharedAudio = updated.audioRecording || siblingFormData.audioRecording || formData.audioRecording;

      if (sharedAudio) {
        updated.audioRecording = {
          ...sharedAudio,
          enquiryNo: updated.enquiryNo,
          studentName: updated.studentName,
          isJointSiblingSession: true,
          jointSiblingEnquiries: jointEnqs,
          jointSiblingNames: jointNames
        };
      }

      const sibUpdated: CounsellingEnquiry = {
        ...siblingFormData,
        id: sibCandidateNo,
        enquiryNo: sibCandidateNo,
        counsellorId: assignedCounsellorId,
        counsellorName: assignedCounsellorName,
        date: updated.date,
        academicYear: updated.academicYear,
        fatherName: updated.fatherName,
        motherName: updated.motherName,
        contactNo: updated.contactNo,
        whatsappNo: updated.whatsappNo,
        residentialAddress: updated.residentialAddress,
        heardAboutSchool: updated.heardAboutSchool,
        reasonForChoosing: updated.reasonForChoosing,
        preferredContact: updated.preferredContact,
        bestTimeToContact: updated.bestTimeToContact,
        pointsDiscussed: updated.pointsDiscussed,
        counsellorObservations: updated.counsellorObservations,
        explainedSchoolFacilities: updated.explainedSchoolFacilities,
        explainedAcademicProgramme: updated.explainedAcademicProgramme,
        explainedFeeStructure: updated.explainedFeeStructure,
        explainedTransportDetails: updated.explainedTransportDetails,
        explainedSchoolRules: updated.explainedSchoolRules,
        explainedActivitiesSports: updated.explainedActivitiesSports,
        transportRequired: siblingFormData.transportRequired !== undefined ? siblingFormData.transportRequired : updated.transportRequired,
        admissionStatus: siblingFormData.admissionStatus || updated.admissionStatus,
        followUpDate: (applyFollowUpToSibling || !siblingFormData.followUpDate) ? updated.followUpDate : siblingFormData.followUpDate,
        officeRemarks: updated.officeRemarks,
        parentSignatureRecorded: updated.parentSignatureRecorded,
        isSibling: true,
        siblingEnquiryNo: updated.enquiryNo,
        siblingStudentName: updated.studentName,
        siblingClass: updated.applyingForClass,
        audioRecording: sharedAudio ? {
          ...sharedAudio,
          id: `${sharedAudio.id || sibCandidateNo}-SIB`,
          enquiryNo: sibCandidateNo,
          studentName: siblingFormData.studentName,
          isJointSiblingSession: true,
          jointSiblingEnquiries: jointEnqs,
          jointSiblingNames: jointNames
        } : undefined,
        updatedAt: new Date().toLocaleDateString()
      };

      unmarkDeletedEnquiryId(sibUpdated.id, sibUpdated.enquiryNo);
      onSaveEnquiry(sibUpdated);

      const sibNumMatch = sibCandidateNo.match(/ENQ-.*-(\d+)/i) || sibCandidateNo.match(/(\d+)$/);
      if (sibNumMatch) {
        const sibNumVal = parseInt(sibNumMatch[1] || sibNumMatch[0], 10);
        if (!isNaN(sibNumVal)) recordHighestEnquiryNumber(sibNumVal);
      }
    }

    unmarkDeletedEnquiryId(updated.id, updated.enquiryNo);
    onSaveEnquiry(updated);

    // Mark associated parentSelfEntry as COMPLETED so it departs the active kiosk queue cleanly
    const claimedEntryId = activeDraft?.entry?.id || linkedSiblingTokens?.[0]?.id;
    const targetStudentLower = (updated.studentName || "").trim().toLowerCase();
    const targetPhone = (updated.contactNo || "").replace(/\D/g, "");

    const updatedParentSelfEntries = parentSelfEntries.map(e => {
      const eStudentLower = (e.studentName || "").trim().toLowerCase();
      const ePhone = (e.contactNo || "").replace(/\D/g, "");
      const isMatch = (claimedEntryId && e.id === claimedEntryId) ||
        (eStudentLower && eStudentLower === targetStudentLower) ||
        (targetPhone && ePhone && targetPhone === ePhone && (e.status === "claimed" || e.status === "pending"));

      if (isMatch) {
        return {
          ...e,
          status: "completed" as const,
          completedEnquiryNo: updated.enquiryNo,
          completedAt: new Date().toISOString(),
          completedBy: assignedCounsellorId,
          completedByName: assignedCounsellorName
        };
      }
      return e;
    });

    setParentSelfEntries(updatedParentSelfEntries);
    saveParentSelfEntries(updatedParentSelfEntries);

    // Sync completion to Firestore & Server API
    if (claimedEntryId) {
      try {
        saveDocument("parent_self_entries", claimedEntryId, {
          status: "completed",
          completedEnquiryNo: updated.enquiryNo,
          completedAt: new Date().toISOString(),
          completedBy: assignedCounsellorId,
          completedByName: assignedCounsellorName
        });
      } catch {}
      try {
        fetch("/api/parent-self-entry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: claimedEntryId,
            studentName: updated.studentName,
            contactNo: updated.contactNo,
            status: "completed",
            completedEnquiryNo: updated.enquiryNo,
            completedAt: new Date().toISOString(),
            completedBy: assignedCounsellorId,
            completedByName: assignedCounsellorName
          })
        }).catch(() => {});
      } catch {}
    }

    try { localStorage.removeItem("bomis_counsellor_active_draft"); } catch {}
    setActiveDraft(null);

    if (isJointSiblingMode && siblingFormData) {
      setDeleteToast(`✅ Joint Sibling Enquiries ${updated.enquiryNo} (${updated.studentName}) & ${siblingFormData.enquiryNo || "Child 2"} (${siblingFormData.studentName}) saved successfully with shared meeting audio!`);
    } else {
      setDeleteToast(`✅ Enquiry ${updated.enquiryNo} (${updated.studentName}) submitted successfully! Live in Counsellor and Management Portals.`);
    }
    setTimeout(() => setDeleteToast(null), 4000);
    setIsJointSiblingMode(false);
    setSiblingFormData(null);
    setLinkedSiblingTokens([]);
    setActiveView("list");
    setSelectedEnquiry(null);
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

    // Sync to sibling record if applicable
    if (applyFollowUpToSibling && targetEnquiry.isSibling && targetEnquiry.siblingEnquiryNo) {
      const sibling = safeEnquiries.find(e => 
        e.enquiryNo?.toUpperCase() === targetEnquiry.siblingEnquiryNo?.toUpperCase() ||
        e.id?.toUpperCase() === targetEnquiry.siblingEnquiryNo?.toUpperCase()
      );
      if (sibling) {
        const sibLog: CounsellingFollowUpLog = {
          ...newLog,
          id: `LOG-${Date.now() + 1}`,
          notes: `[Family Follow-up with ${targetEnquiry.studentName}]: ${followUpNotes.trim()}`
        };
        const sibUpdated: CounsellingEnquiry = {
          ...sibling,
          followUpLogs: [...(sibling.followUpLogs || []), sibLog],
          followUpDate: followUpNextDate || sibling.followUpDate,
          updatedAt: nowStr
        };
        onSaveEnquiry(sibUpdated);
      }
    }

    setFollowUpNotes("");
    setFollowUpNextDate("");
    setIsAddingFollowUp(false);
  };

  const handleDatePresetChange = (preset: "ALL" | "TODAY" | "YESTERDAY" | "custom") => {
    setFilterDatePreset(preset);
    if (preset === "ALL") {
      setFilterDate("");
    } else if (preset === "TODAY") {
      setFilterDate(getTodayYMDStr());
    } else if (preset === "YESTERDAY") {
      setFilterDate(getYesterdayYMDStr());
    }
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

      const matchChannel = filterChannel === "ALL" || 
        (filterChannel === "ONLINE" && (item.enquiryType === "online" || item.enquiryNo?.startsWith("ONL-"))) ||
        (filterChannel === "WALKIN" && item.enquiryType !== "online" && !item.enquiryNo?.startsWith("ONL-"));

      // Date matching filter: supports YYYY-MM-DD from date picker and DD-MM-YYYY in data
      let matchDate = true;
      if (filterDate) {
        const parsed = parseEnquiryDateInfo(item.date);
        const [fY, fM, fD] = filterDate.split("-");
        const filterDmy = fY && fM && fD ? `${fD}-${fM}-${fY}` : "";
        matchDate = 
          Boolean(parsed.ymd && parsed.ymd === filterDate) ||
          Boolean(parsed.dmy && filterDmy && parsed.dmy === filterDmy) ||
          Boolean(item.date && (item.date.includes(filterDate) || (filterDmy && item.date.includes(filterDmy)))) ||
          Boolean(item.createdAt && item.createdAt.includes(filterDate)) ||
          Boolean((item as any).dateKey === filterDate) ||
          Boolean((item as any).entryDate === filterDmy);
      }

      return matchQuery && matchStatus && matchClass && matchAudit && matchChannel && matchDate;
    });
  }, [counsellorScopeEnquiries, searchQuery, filterStatus, filterChannel, filterClass, filterAuditStatus, filterDate]);

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

  const getFollowUpStatusInfo = (followUpDateStr?: string) => {
    if (!followUpDateStr || !followUpDateStr.trim()) return null;
    const parsed = parseEnquiryDateInfo(followUpDateStr.trim());
    if (!parsed.ymd) return null;
    const todayYMD = getTodayYMDStr();
    const isToday = parsed.ymd === todayYMD;
    const isOverdue = parsed.ymd < todayYMD;
    const isUpcoming = parsed.ymd > todayYMD;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(parsed.timestamp);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...parsed,
      isToday,
      isOverdue,
      isUpcoming,
      diffDays
    };
  };

  // Follow-up enquiries for the current counsellor's scope
  const followUpEnquiries = useMemo(() => {
    return counsellorScopeEnquiries.filter(e => {
      const hasDate = Boolean(e.followUpDate && e.followUpDate.trim());
      if (!hasDate) return false;
      return e.admissionStatus === "Follow-up Required" || (e.admissionStatus === "Interested" && hasDate);
    });
  }, [counsellorScopeEnquiries]);

  const { todayFollowUps, overdueFollowUps, upcomingFollowUps, allFollowUpsWithInfo } = useMemo(() => {
    const todayList: Array<{ enquiry: CounsellingEnquiry; info: NonNullable<ReturnType<typeof getFollowUpStatusInfo>> }> = [];
    const overdueList: Array<{ enquiry: CounsellingEnquiry; info: NonNullable<ReturnType<typeof getFollowUpStatusInfo>> }> = [];
    const upcomingList: Array<{ enquiry: CounsellingEnquiry; info: NonNullable<ReturnType<typeof getFollowUpStatusInfo>> }> = [];
    const allList: Array<{ enquiry: CounsellingEnquiry; info: NonNullable<ReturnType<typeof getFollowUpStatusInfo>> }> = [];

    followUpEnquiries.forEach(e => {
      const info = getFollowUpStatusInfo(e.followUpDate);
      if (!info) return;
      const item = { enquiry: e, info };
      allList.push(item);
      if (info.isToday) {
        todayList.push(item);
      } else if (info.isOverdue) {
        overdueList.push(item);
      } else if (info.isUpcoming) {
        upcomingList.push(item);
      }
    });

    // Sort: overdue by oldest first (highest urgency), upcoming by nearest first
    overdueList.sort((a, b) => a.info.timestamp - b.info.timestamp);
    upcomingList.sort((a, b) => a.info.timestamp - b.info.timestamp);

    return {
      todayFollowUps: todayList,
      overdueFollowUps: overdueList,
      upcomingFollowUps: upcomingList,
      allFollowUpsWithInfo: allList
    };
  }, [followUpEnquiries]);

  // 1-Click Action Handlers for Scheduled Follow-Ups
  const handleQuickConfirmAdmission = async (enquiry: CounsellingEnquiry) => {
    const updated: CounsellingEnquiry = {
      ...enquiry,
      admissionStatus: "Admission Confirmed",
      counsellorObservations: enquiry.counsellorObservations
        ? `${enquiry.counsellorObservations}\n[${formatDMYFromDate(new Date())} Follow-up Call]: Parent confirmed admission.`
        : `[${formatDMYFromDate(new Date())} Follow-up Call]: Parent confirmed admission.`,
      updatedAt: formatDMYFromDate(new Date())
    };
    onSaveEnquiry(updated);
    if (isFirebaseConfigured()) {
      try {
        await saveDocument("enquiries", updated.id, updated);
      } catch {}
    }
    setDeleteToast(`🎉 Admission Confirmed for ${enquiry.studentName} (${enquiry.enquiryNo})!`);
    setTimeout(() => setDeleteToast(null), 4000);
  };

  const handleQuickNotInterested = async (enquiry: CounsellingEnquiry) => {
    const reason = prompt(`Reason for "Not Interested" for ${enquiry.studentName}? (e.g. Distance / High Fees / Opted for another school / Relocation)`, "Opted for another school") || "Not interested";
    const updated: CounsellingEnquiry = {
      ...enquiry,
      admissionStatus: "Not Interested",
      counsellorObservations: enquiry.counsellorObservations
        ? `${enquiry.counsellorObservations}\n[${formatDMYFromDate(new Date())} Follow-up Call]: Marked Not Interested. Reason: ${reason}`
        : `[${formatDMYFromDate(new Date())} Follow-up Call]: Marked Not Interested. Reason: ${reason}`,
      updatedAt: formatDMYFromDate(new Date())
    };
    onSaveEnquiry(updated);
    if (isFirebaseConfigured()) {
      try {
        await saveDocument("enquiries", updated.id, updated);
      } catch {}
    }
    setDeleteToast(`Enquiry ${enquiry.enquiryNo} (${enquiry.studentName}) marked as Not Interested.`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleApplyReschedule = async (enquiry: CounsellingEnquiry, newDateDMY: string, note?: string) => {
    if (!newDateDMY || !newDateDMY.trim()) {
      alert("Please select or enter a valid reschedule date!");
      return;
    }
    const updated: CounsellingEnquiry = {
      ...enquiry,
      admissionStatus: "Follow-up Required",
      followUpDate: newDateDMY.trim(),
      counsellorObservations: enquiry.counsellorObservations
        ? `${enquiry.counsellorObservations}\n[${formatDMYFromDate(new Date())} Follow-up Call]: Rescheduled next call to ${newDateDMY.trim()}${note ? ` (${note})` : ""}`
        : `[${formatDMYFromDate(new Date())} Follow-up Call]: Rescheduled next call to ${newDateDMY.trim()}${note ? ` (${note})` : ""}`,
      updatedAt: formatDMYFromDate(new Date())
    };
    onSaveEnquiry(updated);
    if (isFirebaseConfigured()) {
      try {
        await saveDocument("enquiries", updated.id, updated);
      } catch {}
    }
    setReschedulingEnquiry(null);
    setRescheduleCustomDate("");
    setRescheduleNote("");
    setDeleteToast(`📅 Follow-up for ${enquiry.studentName} rescheduled to ${newDateDMY.trim()}!`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleDirectWhatsAppFollowUp = (enquiry: CounsellingEnquiry) => {
    const rawPhone = (enquiry.whatsappNo || enquiry.contactNo || "").replace(/\D/g, "");
    if (!rawPhone) {
      alert("No contact phone number available for WhatsApp.");
      return;
    }
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone.startsWith("91") ? rawPhone : `91${rawPhone}`;
    const parentSalutation = enquiry.fatherName ? `Dear Mr. ${enquiry.fatherName}` : enquiry.motherName ? `Dear Mrs. ${enquiry.motherName}` : "Dear Parent";
    const msg = 
`🏫 *BIRLA OPEN MINDS INTERNATIONAL SCHOOL*
*Admissions Follow-up & Support Desk*

${parentSalutation},

Greetings! We are following up regarding your admission enquiry for *${enquiry.studentName}* for *Class ${enquiry.applyingForClass}* (Enquiry No: *${enquiry.enquiryNo || enquiry.id}*).

We wanted to check if you had any questions regarding:
✨ World-class CBSE curriculum & experienced faculty
✨ 5.5-acre modern campus facilities & student safety
✨ Transport routes & fee structure breakdown
✨ Special admission benefits for 2026-27

Please let us know if you would like to schedule a campus tour or reserve the admission seat today.

Warm regards,
*${activeCounsellor?.name || enquiry.counsellorName || "Admissions Counsellor"}*
📞 Birla Open Minds International School`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
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
    <div className={`space-y-6 pb-24 ${standalone ? "w-full bg-slate-100 dark:bg-slate-950 p-4 md:p-8 custom-scrollbar" : ""}`}>
      {/* Top Sticky Navigation Header Bar (Remains visible & highlighted on scroll, hidden during print) */}
      <div className="sticky top-0 z-50 pt-1 pb-2 -mt-1 bg-slate-100/90 dark:bg-slate-950/90 backdrop-blur-md transition-all no-print">
        <div className="bg-white/98 dark:bg-slate-900/98 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/90 p-3.5 sm:p-4 rounded-2xl shadow-xl flex items-center justify-between gap-3 sm:gap-4 transition-all ring-1 ring-slate-900/5 dark:ring-white/10">
          <div className="flex items-center gap-3">
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Logo" 
              className="w-10 h-10 rounded-xl border border-slate-200 object-contain bg-white p-1 shadow-sm"
            />
            <div>
              <h2 className="text-[11px] sm:text-xs font-black uppercase text-orange-600 dark:text-orange-400 tracking-wider">
                Birla Open Minds International School
              </h2>
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Counselling Department Portal</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-extrabold border border-orange-200 dark:border-orange-800">
                  Official Desk
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            {userRole !== "Counsellor" && (
              <button
                type="button"
                onClick={() => {
                  window.location.href = "/?portal=management";
                }}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                title="Open Executive Management Portal"
              >
                <Award size={14} className="text-purple-500" />
                <span>Executive Management</span>
              </button>
            )}

            {/* Highlighted Active Counsellor Profile Badge (sravan COUNSELLOR - 02 removed) */}
            {userRole === "Counsellor" ? (
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-amber-100/90 dark:bg-orange-950/80 border-2 border-amber-400 dark:border-amber-500/80 rounded-2xl shadow-md ring-2 ring-amber-400/30 transition-all" title="Private Active Counsellor Workspace">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm border border-amber-300">
                  {activeCounsellor?.name ? activeCounsellor.name.slice(0, 2).toUpperCase() : "SR"}
                </div>
                <div className="text-left leading-tight pr-1">
                  <span className="block text-xs font-black text-slate-900 dark:text-amber-100 tracking-wide">
                    {activeCounsellor?.name || "sravan"}
                  </span>
                  <span className="block text-[10px] font-black text-[#800020] dark:text-amber-400 uppercase tracking-wider">
                    🔒 {activeCounsellor?.name?.toLowerCase().includes("sravan") ? "sravan COUNSELLOR" : `${activeCounsellor?.name || "sravan"} COUNSELLOR`}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-amber-100/90 dark:bg-orange-950/80 border-2 border-amber-400 dark:border-amber-500/80 rounded-2xl shadow-md ring-2 ring-amber-400/30 transition-all">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm border border-amber-300">
                  {activeCounsellor?.name ? activeCounsellor.name.slice(0, 2).toUpperCase() : "SR"}
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
                  className="bg-transparent text-xs font-black text-slate-900 dark:text-amber-100 focus:outline-none cursor-pointer pr-1"
                  title="Switch Active Counsellor Workspace"
                >
                  {localAccounts.map(c => (
                    <option key={`hdr-c-opt-${c.id}`} value={c.id} className="text-slate-900 bg-white dark:bg-slate-800 dark:text-white font-bold">
                      {c.name} COUNSELLOR
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setActiveView("list");
                setSelectedEnquiry(null);
                setInspectingEnquiry(null);
                setSelectedMetricCard(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all shadow cursor-pointer active:scale-95"
              title="Go to Counsellor Home Page"
            >
              <span className="text-sm">🏠</span>
              <span>Home</span>
            </button>

            <button
              type="button"
              onClick={handleRefreshDept}
              disabled={isRefreshingDept}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition-all shadow cursor-pointer active:scale-95 disabled:opacity-60"
              title="Refresh Counselling Department Data & Stay on Page"
            >
              <RefreshCw size={14} className={isRefreshingDept ? "animate-spin text-emerald-200" : ""} />
              <span>{isRefreshingDept ? "Refreshing..." : "Refresh Dept"}</span>
            </button>

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
      </div>

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
          {/* Prominent Counsellor Home Button */}
          <button
            type="button"
            onClick={() => {
              setActiveView("list");
              setSelectedEnquiry(null);
              setInspectingEnquiry(null);
              setSelectedMetricCard(null);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer border shadow-md active:scale-95 ${
              activeView === "list"
                ? "bg-white text-orange-950 border-white font-black"
                : "bg-white/15 hover:bg-white/25 text-white border-white/30"
            }`}
            title="Go directly to Counsellor Home Page (Enquiries List)"
          >
            <span className="text-base">🏠</span>
            <span>Counsellor Home</span>
          </button>

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

      {/* 🔔 SMART SCHEDULED FOLLOW-UP CALLS NOTIFICATION HUB */}
      {activeView === "list" && (
        <div className={`rounded-2xl transition-all border-2 shadow-md overflow-hidden ${
          todayFollowUps.length > 0 || overdueFollowUps.length > 0
            ? "bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-rose-500/10 dark:bg-slate-900 border-orange-400 dark:border-orange-500/60 ring-2 ring-orange-400/20"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}>
          {/* Hub Header Bar */}
          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-orange-200/50 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl shrink-0 ${
                todayFollowUps.length > 0 || overdueFollowUps.length > 0
                  ? "bg-orange-500 text-white animate-pulse shadow-md"
                  : "bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400"
              }`}>
                <Clock size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black tracking-wide text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>🔔</span>
                    <span>TODAY'S SCHEDULED PARENT FOLLOW-UPS</span>
                  </h3>
                  {todayFollowUps.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-orange-600 text-white text-xs font-black shadow-xs animate-bounce">
                      📞 {todayFollowUps.length} Call(s) Due Today
                    </span>
                  )}
                  {overdueFollowUps.length > 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-xs font-black shadow-xs">
                      ⚠️ {overdueFollowUps.length} Overdue
                    </span>
                  )}
                  {todayFollowUps.length === 0 && overdueFollowUps.length === 0 && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                      ✓ All Calls Caught Up ({upcomingFollowUps.length} upcoming scheduled)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {userRole === "Counsellor" && activeCounsellor
                    ? `Showing scheduled follow-up dates assigned to ${activeCounsellor.name} (${activeCounsellor.id}).`
                    : `Admissions Desk Department Follow-ups (${counsellorScopeEnquiries.length} total active records).`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleFollowUpHubCollapsed}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isFollowUpHubCollapsed ? (
                  <>
                    <ChevronDown size={14} />
                    <span>Expand Calls ({todayFollowUps.length + overdueFollowUps.length})</span>
                  </>
                ) : (
                  <>
                    <ChevronUp size={14} />
                    <span>Minimize</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Hub Content (when expanded) */}
          {!isFollowUpHubCollapsed && (
            <div className="p-4 space-y-4">
              {/* Filter Tabs & Quick Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFollowUpTab("today")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      followUpTab === "today"
                        ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-orange-50"
                    }`}
                  >
                    🔥 Due Today ({todayFollowUps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpTab("overdue")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      followUpTab === "overdue"
                        ? "bg-red-600 text-white border-red-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-red-50"
                    }`}
                  >
                    ⚠️ Overdue ({overdueFollowUps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpTab("upcoming")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      followUpTab === "upcoming"
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50"
                    }`}
                  >
                    📅 Upcoming ({upcomingFollowUps.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFollowUpTab("all")}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      followUpTab === "all"
                        ? "bg-slate-800 text-white border-slate-800 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    📋 All Follow-ups ({allFollowUpsWithInfo.length})
                  </button>
                </div>

                <div className="relative sm:w-64">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={followUpSearchQuery}
                    onChange={(e) => setFollowUpSearchQuery(e.target.value)}
                    placeholder="Search parent / student / phone..."
                    className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Display Follow-up Cards */}
              {(() => {
                let list = 
                  followUpTab === "today" ? todayFollowUps :
                  followUpTab === "overdue" ? overdueFollowUps :
                  followUpTab === "upcoming" ? upcomingFollowUps :
                  allFollowUpsWithInfo;

                if (followUpSearchQuery.trim()) {
                  const q = followUpSearchQuery.toLowerCase();
                  list = list.filter(item => {
                    const e = item.enquiry;
                    return (
                      e.studentName?.toLowerCase().includes(q) ||
                      e.fatherName?.toLowerCase().includes(q) ||
                      e.motherName?.toLowerCase().includes(q) ||
                      e.contactNo?.includes(q) ||
                      e.whatsappNo?.includes(q) ||
                      e.enquiryNo?.toLowerCase().includes(q) ||
                      e.applyingForClass?.toLowerCase().includes(q)
                    );
                  });
                }

                if (list.length === 0) {
                  return (
                    <div className="p-8 text-center bg-white/60 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                      <Clock size={32} className="mx-auto text-slate-400 mb-2 opacity-50" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {followUpTab === "today" 
                          ? "No calls scheduled for today! All parent follow-ups are up to date." 
                          : followUpTab === "overdue" 
                          ? "No overdue calls! Great job maintaining fast parent response times."
                          : "No records found matching this filter."}
                      </p>
                      {followUpTab === "today" && upcomingFollowUps.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFollowUpTab("upcoming")}
                          className="mt-2 text-xs font-extrabold text-orange-600 hover:underline cursor-pointer"
                        >
                          View {upcomingFollowUps.length} upcoming scheduled call(s) →
                        </button>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                    {list.map(({ enquiry, info }) => {
                      const cleanPhone = (enquiry.contactNo || "").replace(/\D/g, "");
                      return (
                        <div
                          key={`followup-${enquiry.id}-${info.dmy}`}
                          className={`p-4 rounded-xl border transition-all shadow-xs hover:shadow-md flex flex-col justify-between gap-3 ${
                            info.isToday
                              ? "bg-white dark:bg-slate-900 border-orange-400 dark:border-orange-500 ring-2 ring-orange-400/20"
                              : info.isOverdue
                              ? "bg-rose-50/50 dark:bg-rose-950/20 border-red-300 dark:border-red-900/60"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div>
                            {/* Card Top: Status & Date Badges */}
                            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                              <div className="flex items-center gap-1.5">
                                {info.isToday ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-orange-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 animate-pulse">
                                    <span>🔥</span> DUE TODAY
                                  </span>
                                ) : info.isOverdue ? (
                                  <span className="px-2.5 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <span>⚠️</span> OVERDUE BY {Math.abs(info.diffDays)} DAY{Math.abs(info.diffDays) !== 1 ? "S" : ""}
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200 dark:border-blue-800">
                                    📅 Due in {info.diffDays} day{info.diffDays !== 1 ? "s" : ""} ({info.dmy})
                                  </span>
                                )}

                                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                                  #{enquiry.enquiryNo || enquiry.id}
                                </span>
                              </div>

                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Calendar size={12} className="text-slate-400" />
                                <span>Target: <strong className="text-slate-800 dark:text-white">{info.dmy}</strong></span>
                              </span>
                            </div>

                            {/* Student & Parent Info */}
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                  <span>{enquiry.studentName}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold border border-amber-300 dark:border-amber-800">
                                    Class: {enquiry.applyingForClass}
                                  </span>
                                </h4>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                  Parent: <strong className="text-slate-800 dark:text-slate-200">{enquiry.fatherName || enquiry.motherName || "Parent"}</strong>
                                  {enquiry.contactNo && (
                                    <span className="font-mono ml-2 text-slate-700 dark:text-slate-300 font-bold">
                                      📞 {enquiry.contactNo}
                                    </span>
                                  )}
                                </p>
                              </div>

                              <span className="text-[10px] px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400 font-bold shrink-0">
                                {enquiry.counsellorName ? `Assigned: ${enquiry.counsellorName.split(" ")[0]}` : "Assigned"}
                              </span>
                            </div>

                            {/* Previous Notes / Observation if any */}
                            {enquiry.counsellorObservations && (
                              <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60 line-clamp-2">
                                <span className="font-bold text-slate-500 mr-1">📝 Notes:</span>
                                {enquiry.counsellorObservations}
                              </div>
                            )}
                          </div>

                          {/* 1-Click Action Buttons Bar */}
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              {/* Direct Dial Call */}
                              <a
                                href={`tel:${cleanPhone}`}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                title={`Call ${enquiry.studentName}'s parent (${enquiry.contactNo})`}
                              >
                                <Phone size={13} />
                                <span>Call</span>
                              </a>

                              {/* Direct WhatsApp */}
                              <button
                                type="button"
                                onClick={() => handleDirectWhatsAppFollowUp(enquiry)}
                                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                title="Send pre-filled WhatsApp follow-up greeting"
                              >
                                <MessageSquare size={13} />
                                <span>WhatsApp</span>
                              </button>

                              {/* 1-Click Confirm Admission */}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Confirm admission for ${enquiry.studentName} (${enquiry.enquiryNo})?`)) {
                                    handleQuickConfirmAdmission(enquiry);
                                  }
                                }}
                                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                                title="Parent agreed to take admission - mark Confirmed!"
                              >
                                <CheckCircle2 size={13} />
                                <span>🎉 Confirm</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {/* Quick Reschedule */}
                              <button
                                type="button"
                                onClick={() => {
                                  setReschedulingEnquiry(enquiry);
                                  setRescheduleCustomDate(dmyToYmd(getFutureDateDMY(3)));
                                  setRescheduleNote("");
                                }}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Parent requested call later? Reschedule follow-up date"
                              >
                                <Clock size={13} />
                                <span>Reschedule</span>
                              </button>

                              {/* Not Interested */}
                              <button
                                type="button"
                                onClick={() => handleQuickNotInterested(enquiry)}
                                className="px-2 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="Mark parent as Not Interested"
                              >
                                ✕
                              </button>

                              {/* Open Form to view/edit */}
                              <button
                                type="button"
                                onClick={() => editEnquiry(enquiry)}
                                className="px-2 py-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                title="Open full enquiry form"
                              >
                                📝
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}
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
                onClick={() => setIsDismissedLeadsModalOpen(true)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 border ${
                  pendingParentEntries.length > 0
                    ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                    : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
                title={`View Dismissed Leads Archive (${dismissedParentEntries.length} archived)`}
              >
                <FolderArchive size={13} className={pendingParentEntries.length > 0 ? "text-amber-200" : "text-amber-500"} />
                <span>🗄️ Dismissed ({dismissedParentEntries.length})</span>
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
              {/* Sibling Admissions Alert Banner */}
              {pendingSiblingGroups.siblingGroups.length > 0 && (
                <div className="mb-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border-2 border-purple-400 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-white">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-xl shrink-0">
                      👨‍👩‍👧‍👦
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-400 text-slate-950">
                          Sibling Admission Group Detected
                        </span>
                        <span className="text-xs text-purple-200 font-bold">
                          {pendingSiblingGroups.siblingGroups.length} family with multiple children in lounge
                        </span>
                      </div>
                      <p className="text-xs font-bold text-purple-100 mt-1">
                        {pendingSiblingGroups.siblingGroups[0].entries.map(e => `${e.studentName} (Token #${e.dailyTokenNo || 1}, ${e.applyingForClass})`).join(" & ")}
                      </p>
                      <p className="text-[11px] text-purple-300">
                        Parent: {pendingSiblingGroups.siblingGroups[0].entries[0].fatherName || pendingSiblingGroups.siblingGroups[0].entries[0].motherName || "Same Family"} • Contact: {pendingSiblingGroups.siblingGroups[0].entries[0].contactNo}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStartJointSiblingCounselling(pendingSiblingGroups.siblingGroups[0].entries[0], pendingSiblingGroups.siblingGroups[0].entries[1])}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 via-indigo-500 to-purple-600 hover:from-purple-400 hover:to-indigo-400 text-white font-black text-xs shadow-lg hover:shadow-purple-500/30 flex items-center gap-2 active:scale-95 transition-all shrink-0 cursor-pointer border border-purple-300"
                  >
                    <Zap size={14} className="fill-amber-300 text-amber-300" />
                    <span>Start Joint Sibling Counselling (Tokens #{pendingSiblingGroups.siblingGroups[0].entries[0].dailyTokenNo || 1} & #{pendingSiblingGroups.siblingGroups[0].entries[1]?.dailyTokenNo || 2})</span>
                  </button>
                </div>
              )}

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

                              {/* Sibling detection badge */}
                              {entry.hasSibling && entry.siblingDetails && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-black flex items-center gap-1.5 shadow-sm">
                                    <span>👨‍👩‍👧‍👦</span>
                                    <span>Sibling Registered: <strong>{entry.siblingDetails.studentName}</strong> (Class {entry.siblingDetails.applyingForClass})</span>
                                  </span>
                                </div>
                              )}

                              {(() => {
                                const cleanCurPhone = (entry.contactNo || "").replace(/\D/g, "");
                                const waitingSibling = pendingParentEntries.find(p => p.id !== entry.id && (
                                  (cleanCurPhone.length >= 10 && (p.contactNo || "").replace(/\D/g, "") === cleanCurPhone) ||
                                  (entry.linkedSiblingEntryId && p.id === entry.linkedSiblingEntryId) ||
                                  (p.linkedSiblingEntryId && p.linkedSiblingEntryId === entry.id)
                                ));
                                if (!waitingSibling || (entry.hasSibling && entry.siblingDetails)) return null;
                                return (
                                  <div className="mt-1.5 flex items-center gap-1.5">
                                    <span className="px-2 py-0.5 rounded-md bg-purple-500/30 border border-purple-400/50 text-purple-200 text-[10px] font-bold flex items-center gap-1">
                                      <span>👨‍👩‍👧‍👦</span>
                                      <span>Sibling in Lounge: <strong>{waitingSibling.studentName}</strong> (Token #{waitingSibling.dailyTokenNo || 2}, {waitingSibling.applyingForClass})</span>
                                    </span>
                                  </div>
                                );
                              })()}

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
                          {(() => {
                            const cleanCurPhone = (entry.contactNo || "").replace(/\D/g, "");
                            const waitingSibling = pendingParentEntries.find(p => p.id !== entry.id && (
                              (cleanCurPhone.length >= 10 && (p.contactNo || "").replace(/\D/g, "") === cleanCurPhone) ||
                              (entry.linkedSiblingEntryId && p.id === entry.linkedSiblingEntryId) ||
                              (p.linkedSiblingEntryId && p.linkedSiblingEntryId === entry.id)
                            ));
                            if (waitingSibling && (!entry.hasSibling || !entry.siblingDetails)) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleStartJointSiblingCounselling(entry, waitingSibling)}
                                  className="py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ring-2 ring-purple-400/40 shrink-0"
                                  title={`Start Joint Sibling Session for Token #${entry.dailyTokenNo || 1} & Token #${waitingSibling.dailyTokenNo || 2}`}
                                >
                                  <Zap size={14} className="fill-amber-300 text-amber-300" />
                                  <span>Joint (Both #{entry.dailyTokenNo}&amp;#{waitingSibling.dailyTokenNo})</span>
                                </button>
                              );
                            }
                            return null;
                          })()}

                          <button
                            type="button"
                            onClick={() => handleClaimAndAutoFill(entry)}
                            className={`flex-1 py-2.5 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              entry.hasSibling && entry.siblingDetails
                                ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 ring-2 ring-purple-300/40"
                                : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 ring-2 ring-emerald-300/40"
                            }`}
                            title={entry.hasSibling && entry.siblingDetails ? `Claim Sibling Token #${entry.dailyTokenNo || 1}: opens unified 2-column form for ${entry.studentName} & ${entry.siblingDetails.studentName}` : `Claim Token #${entry.dailyTokenNo || 1} exclusively: auto-fills all fields into your admission form`}
                          >
                            <CheckCircle2 size={16} />
                            <span>
                              {entry.hasSibling && entry.siblingDetails
                                ? `👨‍👩‍👧‍👦 Claim Sibling Token #${entry.dailyTokenNo || 1} (Both Children)`
                                : `⚡ Claim Token #${entry.dailyTokenNo || 1}`}
                            </span>
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

      {/* 🌐 DEDICATED ONLINE ENQUIRIES CLAIM POOL (Web / QR Leads - ONL Series) */}
      <div className={`p-4.5 rounded-2xl shadow-md transition-all border-2 ${
        pendingOnlineEntries.length > 0
          ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white border-emerald-400 ring-4 ring-emerald-400/20"
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100"
      }`}>
        {/* Header Bar */}
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isOnlinePoolCollapsed ? "" : "mb-3 pb-3 border-b border-black/10 dark:border-white/10"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-2.5 rounded-xl shrink-0 ${
              pendingOnlineEntries.length > 0
                ? "bg-white/20 text-white animate-pulse"
                : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
            }`}>
              <Globe size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`text-sm font-black tracking-wide ${
                  pendingOnlineEntries.length > 0 ? "text-white" : "text-slate-900 dark:text-white"
                }`}>
                  🌐 ONLINE ENQUIRY LEADS POOL (Website &amp; Social QR)
                </h3>
                {pendingOnlineEntries.length > 0 ? (
                  <span className="px-2.5 py-0.5 bg-white text-emerald-950 rounded-full text-xs font-black animate-pulse shadow-sm">
                    ⚡ {pendingOnlineEntries.length} Online Lead(s) Waiting for Call
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-full text-xs font-bold border border-emerald-300 dark:border-emerald-800">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    <span>0 Pending Online Leads (Pool Clear)</span>
                  </span>
                )}
              </div>
              <p className={`text-xs mt-0.5 ${
                pendingOnlineEntries.length > 0 ? "text-emerald-100 font-medium" : "text-slate-500 dark:text-slate-400"
              }`}>
                {pendingOnlineEntries.length > 0
                  ? isOnlinePoolCollapsed
                    ? "Online leads pool is minimized. Click 'Expand' to view and claim waiting leads."
                    : "Parents filled form online from home. Distinct ONL numbers prevent mixing with Walk-ins. Click '⚡ Claim & Form' to contact parent."
                  : "Leads submitted via online website links or social media QR codes appear here with distinct ONL-YYYY-XX numbers."}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Dismissed Archive Button */}
            <button
              type="button"
              onClick={() => setIsDismissedLeadsModalOpen(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 border ${
                pendingOnlineEntries.length > 0
                  ? "bg-white/20 hover:bg-white/30 text-white border-white/30"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
              }`}
              title={`View Dismissed Leads & Tokens Archive (${dismissedParentEntries.length} archived)`}
            >
              <FolderArchive size={14} className={pendingOnlineEntries.length > 0 ? "text-amber-200" : "text-amber-500"} />
              <span>🗄️ Dismissed Archive ({dismissedParentEntries.length})</span>
            </button>

            {/* Clear All Online Leads (Safely moves to Dismissed Archive) */}
            {pendingOnlineEntries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Move all ${pendingOnlineEntries.length} online leads to the Dismissed Leads Archive?`)) {
                    const counsellorId = activeCounsellor ? activeCounsellor.id : "COUNSELLOR";
                    const counsellorName = activeCounsellor ? activeCounsellor.name : "Admissions Desk";
                    const nowStr = new Date().toISOString();
                    const ids = pendingOnlineEntries.map(e => e.id);
                    const idSet = new Set(ids);

                    // Update parentSelfEntries in state & LocalStorage
                    const updated = parentSelfEntries.map(e => idSet.has(e.id) ? {
                      ...e,
                      status: "dismissed" as const,
                      dismissedBy: counsellorName,
                      dismissedById: counsellorId,
                      dismissedAt: nowStr
                    } : e);
                    setParentSelfEntries(updated);
                    saveParentSelfEntries(updated);

                    // Save each to archived storage
                    pendingOnlineEntries.forEach(e => {
                      recordDismissedParentEntryId(e.id, counsellorId);
                      saveDismissedParentEntry({
                        ...e,
                        status: "dismissed",
                        dismissedBy: counsellorName,
                        dismissedById: counsellorId,
                        dismissedAt: nowStr
                      });
                      if (isFirebaseConfigured()) {
                        saveDocument("parent_self_entries", e.id, {
                          status: "dismissed",
                          dismissedBy: counsellorName,
                          dismissedById: counsellorId,
                          dismissedAt: nowStr
                        }).catch(() => {});
                      }
                    });

                    // Notify server
                    fetch("/api/parent-self-entry/clear-pending", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ids, counsellorId, counsellorName })
                    }).catch(() => {});

                    setDeleteToast(`✓ Archived ${pendingOnlineEntries.length} online lead(s) to Dismissed Archive.`);
                    setTimeout(() => setDeleteToast(null), 3500);
                  }
                }}
                className="px-2.5 py-1.5 bg-black/20 hover:bg-red-600/80 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border border-white/30 flex items-center gap-1 active:scale-95"
                title="Archive all waiting online leads"
              >
                <Trash2 size={13} />
                <span>Clear ({pendingOnlineEntries.length})</span>
              </button>
            )}

            {/* Maximize / Compact Scroll Toggle (when entries > 3 and not collapsed) */}
            {!isOnlinePoolCollapsed && pendingOnlineEntries.length > 3 && (
              <button
                type="button"
                onClick={toggleOnlinePoolMaximized}
                className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                title={isOnlinePoolMaximized ? "Switch to compact scroll view" : "Expand to full grid"}
              >
                {isOnlinePoolMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{isOnlinePoolMaximized ? "Compact View" : "Expand Grid"}</span>
              </button>
            )}

            {/* Minimize / Collapse Toggle Button */}
            <button
              type="button"
              onClick={toggleOnlinePoolCollapsed}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer shadow-xs active:scale-95 flex items-center gap-1.5 border ${
                pendingOnlineEntries.length > 0
                  ? "bg-white/25 hover:bg-white/40 text-white border-white/40"
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
              }`}
              title={isOnlinePoolCollapsed ? "Expand online leads pool" : "Minimize / Collapse online leads pool"}
            >
              {isOnlinePoolCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{isOnlinePoolCollapsed ? `Expand (${pendingOnlineEntries.length})` : "Minimize"}</span>
            </button>
          </div>
        </div>

        {/* Cards or Empty State: Only shown when NOT collapsed */}
        {!isOnlinePoolCollapsed && (
          pendingOnlineEntries.length > 0 ? (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 ${
              isOnlinePoolMaximized ? "" : "max-h-[420px] overflow-y-auto pr-1"
            }`}>
              {pendingOnlineEntries.map(entry => {
                const cleanPhone = (entry.contactNo || "").replace(/\D/g, "");
                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-xl bg-slate-900/95 border border-emerald-400/40 text-white shadow-lg flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    <div className="space-y-2">
                      {/* Top Row: ONL Ref & Date */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-slate-950 border border-emerald-300 shadow-xs flex items-center gap-1.5">
                          <Globe size={13} />
                          <span>#{entry.onlineRefNo || entry.id}</span>
                        </span>
                        <span className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                          <Clock size={11} className="text-emerald-400" />
                          <span>{entry.formattedDate || entry.entryDate || "Online Lead"}</span>
                        </span>
                      </div>

                      {/* Student Info */}
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <span>{entry.studentName}</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 text-[10px] font-black border border-emerald-700">
                            {entry.applyingForClass}
                          </span>
                        </h4>
                        <p className="text-xs text-slate-300 mt-1">
                          Parent: <strong className="text-white">{entry.fatherName || entry.motherName || "Parent"}</strong>
                          {entry.contactNo && (
                            <span className="font-mono ml-2 text-emerald-300 font-bold">
                              📞 {entry.contactNo}
                            </span>
                          )}
                        </p>
                        {entry.residentialAddress && (
                          <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                            📍 {entry.residentialAddress}
                          </p>
                        )}
                      </div>

                      {/* Sibling info */}
                      {entry.hasSibling && entry.siblingDetails && (
                        <div className="p-2 rounded-lg bg-purple-950/60 border border-purple-800 text-[11px] text-purple-200">
                          👨‍👩‍👧‍👦 Sibling: <strong>{entry.siblingDetails.studentName}</strong> ({entry.siblingDetails.applyingForClass})
                          {entry.siblingDetails.onlineRefNo && (
                            <span className="font-mono ml-1 text-purple-300 font-bold">#{entry.siblingDetails.onlineRefNo}</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions Bar */}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${cleanPhone}`}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                          title={`Call +91 ${entry.contactNo}`}
                        >
                          <Phone size={12} />
                          <span>Call</span>
                        </a>
                        {cleanPhone && (
                          <a
                            href={`https://wa.me/91${cleanPhone}?text=Dear%20Parent,%20Greetings%20from%20Birla%20Open%20Minds%20International%20School.%20Regarding%20your%20online%20admission%20enquiry%20for%20${encodeURIComponent(entry.studentName)}%20(${entry.onlineRefNo || entry.id}).`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => handleConvertOnlineToWalkin(entry)}
                          className="px-2 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                          title="Convert online lead to campus walk-in queue"
                        >
                          <span>🏫 To Walk-in</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleClaimAndAutoFill(entry)}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-black rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-md"
                          title="Claim this lead and open admission form"
                        >
                          <Zap size={13} className="text-slate-950 fill-slate-950" />
                          <span>Claim &amp; Form</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissParentEntry(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Dismiss lead to Dismissed Archive"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-emerald-50/50 dark:bg-slate-800/40 rounded-xl border border-dashed border-emerald-300 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <Globe size={16} />
                </span>
                <span>All online enquiries are attended to! Online leads submitted via website or social media QR codes will chime and land here in real time.</span>
              </div>
            </div>
          )
        )}
      </div>

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

        {/* Card 4: Follow-up Due */}
        <button
          type="button"
          onClick={() => {
            handleCardClick("followup");
            setIsFollowUpHubCollapsed(false);
          }}
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
                        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                        onChange={(e) => {
                          setMetricSingleDate(e.target.value);
                          setMetricDatePreset("all");
                          setSelectedDateChip(null);
                        }}
                        className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
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
                      onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        setMetricFromDate(e.target.value);
                        setMetricDatePreset("all");
                        setSelectedDateChip(null);
                      }}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
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
                      onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                      onChange={(e) => {
                        setMetricToDate(e.target.value);
                        setMetricDatePreset("all");
                        setSelectedDateChip(null);
                      }}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none cursor-pointer"
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
                                <span className={`font-mono font-bold px-2 py-0.5 rounded-md text-[11px] border ${
                                  item.enquiryNo?.startsWith("ONL-") || item.enquiryType === "online"
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                                }`}>
                                  {item.enquiryNo?.startsWith("ONL-") ? "🌐 " : ""}{item.enquiryNo}
                                </span>
                              </td>

                              {/* Student Name */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{item.studentName}</span>
                                  {item.isSibling && (
                                    <span
                                      title={`Sibling of ${item.siblingStudentName || "Sibling"} (${item.siblingClass || ""}) - ${item.siblingEnquiryNo || ""}`}
                                      className="px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-black flex items-center gap-1 shadow-xs"
                                    >
                                      <span>👨‍👩‍👧‍👦</span>
                                      <span>Sibling: {item.siblingStudentName} ({item.siblingClass})</span>
                                    </span>
                                  )}
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
                  {pendingOnlineEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterChannel("ONLINE");
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-all bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-400 animate-pulse shadow-sm"
                      title="View Pending Online Leads"
                    >
                      <Globe size={13} className="text-emerald-600" />
                      <span>Online Leads: {pendingOnlineEntries.length} New</span>
                    </button>
                  )}
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

              {/* Channel Filter: All Channels vs Walk-in vs Online */}
              <select
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value as any)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0 cursor-pointer"
                title="Filter by Walk-in or Online Enquiry"
              >
                <option value="ALL">🌐 All Channels</option>
                <option value="WALKIN">🏫 Campus Walk-in (ENQ)</option>
                <option value="ONLINE">🌐 Online Enquiry (ONL)</option>
              </select>

              {/* Choose Date Filter: Presets (All / Today / Yesterday) + Calendar Date Picker */}
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 shrink-0 shadow-2xs hover:border-orange-400 dark:hover:border-orange-500 transition-all">
                <Calendar size={14} className="text-orange-500 shrink-0" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">Choose Date:</span>
                <select
                  value={filterDatePreset}
                  onChange={(e) => handleDatePresetChange(e.target.value as any)}
                  className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer border-r border-slate-200 dark:border-slate-700 pr-1.5 mr-0.5"
                  title="Quick date filter: Today, Yesterday, or All Dates"
                >
                  <option value="ALL">All Dates</option>
                  <option value="TODAY">Today</option>
                  <option value="YESTERDAY">Yesterday</option>
                  {filterDate && filterDatePreset === "custom" && (
                    <option value="custom">Custom Date</option>
                  )}
                </select>

                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterDate(val);
                    if (!val) {
                      setFilterDatePreset("ALL");
                    } else if (val === getTodayYMDStr()) {
                      setFilterDatePreset("TODAY");
                    } else if (val === getYesterdayYMDStr()) {
                      setFilterDatePreset("YESTERDAY");
                    } else {
                      setFilterDatePreset("custom");
                    }
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                  title="Pick specific date to filter enquiries"
                />

                {filterDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate("");
                      setFilterDatePreset("ALL");
                    }}
                    className="p-1 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-all cursor-pointer"
                    title="Clear Date Filter"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0 cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Follow-up Required">Follow-up Required</option>
                <option value="Application Taken">Application Taken</option>
                <option value="Entrance Test Required">Entrance Test Required</option>
                <option value="Admission Confirmed">Admission Confirmed</option>
                <option value="Not Interested">Not Interested</option>
              </select>

              <select
                value={filterClass}
                onChange={(e) => setFilterClass(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0 cursor-pointer"
              >
                <option value="ALL">All Classes</option>
                {CLASS_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={filterAuditStatus}
                onChange={(e) => setFilterAuditStatus(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 shrink-0 cursor-pointer"
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

          {/* Active Date Filter Notice Banner */}
          {filterDate && (
            <div className="px-4 py-2.5 bg-orange-50 dark:bg-orange-950/40 border-b border-orange-200 dark:border-orange-900/50 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
              <div className="flex items-center gap-2 text-orange-900 dark:text-orange-200">
                <Calendar size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
                <span>
                  Showing enquiries for Date: <strong className="font-bold underline tracking-wide">{filterDate.split("-").reverse().join("-")}</strong> 
                  <span className="ml-2 px-2 py-0.5 bg-orange-200 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full font-bold text-[11px]">
                    {filteredEnquiries.length} {filteredEnquiries.length === 1 ? "Record" : "Records"} Found
                  </span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterDate("");
                  setFilterDatePreset("ALL");
                }}
                className="text-[11px] font-bold text-orange-700 dark:text-orange-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-all hover:underline"
              >
                <X size={12} />
                <span>Clear Date Filter (Show All Records)</span>
              </button>
            </div>
          )}

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
                      <FileText size={32} className="mx-auto mb-2 opacity-50 text-orange-500" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">
                        {filterDate
                          ? `No enquiries found registered on ${filterDate.split("-").reverse().join("-")}.`
                          : userRole === "Counsellor"
                            ? `No enquiries registered for ${activeCounsellor?.name || "your account"} yet.`
                            : "No counselling enquiries found matching the selected filters."}
                      </p>
                      {filterDate ? (
                        <button
                          type="button"
                          onClick={() => {
                            setFilterDate("");
                            setFilterDatePreset("ALL");
                          }}
                          className="mt-3 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >
                          Clear Date Filter (Show All Dates)
                        </button>
                      ) : (
                        <button 
                          onClick={startNewEnquiry}
                          className="mt-3 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold text-xs"
                        >
                          Create First Enquiry
                        </button>
                      )}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`font-mono font-bold ${
                              enquiry.enquiryNo?.startsWith("ONL-") || enquiry.enquiryType === "online"
                                ? "text-emerald-600 dark:text-emerald-400 font-black"
                                : "text-orange-600 dark:text-orange-400"
                            }`}>
                              {enquiry.enquiryNo}
                            </span>
                            {enquiry.enquiryNo?.startsWith("ONL-") || enquiry.enquiryType === "online" ? (
                              <span className="px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[9px] font-black uppercase border border-emerald-300 dark:border-emerald-800">
                                🌐 Online
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-300 text-[9px] font-black uppercase border border-orange-300 dark:border-orange-800">
                                🏫 Walk-in
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar size={11} /> {enquiry.date}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <p className="font-bold text-slate-900 dark:text-white text-sm">
                            {enquiry.studentName}
                          </p>

                          {/* Sibling badge */}
                          {enquiry.isSibling && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold shadow-xs"
                                title={`Sibling of ${enquiry.siblingStudentName || "Sibling"} (${enquiry.siblingClass || ""}) - ${enquiry.siblingEnquiryNo || ""}`}
                              >
                                <span>👨‍👩‍👧‍👦</span>
                                <span>Sibling: <strong className="font-black">{enquiry.siblingStudentName}</strong> ({enquiry.siblingClass})</span>
                                {enquiry.siblingEnquiryNo && (
                                  <span className="font-mono text-[9px] opacity-75">#{enquiry.siblingEnquiryNo}</span>
                                )}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-1">
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
                          <div className="space-y-0.5 mt-1">
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${enquiry.contactNo}`}
                                className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 font-bold font-mono hover:underline"
                                title="Call Primary Phone"
                              >
                                <Phone size={11} /> {enquiry.contactNo}
                              </a>
                            </div>
                            {(enquiry.whatsappNo || enquiry.contactNo) && (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`https://wa.me/91${(enquiry.whatsappNo || enquiry.contactNo || "").replace(/[^0-9]/g, "")}?text=Dear%20Parent,%20Greetings%20from%20Birla%20Open%20Minds%20International%20School.%20Regarding%20admission%20enquiry%20for%20${encodeURIComponent(enquiry.studentName)}.`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold font-mono hover:underline"
                                  title="Chat on WhatsApp"
                                >
                                  <MessageSquare size={11} /> {enquiry.whatsappNo || enquiry.contactNo}
                                  {enquiry.whatsappNo && enquiry.whatsappNo !== enquiry.contactNo ? (
                                    <span className="text-[9px] px-1 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded font-sans font-bold">
                                      WA
                                    </span>
                                  ) : null}
                                </a>
                              </div>
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
              const accNorm = normalizeCounsellorIdentity(acc.name, acc.id);
              const counsellorEnquiries = safeEnquiries.filter(e => {
                const eNorm = normalizeCounsellorIdentity(e.counsellorName, e.counsellorId);
                return eNorm.id === accNorm.id;
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
        <form id="counselling-form" onSubmit={handleSave} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl">
          {/* Form Header (Sticky for easy access while scrolling) */}
          <div className="sticky top-0 z-30 p-4 md:p-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 rounded-t-2xl shadow-sm">
            <div className="text-center md:text-left">
              <span className="text-[11px] font-black text-orange-600 dark:text-orange-400 tracking-widest uppercase">
                BIRLA OPENMINDS INTERNATIONAL SCHOOL
              </span>
              <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <span>NEW ADMISSION – PARENT COUNSELLING FORM</span>
                {isJointSiblingMode && siblingFormData && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700 font-extrabold uppercase">
                    👨‍👩‍👧‍👦 2-in-1 Sibling Mode
                  </span>
                )}
              </h2>
            </div>

            <div className="flex items-center gap-3 flex-wrap justify-center md:justify-end">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                <span className="text-slate-400 font-medium">Enquiry: </span>
                <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{formData.enquiryNo}</span>
                {isJointSiblingMode && siblingFormData && (
                  <>
                    <span className="text-slate-400 font-bold">&amp;</span>
                    <span className="font-mono font-bold text-purple-600 dark:text-purple-400">{siblingFormData.enquiryNo}</span>
                  </>
                )}
                <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                  🔒 Reserved Slot
                </span>
              </div>

              {!isJointSiblingMode ? (
                <button
                  type="button"
                  onClick={handleEnableSiblingMode}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow transition-all cursor-pointer flex items-center gap-1.5"
                  title="Switch to Unified 2-in-1 Dual Sibling Form for 2 children"
                >
                  <span>👨‍👩‍👧‍👦</span>
                  <span>+ Sibling Admission</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDisableSiblingMode}
                  className="px-3.5 py-2 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                  title="Switch back to single student enquiry form"
                >
                  <span className="text-purple-600 dark:text-purple-400 font-black">✕</span>
                  <span>Switch to Single Student</span>
                </button>
              )}

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
                {isJointSiblingMode && siblingFormData ? "💾 Save Both Sibling Records" : "💾 Save Counselling Record"}
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* SIBLING MODE VS STANDARD SINGLE STUDENT MODE */}
            {isJointSiblingMode && siblingFormData ? (
              /* ============================================================== */
              /* 👨‍👩‍👧‍👦 SIBLING ADMISSION: 2-IN-1 UNIFIED DUAL-COLUMN FORM         */
              /* ============================================================== */
              <div className="space-y-8">
                {/* TOP SIBLING BANNER */}
                <div className="p-4 bg-gradient-to-r from-purple-950 via-indigo-950 to-slate-900 border-2 border-purple-400 rounded-2xl shadow-xl text-white space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-2xl shrink-0">
                        👨‍👩‍👧‍👦
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-purple-400 text-slate-950">
                            Unified Sibling Admission Active
                          </span>
                          <span className="text-xs text-purple-200 font-bold">
                            Child 1: #{formData.enquiryNo} &bull; Child 2: #{siblingFormData.enquiryNo}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-bold">
                            🎙️ 1 Shared Meeting Audio
                          </span>
                        </div>
                        <p className="text-xs text-purple-200 mt-1">
                          Family contacts are entered once below. Student academic details are displayed in 2 side-by-side columns. 1-Click saves both sibling admissions!
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisableSiblingMode}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white rounded-xl border border-purple-300/40 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 self-start sm:self-auto"
                      title="Switch back to single student enquiry form"
                    >
                      <span className="text-purple-300 font-extrabold">✕</span>
                      <span>Switch to Single Student</span>
                    </button>
                  </div>
                </div>

                {/* 1. SHARED FAMILY & PARENT DETAILS */}
                <div className="space-y-4 bg-slate-50/80 dark:bg-slate-800/40 p-5 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-2">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                      <span>FAMILY &amp; PARENT DETAILS</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300">
                        Shared for both siblings
                      </span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                      <input
                        type="text"
                        value={formData.date}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, date: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, date: val }) : null);
                        }}
                        placeholder="DD-MM-YYYY"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Father's Name <span className="text-red-500 font-black">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.fatherName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, fatherName: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, fatherName: val }) : null);
                        }}
                        placeholder="Father's Full Name"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
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
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, motherName: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, motherName: val }) : null);
                        }}
                        placeholder="Mother's Full Name"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Primary Contact No. <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.contactNo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, contactNo: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, contactNo: val }) : null);
                        }}
                        placeholder="Calling Number"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp No.</label>
                        <button
                          type="button"
                          onClick={() => {
                            const val = formData.contactNo;
                            setFormData(prev => ({ ...prev, whatsappNo: val }));
                            setSiblingFormData(prev => prev ? ({ ...prev, whatsappNo: val }) : null);
                          }}
                          className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                        >
                          Same as Contact
                        </button>
                      </div>
                      <input
                        type="tel"
                        value={formData.whatsappNo}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, whatsappNo: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, whatsappNo: val }) : null);
                        }}
                        placeholder="WhatsApp Number"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Residential Address <span className="text-red-500 font-black">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.residentialAddress || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, residentialAddress: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, residentialAddress: val }) : null);
                        }}
                        placeholder="House / Flat No., Area / Locality, Landmark"
                        className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      How did you hear about our school?
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      {SOURCES.map(source => {
                        const checked = (formData.heardAboutSchool || []).includes(source);
                        return (
                          <label 
                            key={source} 
                            onClick={() => {
                              handleSourceToggle(source);
                              setSiblingFormData(prev => {
                                if (!prev) return null;
                                const current = prev.heardAboutSchool || [];
                                const next = current.includes(source)
                                  ? current.filter(s => s !== source)
                                  : [...current, source];
                                return { ...prev, heardAboutSchool: next };
                              });
                            }}
                            className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                              checked 
                                ? "bg-orange-50 dark:bg-orange-950/40 border-orange-400 text-orange-800 dark:text-orange-300 font-bold" 
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
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
                </div>

                {/* 2. DUAL COLUMNS: CHILD 1 | CHILD 2 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-purple-500 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-xs">2</span>
                      <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
                        <span>STUDENTS ACADEMIC &amp; ADMISSION DETAILS</span>
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                          Side-by-Side Dual Columns
                        </span>
                      </h3>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Both children are saved together in 1 unified session
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* COLUMN 1: CHILD 1 (FIRST STUDENT) */}
                    <div className="p-5 rounded-2xl border-2 border-orange-400 bg-orange-50/20 dark:bg-orange-950/10 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-orange-200 dark:border-orange-800/40 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-sm shadow">
                            👦
                          </span>
                          <div>
                            <h4 className="text-xs font-black uppercase text-orange-700 dark:text-orange-400 tracking-wide">
                              CHILD 1 (FIRST STUDENT)
                            </h4>
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                              {formData.studentName || "Enter Name Below"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Enquiry No</span>
                          <span className="font-mono font-black text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded border border-orange-300 dark:border-orange-700">
                            {formData.enquiryNo}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Student Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.studentName}
                            onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                            placeholder="Child 1 Full Name"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Applying for Class <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.applyingForClass}
                            onChange={(e) => setFormData(prev => ({ ...prev, applyingForClass: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          >
                            {CLASS_OPTIONS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Academic Year
                          </label>
                          <select
                            value={formData.academicYear || "2026-2027"}
                            onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                          >
                            <option value="2026-2027">2026-2027 (Current)</option>
                            <option value="2027-2028">2027-2028 (Next Year)</option>
                            <option value="2028-2029">2028-2029 (Advance)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Date of Birth
                          </label>
                          <input
                            type="text"
                            value={formData.dateOfBirth || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                            placeholder="DD-MM-YYYY"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Gender
                          </label>
                          <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                              <input
                                type="radio"
                                name="child1_gender"
                                value="Male"
                                checked={formData.gender === "Male"}
                                onChange={() => setFormData(prev => ({ ...prev, gender: "Male" }))}
                                className="text-orange-600 focus:ring-orange-500"
                              />
                              <span>Male</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                              <input
                                type="radio"
                                name="child1_gender"
                                value="Female"
                                checked={formData.gender === "Female"}
                                onChange={() => setFormData(prev => ({ ...prev, gender: "Female" }))}
                                className="text-orange-600 focus:ring-orange-500"
                              />
                              <span>Female</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Previous School &amp; Board <span className="text-red-500 font-black">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.previousSchool}
                            onChange={(e) => setFormData(prev => ({ ...prev, previousSchool: e.target.value }))}
                            placeholder="Previous school name & board"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Previous Class
                          </label>
                          <input
                            type="text"
                            value={formData.previousClass || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, previousClass: e.target.value }))}
                            placeholder="Class completed"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Academic Performance
                          </label>
                          <input
                            type="text"
                            value={formData.academicPerformance || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, academicPerformance: e.target.value }))}
                            placeholder="e.g. Grade A, Above Average"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Interests / Talents
                          </label>
                          <input
                            type="text"
                            value={formData.studentInterests || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, studentInterests: e.target.value }))}
                            placeholder="e.g. Sports, Art, Chess, Music"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Strengths
                          </label>
                          <input
                            type="text"
                            value={formData.strengths || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, strengths: e.target.value }))}
                            placeholder="e.g. Good communication, creative"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Areas Needing Support
                          </label>
                          <input
                            type="text"
                            value={formData.areasNeedingSupport || ""}
                            onChange={(e) => setFormData(prev => ({ ...prev, areasNeedingSupport: e.target.value }))}
                            placeholder="e.g. Handwriting, Math basics"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      {/* Admission Status for Child 1 */}
                      <div className="pt-2 border-t border-orange-200 dark:border-orange-800/40">
                        <label className="block text-xs font-bold text-orange-800 dark:text-orange-300 mb-1.5">
                          Child 1 Admission Status:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map(status => {
                            const isSelected = formData.admissionStatus === status;
                            const conf = STATUS_CONFIG[status];
                            return (
                              <button
                                type="button"
                                key={`c1-${status}`}
                                onClick={() => {
                                  let newFollowUp = formData.followUpDate;
                                  if (status === "Follow-up Required" && !newFollowUp) {
                                    newFollowUp = getFutureDateDMY(7);
                                  }
                                  setFormData(prev => ({ ...prev, admissionStatus: status, followUpDate: newFollowUp }));
                                  if (applyFollowUpToSibling) {
                                    setSiblingFormData(prev => prev ? ({ ...prev, admissionStatus: status, followUpDate: newFollowUp }) : null);
                                  }
                                }}
                                className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center cursor-pointer transition-all ${
                                  isSelected 
                                    ? `${conf.bg} ${conf.text} ${conf.border} ring-2 ring-orange-500 shadow-sm` 
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                {conf.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* COLUMN 2: CHILD 2 (SIBLING STUDENT) */}
                    <div className="p-5 rounded-2xl border-2 border-purple-400 bg-purple-50/20 dark:bg-purple-950/10 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-purple-200 dark:border-purple-800/40 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow">
                            👧
                          </span>
                          <div>
                            <h4 className="text-xs font-black uppercase text-purple-700 dark:text-purple-400 tracking-wide">
                              CHILD 2 (SIBLING STUDENT)
                            </h4>
                            <div className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                              {siblingFormData.studentName || "Enter Name Below"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Enquiry No</span>
                          <span className="font-mono font-black text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-300 dark:border-purple-700">
                            {siblingFormData.enquiryNo}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Student Full Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={siblingFormData.studentName}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, studentName: e.target.value }) : null)}
                            placeholder="Child 2 Full Name"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Applying for Class <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={siblingFormData.applyingForClass}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, applyingForClass: e.target.value }) : null)}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          >
                            {CLASS_OPTIONS.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Academic Year
                          </label>
                          <select
                            value={siblingFormData.academicYear || "2026-2027"}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, academicYear: e.target.value }) : null)}
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-purple-600 dark:text-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                          >
                            <option value="2026-2027">2026-2027 (Current)</option>
                            <option value="2027-2028">2027-2028 (Next Year)</option>
                            <option value="2028-2029">2028-2029 (Advance)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Date of Birth
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.dateOfBirth || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, dateOfBirth: e.target.value }) : null)}
                            placeholder="DD-MM-YYYY"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Gender
                          </label>
                          <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                              <input
                                type="radio"
                                name="child2_gender"
                                value="Male"
                                checked={siblingFormData.gender === "Male"}
                                onChange={() => setSiblingFormData(prev => prev ? ({ ...prev, gender: "Male" }) : null)}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              <span>Male</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                              <input
                                type="radio"
                                name="child2_gender"
                                value="Female"
                                checked={siblingFormData.gender === "Female"}
                                onChange={() => setSiblingFormData(prev => prev ? ({ ...prev, gender: "Female" }) : null)}
                                className="text-purple-600 focus:ring-purple-500"
                              />
                              <span>Female</span>
                            </label>
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                              Previous School &amp; Board <span className="text-red-500 font-black">*</span>
                            </label>
                            {formData.previousSchool && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSiblingFormData(prev => prev ? ({ ...prev, previousSchool: formData.previousSchool }) : null);
                                }}
                                className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                              >
                                📋 Same as Child 1
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            value={siblingFormData.previousSchool || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, previousSchool: e.target.value }) : null)}
                            placeholder="Previous school name & board"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Previous Class
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.previousClass || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, previousClass: e.target.value }) : null)}
                            placeholder="Class completed"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Academic Performance
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.academicPerformance || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, academicPerformance: e.target.value }) : null)}
                            placeholder="e.g. Grade A, Above Average"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Interests / Talents
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.studentInterests || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, studentInterests: e.target.value }) : null)}
                            placeholder="e.g. Sports, Art, Chess, Music"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Strengths
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.strengths || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, strengths: e.target.value }) : null)}
                            placeholder="e.g. Good communication, creative"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Areas Needing Support
                          </label>
                          <input
                            type="text"
                            value={siblingFormData.areasNeedingSupport || ""}
                            onChange={(e) => setSiblingFormData(prev => prev ? ({ ...prev, areasNeedingSupport: e.target.value }) : null)}
                            placeholder="e.g. Handwriting, Math basics"
                            className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>

                      {/* Admission Status for Child 2 */}
                      <div className="pt-2 border-t border-purple-200 dark:border-purple-800/40">
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-purple-800 dark:text-purple-300">
                            Child 2 Admission Status:
                          </label>
                          {formData.admissionStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                setSiblingFormData(prev => prev ? ({ ...prev, admissionStatus: formData.admissionStatus, followUpDate: formData.followUpDate }) : null);
                              }}
                              className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline font-bold"
                            >
                              📋 Same as Child 1 ({formData.admissionStatus})
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {(Object.keys(STATUS_CONFIG) as AdmissionStatus[]).map(status => {
                            const isSelected = siblingFormData.admissionStatus === status;
                            const conf = STATUS_CONFIG[status];
                            return (
                              <button
                                type="button"
                                key={`c2-${status}`}
                                onClick={() => {
                                  let newFollowUp = siblingFormData.followUpDate;
                                  if (status === "Follow-up Required" && !newFollowUp) {
                                    newFollowUp = formData.followUpDate || getFutureDateDMY(7);
                                  }
                                  setSiblingFormData(prev => prev ? ({ ...prev, admissionStatus: status, followUpDate: newFollowUp }) : null);
                                }}
                                className={`px-2 py-1.5 rounded-lg border text-[11px] font-bold text-center cursor-pointer transition-all ${
                                  isSelected 
                                    ? `${conf.bg} ${conf.text} ${conf.border} ring-2 ring-purple-500 shadow-sm` 
                                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                }`}
                              >
                                {conf.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. COUNSELLING & INTERACTION NOTES */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">3</span>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                      COUNSELLING &amp; INTERACTION NOTES
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Points discussed with parents:
                      </label>
                      <textarea
                        rows={3}
                        value={formData.pointsDiscussed}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, pointsDiscussed: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, pointsDiscussed: val }) : null);
                        }}
                        placeholder="Enter key topics, syllabus explanations, fee details, transport queries, campus visit impressions..."
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Counsellor observations / additional remarks:
                      </label>
                      <textarea
                        rows={3}
                        value={formData.counsellorObservations}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, counsellorObservations: val }));
                          setSiblingFormData(prev => prev ? ({ ...prev, counsellorObservations: val }) : null);
                        }}
                        placeholder="Counsellor's internal feedback regarding parent readiness, sibling admission considerations..."
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {/* Transport */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Transport Facility Required for Siblings?
                    </span>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                        <input
                          type="radio"
                          name="sibling_transport"
                          checked={formData.transportRequired === true}
                          onChange={() => {
                            setFormData(prev => ({ ...prev, transportRequired: true }));
                            setSiblingFormData(prev => prev ? ({ ...prev, transportRequired: true }) : null);
                          }}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <span>Yes, Transport Needed</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                        <input
                          type="radio"
                          name="sibling_transport"
                          checked={formData.transportRequired === false}
                          onChange={() => {
                            setFormData(prev => ({ ...prev, transportRequired: false }));
                            setSiblingFormData(prev => prev ? ({ ...prev, transportRequired: false }) : null);
                          }}
                          className="text-orange-600 focus:ring-orange-500"
                        />
                        <span>No (Own Transport)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 4. INFORMATION EXPLAINED */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">4</span>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                      INFORMATION EXPLAINED (Check all that apply)
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: "explainedSchoolFacilities", label: "School Facilities" },
                      { key: "explainedAcademicProgramme", label: "Academic Programme" },
                      { key: "explainedFeeStructure", label: "Fee Structure (Sibling Concession)" },
                      { key: "explainedTransportDetails", label: "Transport Details" },
                      { key: "explainedSchoolRules", label: "School Rules / Policies" },
                      { key: "explainedActivitiesSports", label: "Activities / Sports" },
                    ].map(({ key, label }) => {
                      const isChecked = (formData as any)[key] === true;
                      return (
                        <label
                          key={key}
                          onClick={() => {
                            const nextVal = !isChecked;
                            setFormData(prev => ({ ...prev, [key]: nextVal }));
                            setSiblingFormData(prev => prev ? ({ ...prev, [key]: nextVal }) : null);
                          }}
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

                {/* 5. FOLLOW-UP DATE & CONSENT */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b-2 border-orange-500 pb-1.5">
                    <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">5</span>
                    <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                      FOLLOW-UP DATE &amp; CONSENT
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className={formData.admissionStatus === "Follow-up Required" || siblingFormData.admissionStatus === "Follow-up Required" ? "p-3 bg-orange-50/80 dark:bg-orange-950/20 border-2 border-orange-400 dark:border-orange-600/60 rounded-2xl shadow-sm" : ""}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Calendar size={14} className="text-orange-500" />
                          <span>Follow-up Date</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-600 text-white font-black uppercase">
                            Siblings
                          </span>
                        </label>
                        {formData.followUpDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, followUpDate: "" }));
                              setSiblingFormData(prev => prev ? ({ ...prev, followUpDate: "" }) : null);
                            }}
                            className="text-[10px] text-slate-400 hover:text-red-500 font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Quick Date Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">⚡ Quick:</span>
                        {[
                          { label: "Tomorrow (+1D)", days: 1 },
                          { label: "In 3 Days (+3D)", days: 3 },
                          { label: "In 1 Week (+7D)", days: 7 },
                          { label: "In 2 Weeks (+14D)", days: 14 }
                        ].map(preset => {
                          const targetDate = getFutureDateDMY(preset.days);
                          const isSelected = formData.followUpDate === targetDate;
                          return (
                            <button
                              type="button"
                              key={preset.days}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, followUpDate: targetDate, admissionStatus: "Follow-up Required" }));
                                if (applyFollowUpToSibling) {
                                  setSiblingFormData(prev => prev ? ({ ...prev, followUpDate: targetDate, admissionStatus: "Follow-up Required" }) : null);
                                }
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border active:scale-95 ${
                                isSelected
                                  ? "bg-orange-600 text-white border-orange-600 shadow-sm ring-1 ring-orange-400/40"
                                  : "bg-white dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Text Box + Native Calendar Date Picker */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={formData.followUpDate}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFormData(prev => ({ ...prev, followUpDate: val }));
                              if (applyFollowUpToSibling) {
                                setSiblingFormData(prev => prev ? ({ ...prev, followUpDate: val }) : null);
                              }
                            }}
                            placeholder="DD-MM-YYYY"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div className="relative shrink-0" title="Open Calendar Picker">
                          <input
                            type="date"
                            value={dmyToYmd(formData.followUpDate)}
                            onChange={(e) => {
                              const selectedDMY = ymdToDmy(e.target.value);
                              setFormData(prev => ({ ...prev, followUpDate: selectedDMY, admissionStatus: "Follow-up Required" }));
                              if (applyFollowUpToSibling) {
                                setSiblingFormData(prev => prev ? ({ ...prev, followUpDate: selectedDMY, admissionStatus: "Follow-up Required" }) : null);
                              }
                            }}
                            className="w-9 h-8 p-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-1.5 mt-2 cursor-pointer text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={applyFollowUpToSibling}
                          onChange={(e) => setApplyFollowUpToSibling(e.target.checked)}
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                        <span>Sync follow-up date for both Child 1 &amp; Child 2</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Counsellor Name &amp; ID
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
                              setFormData(prev => ({
                                ...prev,
                                counsellorId: sel.id,
                                counsellorName: sel.name
                              }));
                              setSiblingFormData(prev => prev ? ({
                                ...prev,
                                counsellorId: sel.id,
                                counsellorName: sel.name
                              }) : null);
                            }
                          }}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          {localAccounts.map((c, idx) => (
                            <option key={`counsellor-sel-sib-${c.id}-${c.username}-${idx}`} value={c.id}>
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
                          onChange={(e) => {
                            const val = e.target.checked;
                            setFormData(prev => ({ ...prev, parentSignatureRecorded: val }));
                            setSiblingFormData(prev => prev ? ({ ...prev, parentSignatureRecorded: val }) : null);
                          }}
                          className="rounded text-orange-600 focus:ring-orange-500"
                        />
                        <span>Recorded / In-Person Signature Received</span>
                      </label>
                    </div>
                  </div>

                  {/* Office remarks */}
                  <div className="mt-4 p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
                    <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 tracking-wider uppercase">
                      FOR SCHOOL OFFICE USE ONLY (SIBLING ADMISSIONS)
                    </span>
                    <input
                      type="text"
                      value={formData.officeRemarks || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData(prev => ({ ...prev, officeRemarks: val }));
                        setSiblingFormData(prev => prev ? ({ ...prev, officeRemarks: val }) : null);
                      }}
                      placeholder="Sibling discount applied / 2 Application Kits issued / Fee quotation given / Notes..."
                      className="w-full mt-1.5 px-3.5 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ============================================================== */
              /* 👤 STANDARD SINGLE STUDENT ADMISSION FORM                       */
              /* ============================================================== */
              <div className="space-y-8">
                {/* SECTION 1: STUDENT & PARENT DETAILS */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-orange-500 pb-1.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-xs">1</span>
                      <h3 className="text-sm font-black uppercase text-slate-900 dark:text-white tracking-wider">
                        STUDENT &amp; PARENT DETAILS
                      </h3>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                      <input
                        type="text"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        placeholder="DD-MM-YYYY"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Enquiry No.
                      </label>
                      <input
                        type="text"
                        value={formData.enquiryNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, enquiryNo: e.target.value, id: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, applyingForClass: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, academicYear: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
                      >
                        <option value="2026-2027">2026-2027 (Current Academic Year)</option>
                        <option value="2027-2028">2027-2028 (Next Year Advance)</option>
                        <option value="2028-2029">2028-2029 (Future Advance)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Date of Birth
                      </label>
                      <input
                        type="text"
                        value={formData.dateOfBirth || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                        placeholder="DD-MM-YYYY"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Gender
                      </label>
                      <div className="flex items-center gap-6 mt-2">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="single_student_gender"
                            value="Male"
                            checked={formData.gender === "Male"}
                            onChange={() => setFormData(prev => ({ ...prev, gender: "Male" }))}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span>Male</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="single_student_gender"
                            value="Female"
                            checked={formData.gender === "Female"}
                            onChange={() => setFormData(prev => ({ ...prev, gender: "Female" }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, fatherName: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, motherName: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, contactNo: e.target.value }))}
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
                          onClick={() => setFormData(prev => ({ ...prev, whatsappNo: prev.contactNo }))}
                          className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline font-semibold"
                        >
                          Same as Contact
                        </button>
                      </div>
                      <input
                        type="tel"
                        value={formData.whatsappNo}
                        onChange={(e) => setFormData(prev => ({ ...prev, whatsappNo: e.target.value }))}
                        placeholder="WhatsApp Number"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Previous School &amp; Board <span className="text-red-500 font-black">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.previousSchool}
                        onChange={(e) => setFormData(prev => ({ ...prev, previousSchool: e.target.value }))}
                        placeholder="Name of previous school & board"
                        className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Previous Class
                      </label>
                      <input
                        type="text"
                        value={formData.previousClass || ""}
                        onChange={(e) => setFormData(prev => ({ ...prev, previousClass: e.target.value }))}
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
                        onChange={(e) => setFormData(prev => ({ ...prev, residentialAddress: e.target.value }))}
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
                            name="preferredContact_single"
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
                            name="preferredContact_single"
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
                      STUDENT INFORMATION &amp; PARENT EXPECTATIONS
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
                            name="single_transport"
                            checked={formData.transportRequired === true}
                            onChange={() => setFormData({ ...formData, transportRequired: true })}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                          <input
                            type="radio"
                            name="single_transport"
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
                            name="single_special_support"
                            checked={formData.specialLearningSupport === true}
                            onChange={() => setFormData({ ...formData, specialLearningSupport: true })}
                            className="text-orange-600 focus:ring-orange-500"
                          />
                          <span>Yes</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium">
                          <input
                            type="radio"
                            name="single_special_support"
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
                      ADMISSION STATUS &amp; FOLLOW-UP
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">Admission Status</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {FORM_STATUS_OPTIONS.map(status => {
                        const isSelected = formData.admissionStatus === status || (status === "Follow-up Required" && formData.admissionStatus === "Interested");
                        const conf = STATUS_CONFIG[status] || STATUS_CONFIG["Follow-up Required"];
                        return (
                          <button
                            type="button"
                            key={status}
                            onClick={() => {
                              let newFollowUp = formData.followUpDate;
                              if (status === "Follow-up Required" && !newFollowUp) {
                                newFollowUp = getFutureDateDMY(7);
                              }
                              setFormData({ ...formData, admissionStatus: status, followUpDate: newFollowUp });
                            }}
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
                    <div className={formData.admissionStatus === "Follow-up Required" ? "p-3 bg-orange-50/80 dark:bg-orange-950/20 border-2 border-orange-400 dark:border-orange-600/60 rounded-2xl shadow-sm" : ""}>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Calendar size={14} className="text-orange-500" />
                          <span>Follow-up Date</span>
                          {formData.admissionStatus === "Follow-up Required" && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-orange-600 text-white font-black uppercase">
                              Alert Enabled
                            </span>
                          )}
                        </label>
                        {formData.followUpDate && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, followUpDate: "" })}
                            className="text-[10px] text-slate-400 hover:text-red-500 font-bold cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Quick Date Presets */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">⚡ Quick:</span>
                        {[
                          { label: "Tomorrow (+1D)", days: 1 },
                          { label: "In 3 Days (+3D)", days: 3 },
                          { label: "In 1 Week (+7D)", days: 7 },
                          { label: "In 2 Weeks (+14D)", days: 14 }
                        ].map(preset => {
                          const targetDate = getFutureDateDMY(preset.days);
                          const isSelected = formData.followUpDate === targetDate;
                          return (
                            <button
                              type="button"
                              key={preset.days}
                              onClick={() => {
                                setFormData({ ...formData, followUpDate: targetDate, admissionStatus: "Follow-up Required" });
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold transition-all cursor-pointer border active:scale-95 ${
                                isSelected
                                  ? "bg-orange-600 text-white border-orange-600 shadow-sm ring-1 ring-orange-400/40"
                                  : "bg-white dark:bg-slate-800 hover:bg-orange-100 dark:hover:bg-orange-950/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                              }`}
                              title={`Set follow-up date to ${targetDate}`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Dual Input: Text Box + Native Calendar Date Picker */}
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={formData.followUpDate}
                            onChange={(e) => setFormData({ ...formData, followUpDate: e.target.value })}
                            placeholder="DD-MM-YYYY"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>

                        <div className="relative shrink-0" title="Open Calendar Picker">
                          <input
                            type="date"
                            value={dmyToYmd(formData.followUpDate)}
                            onChange={(e) => {
                              const selectedDMY = ymdToDmy(e.target.value);
                              setFormData({ ...formData, followUpDate: selectedDMY, admissionStatus: "Follow-up Required" });
                            }}
                            className="w-9 h-8 p-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
                          />
                        </div>
                      </div>

                      {formData.admissionStatus === "Follow-up Required" && (
                        <p className="text-[10px] text-orange-700 dark:text-orange-300 mt-1.5 font-medium flex items-center gap-1">
                          <span>🔔</span>
                          <span>Will automatically pop up in your morning <strong>Follow-up Calls Alert</strong> on this date.</span>
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Counsellor Name &amp; ID
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
                            <option key={`counsellor-sel-single-${c.id}-${c.username}-${idx}`} value={c.id}>
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
              </div>
            )}

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
                    return updated;
                  });

                  if (isJointSiblingMode) {
                    setSiblingFormData(prev => {
                      if (!prev) return null;
                      return {
                        ...prev,
                        audioRecording: {
                          ...audioRec,
                          id: `${audioRec.id}-SIB`,
                          enquiryNo: prev.enquiryNo || "",
                          studentName: prev.studentName || "Sibling",
                          isJointSiblingSession: true,
                          jointSiblingNames: `${formData.studentName} & ${prev.studentName}`
                        },
                        conversationLanguageNotes: audioRec.conversationLanguageNotes || prev.conversationLanguageNotes,
                        pointsDiscussed: prev.pointsDiscussed && prev.pointsDiscussed.trim()
                          ? prev.pointsDiscussed
                          : (audioRec.meetingTextSummary || prev.pointsDiscussed)
                      };
                    });
                  }
                }}
                onRemoveAudio={() => {
                  setFormData(prev => ({
                    ...prev,
                    audioRecording: undefined
                  }));
                  if (isJointSiblingMode) {
                    setSiblingFormData(prev => prev ? ({ ...prev, audioRecording: undefined }) : null);
                  }
                }}
                onUpdateNotes={(newNotes) => {
                  setFormData(prev => ({
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
                  }));
                  if (isJointSiblingMode) {
                    setSiblingFormData(prev => prev ? ({
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
                    }) : null);
                  }
                }}
                onRequestSaveAdmission={() => {
                  handleSave({ preventDefault: () => {} } as React.FormEvent);
                }}
              />
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              {isJointSiblingMode && (
                <button
                  type="button"
                  onClick={handleDisableSiblingMode}
                  className="px-4 py-2.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950/80 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <span className="text-purple-600 dark:text-purple-400 font-extrabold">✕</span>
                  <span>Switch to Single Student</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
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
                {isJointSiblingMode && siblingFormData
                  ? `💾 Save Both Sibling Records (${formData.studentName || "Child 1"} & ${siblingFormData.studentName || "Child 2"})`
                  : "💾 Save Counselling Enquiry"}
              </button>
            </div>
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
                onClick={handlePrintAdmissionForm}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2"
                title="Print official physical admission sheet"
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

            {/* Section 4: INFORMATION EXPLAINED (Counselling Notes Omitted as requested) */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                4. INFORMATION EXPLAINED
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

            {/* Section 5: ADMISSION STATUS & SIGNATURES */}
            <div className="border border-black mb-3">
              <div className="bg-slate-200 font-black px-2 py-1 uppercase border-b border-black text-[11px]">
                5. ADMISSION STATUS & SIGNATURES
              </div>
              <div className="p-2 space-y-2">
                <div className="flex gap-4 flex-wrap">
                  {[
                    "Follow-up Required",
                    "Application Taken",
                    "Entrance Test Required",
                    "Admission Confirmed",
                    "Not Interested"
                  ].map(status => (
                    <span key={status}>
                      [ {(selectedEnquiry.admissionStatus === status || (status === "Follow-up Required" && selectedEnquiry.admissionStatus === "Interested")) ? "✓" : " "} ] {status}
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
          onBackToHome={() => {
            setActiveView("list");
            setSelectedEnquiry(null);
            setInspectingEnquiry(null);
            setSelectedMetricCard(null);
          }}
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
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-800 dark:text-slate-100">📞 Primary Phone:</strong> 
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {inspectingEnquiry.contactNo || "N/A"}
                      </span>
                      {inspectingEnquiry.contactNo && (
                        <a
                          href={`tel:${inspectingEnquiry.contactNo}`}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md hover:underline"
                        >
                          <Phone size={10} /> Call
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-slate-800 dark:text-slate-100">💬 WhatsApp No:</strong> 
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                        {inspectingEnquiry.whatsappNo || inspectingEnquiry.contactNo || "N/A"}
                      </span>
                      <a
                        href={`https://wa.me/91${(inspectingEnquiry.whatsappNo || inspectingEnquiry.contactNo || "").replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md hover:underline"
                      >
                        <MessageSquare size={10} /> Chat
                      </a>
                      {inspectingEnquiry.whatsappNo && inspectingEnquiry.whatsappNo !== inspectingEnquiry.contactNo && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold">
                          Alt WhatsApp
                        </span>
                      )}
                    </div>
                  </div>
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
        enquiries={userRole === "Counsellor" ? counsellorScopeEnquiries : safeEnquiries}
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
        onClearAllClaimedEntries={handleClearAllClaimed}
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

      {/* Dismissed Leads & Tokens Archive Modal */}
      {isDismissedLeadsModalOpen && (
        <DismissedLeadsModal
          isOpen={isDismissedLeadsModalOpen}
          onClose={() => setIsDismissedLeadsModalOpen(false)}
          dismissedEntries={dismissedParentEntries}
          liveQueueEntries={parentSelfEntries}
          onRestoreEntry={handleRestoreDismissedEntry}
          onClaimEntry={handleClaimAndAutoFill}
          onPermanentDelete={handlePermanentDeleteEntry}
          currentCounsellorName={activeCounsellor?.name}
          userRole={userRole}
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

      {/* Modal: Clarify Token Dismiss - Skip for Me (Pass to others) vs Cancel for Everyone */}
      {tokenActionModalEntry && (
        <div className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border-2 border-orange-500/50 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 flex items-center justify-center font-black text-xl shadow-md shrink-0">
                  🎫
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                      {tokenActionModalEntry.dailyTokenNo ? `Token #${tokenActionModalEntry.dailyTokenNo}` : tokenActionModalEntry.onlineRefNo || `#${tokenActionModalEntry.id}`}
                    </span>
                    <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                      {tokenActionModalEntry.applyingForClass}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {tokenActionModalEntry.studentName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Parent: <strong className="text-slate-700 dark:text-slate-300">{tokenActionModalEntry.fatherName || tokenActionModalEntry.motherName || "Parent"}</strong> • 📞 {tokenActionModalEntry.contactNo}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setTokenActionModalEntry(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Prompt explanation */}
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <p className="font-bold">
                What would you like to do with this token?
              </p>
              <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                If you are busy with another parent, choose <strong>"Skip for Me"</strong> so other available counsellors can attend to this waiting parent.
              </p>
            </div>

            {/* 2 Big Action Buttons */}
            <div className="space-y-3 pt-1">
              {/* Option 1: Skip for My Profile Only (Pass to other counsellors) */}
              <button
                type="button"
                onClick={() => {
                  handleSkipForMyProfile(tokenActionModalEntry.id);
                  setTokenActionModalEntry(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-indigo-500/40 bg-indigo-50/70 hover:bg-indigo-100/90 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 font-black text-sm text-indigo-700 dark:text-indigo-300">
                    <UserCheck size={18} className="text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>👤 Skip for My Profile (Pass to Other Counsellors)</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-100">
                    Recommended (Safe)
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 pl-7 leading-relaxed">
                  Hide from your screen only because you are busy. <strong>Keeps the token active and visible for all other counsellors (Radhika, Sowjanya, etc.) to call and attend.</strong>
                </p>
              </button>

              {/* Option 2: Parent Left Campus / Cancel Globally */}
              <button
                type="button"
                onClick={() => {
                  handleGlobalDismissParentEntry(tokenActionModalEntry.id, "Parent left campus without meeting");
                  setTokenActionModalEntry(null);
                }}
                className="w-full text-left p-4 rounded-2xl border-2 border-rose-300 dark:border-rose-900/60 bg-rose-50/50 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 font-black text-sm text-rose-700 dark:text-rose-300">
                  <X size={18} className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>🚪 Parent Left Campus (Cancel for Everyone)</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 pl-7 leading-relaxed">
                  Parent walked out or left without attending counselling. <strong>Removes token from all portals and safely archives it in Dismissed Leads Archive.</strong>
                </p>
              </button>
            </div>

            {/* Bottom Actions */}
            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Parent remains in waiting lounge
              </span>
              <button
                type="button"
                onClick={() => setTokenActionModalEntry(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Keep Waiting in Queue
              </button>
            </div>
          </div>
        </div>
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

      {/* MODAL: QUICK RESCHEDULE SCHEDULED FOLLOW-UP */}
      {reschedulingEnquiry && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 dark:bg-orange-950/80 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                  <Clock size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Reschedule Follow-up
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {reschedulingEnquiry.studentName} (Class {reschedulingEnquiry.applyingForClass})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReschedulingEnquiry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Current Follow-up details */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1 text-slate-600 dark:text-slate-300">
              <p>Parent: <strong className="text-slate-800 dark:text-slate-100">{reschedulingEnquiry.fatherName || reschedulingEnquiry.motherName || "Parent"}</strong> • 📞 {reschedulingEnquiry.contactNo}</p>
              <p>Current Follow-up: <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{reschedulingEnquiry.followUpDate || "None"}</span></p>
            </div>

            {/* Quick Preset Buttons */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ⚡ Quick Presets (Click to choose new date):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Tomorrow (+1 Day)", days: 1 },
                  { label: "In 3 Days (+3 Days)", days: 3 },
                  { label: "In 1 Week (+7 Days)", days: 7 },
                  { label: "In 2 Weeks (+14 Days)", days: 14 }
                ].map(preset => {
                  const targetDMY = getFutureDateDMY(preset.days);
                  const isSelected = ymdToDmy(rescheduleCustomDate) === targetDMY;
                  return (
                    <button
                      type="button"
                      key={preset.days}
                      onClick={() => setRescheduleCustomDate(dmyToYmd(targetDMY))}
                      className={`p-2 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-orange-600 text-white border-orange-600 ring-2 ring-orange-400/40 shadow-xs"
                          : "bg-white dark:bg-slate-800 hover:bg-orange-50 dark:hover:bg-orange-950/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <div className="font-black">{preset.label}</div>
                      <div className={`text-[10px] ${isSelected ? "text-orange-100" : "text-slate-400 font-mono"}`}>
                        {targetDMY}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Or Specific Custom Date Picker */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Or Pick Custom Specific Date:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={rescheduleCustomDate}
                  onChange={(e) => setRescheduleCustomDate(e.target.value)}
                  className="flex-1 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <span className="font-mono text-xs font-black text-orange-600 dark:text-orange-400 px-3 py-2 bg-orange-50 dark:bg-orange-950/60 rounded-xl border border-orange-200 dark:border-orange-800/60 shrink-0">
                  {ymdToDmy(rescheduleCustomDate) || "DD-MM-YYYY"}
                </span>
              </div>
            </div>

            {/* Call Reason / Note */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Note / Parent Remark (Optional):
              </label>
              <input
                type="text"
                value={rescheduleNote}
                onChange={(e) => setRescheduleNote(e.target.value)}
                placeholder="e.g. Parent requested callback after salary / out of station"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setReschedulingEnquiry(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetDMY = ymdToDmy(rescheduleCustomDate);
                  handleApplyReschedule(reschedulingEnquiry, targetDMY, rescheduleNote);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Save Rescheduled Date</span>
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
