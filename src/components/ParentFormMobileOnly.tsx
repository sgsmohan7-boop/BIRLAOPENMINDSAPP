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
  Printer
} from "lucide-react";
import { ParentSelfEntry } from "../types";
import { isFirebaseConfigured, saveDocument } from "../utils/firebase";

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
  const [isSubmittedSuccess, setIsSubmittedSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedToken, setAssignedToken] = useState<number>(1);

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

    let finalEntry: ParentSelfEntry = {
      id,
      studentName: studentName.trim(),
      dateOfBirth: dateOfBirth.trim(),
      applyingForClass,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      contactNo: cleanPhone,
      whatsappNo: (whatsappNo.trim() || cleanPhone).replace(/\D/g, "").slice(0, 10),
      previousSchool: previousSchool.trim(),
      residentialAddress: residentialAddress.trim(),
      heardAboutSchool,
      reasonForChoosing: reasonForChoosing.trim(),
      submittedAt: now.toISOString(),
      formattedDate: `${dmy} ${timeStr}`,
      status: "pending",
      entryDate: dmy,
      dateKey
    };

    // 1. Post to Server to get official server-authoritative token sequence number
    try {
      const res = await fetch("/api/parent-self-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalEntry)
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.entry && json.entry.dailyTokenNo) {
          finalEntry.dailyTokenNo = json.entry.dailyTokenNo;
        }
      }
    } catch (err) {
      console.warn("Server parent entry post error:", err);
    }

    if (!finalEntry.dailyTokenNo) {
      let todayCount = 0;
      try {
        const existingRaw = localStorage.getItem("parent_self_entries");
        const existingList: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
        todayCount = existingList.filter(e => {
          const itemDate = e.entryDate || (e.formattedDate ? e.formattedDate.split(" ")[0] : "");
          return itemDate === dmy || e.dateKey === dateKey;
        }).length;
      } catch {}
      finalEntry.dailyTokenNo = todayCount + 1;
    }

    setAssignedToken(finalEntry.dailyTokenNo);

    // 2. Direct real-time Firebase Firestore save so counsellor sees it within 100ms on desktop!
    try {
      if (isFirebaseConfigured()) {
        await saveDocument("parent_self_entries", id, finalEntry);
      }
    } catch (fErr) {
      console.warn("Firestore parent entry save warning:", fErr);
    }

    // 3. Save locally for instantaneous offline updates
    try {
      const existingRaw = localStorage.getItem("parent_self_entries");
      const existing: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [finalEntry, ...existing];
      localStorage.setItem("parent_self_entries", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("parent_self_entry_added", { detail: finalEntry }));
    } catch (err) {
      console.warn("Local storage save error:", err);
    }

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
    setFatherName("");
    setMotherName("");
    setContactNo("");
    setPhoneError("");
    setWhatsappNo("");
    setPreviousSchool("");
    setResidentialAddress("");
    setReasonForChoosing("");
    setIsSubmittedSuccess(false);
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
                  Your admission form has been submitted successfully!
                </p>
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
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
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

              {/* 1. Student Date of Birth (DOB) - Right below Student Name */}
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
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all [color-scheme:dark]"
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

              {/* Father Name */}
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-200 tracking-wide">
                  Previous School &amp; Board
                </label>
                <input
                  type="text"
                  value={previousSchool}
                  onChange={(e) => setPreviousSchool(e.target.value)}
                  placeholder="e.g. DPS School / St. Joseph CBSE"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              {/* Residential Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-200 tracking-wide">
                  Residential Address (Area / Locality)
                </label>
                <input
                  type="text"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  placeholder="e.g. Plot 45, Green Hills Colony, LB Nagar"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
              </div>

              {/* How Heard */}
              <div className="space-y-2 pt-1">
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          isChecked
                            ? "bg-orange-600 border-orange-500 text-white shadow-md"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {isChecked ? "✓ " : "+ "}{src}
                      </button>
                    );
                  })}
                </div>
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
