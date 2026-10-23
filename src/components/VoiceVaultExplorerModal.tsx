import React, { useState, useEffect } from "react";
import { 
  Mic, 
  Search, 
  Filter, 
  Calendar, 
  User, 
  Clock, 
  Play, 
  Pause, 
  Download, 
  Trash2, 
  Cloud, 
  FileText, 
  CheckCircle2, 
  X, 
  Volume2, 
  Headphones, 
  Copy, 
  Check, 
  SlidersHorizontal,
  Phone,
  Sparkles,
  GraduationCap,
  RefreshCw,
  AlertTriangle
} from "lucide-react";
import { CounsellingEnquiry } from "../types";
import { getAudioRecordingBlob, deleteAudioRecordingBlob, formatAudioDuration, formatAudioFileSize, generateFallbackAudioBlob, ensurePlayableAudioUrl, playWithWebAudio, stopWebAudio } from "../utils/audioStorage";
import { getAudioVaultSyncInfo, listDriveFiles, DriveFileItem } from "../utils/googleDrive";

interface VoiceVaultExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  counsellingEnquiries: CounsellingEnquiry[];
  onUpdateEnquiry?: (enquiry: CounsellingEnquiry) => void;
  onSyncSingleAudio?: (enquiry: CounsellingEnquiry) => Promise<void>;
  isUploading?: boolean;
}

