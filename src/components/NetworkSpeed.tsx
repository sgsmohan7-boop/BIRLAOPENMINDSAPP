import React, { useState, useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Globe, Server as ServerIcon, User, RefreshCw, Zap, Monitor, Gamepad2, Video, Users, Phone } from "lucide-react";

export default function NetworkSpeed() {
  const [testPhase, setTestPhase] = useState<"init" | "ping" | "download" | "upload" | "done">("init");
  const [currentDownload, setCurrentDownload] = useState(0);
  const [currentUpload, setCurrentUpload] = useState(0);
  const [testResults, setTestResults] = useState<{
    ping: number;
    jitter: number;
    download: number;
    upload: number;
    server: string;
    provider: string;
  } | null>(null);

  const [profile, setProfile] = useState({
    routerNumber: "9959866644",
    provider: "Digitel Fiber Net",
    speedTier: "300 mbps",
    complaints: "9133100065 & 9100910065"
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const startTest = async () => {
    setTestPhase("init");
    setTestResults(null);
    setCurrentDownload(0);
    setCurrentUpload(0);

    // 1. Initializing & Ping
    setTestPhase("ping");
    await new Promise(r => setTimeout(r, 1500));
    const simulatedPing = Math.floor(Math.random() * 15 + 10); // 10-25 ms ping
    const simulatedJitter = Math.floor(Math.random() * 5 + 2); // 2-7 ms jitter

    // 2. Download Test
    setTestPhase("download");
    // Realistic speeds generally average around 60-70 Mbps on typical Wi-Fi
    const targetDown = parseFloat((65 + Math.random() * 15).toFixed(2));
    await animateValue(0, targetDown, 4000, setCurrentDownload);

    // 3. Upload test
    setTestPhase("upload");
    const targetUp = parseFloat((60 + Math.random() * 10).toFixed(2));
    await animateValue(0, targetUp, 4000, setCurrentUpload);

    setTestPhase("done");
    
    setTestResults({
      ping: simulatedPing,
      jitter: simulatedJitter,
      download: targetDown,
      upload: targetUp,
      server: "Telangana Fiber Grid Corporation Ltd",
      provider: profile.provider
    });
  };

  const animateValue = (start: number, end: number, duration: number, setter: (val: number) => void) => {
    return new Promise<void>((resolve) => {
      let startTimestamp: number | null = null;
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 3);
        let current = start + easeOut * (end - start);
        
        if (progress < 0.95 && progress > 0.05) {
           const wobble = Math.sin(timestamp / 80) * 1.5 + Math.sin(timestamp / 30) * 1.0;
           current += wobble; 
        }

        setter(parseFloat(Math.max(0, current).toFixed(2)));
        if (progress < 1) {
          window.requestAnimationFrame(step);
        } else {
          setter(end);
          resolve();
        }
      };
      window.requestAnimationFrame(step);
    });
  };

  // Maps a 0-1000 scale somewhat logarithmically to an angle.
  // Range is roughly -140 deg to +140 deg => 280deg total.
  const getNeedleRotation = (val: number) => {
    if (val <= 0) return -120;
    // Just a rough mapping for the visual scale
    if (val <= 10) return -120 + (val / 10) * 30; // 0-10 -> -120 to -90
    if (val <= 50) return -90 + ((val - 10) / 40) * 30; // 10-50 -> -90 to -60
    if (val <= 100) return -60 + ((val - 50) / 50) * 30; // 50-100 -> -60 to -30
    if (val <= 250) return -30 + ((val - 100) / 150) * 30; // 100-250 -> -30 to 0
    if (val <= 500) return 0 + ((val - 250) / 250) * 45; // 250-500 -> 0 to 45
    if (val <= 750) return 45 + ((val - 500) / 250) * 45; // 500-750 -> 45 to 90
    if (val <= 1000) return 90 + ((val - 750) / 250) * 30; // 750-1000 -> 90 to 120
    return 120;
  };

  const currentValue = testPhase === 'init' || testPhase === 'ping' 
    ? 0 
    : testPhase === 'download' 
      ? currentDownload 
      : testPhase === 'upload' 
        ? currentUpload 
        : testResults?.download || 0;

  return (
    <div id="network-speed-tab" className="flex flex-col h-full bg-[#141526] text-slate-200 overflow-y-auto w-full custom-scrollbar selection:bg-cyan-500/30 font-sans relative items-center justify-start pt-10 pb-20">
      
      {/* Top Title */}
      <h2 className="text-sm md:text-base font-bold tracking-[0.2em] text-[#8a8c9e] mb-12 uppercase text-center w-full px-4">
        BIRLA OPEN MINDS INTERNATIONAL SCHOOL NETWORK DIAGNOSTIC REPORT
      </h2>

      {/* Main Container */}
      <div className="w-full max-w-2xl flex flex-col items-center px-4">
        
        {/* Top metrics (DOWNLOAD / UPLOAD) */}
        <div className="flex w-full justify-center gap-16 md:gap-32 mb-8">
            <div className="flex flex-col items-center group cursor-pointer min-w-[120px]">
                <div className="flex items-center gap-1.5 text-[#10c3ce] text-[13px] font-bold uppercase mb-1">
                  <div className="p-0.5 rounded-full border border-[#10c3ce]"><ArrowDown size={12} className="stroke-[3]" /></div>
                  DOWNLOAD <span className="text-[#8a8c9e] font-medium lowercase text-xs ml-0.5">Mbps</span>
                </div>
                <div className={`text-4xl md:text-5xl font-light font-mono mb-3 ${testPhase === 'download' || testPhase === 'upload' || testPhase === 'done' ? 'text-white' : 'text-transparent'}`}>
                    {testPhase === 'init' || testPhase === 'ping' ? '—' : currentDownload.toFixed(2)}
                </div>
                {/* Active marker line */}
                <div className={`h-0.5 w-16 bg-[#10c3ce] rounded-full transition-opacity ${testPhase === 'download' || testPhase === 'init' || testPhase === 'ping' ? 'opacity-100' : 'opacity-0'}`}></div>
            </div>

            <div className="flex flex-col items-center group cursor-pointer min-w-[120px]">
                <div className="flex items-center gap-1.5 text-[#a958a5] text-[13px] font-bold uppercase mb-1 text-opacity-80">
                  <div className="p-0.5 rounded-full border border-current"><ArrowUp size={12} className="stroke-[3]" /></div>
                  UPLOAD <span className="text-[#8a8c9e] font-medium lowercase text-xs ml-0.5 text-opacity-80">Mbps</span>
                </div>
                <div className={`text-4xl md:text-5xl font-light font-mono mb-3 ${testPhase === 'upload' || testPhase === 'done' ? 'text-white' : 'text-transparent'}`}>
                    {testPhase === 'init' || testPhase === 'ping' || testPhase === 'download' ? '—' : currentUpload.toFixed(2)}
                </div>
                <div className={`h-0.5 w-16 bg-[#a958a5] rounded-full transition-opacity ${testPhase === 'upload' || testPhase === 'done' ? 'opacity-100' : 'opacity-0'}`}></div>
            </div>
        </div>

        {/* PING & Icons row */}
        <div className="flex flex-col items-center mb-10 w-full max-w-sm">
            <div className="flex items-center justify-center gap-8 mb-5 text-[#8a8c9e] font-medium text-[13px]">
                <div className="flex items-center gap-2">
                     <span className="text-white font-bold">Ping <span className="text-[#8a8c9e] font-normal lowercase">ms</span></span>
                     <span className={`flex items-center gap-1.5 ml-1 ${testPhase === "done" || testPhase !== "init" ? "text-white font-bold" : "text-[#8a8c9e]"}`}>
                         <div className="text-[#e2a829]"><RefreshCw size={14} strokeWidth={2.5} /></div>
                         {testPhase === "done" ? testResults?.ping : testPhase === "ping" ? "..." : "—"}
                     </span>
                </div>
                <div className="flex items-center gap-2">
                     <span className={`flex items-center gap-1.5 ${testPhase === "done" ? "text-[#10c3ce] font-bold" : "text-[#8a8c9e]"}`}>
                         <ArrowDown size={14} strokeWidth={2.5} />
                         {testPhase === "done" ? testResults?.jitter : testPhase === "ping" ? "..." : "—"}
                     </span>
                </div>
                 <div className="flex items-center gap-2">
                     <span className={`flex items-center gap-1.5 text-[#8a8c9e]`}>
                         <ArrowUp size={14} strokeWidth={2.5} />
                         —
                     </span>
                </div>
            </div>

            {/* Quality Icons */}
            <div className="flex gap-6 justify-center w-full mt-2">
               {/* Browser */}
               <div className="flex flex-col items-center gap-1.5 text-[#8a8c9e]">
                   <div className="border border-[#8a8c9e]/40 rounded-md p-1.5"><Monitor size={22} className="" /></div>
                   <div className="flex gap-1 mt-1">
                       {[...Array(5)].map((_, i) => <div key={i} className={`w-[5px] h-[5px] rounded-full ${i < 4 && testPhase === 'done' ? 'bg-[#8a8c9e]' : 'bg-[#2d2e40]'}`}></div>)}
                   </div>
               </div>
               {/* Gamepad */}
               <div className="flex flex-col items-center gap-1.5 text-[#8a8c9e]">
                   <div className="border border-[#8a8c9e]/40 rounded-md p-1.5"><Gamepad2 size={22} /></div>
                   <div className="flex gap-1 mt-1">
                       {[...Array(5)].map((_, i) => <div key={i} className={`w-[5px] h-[5px] rounded-full ${i < 4 && testPhase === 'done' ? 'bg-[#8a8c9e]' : 'bg-[#2d2e40]'}`}></div>)}
                   </div>
               </div>
               {/* Video */}
               <div className="flex flex-col items-center gap-1.5 text-[#8a8c9e]">
                   <div className="border border-[#8a8c9e]/40 rounded-md p-1.5"><Video size={22} /></div>
                   <div className="flex gap-1 mt-1">
                       {[...Array(5)].map((_, i) => <div key={i} className={`w-[5px] h-[5px] rounded-full ${i < 5 && testPhase === 'done' ? 'bg-[#8a8c9e]' : 'bg-[#2d2e40]'}`}></div>)}
                   </div>
               </div>
               {/* Video Call */}
               <div className="flex flex-col items-center gap-1.5 text-[#8a8c9e]">
                   <div className="border border-[#8a8c9e]/40 rounded-md p-1.5"><Users size={22} /></div>
                   <div className="flex gap-1 mt-1">
                       {[...Array(5)].map((_, i) => <div key={i} className={`w-[5px] h-[5px] rounded-full ${i < 4 && testPhase === 'done' ? 'bg-[#8a8c9e]' : 'bg-[#2d2e40]'}`}></div>)}
                   </div>
               </div>
            </div>
        </div>

        {/* Central Speed Gauge */}
        <div className="relative w-[340px] md:w-[420px] h-[240px] md:h-[280px] flex justify-center mb-0 mt-4">
            <svg viewBox="0 0 420 300" className="absolute top-0 left-0 w-full h-full overflow-visible">
                 
                 {/* Background Arc */}
                 <path d="M 80 280 A 150 150 0 1 1 340 280" fill="none" stroke="#1f2036" strokeWidth="24" strokeLinecap="butt" />
                 
                 {/* Active Value Arc */}
                 {(testPhase === "download" || testPhase === "upload" || testPhase === "done") && (
                     <path 
                        d="M 80 280 A 150 150 0 1 1 340 280" 
                        fill="none" 
                        stroke={testPhase === 'upload' ? '#a958a5' : '#10c3ce'} 
                        strokeWidth="24" 
                        strokeLinecap="butt" 
                        pathLength="100"
                        strokeDasharray="100"
                        strokeDashoffset={100 - ((getNeedleRotation(currentValue) + 120) / 240) * 100}
                     />
                 )}

                 {/* Scale Texts */}
                 <g className="fill-white font-bold text-[13px]" style={{fontFamily: "system-ui, sans-serif"}} textAnchor="middle">
                     {[0, 5, 10, 50, 100, 250, 500, 750, 1000].map(val => {
                         const ang = getNeedleRotation(val) * Math.PI / 180;
                         const tx = 210 + 115 * Math.sin(ang);
                         const ty = 205 - 115 * Math.cos(ang) + 5; 
                         return <text key={val} x={tx} y={ty}>{val}</text>
                     })}
                 </g>

                 {/* Needle */}
                 <g transform={`translate(210, 205) rotate(${getNeedleRotation(currentValue)})`}>
                     <polygon points="-4,-15 4,-15 0,-130" fill="white" />
                     <polygon points="-4,20 4,20 4,-15 -4,-15" fill="url(#needleGrad)" />
                 </g>
                 
                 <defs>
                     <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                         <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                     </linearGradient>
                 </defs>
            </svg>

            {/* Center Value */}
            <div className="absolute bottom-6 flex flex-col items-center">
                 <div className="text-[72px] md:text-[84px] font-sans font-medium text-white tracking-tighter leading-none mb-2 drop-shadow-md">
                    {testPhase === 'init' || testPhase === 'ping' ? '—' : testPhase === 'download' ? currentDownload.toFixed(2) : testPhase === 'upload' ? currentUpload.toFixed(2) : (testResults?.download || 0).toFixed(2)}
                 </div>
                 <div className={`text-base font-bold flex items-center gap-1 mt-1 ${testPhase === 'upload' ? 'text-[#a958a5]' : 'text-[#10c3ce]'}`}>
                    {testPhase === 'upload' ? <ArrowUp size={16} className="stroke-[3]" /> : <ArrowDown size={16} className="stroke-[3]" />}
                    Mbps
                 </div>
            </div>
        </div>

        {/* Server & Client Info */}
        <div className="w-full flex justify-center items-center px-4 md:px-0 mt-8 mb-12 max-w-2xl relative">
            {/* Divider */}
            <div className="absolute left-1/2 top-1/2 -translate-y-1/2 -ml-[0.5px] w-[1px] h-16 bg-[#8a8c9e]/20 hidden md:block"></div>

            {/* Client info (Left) */}
            <div className="flex items-center gap-6 text-right w-1/2 justify-end pr-8">
                <div className="flex flex-col items-end">
                  <div className="text-[17px] font-bold text-white tracking-wide uppercase">{profile.provider}</div>
                  <div className="text-[#8a8c9e] text-[13px] mt-1 font-medium select-all">Router: {profile.routerNumber}</div>
                </div>
                <div className="p-3 border border-[#8a8c9e]/40 rounded-full text-[#8a8c9e] hover:text-white transition-colors cursor-pointer flex-shrink-0"><User size={22} strokeWidth={1.5} /></div>
            </div>

            {/* Server info (Right) */}
            <div className="flex items-start gap-6 text-left w-1/2 pl-8">
                <div className="p-3 border border-[#8a8c9e]/40 rounded-full text-[#8a8c9e] hover:text-white transition-colors cursor-pointer mt-1 flex-shrink-0"><Globe size={22} strokeWidth={1.5} /></div>
                <div className="flex flex-col">
                  <div className="text-[17px] font-bold text-white leading-tight">Digitel Node</div>
                  <div className="text-white text-[15px] font-medium leading-tight mt-1">Connecting <span className="text-[#8a8c9e] font-normal text-xs ml-1">Direct</span></div>
                  <div className="text-[#8a8c9e] text-[13px] mt-1.5 font-medium select-all">Help: {profile.complaints}</div>
                </div>
            </div>
        </div>

        {/* Testing again button or GO button */}
        <div className="mt-4 pb-8 h-20 flex justify-center items-center w-full">
            {testPhase === "done" ? (
                 <button 
                   onClick={startTest}
                   className="px-8 py-3.5 rounded-full border-2 border-[#10c3ce] hover:bg-[#10c3ce] hover:text-[#141526] text-[#10c3ce] font-bold tracking-[0.15em] text-sm transition-all duration-300 shadow-[0_0_20px_rgba(16,195,206,0.2)] hover:shadow-[0_0_30px_rgba(16,195,206,0.5)]"
                 >
                   TEST AGAIN
                 </button>
            ) : testPhase === "init" ? (
                 <button 
                   onClick={startTest}
                   className="px-16 py-4 rounded-full bg-gradient-to-r from-[#10c3ce] to-[#10b0b8] hover:to-[#0e9fa6] shadow-[0_0_25px_rgba(16,195,206,0.3)] hover:shadow-[0_0_40px_rgba(16,195,206,0.5)] text-[#141526] font-black tracking-[0.2em] text-lg transition-all duration-300"
                 >
                   GO
                 </button>
            ) : (
                 <div className="px-10 py-3 rounded-full border border-slate-600/50 text-[#8a8c9e] font-bold tracking-widest text-sm opacity-60">
                   TESTING...
                 </div>
            )}
        </div>

        {/* Profile Details Edit Card */}
        <div className="w-full max-w-xl bg-slate-800/40 border border-[#8a8c9e]/20 rounded-2xl p-6 mb-12 shadow-xl backdrop-blur-sm">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-white font-semibold">
                    <ServerIcon size={18} className="text-[#10c3ce]" />
                    Connection Profile
                </div>
                <button 
                    onClick={() => setIsEditingProfile(!isEditingProfile)}
                    className="text-[11px] font-bold uppercase tracking-wider text-[#10c3ce] hover:text-white transition-colors px-4 py-2 rounded-full border border-[#10c3ce]/30 hover:bg-[#10c3ce]/10"
                >
                    {isEditingProfile ? "Save Profile" : "Edit Details"}
                </button>
            </div>

            {isEditingProfile ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                     <div>
                         <label className="block text-[11px] font-bold text-[#8a8c9e] uppercase mb-1.5 tracking-wider">Provider Name</label>
                         <input value={profile.provider} onChange={e => setProfile({...profile, provider: e.target.value})} className="w-full bg-[#141526] border border-[#8a8c9e]/30 rounded-lg px-3 py-2.5 text-white text-[13px] font-medium focus:outline-none focus:border-[#10c3ce] transition-colors" />
                     </div>
                     <div>
                         <label className="block text-[11px] font-bold text-[#8a8c9e] uppercase mb-1.5 tracking-wider">Plan Speed</label>
                         <input value={profile.speedTier} onChange={e => setProfile({...profile, speedTier: e.target.value})} className="w-full bg-[#141526] border border-[#8a8c9e]/30 rounded-lg px-3 py-2.5 text-white text-[13px] font-medium focus:outline-none focus:border-[#10c3ce] transition-colors" />
                     </div>
                     <div>
                         <label className="block text-[11px] font-bold text-[#8a8c9e] uppercase mb-1.5 tracking-wider">Router / Account No.</label>
                         <input value={profile.routerNumber} onChange={e => setProfile({...profile, routerNumber: e.target.value})} className="w-full bg-[#141526] border border-[#8a8c9e]/30 rounded-lg px-3 py-2.5 text-white text-[13px] font-medium focus:outline-none focus:border-[#10c3ce] transition-colors" />
                     </div>
                     <div>
                         <label className="block text-[11px] font-bold text-[#8a8c9e] uppercase mb-1.5 tracking-wider">Complaint Numbers</label>
                         <input value={profile.complaints} onChange={e => setProfile({...profile, complaints: e.target.value})} className="w-full bg-[#141526] border border-[#8a8c9e]/30 rounded-lg px-3 py-2.5 text-white text-[13px] font-medium focus:outline-none focus:border-[#10c3ce] transition-colors" />
                     </div>
                 </div>
            ) : (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-6">
                     <div className="col-span-1 border-r border-[#8a8c9e]/20 pr-3">
                         <div className="text-[10px] font-bold text-[#8a8c9e] uppercase tracking-wider mb-1">Provider</div>
                         <div className="text-white text-[13px] font-semibold">{profile.provider}</div>
                     </div>
                     <div className="col-span-1 border-r border-[#8a8c9e]/20 px-3">
                         <div className="text-[10px] font-bold text-[#8a8c9e] uppercase tracking-wider mb-1">Plan</div>
                         <div className="text-white text-[13px] font-semibold">{profile.speedTier}</div>
                     </div>
                     <div className="col-span-1 border-r border-[#8a8c9e]/20 px-3">
                         <div className="text-[10px] font-bold text-[#8a8c9e] uppercase tracking-wider mb-1">Router No.</div>
                         <div className="text-white text-[13px] font-semibold select-all text-ellipsis overflow-hidden break-all">{profile.routerNumber}</div>
                     </div>
                     <div className="col-span-1 pl-3">
                         <div className="text-[10px] font-bold text-[#8a8c9e] uppercase tracking-wider mb-1">Complaints</div>
                         <div className="text-[#10c3ce] text-[13px] font-semibold select-all leading-tight flex items-start gap-1">
                             <Phone size={12} className="mt-[2px] flex-shrink-0" />
                             <span className="break-all">{profile.complaints}</span>
                         </div>
                     </div>
                 </div>
            )}
        </div>

      </div>
    </div>
  );
}


