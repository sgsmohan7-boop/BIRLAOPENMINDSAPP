import React, { useState } from 'react';
import { 
  X, 
  Smartphone, 
  Laptop, 
  Apple, 
  Download, 
  QrCode, 
  ExternalLink, 
  Copy, 
  Check, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  Terminal, 
  Layers,
  ArrowRight,
  Share2
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface AppInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AppInstallModal({ isOpen, onClose }: AppInstallModalProps) {
  const { isInstallable, isInstalled, install, isAndroid, isIOS, isDesktop } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'android' | 'desktop' | 'ios' | 'apk' | 'electron'>('android');
  const [copied, setCopied] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  if (!isOpen) return null;

  const SHARED_APP_URL = "https://ais-pre-hdxvdxvb3o37jyrarxjlig-623128014596.asia-southeast1.run.app";

  const targetPublicUrl = (() => {
    if (typeof window === 'undefined') return SHARED_APP_URL;
    const currentHref = window.location.href;
    const searchParams = new URLSearchParams(window.location.search);
    const portal = searchParams.get('portal');
    
    // If running in internal dev environment, local host or AI Studio preview frame, resolve to public shared URL
    if (currentHref.includes('localhost') || currentHref.includes('127.0.0.1') || currentHref.includes('ais-dev-') || currentHref.includes('aistudio.google.com')) {
      return portal ? `${SHARED_APP_URL}?portal=${portal}` : SHARED_APP_URL;
    }
    return currentHref;
  })();

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(targetPublicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleTriggerInstall = async () => {
    const outcome = await install();
    if (outcome === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => {
        setInstallSuccess(false);
        onClose();
      }, 2000);
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetPublicUrl)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div 
        className="w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-orange-500 p-0.5 shadow-md shrink-0">
              <img 
                src="/it_pwa_icon.png" 
                alt="App Icon" 
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                  Android & Desktop App Deployment Center
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-500/30">
                  PWA + APK + EXE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Install on Android Phone, Windows / Mac PC, or export APK & Desktop installer.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Install Banner (If install prompt is available or browser supports 1-click) */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-950/50 to-teal-950/50 border-b border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300">
                {isInstalled 
                  ? "✓ App is already installed in Standalone Mode on this device!"
                  : "Instant 1-Click Install Ready for this Device"}
              </p>
              <p className="text-[11px] text-emerald-400/80">
                Zero Play Store fees, works offline, native mobile notifications & home screen icon.
              </p>
            </div>
          </div>

          {!isInstalled && (
            <button
              onClick={handleTriggerInstall}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <Download size={15} />
              <span>{isInstallable ? "Install App Now" : "Launch & Install in New Tab"}</span>
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('android')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'android'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Smartphone size={15} className="text-emerald-400" />
            <span>📱 1. Android Phone / Tablet</span>
          </button>

          <button
            onClick={() => setActiveTab('desktop')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'desktop'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Laptop size={15} className="text-sky-400" />
            <span>💻 2. Windows / Mac Desktop</span>
          </button>

          <button
            onClick={() => setActiveTab('apk')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'apk'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Layers size={15} className="text-amber-400" />
            <span>📦 3. Android APK File (Play Store)</span>
          </button>

          <button
            onClick={() => setActiveTab('electron')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'electron'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Terminal size={15} className="text-purple-400" />
            <span>⚙️ 4. Desktop .EXE Installer</span>
          </button>

          <button
            onClick={() => setActiveTab('ios')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'ios'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Apple size={15} className="text-pink-400" />
            <span>🍎 iOS (iPhone/iPad)</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1 bg-slate-900/60">
          
          {/* TAB 1: ANDROID PHONE */}
          {activeTab === 'android' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-5 items-center bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <div className="flex flex-col items-center text-center shrink-0">
                  <div className="p-2 bg-white rounded-xl shadow-lg">
                    <img 
                      src={qrCodeUrl} 
                      alt="Scan to open on Android Phone" 
                      className="w-36 h-36 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://quickchart.io/qr?text=${encodeURIComponent(targetPublicUrl)}&size=300`;
                      }}
                    />
                  </div>
                  <span className="mt-2 text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <QrCode size={13} className="text-emerald-400" /> Scan with Phone Camera
                  </span>
                </div>

                <div className="space-y-3 flex-1 text-xs text-slate-300">
                  <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40 text-emerald-200 font-medium">
                    <p className="font-bold text-emerald-300 mb-1">
                      💡 Android Phone లో యాప్ గా ఎలా ఇన్స్టాల్ చేయాలి? (3 Simple Steps):
                    </p>
                    <p className="leading-relaxed">
                      మీ మొబైల్ లో Google Chrome బ్రౌజర్ లో ఈ లింక్ ఓపెన్ చేయండి. వెంటనే &quot;Install App&quot; ఆప్షన్ వస్తుంది. ఇన్స్టాల్ చేశాక ఇది సాధారణ Play Store యాప్ లాగే మీ ఫోన్ హోమ్ స్క్రీన్ పై Icon తో కనిపిస్తుంది.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                      <p>ఫోన్ కెమెరాతో పక్కన ఉన్న <strong>QR Code</strong> స్కాన్ చేయండి లేదా క్రోమ్ లో లింక్ ఓపెన్ చేయండి.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                      <p>Chrome టాప్ రైట్ కార్నర్ లోని <strong>మూడు చుక్కలు (⋮ Menu)</strong> పై క్లిక్ చేయండి.</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                      <p><strong>&quot;Install App&quot;</strong> లేదా <strong>&quot;Add to Home Screen&quot;</strong> పై ట్యాప్ చేయండి. అయిపోయింది!</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <button
                      onClick={handleCopyUrl}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copied ? "Link Copied!" : "Copy Portal Link for WhatsApp"}</span>
                    </button>
                    <a
                      href={targetPublicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>Open Direct Tab</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DESKTOP PC (WINDOWS / MAC) */}
          {activeTab === 'desktop' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3">
                <div className="p-3 bg-sky-950/40 border border-sky-800/40 rounded-lg text-sky-200">
                  <h4 className="font-bold text-sky-300 mb-1 flex items-center gap-1.5">
                    <Laptop size={15} /> Windows PC & Laptop లో డెస్క్టాప్ యాప్ గా ఎలా ఇన్స్టాల్ చేయాలి?
                  </h4>
                  <p className="leading-relaxed">
                    Google Chrome లేదా Microsoft Edge బ్రౌజర్ ద్వారా ఈ పోర్టల్ ని ఒక క్లిక్ తో ఇండిపెండెంట్ డెస్క్టాప్ సాఫ్ట్వేర్ (.exe లాగే) ఇన్స్టాల్ చేసుకోవచ్చు. ఇది బ్రౌజర్ URL బార్ లేకుండా సొంత విండోలో నడుస్తుంది మరియు డెస్క్టాప్ పై Birla BOMIS ఐకాన్ క్రియేట్ అవుతుంది.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-indigo-400">Method A:</span> URL Bar Icon తో 1-Click
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      ఈ పేజీలో Chrome / Edge పైభాగంలో URL చివర (Right side) ఒక చిన్న <strong>కంప్యూటర్ ఐకాన్ (Install app)</strong> లేదా <strong>ప్లస్ గుర్తు (+)</strong> కనిపిస్తుంది. దానిపై క్లిక్ చేసి <strong>&quot;Install&quot;</strong> కొట్టండి.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span className="text-indigo-400">Method B:</span> Browser Menu ద్వారా
                    </p>
                    <p className="text-slate-400 leading-relaxed">
                      Chrome మెనూ (⋮) క్లిక్ చేసి <strong>&quot;Save and share&quot;</strong> &gt; <strong>&quot;Install Birla BOMIS...&quot;</strong> లేదా Edge లో <strong>&quot;Apps&quot; &gt; &quot;Install this site as an app&quot;</strong> ఎంచుకోండి.
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white text-xs">డెస్క్టాప్ ఫీచర్స్:</p>
                    <p className="text-[11px] text-slate-400">
                      టాస్క్‌బార్ కి పిన్ చేసుకోవచ్చు, ఫుల్ స్క్రీన్ ఆడియో రికార్డింగ్, ఆటోమేటిక్ క్యాష్ & వేగవంతమైన పనితీరు.
                    </p>
                  </div>
                  <button
                    onClick={handleTriggerInstall}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition-all cursor-pointer"
                  >
                    Install on this PC
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: APK FILE GENERATION (GOOGLE PLAY STORE) */}
          {activeTab === 'apk' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="p-3 bg-amber-950/40 border border-amber-800/40 rounded-lg text-amber-200">
                  <h4 className="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
                    <Layers size={15} /> Play Store లేదా WhatsApp ద్వారా పంపే డైరెక్ట్ .APK ఫైల్ ఎలా తయారు చేయాలి?
                  </h4>
                  <p className="leading-relaxed">
                    ఈ వెబ్ యాప్ లో ఇప్పటికే <strong>manifest.json</strong>, <strong>Service Worker (sw.js)</strong>, మరియు హై-రెసొల్యూషన్ <strong>192px/512px Icons</strong> కాన్ఫిగర్ చేయబడి ఉన్నాయి. కాబట్టి ఉచితంగా 2 నిమిషాల్లో .APK లేదా .AAB ఫైల్ డౌన్లోడ్ చేసుకోవచ్చు:
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span className="text-amber-400">Option 1 (ఉచితం & సులువు):</span> PWABuilder (Microsoft Official)
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        100% Free
                      </span>
                    </div>
                    <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                      <li>మీ బ్రౌజర్ లో <strong>https://www.pwabuilder.com</strong> వెబ్‌సైట్ ఓపెన్ చేయండి.</li>
                      <li>ఈ యాప్ యొక్క లైవ్ URL లింక్ ని అక్కడ పేస్ట్ చేసి <strong>&quot;Start&quot;</strong> క్లిక్ చేయండి.</li>
                      <li>అది PWA స్కోర్ ని వెరిఫై చేసి (100% Ready) చూపిస్తుంది.</li>
                      <li><strong>&quot;Package for Stores&quot;</strong> పై క్లిక్ చేసి <strong>&quot;Android&quot;</strong> ఎంచుకోండి.</li>
                      <li>వెంటనే మీకు <strong>Signed APK</strong> మరియు Google Play Store కోసం <strong>.AAB (Android App Bundle)</strong> ఫైల్స్ డౌన్లోడ్ అవుతాయి!</li>
                    </ol>
                    <div className="pt-1">
                      <a 
                        href="https://www.pwabuilder.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold text-xs transition-colors"
                      >
                        <ExternalLink size={13} />
                        <span>Open PWABuilder.com</span>
                      </a>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                    <span className="font-bold text-white text-sm flex items-center gap-1.5">
                      <span className="text-indigo-400">Option 2 (డెవలపర్ పద్ధతి):</span> Capacitor Native Build
                    </span>
                    <p className="text-slate-400">
                      Android Studio ద్వారా బిల్డ్ చేయాలనుకుంటే కమాండ్ లైన్ లో ఈ క్రింది కమాండ్స్ రన్ చేయండి:
                    </p>
                    <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-[11px] text-emerald-400 overflow-x-auto">
                      npm install @capacitor/core @capacitor/cli @capacitor/android<br />
                      npx cap init &quot;Birla BOMIS&quot; &quot;com.birla.bomis&quot; --web-dir dist<br />
                      npm run build<br />
                      npx cap add android<br />
                      npx cap open android
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DESKTOP .EXE INSTALLER */}
          {activeTab === 'electron' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="p-3 bg-purple-950/40 border border-purple-800/40 rounded-lg text-purple-200">
                  <h4 className="font-bold text-purple-300 mb-1 flex items-center gap-1.5">
                    <Terminal size={15} /> Windows డెస్క్టాప్ .EXE ఇన్స్టాలర్ తయారు చేయడం ఎలా?
                  </h4>
                  <p className="leading-relaxed">
                    ప్యాకేజీలో ఇప్పటికే <strong>Electron</strong> మరియు <strong>electron-builder</strong> స్క్రిప్ట్ లు పొందుపరచబడ్డాయి:
                  </p>
                </div>

                <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                  <p className="font-bold text-white">కమాండ్ లైన్ లో రన్ చేయడానికి:</p>
                  <div className="bg-slate-950 p-3 rounded-lg font-mono text-xs text-purple-300 space-y-1">
                    <p className="text-slate-500"># డెస్క్టాప్ యాప్ ని లోకల్ గా టెస్ట్ చేయడానికి:</p>
                    <p className="text-emerald-400">npm run electron:dev</p>
                    <p className="text-slate-500 mt-2"># Windows .exe ఇన్స్టాలర్ ని బిల్డ్ చేయడానికి:</p>
                    <p className="text-emerald-400">npm run electron:build</p>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    ఇది రన్ చేసిన తర్వాత <strong>electron-app/</strong> ఫోల్డర్ లో <strong>Birla CCTV Monitor Setup.exe</strong> ఫైల్ క్రియేట్ అవుతుంది. దాన్ని డబుల్ క్లిక్ చేసి ఏ Windows కంప్యూటర్ లోనైనా ఇన్స్టాల్ చేసుకోవచ్చు.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: IPHONE / IOS */}
          {activeTab === 'ios' && (
            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                <div className="p-3 bg-pink-950/40 border border-pink-800/40 rounded-lg text-pink-200">
                  <h4 className="font-bold text-pink-300 mb-1 flex items-center gap-1.5">
                    <Apple size={15} /> iPhone / iPad (Safari) లో ఎలా ఇన్స్టాల్ చేయాలి?
                  </h4>
                  <p className="leading-relaxed">
                    Apple iOS లో Safari బ్రౌజర్ ద్వారా నేరుగా హోమ్ స్క్రీన్ కి యాప్ ని యాడ్ చేసుకోవచ్చు:
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-bold text-white">Safari బ్రౌజర్ లో ఓపెన్ చేయండి</p>
                      <p className="text-slate-400">మీ iPhone లో డీఫాల్ట్ Safari బ్రౌజర్ లో ఈ పోర్టల్ లింక్ ఓపెన్ చేయండి.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-bold text-white">Share బటన్ ట్యాప్ చేయండి</p>
                      <p className="text-slate-400">స్క్రీన్ కింద కనిపించే <strong>Share ఐకాన్</strong> (బాణం గుర్తుతో ఉన్న చతురస్రం) పై ట్యాప్ చేయండి.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="w-6 h-6 rounded-full bg-pink-600 text-white font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-bold text-white">&quot;Add to Home Screen&quot; ఎంచుకోండి</p>
                      <p className="text-slate-400">కిందకి స్క్రోల్ చేసి <strong>&quot;Add to Home Screen&quot;</strong> నొక్కండి, ఆపై టాప్ రైట్ లో <strong>&quot;Add&quot;</strong> కొట్టండి.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>PWA Engine v2.0 Active • Fully Offline Cached & Auto-Updating</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopyUrl}
              className="flex-1 sm:flex-initial px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Copied Link!" : "Copy Portal Link"}</span>
            </button>
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
