import React, { useState } from "react";
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  Award, 
  HeartHandshake, 
  GraduationCap, 
  Bus, 
  User, 
  ShieldCheck, 
  Sparkles,
  Link2,
  Lock,
  Share2,
  Globe,
  Scissors,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  Sliders
} from "lucide-react";

interface PortalLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "light" | "dark";
  isEmbedded?: boolean;
}

export default function PortalLinksModal({ isOpen, onClose, theme = "light", isEmbedded = false }: PortalLinksModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkStyle, setLinkStyle] = useState<"clean" | "vercel" | "custom" | "query">("vercel");
  const [vercelDomain, setVercelDomain] = useState<string>("birla-school.vercel.app");
  const [customBaseDomain, setCustomBaseDomain] = useState<string>("birlaopenminds.com");
  const [showDomainGuide, setShowDomainGuide] = useState<boolean>(false);
  const [guideTab, setGuideTab] = useState<"vercel" | "customDomain" | "shortener">("vercel");

  if (!isOpen && !isEmbedded) return null;

  // Derive URLs: convert the sandbox development URL to public shared preview URL (ais-dev- -> ais-pre-)
  const getAppUrls = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let publicUrl = origin;
    let isDev = false;
    if (origin.includes("-dev-")) {
      isDev = true;
      publicUrl = origin.replace("-dev-", "-pre-");
    }
    return { currentUrl: origin, publicUrl, isDev };
  };

  const { currentUrl, publicUrl } = getAppUrls();
  const baseUrl = publicUrl || currentUrl;

  const portals = [
    {
      id: "counselling",
      title: "Parent Counselling & Admissions Desk",
      departmentLabel: "Admissions & Counselling Desk",
      icon: <HeartHandshake className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
      color: "from-orange-600 to-amber-600",
      border: "border-orange-200 dark:border-orange-900/50",
      bg: "bg-orange-50/60 dark:bg-orange-950/20",
      path: "/counselling",
      queryParam: "?portal=counselling",
      customSingleDomain: "birlaopenmindscounselling.com",
      customSubdomain: `counselling.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-counselling",
      roleDesc: "Admissions Counsellors & Parent Enquiry Officers",
      securityNote: "🔒 Locked to Counselling Only: Isolated to admission enquiries, 1hr 50min parent meeting voice recording & live text conversion.",
      features: ["2-Hour Parent Consultation Voice Recording", "Real-Time Continuous Speech-to-Text Diarization", "10 Dedicated Counsellor Profiles & Private Data"]
    },
    {
      id: "admin",
      title: "Super Admin Central Command",
      departmentLabel: "Super Admin Central Master Control",
      icon: <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
      color: "from-indigo-600 to-blue-700",
      border: "border-indigo-200 dark:border-indigo-900/50",
      bg: "bg-indigo-50/60 dark:bg-indigo-950/20",
      path: "/admin",
      queryParam: "?portal=admin",
      customSingleDomain: "birlaopenmindsadmin.com",
      customSubdomain: `admin.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-admin",
      roleDesc: "Super Admin & IT System Administrators",
      securityNote: "👑 Master Control Hub: Has access to ALL portals, audit tools, 5TB Google Drive, CCTV Watchdog, and can generate links.",
      features: ["Full Control of All 5 Department Portals", "Google Drive 5TB & Cloudflare R2 Management", "CCTV Surveillance Watchdog & Warranty AMC Master"]
    },
    {
      id: "management",
      title: "Executive Management Portal",
      departmentLabel: "Executive Board & Leadership",
      icon: <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      color: "from-purple-600 to-indigo-600",
      border: "border-purple-200 dark:border-purple-900/50",
      bg: "bg-purple-50/60 dark:bg-purple-950/20",
      path: "/management",
      queryParam: "?portal=management",
      customSingleDomain: "birlaopenmindsmanagement.com",
      customSubdomain: `management.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-management",
      roleDesc: "Managing Director, Principal, Audit Lead & Leadership Committee",
      securityNote: "🔒 Locked to Management Only: Switcher tabs and other portals are completely hidden. Users cannot enter Admin or Driver portals.",
      features: ["Parent Meeting Voice Audits & Audio Playback", "Auto-Generated .txt Minutes & DIARIZED Transcripts", "Counsellor Performance & Conversion Board"]
    },
    {
      id: "it",
      title: "IT Person Custom Feature Workspace",
      departmentLabel: "IT Staff Custom Feature Workspace",
      icon: <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      color: "from-blue-600 to-indigo-600",
      border: "border-blue-200 dark:border-blue-900/50",
      bg: "bg-blue-50/60 dark:bg-blue-950/20",
      path: "/it",
      queryParam: "?portal=it",
      customSingleDomain: "birlaopenmindsit.com",
      customSubdomain: `it.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-it-portal",
      roleDesc: "IT Person Accounts created by Super Admin in Settings",
      securityNote: "🔒 Permanent Direct Portal Link: Opening this link isolates the workspace to IT Person login, hiding remaining portals for security.",
      features: ["Granular Sidebar Feature Access Control", "Individual IT Staff Account Authentication", "Permanent Direct Portal Links for Staff"]
    },
    {
      id: "teacher",
      title: "Teacher IT Support Portal",
      departmentLabel: "Academic Faculty IT Desk",
      icon: <GraduationCap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      color: "from-emerald-600 to-teal-600",
      border: "border-emerald-200 dark:border-emerald-900/50",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
      path: "/teacher",
      queryParam: "?portal=teacher",
      customSingleDomain: "birlaopenmindsteachers.com",
      customSubdomain: `teachers.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-teachers",
      roleDesc: "Teaching Staff & Classroom Coordinators",
      securityNote: "🔒 Locked to Teacher Only: Passwordless ticket reporting. No access to sensitive school assets or admin tools.",
      features: ["1-Click Classroom Issue Ticket Raising", "Live Ticket Status & Technician Updates", "Mobile-Optimized PWA Friendly"]
    },
    {
      id: "driver",
      title: "Transport Fleet & Driver Portal",
      departmentLabel: "Transport Fleet Operations",
      icon: <Bus className="w-5 h-5 text-amber-600 dark:text-amber-400" />,
      color: "from-amber-600 to-yellow-600",
      border: "border-amber-200 dark:border-amber-900/50",
      bg: "bg-amber-50/60 dark:bg-amber-950/20",
      path: "/driver",
      queryParam: "?portal=driver",
      customSingleDomain: "birlaopenmindsbus.com",
      customSubdomain: `bus.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-bus",
      roleDesc: "School Bus Drivers & Transport Coordinators",
      securityNote: "🔒 Locked to Driver Only: Driver location transmitter only. No other departments visible.",
      features: ["Real-time Bus GPS Coordinate Streaming", "Route Checkpoints & Speed Alerts", "Instant Parent Arrival Notification Trigger"]
    },
    {
      id: "student",
      title: "Parent & Student Bus Tracker",
      departmentLabel: "Parent & Guardian Transit Portal",
      icon: <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      color: "from-blue-600 to-cyan-600",
      border: "border-blue-200 dark:border-blue-900/50",
      bg: "bg-blue-50/60 dark:bg-blue-950/20",
      path: "/student",
      queryParam: "?portal=student",
      customSingleDomain: "birlaopenmindstracker.com",
      customSubdomain: `tracker.${customBaseDomain.trim() || 'birlaopenminds.com'}`,
      shortUrlSuggestion: "bit.ly/birla-tracker",
      roleDesc: "Parents & Students tracking active bus commute",
      securityNote: "🔒 Locked to Parent Tracker Only: Read-only live map. Cannot alter system data.",
      features: ["Live Moving Bus on Interactive Map", "Proximity Geofence Alerts", "ETA to Student Pickup Stop"]
    }
  ];

  const getComputedUrl = (portal: typeof portals[0]) => {
    if (linkStyle === "vercel") {
      const cleanVercel = vercelDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
      return `https://${cleanVercel || 'birla-school.vercel.app'}${portal.path}`;
    }
    if (linkStyle === "clean") {
      return `${baseUrl}${portal.path}`;
    }
    if (linkStyle === "custom") {
      return `https://${portal.customSingleDomain}`;
    }
    // query fallback
    return `${baseUrl}/${portal.queryParam}`;
  };

  const handleCopy = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2500);
  };

  const handleOpen = (portal: typeof portals[0]) => {
    // For test opening, use the live baseUrl path so it opens the actual current app
    window.open(`${baseUrl}${portal.path}`, "_blank");
  };

  const cleanHost = baseUrl.replace(/^https?:\/\//, "");

  const modalBody = (
    <div className={`relative w-full ${isEmbedded ? "max-w-5xl mx-auto shadow-lg" : "max-w-4xl max-h-[92vh] shadow-2xl"} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col`}>
        
      {/* Header */}
      <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
            <Share2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black tracking-tight text-white uppercase">
                Staff Department Portal Links Directory
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-black uppercase">
                Clean Routes &amp; Vercel Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Share simple clean links or configure Vercel host like <strong>birla-school.vercel.app/counselling</strong> or custom domains.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
          title="Close modal"
        >
          <X size={18} />
        </button>
      </div>

      {/* URL Format Switcher Toolbar */}
      <div className="px-6 py-3 bg-slate-100 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Link Display Format:
          </span>
          <div className="flex bg-white dark:bg-slate-900 p-0.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold shadow-xs flex-wrap">
            <button
              type="button"
              onClick={() => setLinkStyle("vercel")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                linkStyle === "vercel"
                  ? "bg-cyan-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Globe size={13} className="text-cyan-300" />
              <span>▲ Vercel (.vercel.app)</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkStyle("clean")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                linkStyle === "clean"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles size={13} className="text-amber-400" />
              <span>⚡ Live Clean Path</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkStyle("custom")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                linkStyle === "custom"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Globe size={13} className="text-emerald-400" />
              <span>🌐 Custom Domain (.com)</span>
            </button>

            <button
              type="button"
              onClick={() => setLinkStyle("query")}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                linkStyle === "query"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Link2 size={13} />
              <span>Cloud Run (?portal=)</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowDomainGuide(!showDomainGuide)}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
        >
          <HelpCircle size={14} />
          <span>{showDomainGuide ? "Hide Setup Guide" : "How to connect your .com domain? (ఎలా సెట్ చేయాలి?)"}</span>
          {showDomainGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* Expandable Vercel Domain Customizer when linkStyle === 'vercel' */}
      {linkStyle === "vercel" && (
        <div className="px-6 py-2.5 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-cyan-300">▲ Your Vercel Domain Name:</span>
            <input
              type="text"
              value={vercelDomain}
              onChange={(e) => setVercelDomain(e.target.value)}
              placeholder="e.g. birla-school.vercel.app"
              className="px-3 py-1 bg-slate-900 text-white rounded-lg border border-cyan-700/60 font-mono text-xs w-64 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <span className="text-[11px] text-cyan-200/80 font-medium">
            (Change this to your actual deployed vercel.app app URL)
          </span>
        </div>
      )}

      {/* Expandable Domain Setup Guide */}
      {showDomainGuide && (
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-800/40 text-slate-200 text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-indigo-800/50 pb-2">
            <h4 className="font-bold text-white text-sm flex items-center gap-2">
              <Globe className="text-cyan-400 w-4 h-4" />
              <span>షార్ట్ లింక్స్ &amp; Vercel.app సెట్ చేసుకునే విధానం:</span>
            </h4>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setGuideTab("vercel")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  guideTab === "vercel"
                    ? "bg-cyan-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                1. Vercel Free Hosting
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("customDomain")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  guideTab === "customDomain"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                2. Custom Domain (.com)
              </button>
              <button
                type="button"
                onClick={() => setGuideTab("shortener")}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  guideTab === "shortener"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                3. Free Short Link (Bitly)
              </button>
            </div>
          </div>

          {guideTab === "vercel" && (
            <div className="space-y-2 leading-relaxed">
              <p className="text-cyan-300 font-bold">
                ▲ Vercel.app లో ఉచితంగా హోస్ట్ చేసి ప్రెట్టీ షార్ట్ లింక్స్ పొందడం ఎలా?
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-slate-300">
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-[10px]">1</span>
                    1-Click Vercel Import
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <a href="https://vercel.com/new" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-bold">vercel.com/new</a> లో మీ GitHub repo ఎంచుకుని <strong>Deploy</strong> క్లిక్ చేయండి.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-[10px]">2</span>
                    కాన్ఫిగరేషన్ ఫైల్
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    మనం ప్రాజెక్ట్ లో <code className="text-emerald-400 font-mono">vercel.json</code> సిద్ధం చేశాము. అన్ని subpaths (<code className="text-cyan-300 font-mono">/counselling</code>, <code className="text-indigo-300 font-mono">/admin</code>) నేరుగా పని చేస్తాయి.
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-cyan-600 text-white font-bold flex items-center justify-center text-[10px]">3</span>
                    షార్ట్ Vercel URL
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    మీరు కోరుకున్న పేరుతో <code className="text-cyan-300 font-mono">your-school.vercel.app</code> వంటి షార్ట్ యుఆర్‌ఎల్ వస్తుంది!
                  </p>
                </div>
              </div>
            </div>
          )}

          {guideTab === "customDomain" && (
            <div className="space-y-2 leading-relaxed">
              <p className="text-emerald-300 font-bold">
                ✓ అవును, ఖచ్చితంగా సెట్ చేయవచ్చు! దీనికి కావలసిన స్టెప్స్:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1 text-slate-300">
                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">1</span>
                    డొమైన్ రిజిస్టర్ చేసుకోండి
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    GoDaddy, Hostinger లేదా Namecheap లో <strong>birlaopenmindscounselling.com</strong> లేదా <strong>birlaopenminds.com</strong> కొనుగోలు చేయండి (వార్షిక రుసుము ~₹499).
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">2</span>
                    DNS లో CNAME పాయింట్ చేయండి
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    మీ Domain DNS Settings లో CNAME Record యాడ్ చేసి, Target గా ఈ క్రింది లైవ్ హోస్ట్ ఇవ్వండి:<br />
                    <code className="text-emerald-400 font-mono text-[10px] break-all">{cleanHost}</code>
                  </p>
                </div>

                <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-1">
                  <p className="font-bold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-[10px]">3</span>
                    ఆటోమేటిక్ డిటెక్షన్
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    ఈ యాప్‌లో డొమైన్ బేస్డ్ రూటింగ్ ఇప్పటికే సిద్ధం చేయబడింది. ఎవరైనా <code className="text-orange-300 font-mono">birlaopenmindscounselling.com</code> ఓపెన్ చేస్తే నేరుగా కౌన్సెలింగ్ పోర్టల్ లోకి వెళతారు!
                  </p>
                </div>
              </div>
            </div>
          )}

          {guideTab === "shortener" && (
            <div className="space-y-2 leading-relaxed">
              <p className="text-amber-300 font-bold">
                ✂️ ఖర్చు లేకుండా 30 సెకన్లలో షార్ట్ లింక్స్ (Bitly / TinyURL) తయారు చేసుకునే విధానం:
              </p>
              <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                <p className="text-slate-300">
                  మీరు డొమైన్ కొనకుండానే ఉచితంగా <strong>bit.ly</strong> లేదా <strong>tinyurl.com</strong> ద్వారా మీ స్కూల్ పేరుతో బ్రాండెడ్ షార్ట్ లింక్స్ తయారు చేసుకోవచ్చు:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-emerald-300 flex items-center justify-between">
                    <span>bit.ly/birla-counselling</span>
                    <span className="text-[10px] text-slate-500 font-sans">→ Admissions Desk</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-indigo-300 flex items-center justify-between">
                    <span>bit.ly/birla-admin</span>
                    <span className="text-[10px] text-slate-500 font-sans">→ Master Command</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-purple-300 flex items-center justify-between">
                    <span>bit.ly/birla-management</span>
                    <span className="text-[10px] text-slate-500 font-sans">→ Director Desk</span>
                  </div>
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 text-teal-300 flex items-center justify-between">
                    <span>bit.ly/birla-teachers</span>
                    <span className="text-[10px] text-slate-500 font-sans">→ Teachers Portal</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Info Callout */}
      <div className="px-6 py-2.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
        <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Role-Isolated Security: </span>
          సిబ్బందికి వారి కేటాయించిన లింక్ (ఉదాహరణకు <strong>/counselling</strong>) మాత్రమే పంపండి. ఆ లింక్ ద్వారా లాగిన్ అయితే వారు ఇతర పోర్టల్స్ లేదా అడ్మిన్ టూల్స్ లోకి ప్రవేశించలేరు.
        </div>
      </div>

      {/* Portals Grid */}
      <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portals.map((p) => {
            const isCopied = copiedId === p.id;
            const targetUrl = getComputedUrl(p);

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border ${p.border} ${p.bg} flex flex-col justify-between transition-all hover:shadow-md`}
              >
                <div className="space-y-2.5">
                  {/* Title & Badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs border border-slate-200 dark:border-slate-700">
                        {p.icon}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                          {p.title}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {p.departmentLabel}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold shrink-0">
                      {linkStyle === "clean" ? p.path : linkStyle === "custom" ? ".COM" : p.queryParam}
                    </span>
                  </div>

                  {/* Role Description */}
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug font-medium">
                    {p.roleDesc}
                  </p>

                  {/* Clean URL Display Box */}
                  <div className="p-2.5 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 select-all overflow-hidden shadow-inner">
                    <span className="truncate font-bold text-indigo-700 dark:text-indigo-400">{targetUrl}</span>
                  </div>

                  {/* Alternative Suggested Short Formats */}
                  {linkStyle === "custom" && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-0.5 font-mono">
                      <p>Subdomain option: <span className="text-indigo-600 dark:text-indigo-300 font-bold">{p.customSubdomain}</span></p>
                      <p>Free Shortlink: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{p.shortUrlSuggestion}</span></p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(p.id, targetUrl)}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                      isCopied
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white"
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={14} className="text-emerald-200" />
                        <span>Copied Link!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Dedicated Link</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpen(p)}
                    className="py-2 px-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
                    title="Test open this portal now"
                  >
                    <ExternalLink size={13} />
                    <span>Test Open</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <Sparkles size={13} className="text-indigo-500" />
          <span>Clean path routes like <strong className="text-indigo-600 dark:text-indigo-400">/counselling</strong> &amp; <strong className="text-indigo-600 dark:text-indigo-400">/admin</strong> work directly on any browser, mobile, or custom domain!</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
        >
          Done
        </button>
      </div>

    </div>
  );

  if (isEmbedded) {
    return modalBody;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      {modalBody}
    </div>
  );
}
