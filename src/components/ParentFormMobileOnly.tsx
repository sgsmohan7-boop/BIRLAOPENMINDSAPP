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

  // Form fields
  const [studentName, setStudentName] = useState("");
  const [applyingForClass, setApplyingForClass] = useState("Grade 1");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [whatsappNo, setWhatsappNo] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [heardAboutSchool, setHeardAboutSchool] = useState<string[]>(["Google / Online Search"]);
  const [reasonForChoosing, setReasonForChoosing] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      alert("Please enter the student's full name.");
      return;
    }
    if (!contactNo.trim() || contactNo.trim().length < 10) {
      alert("Please enter a valid 10-digit mobile contact number.");
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const dmy = now.toLocaleDateString("en-GB").replace(/\//g, "-");
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = `PSE-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newEntry: ParentSelfEntry = {
      id,
      studentName: studentName.trim(),
      applyingForClass,
      fatherName: fatherName.trim(),
      motherName: motherName.trim(),
      contactNo: contactNo.trim(),
      whatsappNo: whatsappNo.trim() || contactNo.trim(),
      previousSchool: previousSchool.trim(),
      heardAboutSchool,
      reasonForChoosing: reasonForChoosing.trim(),
      submittedAt: now.toISOString(),
      formattedDate: `${dmy} ${timeStr}`,
      status: "pending"
    };

    try {
      // 1. Send to server endpoint
      await fetch("/api/parent-self-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry)
      });
    } catch (err) {
      console.warn("Server parent entry post error:", err);
    }

    try {
      // 2. Save locally for instantaneous offline updates
      const existingRaw = localStorage.getItem("parent_self_entries");
      const existing: ParentSelfEntry[] = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newEntry, ...existing];
      localStorage.setItem("parent_self_entries", JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("parent_self_entry_added", { detail: newEntry }));
    } catch (err) {
      console.warn("Local storage save error:", err);
    }

    if (onSubmitSuccess) {
      onSubmitSuccess(newEntry);
    }

    setIsSubmittedSuccess(true);
    setIsSubmitting(false);
  };

  const handleResetForm = () => {
    setStudentName("");
    setApplyingForClass("Grade 1");
    setFatherName("");
    setMotherName("");
    setContactNo("");
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
          <div className="p-6 sm:p-8 text-center space-y-6 bg-slate-900 border-2 border-emerald-500 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 my-4">
            <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-3">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-widest border border-emerald-500/30">
                Registration Confirmed
              </span>
              <h2 className="text-2xl font-black text-white">
                Thank You! 🎉
              </h2>
              <p className="text-sm font-semibold text-slate-300 leading-relaxed max-w-md mx-auto">
                Enquiry details for <strong className="text-amber-400 font-extrabold">{studentName}</strong> (Class {applyingForClass}) have been sent directly to our Admissions Counter.
              </p>
              
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 space-y-1.5 text-left">
                <p className="font-extrabold text-amber-400 flex items-center gap-1.5">
                  <span>📍 Next Step:</span>
                </p>
                <p className="text-slate-400 leading-relaxed font-medium">
                  Please take a seat in our reception waiting lounge. Our Admissions Counsellor will call your name shortly.
                </p>
              </div>
            </div>

            <div className="pt-2">
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

              {/* Contact Mobile */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-200 tracking-wide">
                  Mobile Contact Number <span className="text-orange-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                />
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
