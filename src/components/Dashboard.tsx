import { AnimatedNoTickets } from "./AnimatedNoTickets";
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Eye, AlertCircle, ArrowUpCircle, CheckCircle2, History, Check, X, ClipboardCheck, Pin, Hourglass, Zap, Trophy, Printer, Calendar, FileSpreadsheet, FileText, Info, HelpCircle, RefreshCw, CheckCircle } from "lucide-react";
import { Ticket, InventoryItem, Room, Priority, EmployeeAllocation, parseTicketDateToTimestamp } from "../types";
import { motion } from "motion/react";

interface DashboardProps {
  tickets: Ticket[];
  history: Ticket[];
  inventory: InventoryItem[];
  rooms: Room[];
  allocations: EmployeeAllocation[];
  onNavigateTab?: (tab: string) => void;
  updateTickets: (
    tkts: Ticket[],
    hst?: Ticket[],
    inv?: InventoryItem[],
    rms?: Room[],
    allocs?: EmployeeAllocation[]
  ) => void;
}

export default function Dashboard({
  tickets,
  history,
  inventory,
  rooms,
  allocations,
  onNavigateTab,
  updateTickets,
}: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "open" | "pending" | "resolved-today" | "resolved-all">("open");
  const [historyDate, setHistoryDate] = useState("");
  const [logoError, setLogoError] = useState(false);
  
  // Selected actions states
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [ticketToResolve, setTicketToResolve] = useState<Ticket | null>(null);

  // Calendar Quick Report states
  const [showQuickReportModal, setShowQuickReportModal] = useState(false);
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportStatusFilter, setReportStatusFilter] = useState<"All" | "open" | "pending" | "resolved">("All");
  const [reportQueryTitle, setReportQueryTitle] = useState("");
  const [reportMode, setReportMode] = useState<"date" | "room">("date");
  const [selectedReportBuilding, setSelectedReportBuilding] = useState<"All" | "LB Nagar Branch">("All");
  const [selectedReportRoom, setSelectedReportRoom] = useState<string>("All");

  // Print PDF Preview Modal states in Dashboard
  const [showDashboardPrintModal, setShowDashboardPrintModal] = useState(false);

  // Helper date generators
  const getTodayString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getPastDateString = (daysAgo: number): string => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getFirstOfDayOfCurrentMonthString = (): string => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  // Parsing & Date Checks
  const parseTicketDateLocal = (dateStr: string): Date => {
    if (!dateStr || typeof dateStr !== "string") return new Date();
    const timestamp = parseTicketDateToTimestamp(dateStr);
    if (timestamp > 0) {
      return new Date(timestamp);
    }
    return new Date();
  };

  const parseLocalYMD = (ymdStr: string, isEnd: boolean): Date => {
    if (!ymdStr || typeof ymdStr !== "string") return new Date();
    const parts = ymdStr.split("-").map(Number);
    if (parts.length < 3 || isNaN(parts[0])) return new Date();
    const [year, month, day] = parts;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return new Date();
    if (isEnd) {
      d.setHours(23, 59, 59, 999);
    } else {
      d.setHours(0, 0, 0, 0);
    }
    return d;
  };

  // Forms for resolution
  const [selectedRoom, setSelectedRoom] = useState("");
  
  const [savedTechs] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem("sgs_technicians") || '["Mohan"]');
      return Array.isArray(parsed) ? parsed : ["Mohan"];
    } catch {
      return ["Mohan"];
    }
  });
  
  const [selectedTechnician, setSelectedTechnician] = useState("");
  const [selectedInventoryItem, setSelectedInventoryItem] = useState("");
  
  // Get active user for permissions
  const [activeSession] = useState(() => {
    try {
      const raw = sessionStorage.getItem("it_pro_session");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed || {};
    } catch {
      return {};
    }
  });
  const isMainAdmin = activeSession?.email === "admin@school.com" || activeSession?.role === "Super Admin";

  // Pre-fill technician name if available
  useEffect(() => {
    if (ticketToResolve && !selectedTechnician) {
      const activeName = activeSession.email?.split("@")[0] || "";
      const matchedTech = savedTechs.find((t: string) => t.toLowerCase() === activeName.toLowerCase()) || savedTechs[0];
      setSelectedTechnician(matchedTech || "");
    }
  }, [ticketToResolve, savedTechs, activeSession.email, selectedTechnician]);

  const [hardwareQty, setHardwareQty] = useState(1);
  const [remarks, setRemarks] = useState("");

  const todayStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

  // Calculate stats
  const activeTicketsCount = tickets.filter(t => t.status === "open").length;
  const pendingCount = tickets.filter(t => t.status === "pending").length;
  const fixedTodayCount = history.filter(h => h.fixedAt?.replace(/\//g, "-")?.startsWith(todayStr)).length;
  const totalFixedCount = history.length;

  // Dynamic quick-report dataset calculations
  const allCombinedTickets = [
    ...tickets.map(t => ({ ...t, resolvedAt: t.fixedAt || undefined })),
    ...history.map(h => ({ ...h, resolvedAt: h.fixedAt || h.date, status: "resolved" as const }))
  ];

  // Extracts unique spares consumed from remarks string of matched tickets (dynamic lookup)
  const getSparesSummaryFromTickets = (matchedTkts: Ticket[]) => {
    const summary: Record<string, number> = {};
    matchedTkts.forEach(t => {
      if (!t.remarks) return;
      // Remarks pattern typically is: "Tech: Admin | HW: Dell Mouse (x1) | Notes: Replaced"
      const match = t.remarks.match(/HW:\s*([^(|]+)\s*\(x(\d+)\)/i);
      if (match) {
        const itemName = match[1].trim();
        const qty = parseInt(match[2], 10) || 0;
        if (itemName && itemName !== "None" && qty > 0) {
          summary[itemName] = (summary[itemName] || 0) + qty;
        }
      }
    });
    return summary;
  };

  const getFilteredDashboardTickets = () => {
    if (!reportFromDate || !reportToDate) return [];
    
    // Parse limits
    const startLimit = parseLocalYMD(reportFromDate, false);
    const endLimit = parseLocalYMD(reportToDate, true);

    const filtered = allCombinedTickets.filter(item => {
      // 1. Status Filter Constraint
      if (reportStatusFilter !== "All" && item.status !== reportStatusFilter) {
        return false;
      }

      // 2. Date Range Constraint
      const reportDate = item.status === "resolved" ? (item.resolvedAt || item.fixedAt || item.date) : item.date;
      const ticketDate = parseTicketDateLocal(reportDate);

      const normalizedDate = new Date(ticketDate.getFullYear(), ticketDate.getMonth(), ticketDate.getDate());
      if (normalizedDate < startLimit || normalizedDate > endLimit) {
        return false;
      }

      // 3. Room-wise report filters
      if (reportMode === "room") {
        // Building Check
        if (selectedReportBuilding !== "All") {
          let matchesBuilding = item.building === selectedReportBuilding;
          if (!matchesBuilding && item.linkedRoom) {
            const matchedRoom = rooms.find(r => {
              const fullRoomStr = `${r.school} - ${r.dept} - ${r.roomNumber} (${r.className})`;
              return fullRoomStr === item.linkedRoom;
            });
            if (matchedRoom?.building === selectedReportBuilding) {
              matchesBuilding = true;
            }
          }
          if (!matchesBuilding) return false;
        }

        // Room Check
        if (selectedReportRoom !== "All") {
          if (item.linkedRoom !== selectedReportRoom) {
            return false;
          }
        }
      }

      return true;
    });

    // Newest first
    return filtered.sort((a, b) => {
      const dateA = parseTicketDateLocal(a.date);
      const dateB = parseTicketDateLocal(b.date);
      return dateB.getTime() - dateA.getTime();
    });
  };

  const matchedReportTickets = getFilteredDashboardTickets();

  // Excel download helper for Dashboard Quick Reports 
  const handleDownloadExcelDashboard = () => {
    if (matchedReportTickets.length === 0) {
      alert("No data available to download!");
      return;
    }

    const csvRows = [];
    const escapeVal = (val: any) => {
      if (val === undefined || val === null) return '""';
      const clean = String(val).replace(/"/g, '""');
      return `"${clean}"`;
    };

    if (reportMode === "room") {
      // Premium audit summary banners for Classroom logs
      csvRows.push([`BIRLA OPEN MINDS INTERNATIONAL SCHOOL — DYNAMIC ROOM INSPECTION & AUDIT LEDGER`].map(escapeVal).join(","));
      csvRows.push([`Date Generated:`, `${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} (UTC 2026)`].map(escapeVal).join(","));
      csvRows.push([`Target Building:`, selectedReportBuilding === "All" ? "Combined Broad Audit" : selectedReportBuilding].map(escapeVal).join(","));
      csvRows.push([`Target Room Code:`, selectedReportRoom === "All" ? "All Classrooms" : selectedReportRoom].map(escapeVal).join(","));
      csvRows.push([`Reporting Period:`, `${reportFromDate} to ${reportToDate}`].map(escapeVal).join(","));
      csvRows.push([`Matched Complaints:`, `${matchedReportTickets.length} cases registered`].map(escapeVal).join(","));
      
      const sparesObj = getSparesSummaryFromTickets(matchedReportTickets);
      const sparesLine = Object.entries(sparesObj).length > 0
        ? Object.entries(sparesObj).map(([item, count]) => `${item} (qty: ${count})`).join(" | ")
        : "No spare parts consumed in this interval";
      csvRows.push([`HARDWARE SPARE PARTS CONSUMED:`, sparesLine].map(escapeVal).join(","));
      
      csvRows.push([]); // Padding row
      csvRows.push([`S.No`, `Ticket ID`, `Created Date`, `School Campus`, `Building Block`, `Room/Class`, `Teacher/Staff Name`, `Contact Number`, `Urgency Level`, `Current Status`, `Issue Description`, `IT Technician Resolution Remarks`, `Date Fixed`].map(escapeVal).join(","));
    } else {
      const headers = [
        "S.No",
        "Ticket ID",
        "Created Date",
        "School Campus",
        "Building Block",
        "Room/Class",
        "Teacher/Staff Name",
        "Contact Number",
        "Urgency Level",
        "Current Status",
        "Issue Description",
        "IT Technician Resolution Remarks",
        "Date Fixed"
      ];
      csvRows.push(headers.map(escapeVal).join(","));
    }

    matchedReportTickets.forEach((tkt, idx) => {
      const roomString = tkt.linkedRoom || "";
      const branchPart = roomString.split(" - ")[0] || "Birla Open Minds International School";
      const roomLocation = roomString.indexOf(" - ") !== -1 
        ? roomString.substring(roomString.indexOf(" - ") + 3)
        : roomString;

      const row = [
        idx + 1,
        tkt.id,
        tkt.date,
        branchPart,
        tkt.building || "LB Nagar Branch",
        roomLocation,
        tkt.staffName || "-",
        tkt.mobile || "-",
        tkt.priority,
        tkt.status === "open" ? "Open (Active)" : tkt.status === "pending" ? "Pending (In Progress)" : "Resolved (Fixed)",
        tkt.actualIssue || tkt.issue,
        tkt.remarks || "-",
        tkt.fixedAt || tkt.resolvedAt || "-"
      ];
      csvRows.push(row.map(escapeVal).join(","));
    });

    const csvData = csvRows.join("\n");
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    
    const filePrefix = reportMode === "room" ? "BI_ROOM_REPORT_" : "BIRLA_Dashboard_Report_";
    link.download = `${filePrefix}${reportFromDate}_to_${reportToDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter & Search Tickets
  const displaySource = (activeFilter === "resolved-today" || activeFilter === "resolved-all") ? history : tickets;

  const filteredTickets = displaySource.filter((t) => {
    // Basic status match
    if (activeFilter === "resolved-today") {
      const cleanFixed = t.fixedAt?.replace(/\//g, "-") || "";
      if (!cleanFixed.startsWith(todayStr)) return false;
    } else if (activeFilter === "resolved-all") {
      if (historyDate) {
        // Assume fixedAt is stored like "DD-MM-YYYY, HH:MM" or similar formats.
        // We'll check if it matches the YYYY-MM-DD from historyDate
        // Note: JS input date gives YYYY-MM-DD. Need to format to DD-MM-YYYY to match local
        const parts = (historyDate || "").split("-");
        if (parts.length === 3) {
          const [year, month, day] = parts;
          const formattedDate = `${day}-${month}-${year}`;
          const cleanFixed = t.fixedAt?.replace(/\//g, "-") || "";
          if (!cleanFixed.startsWith(formattedDate)) return false;
        }
      }
    } else {
      const statusMatch = activeFilter === "all" || t.status === activeFilter;
      if (!statusMatch) return false;
    }

    if (!searchTerm.trim()) return true;
    const searchLow = searchTerm.toLowerCase();
    const b = t.building ? t.building.toLowerCase() : "";
    return (
      t.issue.toLowerCase().includes(searchLow) ||
      t.staffName.toLowerCase().includes(searchLow) ||
      t.mobile.toLowerCase().includes(searchLow) ||
      t.linkedRoom.toLowerCase().includes(searchLow) ||
      b.includes(searchLow) ||
      t.id.toLowerCase().includes(searchLow)
    );


    return (
      t.issue.toLowerCase().includes(searchLow) ||
      t.staffName.toLowerCase().includes(searchLow) ||
      t.mobile.toLowerCase().includes(searchLow) ||
      t.linkedRoom.toLowerCase().includes(searchLow) ||
      b.includes(searchLow) ||
      t.id.toLowerCase().includes(searchLow)
    );



    return (
      t.issue.toLowerCase().includes(searchLow) ||
      t.staffName.toLowerCase().includes(searchLow) ||
      t.mobile.toLowerCase().includes(searchLow) ||
      t.linkedRoom.toLowerCase().includes(searchLow) ||
      b.includes(searchLow) ||
      t.id.toLowerCase().includes(searchLow)
    );
  });

  const [ticketToPending, setTicketToPending] = useState<Ticket | null>(null);
  const [pendingRemarks, setPendingRemarks] = useState("");

  // Confirm Pending Action
  const confirmPending = () => {
    if (!ticketToPending) return;
    if (!pendingRemarks.trim()) {
      alert("Please provide the reason / remarks for putting the ticket on hold!");
      return;
    }

    const nowTimeStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    // Format remark with Date & Time: "• [30-05-2026 10:15 AM] PENDING: Waiting for spare RAM"
    const formattedPendingRemark = `• [${nowTimeStr}] PENDING: ${pendingRemarks.trim()}`;

    const updated = tickets.map((t) => {
      if (t.id === ticketToPending.id) {
        let newRemarks = formattedPendingRemark;
        if (t.remarks) {
          newRemarks = `${formattedPendingRemark}\n${t.remarks}`;
        }
        return {
          ...t,
          status: "pending" as const,
          remarks: newRemarks
        };
      }
      return t;
    });

    updateTickets(updated);
    setTicketToPending(null);
    setPendingRemarks("");
  };

  // Open Resolve Overlay
  const openResolvePopup = (ticket: Ticket) => {
    setTicketToResolve(ticket);
    setSelectedRoom(ticket.linkedRoom);
    setSelectedTechnician("Admin");
    setSelectedInventoryItem("None");
    setHardwareQty(1);
    setRemarks("");
  };

  // Confirm Resolve action
  const confirmResolve = () => {
    if (!ticketToResolve) return;
    if (selectedTechnician === "Select Technician" || !selectedTechnician) {
      alert("Please select a valid technician!");
      return;
    }

    const nowTimeStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    // Inventory Reduction & Allocation auto logging
    let updatedInventory = [...inventory];
    let hwNote = "None";
    let updatedAllocations = [...allocations];

    if (selectedInventoryItem !== "None") {
      const invIdx = updatedInventory.findIndex(i => i.id === selectedInventoryItem);
      if (invIdx !== -1) {
        const item = updatedInventory[invIdx];
        if (hardwareQty > item.balanceQty) {
          alert(`Not enough stock! Only ${item.balanceQty} units available.`);
          return;
        }

        // Deduct quantity
        const newUsed = item.usedQty + hardwareQty;
        const newBalance = item.totalQty - newUsed;
        const logEntry = `• [${nowTimeStr}] 🔧 Deducted ${hardwareQty} unit(s) for Ticket ${ticketToResolve.id} at ${selectedRoom}`;
        
        updatedInventory[invIdx] = {
          ...item,
          usedQty: newUsed,
          balanceQty: newBalance,
          logs: `${logEntry}\n${item.logs}`
        };
        hwNote = `${item.itemName} (x${hardwareQty})`;

        // Resolve exact Building and Room values from selectedRoom to avoid "LB Nagar Branch" or "General Area" fallbacks
        const rObj = rooms.find(r => {
          const str = `${r.school} - ${r.dept} - ${r.roomNumber} (${r.className})`;
          return str === selectedRoom;
        });

        const allocationBuilding = rObj?.building || ticketToResolve.building || "LB Nagar Branch";
        const allocationRoomText = rObj 
          ? `${rObj.roomNumber} (${rObj.className})` 
          : (selectedRoom === "No Room Link" ? "General Area" : selectedRoom);

        // Generate deployment log to core allocations list
        const newAllocId = `EMP-AST-TKT-${Date.now().toString().slice(-6)}`;
        const ticketAllocation: EmployeeAllocation = {
          id: newAllocId,
          empName: ticketToResolve.staffName.trim().toUpperCase(),
          itemName: item.itemName,
          invId: selectedInventoryItem,
          qty: hardwareQty,
          remarks: `Resolved Ticket ${ticketToResolve.id} | Tech: ${selectedTechnician} | Remarks: ${remarks || "No remarks"}`,
          assignedOn: nowTimeStr,
          status: "Active" as const,
          building: allocationBuilding,
          room: allocationRoomText
        };

        updatedAllocations = [ticketAllocation, ...updatedAllocations];
      }
    }

    // Add to Room Logs
    let updatedRooms = [...rooms];
    if (selectedRoom !== "No Room Link") {
      const roomIdx = updatedRooms.findIndex(r => {
        const fullString = `${r.school} - ${r.dept} - ${r.roomNumber} (${r.className})`;
        return fullString === selectedRoom;
      });

      if (roomIdx !== -1) {
        const roomObj = updatedRooms[roomIdx];
        const newLog = `• [${nowTimeStr}] RESOLVED: ${ticketToResolve.actualIssue} | Tech: ${selectedTechnician} | HW: ${hwNote} | Notes: ${remarks}`;
        updatedRooms[roomIdx] = {
          ...roomObj,
          hwLogs: `${newLog}\n${roomObj.hwLogs}`
        };
      }
    }

    // Resolve details
    const resolvedRemarks = `Tech: ${selectedTechnician} | HW: ${hwNote} | Notes: ${remarks || "No remarks"}`;
    const historicalTkt: Ticket = {
      ...ticketToResolve,
      status: "resolved",
      fixedAt: nowTimeStr,
      remarks: resolvedRemarks,
      linkedRoom: selectedRoom
    };

    // Remove from active lists
    const updatedTickets = tickets.filter(t => t.id !== ticketToResolve.id);
    const updatedHistory = [historicalTkt, ...history];

    updateTickets(updatedTickets, updatedHistory, updatedInventory, updatedRooms, updatedAllocations);
    setTicketToResolve(null);
  };

  // Priority Styles mapping
  const renderExecutivePrintContent = () => (
    <>
      {/* Print Sheet Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-4 border-slate-900 pb-6 gap-4 text-left">
        <div className="flex items-center gap-4">
          {!logoError ? (
            <img 
              src="/src/assets/images/it_pwa_icon_1779779538581.png" 
              alt="Birla Logo" 
              className="w-16 h-16 rounded-full border border-slate-300 object-contain bg-white shrink-0 font-sans" 
            />
          ) : (
            <div className="w-16 h-16 rounded-xl border-4 border-slate-900 bg-orange-500 flex flex-col items-center justify-center shrink-0 p-1 font-sans">
              <span className="font-sans font-black text-white text-2xl">BI</span>
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 font-sans uppercase m-0 leading-none">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</h1>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#F97316] m-0 mt-2 font-sans">IT DEPT — DIGITAL SERVICE DESK LOGBOOK</p>
          </div>
        </div>
        
        <div className="text-left sm:text-right text-slate-900">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block m-0 font-sans">REPORT COMPILED AT:</span>
          <span className="text-sm font-black font-mono block text-slate-950 m-0">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 mt-2 inline-block font-sans">SYSTEM VERIFIED: ACTIVE</span>
        </div>
      </div>

      {/* Scope Metadata Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs text-slate-800 text-left">
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">DATE INTERVAL:</span>
          <strong className="text-slate-900 font-mono text-xs">{reportFromDate} to {reportToDate}</strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">REPORTING MODE:</span>
          <strong className="text-slate-900 text-xs sm:text-xs uppercase font-sans">
            {reportMode === "date" ? "Global System Audit" : "Building/Room Spatial Audit"}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">STATUS FILTER SCOPE:</span>
          <strong className="text-slate-900 text-xs uppercase font-sans">
            {reportStatusFilter === "All" ? "ALL NETWORK LOCATIONS" : reportStatusFilter}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">TICKETS INCLUSION:</span>
          <strong className="text-slate-900 text-xs uppercase font-sans">{matchedReportTickets.length} LOGS IN VIEW</strong>
        </div>
      </div>

      {/* Main Datatable */}
      <div className="overflow-hidden border border-slate-300 rounded-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1e293b] text-white">
            <tr>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">ID / Timestamp</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">Issue Description / Remarks</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">Location / Requester</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8] text-right">Priority / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {matchedReportTickets.map((t, idx) => (
              <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="py-2.5 px-1.5 font-mono text-[10px] text-slate-900">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                    {(t.id || "").split('-')[1] || t.id}
                  </span>
                  <br />
                  <span className="text-slate-500 tracking-tight ml-3">{t.date}</span>
                </td>
                <td className="py-2.5 px-1.5 align-top">
                  <div className="text-xs font-bold text-slate-900 font-sans whitespace-normal max-w-sm line-clamp-2">{t.issue}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 whitespace-normal max-w-sm">
                    {t.remarks ? t.remarks : "No resolution remarks."}
                  </div>
                </td>
                <td className="py-2.5 px-1.5 font-sans">
                  <div className="text-xs font-bold text-slate-900">
                    {t.building === "LB Nagar Branch" ? "NB" : "OB"}: {t.linkedRoom}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t.staffName} ({t.mobile})</div>
                </td>
                <td className="py-2.5 px-1.5 text-right font-black uppercase text-[10px]">
                  <span className={`inline-block px-1.5 py-0.5 rounded font-sans ${
                    t.priority === "High" ? "text-red-700 bg-red-50" : t.priority === "Medium" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
                  }`}>
                    {t.priority}
                  </span>
                </td>
                <td className="py-2.5 px-1.5 text-right font-black uppercase text-[10px]">
                  <span className={`inline-block px-1.5 py-0.5 rounded font-sans ${
                    t.status === "open" ? "text-amber-700 bg-amber-50" : t.status === "pending" ? "text-orange-700 bg-orange-50" : "text-emerald-700 bg-emerald-50"
                  }`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PDF Signatures section */}
      <div className="grid grid-cols-2 gap-12 pt-16">
        <div className="text-center">
          <div className="border-t border-slate-900 pt-2 text-slate-900">
            <span className="text-xs font-extrabold uppercase tracking-wider block font-sans">IT SERVICE DESK MANAGER</span>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 m-0">Birla Open Minds International School Campus Authority</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-900 pt-2 text-slate-900">
            <span className="text-xs font-extrabold uppercase tracking-wider block font-sans">AUTHORIZED SYSTEM AUDITOR</span>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 m-0">BI IT Technical Committee</p>
          </div>
        </div>
      </div>
    </>
  );
  const priorityMap = {
    High: { border: "border-l-rose-500", text: "text-rose-600", bg: "bg-rose-50", badge: "🔴 HIGH" },
    Medium: { border: "border-l-amber-500", text: "text-amber-600", bg: "bg-amber-50", badge: "🟡 MEDIUM" },
    Low: { border: "border-l-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50", badge: "🟢 LOW" }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      id="dashboard-tab" 
      className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-8 overflow-y-auto w-full custom-scrollbar"
    >
      
      {/* Header bar */}
      <div className="flex flex-col items-center justify-center text-center pb-6 border-b border-slate-200 dark:border-slate-800 w-full gap-4">
        <div className="flex flex-col items-center gap-3.5 w-full">
          {/* Logo and school name */}
          <div className="flex flex-row items-center justify-center pointer-events-none">
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Birla Open Minds International School Logo" 
              referrerPolicy="no-referrer"
              className="h-24 md:h-32 w-auto object-contain" 
            />
          </div>

          {/* Centered console title banner */}
          <div className="text-center flex flex-col items-center justify-center">
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1 text-xs font-black tracking-wider bg-amber-500/10 dark:bg-amber-500/5 px-5 py-2 rounded-full border border-amber-500/20 text-[#F97316] dark:text-amber-400">
              <span>⚡ IT SERVICE CONSOLE:</span>
              <span className="uppercase text-slate-800 dark:text-slate-100">📊 MANAGEMENT OVERVIEW & DIAGNOSTICS</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-3.5 flex-wrap w-full">
          <div className="px-4 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sync Time: {new Date().toLocaleTimeString()} (UTC)
          </div>
          <button
            onClick={() => {
              if (onNavigateTab) onNavigateTab("google-drive");
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg border border-blue-500/30 text-xs font-extrabold shadow-md hover:shadow-lg transition-all active:scale-95 duration-150 cursor-pointer uppercase tracking-wider"
            title="Open 5 TB Google Drive Cloud Hub"
          >
            <span>☁️</span>
            Google Drive (5 TB Vault)
          </button>
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-lg border border-[#EA580C]/20 text-xs font-extrabold shadow-md hover:shadow-lg transition-all active:scale-95 duration-150 cursor-pointer uppercase tracking-wider"
            title="Force refresh entire school dashboard and check for newly deployed master updates"
          >
            <span>🔄</span>
            Refresh App Deployed Updates
          </button>
        </div>
      </div>
      
      {/* Top Cards Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-8"
      >
        
        {/* Active Tickets Card */}
        <div 
          onClick={() => {
            setReportFromDate("2020-01-01");
            setReportToDate(getTodayString());
            setReportStatusFilter("open");
            setReportQueryTitle("Active Tickets Logbook");
            setShowQuickReportModal(true);
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-250 dark:border-slate-700 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] duration-200 cursor-pointer border-t-8 border-t-[#D69E2E] flex flex-col justify-between h-44 relative overflow-hidden group hover:border-[#D69E2E]"
          title="Click to generate dates-wise reports for Active Tickets"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-[#D69E2E]">
                <Pin size={18} className="animate-pulse" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active Tickets</span>
            </div>
            <Calendar size={14} className="text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-[#D69E2E] transition-all" />
          </div>
          <div className="text-5xl font-black text-[#D69E2E] tracking-tight font-mono my-2">
            {String(activeTicketsCount).padStart(2, "0")}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50/50 dark:bg-amber-950/40 py-1 px-2.5 rounded-md inline-block">
              Requires Immediate Assistance
            </div>
            <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all font-mono">GENERATE REPORT ➔</span>
          </div>
        </div>

        {/* Pending Card */}
        <div 
          onClick={() => {
            setReportFromDate("2020-01-01");
            setReportToDate(getTodayString());
            setReportStatusFilter("pending");
            setReportQueryTitle("Pending Tasks Logbook");
            setShowQuickReportModal(true);
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-250 dark:border-slate-700 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] duration-200 cursor-pointer border-t-8 border-t-[#ED8936] flex flex-col justify-between h-44 relative overflow-hidden group hover:border-[#ED8936]"
          title="Click to generate dates-wise reports for Pending Tasks"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 rounded-lg text-[#ED8936]">
                <Hourglass size={18} className="animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Pending Tasks</span>
            </div>
            <Calendar size={14} className="text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-[#ED8936] transition-all" />
          </div>
          <div className="text-5xl font-black text-[#ED8936] tracking-tight font-mono my-2">
            {String(pendingCount).padStart(2, "0")}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold bg-orange-50/50 dark:bg-orange-950/40 py-1 px-2.5 rounded-md inline-block">
              Awaiting Spares/Access
            </div>
            <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all font-mono">GENERATE REPORT ➔</span>
          </div>
        </div>

        {/* Fixed Today */}
        <div 
          onClick={() => {
            setReportFromDate(getTodayString());
            setReportToDate(getTodayString());
            setReportStatusFilter("resolved");
            setReportQueryTitle("Tickets Solved Today");
            setShowQuickReportModal(true);
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-250 dark:border-slate-700 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] duration-200 cursor-pointer border-t-8 border-t-[#38A169] flex flex-col justify-between h-44 relative overflow-hidden group hover:border-[#38A169]"
          title="Click to generate dates-wise reports for Tickets Resolved Today"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-[#f0fff4] dark:bg-emerald-900/30 rounded-lg text-[#38A169]">
                <Zap size={18} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Fixed Today</span>
            </div>
            <Calendar size={14} className="text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-[#38A169] transition-all" />
          </div>
          <div className="text-5xl font-black text-[#38A169] tracking-tight font-mono my-2">
            {String(fixedTodayCount).padStart(2, "0")}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-[#e6fffa] dark:bg-emerald-950/40 py-1 px-2.5 rounded-md inline-block">
              System Health Restored
            </div>
            <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all font-mono">GENERATE REPORT ➔</span>
          </div>
        </div>

        {/* Total Resolved */}
        <div 
          onClick={() => {
            setReportFromDate("2020-01-01");
            setReportToDate(getTodayString());
            setReportStatusFilter("resolved");
            setReportQueryTitle("Total Solved Logbook (All Time)");
            setShowQuickReportModal(true);
          }}
          className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-250 dark:border-slate-700 shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] duration-200 cursor-pointer border-t-8 border-t-[#3182CE] flex flex-col justify-between h-44 relative overflow-hidden group hover:border-[#3182CE]"
          title="Click to generate dates-wise reports for All-Time Fixed Tickets"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg text-[#3182CE]">
                <Trophy size={18} />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total Fixed</span>
            </div>
            <Calendar size={14} className="text-slate-400 opacity-40 group-hover:opacity-100 group-hover:text-[#3182CE] transition-all" />
          </div>
          <div className="text-5xl font-black text-[#3182CE] tracking-tight font-mono my-2">
            {String(totalFixedCount).padStart(2, "0")}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold bg-blue-50/50 dark:bg-blue-950/40 py-1 px-2.5 rounded-md inline-block">
              All-Time Solved Logbook
            </div>
            <span className="text-[9px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-all font-mono">GENERATE REPORT ➔</span>
          </div>
        </div>

      </motion.div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
        
        {/* Category segment selectors */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            onClick={() => { setActiveFilter("all"); setHistoryDate(""); }}
            className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeFilter === "all" ? "bg-[#1E293B] text-white shadow" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            All Live Tickets
          </button>
          <button
            onClick={() => { setActiveFilter("open"); setHistoryDate(""); }}
            className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeFilter === "open" ? "bg-[#1E293B] text-white shadow" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            Strictly Active
          </button>
          <button
            onClick={() => { setActiveFilter("pending"); setHistoryDate(""); }}
            className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeFilter === "pending" ? "bg-[#1E293B] text-white shadow" : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
          >
            Pending List
          </button>
          <button
            onClick={() => { setActiveFilter("resolved-today"); setHistoryDate(""); }}
            className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              activeFilter === "resolved-today" ? "bg-[#38A169] text-white shadow" : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            }`}
          >
            Fixed Today
          </button>
          <button
            onClick={() => setActiveFilter("resolved-all")}
            className={`px-3 py-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${
              activeFilter === "resolved-all" ? "bg-[#3182CE] text-white shadow" : "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            }`}
          >
            Total Fixed (History)
          </button>
        </div>

        {/* Searching & Calendar bar */}
        <div className="flex w-full md:w-auto gap-2">
          {activeFilter === "resolved-all" && (
            <div className="w-full md:w-auto relative flex items-center shrink-0 gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="pl-3 pr-2 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm text-slate-800 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 font-semibold"
                title="Select Date to filter history"
              />
              {historyDate && (
                <button
                  onClick={() => setHistoryDate("")}
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-450 hover:text-rose-700 transition-all shadow-sm flex items-center justify-center"
                  title="Clear active date filter"
                  id="btn-clear-date"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          )}

          <div className="relative w-full md:w-64 lg:w-80 flex">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by issue, staff mobile, room..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-950 rounded-lg text-sm text-slate-800 dark:text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

      </div>

      {/* Live Ticket Desk table / feed */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 mt-6 shadow-sm flex-1 flex flex-col min-h-[350px]">
        
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center rounded-t-xl">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm tracking-wide">
            {activeFilter === "resolved-all" || activeFilter === "resolved-today" ? "📜 HISTORY LOGBOOK QUEUE" : "📋 LIVE TICKETS WORK QUEUE"}
          </h3>
          <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-900 rounded text-slate-500 dark:text-slate-400 font-mono">
            {filteredTickets.length} Found
          </span>
        </div>

        <div className="p-4 space-y-3.5 flex-1 overflow-y-auto max-h-[500px] custom-scrollbar">
          {(() => {
            const isHistoryActive = activeFilter === "resolved-today" || activeFilter === "resolved-all";
            const sortedTickets = [...filteredTickets].sort((a, b) => {
              if (isHistoryActive) {
                const timeA = parseTicketDateToTimestamp(a.fixedAt || a.date);
                const timeB = parseTicketDateToTimestamp(b.fixedAt || b.date);
                return timeB - timeA; // Descending for history (latest first)
              } else {
                const timeA = parseTicketDateToTimestamp(a.date);
                const timeB = parseTicketDateToTimestamp(b.date);
                return timeA - timeB; // Chronological ascending for active/pending
              }
            });

            if (sortedTickets.length === 0) {
              return (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <AnimatedNoTickets size="w-32 h-32" />
                  
                  
                </div>
              );
            }

            return sortedTickets.map((t, index) => {
              const styles = priorityMap[t.priority] || priorityMap.Medium;
              const serialNo = index + 1;
              return (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  key={t.id} 
                  className={`bg-white dark:bg-slate-900 border-l-4 ${styles.border} border border-slate-200/80 dark:border-slate-700 rounded-lg p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:shadow-md transition-shadow`}
                >
                  <div className="flex-1 space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 font-mono">
                        S.No: {serialNo} | {t.id}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded ${styles.bg} ${styles.text} dark:bg-opacity-20`}>
                        {styles.badge}
                      </span>
                      {t.status === "pending" && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 uppercase tracking-wider">
                          ⏳ PENDING
                        </span>
                      )}
                      {t.status === "resolved" && (
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                          ✅ RESOLVED
                        </span>
                      )}
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded flex items-center gap-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
                        🏢 LB Nagar Branch
                      </span>
                    </div>

                    <h4 className="font-sans font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight leading-snug">
                      {t.issue}
                    </h4>

                    <div className="flex flex-wrap items-center text-xs text-slate-500 gap-x-4 gap-y-1.5 font-medium">
                      <span>👤 Staff: {t.staffName}</span>
                      <span>🏫 Branch: {(t.linkedRoom || "").split(" - ")[0]}</span>
                      <span>🚪 Room: {(t.linkedRoom || "").split(" - ").slice(1).join(" - ")}</span>
                      <span>📞 Mobile: {t.mobile}</span>
                      <span>📅 Date: {t.date}</span>
                      {(t.status === "resolved" && t.fixedAt) && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold border-l pl-2">Resolved: {t.fixedAt}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2 mt-2 xl:mt-0">
                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 hover:border-blue-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Eye size={14} />
                      VIEW
                    </button>
                    {t.status !== "pending" && t.status !== "resolved" && (
                      <button
                        onClick={() => {
                          setTicketToPending(t);
                          setPendingRemarks("");
                        }}
                        className="px-3.5 py-2 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 dark:hover:bg-orange-900/60 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-extrabold tracking-wide transition-colors cursor-pointer"
                      >
                        PENDING
                      </button>
                    )}
                    {t.status !== "resolved" && (
                      <button
                        onClick={() => openResolvePopup(t)}
                        className="px-4 py-2 bg-[#38A169] hover:bg-emerald-600 text-white rounded-lg text-xs font-extrabold tracking-wide shadow-sm transition-colors cursor-pointer"
                      >
                        RESOLVE ✅
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            });
          })()}
        </div>
      </div>

      {/* POPUP 1: TICKET DETAIL VIEW */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-[#1E293B] dark:bg-slate-950 text-white">
              <h3 className="font-bold text-lg">Ticket Detail Workspace</h3>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="hover:bg-slate-700/60 p-1.5 rounded-lg text-slate-300 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 text-sm text-slate-850 dark:text-slate-200">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-750 font-medium">
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Ticket ID</label>
                  <span className="text-slate-800 dark:text-slate-100 font-mono font-bold text-sm">{selectedTicket.id}</span>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Priority</label>
                  <span className={`font-bold uppercase text-xs ${
                    selectedTicket.priority === "High" ? "text-rose-600 dark:text-rose-400" : selectedTicket.priority === "Medium" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}>{selectedTicket.priority}</span>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-0.5 font-sans font-bold font-sans">Created Date</label>
                  <span className="text-slate-800 dark:text-slate-100 font-bold">{selectedTicket.date}</span>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 dark:text-slate-400 uppercase tracking-widest block mb-0.5 font-bold">Status</label>
                  <span className="text-slate-800 dark:text-slate-100 font-bold capitalize">{selectedTicket.status}</span>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 dark:text-slate-400 uppercase tracking-wider block mb-1 font-bold">Reported Issue</label>
                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-750 font-semibold text-slate-800 dark:text-slate-100 leading-relaxed text-sm select-text">
                  {selectedTicket.issue}
                </div>
              </div>

               <div className="space-y-2 border-t pt-4 border-slate-100 dark:border-slate-850">
                <div className="flex justify-between">
                  <span className="text-slate-450 dark:text-slate-400 font-medium">Staff Name:</span>
                  <span className="font-bold text-slate-805 dark:text-slate-100">{selectedTicket.staffName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450 dark:text-slate-400 font-medium">Staff Mobile:</span>
                  <span className="font-bold text-slate-805 dark:text-slate-100 font-mono">{selectedTicket.mobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450 dark:text-slate-400 font-medium">Building Block:</span>
                  <span className="font-extrabold px-2 py-0.5 rounded text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {selectedTicket.building || "LB Nagar Branch"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-450 dark:text-slate-400 font-medium font-sans">Compartment Location:</span>
                  <span className="font-bold text-slate-805 dark:text-slate-100">{selectedTicket.linkedRoom}</span>
                </div>
                {selectedTicket.remarks && (
                  <div className="mt-4 p-4 rounded-xl bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/35 font-sans space-y-1.5 text-left">
                    <p className="text-[10px] text-orange-700 dark:text-orange-400 font-serif font-black uppercase tracking-wider">
                      📝 LOG DETAILS & STATUS REMARKS:
                    </p>
                    <p className="text-xs text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed select-text font-semibold bg-white dark:bg-slate-900 p-3 rounded-lg border border-orange-100/40 dark:border-orange-900/10">
                      {selectedTicket.remarks}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
                title="Generate physical or PDF Work Order for repairs"
              >
                <Printer size={15} />
                <span>Print Work Order</span>
              </button>
              <button
                onClick={() => setSelectedTicket(null)}
                className="px-5 py-2.5 bg-[#1E293B] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Okay, Closed Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 2: WORK RESOLVE INTERFACE WITH DYNAMIC INVENTORY DEDUCTION */}
      {ticketToResolve && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-8">
            
            <div className="p-6 border-b border-indigo-100 dark:border-slate-800 flex justify-between items-center bg-[#10B981] dark:bg-emerald-800 text-white rounded-t-2xl">
              <div>
                <h3 className="font-bold text-lg">🔧 Ticket Resolution Desk</h3>
                <p className="text-[11px] text-emerald-100 dark:text-emerald-200 font-medium">Auto inventory linkage mechanism enabled</p>
              </div>
              <button 
                onClick={() => setTicketToResolve(null)}
                className="hover:bg-emerald-700 dark:hover:bg-emerald-900 p-1.5 rounded-lg text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-sm text-slate-800 dark:text-slate-200">
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl space-y-1">
                <p className="text-xs text-emerald-750 dark:text-emerald-400 font-bold font-mono">Resolving Ticket: {ticketToResolve.id}</p>
                <p className="font-bold text-slate-800 dark:text-slate-100 text-sm select-text">{ticketToResolve.issue}</p>
              </div>

              {/* Verify Location */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  1. Verify Work Location
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full py-2.5 px-3 border border-slate-200 dark:border-slate-750 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="No Room Link">No Room Link</option>
                  {rooms.map((r) => {
                    const str = `${r.school} - ${r.dept} - ${r.roomNumber} (${r.className})`;
                    return (
                      <option key={r.id} value={str}>
                        {str}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Technician selection */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  2. Assigned Technician
                </label>
                <select
                  value={selectedTechnician}
                  onChange={(e) => setSelectedTechnician(e.target.value)}
                  className="w-full py-2.5 px-3 border border-slate-200 dark:border-slate-750 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {savedTechs.map((t: string) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Dynamic inventory link */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  3. Hardware Spares Consumed (Live Stock Link)
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedInventoryItem}
                    onChange={(e) => setSelectedInventoryItem(e.target.value)}
                    className="flex-1 py-2.5 px-3 border border-slate-200 dark:border-slate-750 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="None">None (No hardware inventory spares consumed)</option>
                    {inventory.map((item) => (
                      <option key={item.id} value={item.id} disabled={item.balanceQty <= 0}>
                        {item.itemName} (In stock: {item.balanceQty} units)
                      </option>
                    ))}
                  </select>

                  {selectedInventoryItem !== "None" && (
                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        max={(inventory.find(i => i.id === selectedInventoryItem)?.balanceQty) || 1}
                        value={hardwareQty}
                        onChange={(e) => setHardwareQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full py-2.5 px-2 border border-slate-200 dark:border-slate-750 rounded-lg text-sm text-center bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-450 mt-1 font-medium">
                  Assigning inventory auto-deducts master stock balances and updates audit logs.
                </p>
              </div>

              {/* Actions Taken Notes */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  4. Actions Taken / Technical remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="E.g. Swapped bad filter, re-crimping patch cord..."
                  rows={3}
                  className="w-full p-3 border border-slate-200 dark:border-slate-750 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setTicketToResolve(null)}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-150 dark:hover:bg-slate-705 text-slate-600 dark:text-slate-350 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmResolve}
                className="px-5 py-2.5 bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-extrabold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                CONFIRM RESOLUTION & DEPLOY
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POPUP 3: MARK PENDING INTERFACE WITH REASON/REMARKS */}
      {ticketToPending && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-6 border-b border-orange-100/40 dark:border-slate-800 flex justify-between items-center bg-orange-600 text-white leading-none">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <span>⏳ Move to Pending Status</span>
                </h3>
                <p className="text-[11px] text-orange-100 font-medium mt-1">Please record comments explaining why work is put on hold</p>
              </div>
              <button 
                onClick={() => setTicketToPending(null)}
                className="hover:bg-orange-700 p-1.5 rounded-lg text-orange-100 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-slate-800 dark:text-slate-200">
              <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 rounded-xl space-y-1">
                <p className="text-xs text-orange-700 dark:text-orange-400 font-bold font-mono">Pending Ticket ID: {ticketToPending.id}</p>
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm select-text">{ticketToPending.issue}</p>
                <div className="pt-2 text-[11px] text-slate-500/90 dark:text-slate-400 font-medium flex gap-x-4">
                  <span>👤 Staff: {ticketToPending.staffName}</span>
                  <span>📞 Mobile: {ticketToPending.mobile}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex justify-between">
                  <span>Write Reason for Pending / On-Hold</span>
                  <span className="text-slate-400 text-[10px] font-normal italic font-mono">Date & Time will be auto-stamped</span>
                </label>
                <textarea
                  value={pendingRemarks}
                  onChange={(e) => setPendingRemarks(e.target.value)}
                  placeholder="E.g. Waiting for components from vendor / Wi-Fi adapter out of stock..."
                  rows={4}
                  className="w-full p-3.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setTicketToPending(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg cursor-pointer"
              >
                Cancel Action
              </button>
              <button
                type="button"
                onClick={confirmPending}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                CONFIRM AS PENDING ⏳
              </button>
            </div>

          </div>
        </div>
      )}

      {/* React Portal to inject printable ticket directly under body for seamless native browser print flow */}
      {selectedTicket && createPortal(
        <div id="print-work-order-root" className="bg-white text-slate-900 p-8 leading-relaxed">
          <div className="max-w-3xl mx-auto space-y-8">
            
            {/* Document Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-950 pb-6">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">BI IT HELP DESK</h1>
                <p className="text-xs uppercase tracking-widest text-slate-500 font-bold mt-1">Official IT Repair Work Order</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-slate-900 block font-mono">ORDER ID: {selectedTicket.id}</span>
                <span className="inline-block mt-2 text-xs font-black bg-slate-950 text-white px-3 py-1 rounded">
                  PRIORITY: {selectedTicket.priority.toUpperCase()}
                </span>
              </div>
            </div>

            {/* General Meta Grid */}
            <div className="grid grid-cols-2 gap-6 my-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wider block mb-1">LOGGED DATE</span>
                <span className="text-sm font-bold text-slate-900">{selectedTicket.date}</span>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-450 tracking-wider block mb-1">TICKET STATUS</span>
                <span className="text-sm font-bold text-slate-900 capitalize">{selectedTicket.status}</span>
              </div>
            </div>

            {/* Detailed Reported Issue block */}
            <div className="bg-slate-50 border-l-4 border-slate-950 p-6 rounded-r-xl">
              <span className="text-xs text-slate-950 font-black uppercase tracking-wider block mb-2">Reported Work Request Description</span>
              <p className="text-slate-900 font-bold text-base leading-relaxed whitespace-pre-wrap select-text">{selectedTicket.issue}</p>
            </div>

            {/* Particular Table details */}
            <div className="space-y-4 pt-4">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-450 border-b-2 border-slate-100 pb-2">Assignment and Location Particulars</h3>
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-dashed border-slate-200">
                    <td className="py-3 text-slate-500 font-semibold text-left">Requesting Staff Member</td>
                    <td className="py-3 text-right font-black text-slate-950">{selectedTicket.staffName}</td>
                  </tr>
                  <tr className="border-b border-dashed border-slate-200">
                    <td className="py-3 text-slate-500 font-semibold text-left">Contact Mobile Line</td>
                    <td className="py-3 text-right font-mono font-bold text-slate-900">{selectedTicket.mobile}</td>
                  </tr>
                  <tr className="border-b border-dashed border-slate-200">
                    <td className="py-3 text-slate-500 font-semibold text-left">Corporate Building Block</td>
                    <td className="py-3 text-right font-black text-slate-950">{selectedTicket.building || "LB Nagar Branch"}</td>
                  </tr>
                  <tr className="border-b border-dashed border-slate-200">
                    <td className="py-3 text-slate-500 font-semibold text-left">Compartment Location Link</td>
                    <td className="py-3 text-right font-black text-slate-950">{selectedTicket.linkedRoom}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Technical logs or Remarks if present */}
            {selectedTicket.remarks && (
              <div className="space-y-3 pt-4">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-450 border-b-2 border-slate-100 pb-2">Technical Repair Logs & Status remarks</h3>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-[10px] text-amber-850 font-black uppercase tracking-wider block mb-1.5">Action Comments Activity Trail</span>
                  <p className="text-xs font-semibold text-amber-955 whitespace-pre-wrap leading-relaxed select-text bg-white p-3 rounded-lg border border-amber-200/50">{selectedTicket.remarks}</p>
                </div>
              </div>
            )}

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-12 pt-16">
              <div className="text-center">
                <div className="border-t-2 border-slate-400 pt-3">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">IT Engineer Signature</span>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t-2 border-slate-400 pt-3">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Requesting Staff Signature</span>
                </div>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* ========================================== */}
      {/* CALENDAR-WISE QUICK REPORTS INTERACTIVE MODAL */}
      {/* ========================================== */}
      {showQuickReportModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 my-8">
            
            {/* Modal Title Banner */}
            <div className="p-6 border-b border-blue-100 dark:border-slate-800 flex justify-between items-center bg-blue-600 dark:bg-blue-800 text-white rounded-t-2xl border-none">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 animate-pulse" />
                <div className="text-left">
                  <h3 className="font-bold text-lg leading-tight text-white m-0">📅 DATES-WISE IT SERVICE REPORT BUILDER</h3>
                  <p className="text-[11px] text-blue-100 dark:text-blue-200 font-bold font-mono uppercase m-0 mt-0.5">
                    SCOPE: {reportQueryTitle || "Custom Search Filter"}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowQuickReportModal(false)}
                className="hover:bg-blue-700 dark:hover:bg-blue-900 p-1.5 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body Contents */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
              
              {/* Report Module Tab Selectors */}
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setReportMode("date")}
                  className={`flex-1 pb-3 text-center text-xs font-black uppercase tracking-wider border-b-4 transition-all ${
                    reportMode === "date"
                      ? "border-blue-600 text-blue-600 dark:text-blue-500"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  📅 DATES & STATUS LOGBOOK
                </button>
                <button
                  type="button"
                  onClick={() => setReportMode("room")}
                  className={`flex-1 pb-3 text-center text-xs font-black uppercase tracking-wider border-b-4 transition-all ${
                    reportMode === "room"
                      ? "border-blue-600 text-blue-600 dark:text-blue-500"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-350"
                  }`}
                >
                  🏢 CLASSROOM-WISE SERVICE AUDIT
                </button>
              </div>

              {/* Classroom filter inputs if room mode */}
              {reportMode === "room" && (
                <div className="p-5 bg-orange-50/40 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/40 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-6 text-left animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Select Building block */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-sans">
                      🏫 Choose Building Block:
                    </label>
                    <select
                      value={selectedReportBuilding}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setSelectedReportBuilding(val);
                        // Reset room to All to prevent mismatch
                        setSelectedReportRoom("All");
                      }}
                      className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Buildings / Compartments Combined</option>
                      <option value="LB Nagar Branch">LB Nagar Branch</option>

                    </select>
                  </div>

                  {/* Select Room inside block */}
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-sans">
                      🚪 Choose Classroom / Compartment:
                    </label>
                    <select
                      value={selectedReportRoom}
                      onChange={(e) => setSelectedReportRoom(e.target.value)}
                      className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                    >
                      <option value="All">All Rooms Combined</option>
                      {rooms
                        .filter(r => selectedReportBuilding === "All" || r.building === selectedReportBuilding)
                        .map(r => {
                          const str = `${r.school} - ${r.dept} - ${r.roomNumber} (${r.className})`;
                          return (
                            <option key={r.id} value={str}>
                              [LB Nagar Branch] {r.roomNumber} - {r.className}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              )}

              {/* Active Date Query Inputs and Preset selectors */}
              <div className="p-5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-end text-left">
                
                {/* From Date input */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-sans">
                    📅 Date From:
                  </label>
                  <input
                    type="date"
                    value={reportFromDate}
                    onChange={(e) => setReportFromDate(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* To Date input */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-sans">
                    📅 Date To:
                  </label>
                  <input
                    type="date"
                    value={reportToDate}
                    onChange={(e) => setReportToDate(e.target.value)}
                    className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Status selector mapping */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 font-sans">
                    🏷️ Service Request Status:
                  </label>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value as any)}
                    className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="All">All Statuses (Combined)</option>
                    <option value="open">Open (Active Tasks)</option>
                    <option value="pending">Pending (On-Hold)</option>
                    <option value="resolved">Resolved (Fixed Tickets)</option>
                  </select>
                </div>

              </div>

              {/* Quick Presets row */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none">
                  ⚡ Calendar Presets:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setReportFromDate(getTodayString());
                    setReportToDate(getTodayString());
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-extrabold rounded-md border border-slate-200 dark:border-slate-750 transition-all shadow-sm cursor-pointer"
                >
                  Today Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportFromDate(getPastDateString(7));
                    setReportToDate(getTodayString());
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-extrabold rounded-md border border-slate-200 dark:border-slate-750 transition-all shadow-sm cursor-pointer"
                >
                  Last 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportFromDate(getFirstOfDayOfCurrentMonthString());
                    setReportToDate(getTodayString());
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-extrabold rounded-md border border-slate-200 dark:border-slate-750 transition-all shadow-sm cursor-pointer"
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportFromDate("2026-01-01");
                    setReportToDate(getTodayString());
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-extrabold rounded-md border border-slate-200 dark:border-slate-750 transition-all shadow-sm cursor-pointer"
                >
                  Year-to-date (2026)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReportFromDate("2020-01-01");
                    setReportToDate(getTodayString());
                  }}
                  className="px-3 py-1 bg-slate-100 hover:bg-blue-100 dark:bg-slate-800 hover:dark:bg-slate-750 text-slate-700 dark:text-slate-350 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-extrabold rounded-md border border-slate-200 dark:border-slate-750 transition-all shadow-sm cursor-pointer"
                >
                  All-Time Lifetime
                </button>
              </div>

              {/* Status Query Results Counter */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl gap-4 text-left">
                <div className="flex items-center gap-3">
                  <Info className="w-5 h-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 dark:text-slate-450 font-bold uppercase tracking-wider m-0">Matched Service tickets:</p>
                    <p className="font-sans text-sm font-black text-slate-800 dark:text-slate-100 m-0 mt-0.5">
                      Found <span className="text-blue-600 dark:text-blue-450 font-bold">{matchedReportTickets.length} tickets</span> matching the selected filter constraints.
                    </p>
                  </div>
                </div>

                {matchedReportTickets.length > 0 && (
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadExcelDashboard}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer hover:scale-105 active:scale-95"
                      title="Download Excel workbook (.csv with BOM)"
                    >
                      <FileSpreadsheet size={15} />
                      Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDashboardPrintModal(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer hover:scale-105 active:scale-95"
                      title="Preview and save report, export to PDF, print directly"
                    >
                      <FileText size={15} />
                      View PDF / Print
                    </button>
                  </div>
                )}
              </div>

              {/* Spares parts consumed card block if reportMode === "room" */}
              {reportMode === "room" && (
                <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-dotted border-slate-300 dark:border-slate-700 text-left">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <span>🛠️ Cumulative Hardware Consumables / Spare Parts Used:</span>
                  </h4>
                  {Object.entries(getSparesSummaryFromTickets(matchedReportTickets)).length === 0 ? (
                    <div className="text-xs font-bold text-slate-400 dark:text-slate-500 italic p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-150 dark:border-slate-800 text-center">
                      No stock consumables or spare parts were consumed for this compartmental view in the current dates selection.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {Object.entries(getSparesSummaryFromTickets(matchedReportTickets)).map(([itemName, totalQty]) => (
                        <div key={itemName} className="bg-white dark:bg-slate-900 border border-emerald-250 dark:border-emerald-900/60 p-3 rounded-lg text-left shadow-sm flex items-center justify-between">
                          <div className="truncate pr-2 col-span-3">
                            <p className="text-[10px] text-slate-400 font-black uppercase truncate">{itemName}</p>
                            <p className="text-xs font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">Asset Installed</p>
                          </div>
                          <span className="shrink-0 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800 font-mono">
                            x{totalQty}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Real-time ticket query preview grid */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-450 mb-3 block text-left">Matched tickets Live Preview:</h4>
                <div className="border border-slate-200 dark:border-slate-750 rounded-xl overflow-hidden max-h-[30vh] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 font-extrabold uppercase border-b border-slate-200 dark:border-slate-750 select-none">
                        <th className="py-2.5 px-3 font-mono">S.No</th>
                        <th className="py-2.5 px-3">Ticket ID</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Location Room</th>
                        <th className="py-2.5 px-3">Staff / Teacher</th>
                        <th className="py-2.5 px-3">Reported Issue details</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {matchedReportTickets.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold italic bg-white dark:bg-slate-900">
                            <div className="flex flex-col items-center justify-center p-8 gap-4"><AnimatedNoTickets size="w-24 h-24" /></div>
                          </td>
                        </tr>
                      ) : (
                        matchedReportTickets.map((t, index) => {
                          let statusColor = "bg-amber-150 text-amber-800 border-amber-200";
                          if (t.status === "pending") {
                            statusColor = "bg-orange-100 text-orange-850 border-orange-200";
                          } else if (t.status === "resolved") {
                            statusColor = "bg-emerald-100 text-emerald-805 border-emerald-250";
                          }

                          return (
                            <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/50 bg-white dark:bg-slate-900 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-450">{index + 1}</td>
                              <td className="py-2.5 px-3 font-mono font-black text-slate-900 dark:text-white select-all">{t.id}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-500">{t.date}</td>
                              <td className="py-2.5 px-3 truncate max-w-[150px] font-semibold text-slate-750 dark:text-slate-350" title={t.linkedRoom}>{t.linkedRoom || "-"}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{t.staffName}</td>
                              <td className="py-2.5 px-3 font-medium text-slate-600 dark:text-slate-400 max-w-xs truncate" title={t.actualIssue || t.issue}>{t.actualIssue || t.issue}</td>
                              <td className="py-2.5 px-3 text-right">
                                <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded border ${statusColor}`}>
                                  {t.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* Footer row */}
            <div className="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setShowQuickReportModal(false)}
                className="px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-sm"
              >
                CLOSE WINDOW
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* EXECUTIVE FULL-SCREEN MODAL FOR DIGITAL PREVIEW & PDF PRINTING */}
      {/* ========================================== */}
      {showDashboardPrintModal && matchedReportTickets.length > 0 && (
          <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">

          <div className="bg-slate-100 dark:bg-slate-950 w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-850 animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[90vh]">
            
            {/* Dark interactive toolbar banner (Will be hidden on physical printer output via style logic) */}
            <div className="p-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center text-white shrink-0 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <Printer className="w-5 h-5 text-blue-400 animate-pulse" />
                <div className="text-left">
                  <h3 className="font-bold text-sm text-white m-0 leading-snug">🖥️ Birla Open Minds International School — Executive Print Desk</h3>
                  <p className="text-[10px] text-slate-400 font-medium m-0 mt-0.5">Verify layout format below before engaging physical or PDF printer output.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-all shadow cursor-pointer hover:scale-105 active:scale-95"
                >
                  <Printer size={15} />
                  Print / Save PDF
                </button>
                <button
                  type="button"
                  onClick={() => setShowDashboardPrintModal(false)}
                  className="px-4 py-2 border border-slate-750 hover:bg-slate-800 text-slate-350 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  Exit Preview
                </button>
              </div>
            </div>

            {/* A4 Page Content Area */}
            <div className="p-12 overflow-y-auto flex-1 bg-white text-slate-900 print-preview-scroll-container custom-scrollbar">
              
              {/* Actual PDF styled layout starts here */}
              <div id="print-executive-report-preview" className="max-w-4xl mx-auto space-y-8 bg-white p-6 leading-relaxed self-start min-h-full">
                {renderExecutivePrintContent()}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Portalled Print Output direct to document body to bypass iframe constraints and parent modal styling overlays on print */}
      {showDashboardPrintModal && matchedReportTickets.length > 0 && createPortal(
        <div 
          id="print-executive-report-root"
          className="bg-white p-6 leading-relaxed relative"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {renderExecutivePrintContent()}
        </div>,
        document.body
      )}

    </motion.div>
  );
}
