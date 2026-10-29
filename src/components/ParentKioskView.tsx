import React, { useState, useEffect } from "react";
import { 
  QrCode, 
  Smartphone, 
  User, 
  GraduationCap, 
  Phone, 
  Building2, 
  CheckCircle2, 
  Printer, 
  Sparkles,
  School,
  ArrowRight,
  HeartHandshake,
  Copy,
  Check,
  Globe,
  ExternalLink,
  ArrowLeft
} from "lucide-react";
import { ParentSelfEntry } from "../types";
import { isFirebaseConfigured, saveDocument } from "../utils/firebase";

interface ParentKioskViewProps {
  isStandalone?: boolean;
  onClose?: () => void;
  onSubmitSuccess?: (entry: ParentSelfEntry) => void;
  onNavigateToLogin?: () => void;
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
  "Reference / Friend",
  "Existing Parent",
  "Advertisement",
  "Other"
];

interface ParentKioskViewProps {
  isStandalone?: boolean;
  onClose?: () => void;
  onSubmitSuccess?: (entry: ParentSelfEntry) => void;
  onNavigateToLogin?: () => void;
  defaultMode?: "register" | "print_qr";
}

// Fallback guaranteed public Shared App URL for mobile phone scanners (never aistudio.google.com)
const SHARED_PUBLIC_APP_URL = "https://ais-pre-hdxvdxvb3o37jyrarxjlig-623128014596.asia-southeast1.run.app";

