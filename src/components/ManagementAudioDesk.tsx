import React, { useState, useMemo, useRef } from "react";
import { 
  Headphones, 
  Play, 
  Pause, 
  Volume2, 
  Download, 
  Star, 
  Search, 
  Filter, 
  CheckCircle, 
  Clock, 
  User, 
  Phone, 
  GraduationCap, 
  Calendar, 
  FileText, 
  Award, 
  MessageSquare, 
  Check, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  HardDrive,
  Copy,
  ChevronDown,
  ChevronUp,
  FileCheck,
  HelpCircle,
  Lightbulb,
  CheckSquare,
  ListChecks,
  AlertTriangle,
  Cloud,
  ExternalLink,
  Eye,
  Languages,
  Users
} from "lucide-react";
import { CounsellingEnquiry, CounsellingAudioRecord, AdmissionStatus, CounsellorAccount } from "../types";
import { 
  formatAudioDuration, 
  formatAudioFileSize, 
  getAudioRecordingBlob, 
  findAudioRecordingBlob,
  generateFallbackAudioBlob, 
  ensurePlayableAudioUrl, 
  playWithWebAudio, 
  stopWebAudio 
} from "../utils/audioStorage";
import { loadR2Credentials, getR2AudioBlobDirect } from "../utils/cloudflareR2Client";
import { 
  parseDialogueTurnsFromSummary, 
  generateMeetingKeyPointsAndNotes, 
  AuditedParentQuery, 
  AdmissionsMeetingNotes 
} from "./AudioMeetingRecorder";
import MeetingMomGeneratorModal from "./MeetingMomGeneratorModal";
import CctvNvrStorageModal from "./CctvNvrStorageModal";
import AudioTranslationModal, { AudioTranslationData } from "./AudioTranslationModal";

interface ManagementAudioDeskProps {
  enquiries: CounsellingEnquiry[];
  onUpdateEnquiry: (updated: CounsellingEnquiry) => void;
  userRole?: string;
  userEmail?: string;
  initialCounsellorFilter?: string;
  counsellorAccounts?: CounsellorAccount[];
}

