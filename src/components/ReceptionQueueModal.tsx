import React, { useState } from "react";
import { 
  Bell, 
  CheckCircle2, 
  Smartphone, 
  User, 
  Clock, 
  Phone, 
  Sparkles, 
  X, 
  Printer, 
  ArrowRight,
  ShieldCheck,
  Search,
  School
} from "lucide-react";
import { ParentSelfEntry } from "../types";

interface ReceptionQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ParentSelfEntry[];
  onClaimEntry: (entry: ParentSelfEntry) => void;
  onOpenQrPoster: () => void;
  currentCounsellorName?: string;
}

export default function ReceptionQueueModal({
  isOpen,
  onClose,
  entries = [],
  onClaimEntry,
  onOpenQrPoster,
  currentCounsellorName = "Counsellor"
}: ReceptionQueueModalProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "claimed">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  if (!isOpen) return null;

  const pendingList = [...entries.filter(e => e.status === "pending")].sort((a, b) => {
    // Group by day, order by dailyTokenNo ascending (1, 2, 3...)
    const aDate = a.dateKey || a.entryDate || (a.formattedDate ? a.formattedDate.split(" ")[0] : "");
    const bDate = b.dateKey || b.entryDate || (b.formattedDate ? b.formattedDate.split(" ")[0] : "");
    if (aDate === bDate && a.dailyTokenNo && b.dailyTokenNo) {
      return a.dailyTokenNo - b.dailyTokenNo;
    }
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const claimedList = [...entries.filter(e => e.status === "claimed")].sort((a, b) => {
    return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
  });

  const displayList = (activeTab === "pending" ? pendingList : claimedList).filter(e => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.studentName.toLowerCase().includes(q) ||
      (e.fatherName && e.fatherName.toLowerCase().includes(q)) ||
      (e.motherName && e.motherName.toLowerCase().includes(q)) ||
      e.contactNo.includes(q) ||
      (e.applyingForClass && e.applyingForClass.toLowerCase().includes(q)) ||
      (e.dailyTokenNo && String(e.dailyTokenNo).includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold border border-white/30 text-white shadow-md">
              <Bell size={22} className={pendingList.length > 0 ? "animate-bounce" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-amber-100 text-[10px] font-black uppercase tracking-wider">
                  Reception Self-Service Kiosk
                </span>
                {pendingList.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-900 text-[10px] font-black animate-pulse">
                    {pendingList.length} Waiting in Lounge
                  </span>
                )}
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                Walk-in Parent Registrations Queue
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenQrPoster}
              className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 border border-white/30 cursor-pointer"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print Standee QR</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "pending"
                  ? "bg-orange-600 text-white shadow-md"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <span>⏳ Waiting in Lounge</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "pending" ? "bg-white text-orange-950" : "bg-slate-800 text-slate-300"
              }`}>
                {pendingList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("claimed")}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === "claimed"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <span>✅ In Session / Claimed</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === "claimed" ? "bg-white text-emerald-950" : "bg-slate-800 text-slate-300"
              }`}>
                {claimedList.length}
              </span>
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search Student, Parent, Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-3 custom-scrollbar">
          {displayList.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <Smartphone size={28} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-300">
                  {activeTab === "pending"
                    ? "No Parents Waiting in Lounge Right Now"
                    : "No Claimed Registrations in History"}
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {activeTab === "pending"
                    ? "When a parent scans the QR code at the reception desk, their registration will instantly appear here."
                    : "Registrations claimed by counsellors will be archived here."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayList.map((entry) => {
                const isPending = entry.status === "pending";
                return (
                  <div
                    key={entry.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                      isPending
                        ? "bg-slate-900 border-amber-500/40 shadow-lg hover:border-amber-400"
                        : "bg-slate-900/60 border-slate-800 opacity-90"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex flex-col items-center justify-center font-black shadow-md border border-amber-400/40 shrink-0">
                            <span className="text-[9px] uppercase tracking-wider font-extrabold opacity-90 leading-none">Token</span>
                            <span className="text-lg font-black leading-tight">#{entry.dailyTokenNo || 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-black text-white">{entry.studentName}</h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-black uppercase">
                                Class {entry.applyingForClass}
                              </span>
                              {entry.dailyTokenNo && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                  {entry.dailyTokenNo === 1 ? "🥇 1st Parent Arrived" : entry.dailyTokenNo === 2 ? "🥈 2nd Parent Arrived" : entry.dailyTokenNo === 3 ? "🥉 3rd Parent Arrived" : `${entry.dailyTokenNo}th Parent Arrived`}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Parent: <strong className="text-slate-200">{entry.fatherName || entry.motherName || "Parent"}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[11px] font-mono text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 block font-bold">
                            {entry.formattedDate || "Just Now"}
                          </span>
                          <span className="text-[9px] text-slate-500 block mt-1 font-semibold">
                            Day Queue S.No: #{entry.dailyTokenNo || 1}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Mobile Contact</span>
                          <span className="text-emerald-400 font-mono font-bold">📞 {entry.contactNo}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 uppercase font-bold block">Previous School</span>
                          <span className="text-slate-300 truncate block">{entry.previousSchool || "Not Mentioned"}</span>
                        </div>
                      </div>

                      {entry.heardAboutSchool && entry.heardAboutSchool.length > 0 && (
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span className="text-slate-500 font-bold">Source:</span>
                          {entry.heardAboutSchool.map((src) => (
                            <span key={src} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                              {src}
                            </span>
                          ))}
                        </div>
                      )}

                      {!isPending && (
                        <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
                          <span>
                            Claimed by <strong>{entry.claimedBy || "Counsellor"}</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {isPending ? (
                      <button
                        type="button"
                        onClick={() => {
                          onClaimEntry(entry);
                          onClose();
                        }}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Sparkles size={15} />
                        <span>⚡ Claim &amp; Auto-Fill Form</span>
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <div className="text-center py-1 text-xs text-slate-500 font-bold">
                        🔒 Form Picked Up • In Counselling Session
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            {pendingList.length} parents currently in waiting lounge • Picked up entries disappear from other counsellors automatically.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold cursor-pointer transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