export default function ParentKioskView({
  isStandalone = true,
  onClose,
  onSubmitSuccess,
  onNavigateToLogin,
  defaultMode = "register"
}: ParentKioskViewProps) {
  const [activeTab, setActiveTab] = useState<"register" | "print_qr">(defaultMode);
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedToken, setAssignedToken] = useState<number>(1);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [liveServerUrl, setLiveServerUrl] = useState<string>("");

  // Real-time server URL sync on mount
  useEffect(() => {
    fetch("/api/app-url")
      .then(r => r.json())
      .then(d => {
        if (d?.appUrl) {
          const raw = String(d.appUrl).trim();
          if (!raw.includes("localhost") && !raw.includes("127.0.0.1") && !raw.includes("aistudio.google.com") && !raw.includes("google.com")) {
            const clean = raw.replace("-dev-", "-pre-");
            setLiveServerUrl(clean);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Custom QR Code Target URL
  const [customQrDomain, setCustomQrDomain] = useState("");

  // Form fields
  const [studentName, setStudentName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [applyingForClass, setApplyingForClass] = useState("Grade 1");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [whatsappNo, setWhatsappNo] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [heardAboutSchool, setHeardAboutSchool] = useState<string[]>(["Google/Online"]);
  const [reasonForChoosing, setReasonForChoosing] = useState("");

  const handlePhoneChange = (val: string) => {
    // Strictly restrict to digits only and maximum 10 numbers
    const digitsOnly = val.replace(/\D/g, "").slice(0, 10);
    setContactNo(digitsOnly);
    if (digitsOnly.length > 0 && digitsOnly.length < 10) {
      setPhoneError(`Entered ${digitsOnly.length}/10 digits. Exactly 10 digits required.`);
    } else {
      setPhoneError("");
    }
  };

  // Compute best public URL for QR scanning (Guaranteed public accessible on mobile phones)
  const computeQrUrl = () => {
    if (customQrDomain.trim()) {
      const clean = customQrDomain.trim().replace(/\/$/, "");
      return clean.includes("?") ? `${clean}&mode=parent_kiosk` : `${clean}?mode=parent_kiosk`;
    }

    if (liveServerUrl) {
      return `${liveServerUrl}?mode=parent_kiosk`;
    }

    if (typeof window !== "undefined") {
      const origin = window.location.origin || "";
      // NEVER allow aistudio.google.com, google.com or localhost into QR codes
      const isInternalDevHost = 
        origin.includes("aistudio.google.com") || 
        origin.includes("google.com") ||
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") ||
        origin.includes("0.0.0.0") ||
        origin.includes("webcontainer") ||
        !origin.startsWith("http");

      if (!isInternalDevHost && origin.includes(".run.app")) {
        return `${origin.replace("-dev-", "-pre-")}?mode=parent_kiosk`;
      } else if (!isInternalDevHost && origin.length > 5 && !origin.includes("google")) {
        return `${origin}?mode=parent_kiosk`;
      }
    }

    return `${SHARED_PUBLIC_APP_URL}?mode=parent_kiosk`;
  };

  const targetQrUrl = computeQrUrl();
  const qrImageApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(targetQrUrl)}&color=0f172a&bgcolor=ffffff`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert("Please enter the student's full name.");
      return;
    }
    if (!dateOfBirth) {
      alert("Please enter the student's date of birth.");
      return;
    }
    const cleanPhone = contactNo.replace(/\D/g, "");
    if (cleanPhone.length !== 10) {
      alert("Please enter a valid 10-digit mobile contact number.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const dmy = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = `PSE-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}-${Date.now()}`;

    // Calculate daily token S.No (1, 2, 3...) resetting daily each morning
    let todayCount = 0;
    try {
      const existingRaw = localStorage.getItem("parent_self_entries");
      const existingList: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      todayCount = existingList.filter(e => {
        const itemDate = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
        return itemDate === dmy || e.dateKey === dateKey;
      }).length;
    } catch {}
    const dailyTokenNo = todayCount + 1;

    const newEntry: ParentSelfEntry = {
      id,
      studentName: studentName.trim(),
      dateOfBirth: dateOfBirth.trim(),
      applyingForClass,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      contactNo: cleanPhone,
      whatsappNo: (whatsappNo.trim() || cleanPhone).replace(/\D/g, "").slice(0, 10),
      previousSchool: previousSchool.trim(),
      heardAboutSchool,
      reasonForChoosing: reasonForChoosing.trim(),
      submittedAt: now.toISOString(),
      formattedDate: `${dmy} ${timeStr}`,
      status: "pending",
      dailyTokenNo,
      entryDate: dmy,
      dateKey
    };

    // 1. Direct real-time Firebase Firestore save so counsellor sees it within 100ms on desktop!
    try {
      if (isFirebaseConfigured()) {
        await saveDocument("parent_self_entries", id, newEntry);
      }
    } catch (fErr) {
      console.warn("Firestore parent entry save warning:", fErr);
    }

    try {
      // 2. Post to 24/7 server endpoint
      await fetch("/api/parent-self-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });
    } catch (err) {
      console.warn("Server parent-self-entry post warning:", err);
    }

    try {
      // 2. Save locally for instantaneous offline reactivity
      const existingRaw = localStorage.getItem("parent_self_entries");
      const existing: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newEntry, ...existing];
      localStorage.setItem("parent_self_entries", JSON.stringify(updated));

      // Dispatch event to notify open Counsellor tabs
      window.dispatchEvent(new CustomEvent("parent_self_entry_added", { detail: newEntry }));
    } catch (err) {
      console.warn("Local storage parent entry save warning:", err);
    }

    setAssignedToken(dailyTokenNo);

    if (onSubmitSuccess) {
      onSubmitSuccess(newEntry);
    }

    setIsSubmittedSuccess(true);
    setIsSubmitting(false);
  };

  const handleResetForm = () => {
    setStudentName("");
    setDateOfBirth("");
    setApplyingForClass("Grade 1");
    setFatherName("");
    setMotherName("");
    setContactNo("");
    setPhoneError("");
    setWhatsappNo("");
    setPreviousSchool("");
    setReasonForChoosing("");
    setIsSubmittedSuccess(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetQrUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handlePrintPoster = () => {
    const posterHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BIRLA OPEN MINDS - Reception QR Standee Poster</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            margin: 0;
            padding: 24px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            color: #0f172a;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 95vh;
          }
          .poster-container {
            width: 100%;
            max-width: 480px;
            background: #ffffff;
            border: 6px solid #ea580c;
            border-radius: 32px;
            padding: 40px 32px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.06);
            margin: 0 auto;
          }
          .welcome-badge {
            display: inline-block;
            background: #ffedd5;
            color: #c2410c;
            padding: 6px 20px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 900;
            letter-spacing: 2px;
            text-transform: uppercase;
            margin-bottom: 14px;
            border: 1px solid #fed7aa;
          }
          .school-name {
            font-size: 30px;
            font-weight: 900;
            color: #0f172a;
            margin: 0;
            letter-spacing: -0.5px;
            text-transform: uppercase;
          }
          .school-tagline {
            font-size: 14px;
            font-weight: 800;
            color: #ea580c;
            text-transform: uppercase;
            letter-spacing: 3px;
            margin: 4px 0 24px 0;
          }
          .qr-box {
            display: inline-block;
            padding: 18px;
            background: #f8fafc;
            border: 3px dashed #fdba74;
            border-radius: 24px;
            margin-bottom: 24px;
          }
          .qr-img {
            width: 290px;
            height: 290px;
            display: block;
            margin: 0 auto;
            border-radius: 14px;
          }
          .action-header {
            font-size: 19px;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 8px 0;
          }
          .action-desc {
            font-size: 13px;
            color: #475569;
            font-weight: 600;
            line-height: 1.5;
            max-width: 380px;
            margin: 0 auto 24px auto;
          }
          .footer-note {
            display: flex;
            justify-content: space-between;
            padding-top: 16px;
            border-top: 2px solid #f1f5f9;
            font-size: 11px;
            color: #94a3b8;
            font-family: monospace;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="poster-container">
          <div class="welcome-badge">Welcome Parents!</div>
          <h1 class="school-name">BIRLA OPEN MINDS</h1>
          <div class="school-tagline">International School</div>

          <div class="qr-box">
            <img class="qr-img" id="qr-poster-img" src="${qrImageApiUrl}" alt="Scan QR Code to Register" />
          </div>

          <h2 class="action-header">📱 Scan QR Code on Phone to Register</h2>
          <p class="action-desc">
            Open your mobile camera to scan this QR code and fill in your student's admission enquiry details. 
            Your response goes directly to our Counsellor's Desk in real time!
          </p>

          <div class="footer-note">
            <span>Admissions Front Desk</span>
            <span>Birla Open Minds Reception Standee</span>
          </div>
        </div>
        <script>
          const img = document.getElementById('qr-poster-img');
          const doPrint = function() {
            window.focus();
            window.print();
          };
          if (img.complete) {
            setTimeout(doPrint, 350);
          } else {
            img.onload = function() {
              setTimeout(doPrint, 350);
            };
            img.onerror = doPrint;
          }
        </script>
      </body>
      </html>
    `;

    try {
      const printWindow = window.open("", "_blank", "width=850,height=950");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(posterHtml);
        printWindow.document.close();
        return;
      }
    } catch {}

    // Fallback if popup blocked: use hidden iframe
    try {
      let iframe = document.getElementById("qr-standee-print-frame") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "qr-standee-print-frame";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(posterHtml);
        doc.close();
      }
    } catch {
      window.print();
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-600 selection:text-white">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white p-4 sm:p-5 shadow-xl shrink-0 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 font-bold border border-white/30 shadow-md">
              <School size={22} />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full bg-white/20 text-amber-100 text-[10px] font-black uppercase tracking-wider">
                Reception Self-Service Kiosk
              </span>
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                BIRLA OPEN MINDS
              </h1>
              <p className="text-[10px] text-amber-100 font-bold tracking-widest uppercase">
                International School - Parent Enquiry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "register" ? "print_qr" : "register")}
              className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all border border-white/30 shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              {activeTab === "register" ? (
                <>
                  <Printer size={14} />
                  <span className="hidden sm:inline">Reception QR Poster</span>
                </>
              ) : (
                <>
                  <Smartphone size={14} />
                  <span>Parent Form</span>
                </>
              )}
            </button>

            {onNavigateToLogin && (
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-bold transition-all border border-slate-700 shadow-sm flex items-center gap-1 cursor-pointer"
                title="Staff Login Desk"
              >
                <span>Staff Desk</span>
                <ExternalLink size={12} />
              </button>
            )}

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 space-y-6 overflow-y-auto">
        {activeTab === "register" ? (
          isSubmittedSuccess ? (
            <div className="p-6 sm:p-10 text-center space-y-6 bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 my-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-orange-500/30 animate-bounce border-2 border-amber-300">
                <CheckCircle2 size={44} />
              </div>

              {/* High Impact Token Slip Pass Card */}
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-400 p-6 rounded-2xl shadow-xl text-center space-y-4 max-w-md mx-auto relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-amber-500 text-slate-950 font-black text-[9px] uppercase tracking-wider rounded-bl-xl shadow-xs">
                  Official Token Pass
                </div>

                <div className="space-y-1 pt-1">
                  <span className="text-[10px] uppercase tracking-widest text-amber-400 font-extrabold block">
                    Birla Open Minds International School
                  </span>
                  <p className="text-xs text-slate-400 font-semibold">
                    Reception Self-Service Registration
                  </p>
                </div>

                {/* Big Token Number Display */}
                <div className="py-3 px-4 bg-slate-900 border-2 border-dashed border-amber-400/80 rounded-xl inline-block w-full shadow-inner">
                  <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider block">
                    YOUR RECEPTION QUEUE TOKEN
                  </span>
                  <div className="text-4xl sm:text-5xl font-black text-amber-400 my-1 tracking-tight">
                    TOKEN #{assignedToken}
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-extrabold border border-amber-400/40 inline-block">
                    {assignedToken === 1 ? "🥇 1st Arrived Today" : assignedToken === 2 ? "🥈 2nd Arrived Today" : assignedToken === 3 ? "🥉 3rd Arrived Today" : `${assignedToken}th Arrived Today`}
                  </span>
                </div>

                {/* Date & Details Verification Bar */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Entry Date</span>
                    <span className="text-amber-300 font-mono font-bold">
                      📅 {new Date().toLocaleDateString("en-GB").replace(/\//g, "-")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Entry Time</span>
                    <span className="text-slate-200 font-mono font-bold">
                      ⏰ {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="col-span-2 pt-1.5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="text-slate-300 font-bold">
                      Student: <strong className="text-white">{studentName}</strong>
                      {dateOfBirth && (
                        <span className="text-amber-300 text-[11px] font-mono ml-1.5">
                          (DOB: {dateOfBirth})
                        </span>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold w-fit">Class {applyingForClass}</span>
                  </div>
                  <div className="col-span-2 text-[11px] text-slate-400 font-mono">
                    📞 Phone: <span className="text-emerald-400 font-bold">+91 {contactNo}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 text-left space-y-1">
                  <p className="font-extrabold flex items-center gap-1.5 text-emerald-400">
                    <span>📍 Reception Lounge Notice:</span>
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed font-medium">
                    Please relax in our waiting area. Your Token #{assignedToken} is live on our Admissions Counsellor's desk. You will be called shortly!
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center gap-2 active:scale-95"
                >
                  <Sparkles size={16} />
                  <span>Register Another Student</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl space-y-6">
              <div className="p-4 bg-gradient-to-r from-orange-950/60 to-amber-950/60 border border-orange-500/30 rounded-2xl text-xs text-orange-200 flex items-start gap-3">
                <HeartHandshake size={22} className="text-orange-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-extrabold text-sm text-white">
                    Welcome Parents! Self-Service Registration
                  </p>
                  <p className="text-orange-200/90 leading-relaxed font-medium">
                    Please fill in your basic details below. Your response will instantly alert our Admissions Counsellors in real-time.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Student Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Student Full Name <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="e.g. Master Sravan Kumar / Baby Ananya"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-semibold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* 1. Student Date of Birth (DOB) - Added right below Student Full Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-200 tracking-wide">
                        Student Date of Birth (DOB) <span className="text-orange-500">*</span>
                      </label>
                      <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                        Birth Date
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      value={dateOfBirth}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all [color-scheme:dark]"
                    />
                  </div>

                  {/* Class Applying */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Applying for Class <span className="text-orange-500">*</span>
                    </label>
                    <select
                      value={applyingForClass}
                      onChange={(e) => setApplyingForClass(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                    >
                      {CLASS_OPTIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Parent Mobile Contact - Strictly 10 Digits */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-200 tracking-wide">
                        Mobile Contact Number <span className="text-orange-500">*</span>
                      </label>
                      <span className={`text-[10px] font-extrabold ${contactNo.length === 10 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {contactNo.length === 10 ? '✓ Valid 10 Digits' : `${contactNo.length}/10 digits`}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 font-bold text-xs pointer-events-none">
                        <span>🇮🇳 +91</span>
                        <span className="text-slate-600">|</span>
                      </div>
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]{10}"
                        maxLength={10}
                        required
                        value={contactNo}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full pl-20 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono font-bold tracking-wider placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      />
                    </div>
                    {phoneError && (
                      <p className="text-[11px] font-bold text-rose-400 animate-in fade-in">
                        {phoneError}
                      </p>
                    )}
                  </div>

                  {/* Father Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Father's Name
                    </label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Father's full name"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* Mother Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Mother's Name
                    </label>
                    <input
                      type="text"
                      value={motherName}
                      onChange={(e) => setMotherName(e.target.value)}
                      placeholder="Mother's full name"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* Previous School */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Previous School &amp; Board
                    </label>
                    <input
                      type="text"
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                      placeholder="e.g. DPS School, Hyderabad / St. Joseph CBSE"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* How Heard About School */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      How did you hear about Birla Open Minds?
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {SOURCES.map((src) => {
                        const isChecked = heardAboutSchool.includes(src);
                        return (
                          <button
                            type="button"
                            key={src}
                            onClick={() => {
                              if (isChecked) {
                                setHeardAboutSchool(heardAboutSchool.filter((s) => s !== src));
                              } else {
                                setHeardAboutSchool([...heardAboutSchool, src]);
                              }
                            }}
                            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                              isChecked
                                ? "bg-orange-600 border-orange-500 text-white shadow-md"
                                : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800"
                            }`}
                          >
                            {isChecked ? "✓ " : "+ "}{src}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                    🔒 Direct submission to Admissions Counter
                  </span>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl text-sm font-black shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                  >
                    <span>{isSubmitting ? "Submitting..." : "Submit Enquiry Registration"}</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            </div>
          )
        ) : (
          /* RECEPTION POSTER PRINT VIEW */
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <QrCode size={20} className="text-orange-500" />
                    <span>Reception Desk Standee / Poster QR Generator</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Print this poster to place at front office desk or reception waiting area.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={targetQrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
                    title="Open the exact mobile form link in a new tab to test"
                  >
                    <ExternalLink size={14} />
                    <span>Test Form</span>
                  </a>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    {copiedUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPoster}
                    className="px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    title="Generate and print full-size A4 reception standee poster"
                  >
                    <Printer size={16} />
                    <span>Print A4 Poster</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Printable Poster Container */}
            <div id="printable-reception-qr-poster" className="bg-white text-slate-900 p-8 sm:p-10 rounded-3xl border-4 border-orange-500 shadow-2xl max-w-md mx-auto text-center space-y-6">
              <div className="space-y-1">
                <div className="inline-block px-3 py-1 bg-orange-100 text-orange-900 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Welcome Parents!
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                  BIRLA OPEN MINDS
                </h2>
                <p className="text-xs font-extrabold text-orange-600 uppercase tracking-widest">
                  International School
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-orange-300 inline-block shadow-inner">
                <img
                  src={qrImageApiUrl}
                  alt="Scan QR Code to Register Admission Enquiry"
                  className="w-60 h-60 mx-auto rounded-xl shadow-md"
                />
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-900 flex items-center justify-center gap-1.5">
                  <Smartphone size={18} className="text-orange-600" />
                  <span>Scan QR Code on Phone to Register</span>
                </h3>
                <p className="text-xs text-slate-600 font-semibold max-w-xs mx-auto leading-relaxed">
                  Open your mobile camera to fill in your student's details. Your response goes directly to our Counsellor's Desk in real time!
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span>Admissions Desk</span>
                <span>Birla Open Minds Kiosk</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-xs text-slate-500 border-t border-slate-900 shrink-0">
        Birla Open Minds International School • Parent Self-Service Kiosk v2.4.0
      </footer>
    </div>
  );
}
