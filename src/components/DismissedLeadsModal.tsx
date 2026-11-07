import React, { useState, useMemo } from "react";
import { 
  X, 
  RotateCcw, 
  Trash2, 
  Search, 
  Globe, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Clock, 
  UserCheck, 
  Download, 
  AlertTriangle, 
  Zap, 
  Ticket,
  Filter,
  CheckCircle2,
  FolderArchive
} from "lucide-react";
import { ParentSelfEntry } from "../types";

interface DismissedLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  dismissedEntries: ParentSelfEntry[];
  onRestoreEntry: (entry: ParentSelfEntry) => void;
  onClaimEntry: (entry: ParentSelfEntry) => void;
  onPermanentDelete?: (id: string) => void;
  currentCounsellorName?: string;
  userRole?: string;
}

export const DismissedLeadsModal: React.FC<DismissedLeadsModalProps> = ({
  isOpen,
  onClose,
  dismissedEntries,
  onRestoreEntry,
  onClaimEntry,
  onPermanentDelete,
  currentCounsellorName,
  userRole
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "ONLINE" | "WALKIN">("ALL");
  const [actionToast, setActionToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3000);
  };

  const filteredList = useMemo(() => {
    let list = dismissedEntries || [];

    if (filterType === "ONLINE") {
      list = list.filter(e => e.enquiryType === "online");
    } else if (filterType === "WALKIN") {
      list = list.filter(e => e.enquiryType !== "online");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(e => 
        (e.studentName && e.studentName.toLowerCase().includes(q)) ||
        (e.contactNo && e.contactNo.includes(q)) ||
        (e.fatherName && e.fatherName.toLowerCase().includes(q)) ||
        (e.motherName && e.motherName.toLowerCase().includes(q)) ||
        (e.onlineRefNo && e.onlineRefNo.toLowerCase().includes(q)) ||
        (e.id && e.id.toLowerCase().includes(q)) ||
        (e.dailyTokenNo && String(e.dailyTokenNo).includes(q)) ||
        (e.dismissedBy && e.dismissedBy.toLowerCase().includes(q))
      );
    }

    // Sort by dismissedAt descending (most recently dismissed first)
    return list.slice().sort((a, b) => {
      const timeA = a.dismissedAt ? new Date(a.dismissedAt).getTime() : new Date(a.submittedAt).getTime();
      const timeB = b.dismissedAt ? new Date(b.dismissedAt).getTime() : new Date(b.submittedAt).getTime();
      return timeB - timeA;
    });
  }, [dismissedEntries, filterType, searchQuery]);

  const onlineCount = useMemo(() => {
    return (dismissedEntries || []).filter(e => e.enquiryType === "online").length;
  }, [dismissedEntries]);

  const walkinCount = useMemo(() => {
    return (dismissedEntries || []).filter(e => e.enquiryType !== "online").length;
  }, [dismissedEntries]);

  const handleExportCSV = () => {
    if (filteredList.length === 0) return;
    const headers = [
      "ID/Ref",
      "Type",
      "Student Name",
      "Class",
      "Parent Name",
      "Contact No",
      "Submitted At",
      "Dismissed By",
      "Dismissed At",
      "Reason"
    ];

    const rows = filteredList.map(e => [
      `"${e.onlineRefNo || (e.dailyTokenNo ? `Token #${e.dailyTokenNo}` : e.id)}"`,
      `"${e.enquiryType === "online" ? "Online Website/QR" : "Campus Walk-in"}"`,
      `"${e.studentName}"`,
      `"${e.applyingForClass}"`,
      `"${e.fatherName || e.motherName || "—"}"`,
      `"${e.contactNo || "—"}"`,
      `"${e.formattedDate || e.submittedAt || "—"}"`,
      `"${e.dismissedBy || "Counsellor"}"`,
      `"${e.dismissedAt ? new Date(e.dismissedAt).toLocaleString() : "—"}"`,
      `"${e.dismissedReason || "Dismissed from live queue"}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Birla_Dismissed_Leads_Report_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("✓ Exported dismissed leads to CSV report.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden my-auto">
        {/* Toast notification */}
        {actionToast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-950 text-white border border-emerald-500/50 rounded-xl text-xs font-bold shadow-xl animate-fade-in flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-400" />
            <span>{actionToast}</span>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <FolderArchive size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-wide">
                  DISMISSED LEADS ARCHIVE / రద్దయిన లీడ్స్ డేటా
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-xs font-black">
                  {dismissedEntries.length} Archived
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                All leads and walk-in tokens dismissed by any counsellor are safely preserved here. You can restore or claim them anytime!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {filteredList.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download CSV report of dismissed leads"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white/10 hover:bg-red-500/80 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search student, parent, phone, ref..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterType("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === "ALL"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              All ({dismissedEntries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType("ONLINE")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterType === "ONLINE"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              <Globe size={13} />
              <span>Online Leads ({onlineCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType("WALKIN")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                filterType === "WALKIN"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
              }`}
            >
              <Ticket size={13} />
              <span>Walk-ins ({walkinCount})</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh] space-y-3">
          {filteredList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredList.map((entry) => {
                const isOnline = entry.enquiryType === "online";
                const cleanPhone = (entry.contactNo || "").replace(/\D/g, "");
                const dismissedTime = entry.dismissedAt
                  ? new Date(entry.dismissedAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "Recently";

                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 relative overflow-hidden"
                  >
                    {/* Top Row: Ref pill & Dismissed Meta */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-2xs ${
                            isOnline
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                              : "bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {isOnline ? <Globe size={13} /> : <Ticket size={13} />}
                          <span>
                            {isOnline
                              ? `#${entry.onlineRefNo || entry.id}`
                              : `Token #${entry.dailyTokenNo || 1}`}
                          </span>
                        </span>

                        <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900 flex items-center gap-1">
                          <Clock size={11} />
                          <span>Dismissed {dismissedTime}</span>
                        </span>
                      </div>

                      {/* Student Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {entry.studentName}
                          </h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                            {entry.applyingForClass}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          Parent:{" "}
                          <strong className="text-slate-800 dark:text-slate-200">
                            {entry.fatherName || entry.motherName || "—"}
                          </strong>
                          {entry.contactNo && (
                            <span className="ml-2 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                              📞 {entry.contactNo}
                            </span>
                          )}
                        </p>
                        {entry.residentialAddress && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            📍 {entry.residentialAddress}
                          </p>
                        )}
                      </div>

                      {/* Dismissed By Audit Banner */}
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <UserCheck size={13} className="text-indigo-500 shrink-0" />
                          <span>
                            Dismissed by: <strong>{entry.dismissedBy || "Admissions Desk"}</strong>
                          </span>
                        </div>
                        {entry.submittedAt && (
                          <span className="text-[10px] text-slate-400">
                            Submitted: {entry.formattedDate || entry.submittedAt.split("T")[0]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2">
                      {/* Contact Actions */}
                      <div className="flex items-center gap-1.5">
                        {cleanPhone && (
                          <>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title={`Call +91 ${entry.contactNo}`}
                            >
                              <Phone size={12} />
                              <span>Call</span>
                            </a>
                            <a
                              href={`https://wa.me/91${cleanPhone}?text=Dear%20Parent,%20Greetings%20from%20Birla%20Open%20Minds%20International%20School.%20Regarding%20your%20enquiry%20for%20${encodeURIComponent(entry.studentName)}.`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare size={12} />
                              <span>WhatsApp</span>
                            </a>
                          </>
                        )}
                      </div>

                      {/* Restoration & Claim Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            onRestoreEntry(entry);
                            showToast(`✓ Restored ${entry.studentName} back to active leads!`);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="Restore lead back into active queue"
                        >
                          <RotateCcw size={12} />
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onClaimEntry(entry);
                            onClose();
                          }}
                          className="px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
                          title="Claim this lead and open admission form immediately"
                        >
                          <Zap size={13} className="fill-amber-300 text-amber-300" />
                          <span>Claim &amp; Form</span>
                        </button>

                        {onPermanentDelete && (userRole === "Super Admin" || userRole === "Admin" || userRole === "Management") && (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Permanently wipe ${entry.studentName} from all records?`)) {
                                onPermanentDelete(entry.id);
                                showToast(`Deleted ${entry.studentName} permanently.`);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                            title="Permanent Delete (Admin only)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <FolderArchive size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Dismissed Leads Found
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? "No dismissed leads match your current search criteria."
                  : "The archive is clear! When any counsellor dismisses an online lead or walk-in token, it will be safely retained here for easy restoration."}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong>{filteredList.length}</strong> of <strong>{dismissedEntries.length}</strong> archived lead(s)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-bold transition-all cursor-pointer"
          >
            Close Archive
          </button>
        </div>
      </div>
    </div>
  );
};

export default DismissedLeadsModal;
