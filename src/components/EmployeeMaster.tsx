import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Search, Save, Trash2, Calendar, FileSpreadsheet, RotateCcw, ShieldCheck, Inbox, X, Printer, AlertTriangle, Info, FileText } from "lucide-react";
import { EmployeeAllocation, InventoryItem, Room } from "../types";

interface EmployeeMasterProps {
  allocations: EmployeeAllocation[];
  inventory: InventoryItem[];
  rooms: Room[];
  updateAllocations: (allocs: EmployeeAllocation[], inv?: InventoryItem[]) => void;
}

export default function EmployeeMaster({ allocations, inventory, rooms, updateAllocations }: EmployeeMasterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"Active" | "Returned" | "Report" | "Damaged" | "Profiles">("Active");

  // Custom states for Damaged Materials and PDF Printing
  const [damagedPreset, setDamagedPreset] = useState<"all" | "day" | "week" | "month" | "year" | "custom">("all");
  const [damagedFromDate, setDamagedFromDate] = useState("");
  const [damagedToDate, setDamagedToDate] = useState("");
  const [printModalType, setPrintModalType] = useState<"Active" | "Returned" | "Damaged" | "UsageReport" | "Allocations" | "Clearance" | null>(null);

  // States for selected employee name and roster search in Dossier Desk mode
  const [selectedEmpName, setSelectedEmpName] = useState("");
  const [empRosterSearch, setEmpRosterSearch] = useState("");

  // States for dynamic Room & Building Stock Usage analytics report
  const [reportPreset, setReportPreset] = useState<"all" | "day" | "week" | "month" | "year" | "custom">("all");
  const [reportFromDate, setReportFromDate] = useState("");
  const [reportToDate, setReportToDate] = useState("");
  const [reportBuildingFilter, setReportBuildingFilter] = useState("all");
  const [reportRoomFilter, setReportRoomFilter] = useState("all");
  const [reportProductFilter, setReportProductFilter] = useState("all");
  const [reportSearch, setReportSearch] = useState("");

  // Input states
  const [assigneeType, setAssigneeType] = useState<"Employee" | "Room">("Employee");
  const [empName, setEmpName] = useState("");
  const [selectedInvId, setSelectedInvId] = useState("");
  const [qty, setQty] = useState(1);
  const [remarks, setRemarks] = useState("");

  // Custom tracking fields for deployment rooms/buildings
  const [selectedBuilding, setSelectedBuilding] = useState("LB Nagar Branch");
  const [customBuilding, setCustomBuilding] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [customRoom, setCustomRoom] = useState("");

  // Return Processing overlay parameters
  const [returningItem, setReturningItem] = useState<{ id: string; allocation: EmployeeAllocation } | null>(null);
  const [returnCondition, setReturnCondition] = useState<"Working" | "Damaged">("Working");
  const [deletingItem, setDeletingItem] = useState<{ id: string; allocation: EmployeeAllocation } | null>(null);
  const [deleteRemarks, setDeleteRemarks] = useState("");
  const [viewingItem, setViewingItem] = useState<EmployeeAllocation | null>(null);
  const [editingItem, setEditingItem] = useState<EmployeeAllocation | null>(null);
  const [editRemarks, setEditRemarks] = useState("");

  // Corporate Data Retention Settings
  const [retentionMonths, setRetentionMonths] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("sgs_retention_policy_months");
      return saved ? parseInt(saved, 10) : 6; // Standard default of 6 months
    } catch {
      return 6;
    }
  });

  const getRetentionAnalysis = () => {
    const returnedAllocations = allocations.filter(a => a.status === "Returned");
    const now = new Date();
    
    let totalReturned = returnedAllocations.length;
    let expiredRecords: EmployeeAllocation[] = [];
    let safeRecords: EmployeeAllocation[] = [];

    returnedAllocations.forEach((a) => {
      if (!a.returnedOn) {
        safeRecords.push(a);
        return;
      }
      const d = parseDateString(a.returnedOn);
      if (!d) {
        safeRecords.push(a);
        return;
      }
      
      const diffTime = Math.abs(now.getTime() - d.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Check if age of returned item exceeds selected retention window (assuming 30 days per month)
      if (diffDays > retentionMonths * 30) {
        expiredRecords.push(a);
      } else {
        safeRecords.push(a);
      }
    });

    return {
      totalReturned,
      expiredRecords,
      safeRecords,
      savedStorePercentage: totalReturned > 0 ? Math.round((expiredRecords.length / totalReturned) * 100) : 0
    };
  };

  const handlePurgeExpiredRecords = () => {
    const { expiredRecords } = getRetentionAnalysis();
    if (expiredRecords.length === 0) {
      alert("No returned history records match the current expiration period to purge!");
      return;
    }

    const message = `Are you sure you want to download and archive ${expiredRecords.length} expired records older than ${retentionMonths} months? \nThis keeps your database optimized and automatically downloads the backup file to your device.`;
    if (!confirm(message)) {
      return;
    }

    // Direct backup of expired records (Corporate Compliance CSV Trail)
    let output = "Allocation ID,Employee Name,Asset Name,Qty,Remarks,Assigned Date,Returned Date,Returned Condition\n";
    expiredRecords.forEach(a => {
      output += `"${a.id}","${a.empName}","${a.itemName}",${a.qty},"${a.remarks}","${a.assignedOn}","${a.returnedOn}","${a.condition}"\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_EXPIRED_ARCHIVE_${retentionMonths}M_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Keep active records & non-expired returned records
    const expiredIds = new Set(expiredRecords.map(e => e.id));
    const updatedAllocations = allocations.filter(a => !expiredIds.has(a.id));

    updateAllocations(updatedAllocations);
    alert(`Successfully purged ${expiredRecords.length} expired logs from display and compiled database!`);
  };

  // Pull active stock candidates for selections
  const stockInventory = inventory.filter(i => i.balanceQty > 0);

  // Parse date strings in form: "DD-MM-YYYY HH:MM" or "DD-MM-YYYY" or similar formats
  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const cleanStr = dateStr.replace(/,/g, "").trim();
    const datePart = cleanStr.split(" ")[0]; // Get the DD-MM-YYYY component
    const parts = datePart.includes("/") ? datePart.split("/") : datePart.split("-");
    if (parts.length !== 3) return null;

    let day = 1;
    let month = 0;
    let year = 2026;

    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      year = parseInt("20" + parts[2], 10);
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month, day);
  };

  // Checks if an allocation (Active, Returned, or Damaged) is in our selected range preset
  const isAllocationInSelectedRange = (a: EmployeeAllocation): boolean => {
    // Choose date returned first, else fallback to assigned date
    const dateStr = a.status === "Returned" ? (a.returnedOn || a.assignedOn) : a.assignedOn;
    const d = parseDateString(dateStr);
    if (!d) return false;

    const testTime = d.getTime();
    
    // Day limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (damagedPreset === "all") return true;

    if (damagedPreset === "day") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return testTime >= today.getTime() && testTime < tomorrow.getTime();
    }

    if (damagedPreset === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return testTime >= weekAgo.getTime();
    }

    if (damagedPreset === "month") {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return testTime >= monthAgo.getTime();
    }

    if (damagedPreset === "year") {
      const yearAgo = new Date(today);
      yearAgo.setDate(yearAgo.getDate() - 365);
      return testTime >= yearAgo.getTime();
    }

    if (damagedPreset === "custom") {
      if (!damagedFromDate || !damagedToDate) return true;
      const start = new Date(damagedFromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(damagedToDate);
      end.setHours(23, 59, 59, 999);
      return testTime >= start.getTime() && testTime <= end.getTime();
    }

    return true;
  };

  // Checks if a returned/damaged allocation is within our selected range preset
  const isDamagedInSelectedRange = (a: EmployeeAllocation): boolean => {
    if (a.status !== "Returned" || a.condition !== "Damaged") return false;
    return isAllocationInSelectedRange(a);
  };

  // Filter lists based on Tab views and matching searches
  const filteredAllocations = allocations.filter((a) => {
    if (viewMode === "Damaged") {
      if (a.status !== "Returned" || a.condition !== "Damaged") return false;
    } else {
      if (a.status !== viewMode) return false;
    }
    
    // Check range bounds
    if (!isAllocationInSelectedRange(a)) return false;

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      a.empName.toLowerCase().includes(s) ||
      a.itemName.toLowerCase().includes(s) ||
      a.remarks.toLowerCase().includes(s) ||
      a.id.toLowerCase().includes(s)
    );
  });

  // Assign/Allocate Confirmation
  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !selectedInvId || qty <= 0) {
      alert("Employee Name and Valid Stock Selection is mandatory!");
      return;
    }

    const inventoryIdx = inventory.findIndex(i => i.id === selectedInvId);
    if (inventoryIdx === -1) return;

    const item = inventory[inventoryIdx];
    if (qty > item.balanceQty) {
      alert(`Insufficient stock balance! Only ${item.balanceQty} units available.`);
      return;
    }

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).replace(/\//g, "-");

    const newId = `EMP-AST-${Date.now().toString().slice(-6)}`;

    // Resolve building and room values dynamically
    const destBuilding = selectedBuilding === "Custom" ? (customBuilding.trim() || "Main Block") : selectedBuilding;
    const destRoom = selectedRoomId === "Custom" ? (customRoom.trim() || "General Location") : selectedRoomId;

    const newAllocation: EmployeeAllocation = {
      id: newId,
      empName: empName.trim().toUpperCase(), // Keep consistent casing
      itemName: item.itemName,
      invId: selectedInvId,
      qty,
      remarks: remarks.trim() || "No custom remarks",
      assignedOn: nowStr,
      status: "Active",
      building: destBuilding,
      room: destRoom,
      assigneeType
    };

    // Update stocks
    let updatedInventory = [...inventory];
    const newUsed = item.usedQty + qty;
    const logText = `• [${nowStr}] 👤 Assigned ${qty} unit(s) to Employee ${empName.trim().toUpperCase()} at ${destBuilding} - ${destRoom}`;
    updatedInventory[inventoryIdx] = {
      ...item,
      usedQty: newUsed,
      balanceQty: item.totalQty - newUsed,
      logs: `${logText}\n${item.logs}`
    };

    const updatedAllocations = [newAllocation, ...allocations];

    updateAllocations(updatedAllocations, updatedInventory);

    // Reset Form Input
    setEmpName("");
    setSelectedInvId("");
    setQty(1);
    setRemarks("");
    setCustomBuilding("");
    setCustomRoom("");
    setSelectedRoomId("");
    alert("Asset Allocated successfully!");
  };

  // Process Return confirm
  const handleConfirmReturn = () => {
    if (!returningItem) return;

    const alloc = returningItem.allocation;
    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).replace(/\//g, "-");

    let updatedInventory = [...inventory];
    const invIdx = updatedInventory.findIndex(i => i.id === alloc.invId);

    if (invIdx !== -1) {
      const item = updatedInventory[invIdx];
      
      if (returnCondition === "Working") {
        // Return back to stock pool
        const newUsed = Math.max(0, item.usedQty - alloc.qty);
        const logText = `• [${nowStr}] 🔙 Restored ${alloc.qty} working unit(s) returned by ${alloc.empName}`;
        updatedInventory[invIdx] = {
          ...item,
          usedQty: newUsed,
          balanceQty: item.totalQty - newUsed,
          logs: `${logText}\n${item.logs}`
        };
      } else {
        // SCRAP - Deduct total entirely!
        const newTotal = Math.max(0, item.totalQty - alloc.qty);
        const newUsed = Math.max(0, item.usedQty - alloc.qty);
        const logText = `• [${nowStr}] ❌ SCRAP: ${alloc.qty} unit(s) returned DAMAGED/DEAD by ${alloc.empName}. Removed from master tally.`;
        updatedInventory[invIdx] = {
          ...item,
          totalQty: newTotal,
          usedQty: newUsed,
          balanceQty: newTotal - newUsed,
          logs: `${logText}\n${item.logs}`
        };
      }
    }

    // Move allocation listing to Returned status inside active array
    const updatedAllocations = allocations.map((a) => {
      if (a.id === alloc.id) {
        return {
          ...a,
          status: "Returned" as const,
          returnedOn: nowStr,
          condition: returnCondition
        };
      }
      return a;
    });

    updateAllocations(updatedAllocations, updatedInventory);
    setReturningItem(null);
    alert(`Return completed with condition set to ${returnCondition}.`);
  };

  const handleConfirmDelete = () => {
    if (!deletingItem || !deleteRemarks.trim()) {
      alert("Please enter remarks explaining why you are deleting this entry.");
      return;
    }

    const alloc = deletingItem.allocation;
    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).replace(/\//g, "-");

    const sessionData = sessionStorage.getItem("it_pro_session");
    const currentAdmin = sessionData ? JSON.parse(sessionData).email?.split('@')[0] || "IT Admin" : "IT Admin";

    let updatedInventory = [...inventory];
    const invIdx = updatedInventory.findIndex(i => i.id === alloc.invId);

    if (invIdx !== -1) {
      const item = updatedInventory[invIdx];
      const newUsed = Math.max(0, item.usedQty - alloc.qty);
      const logText = `• [${nowStr}] 🗑️ Deleted room allocation of ${alloc.qty} unit(s) from ${alloc.room || alloc.empName}. Reason: "${deleteRemarks.trim()}" (By: ${currentAdmin}). Restored to stock.`;
      updatedInventory[invIdx] = {
        ...item,
        usedQty: newUsed,
        balanceQty: item.totalQty - newUsed,
        logs: `${logText}\n${item.logs}`
      };
    }

    const updatedAllocations = allocations.filter(a => a.id !== alloc.id);
    updateAllocations(updatedAllocations, updatedInventory);
    setDeletingItem(null);
    setDeleteRemarks("");
    alert("Allocation deleted and stock restored successfully.");
  };

  const handleConfirmEdit = () => {
    if (!editingItem) return;
    const updatedAllocations = allocations.map(a => {
      if (a.id === editingItem.id) {
        return { ...a, remarks: editRemarks };
      }
      return a;
    });
    updateAllocations(updatedAllocations, inventory); // No inventory change, just update alloc
    setEditingItem(null);
    setEditRemarks("");
  };

  // Archive history: downloads all returned history listings and deletes them from active memory tally to clean screens
  const handleArchiveHistoryData = () => {
    const historyListones = allocations.filter(a => a.status === "Returned");
    if (historyListones.length === 0) {
      alert("No archive candidates in return history books!");
      return;
    }

    if (!confirm(`Save and ARCHIVE ${historyListones.length} return history records? This compiles active records to downloads and purges internal display tally.`)) {
      return;
    }

    // Build downloadable summary logbook CSV
    let output = "Allocation ID,Employee Name,Asset Name,Qty,Remarks,Assigned Date,Returned Date,Returned Condition\n";
    historyListones.forEach(a => {
      output += `"${a.id}","${a.empName}","${a.itemName}",${a.qty},"${a.remarks}","${a.assignedOn}","${a.returnedOn}","${a.condition}"\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_ARCHIVED_LOGBOOK_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Purge returned assets from current array state
    const purgedAllocations = allocations.filter(a => a.status !== "Returned");
    updateAllocations(purgedAllocations);
    alert("Archiving complete! Returns ledger successfully cleared.");
  };

  // Compile filtered report overview Excel CSV for the active tab view mode
  const handleExportCSV = () => {
    if (filteredAllocations.length === 0) {
      alert(`No records in ${viewMode} category match current search terms/date presets to export.`);
      return;
    }

    let output = "";
    if (viewMode === "Active") {
      output = "S.No,Allocation ID,Employee Name,Hardware Asset,Assigned Qty,Assigned On,Remarks/Serials\n";
      filteredAllocations.forEach((a, idx) => {
        output += `${idx + 1},"${a.id}","${a.empName}","${a.itemName}",${a.qty},"${a.assignedOn}","${a.remarks}"\n`;
      });
    } else if (viewMode === "Returned") {
      output = "S.No,Allocation ID,Employee Name,Hardware Asset,Returned Qty,Assigned On,Returned On,Condition,Remarks/Serials\n";
      filteredAllocations.forEach((a, idx) => {
        output += `${idx + 1},"${a.id}","${a.empName}","${a.itemName}",${a.qty},"${a.assignedOn}","${a.returnedOn || ""}","${a.condition}","${a.remarks}"\n`;
      });
    } else {
      // Damaged scrap status
      output = "S.No,Allocation ID,Employee Name,Hardware Asset,Scrapped Qty,Assigned On,Scrapped On,Diagnostic Remarks\n";
      filteredAllocations.forEach((a, idx) => {
        output += `${idx + 1},"${a.id}","${a.empName}","${a.itemName}",${a.qty},"${a.assignedOn}","${a.returnedOn || ""}","${a.remarks}"\n`;
      });
    }

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_${viewMode.toUpperCase()}_REPORT_${damagedPreset.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllocations = handleExportCSV;
  const handleExportDamagedExcel = handleExportCSV;

  // Calculate live statistics for matched damaged logs
  const damagedFilteredList = allocations.filter(a => isDamagedInSelectedRange(a));
  const totalDamagedQty = damagedFilteredList.reduce((acc, a) => acc + a.qty, 0);

  // Get unique list of rooms and buildings for active menus
  const availableBuildings = Array.from(new Set(rooms.map(r => r.building).filter(Boolean))) as string[];
  const UI_BUILDINGS = availableBuildings.length > 0 ? availableBuildings : ["LB Nagar Branch"];

  // Rooms filtered by the active building selection
  const availableRoomsFiltered = rooms.filter(r => r.building === selectedBuilding || !r.building);

  // Unique lists featured in allocations for Usage Report filters
  const allocationProductOptions = Array.from(new Set(allocations.map(a => a.itemName))).sort();
  const allocationBuildingOptions = Array.from(new Set(allocations.map(a => a.building || "LB Nagar Branch"))).sort();
  const allocationRoomOptions = Array.from(new Set(allocations.map(a => a.room || "General Area"))).sort();

  // Filter allocations for the Usage & Distribution report
  const reportFilteredAllocations = allocations.filter((a) => {
    // 1. Date presets
    if (reportPreset !== "all") {
      const d = parseDateString(a.assignedOn);
      if (!d) return false;
      const testTime = d.getTime();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (reportPreset === "day") {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (testTime < today.getTime() || testTime >= tomorrow.getTime()) return false;
      } else if (reportPreset === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (testTime < weekAgo.getTime()) return false;
      } else if (reportPreset === "month") {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        if (testTime < monthAgo.getTime()) return false;
      } else if (reportPreset === "year") {
        const yearAgo = new Date(today);
        yearAgo.setDate(yearAgo.getDate() - 365);
        if (testTime < yearAgo.getTime()) return false;
      } else if (reportPreset === "custom") {
        if (reportFromDate && reportToDate) {
          const start = new Date(reportFromDate);
          start.setHours(0, 0, 0, 0);
          const end = new Date(reportToDate);
          end.setHours(23, 59, 59, 999);
          if (testTime < start.getTime() || testTime > end.getTime()) return false;
        }
      }
    }

    // 2. Building filter
    if (reportBuildingFilter !== "all") {
      const b = (a.building || "LB Nagar Branch").toLowerCase().trim();
      if (b !== reportBuildingFilter.toLowerCase().trim()) return false;
    }

    // 3. Room filter
    if (reportRoomFilter !== "all") {
      const r = (a.room || "General Area").toLowerCase().trim();
      if (!r.includes(reportRoomFilter.toLowerCase().trim())) return false;
    }

    // 4. Product filter
    if (reportProductFilter !== "all") {
      const p = a.itemName.toLowerCase().trim();
      if (!p.includes(reportProductFilter.toLowerCase().trim())) return false;
    }

    // 5. Search query match
    if (reportSearch.trim()) {
      const s = reportSearch.toLowerCase();
      const match = a.empName.toLowerCase().includes(s) ||
                    a.itemName.toLowerCase().includes(s) ||
                    (a.building || "LB Nagar Branch").toLowerCase().includes(s) ||
                    (a.room || "General Area").toLowerCase().includes(s) ||
                    a.remarks.toLowerCase().includes(s);
      if (!match) return false;
    }

    return true;
  });

  const handleExportReportCSV = () => {
    if (reportFilteredAllocations.length === 0) {
      alert("No matched records to export for these filter parameters.");
      return;
    }

    let output = "S.No,Allocation Date,Allocation ID,Hardware Item Name,Quantity Allocated,Assigned To/Employee,Destination Building,Destination Room,Remarks/Serials,Status,Returned Date,Condition\n";
    
    reportFilteredAllocations.forEach((item, idx) => {
      const escapedName = item.itemName.replace(/"/g, '""');
      const escapedEmp = item.empName.replace(/"/g, '""');
      const escapedBuilding = (item.building || "LB Nagar Branch").replace(/"/g, '""');
      const escapedRoom = (item.room || "General Area").replace(/"/g, '""');
      const escapedRemarks = item.remarks.replace(/"/g, '""');
      const returnedDate = item.returnedOn || "N/A";
      const cond = item.condition || "N/A";

      output += `${idx + 1},"${item.assignedOn}","${item.id}","${escapedName}",${item.qty},"${escapedEmp}","${escapedBuilding}","${escapedRoom}","${escapedRemarks}","${item.status}","${returnedDate}","${cond}"\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_STOCK_USAGE_REPORT_${reportPreset.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderEmployeePrintContent = () => (
    <>
      {/* Header Content Segment */}
      <div>
        
        {/* Visual corporate strip */}
        <div className={`w-full h-1.5 ${printModalType === "Damaged" ? "bg-red-700" : printModalType === "UsageReport" ? "bg-indigo-700" : printModalType === "Clearance" ? "bg-[#DD6B20]" : "bg-blue-800"} rounded-sm mb-6`}></div>

        <div className="flex justify-between items-start border-b border-slate-350 pb-6">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 font-sans m-0">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</h1>
            <p className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest leading-none mt-1 font-sans">IT HELP DESK</p>
            
            <div className="text-[9.5px] text-slate-455 font-bold font-mono mt-3 space-y-0.5 leading-tight">
              <p className="m-0">📍 Sahara Rd, behind Kamineni Hospitals, Sri Ram Hills Colony, L. B. Nagar, Mansoorabad, Hyderabad, Telangana 500068</p>
              <p className="m-0">📧 birlaithelpdesk@gmail.com</p>
              <p className="m-0">🔑 transition ID: #7e59c941-df4b-4214</p>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-[10px] font-extrabold px-3 py-1 ${printModalType === "Damaged" ? "bg-red-50 text-red-800 border-red-200" : printModalType === "UsageReport" ? "bg-indigo-50 text-indigo-800 border-indigo-200" : printModalType === "Clearance" ? "bg-orange-50 text-amber-850 border-orange-200" : "bg-blue-50 text-blue-800 border-blue-200"} border uppercase rounded-sm font-sans tracking-wider inline-block`}>
              {printModalType === "UsageReport" ? "Room & Building Stock Distribution Tally" : printModalType === "Clearance" ? "Official Personnel IT Clearance Deed" : printModalType === "Allocations" ? "Employee Assets Allocation Audit Ledger" : "DAMAGED HARDWARE & SCRAP DISPOSAL REPORT"}
            </span>
            <p className="text-[9px] text-slate-455 mt-2 font-bold uppercase font-sans m-0">Date Generated</p>
            <p className="text-xs font-bold font-mono text-slate-800 leading-tight m-0">
              {new Date().toLocaleString("en-GB")}
            </p>
          </div>
        </div>

        {/* Range and parameters description */}
        <div className="mt-5 bg-slate-50 p-4 border border-slate-200 rounded-lg text-[10px] leading-relaxed grid grid-cols-2 gap-y-1.5 gap-x-4">
          <div className="col-span-2 text-[9px] font-extrabold uppercase tracking-widest text-[#2D3748] pb-1 border-b border-slate-200 mb-1">
            📋 {printModalType === "Clearance" ? "PERSONNEL DETAILS & DISCHARGE STATUS" : "AUDIT CRITERIA & RECONCILIATION PARAMETERS"}
          </div>
          <div>
            <strong className="text-slate-455 uppercase text-[8.5px] font-extrabold">{printModalType === "Clearance" ? "Staff Member Name:" : "Report Class:"}</strong>
            <p className="text-slate-850 font-black text-xs uppercase leading-tight m-0">
              {printModalType === "Clearance" ? selectedEmpName : printModalType === "UsageReport" ? "Building & Classrooms Materials Log" : printModalType === "Allocations" ? "All Corporate Deployments Tally" : "Scrap Bin Material List"}
            </p>
          </div>
          <div>
            <strong className="text-slate-455 uppercase text-[8.5px] font-extrabold">{printModalType === "Clearance" ? "Clearance Registry ID:" : "Selected Horizon Window:"}</strong>
            <p className="text-slate-850 font-bold font-mono text-xs leading-tight m-0">
              {printModalType === "Clearance" ? `PERS-${selectedEmpName.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 6)}` : printModalType === "UsageReport" ? `PRESET: ${reportPreset.toUpperCase()} (${reportFromDate || "All"} to ${reportToDate || "All"})` : printModalType === "Allocations" ? "Full active memory tally" : `PRESET: ${damagedPreset.toUpperCase()} (${damagedFromDate || "All"} to ${damagedToDate || "All"})`}
            </p>
          </div>
          {printModalType === "UsageReport" && (
            <>
              <div>
                <strong className="text-slate-455 uppercase text-[8.5px] font-extrabold">Building Target:</strong>
                <p className="text-slate-850 font-extrabold uppercase font-sans m-0">
                  {reportBuildingFilter === "all" ? "All School Buildings" : reportBuildingFilter}
                </p>
              </div>
              <div>
                <strong className="text-slate-455 uppercase text-[8.5px] font-extrabold">Room / Product Filters:</strong>
                <p className="text-slate-850 font-bold font-mono m-0">
                  Room: {reportRoomFilter === "all" ? "All" : reportRoomFilter} | Item: {reportProductFilter === "all" ? "All" : reportProductFilter}
                </p>
              </div>
            </>
          )}
        </div>

        {/* Inline Stats cards in PDF */}
        {printModalType === "UsageReport" ? (
          <div className="grid grid-cols-3 gap-3 bg-indigo-50/50 p-3 border border-indigo-200 rounded-lg text-center mt-4 text-[10px]">
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest font-sans m-0">Deployment Logs</p>
              <p className="text-base font-black font-mono text-slate-800 m-0">{reportFilteredAllocations.length} Matches</p>
            </div>
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8.5px] text-indigo-700 font-extrabold uppercase tracking-widest font-sans m-0">Total Dispatched Items</p>
              <p className="text-base font-black font-mono text-indigo-800 m-0">
                {reportFilteredAllocations.reduce((sum, item) => sum + item.qty, 0)} Units
              </p>
            </div>
            <div className="py-1">
              <p className="text-[8.5px] text-[#38A169] font-extrabold uppercase tracking-widest font-sans m-0">Active Status Deployments</p>
              <p className="text-base font-black font-mono text-emerald-700 m-0">
                {reportFilteredAllocations.filter(a => a.status === "Active").reduce((sum, item) => sum + item.qty, 0)} Units
              </p>
            </div>
          </div>
        ) : printModalType === "Allocations" ? (
          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-lg text-center mt-4 text-[10px]">
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8px] text-slate-455 font-extrabold uppercase tracking-widest font-sans m-0 font-sans">Total Logs</p>
              <p className="text-base font-black font-mono text-slate-800 m-0">{allocations.length}</p>
            </div>
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8px] text-blue-700 font-extrabold uppercase tracking-widest font-sans m-0">Active Units</p>
              <p className="text-base font-black font-mono text-blue-800 font-extrabold m-0">
                {allocations.filter(a => a.status === "Active").reduce((sum, item) => sum + item.qty, 0)}
              </p>
            </div>
            <div className="py-1 border-r border-slate-200 font-bold">
              <p className="text-[8px] text-slate-455 font-extrabold uppercase tracking-widest font-sans m-0">Returned Goods</p>
              <p className="text-base font-black font-mono text-slate-800 m-0">
                {allocations.filter(a => a.status === "Returned").length}
              </p>
            </div>
            <div className="py-1">
              <p className="text-[8px] text-red-650 font-extrabold uppercase tracking-widest font-sans m-0">Scrap Rate</p>
              <p className="text-base font-black font-mono text-red-655 m-0">
                {allocations.length > 0 
                  ? Math.round((allocations.filter(a => a.status === "Returned" && a.condition === "Damaged").length / allocations.length) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        ) : printModalType === "Clearance" ? (
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-lg text-center mt-4 text-[10px]">
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest font-sans m-0">Active Outstanding</p>
              <p className="text-base font-black font-mono text-amber-600 m-0">
                {allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase() && a.status === "Active").reduce((sum, item) => sum + item.qty, 0)} Units
              </p>
            </div>
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest font-sans m-0">Returned & Restored</p>
              <p className="text-base font-black font-mono text-emerald-600 m-0">
                {allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase() && a.status === "Returned" && a.condition === "Working").reduce((sum, item) => sum + item.qty, 0)} Units
              </p>
            </div>
            <div className="py-1">
              <p className="text-[8.5px] text-orange-650 font-extrabold uppercase tracking-widest font-sans m-0">Discharge Status</p>
              <p className={`text-sm font-black uppercase m-0 ${allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase() && a.status === "Active").length === 0 ? "text-emerald-700 font-bold" : "text-amber-800 font-bold"}`}>
                {allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase() && a.status === "Active").length === 0 ? "✅ CLEARED" : "⏳ OUTSTANDING"}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3 border border-slate-200 rounded-lg text-center mt-4 text-[10px]">
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8px] text-red-750 font-extrabold uppercase tracking-widest font-sans m-0">Scrap Incidents</p>
              <p className="text-base font-black font-mono text-red-700 m-0">{damagedFilteredList.length}</p>
            </div>
            <div className="py-1 border-r border-slate-200">
              <p className="text-[8px] text-slate-455 font-extrabold uppercase tracking-widest font-sans m-0">Scrapped Qty</p>
              <p className="text-base font-black font-mono text-slate-850 m-0">{totalDamagedQty} units</p>
            </div>
            <div className="py-1 font-bold col-span-1">
              <p className="text-[8px] text-slate-450 font-extrabold uppercase tracking-widest font-sans m-0">Loss Severity</p>
              <p className="text-base font-black font-mono text-red-650 m-0">
                {damagedFilteredList.length > 10 ? "CRITICAL" : "STANDARD OPERATIONAL SCRAP"}
              </p>
            </div>
          </div>
        )}

        {/* Print Table list */}
        <div className="mt-5 border border-slate-350 rounded overflow-hidden">
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-350 text-slate-600 font-extrabold uppercase text-left leading-tight">
                <th className="p-2 border-r border-slate-350 text-center w-10">S.No</th>
                <th className="p-2 border-r border-slate-350 w-24">Log ID</th>
                <th className="p-2 border-r border-slate-350 w-32">{printModalType === "Clearance" ? "Allocation Location" : "Personnel ID/Name"}</th>
                <th className="p-2 border-r border-slate-350 w-44">Hardware Asset Item</th>
                <th className="p-2 border-r border-slate-350 w-16 text-center">Quantity</th>
                <th className="p-2 border-r border-slate-350 w-24">{printModalType === "Clearance" ? "Assigned On" : "Reference Date"}</th>
                <th className="p-2 border-r border-slate-350 w-18 text-center">Status</th>
                <th className="p-2 font-bold w-48">Audit Serials/Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 leading-normal text-slate-800 font-medium">
              {printModalType === "Clearance" ? (
                allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase()).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-bold bg-slate-50/50">
                      No historical hardware material allocations logged on this personnel.
                    </td>
                  </tr>
                ) : (
                  allocations.filter(a => a.empName.trim().toUpperCase() === selectedEmpName.toUpperCase()).map((a, i) => (
                    <tr key={a.id} className="print-no-break">
                      <td className="p-2 border-r border-slate-300 text-center font-bold bg-slate-50">{i + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-705">{a.id}</td>
                      <td className="p-2 border-r border-slate-300 text-slate-800">
                        <span className="font-extrabold text-slate-800 block text-[8.5px] leading-tight">🏢 {a.building || "New School Building"}</span>
                        <span className="font-bold text-indigo-705 block text-[8px] leading-tight mt-0.5">🚪 {a.room || "General Area"}</span>
                      </td>
                      <td className="p-2 border-r border-slate-300 leading-tight font-extrabold text-slate-900">{a.itemName}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-black text-slate-900">{a.qty}</td>
                      <td className="p-2 border-r border-slate-305 font-mono text-[8.5px] leading-tight text-center">
                        {a.assignedOn}
                        {a.returnedOn && <div className="text-emerald-700 mt-1 font-bold">Retd: {a.returnedOn}</div>}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold uppercase text-[7px]">
                        {a.status === "Active" ? (
                          <span className="px-1 py-0.5 rounded-sm bg-amber-50 text-amber-805 border border-amber-250 block font-black">
                            ACTIVE
                          </span>
                        ) : (
                          <span className={`px-1 py-0.5 rounded-sm block font-black ${a.condition === "Working" ? "bg-emerald-50 text-emerald-800 border border-emerald-500" : "bg-rose-50 text-rose-800 border border-rose-500"}`}>
                            RETD ({a.condition})
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-[8.5px] italic text-slate-600 leading-snug font-semibold">{a.remarks}</td>
                    </tr>
                  ))
                )
              ) : printModalType === "UsageReport" ? (
                reportFilteredAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-bold bg-slate-50/50">
                      No matched hardware material allocations matching selection logged.
                    </td>
                  </tr>
                ) : (
                  reportFilteredAllocations.map((a, i) => (
                    <tr key={a.id} className="print-no-break">
                      <td className="p-2 border-r border-slate-305 text-center font-bold bg-slate-50">{i + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-indigo-900">{a.id}</td>
                      <td className="p-2 border-r border-slate-300 font-extrabold text-blue-755 uppercase leading-tight select-all">
                        {a.empName}
                        <div className="text-[7.5px] text-slate-500 font-mono font-normal mt-0.5">Logged: {a.assignedOn}</div>
                      </td>
                      <td className="p-2 border-r border-slate-300 leading-tight font-extrabold text-slate-850">{a.itemName}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-black text-indigo-950">{a.qty}</td>
                      <td className="p-2 border-r border-slate-300 text-slate-805">
                        <span className="text-[7px] text-slate-450 uppercase font-bold block leading-none">Building</span>
                        <span className="font-extrabold text-slate-800 leading-none">{a.building || "LB Nagar Branch"}</span>
                        <span className="text-indigo-605 text-[7px] uppercase font-bold block mt-1 leading-none">Room</span>
                        <span className="font-bold text-indigo-805 leading-none">{a.room || "General Area"}</span>
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-black uppercase text-[7px]">
                        <span className={`px-1 rounded-sm ${a.status === "Active" ? "bg-amber-55 text-amber-855 border border-amber-250" : "bg-emerald-55 text-emerald-855 border border-emerald-250"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="p-2 text-[8.5px] italic text-slate-600 leading-tight font-semibold">{a.remarks}</td>
                    </tr>
                  ))
                )
              ) : printModalType === "Allocations" ? (
                allocations.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-bold bg-slate-50/50">
                      No allocations records logged in memory.
                    </td>
                  </tr>
                ) : (
                  allocations.map((a, i) => (
                    <tr key={a.id} className="print-no-break">
                      <td className="p-2 border-r border-slate-300 text-center font-bold bg-slate-50">{i + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-slate-705">{a.id}</td>
                      <td className="p-2 border-r border-slate-300 font-extrabold text-blue-700 uppercase">{a.empName}</td>
                      <td className="p-2 border-r border-slate-300 leading-tight font-bold">{a.itemName}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-bold">{a.qty}</td>
                      <td className="p-2 border-r border-slate-300 font-mono text-[8.5px] leading-none">
                        Assign: {a.assignedOn}
                        {a.returnedOn && <div className="text-emerald-705 mt-1">Return: {a.returnedOn}</div>}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-bold uppercase text-[7.5px]">
                        {a.status === "Active" ? "ACTIVE" : `RETD (${a.condition})`}
                      </td>
                      <td className="p-2 text-[8.5px] italic text-slate-600 leading-tight">{a.remarks}</td>
                    </tr>
                  ))
                )
              ) : (
                damagedFilteredList.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400 font-bold bg-slate-50/50">
                      No damaged scrap events matching selection logged.
                    </td>
                  </tr>
                ) : (
                  damagedFilteredList.map((a, i) => (
                    <tr key={a.id} className="print-no-break">
                      <td className="p-2 border-r border-slate-300 text-center font-bold bg-slate-50">{i + 1}</td>
                      <td className="p-2 border-r border-slate-300 font-mono font-bold text-red-750">{a.id}</td>
                      <td className="p-2 border-r border-slate-300 font-extrabold text-red-700 uppercase">{a.empName}</td>
                      <td className="p-2 border-r border-slate-300 leading-tight font-bold text-slate-800">{a.itemName}</td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono font-black text-rose-700">{a.qty}</td>
                      <td className="p-2 border-r border-slate-300 font-mono text-[8.5px] leading-tight text-slate-700">
                        Retd Scrapped:
                        <div className="font-extrabold text-slate-800">{a.returnedOn}</div>
                      </td>
                      <td className="p-2 border-r border-slate-305 text-center font-bold text-red-650 uppercase text-[7.5px] bg-red-50/50">
                        DEMOLISHED
                      </td>
                      <td className="p-2 text-[8.5px] italic font-semibold text-slate-705 leading-tight">{a.remarks}</td>
                    </tr>
                  ))
                )
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Verification/Signoff section */}
      <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 print-no-break">
        <div className="space-y-16">
          <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-widest font-sans m-0">
            📝 IT Assets Auditor Sign-off
          </p>
          <div className="border-b border-slate-300 pr-8"></div>
          <div className="text-[9px] text-slate-500 leading-tight">
            <p className="font-bold text-slate-800 m-0">Hardware & IT Operations Lead</p>
            <p className="m-0">Birla Open Minds International School Global IT Support and Desk Systems</p>
          </div>
        </div>

        <div className="space-y-16">
          <p className="text-[9px] font-extrabold text-slate-700 uppercase tracking-widest font-sans m-0">
            🏫 Verification & Approval by Principal
          </p>
          <div className="border-b border-slate-300 pr-8"></div>
          <div className="text-[9px] text-slate-500 leading-tight">
            <p className="font-bold text-slate-800 m-0">School Principal & Head of Institution</p>
            <p className="m-0">Birla Open Minds International School Administrative Board</p>
          </div>
        </div>
      </div>
    </>
  );

  // Print triggered routine
  const handlePrintEmployeeReport = () => {
    window.print();
  };

  return (
    <div id="employee-master-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar select-text">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">👥 EMPLOYEE ASSET ALLOCATION DESK</h2>
          <p className="text-xs text-slate-500 font-medium">Coordinate corporate device assignments, logbooks, returns and scrap operations</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2.5">
          <button
            onClick={handleExportAllocations}
            className="px-4 py-2.5 bg-[#38A169] hover:bg-emerald-600 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            EXPORT ALLOCATIONS (.CSV)
          </button>
          <button
            onClick={() => setPrintModalType("Allocations")}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-750 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={15} />
            EXPORT ALLOCATIONS (.PDF)
          </button>
        </div>
      </div>

      {viewMode === "Report" ? (
        /* SPECIAL DEDICATED FULL-WIDTH USED MATERIALS DISTRIBUTION & ROOM REPORT PANEL */
        <div className="my-8 flex flex-col gap-6 w-full animate-in fade-in duration-200 select-text">
          
          {/* Main Controls Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded">📍</span>
                  USED HARDWARE & LOCALIZED DISTRIBUTION REPORT DESK
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Audit material usage by classroom, room department, and school building. Filter by any custom date criteria to print or export.
                </p>
              </div>

              {/* Report Controls Panel Buttons */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportReportCSV}
                  className="px-3.5 py-2 text-xs bg-[#38A169] hover:bg-emerald-600 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  title="Export results to CSV Excel format"
                >
                  <FileSpreadsheet size={14} />
                  <span>EXPORT EXCEL (.CSV)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalType("UsageReport")}
                  className="px-3.5 py-2 text-xs bg-indigo-600 hover:bg-indigo-755 text-white rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                  title="Print official distribution dossier to PDF"
                >
                  <Printer size={14} />
                  <span>PRINT REPORT (.PDF)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("Active");
                  }}
                  className="px-3.5 py-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer border"
                >
                  <X size={14} />
                  <span>CLOSE DATA ACCESS REPORT</span>
                </button>
              </div>
            </div>

            {/* Filter controls row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Presets and Dates */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">Date Horizon Wave</label>
                <select
                  value={reportPreset}
                  onChange={(e) => {
                    setReportPreset(e.target.value as any);
                    if (e.target.value !== "custom") {
                      setReportFromDate("");
                      setReportToDate("");
                    }
                  }}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-755 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-600"
                >
                  <option value="all">All Logs (Lifetime)</option>
                  <option value="day">Today (24 Hours)</option>
                  <option value="week">Past 7 Days</option>
                  <option value="month">Past 30 Days</option>
                  <option value="year">Past 365 Days</option>
                  <option value="custom">Custom Date Range...</option>
                </select>
              </div>

              {/* Custom Date Inputs */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">From Date</label>
                <input
                  type="date"
                  disabled={reportPreset !== "custom"}
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">To Date</label>
                <input
                  type="date"
                  disabled={reportPreset !== "custom"}
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none disabled:opacity-50"
                />
              </div>

              {/* Building dropdown */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">Filter School Building</label>
                <select
                  value={reportBuildingFilter}
                  onChange={(e) => setReportBuildingFilter(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none"
                >
                  <option value="all">All school campus sectors</option>
                  {allocationBuildingOptions.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                  <option value="LB Nagar Branch">LB Nagar Branch</option>

                </select>
              </div>

              {/* Room keyword search */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">Filter Room / Class Label</label>
                <input
                  type="text"
                  placeholder="E.g. Room 101, Lab B, etc."
                  value={reportRoomFilter === "all" ? "" : reportRoomFilter}
                  onChange={(e) => setReportRoomFilter(e.target.value || "all")}
                  className="w-full py-2 px-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none placeholder:text-slate-400 font-medium"
                />
              </div>

              {/* Product selector list */}
              <div className="space-y-1">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">Product Category Item</label>
                <select
                  value={reportProductFilter}
                  onChange={(e) => setReportProductFilter(e.target.value)}
                  className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-700 focus:outline-none"
                >
                  <option value="all">All items / models</option>
                  {allocationProductOptions.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Search input query */}
              <div className="space-y-1 sm:col-span-2">
                <label className="block text-[10.5px] font-extrabold uppercase text-slate-550 tracking-wider">Fuzzy keyword search (Remarks / employee / tags)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    placeholder="E.g. mouse, prenitha, DL-401..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  />
                  {reportSearch && (
                    <button
                      type="button"
                      onClick={() => setReportSearch("")}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Statistics summary row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <span className="p-3 bg-blue-50 text-blue-600 rounded-xl text-lg font-bold">📋</span>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-450 tracking-wider font-sans">Matching Allocation Logs</p>
                <h4 className="text-xl font-black text-slate-850 font-mono">{reportFilteredAllocations.length} records</h4>
                <p className="text-[9px] text-slate-400 mt-0.5">Filtering on selected criteria</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <span className="p-3 bg-indigo-50 text-indigo-600 rounded-xl text-lg font-bold">📦</span>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-455 tracking-wider font-sans">Total Dispatched Items</p>
                <h4 className="text-xl font-black text-indigo-800 font-mono">
                  {reportFilteredAllocations.reduce((sum, a) => sum + a.qty, 0)} units
                </h4>
                <p className="text-[9px] text-slate-400 mt-0.5">Actual volume currently allocated</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <span className="p-3 bg-emerald-50 text-emerald-600 rounded-xl text-lg font-bold">🟢</span>
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-455 tracking-wider font-sans">Active Status Deployments</p>
                <h4 className="text-xl font-black text-emerald-700 font-mono">
                  {reportFilteredAllocations.filter(a => a.status === "Active").reduce((sum, a) => sum + a.qty, 0)} units
                </h4>
                <p className="text-[9px] text-slate-400 mt-0.5">Active deployments in classrooms</p>
              </div>
            </div>
          </div>

          {/* Grand Report Table block */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center select-none font-bold">
              <span className="text-xs uppercase text-slate-650 tracking-wider font-extrabold flex items-center gap-1.5">
                🔢 DISTRIBUTION LEDGER: {reportFilteredAllocations.length} RECORDS DISPLAYED
              </span>
              <span className="text-[10px] text-slate-400 text-right">
                All metrics are computed live from client session memory.
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3 w-12 text-center text-slate-400 border-r border-slate-150">S.No</th>
                    <th className="p-3 w-28 text-slate-500 font-mono border-r border-slate-150">Allocation ID</th>
                    <th className="p-3 w-40 text-slate-650 border-r border-slate-150">Teacher / Personnel</th>
                    <th className="p-3 w-48 text-slate-650 border-r border-slate-150">Hardware Item Name</th>
                    <th className="p-3 w-20 text-center border-r border-slate-150">Allocated Qty</th>
                    <th className="p-3 w-36 border-r border-slate-150">Location Building</th>
                    <th className="p-3 w-36 border-r border-slate-150">Location Room</th>
                    <th className="p-3 w-28 border-r border-slate-150 font-sans">Logged Date</th>
                    <th className="p-3 w-24 text-center border-r border-slate-150 font-sans">Status</th>
                    <th className="p-3">Remarks / Serials</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 leading-normal text-slate-800">
                  {reportFilteredAllocations.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center font-bold text-slate-400 bg-slate-50/50">
                        No hardware deployment logs found. Adjust filters to refine distribution audit.
                      </td>
                    </tr>
                  ) : (
                    reportFilteredAllocations.map((a, idx) => (
                      <tr key={a.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 text-center text-slate-400 text-[11px] font-black bg-slate-50/20 border-r border-slate-150">{idx + 1}</td>
                        <td className="p-3 text-indigo-900 font-extrabold font-mono text-[10.5px] tracking-tight border-r border-slate-150 select-all">{a.id}</td>
                        <td className="p-3 text-slate-900 uppercase font-black tracking-tight border-r border-slate-150">{a.empName}</td>
                        <td className="p-3 text-slate-800 font-bold border-r border-slate-150">{a.itemName}</td>
                        <td className="p-3 text-center font-mono font-black text-indigo-900 bg-slate-50/30 border-r border-slate-150">{a.qty}</td>
                        <td className="p-3 font-extrabold text-slate-700 border-r border-slate-150">{a.building || "LB Nagar Branch"}</td>
                        <td className="p-3 font-semibold text-indigo-850 bg-indigo-50/20 border-r border-slate-150">{a.room || "General Area"}</td>
                        <td className="p-3 font-mono font-medium text-slate-500 text-[11px] border-r border-slate-150">{a.assignedOn}</td>
                        <td className="p-3 text-center border-r border-slate-150">
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                            a.status === "Active" ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 italic max-w-xs truncate" title={a.remarks}>
                          {a.remarks}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : viewMode === "Damaged" ? (
        /* SPECIAL DEDICATED FULL-WIDTH DAMAGED & SCRAP AUDITING DESK */
        <div className="my-8 flex flex-col gap-6 w-full animate-in fade-in duration-200">
          
          {/* Main Controls Panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="p-1.5 bg-red-50 text-red-600 rounded">🚨</span>
                  DAMAGED MATERIALS & SCRAP AUDIT DESK
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Audit corporate assets quarantined as dead/damaged. Select localized periods (day, week, month, year, custom) to export reports.
                </p>
              </div>

              {/* Damaged Specific Exports */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportDamagedExcel}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg tracking-wide flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  EXPORT DAMAGED (.CSV)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalType("Damaged")}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg tracking-wide flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Printer size={14} />
                  EXPORT DAMAGED (.PDF)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("Active")}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-705 text-xs font-bold rounded-lg tracking-wide flex items-center gap-1 border transition-all cursor-pointer"
                >
                  <X size={14} />
                  <span>CLOSE DESK</span>
                </button>
              </div>
            </div>

            {/* Time period query criteria selection toolbar */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-end">
              
              {/* Presets Grid */}
              <div className="xl:col-span-2 space-y-2">
                <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Query Time Preset Constraints
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(["all", "day", "week", "month", "year", "custom"] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDamagedPreset(preset)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        damagedPreset === preset
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 hover:bg-slate-205 text-slate-600"
                      }`}
                    >
                      {preset === "all" ? "All Time" : preset === "day" ? "Today (Day)" : preset === "week" ? "This Week" : preset === "month" ? "This Month" : preset === "year" ? "This Year" : "Custom Dates"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              {damagedPreset === "custom" && (
                <div className="flex gap-3 items-center">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block">From Date</span>
                    <input
                      type="date"
                      value={damagedFromDate}
                      onChange={(e) => setDamagedFromDate(e.target.value)}
                      className="border border-slate-200 bg-slate-50 py-1.5 px-3 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-extrabold text-slate-400 block">To Date</span>
                    <input
                      type="date"
                      value={damagedToDate}
                      onChange={(e) => setDamagedToDate(e.target.value)}
                      className="border border-slate-200 bg-slate-50 py-1.5 px-3 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Search filter input */}
              <div className="space-y-2 relative flex-1 xl:w-auto">
                <label className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Filter by Name / Stock item
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name or item..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

            </div>

            {/* View tab navigation bar for convenient return */}
            <div className="flex gap-2.5 pt-4 border-t border-slate-100">
              <button
                onClick={() => setViewMode("Active")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase rounded-lg tracking-wider"
              >
                Active Allocations
              </button>
              <button
                onClick={() => setViewMode("Returned")}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold uppercase rounded-lg tracking-wider"
              >
                Returned History
              </button>
              <button
                onClick={() => setViewMode("Damaged")}
                className="px-4 py-2 bg-red-700 text-white text-xs font-bold uppercase rounded-lg tracking-wider shadow"
              >
                🚨 Damaged Scrap Audit
              </button>
            </div>

          </div>

          {/* Damaged analytics bento stats row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block mb-1">
                Audited Damaged Line Items
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-black text-rose-650">{damagedFilteredList.length}</p>
                <span className="text-xs text-slate-400">records</span>
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block mb-1">
                Total Destroyed/Scrap Units
              </span>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-mono font-black text-slate-800">{totalDamagedQty}</p>
                <span className="text-xs text-slate-400">hardware units</span>
              </div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm col-span-2">
              <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase block mb-1">
                Reporting Range Details
              </span>
              <p className="text-xs font-bold text-slate-700 font-mono mt-2">
                {damagedPreset === "all" && "All Time records of damaged scrap logbooks."}
                {damagedPreset === "day" && "Day-wise constraints: Filtered strictly for today's entries."}
                {damagedPreset === "week" && "Week-wise constraints: Filtered strictly for last 7 days entries."}
                {damagedPreset === "month" && "Month-wise constraints: Filtered strictly for last 30 days."}
                {damagedPreset === "year" && "Year-wise constraints: Filtered strictly for last 365 days."}
                {damagedPreset === "custom" && `Custom ranges: From [${damagedFromDate || "..."}] to [${damagedToDate || "..."}]`}
              </p>
            </div>
          </div>

          {/* Damaged Records table list container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
            <h4 className="text-xs font-extrabold uppercase text-slate-400 tracking-wider">
              Scrap Bin Verification List
            </h4>

            {damagedFilteredList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Inbox size={44} className="stroke-slate-350 animate-pulse" />
                <p className="text-xs font-semibold">No damaged material records matched this period query.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {damagedFilteredList.map((a, index) => (
                  <div 
                    key={a.id} 
                    className="p-4 rounded-xl border border-red-100 bg-red-50/10 hover:bg-rose-50/20 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-red-600">
                          👤 Damaged by: {a.empName}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400 font-mono">
                          Allocation Reference: {a.id}
                        </span>
                      </div>
                      <h5 className="text-sm font-extrabold text-slate-800">
                        ❌ {a.itemName} (Scrap Quantity: {a.qty} Unit)
                      </h5>
                      <div className="text-xs text-slate-500 font-medium space-x-3 flex items-center">
                        <span className="font-mono">📥 Issued: {a.assignedOn}</span>
                        <span className="text-slate-300">|</span>
                        <span className="text-red-650 font-bold font-mono">🚨 Scrapped On: {a.returnedOn}</span>
                      </div>
                      <p className="text-[11px] text-slate-450 font-bold italic bg-white inline-block px-2.5 py-1 rounded border border-slate-100 mt-1">
                        🛠️ Diagnostic Remarks/Serials: {a.remarks}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[9.5px] font-extrabold px-2.5 py-1 bg-red-100 text-red-700 border border-red-200 rounded uppercase tracking-wide inline-block">
                        Dead / Demolished
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      ) : viewMode === "Profiles" ? (
        /* BRAND NEW SPECIALLY DESIGNED EMPLOYEE PROFILE DIRECTORY AND CLEARANCE DOSSIER SHEET */
        <div className="my-8 flex flex-col gap-6 w-full animate-in fade-in duration-200 text-slate-800">
          
          {/* Back Navigation Bar for Profiles */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm w-full gap-4">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-amber-50 rounded text-base">👤</span>
              <div>
                <span className="text-xs font-black text-slate-900 uppercase tracking-wide block font-sans">
                  Employee Dossier Desk & Clearance Directory
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Review staff history, filter outstanding corporate devices, and print certified IT clearance documents.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewMode("Active")}
              className="px-4 py-2 text-xs bg-slate-900 hover:bg-slate-800 text-white font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow hover:shadow-md uppercase tracking-wider font-sans whitespace-nowrap"
            >
              ← Back to Active Allocations
            </button>
          </div>

          <div className="flex flex-col xl:flex-row gap-8 items-start w-full">
            {/* Left panel: Employee Directory roster (scrollable) */}
          <div className="w-full xl:w-80 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0 flex flex-col max-h-[750px]">
            <div className="space-y-1">
              <h4 className="text-sm font-extrabold uppercase text-slate-900 tracking-wide font-sans">
                Personnel Directory
              </h4>
              <p className="text-[10px] text-slate-500 font-medium font-sans">
                Select a staff member to audit active balances or process instant clearance deeds.
              </p>
            </div>

            {/* Local Directory Fast Search */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={empRosterSearch}
                onChange={(e) => setEmpRosterSearch(e.target.value)}
                placeholder="Search staff record..."
                className="w-full pl-9 pr-3 py-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 rounded-lg text-xs font-semibold text-slate-800 focus:outline-[#DD6B20] focus:outline-none focus:ring-0"
              />
              {empRosterSearch && (
                <button
                  type="button"
                  onClick={() => setEmpRosterSearch("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Directory Cards list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[500px] pr-1 custom-scrollbar">
              {Array.from(new Set(allocations.map(a => a.empName.trim())))
                .sort((a,b) => a.localeCompare(b))
                .filter(name => !empRosterSearch.trim() || name.toLowerCase().includes(empRosterSearch.toLowerCase()))
                .map((name) => {
                  const itemsOfEmp = allocations.filter(a => a.empName.trim().toUpperCase() === name.toUpperCase());
                  const activeCount = itemsOfEmp.filter(a => a.status === "Active").reduce((sum, item) => sum + item.qty, 0);
                  const returnedCount = itemsOfEmp.filter(a => a.status === "Returned").reduce((sum, item) => sum + item.qty, 0);
                  const isSelected = selectedEmpName.toUpperCase() === name.toUpperCase();

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSelectedEmpName(name)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all flex flex-col gap-1.5 cursor-pointer ${
                        isSelected 
                          ? "bg-amber-50/70 border-amber-500 shadow-sm ring-1 ring-amber-500" 
                          : "bg-white hover:bg-slate-50 border-slate-200"
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2 w-full">
                        <span className={`text-xs font-extrabold truncate ${isSelected ? "text-amber-950" : "text-slate-800"}`} title={name}>
                          👤 {name}
                        </span>
                        {activeCount === 0 ? (
                          <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wider shrink-0">
                            Cleared
                          </span>
                        ) : (
                          <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase tracking-wider shrink-0 animate-pulse">
                            {activeCount} Held
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 font-sans">
                        <span className="flex items-center gap-0.5">
                          💼 Active: <strong className={activeCount > 0 ? "text-amber-700 font-mono font-black" : "text-slate-500 font-mono"}>{activeCount}</strong>
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                          🔙 Returned: <strong className="font-mono">{returnedCount}</strong>
                        </span>
                      </div>
                    </button>
                  );
                })}
              
              {Array.from(new Set(allocations.map(a => (a.empName || "").trim().toUpperCase()))).filter(name => Boolean(name) && (!empRosterSearch.trim() || name.toLowerCase().includes(empRosterSearch.toLowerCase()))).length === 0 && (
                <div className="py-12 text-center text-slate-405 text-xs italic font-medium">
                  No personnel matching that query found.
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Digital Dossier Clearance Sheet */}
          <div className="flex-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
            {!selectedEmpName ? (
              <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Inbox size={48} className="text-slate-300 animate-pulse" />
                <h4 className="text-sm font-bold text-slate-700">Digital Registry Ledger Empty</h4>
                <p className="text-xs text-slate-500 max-w-sm text-center">
                  Select an employee from the left staff directory list to examine active hardware balances, transaction dates, and compile official clearance receipts.
                </p>
              </div>
            ) : (() => {
              const activeCode = (selectedEmpName || "").trim();
              const empAllocations = allocations.filter(a => (a.empName || "").trim().toUpperCase() === activeCode.toUpperCase());
              const activeEmpAllocations = empAllocations.filter(a => a.status === "Active");
              const returnedEmpAllocations = empAllocations.filter(a => a.status === "Returned");
              const damagedEmpAllocations = returnedEmpAllocations.filter(a => a.condition === "Damaged");

              const activeQtySum = activeEmpAllocations.reduce((sum, item) => sum + item.qty, 0);
              const returnedQtySum = returnedEmpAllocations.reduce((sum, item) => sum + item.qty, 0);

              return (
                <div className="space-y-6">
                  
                  {/* Ledger Header Badge Container */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#DD6B20] bg-orange-100/60 px-2 py-0.5 rounded">
                          Official IT Record Dossier
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ID Ref: PERS-{activeCode.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase()}
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-slate-900 mt-1 uppercase font-sans tracking-tight">
                        👤 {activeCode}
                      </h3>
                      <p className="text-xs text-slate-505 font-medium">
                        Detailed personnel ledger history of hardware, devices, and accessories received across separate academic terms.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPrintModalType("Clearance")}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-755 text-white text-xs font-black rounded-lg tracking-wide shadow flex items-center gap-1.5 transition-colors cursor-pointer font-sans"
                      >
                        <Printer size={14} />
                        EXPORT IMMUTABLE PDF RECEIPT (.PDF)
                      </button>
                    </div>
                  </div>

                  {/* Status Banner */}
                  {activeQtySum === 0 ? (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center gap-3.5">
                      <div className="p-2 bg-emerald-100 rounded-lg text-emerald-800 text-lg">💡</div>
                      <div>
                        <strong className="text-xs font-black uppercase tracking-wider block text-emerald-950">
                          🟢 STATUS: ALL ASSETS CLEAR / RECOVERED
                        </strong>
                        <p className="text-xs text-emerald-700 font-medium">
                          All previously allocated corporate hardware and diagnostic accessories have been successfully returned, recovered, and returned to storage. Account stands at zero balance.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50/70 border border-amber-200 text-amber-900 rounded-xl flex items-center gap-3.5">
                      <div className="p-2 bg-amber-100 rounded-lg text-amber-800 text-lg">⚠️</div>
                      <div>
                        <strong className="text-xs font-black uppercase tracking-wider block text-amber-950">
                          🟠 STATUS: OUTSTANDING ACTIVE DEVICES BALANCE
                        </strong>
                        <p className="text-xs text-amber-700 font-medium font-sans">
                          Staff member holds {activeQtySum} outstanding devices. Reconcile return statuses or record scraps before conducting final human resources checkout clearance.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Corporate Statistics Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-450 block tracking-wider mb-1">
                        Outstanding Hardware Held
                      </span>
                      <strong className="text-xl font-mono text-amber-600 block font-black">
                        {activeQtySum} units
                      </strong>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-450 block tracking-wider mb-1">
                        Returned & Restored
                      </span>
                      <strong className="text-xl font-mono text-emerald-600 block font-black">
                        {returnedQtySum} units
                      </strong>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-450 block tracking-wider mb-1">
                        Total Lifetime Items
                      </span>
                      <strong className="text-xl font-mono text-slate-900 block font-black">
                        {empAllocations.length} items
                      </strong>
                    </div>

                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-450 block tracking-wider mb-1">
                        Damaged/Scrapped Rate
                      </span>
                      <strong className="text-xl font-mono text-red-650 block font-black">
                        {damagedEmpAllocations.length} units
                      </strong>
                    </div>
                  </div>

                  {/* ITEMIZED TRANS LINES BLOCKS */}
                  <div className="space-y-6">
                    
                    {/* Active/Outstanding List section */}
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider font-sans">
                          🎁 ACTIVE ASSETS CURRENTLY DEPLOYED ({activeEmpAllocations.length})
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400">
                          Reconcile below items instantly
                        </span>
                      </div>

                      {activeEmpAllocations.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-slate-400 text-xs italic font-semibold">
                          No active outstanding hardware allocations registered to this profile.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-white font-extrabold uppercase text-[9px] tracking-wider">
                                <th className="p-3 border-r border-slate-800 text-center w-10">S.N</th>
                                <th className="p-3 border-r border-slate-800 w-24">Log Ref</th>
                                <th className="p-3 border-r border-slate-800">Device Material Name</th>
                                <th className="p-3 border-r border-slate-800 w-36">Location Room</th>
                                <th className="p-3 border-r border-slate-800 w-28 text-center font-mono">Assigned On</th>
                                <th className="p-3 border-r border-slate-800 w-16 text-center">Qty</th>
                                <th className="p-3 text-center w-28">Action Opposition</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                              {activeEmpAllocations.map((a, i) => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 text-center text-slate-400 font-bold border-r border-slate-150 bg-slate-50/10">{i + 1}</td>
                                  <td className="p-3 font-mono text-[9px] text-[#2C5282] uppercase tracking-wider font-extrabold border-r border-slate-150">{a.id}</td>
                                  <td className="p-3 border-r border-slate-150">
                                    <span className="font-extrabold text-slate-900 block leading-tight">{a.itemName}</span>
                                    <span className="text-[9px] text-slate-450 font-semibold block italic mt-1" title={a.remarks}>
                                      🏷️ Remarks: {a.remarks}
                                    </span>
                                  </td>
                                  <td className="p-3 border-r border-slate-150">
                                    <span className="text-[9.5px] font-bold text-slate-800 block">🏢 {a.building || "New School Building"}</span>
                                    <span className="text-[9px] font-semibold text-indigo-700 font-sans block mt-0.5">🚪 {a.room || "General Area"}</span>
                                  </td>
                                  <td className="p-3 text-center text-[9.5px] text-slate-500 font-mono border-r border-slate-150">{a.assignedOn}</td>
                                  <td className="p-3 text-center font-mono font-black border-r border-slate-150 text-slate-900">{a.qty}</td>
                                  <td className="p-3 text-center">
                                    <div className="flex flex-col gap-1.5 justify-center">
                                      <div className="flex gap-1.5 w-full">
                                        <button
                                          type="button"
                                          onClick={() => setViewingItem(a)}
                                          className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-[9px] font-black tracking-wide flex items-center justify-center transition-all cursor-pointer shadow-xs uppercase"
                                          title="View"
                                        >
                                          View
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setEditingItem(a); setEditRemarks(a.remarks || ""); }}
                                          className="flex-1 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded text-[9px] font-black tracking-wide flex items-center justify-center transition-all cursor-pointer shadow-xs uppercase"
                                          title="Edit Remarks"
                                        >
                                          Edit
                                        </button>
                                      </div>
                                      {a.assigneeType === "Room" ? (
                                        <button
                                          type="button"
                                          onClick={() => setDeletingItem({ id: a.id, allocation: a })}
                                          className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-black tracking-wide flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs font-sans uppercase"
                                        >
                                          <Trash2 size={11} />
                                          Delete
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => setReturningItem({ id: a.id, allocation: a })}
                                          className="w-full py-1.5 px-3 bg-[#DD6B20] hover:bg-orange-600 text-white rounded text-[10px] font-black tracking-wide flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs font-sans uppercase"
                                        >
                                          <RotateCcw size={11} />
                                          Return
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Returned History List section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                        <h4 className="text-xs font-black text-slate-500 flex items-center gap-1.5 uppercase tracking-wider">
                          🔙 CLEARED & RETURNED HISTORIC LOGBOOKS ({returnedEmpAllocations.length})
                        </h4>
                        <span className="text-[9px] font-bold text-slate-400">
                          Reconciliation history
                        </span>
                      </div>

                      {returnedEmpAllocations.length === 0 ? (
                        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/40 text-slate-400 text-xs italic font-semibold">
                          No previously returned or scrapped hardware items logged for this personnel.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[9px] tracking-wider border-b border-slate-200">
                                <th className="p-3 border-r border-slate-200 text-center w-10">S.N</th>
                                <th className="p-3 border-r border-slate-200 w-24">Log Ref</th>
                                <th className="p-3 border-r border-slate-150">Device Material Name</th>
                                <th className="p-3 border-r border-slate-150 w-28 text-center font-mono">Assigned On</th>
                                <th className="p-3 border-r border-slate-150 w-28 text-center font-mono">Returned On</th>
                                <th className="p-3 border-r border-slate-150 w-16 text-center">Qty</th>
                                <th className="p-3 text-center w-28">Diagnostic Case</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150 text-slate-655 font-medium">
                              {returnedEmpAllocations.map((a, i) => (
                                <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 text-center text-slate-400 font-bold border-r border-slate-150 bg-slate-50/10">{i + 1}</td>
                                  <td className="p-3 font-mono text-[9px] text-slate-500 uppercase tracking-wider border-r border-slate-150">{a.id}</td>
                                  <td className="p-3 border-r border-slate-150">
                                    <span className="font-bold text-slate-800 block leading-tight">{a.itemName}</span>
                                    <span className="text-[9px] text-slate-450 font-semibold block italic mt-1" title={a.remarks}>
                                      🏷️ Remarks: {a.remarks}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center text-[9.5px] text-slate-500 font-mono border-r border-slate-150">{a.assignedOn}</td>
                                  <td className="p-3 text-center text-[9.5px] text-emerald-600 font-mono font-bold border-r border-slate-150">{a.returnedOn}</td>
                                  <td className="p-3 text-center font-mono border-r border-slate-150 text-slate-800">{a.qty}</td>
                                  <td className="p-3 text-center">
                                    {a.condition === "Working" ? (
                                      <span className="text-[8.5px] font-black px-2 py-0.5 rounded bg-emerald-105 text-emerald-800 border border-emerald-200 uppercase tracking-widest inline-block font-sans">
                                        ✅ Working
                                      </span>
                                    ) : (
                                      <span className="text-[8.5px] font-black px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-220 uppercase tracking-widest inline-block font-sans">
                                        ❌ Scrapped/Dead
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })()}
          </div>

        </div>
      </div>
      ) : (
        /* REGULAR LAYOUT FOR ACTIVE AND RETURNED CHANNELS WITH LEFT SIDE FORM */
        <div className="my-8 flex flex-col lg:flex-row gap-8 items-start w-full animate-in fade-in duration-200">
          
          {/* Left Form: Assign Asset */}
          <form onSubmit={handleAssign} className="w-full lg:w-96 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0">
            <div className="text-center">
              <h3 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-100 font-sans">
                Assign New Asset
              </h3>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setAssigneeType("Employee")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${assigneeType === "Employee" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}
              >
                To Employee
              </button>
              <button
                type="button"
                onClick={() => setAssigneeType("Room")}
                className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${assigneeType === "Room" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"}`}
              >
                To Room Directly
              </button>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">
                {assigneeType === "Room" ? "Installed By (Admin Name)" : "Employee Name / ID"}
              </label>
              <input
                type="text"
                required
                value={empName}
                onChange={(e) => setEmpName(e.target.value)}
                placeholder={assigneeType === "Room" ? "E.g. IT Admin Name" : "E.g. PRENITHA MAAM"}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Hardware Asset Location</label>
              <select
                value={selectedInvId}
                onChange={(e) => setSelectedInvId(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="">Select Asset from Inventory</option>
                {stockInventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.itemName} (Stock balance: {item.balanceQty} units)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Quantity required</label>
              <input
                type="number"
                min="1"
                required
                value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Destination Building</label>
              <select
                value={selectedBuilding}
                onChange={(e) => {
                  setSelectedBuilding(e.target.value);
                  setSelectedRoomId(""); // Reset room assignment when building changes
                }}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                {UI_BUILDINGS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
                <option value="Custom">Custom / Other Building</option>
              </select>
              {selectedBuilding === "Custom" && (
                <input
                  type="text"
                  required
                  value={customBuilding}
                  onChange={(e) => setCustomBuilding(e.target.value)}
                  placeholder="Enter building name..."
                  className="w-full mt-1.5 py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Destination Room / Department</label>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                <option value="">Select Target Room</option>
                {availableRoomsFiltered.map((r) => (
                  <option key={r.id} value={`${r.roomNumber} (${r.className})`}>
                    {r.roomNumber} - {r.className} ({r.dept})
                  </option>
                ))}
                <option value="Custom">Custom / Other Room</option>
              </select>
              {selectedRoomId === "Custom" && (
                <input
                  type="text"
                  required
                  value={customRoom}
                  onChange={(e) => setCustomRoom(e.target.value)}
                  placeholder="Enter room number or wing name..."
                  className="w-full mt-1.5 py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Remarks / Serial Number</label>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="E.g. Service Tag: DL-40192, Admin desk"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#3182CE] hover:bg-[#2B6CB0] text-white rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <ShieldCheck size={16} />
              CONFIRM ALLOCATION DEPLOYMENT
            </button>
          </form>

          {/* Right ledger tables filters */}
          <div className="flex-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
            
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
              
              {/* View selectors */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("Active")}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all cursor-pointer ${
                    viewMode === "Active" ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Active Allocations
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("Returned")}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all cursor-pointer ${
                    viewMode === "Returned" ? "bg-slate-900 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Returned History
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("Profiles");
                    const uniqueNames = Array.from(new Set(allocations.map(a => (a.empName || "").trim()))).filter(Boolean).sort((a, b) => a.localeCompare(b));
                    if (uniqueNames.length > 0 && !selectedEmpName) {
                      setSelectedEmpName(uniqueNames[0]);
                    }
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all border cursor-pointer ${
                    (viewMode as string) === "Profiles" ? "bg-[#DD6B20] text-white shadow border-[#DD6B20]" : "bg-amber-50 text-amber-800 hover:bg-amber-105 border-amber-200"
                  }`}
                >
                  👤 Employee Dossier Desk
                </button>
                 <button
                  type="button"
                  onClick={() => {
                    setViewMode("Damaged");
                    setDamagedPreset("all");
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all border cursor-pointer ${
                    (viewMode as string) === "Damaged" ? "bg-red-750 text-white shadow border-red-750" : "bg-red-50 text-red-650 hover:bg-red-100 border-red-200"
                  }`}
                >
                  🚨 Damaged Materials
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("Report");
                    setReportPreset("all");
                  }}
                  className={`px-4 py-2 text-xs font-bold uppercase rounded-lg tracking-wider transition-all border cursor-pointer ${
                    (viewMode as string) === "Report" ? "bg-indigo-900 text-white shadow border-indigo-900" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200"
                  }`}
                >
                  📍 Usage & Room Reports
                </button>
              </div>

              {/* Quick search inputs */}
              <div className="flex gap-2.5 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search name or stock..."
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {viewMode === "Returned" && (
                  <button
                    type="button"
                    onClick={handleArchiveHistoryData}
                    className="px-3 py-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 font-extrabold cursor-pointer transition-colors shrink-0"
                  >
                    🧹 PURGE ARCHIVES
                  </button>
                )}
              </div>
              
            </div>

            {/* Table list content */}
            <div className="p-4 space-y-4 overflow-y-auto max-h-[500px] custom-scrollbar">
              
              {/* BRAND NEW: ELITE CORPORATE DATA RETENTION POLICY BOARD */}
              {viewMode === "Returned" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 mb-4 space-y-4 shadow-sm animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm">📂</span>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none font-sans">
                          BIRLA OPEN MINDS INTERNATIONAL SCHOOL DATA RETENTION MANAGER
                        </h4>
                        <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase font-mono tracking-wide">
                          AUTOMATED COMPLIANCE — STORAGE & LOGS OPTIMIZER
                        </p>
                      </div>
                    </div>
                    {/* Select controller for Policy Longevity */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wider">
                        Retention Period:
                      </span>
                      <select
                        value={retentionMonths}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setRetentionMonths(val);
                          localStorage.setItem("sgs_retention_policy_months", String(val));
                        }}
                        className="py-1 px-2.5 border border-slate-200 rounded bg-white text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={3}>3 Months (90 Days)</option>
                        <option value={6}>6 Months (180 Days - Recommended)</option>
                        <option value={12}>1 Year (365 Days)</option>
                      </select>
                    </div>
                  </div>

                  {/* Informational Banner */}
                  <p className="text-xs text-slate-600 leading-snug font-medium select-text">
                    💡 <strong className="text-slate-800">Corporate Compliance Standard:</strong> After equipment is returned back to active school stores, logs are retained for <strong className="text-indigo-700 font-bold">{retentionMonths} Months</strong> to complete financial tallies, after which they are safe to be compiled into downloadable offline spreadsheets and purged from server memory to guarantee lightweight, high-performance database execution.
                  </p>

                  {/* Operational Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-center">
                    <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-xs">
                      <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider">Total Returned Logs</p>
                      <p className="text-base font-black font-mono text-slate-800 mt-1 select-all">
                        {getRetentionAnalysis().totalReturned} Records
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-150 shadow-xs">
                      <p className="text-[9px] text-amber-600 font-extrabold uppercase tracking-wider">Beyond Retention Period ({retentionMonths}M+)</p>
                      <p className={`text-base font-black font-mono mt-1 select-all ${getRetentionAnalysis().expiredRecords.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                        {getRetentionAnalysis().expiredRecords.length} Records
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-155 shadow-xs">
                      <p className="text-[9px] text-emerald-600 font-extrabold uppercase tracking-wider">Storage Savings Reclaimed</p>
                      <p className="text-base font-black font-mono text-emerald-600 mt-1">
                        {getRetentionAnalysis().savedStorePercentage}% Optimized
                      </p>
                    </div>
                  </div>

                  {/* Storage Action Controller buttons */}
                  {getRetentionAnalysis().expiredRecords.length > 0 ? (
                    <div className="bg-amber-50/50 border border-amber-200/80 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                      <div className="space-y-0.5">
                        <p className="text-xs font-extrabold text-amber-850 uppercase tracking-wide">
                          ⚠️ Action Suggested: {getRetentionAnalysis().expiredRecords.length} Expired Logs Ready for Archival
                        </p>
                        <p className="text-[10.5px] font-medium text-slate-500">
                          Export these expired logs to local CSV archives and optimize server storage safely.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handlePurgeExpiredRecords}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-lg tracking-wider space-x-1.5 shadow-sm transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <FileSpreadsheet size={14} />
                        <span>ARCHIVE & PURGE {getRetentionAnalysis().expiredRecords.length} LOGS NOW 📥</span>
                      </button>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/20 border border-emerald-150 rounded-lg p-3 text-center py-2 flex items-center justify-center gap-1.5 text-emerald-850">
                      <span className="text-xs">🏆</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider">
                        All returned logs are currently within safe guidelines. Database is completely optimized!
                      </span>
                    </div>
                  )}
                </div>
              )}

              {filteredAllocations.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                  <Inbox size={40} className="stroke-slate-300 animate-pulse" />
                  <p className="text-xs font-semibold">No active employee allocation logs found.</p>
                </div>
              ) : (
                filteredAllocations.map((a) => (
                  <div key={a.id} className="p-4 rounded-xl border border-slate-200/80 hover:bg-slate-50/10 transition-colors bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="space-y-1 select-text">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-extrabold text-[#3182CE]">
                          👤 {a.empName}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          Allocate Log: {a.id}
                        </span>
                      </div>

                      <h4 className="text-sm font-extrabold text-slate-800 leading-snug">
                        📦 {a.itemName} (Allocated Qty: {a.qty})
                      </h4>

                      {/* Room & Building Location parameters */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] my-1 font-semibold">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-650 rounded border border-slate-200 flex items-center gap-1">
                          🏢 {a.building || "LB Nagar Branch"}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50/70 text-indigo-700 rounded border border-indigo-100/70 flex items-center gap-1">
                          🚪 {a.room || "General Area"}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 font-medium space-x-4">
                        <span>📥 Assigned: {a.assignedOn}</span>
                        {a.status === "Returned" && (
                          <>
                            <span className="font-bold text-slate-400">|</span>
                            <span className="text-emerald-600 font-bold">🔙 Returned On: {a.returnedOn}</span>
                            <span className="font-bold text-slate-400">|</span>
                            <span className={`font-bold ${a.condition === "Working" ? "text-emerald-600" : "text-rose-600"}`}>
                              Cond: {a.condition}
                            </span>
                          </>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 font-semibold italic">
                        🏷️ Remarks/Serials: {a.remarks}
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 shrink-0">
                      <div className="flex gap-2 w-full justify-end">
                        <button
                          onClick={() => setViewingItem(a)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        {a.status === "Active" && (
                          <button
                            onClick={() => { setEditingItem(a); setEditRemarks(a.remarks || ""); }}
                            className="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-[10px] font-extrabold tracking-wide uppercase transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      {a.status === "Active" && (
                        <>
                          {a.assigneeType === "Room" ? (
                            <button
                              onClick={() => setDeletingItem({ id: a.id, allocation: a })}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-extrabold tracking-wide flex items-center justify-center gap-1.5 shadow shadow-sm transition-colors cursor-pointer w-full"
                            >
                              <Trash2 size={13} />
                              DELETE 🗑️
                            </button>
                          ) : (
                            <button
                              onClick={() => setReturningItem({ id: a.id, allocation: a })}
                              className="px-4 py-2 bg-[#DD6B20] hover:bg-orange-600 text-white rounded-lg text-xs font-extrabold tracking-wide flex items-center justify-center gap-1.5 shadow shadow-sm transition-colors cursor-pointer w-full"
                            >
                              <RotateCcw size={13} />
                              RETURN ITEM 🔙
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

          </div>

        </div>
      )}

      {/* Return confirmation process modal overlay popup */}
      {returningItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-[#DD6B20] text-white">
              <h3 className="font-bold text-base">Process Allocations Return</h3>
              <button 
                onClick={() => setReturningItem(null)}
                className="hover:bg-orange-700/60 p-1 rounded-lg text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-slate-700 font-medium">
              <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100 text-slate-700 text-xs text-center space-y-1">
                <p>Returning hardware spec allocated to:</p>
                <p className="text-[#DD6B20] font-bold text-sm block">{returningItem.allocation.empName}</p>
                <p className="font-semibold block">{returningItem.allocation.itemName} (Qty: {returningItem.allocation.qty})</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider text-center">
                  What is the condition of the returned item?
                </label>

                <div className="flex gap-4 pt-1">
                  {/* Working choice option */}
                  <label className="flex-1 flex flex-col items-center justify-center p-4 border rounded-xl hover:bg-slate-50 cursor-pointer border-slate-200">
                    <input
                      type="radio"
                      name="condition"
                      checked={returnCondition === "Working"}
                      onChange={() => setReturnCondition("Working")}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer mb-2"
                    />
                    <span className="text-xs font-bold text-slate-800">✅ Good / Working</span>
                    <span className="text-[10px] text-slate-400 mt-1 uppercase">Restored to active pool</span>
                  </label>

                  {/* Damaged / Scrap choice option */}
                  <label className="flex-1 flex flex-col items-center justify-center p-4 border rounded-xl hover:bg-slate-50 cursor-pointer border-slate-200">
                    <input
                      type="radio"
                      name="condition"
                      checked={returnCondition === "Damaged"}
                      onChange={() => setReturnCondition("Damaged")}
                      className="w-4 h-4 text-rose-600 focus:ring-rose-500 cursor-pointer mb-2"
                    />
                    <span className="text-xs font-bold text-slate-800">❌ Damaged / Dead</span>
                    <span className="text-[10px] text-slate-400 mt-1 uppercase">Purged as scrap bin list</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setReturningItem(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 bg-white cursor-pointer"
              >
                Discard Change
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                className="px-5 py-2.5 bg-[#DD6B20] hover:bg-orange-600 text-white text-xs font-bold rounded-lg cursor-pointer shadow"
              >
                PROCEED WITH RETURN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation process modal overlay popup */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-red-600 text-white">
              <h3 className="font-bold text-base">Delete Room Allocation</h3>
              <button 
                onClick={() => { setDeletingItem(null); setDeleteRemarks(""); }}
                className="hover:bg-red-700/60 p-1 rounded-lg text-white"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-slate-700 font-medium">
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 text-slate-700 text-xs text-center space-y-1">
                <p>Deleting hardware allocation for room:</p>
                <p className="text-red-600 font-bold text-sm block">{deletingItem.allocation.room}</p>
                <p className="font-semibold block">{deletingItem.allocation.itemName} (Qty: {deletingItem.allocation.qty})</p>
                <p className="text-[10px] text-red-500 mt-2 font-bold uppercase tracking-wider">Warning: This action will restore stock count and record a log entry.</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider text-left">
                  Deletion Remarks / Reason (Required):
                </label>
                <textarea
                  value={deleteRemarks}
                  onChange={(e) => setDeleteRemarks(e.target.value)}
                  placeholder="E.g. Camera replaced by vendor, duplicate entry..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-red-600 focus:outline-none min-h-[80px]"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => { setDeletingItem(null); setDeleteRemarks(""); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!deleteRemarks.trim()}
                className={`px-5 py-2.5 text-white text-xs font-bold rounded-lg shadow transition-colors ${!deleteRemarks.trim() ? "bg-slate-300 cursor-not-allowed" : "bg-red-600 hover:bg-red-700 cursor-pointer"}`}
              >
                CONFIRM DELETION
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-800 text-white">
              <h3 className="font-bold text-base">Edit Allocation Remarks</h3>
              <button 
                onClick={() => { setEditingItem(null); setEditRemarks(""); }}
                className="hover:bg-slate-700 p-1 rounded-lg text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-slate-700 font-medium">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700 text-xs text-center space-y-1">
                <p>Editing entry for:</p>
                <p className="text-slate-800 font-bold text-sm block">{editingItem.assigneeType === "Room" ? editingItem.room : editingItem.empName}</p>
                <p className="font-semibold block">{editingItem.itemName} (Qty: {editingItem.qty})</p>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-extrabold text-slate-500 uppercase tracking-wider text-left">
                  Remarks / Serial Number:
                </label>
                <textarea
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="E.g. S/N: 12345..."
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-slate-600 focus:outline-none min-h-[80px]"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => { setEditingItem(null); setEditRemarks(""); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 bg-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow transition-colors cursor-pointer"
              >
                SAVE CHANGES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Viewing Item Modal */}
      {viewingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-blue-600 text-white">
              <h3 className="font-bold text-base flex items-center gap-2"><Info size={18} /> Allocation Details</h3>
              <button 
                onClick={() => setViewingItem(null)}
                className="hover:bg-blue-700 p-1 rounded-lg text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-slate-700 font-medium">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">ID</label>
                  <span className="font-mono text-xs">{viewingItem.id}</span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Status</label>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${viewingItem.status === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                    {viewingItem.status}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned Type</label>
                  <span className="text-xs">{viewingItem.assigneeType}</span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned To</label>
                  <span className="text-xs font-bold">{viewingItem.assigneeType === "Room" ? viewingItem.room : viewingItem.empName}</span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Item</label>
                  <span className="text-xs font-bold">{viewingItem.itemName}</span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Quantity</label>
                  <span className="text-xs font-mono">{viewingItem.qty}</span>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Assigned On</label>
                  <span className="text-xs font-mono">{viewingItem.assignedOn}</span>
                </div>
                {viewingItem.status === "Returned" && (
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Returned On</label>
                    <span className="text-xs font-mono">{viewingItem.returnedOn}</span>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Remarks / Serial</label>
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs mt-1 min-h-[60px]">
                    {viewingItem.remarks || <span className="italic text-slate-400">No remarks provided.</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXECUTIVE FULL-SCREEN MODAL LAYOUT */}
      {printModalType && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 md:p-8 z-[1000] animate-fade-in text-slate-900 select-text">
          <div className="bg-white border border-slate-400 shadow-2xl rounded-2xl w-full max-w-5xl overflow-hidden flex flex-col shrink-0">
            
            {/* Modal Tool Bar Panel */}
            <div className="p-4 bg-slate-150 border-b border-slate-200 flex justify-between items-center text-slate-700 select-none no-print">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600" />
                 <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  {printModalType === "UsageReport"
                    ? "Used Stock & Location Audit PDF Builder"
                    : printModalType === "Clearance"
                    ? "Personnel Digital IT Clearance Sheet PDF Builder"
                    : printModalType === "Allocations"
                    ? "Employee Allocations PDF Report Builder"
                    : "Damaged Material Audit PDF Report Builder"}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintEmployeeReport}
                  className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all uppercase"
                >
                  <Printer size={13} />
                  <span>PRINT TO PDF NOW</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintModalType(null)}
                  className="p-1 text-slate-450 hover:text-slate-800 rounded bg-white hover:bg-slate-100 transition-all cursor-pointer border"
                  title="Close Preview Window"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Print Instructions Bar */}
            <div className="p-3 bg-blue-50 border-b border-blue-100 text-blue-900 text-[10.5px] leading-relaxed flex items-center gap-1.5 select-none no-print">
              <Info size={14} className="shrink-0 text-blue-600" />
              <span>
                <strong>System Print Guide:</strong> When the browser dialog loads, select <strong>"Save as PDF"</strong> as printer. The page layout will render only the elegant A4 paper sheets below without panels.
              </span>
            </div>

            {/* PRINT CANVAS */}
            <div className="p-8 md:p-12 bg-slate-100 max-w-full overflow-x-auto print-document-canvas custom-scrollbar flex justify-center">
              
              <div 
                id="print-employee-preview"
                className="w-[8.27in] min-h-[11.69in] bg-white border border-slate-350 p-[0.75in] text-slate-900 shadow-xl relative flex flex-col justify-between"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {renderEmployeePrintContent()}
              </div>

            </div>

            {/* Modal Footer actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 select-none">
              <button
                type="button"
                onClick={() => setPrintModalType(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-xs transition-all uppercase cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handlePrintEmployeeReport}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs flex items-center gap-1.5 shadow transition-all uppercase cursor-pointer"
              >
                <Printer size={13} />
                <span>PRINT AS PDF NOW</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Portalled Print Output direct to document body to bypass iframe constraints and parent modal styling overlays on print */}
      {printModalType && createPortal(
        <div 
          id="print-employee-root"
          className="hidden print:block bg-white p-[0.75in] text-slate-900 relative"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {renderEmployeePrintContent()}
        </div>,
        document.body
      )}

    </div>
  );
}
