import React, { useState, useEffect, useRef } from "react";
import {
  Languages,
  Sparkles,
  Volume2,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Save,
  RefreshCw,
  X,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  HelpCircle,
  Lightbulb,
  Bus,
  CreditCard,
  BookOpen
} from "lucide-react";
import { formatAudioDuration } from "../utils/audioStorage";

export interface TranslatedTurn {
  timestamp: string;
  speaker: "Counsellor" | "Parent" | string;
  originalText: string;
  englishTranslation: string;
}

export interface AudioTranslationSummary {
  feeDetails?: string;
  transportDetails?: string;
  curriculumDetails?: string;
  parentConcerns?: string[];
  counsellorTrainingTips?: string[];
  executiveSummary?: string;
}

export interface AudioTranslationData {
  detectedLanguage?: string;
  dialogueTurns?: TranslatedTurn[];
  summary?: AudioTranslationSummary;
  fullEnglishTranscript?: string;
  translatedAudioData?: string;
  translatedAudioMimeType?: string;
  translatedAt?: string;
}

interface AudioTranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioBase64?: string;
  audioUrl?: string;
  audioStorageKey?: string;
  mimeType?: string;
  liveSpeechText?: string;
  studentName?: string;
  applyingForClass?: string;
  counsellorName?: string;
  parentLanguage?: string;
  enquiryNo?: string;
  existingTranslation?: AudioTranslationData;
  onSaveTranslation?: (translationData: AudioTranslationData) => void;
  onSaveToRemarks?: (notesText: string) => void;
}

