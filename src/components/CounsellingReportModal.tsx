import React, { useState, useMemo } from "react";
import { 
  X, 
  Copy, 
  Check, 
  Send, 
  Calendar, 
  Printer, 
  Users, 
  GraduationCap, 
  CheckCircle, 
  FileText, 
  Sparkles,
  PhoneCall,
  Sliders,
  ChevronRight
} from "lucide-react";
import { CounsellingEnquiry } from "../types";

interface CounsellingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiries: CounsellingEnquiry[];
  currentCounsellorName?: string;
  userRole?: string;
}

export default function CounsellingReportModal({
  isOpen,
  onClose,
  enquiries,
  currentCounsellorName,
  userRole
}: CounsellingReportModalProps) {
  // Period filter: "day" | "week" | "month" | "custom"
  const [period, setPeriod] = useState<"day" | "week" | "month" | "custom">("day");
  
  // Date states
  const todayIso = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [customStartDate, setCustomStartDate] = useState<string>(todayIso);
  const [customEndDate, setCustomEndDate] = useState<string>(todayIso);

  // Selected Counsellor filter
  const [selectedCounsellor, setSelectedCounsellor] = useState<string>("ALL");

  // Cumulative Admissions Baseline (0 by default, uses 100% real app original data)
  const [baselineAdmissions, setBaselineAdmissions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("counselling_baseline_admissions_count");
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [isEditingBaseline, setIsEditingBaseline] = useState<boolean>(false);
  const [tempBaseline, setTempBaseline] = useState<string>(String(baselineAdmissions));

  // Copy status
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);
  const [copiedDetailed, setCopiedDetailed] = useState<boolean>(false);

  // Salutation based on time of day
  const defaultSalutation = useMemo(() => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good Morning sir";
    if (hr < 16) return "Good Afternoon sir";
    return "Good Evening sir";
  }, []);

  const [salutation, setSalutation] = useState<string>(defaultSalutation);

  // Distinct counsellors in dataset
  const allCounsellors = useMemo(() => {
    const names = new Set<string>();
    enquiries.forEach(e => {
      if (e.counsellorName) names.add(e.counsellorName.trim());
    });
    return Array.from(names).sort();
  }, [enquiries]);

  // Helper to parse date string into Date object
  const parseEnquiryDate = (dateStr: string, createdAt?: string): Date | null => {
    if (!dateStr && !createdAt) return null;
    
    // Check standard DD-MM-YYYY format
    if (dateStr && /^\d{2}-\d{2}-\d{4}$/.test(dateStr.trim())) {
      const parts = dateStr.trim().split("-");
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
    
    // Check YYYY-MM-DD
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      const parts = dateStr.trim().split("-");
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }

    // Try createdAt ISO string
    if (createdAt) {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) return d;
    }

    // Direct Date parse
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }

    return null;
  };

  // Helper to format Date to "23 Oct 2026"
  const formatReportDateLabel = (d: Date): string => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, "0");
    const mon = months[d.getMonth()];
    const yr = d.getFullYear();
    return `${day} ${mon} ${yr}`;
  };

  // Helper to check if an enquiry belongs to Academic Year 2026-2027, 2027-2028, or 2028-2029
  const getEnquiryAcademicYear = (e: CounsellingEnquiry): "2026-2027" | "2027-2028" | "2028-2029" => {
    if (e.academicYear) {
      if (e.academicYear.includes("2028")) return "2028-2029";
      if (e.academicYear.includes("2027")) return "2027-2028";
      if (e.academicYear.includes("2026")) return "2026-2027";
    }
    const rawNo = (e.enquiryNo || e.id || "").toUpperCase();
    if (rawNo.includes("2028") || rawNo.includes("28-29")) return "2028-2029";
    if (rawNo.includes("2027") || rawNo.includes("27-28")) return "2027-2028";
    if (rawNo.includes("2026") || rawNo.includes("26-27")) return "2026-2027";

    const d = parseEnquiryDate(e.date, e.createdAt);
    if (d) {
      const yr = d.getFullYear();
      if (yr === 2028) return "2028-2029";
      if (yr === 2027) return "2027-2028";
      if (yr <= 2026) return "2026-2027";
    }
    return "2026-2027";
  };

  // Filter enquiries matching period and counsellor
  const filteredEnquiries = useMemo(() => {
    let targetStart: Date;
    let targetEnd: Date;

    const parseInputDate = (str: string) => {
      const [y, m, d] = str.split("-").map(Number);
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    };

    if (period === "day") {
      targetStart = parseInputDate(selectedDate);
      targetEnd = new Date(targetStart.getFullYear(), targetStart.getMonth(), targetStart.getDate(), 23, 59, 59, 999);
    } else if (period === "week") {
      const sel = parseInputDate(selectedDate);
      // Monday of current week
      const day = sel.getDay();
      const diffToMon = sel.getDate() - day + (day === 0 ? -6 : 1);
      targetStart = new Date(sel.setDate(diffToMon));
      targetStart.setHours(0, 0, 0, 0);
      targetEnd = new Date(targetStart);
      targetEnd.setDate(targetStart.getDate() + 6);
      targetEnd.setHours(23, 59, 59, 999);
    } else if (period === "month") {
      const sel = parseInputDate(selectedDate);
      targetStart = new Date(sel.getFullYear(), sel.getMonth(), 1, 0, 0, 0, 0);
      targetEnd = new Date(sel.getFullYear(), sel.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      targetStart = parseInputDate(customStartDate);
      const endBase = parseInputDate(customEndDate);
      targetEnd = new Date(endBase.getFullYear(), endBase.getMonth(), endBase.getDate(), 23, 59, 59, 999);
    }

    return enquiries.filter(e => {
      // Counsellor filter
      if (selectedCounsellor !== "ALL") {
        if (!e.counsellorName || e.counsellorName.trim().toLowerCase() !== selectedCounsellor.toLowerCase()) {
          return false;
        }
      }

      // Date filter
      const d = parseEnquiryDate(e.date, e.createdAt);
      if (!d) return false;
      return d >= targetStart && d <= targetEnd;
    });
  }, [enquiries, period, selectedDate, customStartDate, customEndDate, selectedCounsellor]);

  // Compute Metrics
  const metrics = useMemo(() => {
    let enquiries26_27 = 0;
    let enquiries27_28 = 0;
    let enquiries28_29 = 0;
    let admissions26_27 = 0;
    let childInterviews = 0;
    let audioSessionsCount = 0;

    // Class breakdown
    const classCounts: Record<string, number> = {};

    filteredEnquiries.forEach(e => {
      const ay = getEnquiryAcademicYear(e);
      if (ay === "2026-2027") {
        enquiries26_27++;
      } else if (ay === "2027-2028") {
        enquiries27_28++;
      } else {
        enquiries28_29++;
      }

      // Check admissions status
      if (e.admissionStatus === "Admission Confirmed") {
        admissions26_27++;
      }

      // Check child interview or entrance test
      if (
        e.admissionStatus === "Entrance Test Required" ||
        e.pointsDiscussed?.toLowerCase().includes("interview") ||
        e.counsellorObservations?.toLowerCase().includes("interview") ||
        (e.followUpLogs && e.followUpLogs.some(f => f.notes.toLowerCase().includes("interview") || f.mode === "In-Person Visit"))
      ) {
        childInterviews++;
      }

      // Audio sessions
      if (e.audioRecording && (e.audioRecording.audioUrl || e.audioRecording.audioData || e.audioRecording.durationSeconds)) {
        audioSessionsCount++;
      }

      // Class breakdown
      const cls = e.applyingForClass || "Unspecified";
      classCounts[cls] = (classCounts[cls] || 0) + 1;
    });

    // Total cumulative confirmed admissions in app for 2026-2027 (100% original app data)
    const allConfirmedSoftware = enquiries.filter(e => 
      e.admissionStatus === "Admission Confirmed" && getEnquiryAcademicYear(e) === "2026-2027"
    ).length;

    // Total Entrance Tests in App (all enquiries with "Entrance Test Required")
    const entranceTestsTotal = enquiries.filter(e => 
      e.admissionStatus === "Entrance Test Required"
    ).length;

    // Entrance Tests in this specific period
    const entranceTestsPeriod = filteredEnquiries.filter(e => 
      e.admissionStatus === "Entrance Test Required"
    ).length;

    const cumulativeTotal = baselineAdmissions + allConfirmedSoftware;

    return {
      enquiries26_27,
      enquiries27_28,
      enquiries28_29,
      admissions26_27,
      childInterviews,
      entranceTestsTotal,
      entranceTestsPeriod,
      allConfirmedSoftware,
      cumulativeTotal,
      audioSessionsCount,
      classCounts,
      totalCount: filteredEnquiries.length
    };
  }, [filteredEnquiries, enquiries, baselineAdmissions]);

  // Formatted date label for display
  const periodLabel = useMemo(() => {
    const parse = (s: string) => {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d);
    };

    if (period === "day") {
      return formatReportDateLabel(parse(selectedDate));
    }
    if (period === "week") {
      const sel = parse(selectedDate);
      const day = sel.getDay();
      const diffToMon = sel.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(sel.setDate(diffToMon));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `${formatReportDateLabel(mon)} - ${formatReportDateLabel(sun)}`;
    }
    if (period === "month") {
      const sel = parse(selectedDate);
      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      return `${months[sel.getMonth()]} ${sel.getFullYear()}`;
    }
    return `${formatReportDateLabel(parse(customStartDate))} - ${formatReportDateLabel(parse(customEndDate))}`;
  }, [period, selectedDate, customStartDate, customEndDate]);

  // Standard WhatsApp Message Text (Matching the user's exact forwarded format!)
  const whatsAppText = useMemo(() => {
    const updateTitle = period === "day" 
      ? "Today's Update" 
      : period === "week" 
        ? "Weekly Update" 
        : period === "month" 
          ? "Monthly Update" 
          : "Period Update";

    const lines = [
      salutation,
      `${updateTitle.padEnd(20, " ")}: ${periodLabel}`,
      `Enquiries 2026-2027    : ${metrics.enquiries26_27}`,
      `Enquiries 2027-2028    : ${metrics.enquiries27_28}`,
    ];

    if (metrics.enquiries28_29 > 0) {
      lines.push(`Enquiries 2028-2029    : ${metrics.enquiries28_29}`);
    }

    lines.push(
      `Admissions 2026-2027   : ${metrics.admissions26_27}`,
      `Child Interviews       : ${metrics.childInterviews}`,
      `Entrance Tests (Total) : ${metrics.entranceTestsTotal}`,
      `Total Admissions - ${metrics.cumulativeTotal} (AY 2026-2027)`
    );

    return lines.join("\n");
  }, [salutation, period, periodLabel, metrics]);

  // Full Detailed Report with Class breakdown
  const detailedReportText = useMemo(() => {
    const classLines = Object.entries(metrics.classCounts)
      .map(([cls, cnt]) => `  • ${cls.padEnd(22, " ")}: ${cnt}`)
      .join("\n");

    return [
      `========================================`,
      `BIRLA OPEN MINDS INTERNATIONAL SCHOOL`,
      `COUNSELLING & ADMISSIONS DEPARTMENT REPORT`,
      `========================================`,
      whatsAppText,
      `----------------------------------------`,
      `Total Audio Sessions Logged: ${metrics.audioSessionsCount}`,
      `Selected Counsellor Scope : ${selectedCounsellor === "ALL" ? "All Counsellors" : selectedCounsellor}`,
      `----------------------------------------`,
      `GRADE-WISE ENQUIRY BREAKDOWN:`,
      classLines || "  (No grade data for this period)",
      `========================================`
    ].join("\n");
  }, [whatsAppText, metrics, selectedCounsellor]);

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(whatsAppText);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2200);
  };

  const handleCopyDetailed = () => {
    navigator.clipboard.writeText(detailedReportText);
    setCopiedDetailed(true);
    setTimeout(() => setCopiedDetailed(false), 2200);
  };

  const handleSendWhatsApp = () => {
    const encoded = encodeURIComponent(whatsAppText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
  };

  const handleSaveBaseline = () => {
    const num = parseInt(tempBaseline, 10);
    if (!isNaN(num) && num >= 0) {
      setBaselineAdmissions(num);
      try {
        localStorage.setItem("counselling_baseline_admissions_count", String(num));
      } catch {}
    }
    setIsEditingBaseline(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGeneratePDFReport = () => {
    const generatedOn = new Date().toLocaleString("en-IN", { dateStyle: "full", timeStyle: "medium" });
    const printWindow = window.open("", "_blank", "width=900,height=800");
    if (!printWindow) {
      alert("Please allow pop-ups to generate PDF report.");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BIRLA OPEN MINDS — Counselling & Admissions Periodical Report</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.5;
          }
          .header {
            border-bottom: 3px solid #ea580c;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .title { font-size: 18px; font-weight: 900; color: #c2410c; text-transform: uppercase; }
          .subtitle { font-size: 12px; font-weight: 800; color: #334155; }
          .meta { font-size: 10px; color: #64748b; margin-top: 2px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
          .card-title { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #64748b; }
          .card-val { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px; }
          .total-box { background: #fff7ed; border: 1.5px solid #fdba74; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-weight: 800; font-size: 13px; color: #9a3412; }
          .text-preview { background: #e7f8e8; border: 1px solid #b6e7b9; padding: 12px; border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre-wrap; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 10.5px; }
          th { background: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 9px; }
          .sig-row { margin-top: 40px; display: flex; justify-content: space-between; padding-top: 16px; border-top: 1px dashed #cbd5e1; }
          .sig { text-align: center; width: 220px; font-weight: 700; font-size: 10px; text-transform: uppercase; border-top: 1px solid #475569; padding-top: 4px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</div>
            <div class="subtitle">COUNSELLING &amp; ADMISSIONS DEPARTMENT REPORT</div>
            <div class="meta">Period: ${periodLabel} • Counsellor Scope: ${selectedCounsellor === "ALL" ? "All Counsellors" : selectedCounsellor}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 900; font-size: 14px; color: #ea580c;">OFFICIAL SUMMARY</div>
            <div style="font-size: 9px; color: #64748b;">Generated: ${generatedOn}</div>
          </div>
        </div>

        <div class="total-box">
          🎓 Total Admissions AY 2026-2027: ${metrics.cumulativeTotal} Confirmed
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Enquiries 2026-2027</div>
            <div class="card-val">${metrics.enquiries26_27}</div>
          </div>
          <div class="card">
            <div class="card-title">Enquiries 2027-2028</div>
            <div class="card-val">${metrics.enquiries27_28}</div>
          </div>
          <div class="card">
            <div class="card-title">Enquiries 2028-2029</div>
            <div class="card-val">${metrics.enquiries28_29}</div>
          </div>
          <div class="card">
            <div class="card-title">Admissions Confirmed</div>
            <div class="card-val">${metrics.admissions26_27}</div>
          </div>
          <div class="card">
            <div class="card-title">Child Interviews</div>
            <div class="card-val">${metrics.childInterviews}</div>
          </div>
          <div class="card">
            <div class="card-title">Entrance Tests (Total)</div>
            <div class="card-val">${metrics.entranceTestsTotal}</div>
          </div>
        </div>

        <div class="subtitle" style="margin-bottom: 6px;">WhatsApp Report Snapshot:</div>
        <div class="text-preview">${whatsAppText}</div>

        ${Object.keys(metrics.classCounts).length > 0 ? `
          <div class="subtitle" style="margin-top: 16px; margin-bottom: 6px;">Grade-Wise Distribution (${metrics.totalCount} enquiries):</div>
          <table>
            <thead>
              <tr>
                <th>Applying Class / Grade</th>
                <th style="width: 100px; text-align: right;">Total Enquiries</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(metrics.classCounts).map(([cls, cnt]) => `
                <tr>
                  <td><strong>${cls}</strong></td>
                  <td style="text-align: right; font-weight: 800; font-family: monospace;">${cnt}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        ` : ""}

        <div class="sig-row">
          <div class="sig">Prepared By (Counsellor)</div>
          <div class="sig">Checked By (Admissions Head)</div>
          <div class="sig">Management Verification</div>
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-indigo-700 text-white p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Sparkles size={20} className="text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm sm:text-base tracking-wide">
                  1-Click Counselling &amp; Admissions Report
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[9px] uppercase tracking-wider">
                  WhatsApp Ready
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                Instantly compute and send Day, Week, and Month reports directly to Management without manual calculation.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/25 flex items-center justify-center transition-all cursor-pointer text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">

          {/* PERIOD FILTER TABS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 dark:bg-slate-850 p-2 rounded-xl border border-slate-200 dark:border-slate-750">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              {[
                { id: "day", label: "📅 Day-wise (Daily)" },
                { id: "week", label: "🗓️ Weekly" },
                { id: "month", label: "📆 Monthly" },
                { id: "custom", label: "🎯 Custom Range" }
              ].map(t => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setPeriod(t.id as any)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    period === t.id
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Counsellor Scope Selector */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Counsellor:</span>
              <select
                value={selectedCounsellor}
                onChange={(e) => setSelectedCounsellor(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
              >
                <option value="ALL">All Counsellors (Total School)</option>
                {currentCounsellorName && (
                  <option value={currentCounsellorName}>My Report ({currentCounsellorName})</option>
                )}
                {allCounsellors.map(name => (
                  name !== currentCounsellorName && (
                    <option key={name} value={name}>{name}</option>
                  )
                ))}
              </select>
            </div>
          </div>

          {/* DATE PICKERS BASED ON PERIOD */}
          <div className="flex flex-wrap items-center gap-3 bg-amber-50/60 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/40 text-xs">
            {period === "day" && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Select Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayIso)}
                  className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 rounded-md font-bold text-[11px] cursor-pointer"
                >
                  Today
                </button>
              </div>
            )}

            {period === "week" && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Week of Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-bold"
                />
                <span className="text-slate-500 font-mono text-[11px]">
                  ({periodLabel})
                </span>
              </div>
            )}

            {period === "month" && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">Month of:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-bold"
                />
                <span className="text-slate-500 font-mono text-[11px]">
                  ({periodLabel})
                </span>
              </div>
            )}

            {period === "custom" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-700 dark:text-slate-300">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-bold"
                />
                <span className="font-bold text-slate-700 dark:text-slate-300">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs font-bold"
                />
              </div>
            )}

            {/* Salutation Customizer */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-slate-500 font-medium">Greeting:</span>
              <select
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 rounded text-xs font-bold text-slate-700 dark:text-slate-200"
              >
                <option value="Good Evening sir">Good Evening sir</option>
                <option value="Good Morning sir">Good Morning sir</option>
                <option value="Good Afternoon sir">Good Afternoon sir</option>
                <option value="Respected Sir">Respected Sir</option>
                <option value="Dear Management">Dear Management</option>
              </select>
            </div>
          </div>

          {/* LIVE METRIC CARDS OVERVIEW */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] font-bold text-slate-500 uppercase">Enquiries 2026-2027</p>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{metrics.enquiries26_27}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Current Academic Year</p>
            </div>

            <div className="bg-cyan-50 dark:bg-cyan-950/40 p-3.5 rounded-xl border border-cyan-200 dark:border-cyan-800">
              <p className="text-[10px] font-bold text-cyan-700 dark:text-cyan-300 uppercase">Enquiries 2027-2028</p>
              <p className="text-2xl font-black text-cyan-900 dark:text-cyan-100 mt-0.5">{metrics.enquiries27_28}</p>
              <p className="text-[10px] text-cyan-600 dark:text-cyan-400 mt-0.5">Next Year Advance Leads</p>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
              <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Admissions Confirmed</p>
              <p className="text-2xl font-black text-emerald-900 dark:text-emerald-100 mt-0.5">{metrics.admissions26_27}</p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Closed in this Period</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-xl border border-purple-200 dark:border-purple-800">
              <p className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Child Interviews</p>
              <p className="text-2xl font-black text-purple-900 dark:text-purple-100 mt-0.5">{metrics.childInterviews}</p>
              <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-0.5">Interaction / Schedule</p>
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Entrance Tests (Total)</p>
              <p className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mt-0.5">{metrics.entranceTestsTotal}</p>
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">App Database Total</p>
            </div>
          </div>

          {/* TOTAL ADMISSIONS - 100% APP ORIGINAL DATA */}
          <div className="bg-gradient-to-r from-orange-500/10 via-amber-500/10 to-indigo-500/10 p-3.5 rounded-xl border border-orange-200 dark:border-orange-900/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black">
                <GraduationCap size={18} />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  Total Admissions: <span className="text-orange-600 dark:text-orange-400 text-base font-black">{metrics.cumulativeTotal}</span> (AY 2026-2027)
                </p>
                <p className="text-[10px] text-slate-500">
                  {baselineAdmissions > 0 
                    ? `Live from App Database (${metrics.allConfirmedSoftware} Confirmed) + Register Baseline (${baselineAdmissions})`
                    : `Live Original App Database Count (${metrics.allConfirmedSoftware} Confirmed Admissions)`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditingBaseline ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={tempBaseline}
                    onChange={(e) => setTempBaseline(e.target.value)}
                    className="w-20 px-2 py-1 bg-white dark:bg-slate-800 border border-orange-400 rounded-lg text-xs font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleSaveBaseline}
                    className="px-2 py-1 bg-orange-600 text-white rounded-lg text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTempBaseline(String(baselineAdmissions));
                    setIsEditingBaseline(true);
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-orange-50 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                >
                  Edit Baseline ({baselineAdmissions})
                </button>
              )}
            </div>
          </div>

          {/* WHATSAPP MESSAGE PREVIEW (EXACTLY MATCHING USER'S SCREENSHOT) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                <Send size={13} className="text-emerald-600" />
                <span>WhatsApp Message Preview (Exact Copy-Paste Format)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Ready to send in 1 click
              </span>
            </div>

            {/* WhatsApp Green Bubble Box */}
            <div className="bg-[#E7F8E8] dark:bg-[#0c2214] border border-[#B6E7B9] dark:border-[#1d4d29] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 font-mono">
              <pre className="text-xs sm:text-sm text-slate-900 dark:text-emerald-100 whitespace-pre-wrap leading-relaxed select-all">
                {whatsAppText}
              </pre>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#B6E7B9] dark:border-[#1d4d29]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyWhatsApp}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    {copiedWhatsApp ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedWhatsApp ? "✓ Copied to Clipboard!" : "📋 Copy WhatsApp Text"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="px-4 py-2 bg-[#25D366] hover:bg-[#1EBE5D] text-slate-950 font-black rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    title="Open WhatsApp Web or WhatsApp mobile app directly"
                  >
                    <Send size={14} />
                    <span>📲 Send via WhatsApp</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleGeneratePDFReport}
                    className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                    title="Generate & Print Official PDF Summary"
                  >
                    <Printer size={13} />
                    <span>📄 Generate PDF Report</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyDetailed}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    {copiedDetailed ? <Check size={13} /> : <FileText size={13} />}
                    <span>{copiedDetailed ? "Copied!" : "Copy Full Details"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrint}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CLASS-WISE & AUDIO BREAKDOWN ACCORDION */}
          {Object.keys(metrics.classCounts).length > 0 && (
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 tracking-wider">
                Class / Grade Distribution ({metrics.totalCount} enquiries)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {Object.entries(metrics.classCounts).map(([cls, cnt]) => (
                  <div key={cls} className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">{cls}</span>
                    <span className="font-mono font-bold text-orange-600 dark:text-orange-400">{cnt}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">
            Birla Open Minds International School • Counselling Desk
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-white rounded-xl font-bold cursor-pointer transition-all"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
