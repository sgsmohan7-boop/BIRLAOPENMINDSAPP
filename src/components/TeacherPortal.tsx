import React, { useState, useRef, useEffect } from "react";
import { 
  LogOut, 
  Send, 
  PlusCircle, 
  Ticket, 
  ListTodo, 
  Download, 
  Smartphone, 
  Laptop, 
  QrCode, 
  Copy, 
  Check, 
  ExternalLink, 
  Info, 
  Search, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  ArrowRight,
  Sun,
  Moon
} from "lucide-react";
import { Ticket as TicketType, Room, Priority, SchoolBranch, TicketStatus, getNextTicketId, getNowFormatted } from "../types";

interface TeacherPortalProps {
  rooms: Room[];
  tickets: TicketType[];
  history: TicketType[];
  userBranch: SchoolBranch;
  userEmail: string;
  onLogout: () => void;
  updateTickets: (tkts: TicketType[]) => void;
  theme?: "light" | "dark";
  toggleTheme?: () => void;
  onSyncRefresh?: () => void;
}

export default function TeacherPortal({
  rooms,
  tickets,
  history = [],
  userBranch,
  userEmail,
  onLogout,
  updateTickets,
  theme = "light",
  toggleTheme,
  onSyncRefresh
}: TeacherPortalProps) {
  // Local state for the selected branch (defaults to logged-in branch)
  const [selectedBranch, setSelectedBranch] = useState<SchoolBranch>(userBranch);
  
  // Tab within the teacher portal: "new-ticket" or "track-status"
  const [activeSubTab, setActiveSubTab] = useState<"new-ticket" | "track-status">("new-ticket");

  // Form states
  const [staffName, setStaffName] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [actualIssue, setActualIssue] = useState("");
  const [ticketSubmitSuccess, setTicketSubmitSuccess] = useState<string | null>(null);

  // Status tracker states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // PWA states
  const [isPwaModalOpen, setIsPwaModalOpen] = useState(false);
  const [pwaTab, setPwaTab] = useState<"android" | "ios" | "pc">("android");
  const [copied, setCopied] = useState(false);

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
  const [usePublicUrl, setUsePublicUrl] = useState(true);
  const activeUrl = (usePublicUrl ? publicUrl : currentUrl) + "?portal=teacher";

  const [selectedBuilding, setSelectedBuilding] = useState<string>("LB Nagar Branch");

  // Searchable combobox states
  const [roomSearch, setRoomSearch] = useState("");
  const [isRoomDropdownOpen, setIsRoomDropdownOpen] = useState(false);
  const roomDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roomDropdownRef.current && !roomDropdownRef.current.contains(event.target as Node)) {
        setIsRoomDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter rooms based on selected branch
  const filteredRooms = rooms.filter(room => room.school === selectedBranch);

  // Filter tickets raised for the selected branch
  // Format of linkedRoom is usually: "School Branch - Dept - Room (class_name)"
  const branchTickets = tickets.filter(t => {
    if (!t.linkedRoom) return false;
    return t.linkedRoom.toLowerCase().includes(selectedBranch.toLowerCase());
  });

  // Apply search query and status filter to the branch tickets
  const filteredTickets = branchTickets.filter(t => {
    const matchesSearch = 
      t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.staffName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.actualIssue.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.linkedRoom.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !actualIssue.trim() || !mobile.trim()) {
      alert("Please enter all details (your name, mobile number, and support issue)!");
      return;
    }

    const linkedRoomObj = rooms.find(r => r.id === selectedRoomId);
    const linkedRoomStr = linkedRoomObj 
      ? `${linkedRoomObj.school} - ${linkedRoomObj.dept} - ${linkedRoomObj.roomNumber} (${linkedRoomObj.className})`
      : `${selectedBranch} - Auto Linked Department`;

    const nowStr = getNowFormatted();

    const tktId = getNextTicketId(tickets, history);

    const newTicket: TicketType = {
      id: tktId,
      issue: `[${staffName.trim()}] ${actualIssue.trim()}`,
      staffName: staffName.trim(),
      actualIssue: actualIssue.trim(),
      mobile: mobile.trim(),
      priority,
      status: "open",
      linkedRoom: linkedRoomStr,
      building: selectedBuilding,
      date: nowStr
    };

    updateTickets([newTicket, ...tickets]);

    // Reset Form Input
    setStaffName("");
    setActualIssue("");
    setMobile("");
    setSelectedRoomId("");
    setPriority("Medium");

    // Show success banner
    setTicketSubmitSuccess(tktId);
    setTimeout(() => {
      setTicketSubmitSuccess(null);
      // Automatically jump to the tracker tab to let them see it
      setActiveSubTab("track-status");
    }, 4000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusConfig = {
    open: { color: "bg-rose-500/10 text-rose-500 border-rose-500/20", label: "Open (Pending)", icon: <Clock size={12} /> },
    pending: { color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "In Progress", icon: <RefreshCw size={12} className="animate-spin" /> },
    resolved: { color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "Resolved", icon: <CheckCircle size={12} /> }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Top Mobile Bar */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-250 dark:border-slate-800 shrink-0 px-4 py-4 flex items-center justify-between shadow-md text-slate-800 dark:text-slate-100 transition-colors duration-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Ticket size={18} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-850 dark:text-white tracking-wide">
              Birla Open Minds International School
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
              Teacher & Staff Portal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Switcher Badge */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value as SchoolBranch)}
            className="text-[11px] font-bold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-2 py-1.5 rounded-lg focus:outline-none cursor-pointer"
          >
            <option value="Birla Open Minds International School">🏫 Birla Open Minds International School</option>
          </select>

          {/* Refresh Portal Button */}
          {onSyncRefresh && (
            <button
              onClick={onSyncRefresh}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              title="Refresh Teacher Portal Data & Stay on Page"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh Desk</span>
            </button>
          )}

          {/* Quick Info / PWA install */}
          <button
            onClick={() => setIsPwaModalOpen(true)}
            className="p-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-150 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-amber-500 dark:text-amber-400 rounded-lg transition-all cursor-pointer"
            title="Install Mobile App"
          >
            <Smartphone size={15} />
          </button>

          {/* Theme Switcher Button */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              className="p-2 bg-slate-50 dark:bg-slate-900 hover:bg-slate-150 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-lg transition-all cursor-pointer"
              title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
            >
              {theme === "dark" ? <Sun size={15} className="text-[#F6AD55]" /> : <Moon size={15} />}
            </button>
          )}

          {/* Logout/Back */}
          <button
            onClick={onLogout}
            className="p-2 bg-slate-50 dark:bg-slate-900 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-500 dark:hover:text-red-400 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 rounded-lg transition-all cursor-pointer"
            title="Logout Portal"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Main Dual Tab Switcher Block */}
      <div className="bg-slate-950/40 p-2 border-b border-slate-800 flex gap-2 shrink-0">
        <button
          onClick={() => setActiveSubTab("new-ticket")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === "new-ticket"
              ? "bg-emerald-600 text-white shadow-lg text-emerald-50"
              : "bg-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle size={14} />
          <span>Raise New Ticket</span>
        </button>
        <button
          onClick={() => setActiveSubTab("track-status")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer ${
            activeSubTab === "track-status"
              ? "bg-emerald-600 text-white shadow-lg text-emerald-50"
              : "bg-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListTodo size={14} />
          <span>Track Status ({branchTickets.length} Tickets)</span>
        </button>
      </div>

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-slate-950/20 max-w-2xl mx-auto w-full">
        {activeSubTab === "new-ticket" ? (
          <div className="space-y-6">
            
            {/* Banner info */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <span className="text-xl">👩‍🏫</span>
              <div className="text-xs space-y-1">
                <p className="font-bold text-emerald-400">Important Notice:</p>
                <p className="text-slate-300 leading-relaxed">
                  Please report any IT-related issues (Computers, Projectors, Speakers, Smartboards, or Internet / Wi-Fi connections) in your classroom or lab using the form below. Our IT support team will resolve them promptly.
                </p>
              </div>
            </div>

            {/* Success Banner */}
            {ticketSubmitSuccess && (
              <div className="p-4 bg-emerald-500 text-slate-900 font-bold text-center rounded-xl animate-bounce text-xs flex items-center justify-center gap-2">
                <CheckCircle size={16} />
                <span>Support ticket registered successfully! ID: {ticketSubmitSuccess}. Redirecting...</span>
              </div>
            )}

            {/* Ticket Submission Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center text-slate-300">
                <h3 className="text-xs font-bold tracking-wider uppercase text-[#F6AD55]">
                  Support Ticket Form
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-850 rounded border border-slate-750 font-bold text-emerald-400">{selectedBranch}</span>
              </div>

              <form onSubmit={handleCreateTicket} className="p-5 space-y-5">
                
                {/* Staff Name */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Teacher Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    placeholder="e.g., Srinivas, Sumalata"
                    className="w-full py-2.5 px-3 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 block"
                  />
                </div>

                {/* Mobile */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Mobile Contact (Phone / WhatsApp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="E.g. 9876543210"
                    pattern="[0-9]{10,12}"
                    className="w-full py-2.5 px-3 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono block"
                  />
                </div>

                {/* Linked room compartment */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Building Block <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedBuilding}
                    onChange={(e) => {
                      setSelectedBuilding(e.target.value);
                      setSelectedRoomId("");
                    }}
                    className="w-full py-2.5 px-3 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 block cursor-pointer mb-5"
                  >
                    <option value="LB Nagar Branch">🏢 LB Nagar Branch</option>

                  </select>

                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Select Classroom / Lab Room <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative" ref={roomDropdownRef}>
                    <div className="flex items-center relative">
                      <Search className="w-4 h-4 absolute left-3 text-slate-500" />
                      <input
                        type="text"
                        value={roomSearch}
                        onClick={() => setIsRoomDropdownOpen(true)}
                        onChange={(e) => {
                          setRoomSearch(e.target.value);
                          setIsRoomDropdownOpen(true);
                          setSelectedRoomId("");
                        }}
                        placeholder="Type room number or name to search..."
                        className="w-full py-2.5 pl-9 pr-3 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 block"
                        required={!selectedRoomId}
                      />
                    </div>
                    {isRoomDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredRooms
                          .filter(r => (r.building || 'LB Nagar Branch') === selectedBuilding)
                          .filter(r => {
                            const searchStr = roomSearch.toLowerCase();
                            return r.roomNumber.toLowerCase().includes(searchStr) || 
                                   r.dept.toLowerCase().includes(searchStr) || 
                                   (r.className && r.className.toLowerCase().includes(searchStr));
                          })
                          .length === 0 ? (
                            <div className="p-3 text-sm text-slate-400 text-center">No rooms found</div>
                          ) : (
                            filteredRooms
                              .filter(r => (r.building || 'LB Nagar Branch') === selectedBuilding)
                              .filter(r => {
                                const searchStr = roomSearch.toLowerCase();
                                return r.roomNumber.toLowerCase().includes(searchStr) || 
                                       r.dept.toLowerCase().includes(searchStr) || 
                                       (r.className && r.className.toLowerCase().includes(searchStr));
                              })
                              .map((r) => (
                                <button
                                  key={r.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedRoomId(r.id);
                                    setRoomSearch(`Dept: ${r.dept} — Room: ${r.roomNumber} (${r.className})`);
                                    setIsRoomDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-800 transition-colors ${selectedRoomId === r.id ? 'bg-emerald-950/30 text-emerald-400' : 'text-slate-200'}`}
                                >
                                  <div className="font-medium text-slate-100">Room {r.roomNumber}</div>
                                  <div className="text-xs text-slate-400">Dept: {r.dept} • {r.className}</div>
                                </button>
                              ))
                          )}
                      </div>
                    )}
                  </div>
                  {filteredRooms.filter(r => (r.building || 'LB Nagar Branch') === selectedBuilding).length === 0 && (
                    <p className="text-[10px] text-amber-400 px-1 italic">
                      ⚠️ Note: No digital spaces or rooms are registered for this building. Please ask the administrator to configure them in Room Master.
                    </p>
                  )}
                </div>

                {/* Priority Selection */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    How Urgent is the Issue?
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["High", "Medium", "Low"] as Priority[]).map((p) => {
                      const colors = {
                        High: "border-rose-800 text-rose-400 bg-rose-950/20 focus:ring-rose-500",
                        Medium: "border-amber-800 text-amber-400 bg-amber-950/20 focus:ring-amber-500",
                        Low: "border-sky-800 text-sky-400 bg-sky-950/20 focus:ring-sky-500"
                      };
                      const activeColors = {
                        High: "bg-rose-500/25 border-rose-500 text-rose-200 font-bold",
                        Medium: "bg-amber-500/25 border-amber-500 text-amber-200 font-bold",
                        Low: "bg-sky-500/25 border-sky-500 text-sky-200 font-bold"
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={`py-2 px-3 border rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            priority === p ? activeColors[p] : colors[p]
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            p === "High" ? "bg-rose-500" : p === "Medium" ? "bg-amber-500" : "bg-sky-500"
                          }`} />
                          <span>{p === "High" ? "🔴 High" : p === "Medium" ? "🟡 Normal" : "🟢 Low"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Problem details */}
                <div className="space-y-1.5 animate-slide-up">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    Describe IT Support Issue <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    value={actualIssue}
                    onChange={(e) => setActualIssue(e.target.value)}
                    placeholder="e.g. Projector not working, PC flickering, keyboard key stuck, internet speed slow..."
                    rows={4}
                    className="w-full p-3 border border-slate-800 rounded-xl text-sm bg-slate-950 text-slate-100 placeholder:text-slate-650 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 block font-medium"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border border-emerald-500/40 cursor-pointer"
                >
                  <Send size={15} />
                  <span>Submit Support Request</span>
                </button>

              </form>
            </div>
            
            {/* Quick Share Link Widget */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-white">Share App with Coworkers</p>
                <p className="text-[10px] text-slate-400">Share this portal link with other teachers</p>
              </div>
              <button
                onClick={handleCopyLink}
                className="py-1.5 px-3 bg-slate-850 hover:bg-slate-800 rounded-lg text-slate-200 text-xs border border-slate-750 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copied ? "Copied!" : "Copy Link"}</span>
              </button>
            </div>

          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Search and filter controls */}
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800/80 space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, status, room..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-850/80">
                {["all", "open", "pending", "resolved"].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`flex-1 py-1.5 text-[10px] font-bold rounded capitalize transition-all cursor-pointer ${
                      statusFilter === filter
                        ? "bg-slate-800 text-[#F6AD55]"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {filter === "all" ? "📜 All" : filter === "open" ? "🔴 Open" : filter === "pending" ? "🟡 Progress" : "🟢 Solved"}
                  </button>
                ))}
              </div>
            </div>

            {/* List Header */}
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-500 px-1 py-1">
              <span>{selectedBranch} SUPPORT QUEUE LIVE STATUS ({filteredTickets.length})</span>
              <span className="text-emerald-400 shrink-0 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live updates active
              </span>
            </div>

            {/* Tickets Status Cards list */}
            <div className="space-y-3">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                  <p className="text-xl">📭</p>
                  <p className="text-xs text-slate-400 font-medium">No support tickets found for this school branch.</p>
                  <button 
                    onClick={() => setActiveSubTab("new-ticket")}
                    className="text-[11px] text-[#F6AD55] font-bold underline hover:text-yellow-400 cursor-pointer"
                  >
                    Raise the first ticket now ➔
                  </button>
                </div>
              ) : (
                filteredTickets.map((tkt) => {
                  const conf = statusConfig[tkt.status] || { color: "bg-slate-800 text-slate-400 border-slate-700", label: tkt.status, icon: <HelpCircle size={12} /> };
                  
                  return (
                    <div 
                      key={tkt.id} 
                      className={`p-4 bg-slate-900 border ${tkt.status === "open" ? "border-rose-500/20" : tkt.status === "pending" ? "border-amber-500/20" : "border-emerald-500/20"} rounded-xl space-y-3 shadow-md hover:translate-y-[-1px] transition-all`}
                    >
                      {/* Top status info line */}
                      <div className="flex justify-between items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono text-slate-400 font-bold">{tkt.id}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold flex items-center gap-1 ${conf.color}`}>
                            {conf.icon}
                            <span>{conf.label}</span>
                          </span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-bold">{tkt.date}</span>
                      </div>

                      {/* Main issue block */}
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-200 break-words leading-relaxed">
                          {tkt.actualIssue}
                        </p>
                        <div className="flex flex-wrap gap-2 text-[10px] items-center text-slate-400">
                          <span className="bg-slate-950 py-0.5 px-2 rounded text-slate-300 font-semibold border border-slate-800">
                            👤 {tkt.staffName}
                          </span>
                          <span className="bg-slate-950 py-0.5 px-2 rounded border border-slate-800">
                            📍 Compartment: {tkt.linkedRoom.replace(`${selectedBranch} - `, "")}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${
                            tkt.priority === "High" ? "bg-rose-950/20 text-rose-400 border-rose-900/40" : tkt.priority === "Medium" ? "bg-amber-950/20 text-amber-400 border-amber-900/40" : "bg-sky-950/20 text-sky-400 border-sky-900/40"
                          }`}>
                            {tkt.priority} Priority
                          </span>
                        </div>
                      </div>

                      {/* Resolution note or Admin comments (If solved / has remarks) */}
                      {(tkt.remarks || tkt.status === "resolved") && (
                        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-[11px] leading-relaxed text-emerald-300 space-y-1">
                          <p className="font-bold border-b border-emerald-500/10 pb-1 flex items-center gap-1">
                            <span>✅ IT Support resolution remarks:</span>
                          </p>
                          <p className="italic text-slate-300">{tkt.remarks || "Issue successfully resolved by IT desk."}</p>
                          {tkt.fixedAt && (
                            <p className="text-[9px] text-emerald-500/80 mt-0.5 font-bold">Resolved At: {tkt.fixedAt}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}
      </main>

      {/* Embedded PWA Mobile Quick Installation Guide Modal */}
      {isPwaModalOpen && (
        <div id="teacher-pwa-modal" className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center z-[999] p-4 text-slate-100">
          <div className="bg-slate-900 border border-slate-800 shadow-2xl rounded-2xl max-w-md w-full overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download size={16} className="text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">IT Support PWA Installer</h3>
              </div>
              <button 
                onClick={() => setIsPwaModalOpen(false)}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content body */}
            <div className="p-5 space-y-4 text-xs text-slate-300">
              
              {/* Iframe detection alert */}
              {window.self !== window.top && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-[10px] space-y-1.5">
                  <p className="font-bold flex items-center gap-1">⚡ Sandbox Frame Limit Detected:</p>
                  <p className="opacity-90">PWA installation is disabled within the sandbox preview frame. Please click 'Open in New Tab' below to install the web app.</p>
                  <button 
                    onClick={() => window.open(window.location.href, "_blank")}
                    className="flex items-center gap-1 bg-amber-600 hover:bg-amber-500 text-slate-950 px-2 py-1 rounded font-bold transition-all cursor-pointer"
                  >
                    <ExternalLink size={10} /> Open in New Tab
                  </button>
                </div>
              )}

              {/* QR and Copy info */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-805 text-center space-y-3">
                <p className="font-bold text-amber-400">Scan Mobile QR Code:</p>

                {isDevApp && (
                  <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg text-left space-y-1.5">
                    <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                      QR Mode / Connection Type:
                    </span>
                    <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded border border-slate-850">
                      <button 
                        type="button"
                        onClick={() => setUsePublicUrl(true)}
                        className={`py-1 rounded text-[10px] font-bold transition-all text-center flex flex-col justify-center cursor-pointer ${
                          usePublicUrl 
                            ? "bg-emerald-600 text-slate-50" 
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span>🌐 Public App</span>
                        <span className="text-[7.5px] opacity-80">(Any phone)</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUsePublicUrl(false)}
                        className={`py-1 rounded text-[10px] font-bold transition-all text-center flex flex-col justify-center cursor-pointer ${
                          !usePublicUrl 
                            ? "bg-amber-600 text-slate-50" 
                            : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <span>🔒 Private Sandbox</span>
                        <span className="text-[7.5px] opacity-80">(This PC only)</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="inline-block bg-white p-2 rounded-lg border">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(activeUrl)}`} 
                    alt="App Link QR"
                    className="w-28 h-28"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-400">Web Portal URL:</p>
                  <div className="flex bg-slate-900 border border-slate-850 rounded p-1">
                    <input 
                      type="text" 
                      readOnly 
                      value={activeUrl} 
                      className="w-full text-[10px] font-mono bg-transparent text-slate-300 pointer-events-all select-all outline-none"
                    />
                    <button 
                      onClick={handleCopyLink} 
                      className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-200 rounded cursor-pointer"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                {isDevApp && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-[10.5px] text-amber-200 leading-normal text-left space-y-1.5">
                    <p className="font-bold text-amber-400">⚠️ Got "Page not found"?</p>
                    <p className="opacity-90">
                      If scanning leads to "Page not found", it indicates your device cannot access this local browser-private sandbox network.
                    </p>
                    <p className="font-bold text-slate-100">
                      Please select <span className="text-emerald-400">"🌐 Public App"</span> mode above and scan the freshly updated QR code. This works on any cellular network and mobile device.
                    </p>
                  </div>
                )}
              </div>

              {/* Tabs for Guide */}
              <div className="flex bg-slate-950 p-1 rounded-lg">
                {(["android", "ios"] as const).map((os) => (
                  <button
                    key={os}
                    onClick={() => setPwaTab(os)}
                    className={`flex-1 py-1 text-[10px] font-bold rounded capitalize transition-all cursor-pointer ${
                      pwaTab === os ? "bg-slate-800 text-[#F6AD55]" : "text-slate-400"
                    }`}
                  >
                    {os === "android" ? "🤖 Android" : "🍎 Safari iPhone"}
                  </button>
                ))}
              </div>

              {/* Tab guide paragraphs */}
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-850 text-[10.5px] leading-relaxed text-slate-400">
                {pwaTab === "android" ? (
                  <div className="space-y-1">
                    <p className="text-slate-300 font-bold">On Google Chrome (Android):</p>
                    <p>1. Open this portal link in Chrome mobile browser.</p>
                    <p>2. Tap the three-dot option menu icon in the top right.</p>
                    <p>3. Select <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-slate-300 font-bold">On Apple Safari (iPhone):</p>
                    <p>1. Open this portal link strictly using the Safari app.</p>
                    <p>2. Tap the central <strong>"Share"</strong> icon at the bottom of safari toolbar.</p>
                    <p>3. Scroll down and choose <strong>"Add to Home Screen"</strong> from the options listing.</p>
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setIsPwaModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-white text-[10.5px] font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