export default function VoiceVaultExplorerModal({
  isOpen,
  onClose,
  counsellingEnquiries = [],
  onUpdateEnquiry,
  onSyncSingleAudio,
  isUploading = false
}: VoiceVaultExplorerModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"ALL" | "TODAY" | "7DAYS" | "THIS_MONTH" | "CUSTOM">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [counsellorFilter, setCounsellorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Audio Playback State
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteEnquiry, setConfirmDeleteEnquiry] = useState<CounsellingEnquiry | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);

  // Multi-Selection State for Bulk Audio Recording Deletion
  const [selectedEnquiryIds, setSelectedEnquiryIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      listDriveFiles("Counselling Voice Vault")
        .then(files => setDriveFiles(files))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter enquiries that actually contain an audioRecording
  const recordsWithAudio = counsellingEnquiries.filter((e) => Boolean(e.audioRecording));

  // Extract unique counsellors
  const uniqueCounsellors = Array.from(
    new Set(
      recordsWithAudio
        .map((e) => e.counsellorName || e.audioRecording?.counsellorName)
        .filter(Boolean) as string[]
    )
  );

  // Extract unique statuses
  const uniqueStatuses = Array.from(
    new Set(recordsWithAudio.map((e) => e.admissionStatus).filter(Boolean) as string[])
  );

  // Filter records based on search & filters (Date-wise, Name-wise, Status-wise)
  const filteredRecords = recordsWithAudio.filter((e) => {
    const rec = e.audioRecording;
    if (!rec) return false;

    // 1. Name & Text Search (Name-wise, Enquiry-wise, Phone-wise, Keyword-wise)
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const studentMatch = (e.studentName || "").toLowerCase().includes(q);
      const enquiryNoMatch = (e.enquiryNo || "").toLowerCase().includes(q);
      const fatherMatch = (e.fatherName || "").toLowerCase().includes(q);
      const motherMatch = (e.motherName || "").toLowerCase().includes(q);
      const phoneMatch = (e.contactNo || e.whatsappNo || "").toLowerCase().includes(q);
      const counsellorMatch = (e.counsellorName || rec.counsellorName || "").toLowerCase().includes(q);
      const summaryMatch = (rec.meetingTextSummary || rec.conversationLanguageNotes || "").toLowerCase().includes(q);
      const classMatch = (e.applyingForClass || "").toLowerCase().includes(q);

      if (
        !studentMatch &&
        !enquiryNoMatch &&
        !fatherMatch &&
        !motherMatch &&
        !phoneMatch &&
        !counsellorMatch &&
        !summaryMatch &&
        !classMatch
      ) {
        return false;
      }
    }

    // 2. Date-wise Filter
    const recDate = e.date || rec.recordedAt?.slice(0, 10);
    if (dateFilter !== "ALL" && recDate) {
      const today = new Date().toISOString().slice(0, 10);
      if (dateFilter === "TODAY" && recDate !== today) return false;

      if (dateFilter === "7DAYS") {
        const recTime = new Date(recDate).getTime();
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (isNaN(recTime) || recTime < sevenDaysAgo) return false;
      }

      if (dateFilter === "THIS_MONTH") {
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (!recDate.startsWith(currentMonth)) return false;
      }

      if (dateFilter === "CUSTOM") {
        if (startDate && recDate < startDate) return false;
        if (endDate && recDate > endDate) return false;
      }
    }

    // 3. Counsellor Filter
    if (counsellorFilter !== "ALL") {
      const cName = (e.counsellorName || rec.counsellorName || "").toLowerCase();
      if (cName !== counsellorFilter.toLowerCase()) return false;
    }

    // 4. Admission Status Filter
    if (statusFilter !== "ALL") {
      if ((e.admissionStatus || "").toLowerCase() !== statusFilter.toLowerCase()) return false;
    }

    return true;
  });

  // Calculate statistics
  const totalAudioSeconds = recordsWithAudio.reduce(
    (acc, curr) => acc + (curr.audioRecording?.durationSeconds || 0),
    0
  );
  const totalAudioBytes = recordsWithAudio.reduce(
    (acc, curr) => acc + (curr.audioRecording?.fileSizeBytes || 0),
    0
  );

  // Play audio handler
  const handleTogglePlay = async (enquiry: CounsellingEnquiry) => {
    const rec = enquiry.audioRecording;
    if (!rec) return;

    if (playingId === enquiry.id) {
      setPlayingId(null);
      return;
    }

    // Check if we already have an audio Blob URL
    if (audioUrls[enquiry.id]) {
      setPlayingId(enquiry.id);
      return;
    }

    // Attempt to load from IndexedDB first, then audioData, then driveFileUrl, audioUrl
    let srcUrl: string | null = null;

    if (rec.storageKey || rec.id) {
      try {
        const blobData = await getAudioRecordingBlob(rec.storageKey || rec.id);
        if (blobData) {
          if (typeof blobData === "string") {
            srcUrl = ensurePlayableAudioUrl(blobData);
          } else if (blobData instanceof Blob) {
            srcUrl = URL.createObjectURL(blobData);
          }
        }
      } catch (err) {
        console.warn("Error fetching audio blob from IndexedDB:", err);
      }
    }

    if (!srcUrl && rec.audioData) {
      srcUrl = ensurePlayableAudioUrl(rec.audioData);
    }

    if (!srcUrl && rec.driveFileUrl && !rec.driveFileUrl.startsWith("blob:")) {
      srcUrl = ensurePlayableAudioUrl(rec.driveFileUrl);
    }

    if (!srcUrl && rec.audioUrl && !rec.audioUrl.startsWith("blob:")) {
      srcUrl = ensurePlayableAudioUrl(rec.audioUrl);
    }

    if (srcUrl) {
      setAudioUrls((prev) => ({ ...prev, [enquiry.id]: srcUrl! }));
      setPlayingId(enquiry.id);
    } else {
      const fallbackBlob = generateFallbackAudioBlob();
      const fallbackUrl = URL.createObjectURL(fallbackBlob);
      setAudioUrls((prev) => ({ ...prev, [enquiry.id]: fallbackUrl }));
      setPlayingId(enquiry.id);
    }
  };

  // Download audio handler
  const handleDownloadAudio = async (enquiry: CounsellingEnquiry) => {
    const rec = enquiry.audioRecording;
    if (!rec) return;

    let srcUrl = audioUrls[enquiry.id] || rec.driveFileUrl || rec.audioUrl || rec.audioData || null;

    if (!srcUrl && rec.storageKey) {
      const blobData = await getAudioRecordingBlob(rec.storageKey);
      if (blobData instanceof Blob) {
        srcUrl = URL.createObjectURL(blobData);
      } else if (typeof blobData === "string") {
        srcUrl = blobData;
      }
    }

    if (srcUrl) {
      const a = document.createElement("a");
      a.href = srcUrl;
      a.download = rec.fileName || `Voice_${enquiry.enquiryNo}_${enquiry.studentName}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      alert("Could not load audio file for download.");
    }
  };

  // Delete Voice Recording Prompt Handler
  const handleDeleteAudio = (enquiry: CounsellingEnquiry) => {
    if (!enquiry.audioRecording) return;
    setConfirmDeleteEnquiry(enquiry);
  };

  // Confirmed Delete Audio Execution
  const executeDeleteAudio = async () => {
    if (!confirmDeleteEnquiry || !confirmDeleteEnquiry.audioRecording) return;
    const enquiry = confirmDeleteEnquiry;
    const rec = enquiry.audioRecording;

    setDeletingId(enquiry.id);
    try {
      if (rec.storageKey) {
        await deleteAudioRecordingBlob(rec.storageKey).catch(() => {});
      }
      if (rec.id) {
        await deleteAudioRecordingBlob(rec.id).catch(() => {});
      }

      // Call server backend to remove audio from disk and counselling.json
      try {
        fetch(`/api/counselling/${encodeURIComponent(enquiry.id)}/audio`, {
          method: "DELETE"
        }).catch(() => {});
      } catch (_) {}

      // Update enquiry by stripping audioRecording
      const updated: CounsellingEnquiry = {
        ...enquiry,
        audioRecording: undefined,
        removeAudio: true
      };

      if (onUpdateEnquiry) {
        onUpdateEnquiry(updated);
      }

      // Clean audio URL cache
      setAudioUrls((prev) => {
        const copy = { ...prev };
        delete copy[enquiry.id];
        return copy;
      });
      if (playingId === enquiry.id) {
        setPlayingId(null);
      }
    } catch (err: any) {
      console.error("Failed to delete recording:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteEnquiry(null);
    }
  };

  // Confirmed Bulk Delete Audio Recordings Execution
  const executeBulkDeleteAudios = async () => {
    if (selectedEnquiryIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const targetIds = [...selectedEnquiryIds];
      for (const id of targetIds) {
        const enquiry = counsellingEnquiries.find(e => e.id === id);
        if (enquiry && enquiry.audioRecording) {
          const rec = enquiry.audioRecording;
          if (rec.storageKey) await deleteAudioRecordingBlob(rec.storageKey).catch(() => {});
          if (rec.id) await deleteAudioRecordingBlob(rec.id).catch(() => {});
          try {
            await fetch(`/api/counselling/${encodeURIComponent(enquiry.id)}/audio`, { method: "DELETE" }).catch(() => {});
          } catch (_) {}
          const updated: CounsellingEnquiry = {
            ...enquiry,
            audioRecording: undefined,
            removeAudio: true
          };
          if (onUpdateEnquiry) onUpdateEnquiry(updated);
        }
      }
      setSelectedEnquiryIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err: any) {
      console.error("Bulk delete audio error:", err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const isAllEnquiriesSelected = filteredRecords.length > 0 && selectedEnquiryIds.length === filteredRecords.length;

  const handleSelectAllEnquiries = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedEnquiryIds(filteredRecords.map((e) => e.id));
    } else {
      setSelectedEnquiryIds([]);
    }
  };

  const handleToggleSelectEnquiry = (id: string) => {
    setSelectedEnquiryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Copy transcript summary
  const handleCopyTranscript = (enquiryId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(enquiryId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-orange-600 text-white flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl text-white">
              <Mic size={22} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold tracking-tight flex items-center gap-2">
                <span>Voice Vault Explorer</span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-900/50 text-amber-200 rounded-full font-bold border border-amber-400/30">
                  {recordsWithAudio.length} Voice Records
                </span>
              </h2>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Ticketing Tool style date-wise & name-wise voice search, playback, transcripts & server vault sync
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all cursor-pointer"
            title="Close Explorer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats Summary Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-3 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Mic className="text-amber-500 shrink-0" size={16} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Total Audio Records</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{recordsWithAudio.length} Files</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Clock className="text-blue-500 shrink-0" size={16} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Total Audio Duration</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{formatAudioDuration(totalAudioSeconds)}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <Cloud className="text-emerald-500 shrink-0" size={16} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Drive Synced</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {recordsWithAudio.filter((e) => e.audioRecording?.driveFileId).length} / {recordsWithAudio.length}
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2">
            <FileText className="text-indigo-500 shrink-0" size={16} />
            <div>
              <p className="text-[10px] text-slate-500 uppercase font-bold">Vault Storage Used</p>
              <p className="text-sm font-black text-slate-900 dark:text-white">{formatAudioFileSize(totalAudioBytes)}</p>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar (Ticketing Tool Style) */}
        <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Name / Keyword / Phone Search */}
            <div className="md:col-span-5 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search by Student Name, Enquiry No, Parent, Phone, Keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none font-medium"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date-wise Filter Dropdown */}
            <div className="md:col-span-3 relative">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5">
                <Calendar className="text-amber-600 shrink-0" size={15} />
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 dark:text-white outline-none cursor-pointer"
                >
                  <option value="ALL">📅 All Recording Dates</option>
                  <option value="TODAY">⚡ Today's Recordings</option>
                  <option value="7DAYS">📆 Last 7 Days</option>
                  <option value="THIS_MONTH">🗓️ This Month</option>
                  <option value="CUSTOM">🔍 Custom Date Range</option>
                </select>
              </div>
            </div>

            {/* Counsellor Filter */}
            <div className="md:col-span-2">
              <select
                value={counsellorFilter}
                onChange={(e) => setCounsellorFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL">👤 All Counsellors</option>
                {uniqueCounsellors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Admission Status Filter */}
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800 dark:text-white outline-none cursor-pointer"
              >
                <option value="ALL">📊 All Statuses</option>
                {uniqueStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Date Range Picker Inputs */}
          {dateFilter === "CUSTOM" && (
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl flex flex-wrap items-center gap-3 text-xs animate-fade-in">
              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <SlidersHorizontal size={13} /> Select Date Range:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="text-amber-700 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  Clear Range
                </button>
              )}
            </div>
          )}
        </div>

        {/* Voice Records List Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
          {/* BULK SELECTION ACTION BAR */}
          {filteredRecords.length > 0 && (
            <div className="p-3 bg-amber-500/10 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                <input 
                  type="checkbox" 
                  checked={isAllEnquiriesSelected} 
                  onChange={handleSelectAllEnquiries} 
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600" 
                />
                <span>
                  {selectedEnquiryIds.length > 0
                    ? `Selected ${selectedEnquiryIds.length} recording(s) out of ${filteredRecords.length}`
                    : `Select All ${filteredRecords.length} Voice Recordings`}
                </span>
              </div>

              {selectedEnquiryIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBulkDeleteModalOpen(true)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>Delete Selected ({selectedEnquiryIds.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedEnquiryIds([])}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                  >
                    Clear Selection
                  </button>
                </div>
              )}
            </div>
          )}

          {filteredRecords.length === 0 ? (
            <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center mx-auto">
                <Mic size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {recordsWithAudio.length === 0
                    ? "Voice Vault is Empty (0 Records)"
                    : "No Voice Recordings Match Search Criteria"}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {recordsWithAudio.length === 0
                    ? "All voice recordings have been deleted or none were saved. Record new calls in the Counselling Portal to populate Voice Vault."
                    : "Try adjusting your date filter or search query to locate voice recordings."}
                </p>
              </div>
              {(searchQuery || dateFilter !== "ALL" || counsellorFilter !== "ALL" || statusFilter !== "ALL") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setDateFilter("ALL");
                    setCounsellorFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Reset All Filters
                </button>
              )}
            </div>
          ) : (
            filteredRecords.map((enquiry) => {
              const rec = enquiry.audioRecording!;
              const isPlaying = playingId === enquiry.id;
              const rawSrc = audioUrls[enquiry.id] || rec.driveFileUrl || rec.audioUrl || rec.audioData;
              const currentAudioSrc = ensurePlayableAudioUrl(rawSrc);
              const isSelected = selectedEnquiryIds.includes(enquiry.id);

              return (
                <div
                  key={enquiry.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-all space-y-4 ${
                    isSelected ? "border-amber-500/80 ring-2 ring-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20" : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Top Bar: Student Details & Status */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleToggleSelectEnquiry(enquiry.id)} 
                          className="w-4 h-4 text-amber-600 rounded cursor-pointer accent-amber-600 mr-1"
                        />
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <User size={16} className="text-amber-600" />
                          <span>{enquiry.studentName}</span>
                        </h3>
                        <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-md text-[11px] font-bold">
                          {enquiry.enquiryNo}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md text-[11px] font-medium flex items-center gap-1">
                          <GraduationCap size={12} /> {enquiry.applyingForClass}
                        </span>
                        {enquiry.admissionStatus && (
                          <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md text-[11px] font-bold">
                            {enquiry.admissionStatus}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" /> Parent: {enquiry.contactNo || enquiry.fatherName || enquiry.motherName}
                        </span>
                        <span className="flex items-center gap-1">
                          <User size={12} className="text-slate-400" /> Counsellor: {enquiry.counsellorName || rec.counsellorName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-slate-400" /> Recorded: {enquiry.date || rec.recordedAt?.slice(0, 10)}
                        </span>
                      </div>
                    </div>

                    {/* Sync Badge & Quick Meta */}
                    {(() => {
                      const syncInfo = getAudioVaultSyncInfo(enquiry, driveFiles);
                      return (
                        <div className="flex items-center gap-2 shrink-0" title={syncInfo.details}>
                          <span className={`px-2.5 py-1 ${syncInfo.badgeBg} ${syncInfo.badgeTextColor} border ${syncInfo.badgeBorderColor} rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs`}>
                            {syncInfo.syncState === 'DRIVE_CLOUD_SYNCED' && <Cloud size={13} className="text-emerald-500" />}
                            {syncInfo.syncState === 'SERVER_VAULT_SYNCED' && <CheckCircle2 size={13} className="text-blue-500" />}
                            {syncInfo.syncState === 'DRIVE_REMOTE_DELETED' && <AlertTriangle size={13} className="text-amber-500" />}
                            {syncInfo.syncState === 'LOCAL_INDEXEDDB_ONLY' && <Clock size={13} className="text-indigo-500" />}
                            <span>{syncInfo.badgeLabel}</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Audio Player Strip */}
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleTogglePlay(enquiry)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all shadow-md cursor-pointer ${
                          isPlaying
                            ? "bg-amber-600 text-white ring-4 ring-amber-500/30 scale-105"
                            : "bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white"
                        }`}
                      >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
                      </button>

                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          <span>{rec.fileName || `Meeting_Audio_${enquiry.studentName}.webm`}</span>
                          <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {formatAudioDuration(rec.durationSeconds || 0)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({formatAudioFileSize(rec.fileSizeBytes || 0)})
                          </span>
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Source: {rec.audioSource || "Microphone Audio Recording"} {rec.parentLanguage && `• Language: ${rec.parentLanguage}`}
                        </p>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 shrink-0">
                      {onSyncSingleAudio && !rec.driveFileId && (
                        <button
                          onClick={() => onSyncSingleAudio(enquiry)}
                          disabled={isUploading}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          title="Upload audio record to 24/7 Server Vault"
                        >
                          <Cloud size={13} />
                          {isUploading ? "Syncing..." : "Sync to Server Vault"}
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadAudio(enquiry)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        title="Download audio recording file"
                      >
                        <Download size={13} />
                        Download
                      </button>

                      <button
                        onClick={() => handleDeleteAudio(enquiry)}
                        disabled={deletingId === enquiry.id}
                        className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                        title="Delete recording from Voice Vault"
                      >
                        <Trash2 size={13} />
                        <span className="hidden md:inline">Delete</span>
                      </button>
                    </div>
                  </div>

                  {/* HTML5 Audio element player if playing */}
                  {isPlaying && currentAudioSrc && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl animate-fade-in">
                      <audio
                        src={currentAudioSrc}
                        controls
                        autoPlay
                        preload="auto"
                        onEnded={() => setPlayingId(null)}
                        onError={(e) => {
                          console.warn("Voice Vault audio playback error, falling back to Web Audio Engine:", e);
                          playWithWebAudio(currentAudioSrc, () => setPlayingId(null));
                        }}
                        className="w-full h-8"
                      />
                    </div>
                  )}

                  {/* AI Meeting Summary & Transcript Box */}
                  {(rec.meetingTextSummary || rec.conversationLanguageNotes || enquiry.pointsDiscussed) && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Sparkles size={12} /> Counselling Call Transcript & Points Discussed
                        </span>
                        <button
                          onClick={() =>
                            handleCopyTranscript(
                              enquiry.id,
                              rec.meetingTextSummary || enquiry.pointsDiscussed || ""
                            )
                          }
                          className="text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer font-medium"
                        >
                          {copiedId === enquiry.id ? (
                            <>
                              <Check size={12} className="text-emerald-500" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy Notes
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                        {rec.meetingTextSummary || enquiry.pointsDiscussed || rec.conversationLanguageNotes}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 md:p-4 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> of{" "}
            <strong>{recordsWithAudio.length}</strong> voice records in Voice Vault
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl transition-all cursor-pointer"
          >
            Close Explorer
          </button>
        </div>
      </div>

      {/* Bulk Delete Audio Confirmation In-Modal Dialog */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Bulk Delete {selectedEnquiryIds.length} Selected Voice Recording(s)?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This will permanently delete the audio files from Voice Vault and 24/7 Server Vault for all selected student enquiries.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Selected Student Voice Recordings:
              </span>
              {counsellingEnquiries.filter(e => selectedEnquiryIds.includes(e.id)).map(e => (
                <div key={e.id} className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-medium py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <span>🎙️ {e.studentName} ({e.enquiryNo})</span>
                  <span className="font-mono text-[10px] text-slate-400">Class: {e.applyingForClass}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeBulkDeleteAudios}
                disabled={isBulkDeleting}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isBulkDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isBulkDeleting ? "Deleting Recordings..." : `Confirm Delete ${selectedEnquiryIds.length} Audios`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation In-Modal Dialog */}
      {confirmDeleteEnquiry && (
        <div className="fixed inset-0 z-[10001] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Voice Recording?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to delete the voice recording for{" "}
                <strong className="text-slate-800 dark:text-slate-200">
                  {confirmDeleteEnquiry.studentName} ({confirmDeleteEnquiry.enquiryNo})
                </strong>
                ? This will permanently remove the audio file and immediately update Voice Vault Status.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteEnquiry(null)}
                disabled={Boolean(deletingId)}
                className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteAudio}
                disabled={Boolean(deletingId)}
                className="py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {deletingId ? "Deleting..." : "Yes, Delete Audio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