export default function AudioTranslationModal({
  isOpen,
  onClose,
  audioBase64,
  audioUrl,
  audioStorageKey,
  mimeType = "audio/webm",
  liveSpeechText = "",
  studentName = "Candidate",
  applyingForClass = "Standard",
  counsellorName = "Admissions Counsellor",
  parentLanguage = "English (Regional Context)",
  enquiryNo,
  existingTranslation,
  onSaveTranslation,
  onSaveToRemarks
}: AudioTranslationModalProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"side_by_side" | "turns" | "english_only">("side_by_side");
  const [activeVoice, setActiveVoice] = useState<string>("Kore");
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Translation result state
  const [translation, setTranslation] = useState<AudioTranslationData | null>(() => existingTranslation || null);
  const [translatedAudioUrl, setTranslatedAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize from existing translation if provided
  useEffect(() => {
    if (existingTranslation && existingTranslation.dialogueTurns && existingTranslation.dialogueTurns.length > 0) {
      setTranslation(existingTranslation);
      if (existingTranslation.translatedAudioData) {
        setTranslatedAudioUrl(`data:${existingTranslation.translatedAudioMimeType || "audio/wav"};base64,${existingTranslation.translatedAudioData}`);
      }
    } else if (isOpen && !translation) {
      handleTranslate();
    }
  }, [isOpen, existingTranslation]);

  // Handle translation API call
  const handleTranslate = async () => {
    setIsTranslating(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/counselling/translate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64,
          mimeType,
          liveSpeechText,
          studentName,
          counsellorName,
          applyingForClass,
          parentLanguage
        })
      });
      const data = await res.json();
      if (data.success && data.translation) {
        const enriched: AudioTranslationData = {
          ...data.translation,
          translatedAt: new Date().toISOString()
        };
        setTranslation(enriched);

        // Automatically synthesize translated voice in background
        handleGenerateVoice(enriched);
      } else {
        setErrorMsg(data.error || "Failed to process translation.");
      }
    } catch (err: any) {
      console.error("Translation request failed:", err);
      setErrorMsg(err?.message || "Network error while translating audio.");
    } finally {
      setIsTranslating(false);
    }
  };

  // Synthesize English voice for the translated script
  const handleGenerateVoice = async (dataToVoice = translation) => {
    if (!dataToVoice) return;
    setIsGeneratingVoice(true);
    try {
      const turns = dataToVoice.dialogueTurns || [];
      const res = await fetch("/api/counselling/tts-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: dataToVoice.fullEnglishTranscript,
          dialogueTurns: turns,
          voiceName: activeVoice
        })
      });
      const resData = await res.json();
      if (resData.success) {
        if (resData.audioBase64) {
          const url = `data:${resData.mimeType || "audio/wav"};base64,${resData.audioBase64}`;
          setTranslatedAudioUrl(url);
          setTranslation(prev => prev ? {
            ...prev,
            translatedAudioData: resData.audioBase64,
            translatedAudioMimeType: resData.mimeType || "audio/wav"
          } : null);
        } else if (resData.useClientWebSpeech && typeof window !== "undefined" && "speechSynthesis" in window) {
          // Client Web Speech fallback
          console.log("Ready for client Web Speech synthesis fallback.");
        }
      }
    } catch (err) {
      console.warn("TTS generation notice:", err);
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  // Voice playback toggling
  const togglePlayVoice = () => {
    if (translatedAudioUrl && audioRef.current) {
      if (isPlayingVoice) {
        audioRef.current.pause();
        setIsPlayingVoice(false);
      } else {
        audioRef.current.playbackRate = playbackSpeed;
        audioRef.current.play()
          .then(() => setIsPlayingVoice(true))
          .catch((e) => console.warn("Voice playback error:", e));
      }
    } else if (translation?.fullEnglishTranscript && typeof window !== "undefined" && "speechSynthesis" in window) {
      // Web Speech fallback playback
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        setIsPlayingVoice(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(translation.fullEnglishTranscript);
        utterance.rate = playbackSpeed;
        utterance.onend = () => setIsPlayingVoice(false);
        utterance.onerror = () => setIsPlayingVoice(false);
        window.speechSynthesis.speak(utterance);
        setIsPlayingVoice(true);
      }
    }
  };

  const handleSpeedChange = (spd: number) => {
    setPlaybackSpeed(spd);
    if (audioRef.current) {
      audioRef.current.playbackRate = spd;
    }
  };

  // Format full translated text for copying / export
  const getFormattedReport = (): string => {
    if (!translation) return "";
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const turns = translation.dialogueTurns || [];
    const sum = translation.summary;

    return `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
TRILINGUAL ADMISSIONS AUDIO TRANSLATION & DIALOGUE REPORT
================================================================================
Date & Time           : ${dateStr}
Enquiry Reference No  : ${enquiryNo || "ENQ-RECORD"}
Student Full Name     : ${studentName}
Applying For Class    : ${applyingForClass}
Admissions Counsellor : ${counsellorName}
Detected Languages    : ${translation.detectedLanguage || parentLanguage}
AI Translation Engine : Gemini Multilingual Diarization & Speech Engine
================================================================================

[1. VERBATIM SPOKEN TURNS & FLUENT ENGLISH TRANSLATION]
--------------------------------------------------------------------------------
${turns.map((t, idx) => `[${t.timestamp}] Turn #${idx + 1} • ${t.speaker.toUpperCase()}
• Spoken (Original) : "${t.originalText}"
• English (Translated): "${t.englishTranslation}"
`).join("\n")}

--------------------------------------------------------------------------------
[2. EXECUTIVE MEETING SUMMARY]
--------------------------------------------------------------------------------
${sum?.executiveSummary || "Parent and counsellor discussed admission criteria, facilities, and academic framework."}

--------------------------------------------------------------------------------
[3. KEY POINTS DISCUSSED BY CATEGORY]
--------------------------------------------------------------------------------
• Fee Structure & Concessions:
  ${sum?.feeDetails || "Tuition fee structure, installment terms, and payment options explained."}

• Transport & Bus Connectivity:
  ${sum?.transportDetails || "Bus routes, pickup/drop timings, and student safety protocols covered."}

• Academic Curriculum & School Facilities:
  ${sum?.curriculumDetails || "Curriculum, classroom activities, sports, and laboratory infrastructure reviewed."}

• Parent Doubts & Specific Inquiries:
${sum?.parentConcerns && sum.parentConcerns.length > 0 ? sum.parentConcerns.map(c => `  - ${c}`).join("\n") : "  - Clarifications on fee schedule and bus transport route."}

--------------------------------------------------------------------------------
[4. COUNSELLOR COACHING & TRAINING TIPS FOR NEXT COUNSELLING]
--------------------------------------------------------------------------------
${sum?.counsellorTrainingTips && sum.counsellorTrainingTips.length > 0 ? sum.counsellorTrainingTips.map(t => `• ${t}`).join("\n") : "• Maintain proactive communication on fee installment deadlines."}

================================================================================
CONFIDENTIAL - ADMISSIONS MANAGEMENT AUDIT & DOSSIER ARCHIVE
================================================================================`;
  };

  // Copy report
  const handleCopy = () => {
    const reportText = getFormattedReport();
    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download report as .txt
  const handleDownloadReport = () => {
    const reportText = getFormattedReport();
    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${enquiryNo || "Enquiry"}_English_Translation_Report.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Download translated audio WAV
  const handleDownloadAudio = () => {
    if (!translatedAudioUrl) return;
    const link = document.createElement("a");
    link.href = translatedAudioUrl;
    link.download = `${enquiryNo || "Enquiry"}_Translated_English_Audio.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Save to enquiry office remarks
  const handleSaveToRemarks = () => {
    if (!translation || !onSaveToRemarks) return;
    const sum = translation.summary;
    const notes = `[TRANSLATED CONVERSATION & KEY POINTS SUMMARY - ${new Date().toLocaleDateString("en-IN")}]
• Executive Summary: ${sum?.executiveSummary || "Parent meeting completed in regional language and translated into English."}
• Fee Structure: ${sum?.feeDetails || "Discussed with parent."}
• Transport: ${sum?.transportDetails || "Routes explained."}
• Parent Inquiries: ${sum?.parentConcerns ? sum.parentConcerns.join("; ") : "Fee and transport schedule."}
• Counsellor Training Advice: ${sum?.counsellorTrainingTips ? sum.counsellorTrainingTips.join("; ") : "Continue proactive guidance."}`;

    onSaveToRemarks(notes);
    if (onSaveTranslation) {
      onSaveTranslation(translation);
    }
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  // Save translation to record
  const handleSaveRecord = () => {
    if (!translation || !onSaveTranslation) return;
    onSaveTranslation(translation);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  if (!isOpen) return null;

  const turns = translation?.dialogueTurns || [];
  const summary = translation?.summary;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center shadow-inner">
              <Languages size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>Trilingual Audio Translation &amp; Voice Studio</span>
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                  Multilingual • Regional Dialects • English
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 font-medium">
                {enquiryNo ? `${enquiryNo} • ` : ""}{studentName} (Class: {applyingForClass}) • Counsellor: {counsellorName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={isTranslating}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm"
              title="Re-run translation with Gemini"
            >
              <RefreshCw size={13} className={isTranslating ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isTranslating ? "Translating..." : "Re-Translate"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* VOICE-TO-VOICE PLAYBACK CONTROLS STRIP */}
        <div className="p-3 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayVoice}
              disabled={isTranslating}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black transition-all shadow flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isPlayingVoice ? <Pause size={15} /> : <Play size={15} className="fill-current ml-0.5" />}
              <span>{isPlayingVoice ? "Pause English Voice" : "Play Translated English Voice"}</span>
            </button>

            {isGeneratingVoice && (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 animate-pulse">
                <Sparkles size={13} />
                <span>Synthesizing Voice...</span>
              </span>
            )}

            {/* Audio element for base64 playback */}
            {translatedAudioUrl && (
              <audio
                ref={audioRef}
                src={translatedAudioUrl}
                onPlay={() => setIsPlayingVoice(true)}
                onPause={() => setIsPlayingVoice(false)}
                onEnded={() => setIsPlayingVoice(false)}
                className="hidden"
              />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Speed Selector */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-[10px] font-bold">
              <span className="text-slate-400 px-1.5 uppercase font-mono">Speed:</span>
              {[1, 1.25, 1.5].map((spd) => (
                <button
                  type="button"
                  key={spd}
                  onClick={() => handleSpeedChange(spd)}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    playbackSpeed === spd
                      ? "bg-indigo-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setViewMode("side_by_side")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "side_by_side" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Bilingual Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode("turns")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "turns" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Speaker Turns
              </button>
              <button
                type="button"
                onClick={() => setViewMode("english_only")}
                className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === "english_only" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 dark:text-slate-300"
                }`}
              >
                Pure English
              </button>
            </div>

            {translatedAudioUrl && (
              <button
                type="button"
                onClick={handleDownloadAudio}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-all"
                title="Download synthesized English voice audio (.wav)"
              >
                <Download size={14} />
              </button>
            )}
          </div>
        </div>

        {/* FEEDBACK BANNERS */}
        {savedSuccess && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-300 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>✓ English translation and summary saved to enquiry dossier successfully!</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-300 text-red-800 dark:text-red-300 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={15} className="text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SCROLLABLE MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
          {/* LOADING STATE */}
          {isTranslating && (
            <div className="p-12 text-center space-y-4">
              <div className="w-14 h-14 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto"></div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-800 dark:text-slate-200">
                  Translating Trilingual Admissions Audio...
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Understanding spoken multilingual dialogue • Identifying Counsellor vs. Parent • Generating fluent English verbatim script &amp; summary
                </p>
              </div>
            </div>
          )}

          {!isTranslating && translation && (
            <>
              {/* EXECUTIVE SUMMARY & KEY POINTS METRIC STRIP */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-indigo-700 dark:text-indigo-400">
                    <CreditCard size={14} />
                    <span>Fee &amp; Payment Discussion</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {summary?.feeDetails || "Standard tuition fee, term installments, and payment schedules reviewed."}
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 dark:text-emerald-400">
                    <Bus size={14} />
                    <span>Transport &amp; Bus Routes</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {summary?.transportDetails || "Bus routes, pickup/drop timings, and vehicle tracking covered."}
                  </p>
                </div>

                <div className="p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black text-purple-700 dark:text-purple-400">
                    <BookOpen size={14} />
                    <span>Curriculum &amp; Facilities</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {summary?.curriculumDetails || "Academic curriculum, sports facilities, and laboratories reviewed."}
                  </p>
                </div>
              </div>

              {/* PARENT QUESTIONS & COUNSELLOR TRAINING COACHING */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200">
                    <HelpCircle size={15} className="text-amber-600" />
                    <span>Parent Questions Audited from Recording</span>
                  </div>
                  <ul className="text-xs text-amber-950 dark:text-amber-100 space-y-1.5 list-disc pl-4 leading-relaxed">
                    {summary?.parentConcerns && summary.parentConcerns.length > 0 ? (
                      summary.parentConcerns.map((c, i) => <li key={i}>{c}</li>)
                    ) : (
                      <li>Inquired about fee structure, installment options, and bus connectivity.</li>
                    )}
                  </ul>
                </div>

                <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-900 dark:text-indigo-200">
                    <Lightbulb size={15} className="text-indigo-600" />
                    <span>Counsellor Coaching Tips (For Next Parent Session)</span>
                  </div>
                  <ul className="text-xs text-indigo-950 dark:text-indigo-100 space-y-1.5 list-disc pl-4 leading-relaxed">
                    {summary?.counsellorTrainingTips && summary.counsellorTrainingTips.length > 0 ? (
                      summary.counsellorTrainingTips.map((tip, i) => <li key={i}>{tip}</li>)
                    ) : (
                      <li>Proactively present fee installment timeline early to give parents financial clarity.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* MAIN TRANSCRIPT & TRANSLATION SECTION */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-indigo-600 dark:text-indigo-400" />
                    <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-100 tracking-wider">
                      {viewMode === "side_by_side" ? "Bilingual Conversation (Original vs. Translated)" : viewMode === "turns" ? "Speaker-Diarized Turns" : "Pure English Transcript"}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({turns.length} turns)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copied ? "Copied!" : "Copy All"}</span>
                    </button>
                  </div>
                </div>

                {/* VIEW MODE 1: BILINGUAL SIDE-BY-SIDE */}
                {viewMode === "side_by_side" && (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                    {turns.map((turn, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-850/50 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-md font-black flex items-center gap-1 text-[10px] ${
                              turn.speaker.toLowerCase().includes("counsellor")
                                ? "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                                : "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                            }`}
                          >
                            {turn.speaker.toLowerCase().includes("counsellor") ? <User size={11} /> : <Users size={11} />}
                            <span>{turn.speaker}</span>
                          </span>
                          <span className="font-mono text-slate-400 text-[10px]">
                            {turn.timestamp}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Original Text */}
                          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400">
                              Spoken Dialogue (Multilingual)
                            </span>
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                              &ldquo;{turn.originalText}&rdquo;
                            </p>
                          </div>

                          {/* Translated English */}
                          <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800/40 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">
                              Translated English
                            </span>
                            <p className="text-xs text-slate-900 dark:text-slate-100 leading-relaxed font-medium">
                              &ldquo;{turn.englishTranslation}&rdquo;
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* VIEW MODE 2: SPEAKER TURNS */}
                {viewMode === "turns" && (
                  <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                    {turns.map((turn, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-2xl border flex items-start gap-3 ${
                          turn.speaker.toLowerCase().includes("counsellor")
                            ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40"
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                            turn.speaker.toLowerCase().includes("counsellor") ? "bg-indigo-600" : "bg-purple-600"
                          }`}
                        >
                          {turn.speaker.toLowerCase().includes("counsellor") ? <User size={14} /> : <Users size={14} />}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {turn.speaker}
                            </span>
                            <span className="font-mono text-slate-400 text-[10px]">
                              {turn.timestamp}
                            </span>
                          </div>
                          <p className="text-xs text-slate-900 dark:text-slate-100 leading-relaxed">
                            {turn.englishTranslation}
                          </p>
                          <p className="text-[11px] text-slate-400 italic">
                            Original: &ldquo;{turn.originalText}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* VIEW MODE 3: PURE ENGLISH TRANSCRIPT */}
                {viewMode === "english_only" && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 max-h-96 overflow-y-auto custom-scrollbar font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-2">
                    {turns.map((turn, idx) => (
                      <div key={idx}>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">[{turn.timestamp}] {turn.speaker}: </span>
                        <span>{turn.englishTranslation}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadReport}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            >
              <Download size={14} />
              <span>Download Report (.txt)</span>
            </button>

            {translatedAudioUrl && (
              <button
                type="button"
                onClick={handleDownloadAudio}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
              >
                <Download size={14} />
                <span>Download Voice (.wav)</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>

            {onSaveToRemarks && (
              <button
                type="button"
                onClick={handleSaveToRemarks}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Save size={14} />
                <span>Auto-Save to Remarks &amp; PDF</span>
              </button>
            )}

            {onSaveTranslation && (
              <button
                type="button"
                onClick={handleSaveRecord}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check size={14} />
                <span>Save to Audio Vault</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
