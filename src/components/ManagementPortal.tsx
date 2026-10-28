import React, { useState, useMemo, useEffect } from "react";
import { 
  Award, 
  Headphones, 
  Users, 
  BarChart3, 
  TrendingUp, 
  GraduationCap, 
  CheckCircle, 
  Clock, 
  Star, 
  PhoneCall, 
  FileText, 
  Languages, 
  Download, 
  LogOut, 
  Sun, 
  Moon, 
  Search, 
  Filter, 
  ShieldCheck, 
  Building2, 
  Sparkles,
  ArrowUpRight,
  AlertTriangle,
  KeyRound,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  X,
  HardDrive,
  Calendar,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { 
  CounsellingEnquiry, 
  CounsellorAccount, 
  ManagementAccount, 
  loadManagementAccounts, 
  saveManagementAccounts, 
  Ticket, 
  Room, 
  InventoryItem,
  ADMISSION_CLASSES
} from "../types";
import { loadCounsellorAccounts, saveCounsellorAccounts, DEMO_COUNSELLING, mergeWithDefaultCounsellorAccounts, recordDeletedCounsellorAccountId, unrecordDeletedCounsellorAccountId, getAllowCounsellorMultiDelete, setAllowCounsellorMultiDelete } from "../utils/storage";
import ManagementAudioDesk from "./ManagementAudioDesk";
import ManagementAdmissionDesk from "./ManagementAdmissionDesk";
import { formatAudioDuration } from "../utils/audioStorage";


interface ManagementPortalProps {
  enquiries: CounsellingEnquiry[];
  onSaveEnquiry: (enquiry: CounsellingEnquiry) => void;
  onDeleteEnquiry?: (id: string) => void;
  counsellorAccounts?: CounsellorAccount[];
  managementAccounts?: ManagementAccount[];
  onSaveManagementAccount?: (acc: ManagementAccount) => void;
  onDeleteManagementAccount?: (id: string) => void;
  onSaveCounsellorAccount?: (acc: CounsellorAccount) => void;
  onDeleteCounsellorAccount?: (id: string) => void;
  tickets?: Ticket[];
  rooms?: Room[];
  inventory?: InventoryItem[];
  userRole?: string;
  userEmail?: string;
  onLogout?: () => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
  standalone?: boolean;
  onSyncRefresh?: () => void;
}

export default function ManagementPortal({
  enquiries,
  onSaveEnquiry,
  onDeleteEnquiry,
  counsellorAccounts = [],
  managementAccounts = [],
  onSaveManagementAccount,
  onDeleteManagementAccount,
  onSaveCounsellorAccount,
  onDeleteCounsellorAccount,
  tickets = [],
  rooms = [],
  inventory = [],
  userRole = "Management",
  userEmail = "management@birla.edu.in",
  onLogout,
  theme = "light",
  toggleTheme,
  standalone = false,
  onSyncRefresh
}: ManagementPortalProps) {
  const [activeTab, setActiveTab] = useState<"audios" | "counsellors" | "admissions" | "languages" | "accounts">("admissions");
  const [searchQuery, setSearchQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [selectedCounsellorForAudit, setSelectedCounsellorForAudit] = useState<string>("ALL");
  const [admissionsSectionFilter, setAdmissionsSectionFilter] = useState<"all" | "pre_primary" | "primary" | "middle" | "senior">("all");
  const [selectedClassForDetails, setSelectedClassForDetails] = useState<string | null>(null);

  // Local accounts state initialized from props or storage
  const [localManagementAccounts, setLocalManagementAccounts] = useState<ManagementAccount[]>(() => {
    return (managementAccounts && managementAccounts.length > 0)
      ? managementAccounts
      : loadManagementAccounts();
  });

  const [localCounsellorAccounts, setLocalCounsellorAccounts] = useState<CounsellorAccount[]>(() => {
    return (counsellorAccounts && counsellorAccounts.length > 0)
      ? mergeWithDefaultCounsellorAccounts(counsellorAccounts)
      : loadCounsellorAccounts();
  });

  const [allowCounsellorMultiDelete, setAllowCounsellorMultiDeleteState] = useState<boolean>(() => getAllowCounsellorMultiDelete());


  useEffect(() => {
    if (managementAccounts && managementAccounts.length > 0) {
      setLocalManagementAccounts(managementAccounts);
    }
  }, [managementAccounts]);

  useEffect(() => {
    if (counsellorAccounts && counsellorAccounts.length > 0) {
      setLocalCounsellorAccounts(mergeWithDefaultCounsellorAccounts(counsellorAccounts));
    }
  }, [counsellorAccounts]);

  // Management Account modal states
  const [isMgmtModalOpen, setIsMgmtModalOpen] = useState(false);
  const [mgmtModalMode, setMgmtModalMode] = useState<"create" | "edit">("create");
  const [mgmtFormData, setMgmtFormData] = useState<ManagementAccount>({
    id: "",
    name: "",
    username: "",
    password: "",
    email: "",
    roleTitle: "Academic Director",
    phone: "",
    status: "active",
    createdAt: ""
  });
  const [showMgmtPassword, setShowMgmtPassword] = useState(false);
  const [copiedMgmtId, setCopiedMgmtId] = useState<string | null>(null);

  // Counsellor Account modal states
  const [isCounsellorModalOpen, setIsCounsellorModalOpen] = useState(false);
  const [counsellorModalMode, setCounsellorModalMode] = useState<"create" | "edit">("create");
  const [counsellorFormData, setCounsellorFormData] = useState<CounsellorAccount>({
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
  const [showCounsellorPassword, setShowCounsellorPassword] = useState(false);
  const [copiedCounsellorId, setCopiedCounsellorId] = useState<string | null>(null);

  // In-app Delete Confirmation Modals (Avoids sandboxed iframe window.confirm blocking)
  const [mgmtAccountToDelete, setMgmtAccountToDelete] = useState<ManagementAccount | null>(null);
  const [counsellorAccountToDelete, setCounsellorAccountToDelete] = useState<CounsellorAccount | null>(null);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Action Handlers for Management Accounts
  const handleOpenCreateMgmt = () => {
    const nextIdx = localManagementAccounts.length + 1;
    setMgmtFormData({
      id: `MGMT-0${nextIdx}`,
      name: "",
      username: `executive${nextIdx}`,
      password: `Executive@${2026 + nextIdx}`,
      email: `mgmt${nextIdx}@birla.edu.in`,
      roleTitle: "Academic Director",
      phone: "+91 99887 00000",
      status: "active",
      createdAt: new Date().toLocaleDateString("en-GB")
    });
    setMgmtModalMode("create");
    setShowMgmtPassword(false);
    setIsMgmtModalOpen(true);
  };

  const handleOpenEditMgmt = (acc: ManagementAccount) => {
    setMgmtFormData({ ...acc });
    setMgmtModalMode("edit");
    setShowMgmtPassword(false);
    setIsMgmtModalOpen(true);
  };

  const handleSaveMgmtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mgmtFormData.name.trim() || !mgmtFormData.username.trim() || !mgmtFormData.password.trim()) {
      alert("Please fill all required fields (Name, Username, Password).");
      return;
    }
    const cleanUser = mgmtFormData.username.trim().toLowerCase();
    const finalAcc: ManagementAccount = {
      ...mgmtFormData,
      name: mgmtFormData.name.trim(),
      username: cleanUser,
      password: mgmtFormData.password.trim(),
      email: mgmtFormData.email.trim() || `${cleanUser}@birla.edu.in`,
      createdAt: mgmtFormData.createdAt || new Date().toLocaleDateString("en-GB")
    };

    setLocalManagementAccounts(prev => {
      const idx = prev.findIndex(a => a.id === finalAcc.id || a.username.toLowerCase() === cleanUser);
      let updated: ManagementAccount[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = finalAcc;
      } else {
        updated = [...prev, finalAcc];
      }
      saveManagementAccounts(updated);
      return updated;
    });

    if (onSaveManagementAccount) {
      onSaveManagementAccount(finalAcc);
    }
    setIsMgmtModalOpen(false);
  };

  const handleToggleMgmtStatus = (acc: ManagementAccount) => {
    const updated: ManagementAccount = {
      ...acc,
      status: acc.status === "active" ? "inactive" : "active"
    };
    setLocalManagementAccounts(prev => {
      const next = prev.map(a => a.id === acc.id ? updated : a);
      saveManagementAccounts(next);
      return next;
    });
    if (onSaveManagementAccount) onSaveManagementAccount(updated);
  };

  const handleDeleteMgmtAction = (id: string) => {
    const target = localManagementAccounts.find(a => a.id === id);
    if (target) setMgmtAccountToDelete(target);
  };

  const handleConfirmDeleteMgmt = () => {
    if (!mgmtAccountToDelete) return;
    const target = mgmtAccountToDelete;
    setMgmtAccountToDelete(null);
    setLocalManagementAccounts(prev => {
      const next = prev.filter(a => a.id !== target.id);
      saveManagementAccounts(next);
      return next;
    });
    if (onDeleteManagementAccount) onDeleteManagementAccount(target.id);
    setDeleteToast(`Management account "${target.name}" deleted successfully!`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleCopyMgmtCredentials = (acc: ManagementAccount) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/?portal=management`;
    const message = `🏫 *BIRLA OPEN MINDS INTERNATIONAL SCHOOL*\n👑 *Executive Management Portal Access*\n\n👤 *Officer Name:* ${acc.name}\n🆔 *Officer ID:* ${acc.id}\n💼 *Role Title:* ${acc.roleTitle}\n🔑 *Username:* ${acc.username}\n🔐 *Passcode:* ${acc.password}\n\n🌐 *Executive Portal Login Link:*\n${portalUrl}\n\n*(Confidential: Authorized for Board & Directors only)*`;
    navigator.clipboard.writeText(message);
    setCopiedMgmtId(acc.id);
    setTimeout(() => setCopiedMgmtId(null), 3000);
  };

  // Action Handlers for Counsellor Accounts
  const handleOpenCreateCounsellor = () => {
    let maxNum = 0;
    localCounsellorAccounts.forEach(a => {
      const match = a.id?.match(/COUNSELLOR-(\d+)/i) || a.id?.match(/(\d+)$/);
      if (match) {
        const n = parseInt(match[1] || match[0], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    });
    const nextIdx = Math.max(localCounsellorAccounts.length + 1, maxNum + 1);
    setCounsellorFormData({
      id: `COUNSELLOR-${String(nextIdx).padStart(2, "0")}`,
      name: "",
      username: `counsellor${nextIdx}`,
      password: `Password@${100 + nextIdx}`,
      email: `counsellor${nextIdx}@birlainstitute.edu.in`,
      phone: "+91 98765 00000",
      roleTitle: "Admissions Counsellor",
      assignedGrades: "All Grades",
      status: "active",
      color: "#EA580C",
      createdAt: new Date().toLocaleDateString("en-GB")
    });
    setCounsellorModalMode("create");
    setShowCounsellorPassword(false);
    setIsCounsellorModalOpen(true);
  };

  const handleOpenEditCounsellor = (acc: CounsellorAccount) => {
    setCounsellorFormData({ ...acc });
    setCounsellorModalMode("edit");
    setShowCounsellorPassword(false);
    setIsCounsellorModalOpen(true);
  };

  const handleSaveCounsellorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!counsellorFormData.name.trim() || !counsellorFormData.username.trim() || !counsellorFormData.password.trim()) {
      alert("Please fill all required fields (Name, Username, Password).");
      return;
    }
    const cleanUser = counsellorFormData.username.trim().toLowerCase();
    const finalAcc: CounsellorAccount = {
      ...counsellorFormData,
      name: counsellorFormData.name.trim(),
      username: cleanUser,
      password: counsellorFormData.password.trim(),
      email: counsellorFormData.email.trim() || `${cleanUser}@birlainstitute.edu.in`,
      createdAt: counsellorFormData.createdAt || new Date().toLocaleDateString("en-GB")
    };

    unrecordDeletedCounsellorAccountId(finalAcc.id, finalAcc.username);

    setLocalCounsellorAccounts(prev => {
      const idx = prev.findIndex(a => a.id === finalAcc.id || a.username.toLowerCase() === cleanUser);
      let updated: CounsellorAccount[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = finalAcc;
      } else {
        updated = [...prev, finalAcc];
      }
      const merged = mergeWithDefaultCounsellorAccounts(updated);
      saveCounsellorAccounts(merged);
      return merged;
    });

    if (onSaveCounsellorAccount) onSaveCounsellorAccount(finalAcc);
    setDeleteToast(`✓ Counsellor account "${finalAcc.name}" (${finalAcc.username}) created/saved successfully!`);
    setTimeout(() => setDeleteToast(null), 3500);
    setIsCounsellorModalOpen(false);
  };

  const handleToggleCounsellorStatus = (acc: CounsellorAccount) => {
    const updated: CounsellorAccount = {
      ...acc,
      status: acc.status === "active" ? "inactive" : "active"
    };
    setLocalCounsellorAccounts(prev => {
      const next = prev.map(a => a.id === acc.id ? updated : a);
      saveCounsellorAccounts(next);
      return next;
    });
    if (onSaveCounsellorAccount) onSaveCounsellorAccount(updated);
  };

  const handleDeleteCounsellorAction = (id: string) => {
    const target = localCounsellorAccounts.find(a => a.id === id);
    if (target) setCounsellorAccountToDelete(target);
  };

  const handleConfirmDeleteCounsellor = () => {
    if (!counsellorAccountToDelete) return;
    const target = counsellorAccountToDelete;
    setCounsellorAccountToDelete(null);
    recordDeletedCounsellorAccountId(target.id, target.username);
    setLocalCounsellorAccounts(prev => {
      const next = prev.filter(a => a.id !== target.id && a.username.toLowerCase() !== target.username.toLowerCase());
      saveCounsellorAccounts(next);
      return next;
    });
    if (onDeleteCounsellorAccount) onDeleteCounsellorAccount(target.id);
    setDeleteToast(`Counsellor account "${target.name}" deleted successfully! All enquiries and performance metrics remain intact.`);
    setTimeout(() => setDeleteToast(null), 3500);
  };

  const handleCopyCounsellorCredentials = (acc: CounsellorAccount) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const portalUrl = `${origin}/?portal=counsellor`;
    const message = `🏫 *BIRLA OPEN MINDS INTERNATIONAL SCHOOL*\n🎓 *Admissions Counsellor Portal Access*\n\n👤 *Staff Name:* ${acc.name}\n🆔 *Counsellor ID:* ${acc.id}\n💼 *Designation:* ${acc.roleTitle}\n🔑 *Username:* ${acc.username}\n🔐 *Password:* ${acc.password}\n\n🌐 *Portal Login Link:*\n${portalUrl}\n\n*(Note: Keep password secure. Only your assigned parent enquiries will be shown.)*`;
    navigator.clipboard.writeText(message);
    setCopiedCounsellorId(acc.id);
    setTimeout(() => setCopiedCounsellorId(null), 3000);
  };

  // Safe enquiries source
  const safeEnquiries = useMemo(() => {
    return Array.isArray(enquiries) ? enquiries : [];
  }, [enquiries]);

  // 5 KPI Metric Cards Date-Wise Drill-Down State for Executive Management
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

  // 5 Admissions Metric Statistics
  const admissionStats = useMemo(() => {
    const total = safeEnquiries.length;
    const confirmed = safeEnquiries.filter(e => e.admissionStatus === "Admission Confirmed").length;
    const applicationTaken = safeEnquiries.filter(e => e.admissionStatus === "Application Taken").length;
    const testRequired = safeEnquiries.filter(e => e.admissionStatus === "Entrance Test Required").length;
    const followUp = safeEnquiries.filter(e => e.admissionStatus === "Follow-up Required" || e.admissionStatus === "Interested").length;
    return { total, confirmed, applicationTaken, testRequired, followUp };
  }, [safeEnquiries]);

  const deletedCount = useMemo(() => {
    try {
      const raw = localStorage.getItem("sgs_deleted_enquiry_ids");
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.length : 0;
      }
    } catch {}
    return 0;
  }, [safeEnquiries]);

  // Date Parsing & Utilities
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
      setSelectedMetricCard(null);
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
    setMetricAdminCounsellor("ALL");
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

  // Base enquiries filtered by selected metric card in Management
  const metricBaseEnquiries = useMemo(() => {
    if (!selectedMetricCard) return [];
    let base = safeEnquiries;
    if (metricAdminCounsellor !== "ALL") {
      base = base.filter(e => 
        e.counsellorId === metricAdminCounsellor || 
        (e.counsellorName && e.counsellorName.toLowerCase().includes(metricAdminCounsellor.toLowerCase()))
      );
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
  }, [safeEnquiries, selectedMetricCard, metricAdminCounsellor]);

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

      if (selectedDateChip) {
        if (parsed.dmy !== selectedDateChip && parsed.ymd !== selectedDateChip) return false;
      }
      if (metricSingleDate) {
        if (parsed.ymd !== metricSingleDate && parsed.dmy !== metricSingleDate) return false;
      }
      if (metricFromDate && parsed.ymd && parsed.ymd < metricFromDate) return false;
      if (metricToDate && parsed.ymd && parsed.ymd > metricToDate) return false;
      if (metricClassFilter !== "ALL" && item.applyingForClass !== metricClassFilter) return false;

      if (metricSearchQuery.trim()) {
        const q = metricSearchQuery.toLowerCase();
        const matches = 
          item.studentName?.toLowerCase().includes(q) ||
          item.fatherName?.toLowerCase().includes(q) ||
          item.contactNo?.includes(q) ||
          item.enquiryNo?.toLowerCase().includes(q) ||
          item.counsellorName?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [metricBaseEnquiries, selectedDateChip, metricSingleDate, metricFromDate, metricToDate, metricClassFilter, metricSearchQuery]);

  const handleExportMetricCSV = () => {
    if (filteredMetricEnquiries.length === 0) return;
    const headers = [
      "Enquiry No", "Date", "Student Name", "Class", "Parent Name", 
      "Contact No", "WhatsApp No", "Status", "Counsellor ID", "Counsellor Name", "Follow-up Date"
    ];
    const rows = filteredMetricEnquiries.map(e => [
      `"${e.enquiryNo || e.id}"`,
      `"${e.date}"`,
      `"${e.studentName}"`,
      `"${e.applyingForClass}"`,
      `"${e.fatherName || e.motherName || ""}"`,
      `"${e.contactNo}"`,
      `"${e.whatsappNo || ""}"`,
      `"${e.admissionStatus}"`,
      `"${e.counsellorId || ""}"`,
      `"${e.counsellorName || ""}"`,
      `"${e.followUpDate || ""}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOMIS_Executive_${selectedMetricCard || "Admissions"}_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Executive High-Level KPI Calculations
  const totalEnquiries = safeEnquiries.length;
  const confirmedAdmissions = safeEnquiries.filter(e => e.admissionStatus === "Admission Confirmed").length;
  const inProgressEnquiries = safeEnquiries.filter(e => e.admissionStatus === "Follow-up Required" || e.admissionStatus === "Application Taken" || e.admissionStatus === "Interested").length;
  const conversionRate = totalEnquiries > 0 ? Math.round((confirmedAdmissions / totalEnquiries) * 100) : 0;

  // Audio Recordings Metrics
  const recordingsWithAudio = safeEnquiries.filter(e => e.audioRecording && e.audioRecording.audioData);
  const reviewedAudios = recordingsWithAudio.filter(e => e.audioRecording?.reviewStatus === "Reviewed - Approved");
  const pendingAudios = recordingsWithAudio.filter(e => !e.audioRecording?.reviewStatus || e.audioRecording.reviewStatus === "Pending");
  
  // Calculate Average Quality Star Rating
  const ratedAudios = recordingsWithAudio.filter(e => e.audioRecording?.qualityRating && e.audioRecording.qualityRating > 0);
  const avgRating = ratedAudios.length > 0
    ? (ratedAudios.reduce((acc, curr) => acc + (curr.audioRecording?.qualityRating || 0), 0) / ratedAudios.length).toFixed(1)
    : "4.8";

  // Counsellor Performance Leaderboard Data (Preserves former & deleted accounts!)
  const counsellorLeaderboard = useMemo(() => {
    // Unique list of counsellor IDs from accounts or enquiries
    const counsellorMap: { [id: string]: {
      id: string;
      name: string;
      roleTitle: string;
      totalLeads: number;
      confirmed: number;
      audioSessions: number;
      auditedSessions: number;
      totalStars: number;
      ratedCount: number;
      isArchived?: boolean;
    } } = {};

    // Seed from active counsellor accounts
    localCounsellorAccounts.forEach(acc => {
      counsellorMap[acc.id] = {
        id: acc.id,
        name: acc.name,
        roleTitle: acc.roleTitle || "Admissions Counsellor",
        totalLeads: 0,
        confirmed: 0,
        audioSessions: 0,
        auditedSessions: 0,
        totalStars: 0,
        ratedCount: 0,
        isArchived: false
      };
    });

    // Populate from safeEnquiries (Ensures deleted counsellor's data is never lost!)
    safeEnquiries.forEach(enq => {
      const cid = enq.counsellorId || (enq.counsellorName ? `ARCHIVED-${enq.counsellorName.replace(/\s+/g, "_")}` : "COUNSELLOR-01");
      if (!counsellorMap[cid]) {
        counsellorMap[cid] = {
          id: cid,
          name: enq.counsellorName || "Former Counsellor",
          roleTitle: "Former Counsellor (Historical Data Preserved)",
          totalLeads: 0,
          confirmed: 0,
          audioSessions: 0,
          auditedSessions: 0,
          totalStars: 0,
          ratedCount: 0,
          isArchived: true
        };
      }

      counsellorMap[cid].totalLeads += 1;
      if (enq.admissionStatus === "Admission Confirmed") {
        counsellorMap[cid].confirmed += 1;
      }
      if (enq.audioRecording && enq.audioRecording.audioData) {
        counsellorMap[cid].audioSessions += 1;
        if (enq.audioRecording.reviewStatus === "Reviewed - Approved") {
          counsellorMap[cid].auditedSessions += 1;
        }
        if (enq.audioRecording.qualityRating && enq.audioRecording.qualityRating > 0) {
          counsellorMap[cid].totalStars += enq.audioRecording.qualityRating;
          counsellorMap[cid].ratedCount += 1;
        }
      }
    });

    return Object.values(counsellorMap).map(c => {
      const convRate = c.totalLeads > 0 ? Math.round((c.confirmed / c.totalLeads) * 100) : 0;
      const cAvgStars = c.ratedCount > 0 ? (c.totalStars / c.ratedCount).toFixed(1) : "5.0";
      return {
        ...c,
        convRate,
        avgStars: cAvgStars
      };
    }).sort((a, b) => b.confirmed - a.confirmed || b.convRate - a.convRate);
  }, [safeEnquiries, localCounsellorAccounts]);

  // Multilingual Distribution Data
  const languageStats = useMemo(() => {
    const counts: { [lang: string]: number } = {
      "English (Standard)": 0,
      "English & Bilingual": 0,
      "Hindi & English": 0,
      "Regional Language": 0,
      "Other": 0
    };

    safeEnquiries.forEach(enq => {
      const rawLang = enq.audioRecording?.parentLanguage || enq.parentSpokenLanguage || "English & Bilingual";
      if (rawLang === "English") {
        counts["English (Standard)"] += 1;
      } else if (rawLang.includes("Hindi") || rawLang.includes("हिंदी")) {
        counts["Hindi & English"] += 1;
      } else if (rawLang.includes("Telugu") || rawLang.includes("Bilingual")) {
        counts["English & Bilingual"] += 1;
      } else if (rawLang.includes("Regional")) {
        counts["Regional Language"] += 1;
      } else {
        counts["Other"] += 1;
      }
    });

    return counts;
  }, [safeEnquiries]);

  // Export Executive Summary TXT
  const handleExportExecutiveReport = () => {
    const reportText = `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
EXECUTIVE MANAGEMENT ADMISSIONS & QUALITY AUDIT REPORT
================================================================================
Report Generated Date : ${new Date().toLocaleString()}
Executive Reviewer    : ${userEmail} (${userRole})
Academic Year         : 2026-2027
--------------------------------------------------------------------------------

[1. EXECUTIVE HIGH-LEVEL ADMISSIONS KPI]
• Total Parent Enquiries Logged : ${totalEnquiries}
• Confirmed Admissions Closed   : ${confirmedAdmissions}
• In-Progress / Follow-up Leads : ${inProgressEnquiries}
• Overall Conversion Ratio       : ${conversionRate}%

[2. VOICE RECORDING QUALITY AUDIT SUMMARY]
• Total Counselling Audio Files : ${recordingsWithAudio.length}
• Executive Audited & Approved  : ${reviewedAudios.length}
• Pending Management Review     : ${pendingAudios.length}
• Average Counsellor Star Rating: ${avgRating} / 5.0 Stars

[3. COUNSELLOR PERFORMANCE LEADERBOARD]
${counsellorLeaderboard.map((c, i) => `#${i + 1} ${c.name} (${c.id})
   - Total Leads: ${c.totalLeads} | Confirmed: ${c.confirmed} | Conversion: ${c.convRate}%
   - Audio Sessions: ${c.audioSessions} | Quality Stars: ${c.avgStars} / 5.0`).join("\n\n")}

[4. PARENT MULTILINGUAL COMMUNICATION BREAKDOWN]
• English (Standard)                 : ${languageStats["English (Standard)"]} enquiries
• English & Bilingual (Regional)     : ${languageStats["English & Bilingual"]} enquiries
• Hindi & English                    : ${languageStats["Hindi & English"]} enquiries
• Regional Language                  : ${languageStats["Regional Language"]} enquiries
• Other Language Preferences         : ${languageStats["Other"]} enquiries

================================================================================
CONFIDENTIAL - FOR BOARD OF DIRECTORS & PRINCIPAL REVIEW ONLY
================================================================================`;

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BOMIS_Executive_Management_Report_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-6 space-y-6">
      {/* EXECUTIVE HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 p-0.5 shadow-lg shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center text-white">
              <Award size={28} className="text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black tracking-wider uppercase border border-amber-500/30">
                👑 Executive Leadership Desk
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                Principal & Director Command
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight mt-1">
              Birla Open Minds International School — Management Portal
            </h1>
            <p className="text-xs text-slate-400">
              Parent Meeting Voice Audits, Admissions Conversion Leaderboard & Multi-Branch Governance.
            </p>
          </div>
        </div>

        {/* Executive Actions */}
        <div className="flex items-center gap-2.5 flex-wrap self-start lg:self-auto">
          {onSyncRefresh && (
            <button
              type="button"
              onClick={onSyncRefresh}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="Refresh Executive Management Data & Stay on Page"
            >
              <RefreshCw size={14} />
              <span>Refresh Dept</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              window.location.href = "/?portal=counsellor";
            }}
            className="px-3.5 py-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 text-orange-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Switch to Admissions Counselling Portal"
          >
            <GraduationCap size={14} className="text-orange-400" />
            <span>Counselling Dept</span>
          </button>

          <button
            type="button"
            onClick={handleExportExecutiveReport}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Download size={14} />
            <span>Export Executive Report (.txt)</span>
          </button>

          {toggleTheme && (
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 transition-all cursor-pointer"
              title="Toggle Theme"
            >
              {theme === "dark" ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="px-3.5 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* EXECUTIVE ADMISSIONS PIPELINE - 5 INTERACTIVE DATE METRIC CARDS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              📊 Admissions Pipeline — Interactive Date-Wise Metrics
            </h2>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-900">
              Click Any Card to Inspect Dates
            </span>
          </div>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Birla Open Minds • All Counsellors & Historical Data Combined
          </span>
        </div>

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
                Total Enquiries
              </span>
              <Users size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <p className="text-2xl font-black text-slate-800 dark:text-white">{admissionStats.total}</p>
              {deletedCount > 0 && (
                <span className="text-[10px] text-slate-400 font-semibold" title={`${deletedCount} records deleted/cancelled`}>
                  ({deletedCount} deleted)
                </span>
              )}
            </div>
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
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">{admissionStats.applicationTaken}</p>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-bold">
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
            <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-2">{admissionStats.followUp}</p>
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
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">{admissionStats.confirmed}</p>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              <span>📅 Date Breakdown</span>
              <span>→</span>
            </div>
          </button>

          {/* Card 5: Conversion Ratio */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm transition-all duration-200">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-bold">
              <span>Conversion Ratio</span>
              <GraduationCap size={16} className="text-orange-500" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <p className="text-2xl font-black text-slate-800 dark:text-white">
                {confirmedAdmissions}
                <span className="text-xs font-normal text-slate-400 ml-1">/ {totalEnquiries}</span>
              </p>
            </div>
            <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Conversion Rate:</span>
              <span className="font-black text-orange-600 dark:text-orange-400">{conversionRate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* EXECUTIVE TABS SELECTOR */}
      <div className="flex bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 gap-1.5 flex-wrap shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("admissions")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "admissions"
              ? "bg-orange-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <BarChart3 size={16} />
          <span>📋 Admissions Master Data Desk ({safeEnquiries.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audios")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "audios"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Headphones size={16} />
          <span>Parent Audio &amp; Minutes Audit Desk ({recordingsWithAudio.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("counsellors")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "counsellors"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <TrendingUp size={16} />
          <span>Counsellor Performance Leaderboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("languages")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "languages"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Languages size={16} />
          <span>Multilingual Parent Demographics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("accounts")}
          className={`flex-1 min-w-[160px] py-3 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "accounts"
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <KeyRound size={16} />
          <span>Staff Accounts ({localManagementAccounts.length + localCounsellorAccounts.length})</span>
        </button>
      </div>

      {/* TAB CONTENT 1: AUDIO & MINUTES AUDIT DESK */}
      {activeTab === "audios" && (
        <div className="space-y-4">
          <ManagementAudioDesk
            enquiries={safeEnquiries}
            onUpdateEnquiry={onSaveEnquiry}
            userRole={userRole}
            userEmail={userEmail}
            initialCounsellorFilter={selectedCounsellorForAudit}
            counsellorAccounts={localCounsellorAccounts}
          />
        </div>
      )}

      {/* TAB CONTENT 2: COUNSELLOR PERFORMANCE LEADERBOARD */}
      {activeTab === "counsellors" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🏆 Admissions Staff Conversion Leaderboard</span>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                  Ranked by Conversion %
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Evaluates each counsellor's conversion rate, meeting voice compliance, and average quality star rating.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">Rank & Counsellor</th>
                  <th className="py-3 px-4">Staff ID</th>
                  <th className="py-3 px-4 text-center">Total Calls</th>
                  <th className="py-3 px-4 text-center">Confirmed</th>
                  <th className="py-3 px-4">Conversion Rate</th>
                  <th className="py-3 px-4 text-center">Voice Audits</th>
                  <th className="py-3 px-4 text-center">Quality Rating</th>
                  <th className="py-3 px-4 text-center">Coaching Status</th>
                  <th className="py-3 px-4 text-right">Voice Audits & Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {counsellorLeaderboard.map((c, idx) => (
                  <tr key={`leaderboard-tr-${c.id}-${c.name}-${idx}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                        idx === 0 ? "bg-amber-500 text-white shadow-md shadow-amber-500/30" :
                        idx === 1 ? "bg-slate-400 text-white" :
                        idx === 2 ? "bg-amber-700 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}>
                        {idx + 1}
                      </span>
                      <span>{c.name}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{c.id}</td>
                    <td className="py-3.5 px-4 text-center font-bold">{c.totalLeads}</td>
                    <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">{c.confirmed}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.convRate >= 40 ? "bg-emerald-500" : c.convRate >= 25 ? "bg-amber-500" : "bg-rose-500"
                            }`}
                            style={{ width: `${Math.min(100, c.convRate)}%` }}
                          />
                        </div>
                        <span className="font-bold text-xs">{c.convRate}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">{c.audioSessions}</span>
                      <span className="text-slate-400 text-[10px]"> ({c.auditedSessions} done)</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-500">
                        <Star size={12} className="fill-current" />
                        <span>{c.avgStars}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        c.convRate >= 40
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                          : c.convRate >= 20
                            ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                      }`}>
                        {c.convRate >= 40 ? "🏆 Top Performer" : c.convRate >= 20 ? "⭐ On Track" : "⚠️ Needs Coaching"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCounsellorForAudit(c.name);
                          setActiveTab("audios");
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-all shadow-sm cursor-pointer"
                        title={`Review ${c.name}'s recordings and leave coaching feedback`}
                      >
                        <Headphones size={13} />
                        <span>Audits & Feedback ({c.audioSessions})</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ADMISSIONS MASTER DATA & GRADE PIPELINE DESK */}
      {activeTab === "admissions" && (
        <ManagementAdmissionDesk
          enquiries={safeEnquiries}
          onSaveEnquiry={onSaveEnquiry}
          onDeleteEnquiry={onDeleteEnquiry}
          userRole={userRole}
          userEmail={userEmail}
          counsellorAccounts={localCounsellorAccounts}
        />
      )}

      {/* TAB CONTENT 4: MULTILINGUAL PARENT DEMOGRAPHICS */}
      {activeTab === "languages" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Languages size={18} className="text-orange-500" />
              <span>Parent Spoken Languages & Regional Demographics</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Tracks the distribution of parent admissions conversations across English, Hindi, and bilingual dialects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(languageStats).map(([lang, count]) => {
              const percent = totalEnquiries > 0 ? Math.round((count / totalEnquiries) * 100) : 0;
              return (
                <div key={lang} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">{lang}</span>
                    <span className="font-mono text-sm font-black text-orange-600 dark:text-orange-400">{count}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Share of Total Enquiries:</span>
                    <span className="font-bold">{percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 h-full rounded-full" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: EXECUTIVE & STAFF ACCOUNTS ACCESS CONTROLLER */}
      {activeTab === "accounts" && (
        <div className="space-y-8 animate-in fade-in">
          {/* Top Banner Notice */}
          <div className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-slate-900 text-white rounded-2xl p-5 border border-purple-500/30 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 mt-0.5 border border-purple-500/30">
                <KeyRound size={20} />
              </div>
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <span>Executive & Staff Access Control Hub</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">
                    Live Server Synced
                  </span>
                </h3>
                <p className="text-xs text-purple-200/90 mt-1 max-w-2xl leading-relaxed">
                  Only accounts created by Admin have access to their respective portals. All authorized Management accounts share the exact same synchronized parent enquiry data, audio vault, and verbatim text minutes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenCreateMgmt}
                className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>+ Add Executive Account</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateCounsellor}
                className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} />
                <span>+ Add Counsellor Account</span>
              </button>
            </div>
          </div>

          {/* SECTION 1: EXECUTIVE MANAGEMENT ACCOUNTS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Award size={18} className="text-purple-600 dark:text-purple-400" />
                  <span>Executive Management Accounts ({localManagementAccounts.length})</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Principals, Managing Directors, Academic Deans &amp; Audit Committee.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateMgmt}
                className="self-start sm:self-auto px-3 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Create New Executive Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localManagementAccounts.map((acc) => (
                <div 
                  key={acc.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3 relative hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-base shrink-0">
                        {acc.name ? acc.name.charAt(0) : "M"}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </h5>
                        <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold truncate">
                          {acc.roleTitle}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      acc.status === "active"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                        : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300"
                    }`}>
                      {acc.status}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 text-[10px]">Username:</span>
                      <strong className="text-purple-600 dark:text-purple-400">{acc.username}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 text-[10px]">Passcode:</span>
                      <strong>{acc.password}</strong>
                    </div>
                    {acc.email && (
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-[10px] pt-0.5 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400">Email:</span>
                        <span className="truncate max-w-[150px]">{acc.email}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopyMgmtCredentials(acc)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Copy credentials card for WhatsApp"
                    >
                      {copiedMgmtId === acc.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copiedMgmtId === acc.id ? "Copied!" : "Copy Card"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditMgmt(acc)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                      title="Edit Account Details"
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleMgmtStatus(acc)}
                      className={`p-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        acc.status === "active"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                      title={acc.status === "active" ? "Deactivate Account" : "Activate Account"}
                    >
                      {acc.status === "active" ? "⏸" : "▶"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMgmtAction(acc.id)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                      title="Delete Account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SUPER ADMIN ACCESS CONTROL: COUNSELLOR MULTI-DELETE PERMISSION */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-orange-500/30 text-orange-300 text-[10px] font-black uppercase tracking-wider border border-orange-500/40">
                  👑 Executive Super Admin Control
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

          {/* SECTION 2: ADMISSIONS COUNSELLOR ACCOUNTS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h4 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <GraduationCap size={18} className="text-orange-600 dark:text-orange-400" />
                  <span>Admissions Counsellor Staff Accounts ({localCounsellorAccounts.length})</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Admissions counsellors authorized to record parent voice meetings, review minutes, and manage inquiries.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateCounsellor}
                className="self-start sm:self-auto px-3 py-1.5 bg-orange-50 dark:bg-orange-950/60 hover:bg-orange-100 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={14} />
                <span>Create New Counsellor Account</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {localCounsellorAccounts.map((acc, idx) => (
                <div 
                  key={`mgmt-counsellor-${acc.id}-${acc.username}-${idx}`}
                  className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-3 relative hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div 
                        style={{ backgroundColor: `${acc.color || "#EA580C"}25`, color: acc.color || "#EA580C" }}
                        className="w-10 h-10 rounded-xl border border-orange-500/30 flex items-center justify-center font-black text-base shrink-0"
                      >
                        {acc.name ? acc.name.charAt(0) : "C"}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </h5>
                        <p className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold truncate">
                          {acc.roleTitle}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                      acc.status === "active"
                        ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300"
                        : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-300"
                    }`}>
                      {acc.status}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/80 space-y-1 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 text-[10px]">Username:</span>
                      <strong className="text-orange-600 dark:text-orange-400">{acc.username}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400 text-[10px]">Password:</span>
                      <strong>{acc.password}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-[10px] pt-0.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-slate-400">Grades:</span>
                      <span className="truncate max-w-[150px] font-sans font-medium">{acc.assignedGrades || "All"}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopyCounsellorCredentials(acc)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                      title="Copy credentials card for WhatsApp"
                    >
                      {copiedCounsellorId === acc.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                      <span>{copiedCounsellorId === acc.id ? "Copied!" : "Copy Card"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditCounsellor(acc)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                      title="Edit Account Details"
                    >
                      <Edit3 size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleCounsellorStatus(acc)}
                      className={`p-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        acc.status === "active"
                          ? "bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}
                      title={acc.status === "active" ? "Deactivate Account" : "Activate Account"}
                    >
                      {acc.status === "active" ? "⏸" : "▶"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCounsellorAction(acc.id)}
                      className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-lg text-[10px] font-bold cursor-pointer transition-all"
                      title="Delete Account"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT MANAGEMENT ACCOUNT */}
      {isMgmtModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold">
                  👑
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {mgmtModalMode === "create" ? "Create Executive Management Account" : "Edit Management Account"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ID: {mgmtFormData.id} • Authorized for Leadership Audit Desk
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMgmtModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMgmtSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name / Officer Title *
                </label>
                <input
                  type="text"
                  required
                  value={mgmtFormData.name}
                  onChange={(e) => setMgmtFormData({ ...mgmtFormData, name: e.target.value })}
                  placeholder="e.g. Dr. K. Radhika / Dr. Suresh Sharma"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Designation / Role Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={mgmtFormData.roleTitle}
                    onChange={(e) => setMgmtFormData({ ...mgmtFormData, roleTitle: e.target.value })}
                    placeholder="e.g. Academic Director / Dean / Trustee"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Username (Login ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={mgmtFormData.username}
                    onChange={(e) => setMgmtFormData({ ...mgmtFormData, username: e.target.value })}
                    placeholder="e.g. radhika or director"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Security Passcode / Password *
                </label>
                <div className="relative">
                  <input
                    type={showMgmtPassword ? "text" : "password"}
                    required
                    value={mgmtFormData.password}
                    onChange={(e) => setMgmtFormData({ ...mgmtFormData, password: e.target.value })}
                    placeholder="Enter login password or PIN"
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMgmtPassword(!showMgmtPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showMgmtPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={mgmtFormData.email}
                    onChange={(e) => setMgmtFormData({ ...mgmtFormData, email: e.target.value })}
                    placeholder="radhika.mgmt@birla.edu.in"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={mgmtFormData.status}
                    onChange={(e) => setMgmtFormData({ ...mgmtFormData, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="active">Active (Can Log In)</option>
                    <option value="inactive">Inactive (Access Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsMgmtModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  {mgmtModalMode === "create" ? "👑 Save & Grant Access" : "💾 Update Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE / EDIT COUNSELLOR ACCOUNT */}
      {isCounsellorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center font-bold">
                  🎓
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-white">
                    {counsellorModalMode === "create" ? "Create Admissions Counsellor Account" : "Edit Counsellor Account"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ID: {counsellorFormData.id} • Authorized for Counselling Desk &amp; Audio Transcripts
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCounsellorModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCounsellorSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Counsellor Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={counsellorFormData.name}
                  onChange={(e) => setCounsellorFormData({ ...counsellorFormData, name: e.target.value })}
                  placeholder="e.g. K. Radhika / M. Haritha"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Designation / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={counsellorFormData.roleTitle}
                    onChange={(e) => setCounsellorFormData({ ...counsellorFormData, roleTitle: e.target.value })}
                    placeholder="e.g. Admissions Counsellor"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Username (Login ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={counsellorFormData.username}
                    onChange={(e) => setCounsellorFormData({ ...counsellorFormData, username: e.target.value })}
                    placeholder="e.g. radhika"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showCounsellorPassword ? "text" : "password"}
                    required
                    value={counsellorFormData.password}
                    onChange={(e) => setCounsellorFormData({ ...counsellorFormData, password: e.target.value })}
                    placeholder="Enter login password"
                    className="w-full pl-3 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCounsellorPassword(!showCounsellorPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showCounsellorPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Assigned Grades
                  </label>
                  <input
                    type="text"
                    value={counsellorFormData.assignedGrades}
                    onChange={(e) => setCounsellorFormData({ ...counsellorFormData, assignedGrades: e.target.value })}
                    placeholder="e.g. Grades 1 to 5 / All Grades"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={counsellorFormData.status}
                    onChange={(e) => setCounsellorFormData({ ...counsellorFormData, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="active">Active (Can Log In)</option>
                    <option value="inactive">Inactive (Access Blocked)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCounsellorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer"
                >
                  {counsellorModalMode === "create" ? "🎓 Save & Grant Access" : "💾 Update Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE MANAGEMENT ACCOUNT CONFIRMATION */}
      {mgmtAccountToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-950/80 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash2 size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Delete Management Account?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-200">{mgmtAccountToDelete.name}</strong> (<span className="font-mono font-bold text-purple-600 dark:text-purple-400">@{mgmtAccountToDelete.username}</span>)? They will no longer have access to the Executive Management portal.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMgmtAccountToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteMgmt}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE COUNSELLOR ACCOUNT CONFIRMATION */}
      {counsellorAccountToDelete && (
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
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-200">{counsellorAccountToDelete.name}</strong> (<span className="font-mono font-bold text-orange-600 dark:text-orange-400">@{counsellorAccountToDelete.username}</span>)? They will no longer be able to log in to the Counsellor portal.
                </p>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 font-medium space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200">
                    <ShieldCheck size={14} className="text-amber-600 shrink-0" />
                    <span>🛡️ Historical Data Safety Guaranteed</span>
                  </p>
                  <p>
                    All parent enquiries, admissions records, and meeting audio recordings created by this counsellor will <strong>never be lost</strong>. They remain permanently preserved here in the Management Portal and on the Leaderboard.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCounsellorAccountToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCounsellor}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>Yes, Delete Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: 5 KPI ADMISSIONS METRICS DATE-WISE DRILL-DOWN & EXECUTIVE AUDIT */}
      {/* ========================================================================= */}
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
                        {selectedMetricCard === "total" && "Total Admissions Enquiries — Executive Date-Wise Report"}
                        {selectedMetricCard === "applications" && "Applications Taken — Executive Date-Wise Report"}
                        {selectedMetricCard === "entrance" && "Entrance Tests — Executive Date-Wise Schedule & Register"}
                        {selectedMetricCard === "followup" && "Follow-up Due & Hot Leads — Executive Date-Wise Planner"}
                        {selectedMetricCard === "confirmed" && "Confirmed Admissions — Executive Date-Wise Enrolment Log"}
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
                      Birla Open Minds International School • Click any date pill to inspect enquiries logged on that specific day
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                  <span>Total Enquiries ({admissionStats.total})</span>
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
                  <span>Applications ({admissionStats.applicationTaken})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCardClick("entrance")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                    selectedMetricCard === "entrance"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-500/20"
                      : "bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <GraduationCap size={13} />
                  <span>Entrance Tests ({admissionStats.testRequired})</span>
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
                  <span>Follow-up Due ({admissionStats.followUp})</span>
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
                  <span>Confirmed ({admissionStats.confirmed})</span>
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
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    All Dates
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("today")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "today"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    📅 Today Only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("yesterday")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "yesterday"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    Yesterday
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("last7")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "last7"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    Last 7 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("last30")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "last30"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    Last 30 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDatePreset("thisMonth")}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      metricDatePreset === "thisMonth"
                        ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400"
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
                        className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
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
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Filter by Counsellor (Includes active and archived) */}
                  <div>
                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      👤 Counsellor Staff:
                    </label>
                    <select
                      value={metricAdminCounsellor}
                      onChange={(e) => setMetricAdminCounsellor(e.target.value)}
                      className="w-full py-1.5 px-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">All Counsellors ({counsellorLeaderboard.length})</option>
                      {counsellorLeaderboard.map((c, idx) => (
                        <option key={`leaderboard-opt-${c.id}-${c.name}-${idx}`} value={c.name}>
                          {c.name} {c.isArchived ? "(Archived)" : ""} ({c.totalLeads} leads)
                        </option>
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
                        className="w-full pl-8 pr-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* DAILY DATE GROUPING PILLS (Clickable Date Breakdown) */}
              <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-indigo-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Dates Activity Breakdown ({dateGroupings.length} Distinct Dates)
                    </span>
                  </div>
                  {selectedDateChip && (
                    <button
                      type="button"
                      onClick={() => setSelectedDateChip(null)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Show All Dates</span>
                      <span>✕</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto custom-scrollbar p-1">
                  {dateGroupings.length === 0 ? (
                    <span className="text-xs text-slate-400">No records found for the active criteria.</span>
                  ) : (
                    dateGroupings.map((g) => {
                      const isSelected = selectedDateChip === g.dmy || selectedDateChip === g.ymd;
                      return (
                        <button
                          key={g.dmy}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setSelectedDateChip(null);
                            } else {
                              setSelectedDateChip(g.dmy);
                              setMetricDatePreset("all");
                              setMetricSingleDate("");
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 group ${
                            isSelected
                              ? "bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400/40"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40"
                          }`}
                          title={`Click to filter enquiries logged on ${g.dmy}`}
                        >
                          <span>📅 {g.dmy}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                          }`}>
                            {g.count}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ENQUIRIES TABLE FOR SELECTED METRIC & DATE CRITERIA */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                  <span className="font-black text-slate-700 dark:text-slate-300">
                    Detailed Register ({filteredMetricEnquiries.length} Enquiries Matching)
                    {selectedDateChip && ` — Filtered on ${selectedDateChip}`}
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Scroll horizontally if needed
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[460px] custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800/80 sticky top-0 z-10 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-3 px-3.5 text-center shrink-0 w-14">S.No</th>
                        <th className="py-3 px-3.5">Enquiry No & Date</th>
                        <th className="py-3 px-3.5">Student Name & Grade</th>
                        <th className="py-3 px-3.5">Parent / Contact</th>
                        <th className="py-3 px-3.5">Status & Follow-up</th>
                        <th className="py-3 px-3.5">Counsellor</th>
                        <th className="py-3 px-3.5 text-center">Audio Session</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {filteredMetricEnquiries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <FileText size={32} className="mx-auto mb-2 opacity-40" />
                            <p className="font-bold">No enquiries match this date or filter.</p>
                            <p className="text-[11px]">Click "All Dates" or clear the search filters.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredMetricEnquiries.map((enq, idx) => {
                          const hasAudio = Boolean(enq.audioRecording && enq.audioRecording.audioData);
                          return (
                            <tr key={enq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-500 text-xs">
                                #{idx + 1}
                              </td>
                              <td className="py-3 px-3.5">
                                <div className="font-mono font-bold text-slate-900 dark:text-white">
                                  {enq.enquiryNo || enq.id}
                                </div>

                                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Calendar size={11} className="text-slate-400" />
                                  <span>{enq.date}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {enq.studentName}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {enq.applyingForClass} • {enq.gender}
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="text-slate-800 dark:text-slate-200 font-medium">
                                  {enq.fatherName || enq.motherName || "Parent"}
                                </div>
                                <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <PhoneCall size={11} className="text-slate-400" />
                                  <span>{enq.contactNo}</span>
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                                  enq.admissionStatus === "Admission Confirmed"
                                    ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                                    : enq.admissionStatus === "Application Taken"
                                    ? "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                                    : enq.admissionStatus === "Entrance Test Required"
                                    ? "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
                                    : "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
                                }`}>
                                  {enq.admissionStatus}
                                </span>
                                {enq.followUpDate && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    Next: {enq.followUpDate}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {enq.counsellorName || "Admissions Staff"}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400">
                                  {enq.counsellorId || "ID Unset"}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-center">
                                {hasAudio ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                    <Headphones size={11} />
                                    <span>Recorded</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">No Audio</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing {filteredMetricEnquiries.length} of {metricBaseEnquiries.length} enquiries for this category
              </span>
              <button
                type="button"
                onClick={() => setSelectedMetricCard(null)}
                className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
              >
                Close Report Desk
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
    </div>
  );
}
