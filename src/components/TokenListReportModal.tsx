import React, { useState, useMemo } from "react";
import { 
  FileText, 
  Calendar, 
  Search, 
  Printer, 
  Download, 
  X, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  AlertCircle,
  School,
  Sparkles
} from "lucide-react";
import { ParentSelfEntry, CounsellorAccount } from "../types";

interface TokenListReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: ParentSelfEntry[];
  counsellors?: CounsellorAccount[];
}

export default function TokenListReportModal({
  isOpen,
  onClose,
  entries = [],
  counsellors = []
}: TokenListReportModalProps) {
  const [filterMode, setFilterMode] = useState<"daily" | "range">("daily");
  const now = new Date();
  const todayYMD = now.toISOString().split("T")[0];
  const todayDMY = now.toLocaleDateString("en-GB").replace(/\//g, "-");

  const [fromDate, setFromDate] = useState<string>(todayYMD);
  const [toDate, setToDate] = useState<string>(todayYMD);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "CLAIMED" | "UNCLAIMED">("ALL");

  // Helper to extract standard YYYY-MM-DD from any ParentSelfEntry
  const getEntryDateYMD = (e: ParentSelfEntry): string => {
    if (e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) return e.dateKey;
    if (e.submittedAt) {
      const ymd = e.submittedAt.split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    }
    const dmyStr = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
    if (dmyStr) {
      const parts = dmyStr.split(/[\/\-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
        } else {
          return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
        }
      }
    }
    return "";
  };

  // Filter entries based on Day-Wise or Custom Date Range (From Date to To Date)
  const periodFilteredEntries = useMemo(() => {
    return (entries || []).filter(e => {
      if (!e) return false;
      const entryYMD = getEntryDateYMD(e);
      const dateDMY = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");

      if (filterMode === "daily") {
        return entryYMD === todayYMD || dateDMY === todayDMY;
      } else {
        // "range"
        let match = true;
        if (fromDate && entryYMD) {
          match = match && entryYMD >= fromDate;
        }
        if (toDate && entryYMD) {
          match = match && entryYMD <= toDate;
        }
        return match;
      }
    }).sort((a, b) => {
      const aDate = a.dateKey || a.entryDate || "";
      const bDate = b.dateKey || b.entryDate || "";
      if (aDate === bDate && a.dailyTokenNo && b.dailyTokenNo) {
        return a.dailyTokenNo - b.dailyTokenNo;
      }
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });
  }, [entries, filterMode, fromDate, toDate, todayYMD, todayDMY]);

  // Apply search and status filter
  const finalDisplayList = useMemo(() => {
    return periodFilteredEntries.filter(e => {
      const isClaimed = e.status === "claimed" || Boolean(e.claimedByName || e.claimedBy);
      if (statusFilter === "CLAIMED" && !isClaimed) return false;
      if (statusFilter === "UNCLAIMED" && isClaimed) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const student = (e.studentName || "").toLowerCase();
      const parent = (e.fatherName || e.motherName || "").toLowerCase();
      const mobile = (e.contactNo || "").toLowerCase();
      const counsellor = (e.claimedByName || e.claimedBy || "no one claim").toLowerCase();
      const token = String(e.dailyTokenNo || "");

      return (
        student.includes(q) ||
        parent.includes(q) ||
        mobile.includes(q) ||
        counsellor.includes(q) ||
        token.includes(q) ||
        (e.applyingForClass && e.applyingForClass.toLowerCase().includes(q))
      );
    });
  }, [periodFilteredEntries, searchQuery, statusFilter]);

  // Statistics
  const totalCount = periodFilteredEntries.length;
  const claimedCount = periodFilteredEntries.filter(e => e.status === "claimed" || Boolean(e.claimedByName || e.claimedBy)).length;
  const unclaimedCount = totalCount - claimedCount;

  // Print Handler
  const handlePrintReport = () => {
    const periodLabel = filterMode === "daily" 
      ? `DAY-WISE (TODAY: ${todayDMY})` 
      : `DATE RANGE (${fromDate || "START"} TO ${toDate || "TODAY"})`;
    
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to print token summary report.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BIRLA OPEN MINDS - Token Summary Report (${periodLabel})</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 16px;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.4;
          }
          .header {
            border-bottom: 3px solid #ea580c;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            color: #c2410c;
            text-transform: uppercase;
          }
          .sub-title {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 2px;
          }
          .kpi-row {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
          }
          .kpi-box {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            border-radius: 8px;
            text-align: center;
          }
          .kpi-val {
            font-size: 18px;
            font-weight: 900;
            color: #ea580c;
          }
          .kpi-lbl {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
          }
          th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 9px;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          td {
            padding: 8px 10px;
            border: 1px solid #e2e8f0;
            font-size: 11px;
          }
          tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .badge-claimed {
            color: #15803d;
            font-weight: 800;
            background: #dcfce7;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
          }
          .badge-unclaimed {
            color: #b91c1c;
            font-weight: 900;
            background: #fee2e2;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 10px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand-title">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</div>
            <div class="sub-title">Total Token Summary Register — ${periodLabel}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 16px; color: #ea580c;">${finalDisplayList.length} TOKENS</div>
            <div style="font-size: 9px; color: #64748b;">Date: ${new Date().toLocaleDateString("en-GB")}</div>
          </div>
        </div>

        <div class="kpi-row">
          <div class="kpi-box">
            <div class="kpi-val">${totalCount}</div>
            <div class="kpi-lbl">Total Tokens</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val" style="color: #16a34a;">${claimedCount}</div>
            <div class="kpi-lbl">Claimed Tokens</div>
          </div>
          <div class="kpi-box">
            <div class="kpi-val" style="color: #dc2626;">${unclaimedCount}</div>
            <div class="kpi-lbl">Unclaimed Tokens</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Token</th>
              <th>Date &amp; Time</th>
              <th>Student Name</th>
              <th>Parent Name</th>
              <th>Mobile Number</th>
              <th>Counsellor Name</th>
            </tr>
          </thead>
          <tbody>
            ${finalDisplayList.map((item) => {
              const isClaimed = item.status === "claimed" || Boolean(item.claimedByName || item.claimedBy);
              const counsellorDisplayName = isClaimed
                ? (item.claimedByName || item.claimedBy || "Assigned Counsellor")
                : "NO ONE CLAIM";

              return `
                <tr>
                  <td style="text-align: center; font-weight: 900; color: #c2410c;">#${item.dailyTokenNo || 1}</td>
                  <td style="font-family: monospace;">${item.entryDate || item.formattedDate || "Today"}</td>
                  <td><strong>${item.studentName}</strong> <span style="color:#64748b; font-size:9px;">(Class ${item.applyingForClass})</span></td>
                  <td>${item.fatherName || item.motherName || "Parent"}</td>
                  <td style="font-family: monospace; font-weight: 700;">📞 ${item.contactNo}</td>
                  <td>
                    ${isClaimed 
                      ? `<span class="badge-claimed">Claimed: ${counsellorDisplayName}</span>` 
                      : `<span class="badge-unclaimed">NO ONE CLAIM</span>`}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (finalDisplayList.length === 0) {
      alert("No token records available to export.");
      return;
    }

    const headers = ["Token No", "Date", "Student Name", "Class", "Parent Name", "Mobile Number", "Counsellor Name", "Status"];
    const rows = finalDisplayList.map(item => {
      const isClaimed = item.status === "claimed" || Boolean(item.claimedByName || item.claimedBy);
      const counsellor = isClaimed ? (item.claimedByName || item.claimedBy || "Counsellor") : "NO ONE CLAIM";
      return [
        `"#${item.dailyTokenNo || 1}"`,
        `"${item.entryDate || item.formattedDate || ""}"`,
        `"${(item.studentName || "").replace(/"/g, '""')}"`,
        `"${item.applyingForClass || ""}"`,
        `"${(item.fatherName || item.motherName || "Parent").replace(/"/g, '""')}"`,
        `"${item.contactNo || ""}"`,
        `"${counsellor.replace(/"/g, '""')}"`,
        isClaimed ? "Claimed" : "NO ONE CLAIM"
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filePeriodName = filterMode === "daily" 
      ? `DAY_WISE_${todayDMY}` 
      : `RANGE_${fromDate || "START"}_TO_${toDate || "TODAY"}`;
    link.setAttribute("download", `BOMIS_Token_List_${filePeriodName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold border border-white/30 text-white shadow-md">
              <FileText size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-amber-100 text-[10px] font-black uppercase tracking-wider">
                  Official Reception Audit
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black">
                  Total: {totalCount} Tokens
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-black/30 border border-white/20 text-white text-[10px] font-bold">
                  {filterMode === "daily" ? `📅 Today (${todayDMY})` : `📆 ${fromDate} to ${toDate}`}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                Day-Wise &amp; Custom Date Range Total Token Count Report
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 rounded-xl text-xs font-bold text-white transition-all flex items-center gap-1.5 border border-white/30 cursor-pointer"
              title="Export CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              className="px-3.5 py-1.5 bg-white text-orange-950 hover:bg-orange-50 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
              title="Print Summary Report"
            >
              <Printer size={14} />
              <span>Print Report</span>
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

        {/* Period Selector Bar: Day-Wise + Choose Date Range (From Date to To Date side-by-side) */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 shrink-0 overflow-x-auto">
          <div className="flex items-center gap-2.5 flex-nowrap w-auto">
            {/* 1. Day-Wise (Today) Button */}
            <button
              type="button"
              onClick={() => {
                setFilterMode("daily");
                setFromDate(todayYMD);
                setToDate(todayYMD);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                filterMode === "daily"
                  ? "bg-orange-600 text-white shadow-md ring-2 ring-orange-400/40"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
              title="Filter tokens registered today"
            >
              <Calendar size={14} />
              <span>Day-Wise (Today)</span>
            </button>

            {/* 2. Choose Date Range: FROM and TO Strictly Side-by-Side (Pakka Pakkana) */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all flex-nowrap whitespace-nowrap shrink-0 ${
              filterMode === "range"
                ? "bg-slate-900 border-orange-500/60 ring-2 ring-orange-500/20 shadow-md"
                : "bg-slate-900/70 border-slate-800"
            }`}>
              <span className="text-[11px] font-black text-amber-400 flex items-center gap-1 shrink-0">
                <Calendar size={13} className="text-amber-400" />
                <span>Choose Date:</span>
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">From:</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setFilterMode("range");
                  }}
                  className="w-32 sm:w-34 px-2 py-1 bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-lg text-xs text-white font-mono focus:outline-none [color-scheme:dark]"
                  title="Choose From Date"
                />
              </div>

              <span className="text-slate-500 text-xs font-bold shrink-0">➔</span>

              <div className="flex items-center gap-1.5 shrink-0">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To:</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setFilterMode("range");
                  }}
                  className="w-32 sm:w-34 px-2 py-1 bg-slate-950 border border-slate-700 focus:border-orange-500 rounded-lg text-xs text-white font-mono focus:outline-none [color-scheme:dark]"
                  title="Choose To Date"
                />
              </div>

              {filterMode === "range" && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("daily");
                    setFromDate(todayYMD);
                    setToDate(todayYMD);
                  }}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-bold hover:underline cursor-pointer ml-1 shrink-0 px-1 py-0.5"
                  title="Reset to Day-Wise Today"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search Name, Phone, Counsellor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="CLAIMED">Claimed Only</option>
              <option value="UNCLAIMED">NO ONE CLAIM Only</option>
            </select>
          </div>
        </div>

        {/* 3 Summary KPI Cards */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/60 border-b border-slate-800/80 shrink-0">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-2xl font-black text-amber-400 block">{totalCount}</span>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Tokens</span>
          </div>
          <div className="p-3 bg-slate-900 border border-emerald-900/50 rounded-2xl text-center">
            <span className="text-2xl font-black text-emerald-400 block">{claimedCount}</span>
            <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">Claimed Tokens</span>
          </div>
          <div className="p-3 bg-slate-900 border border-rose-900/50 rounded-2xl text-center">
            <span className="text-2xl font-black text-rose-400 block">{unclaimedCount}</span>
            <span className="text-[10px] font-black uppercase text-rose-300 tracking-wider">Unclaimed Tokens</span>
          </div>
        </div>

        {/* Table View containing strictly requested 4 details */}
        <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
          {finalDisplayList.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
                <FileText size={24} />
              </div>
              <p className="text-xs font-bold text-slate-400">No token entries found for this selection.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-lg bg-slate-950">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="p-3.5 w-16 text-center">Token</th>
                    <th className="p-3.5">Student Name</th>
                    <th className="p-3.5">Parent Name</th>
                    <th className="p-3.5">Mobile Number</th>
                    <th className="p-3.5">Counsellor Name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs">
                  {finalDisplayList.map((item, idx) => {
                    const isClaimed = item.status === "claimed" || Boolean(item.claimedByName || item.claimedBy);
                    const counsellorDisplayName = isClaimed
                      ? (item.claimedByName || item.claimedBy || "Counsellor")
                      : "NO ONE CLAIM";

                    return (
                      <tr key={item.id || idx} className="hover:bg-slate-900/50 transition-colors">
                        {/* Token Badge */}
                        <td className="p-3.5 text-center font-black">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-black inline-block">
                            #{item.dailyTokenNo || (idx + 1)}
                          </span>
                        </td>

                        {/* 1. Student Name */}
                        <td className="p-3.5">
                          <div className="font-extrabold text-white text-sm">{item.studentName}</div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            Class {item.applyingForClass} • {item.entryDate || item.formattedDate || "Today"}
                          </span>
                        </td>

                        {/* 2. Parent Name */}
                        <td className="p-3.5 text-slate-200 font-bold">
                          {item.fatherName || item.motherName || "Parent"}
                        </td>

                        {/* 3. Mobile Number */}
                        <td className="p-3.5">
                          <a 
                            href={`tel:${item.contactNo}`} 
                            className="font-mono font-bold text-emerald-400 hover:underline flex items-center gap-1"
                          >
                            📞 {item.contactNo}
                          </a>
                        </td>

                        {/* 4. Counsellor Name */}
                        <td className="p-3.5">
                          {isClaimed ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 rounded-xl font-extrabold text-xs">
                              <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                              <span>{counsellorDisplayName}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-950/80 border border-rose-500/50 text-rose-300 rounded-xl font-black text-xs uppercase tracking-wider animate-pulse">
                              <AlertCircle size={13} className="text-rose-400 shrink-0" />
                              <span>NO ONE CLAIM</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Birla Open Minds International School • Official Admissions Token Summary Register
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
