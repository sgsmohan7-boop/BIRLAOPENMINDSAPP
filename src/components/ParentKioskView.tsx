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
  ArrowLeft,
  Calendar,
  Clock
} from "lucide-react";
import { ParentSelfEntry } from "../types";
import { isFirebaseConfigured, saveDocument, getNextDailyTokenNo } from "../utils/firebase";

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
  const [submissionTimestamp, setSubmissionTimestamp] = useState<{ date: string; time: string }>({
    date: "",
    time: ""
  });
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
  const [parentNames, setParentNames] = useState("");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [whatsappNo, setWhatsappNo] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [heardAboutSchool, setHeardAboutSchool] = useState<string[]>(["Google / Online Search"]);
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

    const combinedParentInput = (parentNames || `${fatherName} / ${motherName}`).trim();
    if (!combinedParentInput) {
      alert("Please enter the Father's / Mother's full name.");
      return;
    }

    let finalFather = fatherName.trim();
    let finalMother = motherName.trim();
    if (parentNames.trim()) {
      if (parentNames.includes("/")) {
        const parts = parentNames.split("/");
        finalFather = parts[0].trim();
        finalMother = parts.slice(1).join("/").trim();
      } else {
        finalFather = parentNames.trim();
        finalMother = "";
      }
    }

    if (!previousSchool.trim()) {
      alert("Please enter the student's previous school & board.");
      return;
    }
    if (!residentialAddress.trim()) {
      alert("Please enter the residential address (Area / Locality).");
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const dmy = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = `PSE-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}-${Date.now()}`;

    // Calculate daily token S.No (1, 2, 3...) resetting daily each morning across all devices/networks
    let dailyTokenNo = 1;
    try {
      dailyTokenNo = await getNextDailyTokenNo(dmy, dateKey);
    } catch {
      dailyTokenNo = 1;
    }

    let finalEntry: ParentSelfEntry = {
      id,
      studentName: studentName.trim(),
      dateOfBirth: dateOfBirth.trim(),
      applyingForClass,
      fatherName: finalFather || "—",
      motherName: finalMother || "—",
      contactNo: cleanPhone,
      whatsappNo: (whatsappNo.trim() || cleanPhone).replace(/\D/g, "").slice(0, 10),
      previousSchool: previousSchool.trim(),
      residentialAddress: residentialAddress.trim(),
      heardAboutSchool,
      reasonForChoosing: reasonForChoosing.trim(),
      submittedAt: now.toISOString(),
      formattedDate: `${dmy} ${timeStr}`,
      status: "pending",
      dailyTokenNo,
      entryDate: dmy,
      dateKey
    };

    // 1. Post to 24/7 server endpoint to get server-verified unique daily token number
    try {
      const serverRes = await fetch("/api/parent-self-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalEntry)
      });
      if (serverRes.ok) {
        const resData = await serverRes.json();
        if (resData && resData.entry && resData.entry.dailyTokenNo) {
          finalEntry.dailyTokenNo = resData.entry.dailyTokenNo;
          dailyTokenNo = resData.entry.dailyTokenNo;
        }
      }
    } catch (err) {
      console.warn("Server parent-self-entry post warning:", err);
    }

    // 2. Direct real-time Firebase Firestore save with verified token number so counsellor sees it within 100ms
    try {
      if (isFirebaseConfigured()) {
        await saveDocument("parent_self_entries", id, finalEntry);
      }
    } catch (fErr) {
      console.warn("Firestore parent entry save warning:", fErr);
    }

    // 3. Save locally for instantaneous offline reactivity
    try {
      const existingRaw = localStorage.getItem("parent_self_entries");
      const existing: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [finalEntry, ...existing.filter(e => e.id !== id)];
      localStorage.setItem("parent_self_entries", JSON.stringify(updated));

      // Dispatch event to notify open Counsellor tabs
      window.dispatchEvent(new CustomEvent("parent_self_entry_added", { detail: finalEntry }));
    } catch (err) {
      console.warn("Local storage parent entry save warning:", err);
    }

    setAssignedToken(dailyTokenNo);
    setSubmissionTimestamp({
      date: dmy,
      time: timeStr
    });

    if (onSubmitSuccess) {
      onSubmitSuccess(finalEntry);
    }

    setIsSubmittedSuccess(true);
    setIsSubmitting(false);
  };

  const handleResetForm = () => {
    setStudentName("");
    setDateOfBirth("");
    setApplyingForClass("Grade 1");
    setParentNames("");
    setFatherName("");
    setMotherName("");
    setContactNo("");
    setPhoneError("");
    setWhatsappNo("");
    setPreviousSchool("");
    setResidentialAddress("");
    setReasonForChoosing("");
    setSubmissionTimestamp({ date: "", time: "" });
    setIsSubmittedSuccess(false);
  };

  const handlePrintSlip = () => {
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      alert("Please allow pop-ups to print the official admission slip.");
      return;
    }

    const dateStr = submissionTimestamp.date || new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = submissionTimestamp.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BIRLA OPEN MINDS - Admission Slip (${studentName})</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 20px;
            background: #ffffff;
            line-height: 1.4;
          }
          .slip-card {
            border: 2px solid #ea580c;
            border-radius: 16px;
            padding: 24px;
            max-width: 680px;
            margin: 0 auto;
            background: #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 2px solid #ea580c;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .brand-logo {
            height: 55px;
            width: auto;
          }
          .school-title {
            font-size: 20px;
            font-weight: 900;
            color: #800020;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .school-subtitle {
            font-size: 11px;
            font-weight: 800;
            color: #ea580c;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 2px;
          }
          .token-badge {
            background: #800020;
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 12px;
            text-align: center;
            border: 1.5px solid #f59e0b;
          }
          .token-num {
            font-size: 24px;
            font-weight: 900;
            line-height: 1;
          }
          .token-lbl {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
          }
          .banner {
            background: #fff7ed;
            border: 1px solid #ffedd5;
            color: #9a3412;
            padding: 10px 14px;
            border-radius: 10px;
            text-align: center;
            font-weight: 900;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 20px;
          }
          .full-col {
            grid-column: span 2;
          }
          .field-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            padding: 9px 12px;
            border-radius: 8px;
          }
          .field-label {
            font-size: 9px;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 3px;
          }
          .field-value {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
          }
          .field-highlight {
            color: #800020;
            font-weight: 900;
          }
          .instruction-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 24px;
            font-size: 11px;
            color: #166534;
            line-height: 1.5;
          }
          .signatures {
            margin-top: 32px;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            padding-top: 16px;
            border-top: 1px dashed #cbd5e1;
          }
          .sig-box {
            text-align: center;
            width: 200px;
          }
          .sig-line {
            border-top: 1px solid #64748b;
            margin-top: 36px;
            padding-top: 4px;
            font-size: 10px;
            font-weight: 800;
            color: #334155;
            text-transform: uppercase;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="slip-card">
          <div class="header">
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="/birla_open_minds_logo.png" alt="Birla Open Minds" class="brand-logo" />
              <div>
                <h1 class="school-title">BIRLA OPEN MINDS</h1>
                <div class="school-subtitle">INTERNATIONAL SCHOOL • LB NAGAR BRANCH</div>
              </div>
            </div>
            <div class="token-badge">
              <div class="token-lbl">Walk-in Queue</div>
              <div class="token-num">#${assignedToken}</div>
            </div>
          </div>

          <div class="banner">
            ✓ Official Admission Enquiry Acknowledgment Slip
          </div>

          <div class="grid">
            <div class="field-box">
              <div class="field-label">Student Full Name</div>
              <div class="field-value field-highlight">${studentName}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Applying for Class</div>
              <div class="field-value">${applyingForClass}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Date of Birth</div>
              <div class="field-value">${dateOfBirth || "—"}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Contact Mobile</div>
              <div class="field-value" style="font-family: monospace;">+91 ${contactNo}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Father's Name</div>
              <div class="field-value">${fatherName || "—"}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Mother's Name</div>
              <div class="field-value">${motherName || "—"}</div>
            </div>
            ${residentialAddress ? `
            <div class="field-box full-col">
              <div class="field-label">Residential Address</div>
              <div class="field-value" style="font-size: 11px;">${residentialAddress}</div>
            </div>
            ` : ''}
            ${previousSchool ? `
            <div class="field-box full-col">
              <div class="field-label">Previous School</div>
              <div class="field-value" style="font-size: 11px;">${previousSchool}</div>
            </div>
            ` : ''}
            <div class="field-box">
              <div class="field-label">Form Submission Date</div>
              <div class="field-value" style="font-family: monospace;">${dateStr}</div>
            </div>
            <div class="field-box">
              <div class="field-label">Form Submission Time</div>
              <div class="field-value field-highlight" style="font-family: monospace;">${timeStr}</div>
            </div>
          </div>

          <div class="instruction-box">
            <strong>📍 Reception Guidance:</strong> Your response is live at our Admissions Counsellor's desk (Token #${assignedToken}). If you are currently at school, please present this slip at reception and relax in our parent lounge. You will be called shortly.
          </div>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line">Parent / Guardian Signature</div>
            </div>
            <div class="sig-box">
              <div class="sig-line">Admissions Desk Verification</div>
            </div>
          </div>

          <div class="footer">
            Birla Open Minds International School • LB Nagar Branch • Official Parent Enquiry Slip
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
            <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 border border-white/80">
              <img
                src="/birla_open_minds_logo.png"
                alt="Birla Open Minds International School"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight leading-tight">
                  BIRLA OPEN MINDS
                </h1>
              </div>
              <p className="text-[10px] text-amber-100 font-bold tracking-widest uppercase">
                International School • LB Nagar
              </p>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white text-[#800020] font-black text-[10px] sm:text-[11px] shadow-sm uppercase tracking-wider border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse"></span>
                  Admission Enquiry Form
                </span>
              </div>
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
            <div className="relative bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-amber-200/90 p-5 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 my-2 max-w-xl mx-auto">
              {/* Top-Left Decorative Ribbon Swag */}
              <div className="absolute top-0 left-0 w-32 sm:w-48 h-24 sm:h-36 pointer-events-none z-0 overflow-hidden rounded-tl-3xl">
                <svg viewBox="0 0 220 180" className="w-full h-full" preserveAspectRatio="none">
                  <path d="M 0 0 L 215 0 C 178 26 122 58 74 112 C 40 148 18 172 0 188 Z" fill="#F59E0B" />
                  <path d="M 0 0 L 195 0 C 160 22 110 50 62 102 C 30 136 12 158 0 172 Z" fill="#EA580C" />
                  <path d="M 0 0 L 160 0 C 130 18 90 42 45 88 C 20 114 8 132 0 145 Z" fill="#800020" />
                </svg>
              </div>

              {/* Bottom-Right Decorative Ribbon Swag (Matching top-left curve style via rotate-180, elegantly sized) */}
              <div className="absolute bottom-0 right-0 w-28 sm:w-36 h-20 sm:h-26 pointer-events-none z-0 overflow-hidden rounded-br-3xl">
                <svg viewBox="0 0 220 180" className="w-full h-full rotate-180" preserveAspectRatio="none">
                  <path d="M 0 0 L 215 0 C 178 26 122 58 74 112 C 40 148 18 172 0 188 Z" fill="#F59E0B" />
                  <path d="M 0 0 L 195 0 C 160 22 110 50 62 102 C 30 136 12 158 0 172 Z" fill="#EA580C" />
                  <path d="M 0 0 L 160 0 C 130 18 90 42 45 88 C 20 114 8 132 0 145 Z" fill="#800020" />
                </svg>
              </div>

              <div className="relative z-10 text-center space-y-4 pt-1 sm:pt-2">
                {/* Brand Logo & Header */}
                <div className="flex flex-col items-center">
                  <img
                    src="/birla_open_minds_logo.png"
                    alt="Birla Open Minds International School"
                    className="h-14 sm:h-16 w-auto object-contain mx-auto drop-shadow-xs mb-1"
                  />
                  <h2 className="text-xl sm:text-2xl font-black text-[#800020] tracking-wide uppercase">
                    BIRLA OPEN MINDS
                  </h2>
                  <p className="text-xs sm:text-sm font-black text-slate-800 tracking-widest uppercase">
                    INTERNATIONAL SCHOOL
                  </p>
                  <div className="flex items-center justify-center gap-2 mt-1 w-full max-w-xs">
                    <span className="h-[1.5px] flex-1 bg-amber-500 rounded-full"></span>
                    <span className="text-[#800020] font-bold text-xs tracking-wider">LB Nagar Branch</span>
                    <span className="h-[1.5px] flex-1 bg-amber-500 rounded-full"></span>
                  </div>
                </div>

                {/* Checkmark with Sunburst Accent Lines */}
                <div className="pt-2 flex flex-col items-center justify-center">
                  <div className="flex items-center justify-center gap-3">
                    {/* Left sunburst rays */}
                    <div className="flex gap-1.5 opacity-90 -rotate-12">
                      <span className="w-1.5 h-6 bg-amber-400 rounded-full block transform -rotate-12"></span>
                      <span className="w-1.5 h-7 bg-amber-500 rounded-full block transform -rotate-6"></span>
                    </div>

                    {/* Center circular maroon badge */}
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#800020] text-white flex items-center justify-center shadow-lg shadow-rose-950/20 border-2 border-amber-300">
                      <Check size={34} strokeWidth={3.5} className="text-white" />
                    </div>

                    {/* Right sunburst rays */}
                    <div className="flex gap-1.5 opacity-90 rotate-12">
                      <span className="w-1.5 h-7 bg-amber-500 rounded-full block transform rotate-6"></span>
                      <span className="w-1.5 h-6 bg-amber-400 rounded-full block transform rotate-12"></span>
                    </div>
                  </div>

                  {/* Pill Banner */}
                  <div className="mt-3">
                    <span className="inline-block bg-[#800020] text-white font-black text-lg sm:text-2xl px-8 sm:px-10 py-1.5 sm:py-2 rounded-full shadow-md tracking-tight">
                      Submission Successful!
                    </span>
                  </div>
                  <p className="mt-2 text-slate-700 font-bold text-xs sm:text-sm">
                    Your enquiry form has been submitted successfully!
                  </p>

                  {/* Submission Date & Time Badge */}
                  <div className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-100/90 border border-amber-300 rounded-full text-slate-800 text-[11px] sm:text-xs font-semibold shadow-xs">
                    <Clock size={13} className="text-[#800020] shrink-0" />
                    <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px]">Submitted On:</span>
                    <strong className="font-mono text-[#800020] font-black">
                      {submissionTimestamp.date || new Date().toLocaleDateString("en-GB").replace(/\//g, "-")} at {submissionTimestamp.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </div>
                </div>

                {/* Box 1: Waiting Area & Live Token */}
                <div className="bg-[#FFFDF5] border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3 sm:gap-4 text-left">
                  <div className="shrink-0 flex items-center justify-center text-[#800020]">
                    <div className="relative p-2 bg-amber-100/70 rounded-xl border border-amber-300">
                      <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#800020]" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4a2 2 0 100-4 2 2 0 000 4zm1 5h-2c-1.1 0-2 .9-2 2v6h2v5h2v-5h3v-2h-3v-4h2a1 1 0 001-1V9a1 1 0 00-1-1zm6.5 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm0 1a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm-.5 1h1v1.5l1 .5-.5.8-1.5-.8V15z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="w-[1.5px] h-12 bg-amber-400/80 shrink-0"></div>
                  <div className="flex-1 text-slate-800 text-xs sm:text-sm leading-relaxed">
                    <p className="font-medium text-slate-900">
                      Your{" "}
                      <span className="inline-block bg-[#800020] text-white font-extrabold px-2.5 py-0.5 rounded-md shadow-xs text-xs sm:text-sm mx-0.5">
                        Token #{assignedToken}
                      </span>{" "}
                      is live at our Admissions Counsellor's desk.
                    </p>
                    <p className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
                      If you are at school, please relax in our waiting area; you will be called shortly.
                    </p>
                  </div>
                </div>

                {/* Box 2: Online / Remote Submission Notice */}
                <div className="bg-[#FFFDF5] border-2 border-amber-400 rounded-2xl p-3.5 sm:p-4 shadow-xs flex items-center gap-3 sm:gap-4 text-left">
                  <div className="shrink-0 flex items-center justify-center text-[#800020]">
                    <div className="relative p-2 bg-amber-100/70 rounded-xl border border-amber-300">
                      <svg className="w-7 h-7 sm:w-8 sm:h-8 text-[#800020]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="12" rx="2" />
                        <path d="M2 20h20" />
                        <circle cx="12" cy="10" r="3" />
                        <path d="M12 7c-1.5 1-2 2-2 3s.5 2 2 3c1.5-1 2-2 2-3s-.5-2-2-3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="w-[1.5px] h-10 bg-amber-400/80 shrink-0"></div>
                  <div className="flex-1 text-slate-700 text-xs sm:text-sm leading-relaxed">
                    If you have submitted this form online from another location, our Admissions Team will contact you if required.
                  </div>
                </div>

                {/* Candidate Verification Summary Details */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-left text-xs grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Student Name</span>
                    <span className="font-extrabold text-[#800020] text-sm">{studentName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Applying For Class</span>
                    <span className="font-bold text-slate-800">{applyingForClass}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Date of Birth</span>
                    <span className="font-semibold text-slate-700">{dateOfBirth || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Contact Phone</span>
                    <span className="font-mono font-bold text-slate-800">+91 {contactNo}</span>
                  </div>
                </div>

                {/* Register Another Student & Print Slip Buttons */}
                <div className="pt-1 flex items-center justify-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={handlePrintSlip}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 border border-amber-500"
                  >
                    <Printer size={16} />
                    <span>Print Slip</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-8 py-3 bg-gradient-to-r from-[#800020] via-[#991b1b] to-[#c2410c] hover:from-[#6b001a] hover:to-[#9a3412] text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-rose-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Sparkles size={16} />
                    <span>Register Another Student</span>
                  </button>
                </div>

                {/* Bottom Tagline with Orange Separators */}
                <div className="flex items-center justify-center gap-2 pt-1 pb-1 w-full">
                  <span className="h-[1.5px] flex-1 max-w-[60px] sm:max-w-[100px] bg-amber-500 rounded-full"></span>
                  <span className="text-[#800020] italic font-black text-xs sm:text-sm tracking-wide">
                    Thank you for choosing Birla Open Minds!
                  </span>
                  <span className="h-[1.5px] flex-1 max-w-[60px] sm:max-w-[100px] bg-amber-500 rounded-full"></span>
                </div>
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
                      Student's Full Name <span className="text-orange-500">*</span>
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

                  {/* 1. Student Date of Birth (DOB) - Click box opens date picker */}
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
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker?.();
                        } catch {}
                      }}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all [color-scheme:dark] cursor-pointer"
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

                  {/* 2. Parent Contact - Strictly 10 Digits */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-slate-200 tracking-wide">
                        Contact Number <span className="text-orange-500">*</span>
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

                  {/* Combined Father / Mother Name */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Father's / Mother's Name <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={parentNames || (fatherName && motherName ? `${fatherName} / ${motherName}` : fatherName || motherName)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParentNames(val);
                        if (val.includes("/")) {
                          const parts = val.split("/");
                          setFatherName(parts[0].trim());
                          setMotherName(parts.slice(1).join("/").trim());
                        } else {
                          setFatherName(val.trim());
                          setMotherName("");
                        }
                      }}
                      placeholder="e.g. Ramesh Kumar / Sunita Devi"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* Previous School */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Previous School &amp; Board <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={previousSchool}
                      onChange={(e) => setPreviousSchool(e.target.value)}
                      placeholder="e.g. DPS School, Hyderabad / St. Joseph CBSE"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* Residential Address */}
                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      Residential Address (Area / Locality) <span className="text-orange-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={residentialAddress}
                      onChange={(e) => setResidentialAddress(e.target.value)}
                      placeholder="e.g. Plot 45, Green Hills Colony, LB Nagar"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    />
                  </div>

                  {/* How Heard About Birla Open Minds - Select Dropdown Picker */}
                  <div className="sm:col-span-2 space-y-1 pt-1">
                    <label className="block text-xs font-black text-slate-200 tracking-wide">
                      How did you hear about Birla Open Minds?
                    </label>
                    <select
                      value={heardAboutSchool[0] || ""}
                      onChange={(e) => setHeardAboutSchool([e.target.value])}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all cursor-pointer"
                    >
                      <option value="" disabled>-- Choose Option --</option>
                      {SOURCES.map((src) => (
                        <option key={src} value={src}>{src}</option>
                      ))}
                    </select>
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
