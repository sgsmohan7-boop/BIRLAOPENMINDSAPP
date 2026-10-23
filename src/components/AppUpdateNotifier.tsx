import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  Zap, 
  Smartphone, 
  Layers, 
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface VersionInfo {
  version: string;
  buildTimestamp: number;
  releaseDate: string;
  releaseNotes: string[];
}

export default function AppUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [serverVersion, setServerVersion] = useState<VersionInfo | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Check version against current client version
  const CLIENT_VERSION = "2.4.0";
  const CLIENT_BUILD = 1776413500000;

  useEffect(() => {
    // 1. Service Worker Update Listener
    const handleSwUpdate = () => {
      console.log("[UpdateNotifier] Service Worker detected a newer build!");
      setUpdateAvailable(true);
    };

    window.addEventListener("app-new-version-available", handleSwUpdate);

    // 2. Heartbeat check to /api/app-version
    const checkServerVersion = async () => {
      try {
        const res = await fetch("/api/app-version?t=" + Date.now());
        if (res.ok) {
          const data: VersionInfo = await res.json();
          setServerVersion(data);

          const storedBuild = parseInt(localStorage.getItem("santinostech_installed_build") || "0", 10);
          const currentLocalBuild = storedBuild || CLIENT_BUILD;

          if (data.buildTimestamp > currentLocalBuild) {
            setUpdateAvailable(true);
          }
        }
      } catch (err) {
        // offline or quiet fail
      }
    };

    checkServerVersion();
    const interval = setInterval(checkServerVersion, 2 * 60 * 1000); // Check every 2 minutes

    return () => {
      window.removeEventListener("app-new-version-available", handleSwUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    try {
      // 1. Tell Service Worker to activate immediately
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      }

      // 2. Clear old static cache storage to guarantee fresh files
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }

      // 3. Save new build timestamp to localStorage
      if (serverVersion?.buildTimestamp) {
        localStorage.setItem("santinostech_installed_build", serverVersion.buildTimestamp.toString());
        localStorage.setItem("santinostech_last_version", serverVersion.version);
      } else {
        localStorage.setItem("santinostech_installed_build", Date.now().toString());
      }

      // 4. Reload page cleanly
      setTimeout(() => {
        window.location.reload();
      }, 400);
    } catch (e) {
      window.location.reload();
    }
  };

  if (!updateAvailable || dismissed) return null;

  return (
    <>
      {/* Floating Bottom Toast Notification Banner */}
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[9999] animate-bounce-in shadow-2xl">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-2 border-indigo-500/70 text-white p-4 rounded-2xl shadow-indigo-500/20 shadow-2xl flex flex-col gap-3">
          
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-slate-950 font-black shadow-md shrink-0 animate-pulse">
                <Sparkles size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black tracking-wide text-white uppercase">
                    🚀 New Update Available!
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/30 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-400/30">
                    v{serverVersion?.version || "2.4.0"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  కొత్త ఫీచర్స్ సిద్ధంగా ఉన్నాయి. తక్షణమే అప్‌డేట్ చేసుకోండి.
                </p>
              </div>
            </div>

            <button
              onClick={() => setDismissed(true)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Later"
            >
              <X size={15} />
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleApplyUpdate}
              disabled={isUpdating}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className={isUpdating ? "animate-spin" : ""} />
              <span>{isUpdating ? "Updating App..." : "Update Now (1-Click)"}</span>
            </button>

            <button
              onClick={() => setShowDetailsModal(true)}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700"
            >
              What's New?
            </button>
          </div>
        </div>
      </div>

      {/* Full What's New & Update Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in text-slate-100">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-amber-400">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    System Update v{serverVersion?.version || "2.4.0"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Birla Open Minds International School Portal
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 text-xs text-slate-300 overflow-y-auto max-h-[60vh] custom-scrollbar">
              
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-200">
                <p className="font-bold text-emerald-300 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>ఆటోమేటిక్ అప్‌డేట్ విధానం (Seamless Update):</span>
                </p>
                <p className="leading-relaxed">
                  ఈ అప్‌డేట్ కోసం మీరు Play Store నుంచి మళ్లీ డౌన్‌లోడ్ చేయాల్సిన పనిలేదు. మీ డేటా లేదా లాగిన్ సెషన్ ఏదీ కోల్పోరు. క్రింది బటన్ నొక్కగానే కేవలం 1 సెకనులో కొత్త ఫీచర్లు లోడ్ అవుతాయి.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-bold text-white text-xs uppercase tracking-wider text-indigo-400">
                  ✨ What&apos;s New in this Release:
                </p>
                <div className="space-y-2">
                  {(serverVersion?.releaseNotes || [
                    "Continuous Speech-to-Text Diarization (1hr 50min Free Audio)",
                    "Android & Desktop App Deployment Center (PWA, APK, EXE)",
                    "Clean Path Short URLs (/counselling, /admin, /management)",
                    "Custom Domain Auto-Detection (birlaopenmindscounselling.com)",
                    "Real-Time In-App Live Auto Update System"
                  ]).map((note, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                      <span className="w-5 h-5 rounded-full bg-indigo-600/60 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-slate-200 font-medium leading-normal">{note}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Remind Me Later
              </button>

              <button
                onClick={handleApplyUpdate}
                disabled={isUpdating}
                className="px-6 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={isUpdating ? "animate-spin" : ""} />
                <span>{isUpdating ? "Applying Update..." : "Apply & Reload Now"}</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
