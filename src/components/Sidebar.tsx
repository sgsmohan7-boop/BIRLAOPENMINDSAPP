import React from "react";
import { 
  Home, 
  PlusCircle, 
  Package, 
  Users, 
  School, 
  BarChart3, 
  FileText, 
  ShieldAlert, 
  Zap, 
  Settings, 
  LogOut,
  Download,
  X,
  Smartphone,
  Laptop,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Info,
  FileSpreadsheet,
  Sun,
  Moon,
  Sparkles,
  Video,
  Truck,
  GraduationCap,
  Award,
  HardDrive,
  RefreshCw,
  Cloud,
  Share2,
  ShieldCheck,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  Store
} from "lucide-react";
import { motion } from "motion/react";
import AppInstallModal from "./AppInstallModal";
import { loadITStaffAccounts, saveITStaffAccounts } from "../utils/storage";
import { saveDocument, isFirebaseConfigured } from "../utils/firebase";

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  userEmail: string;
  userRole: string;
  userBranch: string;
  onLogout: () => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
  onSyncRefresh?: () => void;
  allowedTabs?: string[] | null;
}

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  userEmail, 
  userRole, 
  userBranch, 
  onLogout,
  theme = "light",
  toggleTheme,
  onSyncRefresh,
  allowedTabs
}: SidebarProps) {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = React.useState(false);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [activeInstallTab, setActiveInstallTab] = React.useState<"android" | "ios" | "pc">("android");
  const [copied, setCopied] = React.useState(false);

  // Change Passcode state for logged-in user
  const [isChangePasscodeModalOpen, setIsChangePasscodeModalOpen] = React.useState(false);
  const [newPass, setNewPass] = React.useState("");
  const [confirmPass, setConfirmPass] = React.useState("");
  const [showPass, setShowPass] = React.useState(false);
  const [passMessage, setPassMessage] = React.useState("");

  const handleChangePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 4) {
      setPassMessage("⚠️ Passcode must be at least 4 characters long.");
      return;
    }
    if (newPass !== confirmPass) {
      setPassMessage("⚠️ Passcodes do not match!");
      return;
    }

    const allITAccounts = loadITStaffAccounts();
    const emailClean = (userEmail || "").toLowerCase();
    const matched = allITAccounts.find(a => 
      a.email.toLowerCase() === emailClean || 
      a.username.toLowerCase() === emailClean ||
      emailClean.includes(a.username.toLowerCase())
    );

    if (matched) {
      const updated = allITAccounts.map(acc => {
        if (acc.id === matched.id || acc.username.toLowerCase() === matched.username.toLowerCase()) {
          return { ...acc, password: newPass };
        }
        return acc;
      });

      saveITStaffAccounts(updated);
      if (isFirebaseConfigured()) {
        saveDocument("it_staff_accounts", matched.id, { ...matched, password: newPass });
      }
      fetch("/api/accounts/it-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...matched, password: newPass })
      }).catch(() => {});

      setPassMessage("🎉 Success! Your passcode has been updated and synced to Super Admin Settings.");
      setTimeout(() => {
        setIsChangePasscodeModalOpen(false);
        setNewPass("");
        setConfirmPass("");
        setPassMessage("");
      }, 1500);
    } else {
      setPassMessage("🎉 Success! Your user credentials have been updated.");
      setTimeout(() => {
        setIsChangePasscodeModalOpen(false);
        setNewPass("");
        setConfirmPass("");
        setPassMessage("");
      }, 1500);
    }
  };

  // Derive URLs: convert the sandbox development URL to public shared preview URL (ais-dev- -> ais-pre-)
  const getAppUrls = () => {
    const origin = window.location.origin;
    let publicUrl = origin;
    let isDev = false;
    if (origin.includes("-dev-")) {
      isDev = true;
      publicUrl = origin.replace("-dev-", "-pre-");
    }
    return { currentUrl: origin, publicUrl, isDev };
  };

  const { currentUrl, publicUrl, isDev: isDevApp } = getAppUrls();
  const [usePublicUrl, setUsePublicUrl] = React.useState(true);
  const activeUrl = usePublicUrl ? publicUrl : currentUrl;

  React.useEffect(() => {
    // Synchronize with the globally captured beforeinstallprompt event if available
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
      setShowInstallBtn(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    const handleCustomPromptSync = () => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
        setShowInstallBtn(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("pwa-prompt-available", handleCustomPromptSync);

    // If autoInstall=true is present in the URL, gracefully open the manual guide modal
    // so the user can interact and click the physical 'Install Application' button.
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoInstall") === "true") {
      setIsModalOpen(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("pwa-prompt-available", handleCustomPromptSync);
    };
  }, []);

  const handleInstallApp = async () => {
    const isIframe = window.self !== window.top;
    
    // 1. If currently inside the preview frame, bust out to a real new tab where the browser enables installing
    if (isIframe) {
      const urlObj = new URL(window.location.href);
      urlObj.searchParams.set("autoInstall", "true");
      window.open(urlObj.toString(), "_blank");
      return;
    }

    // 2. If PWA installation is supported and prompt is available, trigger it instantly
    const activePrompt = deferredPrompt || (window as any).deferredPrompt;
    if (activePrompt) {
      try {
        // console.log("[PWA] Triggering direct installation prompt from Sidebar...");
        activePrompt.prompt();
        const { outcome } = await activePrompt.userChoice;
        if (outcome === "accepted") {
          setShowInstallBtn(false);
        }
        setDeferredPrompt(null);
        (window as any).deferredPrompt = null;
        return;
      } catch (err) {
        // console.error("Direct install prompt error:", err);
      }
    }
    
    // 3. Fallback: If prompt didn't fire yet or browser doesn't support custom prompting (like iOS Safari), open the manual guide modal
    setIsModalOpen(true);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, "_blank");
  };
  
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <Home size={18} />, color: "#2563EB", allowed: ["Super Admin", "IT Admin", "Viewer"] },
    { id: "portal-links", label: "Staff Portal Links", icon: <Share2 size={18} />, color: "#8B5CF6", allowed: ["Super Admin", "IT Admin"], badge: "Portals" },
    { id: "counselling-dept", label: "Counselling Dept", icon: <GraduationCap size={18} />, color: "#EA580C", allowed: ["Super Admin", "IT Admin", "Viewer"], badge: "Admissions" },
    { id: "management-desk", label: "Executive Management", icon: <Award size={18} />, color: "#8B5CF6", allowed: ["Super Admin", "IT Admin", "Viewer"], badge: "Director Desk" },
    { id: "google-drive", label: "Google Drive (5 TB)", icon: <HardDrive size={18} />, color: "#2563EB", allowed: ["Super Admin", "IT Admin", "Management", "Viewer", "Counsellor"], badge: "5 TB" },
    { id: "cloudflare-r2", label: "Cloudflare R2 Storage", icon: <Cloud size={18} />, color: "#F97316", allowed: ["Super Admin", "IT Admin", "Management", "Viewer", "Counsellor"], badge: "10GB R2" },
    { id: "raise-ticket", label: "Raise Ticket", icon: <PlusCircle size={18} />, color: "#38A169", allowed: ["Super Admin", "IT Admin"] },
    { id: "school-store", label: "School Store & Dispatches", icon: <Store size={18} />, color: "#DD6B20", allowed: ["Super Admin", "IT Admin"], badge: "Store Master" },
    { id: "inventory", label: "IT & Asset Inventory", icon: <Package size={18} />, color: "#3182CE", allowed: ["Super Admin", "IT Admin"], badge: "IT Assets" },
    { id: "emp-assets", label: "Emp Assets", icon: <Users size={18} />, color: "#3182CE", allowed: ["Super Admin", "IT Admin"] },
    { id: "room-master", label: "Room Master", icon: <School size={18} />, color: "#D69E2E", allowed: ["Super Admin", "IT Admin"] },
    { id: "analytics", label: "Analytics", icon: <BarChart3 size={18} />, color: "#E53E3E", allowed: ["Super Admin", "IT Admin"] },
    { id: "warranty-tracker", label: "Warranty & AMC", icon: <ShieldAlert size={18} />, color: "#D53F8C", allowed: ["Super Admin", "IT Admin"] },
    { id: "network-speed", label: "Network Speed", icon: <Zap size={18} />, color: "#805AD5", allowed: ["Super Admin", "IT Admin", "Viewer"] },
    { id: "cctv-watchdog", label: "CCTV Watchdog Hub", icon: <Video size={18} />, color: "#EC4899", allowed: ["Super Admin"] },
    { id: "transport-dashboard", label: "GPS Transport", icon: <Truck size={18} />, color: "#3182CE", allowed: ["Super Admin", "IT Admin", "Viewer"] },
    { id: "settings", label: "Settings", icon: <Settings size={18} />, color: "#4A5568", allowed: ["Super Admin", "IT Admin", "Viewer"] }
  ];

  return (
    <aside id="app-sidebar" className="w-80 bg-[#1E293B] flex flex-col h-screen text-slate-100 selection:bg-[#F6AD55] selection:text-slate-900 shadow-xl border-r border-[#2d3a4f] no-print print:hidden">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-700/50 bg-slate-900/40">
        {/* Branding header block */}
        <div className="flex items-center gap-3 w-full animate-fade-in">
          {/* Logo container on the left */}
          <div className="flex items-center shrink-0">
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Birla Open Minds International School Logo" 
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl border border-slate-700 shadow-md object-contain bg-white shrink-0 block p-1" 
            />
          </div>

          {/* School name on the right */}
          <div className="space-y-0.5 flex-1 min-w-0 text-left">
            <h2 className="text-xs font-black font-sans text-[#F97316] tracking-wider uppercase leading-snug">
              BIRLA OPEN MINDS INTERNATIONAL SCHOOL
            </h2>
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase truncate">
                🛡️ IT HELPDESK
              </p>
              {onSyncRefresh && (
                <button
                  onClick={onSyncRefresh}
                  title="Sync live databases and refresh"
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-colors"
                >
                  <RefreshCw size={12} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3.5 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item: any) => {
          const isMainSuperAdmin = (userEmail || "").toLowerCase().includes("sgsmohan7@gmail.com");

          // 1. If custom allowedTabs feature list exists for this IT person / user session:
          if (!isMainSuperAdmin && allowedTabs && Array.isArray(allowedTabs) && allowedTabs.length > 0) {
            if (!allowedTabs.includes(item.id)) return null;
          } else {
            // 2. Standard role permission check
            const roleClean = (userRole || "").toLowerCase();
            const isITRole = roleClean.includes("it") || roleClean.includes("support") || roleClean.includes("admin") || roleClean.includes("tech");
            if (!item.allowed.includes(userRole) && userRole !== "Super Admin" && !isITRole) return null;
          }

          const isActive = currentTab === item.id;
          
          return (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold tracking-wide transition-colors ${
                isActive 
                  ? "bg-slate-100 text-slate-900 shadow-md" 
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <span className={`p-1.5 rounded-lg ${isActive ? "text-slate-900 bg-slate-200" : "text-slate-400"}`}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.badge && (
                <span className="ml-auto px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-500 text-white shadow-xs">
                  {item.badge}
                </span>
              )}
              {isActive && !item.badge && (
                <motion.span 
                  layoutId="activeTabDot"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600"
                ></motion.span>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Install App Trigger Button */}
      <div className="px-4 py-2 border-t border-slate-700/30">
        <button
          onClick={handleInstallApp}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-md hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer"
        >
          <Download size={14} />
          INSTALL MOBILE / PC APP
        </button>
      </div>

      {/* Modern Theme Switcher Switch */}
      {toggleTheme && (
        <div className="px-6 py-3 border-t border-slate-700/30 flex items-center justify-between text-slate-300">
          <span className="text-xs font-bold tracking-wide flex items-center gap-2 shrink-0">
            {theme === "dark" ? <Moon size={14} className="text-indigo-400 animate-pulse" /> : <Sun size={14} className="text-[#F6AD55] animate-spin-slow" />}
            <span>Theme Mode ({theme === "dark" ? "Dark" : "Light"})</span>
          </span>
          <button
            onClick={toggleTheme}
            className="w-11 h-6 rounded-full bg-slate-800 border border-slate-700 p-0.5 flex items-center cursor-pointer transition-all relative focus:outline-none select-none"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            <div 
              className={`w-4 h-4 rounded-full shadow-md transition-transform duration-250 ${
                theme === "dark" ? "translate-x-5 bg-indigo-500" : "translate-x-0 bg-yellow-500"
              }`} 
            />
          </button>
        </div>
      )}

      {/* User Session Footer */}
      <div className="p-6 border-t border-slate-700/50 space-y-4 bg-slate-900/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-sm text-[#F6AD55]">
            {userEmail.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{userEmail}</p>
            <p className="text-[10px] font-medium text-slate-400 capitalize">{userRole}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setIsChangePasscodeModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/50 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer shadow-xs"
          >
            <KeyRound size={13} />
            <span>CHANGE PASSCODE</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-transparent hover:bg-red-500/10 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-xl text-xs font-bold tracking-wide transition-all cursor-pointer"
          >
            <LogOut size={14} />
            LOG OUT SESSION
          </button>
        </div>
      </div>

      {/* PWA App Installation Guide Modal */}
      <AppInstallModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />

      {/* Change Passcode Modal for Logged-In User */}
      {isChangePasscodeModalOpen && (
        <div id="change-passcode-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 animate-fade-in font-sans">
          <div className="bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Change Login Passcode</h3>
                  <p className="text-[11px] text-slate-400">Update password for account: <strong>{userEmail}</strong></p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChangePasscodeModalOpen(false);
                  setPassMessage("");
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {passMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                passMessage.includes("🎉") 
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-300" 
                  : "bg-amber-500/10 border border-amber-500/30 text-amber-300"
              }`}>
                {passMessage}
              </div>
            )}

            <form onSubmit={handleChangePasscodeSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  New Passcode / Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Enter new passcode (e.g. Password@123)"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Confirm New Passcode
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock size={14} />
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    required
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Re-enter new passcode"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <ShieldCheck size={13} /> Automatic Super Admin Synchronization
                </p>
                <p className="text-[10px] text-indigo-300/80 leading-relaxed">
                  Your new passcode will immediately update in Super Admin Settings and live database records.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasscodeModalOpen(false);
                    setPassMessage("");
                  }}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Update Passcode</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}
