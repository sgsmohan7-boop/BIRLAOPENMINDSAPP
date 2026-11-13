import React, { useState } from "react";
import { 
  School, 
  CheckCircle2, 
  Check,
  Sparkles, 
  ArrowRight, 
  HeartHandshake, 
  Smartphone,
  Phone,
  User,
  GraduationCap,
  Building2,
  Globe,
  Printer,
  Calendar,
  Clock
} from "lucide-react";
import { ParentSelfEntry, EnquiryType, getNextOnlineEnquiryNo, recordHighestOnlineEnquiryNumber } from "../types";
import { isFirebaseConfigured, saveDocument, getNextDailyTokenNo } from "../utils/firebase";

interface ParentFormMobileOnlyProps {
  onSubmitSuccess?: (entry: ParentSelfEntry) => void;
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
  "Google / Online Search",
  "Social Media / Ads",
  "Reference / Friend",
  "Existing Parent",
  "School Hoarding / Billboard",
  "Walk-in / Direct Visit"
];

export default function ParentFormMobileOnly({ onSubmitSuccess }: ParentFormMobileOnlyProps) {
  // Detect URL parameter (?type=online or ?mode=online) to pre-select Online Enquiry for website/social links
  const [enquiryType, setEnquiryType] = useState<EnquiryType>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const t = (params.get("type") || params.get("mode") || "").toLowerCase();
      if (t === "online" || t === "web" || t === "social") return "online";
    }
    return "walkin";
  });

  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cloudSyncSuccess, setCloudSyncSuccess] = useState(true);
  const [serverSyncSuccess, setServerSyncSuccess] = useState(true);
  const [assignedToken, setAssignedToken] = useState<number>(1);
  const [assignedOnlineRef, setAssignedOnlineRef] = useState<string>("");
  const [siblingAssignedOnlineRef, setSiblingAssignedOnlineRef] = useState<string | null>(null);
  const [submissionTimestamp, setSubmissionTimestamp] = useState<{ date: string; time: string }>({
    date: "",
    time: ""
  });

  // Form fields
  const [studentName, setStudentName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [applyingForClass, setApplyingForClass] = useState("Grade 1");
  const [gender, setGender] = useState<"Male" | "Female" | "Other">("Male");
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

  // Sibling (2nd Child) State
  const [hasSibling, setHasSibling] = useState(false);
  const [siblingName, setSiblingName] = useState("");
  const [siblingDob, setSiblingDob] = useState("");
  const [siblingClass, setSiblingClass] = useState("PP1 (LKG)");
  const [siblingGender, setSiblingGender] = useState<"Male" | "Female" | "Other">("Female");
  const [siblingPrevSchool, setSiblingPrevSchool] = useState("");
  const [siblingAssignedToken, setSiblingAssignedToken] = useState<number | null>(null);

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

    if (!fatherName.trim()) {
      alert("Please enter the Father's full name.");
      return;
    }
    if (!motherName.trim()) {
      alert("Please enter the Mother's full name.");
      return;
    }

    const finalFather = fatherName.trim();
    const finalMother = motherName.trim();

    if (!previousSchool.trim()) {
      alert("Please enter the student's previous school & board.");
      return;
    }
    if (!residentialAddress.trim()) {
      alert("Please enter the residential address (Area / Locality).");
      return;
    }

    if (hasSibling && !siblingName.trim()) {
      alert("Please enter the Sibling (2nd Child)'s full name, or untick the Sibling option.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const dmy = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const dateKey = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id1 = `PSE-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}-${Date.now()}`;
    const id2 = `PSE-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}-${Date.now() + 1}`;

    let dailyTokenNo1: number | undefined = undefined;
    let onlineRefNo1 = "";
    let onlineRefNo2: string | null = null;

    if (enquiryType === "online") {
      // 1. Online Enquiry: Distinct sequence numbering (e.g. ONL-2026-01) - NO daily token
      onlineRefNo1 = getNextOnlineEnquiryNo();
      const match = onlineRefNo1.match(/ONL-.*-(\d+)/i) || onlineRefNo1.match(/(\d+)$/);
      const curNum = match ? parseInt(match[1] || match[0], 10) : 1;
      recordHighestOnlineEnquiryNumber(curNum);

      if (hasSibling && siblingName.trim()) {
        const nextNum = curNum + 1;
        const formatPad = (n: number) => n < 100 ? String(n).padStart(2, "0") : String(n);
        onlineRefNo2 = `ONL-${now.getFullYear()}-${formatPad(nextNum)}`;
        recordHighestOnlineEnquiryNumber(nextNum);
      }
    } else {
      // 2. Campus Walk-in: Authoritative daily token S.No across Firestore, Server API, and Local Storage
      try {
        dailyTokenNo1 = await getNextDailyTokenNo(dmy, dateKey);
      } catch {
        dailyTokenNo1 = 1;
      }
    }

    let finalEntry1: ParentSelfEntry = {
      id: enquiryType === "online" ? onlineRefNo1 : id1,
      enquiryType,
      onlineRefNo: enquiryType === "online" ? onlineRefNo1 : undefined,
      studentName: studentName.trim(),
      dateOfBirth: dateOfBirth.trim(),
      applyingForClass,
      gender,
      fatherName: finalFather || "—",
      motherName: finalMother || "—",
      contactNo: cleanPhone,
      whatsappNo: (whatsappNo.trim() || cleanPhone).replace(/\D/g, "").slice(0, 10),
      previousSchool: previousSchool.trim(),
      residentialAddress: residentialAddress.trim(),
      heardAboutSchool,
      reasonForChoosing: reasonForChoosing.trim() || (enquiryType === "online" ? "Online Website / Social Media QR Enquiry" : "Campus Reception Walk-in Visit"),
      submittedAt: now.toISOString(),
      formattedDate: `${dmy} ${timeStr}`,
      status: "pending",
      dailyTokenNo: enquiryType === "walkin" ? dailyTokenNo1 : undefined,
      entryDate: dmy,
      dateKey,
      hasSibling: hasSibling && Boolean(siblingName.trim()),
      siblingDetails: hasSibling && siblingName.trim() ? {
        studentName: siblingName.trim(),
        dateOfBirth: siblingDob.trim() || dateOfBirth.trim(),
        applyingForClass: siblingClass,
        previousSchool: siblingPrevSchool.trim() || previousSchool.trim(),
        gender: siblingGender,
        onlineRefNo: enquiryType === "online" && onlineRefNo2 ? onlineRefNo2 : undefined
      } : undefined
    };

    // 1. Post to Server
    let srvOk = false;
    try {
      const res = await fetch("/api/parent-self-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalEntry1)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.entry) {
          srvOk = true;
          if (enquiryType === "walkin" && json.entry.dailyTokenNo) {
            finalEntry1.dailyTokenNo = json.entry.dailyTokenNo;
            dailyTokenNo1 = json.entry.dailyTokenNo;
          }
          if (enquiryType === "online" && json.entry.onlineRefNo) {
            finalEntry1.onlineRefNo = json.entry.onlineRefNo;
            onlineRefNo1 = json.entry.onlineRefNo;
          }
        }
      }
    } catch (err) {
      console.warn("Server parent entry post error:", err);
    }
    setServerSyncSuccess(srvOk);

    if (enquiryType === "online") {
      setAssignedOnlineRef(onlineRefNo1);
      setSiblingAssignedOnlineRef(onlineRefNo2);
    } else {
      setAssignedToken(dailyTokenNo1 || 1);
      setSiblingAssignedToken(hasSibling && siblingName.trim() ? (dailyTokenNo1 || 1) : null);
    }

    setSubmissionTimestamp({
      date: dmy,
      time: timeStr
    });

    // 2. Direct real-time Firebase Firestore save so counsellor desk sees it immediately
    let fsOk = false;
    try {
      if (isFirebaseConfigured()) {
        fsOk = await saveDocument("parent_self_entries", finalEntry1.id, finalEntry1);
      }
    } catch (fErr) {
      console.warn("Firestore parent entry save warning:", fErr);
    }
    setCloudSyncSuccess(!isFirebaseConfigured() || fsOk);

    // 3. Save locally for instantaneous offline updates & cross-tab broadcast
    try {
      const existingRaw = localStorage.getItem("sgs_parent_self_entries") || localStorage.getItem("parent_self_entries");
      const existing: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      let updated = [finalEntry1, ...existing.filter(e => e.id !== finalEntry1.id && e.id !== id1 && e.id !== id2)];
      localStorage.setItem("parent_self_entries", JSON.stringify(updated));
      localStorage.setItem("sgs_parent_self_entries", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("parent_self_entry_added", { detail: finalEntry1 }));
      if (typeof BroadcastChannel !== "undefined") {
        const bc = new BroadcastChannel("bomis_parent_queue_channel");
        bc.postMessage({ type: "parent_self_entry_added", entry: finalEntry1 });
        bc.close();
      }
    } catch (err) {
      console.warn("Local storage save error:", err);
    }

    if (onSubmitSuccess) {
      onSubmitSuccess(finalEntry1);
    }

    setIsSubmittedSuccess(true);
    setIsSubmitting(false);
  };

  const handleResetForm = () => {
    setStudentName("");
    setDateOfBirth("");
    setApplyingForClass("Grade 1");
    setGender("Male");
    setParentNames("");
    setFatherName("");
    setMotherName("");
    setContactNo("");
    setPhoneError("");
    setWhatsappNo("");
    setPreviousSchool("");
    setResidentialAddress("");
    setReasonForChoosing("");
    setHasSibling(false);
    setSiblingName("");
    setSiblingDob("");
    setSiblingClass("PP1 (LKG)");
    setSiblingGender("Female");
    setSiblingPrevSchool("");
    setSiblingAssignedToken(null);
    setAssignedOnlineRef("");
    setSiblingAssignedOnlineRef(null);
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
            ${enquiryType === "online" ? `
            <div class="token-badge" style="background: #065f46; border-color: #34d399;">
              <div class="token-lbl">Online Enquiry Ref</div>
              <div class="token-num" style="font-size: 16px; font-family: monospace;">#${assignedOnlineRef}</div>
            </div>
            ` : `
            <div class="token-badge">
              <div class="token-lbl">Walk-in Queue</div>
              <div class="token-num">#${assignedToken}</div>
            </div>
            `}
          </div>

          <div class="banner" style="${enquiryType === "online" ? 'background: #ecfdf5; border-color: #a7f3d0; color: #065f46;' : ''}">
            ✓ ${enquiryType === "online" ? "Official Online Admission Enquiry Acknowledgment Slip" : "Official Walk-in Admission Enquiry Acknowledgment Slip"}
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

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-600 selection:text-white">
      
      {/* Clean Professional School Header with Official Logo */}
      <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-amber-700 text-white px-4 py-3.5 sm:px-6 sm:py-4 shadow-xl sticky top-0 z-40 border-b border-orange-400/40">
        <div className="max-w-xl mx-auto flex items-center gap-3.5">
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center shrink-0 border border-white/80">
            <img
              src="/birla_open_minds_logo.png"
              alt="Birla Open Minds International School"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-wide leading-tight truncate">
                BIRLA OPEN MINDS
              </h1>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-100 font-extrabold tracking-wider uppercase truncate">
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
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {isSubmittedSuccess ? (
          <div className="relative bg-white text-slate-800 rounded-3xl shadow-2xl overflow-hidden border border-amber-200/90 p-5 sm:p-8 space-y-5 animate-in zoom-in-95 duration-200 my-2">
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

              {/* Conditional Display: Online Enquiry vs Campus Walk-in Token */}
              {enquiryType === "online" ? (
                <div className="bg-emerald-50/95 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                      <Globe size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2.5 py-0.5 rounded-full inline-block mb-1">
                        🌐 Online Enquiry Reference
                      </span>
                      <h4 className="text-base sm:text-lg font-black text-emerald-950 font-mono flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 bg-emerald-700 text-white rounded-lg shadow-sm">
                          #{assignedOnlineRef || "ONL-PENDING"}
                        </span>
                        {studentName && <span className="text-sm font-bold text-slate-700">({studentName})</span>}
                        {siblingAssignedOnlineRef && (
                          <span className="px-3 py-1 bg-purple-700 text-white rounded-lg shadow-sm">
                            #{siblingAssignedOnlineRef} ({siblingName})
                          </span>
                        )}
                      </h4>
                    </div>
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-emerald-200 text-xs text-slate-800 space-y-1.5">
                    <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <span>📞 What happens next?</span>
                    </p>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      Your admission enquiry has been sent directly to our Admissions Counsellor pool. Our counsellor will call you on <strong className="font-mono text-slate-900">+91 {contactNo}</strong> or send curriculum and fee details via WhatsApp.
                    </p>
                    <p className="text-[11px] text-emerald-800 font-semibold pt-1 border-t border-emerald-100 flex items-center gap-1">
                      <span>ℹ️</span> Our Admissions Team will follow up directly via Phone / WhatsApp regarding fee structure and admission.
                    </p>
                  </div>
                </div>
              ) : (
                <>
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
                      {siblingAssignedToken ? (
                        <div>
                          <p className="font-bold text-slate-900">
                            Family Sibling Admission Tokens:{" "}
                            <span className="inline-block bg-[#800020] text-white font-extrabold px-2 py-0.5 rounded-md shadow-xs text-xs sm:text-sm mx-0.5">
                              #{assignedToken} ({studentName})
                            </span>{" "}
                            &amp;{" "}
                            <span className="inline-block bg-purple-700 text-white font-extrabold px-2 py-0.5 rounded-md shadow-xs text-xs sm:text-sm mx-0.5">
                              #{siblingAssignedToken} ({siblingName})
                            </span>
                          </p>
                          <p className="text-purple-700 font-semibold text-[11px] sm:text-xs mt-1">
                            👨‍👩‍👧‍👦 Both tokens are linked for one single family counselling meeting.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-medium text-slate-900">
                            Your{" "}
                            <span className="inline-block bg-[#800020] text-white font-extrabold px-2.5 py-0.5 rounded-md shadow-xs text-xs sm:text-sm mx-0.5">
                              Token #{assignedToken}
                            </span>{" "}
                            {cloudSyncSuccess
                              ? "is live at our Admissions Counsellor's desk."
                              : serverSyncSuccess
                                ? "is registered on the reception server."
                                : "has been generated on your device."}
                          </p>
                          <p className="text-slate-600 text-[11px] sm:text-xs mt-0.5">
                            If you are at school, please relax in our waiting area; you will be called shortly.
                          </p>
                          {!cloudSyncSuccess && (
                            <p className="text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5 text-[11px] font-bold mt-2">
                              ⚠️ Cloud Sync Quota Reached: Please show this Token #{assignedToken} screen directly at the Admissions Reception Desk if your name is not yet called.
                            </p>
                          )}
                        </div>
                      )}
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
                </>
              )}

              {/* Candidate Verification Summary Details */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-left text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">
                      {siblingAssignedToken ? "Child 1 Name" : "Student Name"}
                    </span>
                    <span className="font-extrabold text-[#800020] text-sm">{studentName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Class</span>
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

                {siblingAssignedToken && siblingName && (
                  <div className="pt-2 border-t border-amber-200 grid grid-cols-2 gap-2 bg-purple-50/80 -mx-3 -mb-3 p-3 rounded-b-xl border-purple-200">
                    <div>
                      <span className="text-[10px] text-purple-700 uppercase font-bold block">Child 2 (Sibling)</span>
                      <span className="font-extrabold text-purple-900 text-sm">{siblingName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-purple-700 uppercase font-bold block">Class</span>
                      <span className="font-bold text-purple-800">{siblingClass}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Register Another Student & Print Slip Buttons */}
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintSlip}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 border border-amber-500"
                >
                  <Printer size={16} />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="flex-[2] py-3 bg-gradient-to-r from-[#800020] via-[#991b1b] to-[#c2410c] hover:from-[#6b001a] hover:to-[#9a3412] text-white rounded-xl text-xs sm:text-sm font-black shadow-lg shadow-rose-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
            
            {/* Friendly Greeting Banner */}
            <div className="p-4 bg-gradient-to-r from-orange-950/60 to-amber-950/60 border border-orange-500/30 rounded-2xl text-xs text-orange-200 flex items-start gap-3">
              <HeartHandshake size={24} className="text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-black text-sm text-white">
                  Welcome Parents!
                </p>
                <p className="text-orange-200/90 leading-relaxed font-medium">
                  Please fill in your basic details below. Your response will automatically appear on our Admissions Counsellor's desk in real time.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              
              {/* Enquiry Mode Selector: Campus Walk-in vs Online Enquiry */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <span>Admission Enquiry Mode</span>
                    <span className="text-orange-500 font-black">*</span>
                  </label>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    enquiryType === "walkin" 
                      ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" 
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}>
                    {enquiryType === "walkin" ? "Campus Visit" : "Online Lead"}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option 1: Campus Walk-in */}
                  <button
                    type="button"
                    onClick={() => setEnquiryType("walkin")}
                    className={`p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 text-left cursor-pointer ${
                      enquiryType === "walkin"
                        ? "bg-gradient-to-br from-orange-600/25 via-amber-600/15 to-transparent border-orange-500 text-white shadow-lg ring-2 ring-orange-500/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      enquiryType === "walkin" ? "bg-orange-500 text-white shadow-md shadow-orange-500/30" : "bg-slate-800 text-slate-400"
                    }`}>
                      <Building2 size={19} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-white">Campus Walk-in</span>
                        {enquiryType === "walkin" && (
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-400 ring-4 ring-orange-400/20"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                        Currently visiting the school campus reception lounge
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-500/15 text-orange-300 text-[10px] font-bold border border-orange-500/30">
                          <span>🏛️</span>
                          <span>In-Person Lounge Token</span>
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Online Enquiry */}
                  <button
                    type="button"
                    onClick={() => setEnquiryType("online")}
                    className={`p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 text-left cursor-pointer ${
                      enquiryType === "online"
                        ? "bg-gradient-to-br from-emerald-600/25 via-teal-600/15 to-transparent border-emerald-500 text-white shadow-lg ring-2 ring-emerald-500/20"
                        : "bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300"
                    }`}
                  >
                    <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      enquiryType === "online" ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30" : "bg-slate-800 text-slate-400"
                    }`}>
                      <Globe size={19} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-white">Online Enquiry</span>
                        {enquiryType === "online" && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                        Applying remotely via Website, QR code, or Social Media
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                          <span>📱</span>
                          <span>Telephonic &amp; WhatsApp Follow-up</span>
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Student Name */}
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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

              {/* Gender for Child 1 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-200 tracking-wide">
                  Student Gender
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="gender"
                      value="Male"
                      checked={gender === "Male"}
                      onChange={() => setGender("Male")}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Boy (Male)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-300">
                    <input
                      type="radio"
                      name="gender"
                      value="Female"
                      checked={gender === "Female"}
                      onChange={() => setGender("Female")}
                      className="text-orange-600 focus:ring-orange-500"
                    />
                    <span>Girl (Female)</span>
                  </label>
                </div>
              </div>

              {/* SIBLING (2ND CHILD) OPTIONAL SECTION */}
              <div className="p-4 bg-purple-950/40 border border-purple-500/40 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👨‍👩‍👧‍👦</span>
                    <div>
                      <span className="text-xs font-black text-purple-200 block">
                        Applying for Two Children (Siblings)?
                      </span>
                      <span className="text-[10px] text-purple-300/80">
                        Register both together for one joint family meeting
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasSibling(!hasSibling)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      hasSibling
                        ? "bg-purple-600 text-white shadow-md"
                        : "bg-purple-900/60 text-purple-200 hover:bg-purple-800"
                    }`}
                  >
                    {hasSibling ? "✓ Sibling Added" : "+ Add Sibling"}
                  </button>
                </div>

                {hasSibling && (
                  <div className="pt-3 border-t border-purple-500/30 space-y-3 animate-in fade-in duration-200">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-black text-purple-200">
                        Sibling (2nd Child) Full Name <span className="text-orange-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={siblingName}
                        onChange={(e) => setSiblingName(e.target.value)}
                        placeholder="e.g. Baby Ananya / Master Rahul"
                        className="w-full px-3.5 py-2.5 bg-slate-950 border border-purple-800/80 rounded-xl text-xs text-white font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-purple-200">
                          Sibling Class <span className="text-orange-400">*</span>
                        </label>
                        <select
                          value={siblingClass}
                          onChange={(e) => setSiblingClass(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-purple-800/80 rounded-xl text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          {CLASS_OPTIONS.map((c) => (
                            <option key={`sib-${c}`} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[11px] font-black text-purple-200">
                          Sibling Date of Birth
                        </label>
                        <input
                          type="date"
                          value={siblingDob}
                          max={new Date().toISOString().split("T")[0]}
                          onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch {} }}
                          onChange={(e) => setSiblingDob(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-purple-800/80 rounded-xl text-xs text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 pt-1">
                      <span className="text-[11px] font-bold text-purple-300">Sibling Gender:</span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-purple-200">
                        <input
                          type="radio"
                          name="siblingGender"
                          value="Male"
                          checked={siblingGender === "Male"}
                          onChange={() => setSiblingGender("Male")}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Boy</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs text-purple-200">
                        <input
                          type="radio"
                          name="siblingGender"
                          value="Female"
                          checked={siblingGender === "Female"}
                          onChange={() => setSiblingGender("Female")}
                          className="text-purple-600 focus:ring-purple-500"
                        />
                        <span>Girl</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Contact Number - Strictly 10 Digits */}
              <div className="space-y-1.5">
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

              {/* Father's & Mother's Names - 2 Columns Side-by-Side */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-200 tracking-wide">
                    Father's Full Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fatherName}
                    onChange={(e) => {
                      setFatherName(e.target.value);
                      setParentNames(`${e.target.value} / ${motherName}`);
                    }}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-slate-200 tracking-wide">
                    Mother's Full Name <span className="text-orange-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={motherName}
                    onChange={(e) => {
                      setMotherName(e.target.value);
                      setParentNames(`${fatherName} / ${e.target.value}`);
                    }}
                    placeholder="e.g. Sunita Devi"
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-medium placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  />
                </div>
              </div>

              {/* Previous School */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-200 tracking-wide">
                  Previous School &amp; Board <span className="text-orange-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  placeholder="e.g. DPS School / St. Joseph CBSE"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              {/* Residential Address */}
              <div className="space-y-1.5">
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
              <div className="space-y-1.5 pt-1">
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

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl text-sm font-black shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                >
                  <span>{isSubmitting ? "Submitting..." : "Submit Enquiry Registration"}</span>
                  <ArrowRight size={18} />
                </button>
              </div>

            </form>
          </div>
        )}
      </main>

      {/* Ultra-Clean Footer */}
      <footer className="p-4 text-center text-[11px] text-slate-600 font-medium border-t border-slate-900">
        Birla Open Minds International School • Reception Desk
      </footer>
    </div>
  );
}