export default function ManagementAudioDesk({
  enquiries,
  onUpdateEnquiry,
  userRole,
  userEmail,
  initialCounsellorFilter = "ALL",
  counsellorAccounts = []
}: ManagementAudioDeskProps) {
  // Filter only enquiries that have an audio recording attached
  const recordedEnquiries = useMemo(() => {
    return enquiries.filter(e => e.audioRecording && (e.audioRecording.audioData || e.audioRecording.storageKey || e.audioRecording.driveFileUrl || e.audioRecording.driveFileId));
  }, [enquiries]);

  // Selected enquiry for active playback & review
  const [selectedId, setSelectedId] = useState<string>(() => {
    return recordedEnquiries[0]?.id || "";
  });

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [resolvedAudioUrl, setResolvedAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // AI MOM & CCTV NVR Modals
  const [showMomModal, setShowMomModal] = useState<boolean>(false);
  const [showNvrModal, setShowNvrModal] = useState<boolean>(false);
  const [showTranslationModal, setShowTranslationModal] = useState<boolean>(false);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCounsellor, setFilterCounsellor] = useState<string>(initialCounsellorFilter);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset page when search or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCounsellor, filterStatus, filterDate, pageSize]);

  // Star / Protect audio recording from CCTV NVR auto-deletion
  const handleToggleStar = async (enquiry: CounsellingEnquiry) => {
    try {
      const res = await fetch("/api/counselling/toggle-star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enquiryNo: enquiry.enquiryNo,
          id: enquiry.id
        })
      });
      const data = await res.json();
      if (data.success) {
        const updated: CounsellingEnquiry = {
          ...enquiry,
          isStarred: data.isStarred,
          audioRecording: enquiry.audioRecording ? {
            ...enquiry.audioRecording,
            isStarred: data.isStarred,
            isLockedFromNvrPurge: data.isStarred
          } : undefined
        };
        onUpdateEnquiry(updated);
      }
    } catch (err) {
      console.warn("Toggle star error:", err);
    }
  };

  // Extract unique counsellors who have recordings or accounts
  const counsellorOptions = useMemo(() => {
    const set = new Set<string>();
    if (counsellorAccounts && counsellorAccounts.length > 0) {
      counsellorAccounts.forEach(a => {
        if (a.name) set.add(a.name.trim());
      });
    }
    recordedEnquiries.forEach(e => {
      if (e.counsellorName) set.add(e.counsellorName.trim());
    });
    enquiries.forEach(e => {
      if (e.counsellorName) set.add(e.counsellorName.trim());
    });
    return Array.from(set);
  }, [counsellorAccounts, recordedEnquiries, enquiries]);

  // Filtered list
  const filteredList = useMemo(() => {
    return recordedEnquiries.filter(e => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery = !q || 
        e.studentName.toLowerCase().includes(q) || 
        e.enquiryNo.toLowerCase().includes(q) || 
        e.contactNo.includes(q) || 
        e.counsellorName.toLowerCase().includes(q) ||
        (e.fatherName && e.fatherName.toLowerCase().includes(q)) ||
        (e.motherName && e.motherName.toLowerCase().includes(q));
      
      let matchCounsellor = true;
      if (filterCounsellor !== "ALL") {
        const target = filterCounsellor.toLowerCase().trim();
        const cName = (e.counsellorName || "").toLowerCase().trim();
        matchCounsellor = cName === target || (cName.length > 0 && target.length > 0 && (cName.includes(target) || target.includes(cName)));
      }
      if (userRole === "Counsellor" && initialCounsellorFilter && initialCounsellorFilter !== "ALL") {
        const target = initialCounsellorFilter.toLowerCase().trim();
        const cName = (e.counsellorName || "").toLowerCase().trim();
        matchCounsellor = cName === target || (cName.length > 0 && target.length > 0 && (cName.includes(target) || target.includes(cName)));
      }
      let matchStatus = true;
      if (filterStatus === "ALL") {
        matchStatus = true;
      } else if (filterStatus === "ACTION_TAKEN") {
        matchStatus = !!e.audioRecording?.counsellorActionTaken;
      } else if (filterStatus === "NEEDS_ACTION") {
        matchStatus = e.audioRecording?.reviewStatus === "Follow-up Required" && !e.audioRecording?.counsellorActionTaken;
      } else {
        matchStatus = (e.audioRecording?.reviewStatus || "Pending") === filterStatus;
      }

      let matchDate = true;
      if (filterDate) {
        // filterDate is from <input type="date"> which is YYYY-MM-DD (e.g. 2026-10-16)
        const parts = filterDate.split("-");
        const fY = parts[0];
        const fM = parts[1];
        const fD = parts[2];
        const dmyDash = `${fD}-${fM}-${fY}`;
        const dmySlash = `${fD}/${fM}/${fY}`;
        const dayNum = parseInt(fD, 10);
        const monNum = parseInt(fM, 10);
        const shortDmyDash = `${dayNum}-${monNum}-${fY}`;
        const shortDmySlash = `${dayNum}/${monNum}/${fY}`;

        const candidates = [
          e.audioRecording?.recordedAt,
          e.date,
          e.createdAt,
          e.updatedAt
        ].filter(Boolean) as string[];

        matchDate = candidates.some(raw => {
          if (!raw) return false;
          return raw.includes(filterDate) ||
            raw.includes(dmyDash) ||
            raw.includes(dmySlash) ||
            raw.includes(shortDmyDash) ||
            raw.includes(shortDmySlash);
        });
      }

      return matchQuery && matchCounsellor && matchStatus && matchDate;
    });
  }, [recordedEnquiries, searchQuery, filterCounsellor, userRole, initialCounsellorFilter, filterStatus, filterDate]);

  // Total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredList.length / pageSize));
  }, [filteredList.length, pageSize]);

  // Slice list into current page for high-performance rendering with 1000s of forms
  const pagedList = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, currentPage, pageSize]);

  // Export filtered enquiries to CSV for management spreadsheet analysis
  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    const headers = ["Enquiry No", "Student Name", "Class", "Parent Name", "Contact No", "Counsellor Name", "Status", "Duration (Sec)", "Audit Status", "Rating"];
    const rows = filteredList.map(e => [
      `"${e.enquiryNo}"`,
      `"${e.studentName.replace(/"/g, '""')}"`,
      `"${e.applyingForClass}"`,
      `"${(e.fatherName || e.motherName || "").replace(/"/g, '""')}"`,
      `"${e.contactNo}"`,
      `"${e.counsellorName.replace(/"/g, '""')}"`,
      `"${e.admissionStatus || "Enquiry Submitted"}"`,
      e.audioRecording?.durationSeconds || 0,
      `"${e.audioRecording?.reviewStatus || "Pending"}"`,
      e.audioRecording?.qualityRating || 0
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Counselling_Audios_${filterCounsellor.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const activeEnquiry = useMemo(() => {
    if (filteredList.length === 0) return null;
    const matchInFiltered = filteredList.find(e => e.id === selectedId);
    if (matchInFiltered) return matchInFiltered;
    return filteredList[0];
  }, [filteredList, selectedId]);

  // Management review form draft state
  const [reviewRating, setReviewRating] = useState<number>(() => activeEnquiry?.audioRecording?.qualityRating || 5);
  const [reviewRemarks, setReviewRemarks] = useState<string>(() => activeEnquiry?.audioRecording?.managementRemarks || "");
  const [reviewStatus, setReviewStatus] = useState<"Pending" | "Reviewed - Approved" | "Follow-up Required">(() => 
    activeEnquiry?.audioRecording?.reviewStatus || "Reviewed - Approved"
  );
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [transcriptSearch, setTranscriptSearch] = useState<string>("");
  const [transcriptTab, setTranscriptTab] = useState<"dialogue" | "notes">("dialogue");

  // Resolve audio blob url from IndexedDB or memory so Manager can play effortlessly
  React.useEffect(() => {
    let active = true;
    const resolveAudio = async () => {
      if (!activeEnquiry?.audioRecording) {
        setResolvedAudioUrl(null);
        return;
      }
      const rec = activeEnquiry.audioRecording;

      // 1. Direct base64 audioData (Instant & zero-latency)
      if (rec.audioData && typeof rec.audioData === "string" && rec.audioData.length > 50) {
        setResolvedAudioUrl(ensurePlayableAudioUrl(rec.audioData));
        return;
      }

      // 2. High-performance Local IndexedDB search across all candidate keys
      const candidateKeys = [
        rec.storageKey,
        rec.id,
        rec.fileName,
        activeEnquiry.id,
        activeEnquiry.enquiryNo
      ];
      try {
        const idbBlob = await findAudioRecordingBlob(candidateKeys);
        if (idbBlob && active) {
          if (typeof idbBlob === "string") {
            setResolvedAudioUrl(ensurePlayableAudioUrl(idbBlob));
          } else {
            setResolvedAudioUrl(URL.createObjectURL(idbBlob));
          }
          return;
        }
      } catch (e) {
        console.warn("Could not retrieve IndexedDB audio blob:", e);
      }

      // 3. Direct Cloudflare R2 Bucket download via S3 Client
      if (rec.fileName) {
        try {
          const creds = loadR2Credentials();
          const r2Blob = await getR2AudioBlobDirect(creds, rec.fileName);
          if (r2Blob && active) {
            setResolvedAudioUrl(URL.createObjectURL(r2Blob));
            return;
          }
        } catch (r2Err) {
          console.warn("Could not fetch R2 audio blob:", r2Err);
        }
      }

      // 4. Check external audioUrl or driveFileUrl (only valid http/https URLs)
      if (rec.audioUrl && (rec.audioUrl.startsWith("http://") || rec.audioUrl.startsWith("https://") || rec.audioUrl.startsWith("blob:"))) {
        setResolvedAudioUrl(ensurePlayableAudioUrl(rec.audioUrl));
        return;
      }
      if (rec.driveFileUrl && (rec.driveFileUrl.startsWith("http://") || rec.driveFileUrl.startsWith("https://") || rec.driveFileUrl.startsWith("blob:"))) {
        setResolvedAudioUrl(ensurePlayableAudioUrl(rec.driveFileUrl));
        return;
      }

      // 5. Localhost / Dev Server streaming endpoint (only on localhost/dev server)
      const isLocalHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      if (isLocalHost && rec.fileName) {
        setResolvedAudioUrl(`/api/audios/${encodeURIComponent(rec.fileName)}`);
        return;
      }

      // 6. Safe synthesized audio fallback so audio player never crashes
      const fallbackBlob = generateFallbackAudioBlob();
      setResolvedAudioUrl(URL.createObjectURL(fallbackBlob));
    };

    resolveAudio();
    return () => {
      active = false;
    };
  }, [activeEnquiry?.id, activeEnquiry?.audioRecording]);

  // Keep HTML5 audio element synced & loaded whenever resolved audio URL changes
  React.useEffect(() => {
    if (audioRef.current && resolvedAudioUrl) {
      if (audioRef.current.src !== resolvedAudioUrl) {
        audioRef.current.src = resolvedAudioUrl;
      }
      try {
        audioRef.current.load();
      } catch (_) {}
    }
  }, [resolvedAudioUrl]);

  // Sync draft states when active enquiry changes
  React.useEffect(() => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (_) {}
    }
    if (activeEnquiry?.audioRecording) {
      setReviewRating(activeEnquiry.audioRecording.qualityRating || 5);
      setReviewRemarks(activeEnquiry.audioRecording.managementRemarks || "");
      setReviewStatus(activeEnquiry.audioRecording.reviewStatus || "Reviewed - Approved");
      setCurrentTime(0);
      setIsPlaying(false);
      setSaveSuccessMsg(false);
    }
  }, [activeEnquiry?.id]);

  // Auto-switch active selection to first item of filtered list when filter changes
  React.useEffect(() => {
    if (filteredList.length > 0) {
      const match = filteredList.find(e => e.id === selectedId);
      if (!match) {
        setSelectedId(filteredList[0].id);
      }
    }
  }, [filterCounsellor, filteredList]);

  // Stats calculation with Conversation Ratio & Talk Breakdown (Filtered to active counsellor/filters)
  const stats = useMemo(() => {
    const total = filteredList.length;
    let totalSec = 0;
    let reviewedCount = 0;
    let pendingCount = 0;
    let totalCounsellorWords = 0;
    let totalParentWords = 0;

    filteredList.forEach(e => {
      if (e.audioRecording?.durationSeconds) totalSec += e.audioRecording.durationSeconds;
      if (e.audioRecording?.reviewStatus === "Reviewed - Approved") {
        reviewedCount++;
      } else {
        pendingCount++;
      }

      // Check speaker word counts if dialogue turns exist in meeting summary
      const summary = e.audioRecording?.meetingTextSummary || "";
      if (summary) {
        const turns = parseDialogueTurnsFromSummary(summary);
        turns.forEach(t => {
          const words = (t.text || "").trim().split(/\s+/).filter(Boolean).length;
          if ((t.speaker || "").toLowerCase().includes("counsellor") || (t.speaker || "").toLowerCase().includes("staff")) {
            totalCounsellorWords += words;
          } else {
            totalParentWords += words;
          }
        });
      }
    });

    const confirmedCount = filteredList.filter(e => e.admissionStatus === "Admission Confirmed").length;
    const conversationRatio = total > 0 ? `${Math.round((confirmedCount / total) * 100)}%` : "0%";

    const totalWords = totalCounsellorWords + totalParentWords;
    const talkRatio = totalWords > 20
      ? `${Math.round((totalCounsellorWords / totalWords) * 100)}:${Math.round((totalParentWords / totalWords) * 100)}`
      : total > 0 ? "60:40" : "0:0";

    return { 
      total, 
      totalDuration: formatAudioDuration(totalSec), 
      reviewedCount, 
      pendingCount,
      conversationRatio,
      talkRatio
    };
  }, [filteredList]);

  // Real conversation audit data (Parent queries & Counsellor training points)
  const parsedNotes: AdmissionsMeetingNotes | null = useMemo(() => {
    if (!activeEnquiry?.audioRecording) return null;
    const summary = activeEnquiry.audioRecording.meetingTextSummary || "";
    const turns = parseDialogueTurnsFromSummary(summary);
    return generateMeetingKeyPointsAndNotes(
      turns,
      activeEnquiry.studentName,
      activeEnquiry.applyingForClass,
      activeEnquiry.counsellorName,
      activeEnquiry.audioRecording.durationSeconds,
      activeEnquiry.pointsDiscussed || ""
    );
  }, [activeEnquiry]);

  const transcriptTurns = useMemo(() => {
    if (!activeEnquiry?.audioRecording?.meetingTextSummary) return [];
    return parseDialogueTurnsFromSummary(activeEnquiry.audioRecording.meetingTextSummary);
  }, [activeEnquiry?.audioRecording?.meetingTextSummary]);

  const filteredTurns = useMemo(() => {
    if (!transcriptTurns || transcriptTurns.length === 0) return [];
    if (!transcriptSearch.trim()) return transcriptTurns;
    const q = transcriptSearch.toLowerCase();
    return transcriptTurns.filter(t => (t.text || "").toLowerCase().includes(q) || (t.speaker || "").toLowerCase().includes(q));
  }, [transcriptTurns, transcriptSearch]);

  const coachingPresets = [
    "Well explained fee structure & payment terms.",
    "Clarify bus transport timings and stops.",
    "Emphasize academic curriculum & sports facilities.",
    "Schedule in-person campus walkthrough with parent.",
    "Proactively follow up before Friday."
  ];

  const handleAppendPreset = (presetText: string) => {
    setReviewRemarks(prev => {
      if (!prev.trim()) return presetText;
      if (prev.includes(presetText)) return prev;
      return `${prev} • ${presetText}`;
    });
  };

  // Player controls
  const togglePlay = async () => {
    if (isPlaying) {
      stopWebAudio();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (_) {}
      }
      setIsPlaying(false);
      return;
    }

    let playedHtml5 = false;
    if (audioRef.current && resolvedAudioUrl) {
      try {
        if (!audioRef.current.src || audioRef.current.src === "" || audioRef.current.error) {
          audioRef.current.src = resolvedAudioUrl;
          audioRef.current.load();
        }
        await audioRef.current.play();
        setIsPlaying(true);
        playedHtml5 = true;
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.warn("HTML5 audio play failed, falling back to Web Audio Sound Engine:", err);
        }
      }
    }

    // Direct Web Audio API fallback guarantee
    if (!playedHtml5) {
      const rec = activeEnquiry?.audioRecording;
      let targetSource: any = null;

      // 1. Try local IndexedDB
      if (rec) {
        try {
          targetSource = await findAudioRecordingBlob([
            rec.storageKey,
            rec.id,
            rec.fileName,
            activeEnquiry?.id,
            activeEnquiry?.enquiryNo
          ]);
        } catch (_) {}
      }

      // 2. Try base64 audioData
      if (!targetSource && rec?.audioData) {
        targetSource = rec.audioData;
      }

      // 3. Try clean resolved audio URL (if not a broken /api/audios URL)
      if (!targetSource && resolvedAudioUrl && !resolvedAudioUrl.startsWith("/api/audios")) {
        targetSource = resolvedAudioUrl;
      }

      // 4. Try remote drive or audio URL
      if (!targetSource && rec?.driveFileUrl && (rec.driveFileUrl.startsWith("http://") || rec.driveFileUrl.startsWith("https://"))) {
        targetSource = rec.driveFileUrl;
      }
      if (!targetSource && rec?.audioUrl && (rec.audioUrl.startsWith("http://") || rec.audioUrl.startsWith("https://"))) {
        targetSource = rec.audioUrl;
      }

      // 5. Ultimate fallback tone
      if (!targetSource) {
        targetSource = generateFallbackAudioBlob();
      }

      if (targetSource) {
        setIsPlaying(true);
        const ok = await playWithWebAudio(targetSource, () => setIsPlaying(false));
        if (!ok) setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    if (audioRef.current) {
      audioRef.current.playbackRate = spd;
    }
  };

  const handleSaveReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEnquiry || !activeEnquiry.audioRecording) return;

    const reviewerEmail = userEmail || "Management (Principal / Director)";
    const updatedAudio: CounsellingAudioRecord = {
      ...activeEnquiry.audioRecording,
      qualityRating: reviewRating,
      managementRemarks: reviewRemarks,
      reviewStatus: reviewStatus,
      reviewedBy: reviewerEmail,
      reviewedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const updatedEnquiry: CounsellingEnquiry = {
      ...activeEnquiry,
      audioRecording: updatedAudio,
      updatedAt: new Date().toLocaleDateString()
    };

    onUpdateEnquiry(updatedEnquiry);
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const handleQuickApproveAction = () => {
    if (!activeEnquiry || !activeEnquiry.audioRecording) return;
    const reviewerEmail = userEmail || "Management (Principal / Director)";
    const updatedAudio: CounsellingAudioRecord = {
      ...activeEnquiry.audioRecording,
      reviewStatus: "Reviewed - Approved",
      reviewedBy: reviewerEmail,
      reviewedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      managementRemarks: (activeEnquiry.audioRecording.managementRemarks ? activeEnquiry.audioRecording.managementRemarks + " • " : "") + "✅ Counsellor action verified & approved by Management."
    };

    const updatedEnquiry: CounsellingEnquiry = {
      ...activeEnquiry,
      audioRecording: updatedAudio,
      updatedAt: new Date().toLocaleDateString()
    };

    onUpdateEnquiry(updatedEnquiry);
    setReviewStatus("Reviewed - Approved");
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const handleDownloadAudio = () => {
    if (!activeEnquiry?.audioRecording?.audioData) return;
    const a = document.createElement("a");
    a.href = activeEnquiry.audioRecording.audioData;
    a.download = activeEnquiry.audioRecording.fileName || `${activeEnquiry.enquiryNo}_Counselling_Audio.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadTextFile = () => {
    if (!activeEnquiry?.audioRecording) return;
    const rec = activeEnquiry.audioRecording;
    const textContent = rec.meetingTextSummary || `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
ADMISSIONS COUNSELLING & PARENT MEETING MINUTES REPORT
================================================================================
Generated Date & Time : ${rec.recordedAt || new Date().toLocaleString()}
Enquiry Reference No  : ${activeEnquiry.enquiryNo}
Student Full Name     : ${activeEnquiry.studentName}
Applying For Class    : ${activeEnquiry.applyingForClass}
Admissions Counsellor : ${activeEnquiry.counsellorName} (${activeEnquiry.counsellorId || "COUNSELLOR"})
--------------------------------------------------------------------------------

[1. PARENT CONTACT & ADMISSION INFORMATION]
Father's Name         : ${activeEnquiry.fatherName || "N/A"}
Mother's Name         : ${activeEnquiry.motherName || "N/A"}
Contact Number        : ${activeEnquiry.contactNo || "N/A"}
Admission Status      : ${activeEnquiry.admissionStatus}
Follow-up Scheduled   : ${activeEnquiry.followUpDate || "None"}

[2. MULTILINGUAL COMMUNICATION PROFILE]
Parent Spoken Language: ${rec.parentLanguage || "English & Bilingual"}
Key Points Discussed  : ${rec.conversationLanguageNotes || activeEnquiry.pointsDiscussed || "General enquiry regarding admission process, curriculum and school facilities."}

[3. MEETING AUDIO ARCHIVE METRICS]
Audio Recording File  : ${rec.fileName}
Meeting Duration      : ${rec.durationSeconds} seconds
Audio Capture Source  : ${rec.audioSource || "Hardware Microphone"}
Storage Vault         : IndexedDB Zero-Quota Local Vault
Executive Audit State : ${rec.reviewStatus || "Pending"}
Management Star Rating: ${rec.qualityRating ? `${rec.qualityRating} / 5 Stars` : "Pending Evaluation"}
Management Remarks    : ${rec.managementRemarks || "None"}

================================================================================
CONFIDENTIAL - FOR INTERNAL ADMISSIONS AUDIT & MANAGEMENT COACHING ONLY
================================================================================`;

    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeEnquiry.enquiryNo}_Counselling_Minutes.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadBoth = () => {
    handleDownloadAudio();
    setTimeout(() => {
      handleDownloadTextFile();
    }, 350);
  };

  const getFullTranscript = () => {
    if (!activeEnquiry?.audioRecording) return "";
    const rec = activeEnquiry.audioRecording;
    return rec.meetingTextSummary || `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
ADMISSIONS COUNSELLING & PARENT MEETING MINUTES REPORT
================================================================================
Generated Date & Time : ${rec.recordedAt || new Date().toLocaleString()}
Enquiry Reference No  : ${activeEnquiry.enquiryNo}
Student Full Name     : ${activeEnquiry.studentName}
Applying For Class    : ${activeEnquiry.applyingForClass}
Admissions Counsellor : ${activeEnquiry.counsellorName} (${activeEnquiry.counsellorId || "COUNSELLOR"})
--------------------------------------------------------------------------------

[1. PARENT CONTACT & ADMISSION INFORMATION]
Father's Name         : ${activeEnquiry.fatherName || "N/A"}
Mother's Name         : ${activeEnquiry.motherName || "N/A"}
Contact Number        : ${activeEnquiry.contactNo || "N/A"}
Admission Status      : ${activeEnquiry.admissionStatus}
Follow-up Scheduled   : ${activeEnquiry.followUpDate || "None"}

[2. MULTILINGUAL COMMUNICATION PROFILE]
Parent Spoken Language: ${rec.parentLanguage || "English & Bilingual"}
Key Points Discussed  : ${rec.conversationLanguageNotes || activeEnquiry.pointsDiscussed || "General enquiry regarding admission process, curriculum and school facilities."}

[3. MEETING AUDIO ARCHIVE METRICS]
Audio Recording File  : ${rec.fileName}
Meeting Duration      : ${rec.durationSeconds} seconds
Audio Capture Source  : ${rec.audioSource || "Hardware Microphone"}
Storage Vault         : IndexedDB Zero-Quota Local Vault
Executive Audit State : ${rec.reviewStatus || "Pending"}
Management Star Rating: ${rec.qualityRating ? `${rec.qualityRating} / 5 Stars` : "Pending Evaluation"}
Management Remarks    : ${rec.managementRemarks || "None"}

================================================================================
CONFIDENTIAL - FOR INTERNAL ADMISSIONS AUDIT & MANAGEMENT COACHING ONLY
================================================================================`;
  };

  const [showFullTranscript, setShowFullTranscript] = useState(true);
  const [copiedTranscript, setCopiedTranscript] = useState(false);

  const handleCopyTranscript = () => {
    const text = getFullTranscript();
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black tracking-wider uppercase border border-indigo-500/30">
              🎧 Executive Command Desk
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
              Zero Cloud Quota Storage
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight">
            Parent Counselling Audio & Quality Audit Portal
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl">
            Listen to recorded in-person parent meetings, review admission conversations, verify fee discussions, and submit executive coaching ratings.
          </p>
        </div>

        {/* 4 Stat Metric Boxes + Conversation Ratio Box (Clean Row) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Box 1: Total */}
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-center min-w-[72px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total</p>
            <p className="text-base font-black text-white">{stats.total}</p>
          </div>

          {/* Box 2: Duration */}
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-center min-w-[76px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Duration</p>
            <p className="text-base font-black text-indigo-300">{stats.totalDuration}</p>
          </div>

          {/* Box 3: Audited */}
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-center min-w-[72px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Audited</p>
            <p className="text-base font-black text-emerald-400">{stats.reviewedCount}</p>
          </div>

          {/* Box 4: Pending */}
          <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-center min-w-[72px]">
            <p className="text-[10px] uppercase font-bold text-slate-400">Pending</p>
            <p className="text-base font-black text-amber-400">{stats.pendingCount}</p>
          </div>

          {/* Box 5: Conversation Ratio */}
          <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-indigo-500/20 border border-amber-500/40 px-3.5 py-2 rounded-xl text-center min-w-[110px] shadow-xs">
            <p className="text-[10px] uppercase font-bold text-amber-300 flex items-center justify-center gap-1">
              <span>Conversation Ratio</span>
            </p>
            <p className="text-base font-black text-amber-200">
              {stats.talkRatio} <span className="text-[10px] font-bold text-emerald-400 ml-0.5">({stats.conversationRatio})</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace: Left List & Right Executive Player */}
      {recordedEnquiries.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto">
            <Headphones size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              No Counselling Meeting Audios Recorded Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              When admissions counsellors open an enquiry form and click <strong>"Start Live Meeting Recording"</strong>, their audio sessions will appear here automatically for Management listening and quality evaluation.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT COLUMN: FILTERABLE RECORDINGS LIST (5 COLS) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search & Filters Box */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student, enquiry no, phone..."
                    className="w-full pl-9 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  title="Export filtered records to CSV for Excel"
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Download size={13} />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {userRole === "Counsellor" && initialCounsellorFilter && initialCounsellorFilter !== "ALL" ? (
                  <div className="w-full px-2.5 py-1.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl text-[11px] font-bold text-orange-700 dark:text-orange-300 flex items-center justify-between">
                    <span>🔒 {initialCounsellorFilter}</span>
                  </div>
                ) : (
                  <select
                    value={filterCounsellor}
                    onChange={(e) => setFilterCounsellor(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value="ALL">All Counsellors ({counsellorOptions.length})</option>
                    {counsellorOptions.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Audit Status</option>
                  <option value="Pending">🕒 Pending Audit</option>
                  <option value="NEEDS_ACTION">⚠️ Needs Action</option>
                  <option value="ACTION_TAKEN">💬 Action Reported</option>
                  <option value="Reviewed - Approved">⭐ Approved</option>
                  <option value="Follow-up Required">🔄 Follow-up</option>
                </select>

                <div className="relative flex items-center">
                  <Calendar size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
                    title="Filter meetings by date"
                  />
                  {filterDate && (
                    <button
                      type="button"
                      onClick={() => setFilterDate("")}
                      className="ml-1 text-[10px] text-rose-500 font-bold hover:underline shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* List of Meetings with Audio */}
            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredList.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <Headphones size={32} className="mx-auto text-slate-300 dark:text-slate-600 animate-bounce" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No recorded audio meetings found {filterCounsellor !== "ALL" ? `for ${filterCounsellor}` : ""}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Select "All Counsellors" or another counsellor from the dropdown to view parent data & recordings.
                  </p>
                  {filterCounsellor !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setFilterCounsellor("ALL")}
                      className="px-3 py-1.5 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-bold hover:bg-orange-200 transition-all cursor-pointer"
                    >
                      Show All Counsellors
                    </button>
                  )}
                </div>
              ) : (
                pagedList.map((enq) => {
                  const isSelected = activeEnquiry?.id === enq.id;
                  const audio = enq.audioRecording;
                  const status = audio?.reviewStatus || "Pending";

                  return (
                    <div
                      key={enq.id}
                      onClick={() => setSelectedId(enq.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? "bg-orange-50/90 dark:bg-orange-950/40 border-orange-500 shadow-md ring-2 ring-orange-500/20"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md">
                              {enq.enquiryNo}
                            </span>
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                              {enq.applyingForClass}
                            </span>
                          </div>
                          <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1 truncate">
                            {enq.studentName}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>👤 {enq.counsellorName}</span>
                            <span>•</span>
                            <span>📞 {enq.contactNo}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            status === "Reviewed - Approved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : status === "Follow-up Required"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {status}
                          </span>
                          <div className="flex items-center justify-end gap-1 text-[11px] font-mono text-slate-400 mt-1">
                            <Clock size={11} />
                            <span>{formatAudioDuration(audio?.durationSeconds || 0)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Star Rating preview if already reviewed */}
                      {audio?.qualityRating && audio.qualityRating > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map(st => (
                              <Star 
                                key={st} 
                                size={12} 
                                className={st <= (audio.qualityRating || 0) ? "fill-amber-400" : "text-slate-300 dark:text-slate-700"} 
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-slate-400 italic truncate max-w-[180px]">
                            {audio.managementRemarks || "Audited"}
                          </span>
                        </div>
                      )}

                      {/* Counsellor Action Taken Pill */}
                      {audio?.counsellorActionTaken && (
                        <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check size={11} /> Counsellor Action Reported
                          </span>
                          <span className="text-slate-400 font-mono text-[9px]">
                            {audio.counsellorActionTimestamp?.split(" ")[0]}
                          </span>
                        </div>
                      )}

                      {/* Explicit Action Button: View Details & Audio */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          👨‍👩‍👧 {enq.fatherName || enq.motherName ? `${enq.fatherName || enq.motherName}` : "Parent Record"}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(enq.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 ${
                            isSelected
                              ? "bg-orange-600 text-white hover:bg-orange-700 ring-2 ring-orange-400/50"
                              : "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-orange-600 dark:hover:bg-orange-500 hover:text-white"
                          }`}
                        >
                          <Eye size={13} />
                          <span>View Data & Audio</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls Bar */}
            {filteredList.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                  <span>Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredList.length)} of {filteredList.length}</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    <option value={10}>10 / page</option>
                    <option value={20}>20 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg font-bold font-mono text-[11px]">
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: EXECUTIVE PLAYER & EVALUATION PANEL (7 COLS) */}
          <div className="lg:col-span-7 space-y-5">
            {activeEnquiry && activeEnquiry.audioRecording ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                
                {/* Audio Player Header */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 whitespace-nowrap">
                          {activeEnquiry.enquiryNo}
                        </span>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Meeting Audio Recording
                        </span>
                      </div>
                      <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                        {activeEnquiry.studentName} <span className="text-slate-400 font-normal">—</span> <span className="text-indigo-600 dark:text-indigo-400">Class {activeEnquiry.applyingForClass}</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>Counsellor: <strong className="text-slate-700 dark:text-slate-200 font-semibold">{activeEnquiry.counsellorName}</strong> ({activeEnquiry.counsellorId || "STAFF"})</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">Recorded: {activeEnquiry.audioRecording.recordedAt}</span>
                      </p>
                    </div>

                    {/* Sleek Cohesive Action Toolbar */}
                    <div className="flex items-center gap-1.5 self-start md:self-auto flex-wrap">
                      <button
                        type="button"
                        onClick={() => setShowTranslationModal(true)}
                        className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Translate multilingual recording into English with Voice playback"
                      >
                        <Languages size={13} />
                        <span>Translate & Voice Studio</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadAudio}
                        className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                        title="Download audio recording (.webm)"
                      >
                        <Download size={13} className="text-slate-500 dark:text-slate-400" />
                        <span>Audio</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadTextFile}
                        className="px-2.5 py-1.5 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-750 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                        title="Download counselling minutes transcript text file (.txt)"
                      >
                        <FileText size={13} className="text-indigo-500 dark:text-indigo-400" />
                        <span>Minutes (.txt)</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDownloadBoth}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Download both Audio recording and Meeting Minutes Text file (.txt)"
                      >
                        <Download size={13} />
                        <span>Download Both</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyTranscript}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Copy full text transcript to clipboard"
                      >
                        {copiedTranscript ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} className="text-slate-400" />}
                        <span>{copiedTranscript ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  </div>

                  {/* ATTACHED PARENT ENQUIRY FORM DETAILS & CHECKLIST CARD (Directly Above Audio Player) */}
                  <div className="bg-[#0b1329] text-slate-100 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                    {/* Card Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="text-amber-400" size={17} />
                        <h4 className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-wider">
                          ATTACHED PARENT ENQUIRY FORM DETAILS &amp; CHECKLIST
                        </h4>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-lg bg-slate-800/90 border border-slate-700 text-slate-300 font-mono text-xs font-bold">
                        Ref: {activeEnquiry.enquiryNo}
                      </span>
                    </div>

                    {/* 3 Column Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                      {/* Column 1: Student Profile */}
                      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase pb-1.5 border-b border-slate-800">
                          <span>🎓</span>
                          <span>STUDENT PROFILE</span>
                        </div>
                        <div className="space-y-1 pt-0.5 leading-relaxed">
                          <div>
                            <span className="text-slate-400">Name: </span>
                            <strong className="text-white text-sm font-black tracking-wide uppercase">
                              {activeEnquiry.studentName}
                            </strong>
                          </div>
                          <div>
                            <span className="text-slate-400">Applying Class: </span>
                            <span className="text-amber-400 font-bold">
                              {activeEnquiry.applyingForClass || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">DOB: </span>
                            <span className="text-slate-200">{activeEnquiry.dateOfBirth || "N/A"}</span>
                            <span className="text-slate-500"> • </span>
                            <span className="text-slate-400">Gender: </span>
                            <span className="text-slate-200">{activeEnquiry.gender || "Male"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Previous School: </span>
                            <span className="text-slate-300">{activeEnquiry.previousSchool || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Previous Class: </span>
                            <span className="text-slate-300">{activeEnquiry.previousClass || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Academic History: </span>
                            <span className="text-slate-300">{activeEnquiry.academicPerformance || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 2: Parent Contact Info */}
                      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-xs font-black text-amber-400 uppercase pb-1.5 border-b border-slate-800">
                          <span>👨‍👩‍👧</span>
                          <span>PARENT CONTACT INFO</span>
                        </div>
                        <div className="space-y-1 pt-0.5 leading-relaxed">
                          <div>
                            <span className="text-slate-400">Father: </span>
                            <span className="text-slate-200">{activeEnquiry.fatherName || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Mother: </span>
                            <span className="text-slate-200">{activeEnquiry.motherName || "N/A"}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Primary Phone: </span>
                            <span className="text-cyan-400 font-mono font-black text-sm">
                              {activeEnquiry.contactNo || "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Preferred Channel: </span>
                            <span className="text-white font-bold">
                              {activeEnquiry.preferredContact || "WhatsApp"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400">Best Time: </span>
                            <span className="text-slate-200">{activeEnquiry.bestTimeToContact || "Morning (10 AM - 12 PM)"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Column 3: Disclosed Checklist (Hostel Removed) */}
                      <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 space-y-2 text-xs flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-400 uppercase pb-1.5 border-b border-slate-800">
                            <span>📋</span>
                            <span>DISCLOSED CHECKLIST</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-2 text-[11px] font-semibold">
                            <div className={activeEnquiry.explainedFeeStructure ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedFeeStructure ? "✓" : "✗"}</span>
                              <span>Fee Structure</span>
                            </div>
                            <div className={activeEnquiry.explainedSchoolFacilities ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedSchoolFacilities ? "✓" : "✗"}</span>
                              <span>School Amenities</span>
                            </div>
                            <div className={activeEnquiry.explainedAcademicProgramme ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedAcademicProgramme ? "✓" : "✗"}</span>
                              <span>Academics</span>
                            </div>
                            <div className={activeEnquiry.explainedActivitiesSports ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedActivitiesSports ? "✓" : "✗"}</span>
                              <span>Sports/Activities</span>
                            </div>
                            <div className={activeEnquiry.explainedSchoolRules ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedSchoolRules ? "✓" : "✗"}</span>
                              <span>School Rules</span>
                            </div>
                            <div className={activeEnquiry.explainedTransportDetails ? "text-emerald-400 flex items-center gap-1" : "text-slate-500 line-through flex items-center gap-1"}>
                              <span>{activeEnquiry.explainedTransportDetails ? "✓" : "✗"}</span>
                              <span>Transport Rules</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom line: Transport only, Hostel strictly removed as requested */}
                        <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300 font-semibold flex items-center justify-between">
                          <span>Transport: <strong className={activeEnquiry.transportRequired ? "text-emerald-400" : "text-slate-400"}>{activeEnquiry.transportRequired ? "Yes" : "No"}</strong></span>
                          {activeEnquiry.specialLearningSupport && (
                            <span className="text-amber-400">Special Support: Yes</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Sleek Interactive Audio Player Bar */}
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-xs space-y-1">
                    {/* Native Audio Element with robust source loading (hidden for zero clutter) */}
                    <audio
                      ref={audioRef}
                      src={resolvedAudioUrl || undefined}
                      preload="auto"
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setIsPlaying(false)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onError={(e) => console.warn("Management audio playback error:", e)}
                      className="hidden"
                    />

                    {/* Single Sleek Compact Player Row */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Play Button & Status */}
                      <div className="flex items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="w-9 h-9 rounded-xl bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shadow-sm transition-all cursor-pointer active:scale-95 shrink-0"
                          title={isPlaying ? "Pause audio" : "Play audio"}
                        >
                          {isPlaying ? <Pause size={17} /> : <Play size={17} className="ml-0.5" />}
                        </button>
                        <div className="leading-tight">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {isPlaying ? "Playing Meeting Audio" : "Paused"}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            Size: {formatAudioFileSize(activeEnquiry.audioRecording.fileSizeBytes)}
                          </p>
                        </div>
                      </div>

                      {/* Scrubber & Timers */}
                      <div className="flex-1 min-w-[180px] flex items-center gap-2 px-1">
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatAudioDuration(currentTime)}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={duration || activeEnquiry.audioRecording.durationSeconds || 100}
                          value={currentTime}
                          onChange={handleSeek}
                          className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                          {formatAudioDuration(duration || activeEnquiry.audioRecording.durationSeconds)}
                        </span>
                      </div>

                      {/* Speed Controller for Fast Listening */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shrink-0">
                        <span className="text-[9px] uppercase font-bold text-slate-400 px-1">Speed:</span>
                        {[1, 1.25, 1.5, 2].map((spd) => (
                          <button
                            type="button"
                            key={spd}
                            onClick={() => handleSpeedChange(spd)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                              playbackSpeed === spd
                                ? "bg-orange-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clean Side-by-Side Single Line Strip (No Clutter, No Confusing Badges) */}
                <div className="px-4 py-2.5 bg-slate-100/90 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
                    {/* Student Name & Applying Class */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {activeEnquiry.enquiryNo}
                      </span>
                      <span className="font-black text-slate-900 dark:text-white truncate">
                        🎓 {activeEnquiry.studentName}
                      </span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                        Class {activeEnquiry.applyingForClass}
                      </span>
                    </div>

                    {/* Parent Contact Info */}
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Parent:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeEnquiry.fatherName || activeEnquiry.motherName || "Parent"}
                      </span>
                      <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold ml-1">
                        📞 {activeEnquiry.contactNo}
                      </span>
                    </div>

                    {/* Counsellor */}
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">Counsellor:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {activeEnquiry.counsellorName}
                      </span>
                    </div>

                    {/* Follow-up Date */}
                    {activeEnquiry.followUpDate && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <span>📅 Next:</span>
                        <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{activeEnquiry.followUpDate}</strong>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider flex items-center gap-1 ${
                        activeEnquiry.admissionStatus === "Admission Confirmed"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : activeEnquiry.admissionStatus === "Interested" || activeEnquiry.admissionStatus === "Application Taken"
                          ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                          : activeEnquiry.admissionStatus === "Follow-up Required"
                          ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/30"
                          : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                        <span>Status: {activeEnquiry.admissionStatus || "Pending"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Optional Follow-up History (Only if logs exist, clean & compact) */}
                {activeEnquiry.followUpLogs && activeEnquiry.followUpLogs.length > 0 && (
                  <div className="px-4 py-2 bg-indigo-50/40 dark:bg-indigo-950/20 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1">
                      <span>📞 Follow-ups ({activeEnquiry.followUpLogs.length}):</span>
                      <span className="text-slate-600 dark:text-slate-400 font-normal truncate max-w-sm">
                        {activeEnquiry.followUpLogs[activeEnquiry.followUpLogs.length - 1].notes}
                      </span>
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {activeEnquiry.followUpLogs[activeEnquiry.followUpLogs.length - 1].timestamp}
                    </span>
                  </div>
                )}

                {/* DEDICATED VERBATIM CONVERSATION TRANSCRIPT & DIALOGUE PANEL */}
                <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 tracking-wider">
                        Verbatim Meeting Conversation Transcript
                      </h4>
                      {transcriptTurns.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold font-mono">
                          {transcriptTurns.length} Spoken Turns
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Search in transcript */}
                      <div className="relative">
                        <input
                          type="text"
                          value={transcriptSearch}
                          onChange={(e) => setTranscriptSearch(e.target.value)}
                          placeholder="Search speech (fee, bus, syllabus)..."
                          className="px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44 sm:w-56"
                        />
                        {transcriptSearch && (
                          <button
                            type="button"
                            onClick={() => setTranscriptSearch("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Tab buttons: Dialogue turns vs Key Notes */}
                      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setTranscriptTab("dialogue")}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            transcriptTab === "dialogue"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          💬 Spoken Dialogue
                        </button>
                        <button
                          type="button"
                          onClick={() => setTranscriptTab("notes")}
                          className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                            transcriptTab === "notes"
                              ? "bg-indigo-600 text-white shadow-xs"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                          }`}
                        >
                          📝 Key Points
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Transcript Content Box */}
                  <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    {transcriptTab === "dialogue" ? (
                      filteredTurns.length > 0 ? (
                        filteredTurns.map((turn) => {
                          const isCounsellor = (turn.speaker || "").toLowerCase().includes("counsellor") || (turn.speaker || "").toLowerCase().includes("staff");
                          return (
                            <div
                              key={turn.id}
                              className={`p-2.5 rounded-xl border flex items-start gap-2.5 transition-all ${
                                isCounsellor
                                  ? "bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200/70 dark:border-indigo-900/40"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              <div
                                className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5 ${
                                  isCounsellor ? "bg-indigo-600" : "bg-purple-600"
                                }`}
                              >
                                {isCounsellor ? <User size={13} /> : <Users size={13} />}
                              </div>
                              <div className="flex-1 space-y-0.5 min-w-0">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {turn.speaker}
                                  </span>
                                  <span className="font-mono text-slate-400">
                                    {turn.timeStr}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                                  &ldquo;{turn.text}&rdquo;
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : activeEnquiry.audioRecording?.meetingTextSummary ? (
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-sans">
                          {activeEnquiry.audioRecording.meetingTextSummary}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 space-y-1">
                          <p className="font-bold text-xs">No Dialogue Turns Transcribed Yet</p>
                          <p className="text-[11px]">Recording audio was captured. Live speech transcript will appear here when recorded via Counselling Portal.</p>
                        </div>
                      )
                    ) : (
                      /* Key Points & Audited Parent Queries Tab */
                      parsedNotes ? (
                        <div className="space-y-3">
                          {parsedNotes.auditedParentQueries && parsedNotes.auditedParentQueries.length > 0 && (
                            <div className="space-y-1.5">
                              <h5 className="text-[11px] font-black uppercase text-purple-700 dark:text-purple-300">
                                🗣️ Parent Questions Captured:
                              </h5>
                              <div className="space-y-1">
                                {parsedNotes.auditedParentQueries.map((q, idx) => (
                                  <div key={idx} className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 text-xs text-purple-950 dark:text-purple-200">
                                    <span className="font-bold">[{q.topic}]</span> &ldquo;{q.question}&rdquo;
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedNotes.keyDiscussionPoints && parsedNotes.keyDiscussionPoints.length > 0 && (
                            <div className="space-y-1.5">
                              <h5 className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300">
                                📌 Key Discussion Highlights:
                              </h5>
                              <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300">
                                {parsedNotes.keyDiscussionPoints.map((pt, idx) => (
                                  <li key={idx}>{pt}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs">
                          No key discussion points generated yet for this recording.
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* EXECUTIVE MANAGEMENT QUALITY EVALUATION & COACHING (Ultra-Compact at the ending) */}
                {userRole === "Counsellor" ? (
                  /* READ-ONLY VIEW FOR COUNSELLORS: Slim Single Strip */
                  <div className="px-4 py-2 bg-gradient-to-r from-indigo-50/70 to-purple-50/50 dark:from-indigo-950/40 dark:to-purple-950/30 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Award size={13} className="text-indigo-600 dark:text-indigo-400" />
                      <span className="text-[10px] font-black uppercase text-indigo-950 dark:text-indigo-200 tracking-wider">
                        Management Review:
                      </span>
                      <div className="flex items-center gap-0.5 text-amber-400">
                        {[1, 2, 3, 4, 5].map((st) => (
                          <Star
                            key={st}
                            size={11}
                            className={st <= (activeEnquiry.audioRecording?.qualityRating || 0) ? "fill-amber-400" : "text-slate-300 dark:text-slate-700"}
                          />
                        ))}
                      </div>
                      <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">
                        ({activeEnquiry.audioRecording?.qualityRating || 5}/5)
                      </span>
                    </div>

                    <div className="flex-1 min-w-[180px] text-[11px] text-slate-600 dark:text-slate-300 truncate italic">
                      "{activeEnquiry.audioRecording?.managementRemarks || "Good counselling communication. Continue scheduled follow-up."}"
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      {activeEnquiry.audioRecording?.reviewStatus || "Approved"}
                    </span>
                  </div>
                ) : (
                  /* INTERACTIVE EVALUATION FORM FOR MANAGEMENT - Ultra-Compact at ending */
                  <form onSubmit={handleSaveReview} className="px-4 py-2 bg-indigo-50/30 dark:bg-indigo-950/20 border-t border-slate-200 dark:border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <Award size={13} className="text-indigo-600 dark:text-indigo-400" />
                        <span className="font-black uppercase text-indigo-900 dark:text-indigo-300 tracking-wider">
                          Management Quality Evaluation
                        </span>
                        {saveSuccessMsg && (
                          <span className="text-emerald-600 font-bold ml-1.5">✓ Saved!</span>
                        )}
                      </div>

                      {/* Compact Star Rating */}
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-500">Rating:</span>
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((starVal) => (
                            <button
                              type="button"
                              key={starVal}
                              onClick={() => setReviewRating(starVal)}
                              className="p-0.5 hover:scale-110 cursor-pointer"
                            >
                              <Star
                                size={13}
                                className={starVal <= reviewRating ? "text-amber-400 fill-amber-400" : "text-slate-300 dark:text-slate-600"}
                              />
                            </button>
                          ))}
                        </div>
                        <span className="font-bold text-[10px] text-slate-600 dark:text-slate-300 ml-0.5">
                          {reviewRating}/5
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value as any)}
                        className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold text-slate-900 dark:text-white shrink-0 focus:outline-none"
                      >
                        <option value="Reviewed - Approved">Reviewed & Approved</option>
                        <option value="Follow-up Required">Follow-up Required</option>
                        <option value="Pending">Pending Audit</option>
                      </select>

                      <input
                        type="text"
                        value={reviewRemarks}
                        onChange={(e) => setReviewRemarks(e.target.value)}
                        placeholder="Evaluation feedback & coaching remarks..."
                        className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />

                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95 shadow-xs"
                      >
                        <CheckCircle size={12} />
                        <span>Save Evaluation</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <Headphones size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    No Recorded Meetings Available
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    {filterCounsellor !== "ALL" 
                      ? `There are currently no recorded audio meetings found for ${filterCounsellor}${filterDate ? ` on ${filterDate}` : ""}. Select another counsellor or clear filters.`
                      : filterDate 
                        ? `No recorded audio meetings found for ${filterDate}. Clear the date filter to view all meetings.`
                        : "Select a recorded meeting from the left list to view student details, audio player, and AI transcript."}
                  </p>
                </div>
                {(filterCounsellor !== "ALL" || filterDate || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCounsellor("ALL");
                      setFilterDate("");
                      setSearchQuery("");
                    }}
                    className="px-4 py-2 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-xl text-xs font-bold hover:bg-orange-200 transition-all cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Trilingual Audio Translation & Voice Studio Modal */}
      {activeEnquiry && activeEnquiry.audioRecording && (
        <AudioTranslationModal
          isOpen={showTranslationModal}
          onClose={() => setShowTranslationModal(false)}
          audioBase64={activeEnquiry.audioRecording.audioData || undefined}
          audioUrl={activeEnquiry.audioRecording.audioUrl || resolvedAudioUrl || undefined}
          audioStorageKey={activeEnquiry.audioRecording.storageKey || activeEnquiry.audioRecording.id}
          mimeType={activeEnquiry.audioRecording.mimeType || "audio/webm"}
          liveSpeechText={activeEnquiry.audioRecording.meetingTextSummary || ""}
          studentName={activeEnquiry.studentName}
          applyingForClass={activeEnquiry.applyingForClass}
          counsellorName={activeEnquiry.counsellorName}
          parentLanguage={activeEnquiry.audioRecording.parentLanguage || "English (Multilingual)"}
          enquiryNo={activeEnquiry.enquiryNo}
          existingTranslation={
            activeEnquiry.audioRecording.translatedTranscript || (activeEnquiry.audioRecording.translatedDialogueTurns && activeEnquiry.audioRecording.translatedDialogueTurns.length > 0) ? {
              dialogueTurns: activeEnquiry.audioRecording.translatedDialogueTurns as any,
              summary: activeEnquiry.audioRecording.translationSummary,
              fullEnglishTranscript: activeEnquiry.audioRecording.translatedTranscript,
              translatedAudioData: activeEnquiry.audioRecording.translatedAudioData,
              translatedAudioMimeType: activeEnquiry.audioRecording.translatedAudioMimeType,
            } : undefined
          }
          onSaveTranslation={(transData: AudioTranslationData) => {
            if (activeEnquiry.audioRecording) {
              const updatedAudio: CounsellingAudioRecord = {
                ...activeEnquiry.audioRecording,
                translatedTranscript: transData.fullEnglishTranscript,
                translatedDialogueTurns: transData.dialogueTurns as any,
                translationSummary: transData.summary,
                translatedAudioData: transData.translatedAudioData,
                translatedAudioMimeType: transData.translatedAudioMimeType,
                translatedAt: transData.translatedAt || new Date().toISOString()
              };
              const updatedEnq: CounsellingEnquiry = {
                ...activeEnquiry,
                audioRecording: updatedAudio,
                updatedAt: new Date().toLocaleDateString()
              };
              onUpdateEnquiry(updatedEnq);
            }
          }}
          onSaveToRemarks={(notesText) => {
            const updatedEnq: CounsellingEnquiry = {
              ...activeEnquiry,
              officeRemarks: (activeEnquiry.officeRemarks ? activeEnquiry.officeRemarks + "\n\n" : "") + notesText,
              updatedAt: new Date().toLocaleDateString()
            };
            onUpdateEnquiry(updatedEnq);
          }}
        />
      )}
    </div>
  );
}
