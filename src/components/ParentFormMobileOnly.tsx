import React, { useState } from "react";
import { 
  School, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  HeartHandshake, 
  Smartphone,
  Phone,
  User,
  GraduationCap,
  Building2
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
    setReasonForChoosing("");
    setIsSubmittedSuccess(false);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-orange-600 selection:text-white">
      
      {/* Clean Distraction-Free Header */}
      <header className="bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 text-white p-5 shadow-xl sticky top-0 z-40 border-b border-orange-400/30">
        <div className="max-w-xl mx-auto flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0 font-bold border border-white/30 shadow-md">
            <School size={26} />
          </div>
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-white/25 text-amber-100 text-[10px] font-black uppercase tracking-wider">
              Admission Enquiry Form
            </span>
            <h1 className="text-lg font-black tracking-tight leading-tight mt-0.5">
              BIRLA OPEN MINDS
            </h1>
            <p className="text-[11px] text-amber-100 font-bold tracking-widest uppercase">
              International School
            </p>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {isSubmittedSuccess ? (
          <div className="p-6 sm:p-8 text-center space-y-6 bg-slate-900 border-2 border-amber-500/80 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 my-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-orange-500/30 animate-bounce border-2 border-amber-300">
              <CheckCircle2 size={44} />
            </div>

            {/* High Impact Token Slip Pass Card */}
            <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-400 p-5 rounded-2xl shadow-xl text-center space-y-3 relative overflow-hidden">
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
              <div className="py-3 px-4 bg-slate-900 border-2 border-dashed border-amber-400/80 rounded-xl inline-block w-full max-w-xs shadow-inner">
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

            <div className="pt-1">
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white rounded-2xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <Sparkles size={16} />
                <span>Register Another Student</span>
              </button>
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

              {/* 2. Mobile Contact Number - Strictly 10 Digits */}
              <div className="space-y-1.5">
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
