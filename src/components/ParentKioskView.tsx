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
  const [applyingForClass, setApplyingForClass] = useState("Grade 1");
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [contactNo, setContactNo] = useState("");
  const [whatsappNo, setWhatsappNo] = useState("");
  const [previousSchool, setPreviousSchool] = useState("");
  const [heardAboutSchool, setHeardAboutSchool] = useState<string[]>(["Google/Online"]);
  const [reasonForChoosing, setReasonForChoosing] = useState("");

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
      // 1. Post to 24/7 server endpoint
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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetQrUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
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
            <div className="p-6 sm:p-10 text-center space-y-6 bg-slate-900 border-2 border-emerald-500 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 my-4">
              <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/30 animate-bounce">
                <CheckCircle2 size={44} />
              </div>

              <div className="space-y-3">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-widest border border-emerald-500/30">
                  Enquiry Registered Live
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Registration Received! 🎉
                </h2>
                <p className="text-sm font-semibold text-slate-300 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong className="text-amber-400 font-extrabold">{fatherName || motherName || "Parent"}</strong>! Your enquiry for <strong className="text-orange-400 font-extrabold">{studentName}</strong> (Class {applyingForClass}) has been received at the Admissions Desk.
                </p>
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl max-w-md mx-auto text-xs text-slate-400 space-y-1">
                  <p className="font-bold text-slate-200">📍 What's Next?</p>
                  <p>Please take a seat in our reception waiting lounge. Our Admissions Counsellor will call your name shortly.</p>
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

                  {/* Parent Mobile Contact */}
                  <div className="space-y-1">
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
                    onClick={() => window.print()}
                    className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all"
                  >
                    <Printer size={15} />
                    <span>Print A4 Poster</span>
                  </button>
                </div>
              </div>

              {/* Target Domain Input Override */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>🌐 QR Target Public URL:</span>
                  <span className="text-orange-400 font-mono text-[10px]">{targetQrUrl}</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customQrDomain}
                    onChange={(e) => setCustomQrDomain(e.target.value)}
                    placeholder="e.g. https://ais-pre-hdxvdxvb3o37jyrarxjlig-623128014596.asia-southeast1.run.app"
                    className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                  />
                  {customQrDomain && (
                    <button
                      type="button"
                      onClick={() => setCustomQrDomain("")}
                      className="px-2.5 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
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
