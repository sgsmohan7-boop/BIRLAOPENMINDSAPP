import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Plus, Search, HelpCircle, Save, Calendar, Trash2, ArrowUpRight, School, GraduationCap, Download } from "lucide-react";
import { Room, SchoolBranch, EmployeeAllocation } from "../types";
import { SHEET_ALLOCATED_ROOMS } from "../utils/sheetAllocations";

interface RoomMasterProps {
  rooms: Room[];
  updateRooms: (rms: Room[]) => void;
  allocations?: EmployeeAllocation[];
}

const DEPT_ASSETS: Record<string, string[]> = {
  "Classroom": ["Projector", "Senses Board", "Desktop PC", "Audio System", "Internet - LAN"],
  "Labs": ["Desktop PC", "Projector", "Senses Board", "LAN Switch", "UPS", "AC"],
  "Library": ["Desktop PC", "Projector", "Senses Board", "Barcode Scanner", "Printer", "Internet - LAN"],
  "Accounts/Admin": ["Desktop PC", "Projector", "Senses Board", "Printer", "Scanner", "Biometric"],
  "Conference": ["Projector", "Senses Board", "Video Cam", "Mic", "Audio System"],
  "Counseling": ["Desktop PC", "Projector", "Senses Board", "Internet - LAN"],
  "Other": ["Projector", "Senses Board", "General Hardware 1", "General Hardware 2"]
};

const DEFAULT_FLOOR_OPTIONS = [
  "North Ground Floor",
  "North First Floor",
  "North Second Floor",
  "North Third Floor",
  "South Ground Floor",
  "South First Floor",
  "South Second Floor",
  "South Third Floor"
];

export default function RoomMaster({ rooms, updateRooms, allocations = [] }: RoomMasterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);

  // Custom modal dialogs instead of window.alert/confirm (essential for iframe safety)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null); // "selected" or specific roomId
  const [customAlert, setCustomAlert] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<Room | null>(null);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [school, setSchool] = useState<SchoolBranch>("Birla Open Minds International School");
  const [building, setBuilding] = useState<string>("LB Nagar Branch");
  const [dept, setDept] = useState("Classroom");
  const [roomNumber, setRoomNumber] = useState("");
  const [className, setClassName] = useState("");
  const [floorWing, setFloorWing] = useState("North Ground Floor");
  const [isCustomFloor, setIsCustomFloor] = useState(false);
  const [customFloorInput, setCustomFloorInput] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");

  // Manual History snapshot addition inputs
  const [historyYearInput, setHistoryYearInput] = useState("");
  const [historyClassInput, setHistoryClassInput] = useState("");
  
  // Custom hardware elements mapper
  const [dynamicInputs, setDynamicInputs] = useState<Record<string, string>>({});
  const [customAssets, setCustomAssets] = useState<{ key: string; val: string }[]>([]);

  // Auto-sync master sheet allocations if cached data is incomplete or outdated
  useEffect(() => {
    if (rooms.length < SHEET_ALLOCATED_ROOMS.length || !rooms.some(r => r.roomNumber.includes("LAB"))) {
      const sheetIds = new Set(SHEET_ALLOCATED_ROOMS.map(sr => sr.id));
      const nonSheetRooms = rooms.filter(r => !sheetIds.has(r.id) && !r.roomNumber.match(/^(NG|NF|NS|NT|SG|SF|SS|ST)/i));
      const merged = [...SHEET_ALLOCATED_ROOMS, ...nonSheetRooms];
      updateRooms(merged);
    }
  }, []);

  // Monitor dept selection
  useEffect(() => {
    if (editingId) return; // Keep existing data when editing
    const standardFields = DEPT_ASSETS[dept] || [];
    const inputs: Record<string, string> = {};
    standardFields.forEach(field => {
      inputs[field] = "";
    });
    setDynamicInputs(inputs);
    setCustomAssets([]);
  }, [dept, editingId]);

  // Sync editing details
  const handleEditSetup = (room: Room) => {
    setEditingId(room.id);
    setSchool(room.school || "Birla Open Minds International School");
    setBuilding(room.building || "LB Nagar Branch");
    setDept(room.dept || "Classroom");
    setRoomNumber(room.roomNumber || "");
    setClassName(room.className || "");
    setAcademicYear(room.academicYear || "2026-2027");

    const fWing = room.floorWing || "North Ground Floor";
    if (DEFAULT_FLOOR_OPTIONS.includes(fWing)) {
      setFloorWing(fWing);
      setIsCustomFloor(false);
      setCustomFloorInput("");
    } else {
      setFloorWing("+ Add Custom Floor/Wing");
      setIsCustomFloor(true);
      setCustomFloorInput(fWing);
    }

    // Filter standard vs custom
    const standardKeys = DEPT_ASSETS[room.dept] || [];
    const standardMap: Record<string, string> = {};
    const customsList: { key: string; val: string }[] = [];

    Object.entries(room.assets).forEach(([k, v]) => {
      if (standardKeys.includes(k)) {
        standardMap[k] = v;
      } else {
        customsList.push({ key: k, val: v });
      }
    });

    // Make sure all standard keys have values even if empty in that specific room
    standardKeys.forEach(k => {
      if (!standardMap[k]) standardMap[k] = "";
    });

    setDynamicInputs(standardMap);
    setCustomAssets(customsList);
  };

  const resetForm = () => {
    setEditingId(null);
    setSchool("Birla Open Minds International School");
    setBuilding("LB Nagar Branch");
    setDept("Classroom");
    setRoomNumber("");
    setClassName("");
    setFloorWing("North Ground Floor");
    setIsCustomFloor(false);
    setCustomFloorInput("");
    setAcademicYear("2026-2027");
    setDynamicInputs({});
    setCustomAssets([]);
  };

  const handleAddFieldRow = () => {
    setCustomAssets([...customAssets, { key: "", val: "" }]);
  };

  const handleCustomFieldChange = (index: number, field: "key" | "val", value: string) => {
    const copy = [...customAssets];
    copy[index][field] = value;
    setCustomAssets(copy);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !school) {
      setCustomAlert("School details and Room Number are mandatory!");
      return;
    }

    const mergedAssets: Record<string, string> = {};

    // Standard items
    Object.entries(dynamicInputs).forEach(([k, v]) => {
      const valStr = String(v).trim();
      if (valStr) mergedAssets[k] = valStr;
    });

    // Custom items
    customAssets.forEach(item => {
      if (item.key.trim() && item.val.trim()) {
        mergedAssets[item.key.trim()] = item.val.trim();
      }
    });

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
    }).replace(/\//g, "-");

    const finalFloor = isCustomFloor ? customFloorInput.trim() : floorWing;

    let updatedRooms = [...rooms];

    if (editingId) {
      const idx = rooms.findIndex(r => r.id === editingId);
      if (idx !== -1) {
        const existing = rooms[idx];
        const historyCopy = existing.classHistory ? [...existing.classHistory] : [];
        
        // Auto archive previous class assignment to history if class changed
        if (existing.className && existing.className.trim() !== className.trim()) {
          const alreadyArchived = historyCopy.some(
            h => h.className.trim() === existing.className.trim() && 
                 h.academicYear.trim() === (existing.academicYear || "Previous").trim()
          );
          if (!alreadyArchived) {
            historyCopy.unshift({
              id: `H-AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              className: existing.className,
              academicYear: existing.academicYear || "Previous",
              allocatedAt: nowStr
            });
          }
        }

        updatedRooms[idx] = {
          ...existing,
          school,
          building,
          dept,
          roomNumber,
          className,
          floorWing: finalFloor || "North Ground Floor",
          academicYear,
          assets: mergedAssets,
          classHistory: historyCopy,
          hwLogs: existing.className !== className 
            ? `• [${nowStr}] Room Class changed from "${existing.className}" to "${className}"\n${existing.hwLogs}`
            : existing.hwLogs
        };
      }
    } else {
      const id = `RM-${Date.now().toString().slice(-6)}`;
      const newRoom: Room = {
        id,
        school,
        building,
        dept,
        roomNumber,
        className,
        floorWing: finalFloor || "North Ground Floor",
        academicYear,
        assets: mergedAssets,
        hwLogs: `• [${nowStr}] Room Master Entry Setup Completed at ${building}`,
        classHistory: []
      };
      updatedRooms = [newRoom, ...updatedRooms];
    }

    updateRooms(updatedRooms);
    resetForm();
  };

  const handleAddManualHistory = (roomId: string) => {
    if (!historyYearInput.trim() || !historyClassInput.trim()) {
      setCustomAlert("Please enter both academic session year and class name to add a historical allocation record.");
      return;
    }

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).replace(/\//g, "-");

    const updated = rooms.map(r => {
      if (r.id === roomId) {
        const historyCopy = r.classHistory ? [...r.classHistory] : [];
        const newHistoryItem = {
          id: `H-MANUAL-${Date.now()}`,
          className: historyClassInput.trim(),
          academicYear: historyYearInput.trim(),
          allocatedAt: nowStr
        };
        const newRoom = { 
          ...r, 
          classHistory: [newHistoryItem, ...historyCopy],
          hwLogs: `• [${nowStr}] Added historical record for year ${historyYearInput.trim()}: "${historyClassInput.trim()}"\n${r.hwLogs}`
        };
        if (viewTarget && viewTarget.id === roomId) {
          setViewTarget(newRoom);
        }
        return newRoom;
      }
      return r;
    });

    updateRooms(updated);
    setHistoryYearInput("");
    setHistoryClassInput("");
  };

  const handleDeleteHistoryItem = (roomId: string, historyItemId: string) => {
    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric"
    }).replace(/\//g, "-");

    const updated = rooms.map(r => {
      if (r.id === roomId) {
        const targetHist = r.classHistory?.find(h => h.id === historyItemId);
        const historyCopy = r.classHistory ? r.classHistory.filter(h => h.id !== historyItemId) : [];
        const newRoom = { 
          ...r, 
          classHistory: historyCopy,
          hwLogs: `• [${nowStr}] Deleted historical record for year ${targetHist?.academicYear || "N/A"}: "${targetHist?.className || "N/A"}"\n${r.hwLogs}`
        };
        if (viewTarget && viewTarget.id === roomId) {
          setViewTarget(newRoom);
        }
        return newRoom;
      }
      return r;
    });
    updateRooms(updated);
  };

  // Multiple Selection Deletes
  const handleDeleteSelected = () => {
    if (selectedRoomIds.length === 0) {
      setCustomAlert("Please check at least one room on the list checkboxes to initiate delete operation.");
      return;
    }
    setDeleteTarget("selected");
  };

  const handleConfirmDelete = () => {
    if (deleteTarget === "selected") {
      const filtered = rooms.filter(r => !selectedRoomIds.includes(r.id));
      updateRooms(filtered);
      setSelectedRoomIds([]);
    } else if (deleteTarget) {
      const filtered = rooms.filter(room => room.id !== deleteTarget);
      updateRooms(filtered);
      setSelectedRoomIds(selectedRoomIds.filter(id => id !== deleteTarget));
    }
    setDeleteTarget(null);
  };

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRoomIds(rooms.map(r => r.id));
    } else {
      setSelectedRoomIds([]);
    }
  };

  const handleToggleRoomCheck = (roomId: string) => {
    if (selectedRoomIds.includes(roomId)) {
      setSelectedRoomIds(selectedRoomIds.filter(id => id !== roomId));
    } else {
      setSelectedRoomIds([...selectedRoomIds, roomId]);
    }
  };

  // Floor & Wing Filter Matching
  const [floorFilter, setFloorFilter] = useState("All Floors & Wings");

  const matchesFloorFilter = (r: Room, filterVal: string): boolean => {
    if (!filterVal || filterVal === "All Floors & Wings" || filterVal === "All Buildings") return true;

    const fw = (r.floorWing || "").toLowerCase();
    const rm = (r.roomNumber || "").toLowerCase();

    // Specific floors
    if (filterVal.includes("North Ground") || filterVal === "NG") {
      return fw.includes("north ground") || rm.startsWith("ng");
    }
    if (filterVal.includes("South Ground") || filterVal === "SG") {
      return fw.includes("south ground") || rm.startsWith("sg");
    }
    if (filterVal.includes("North First") || filterVal === "NF") {
      return fw.includes("north first") || rm.startsWith("nf");
    }
    if (filterVal.includes("South First") || filterVal === "SF") {
      return fw.includes("south first") || rm.startsWith("sf");
    }
    if (filterVal.includes("North Second") || filterVal === "NS") {
      return fw.includes("north second") || rm.startsWith("ns");
    }
    if (filterVal.includes("South Second") || filterVal === "SS") {
      return fw.includes("south second") || rm.startsWith("ss");
    }
    if (filterVal.includes("North Third") || filterVal === "NT") {
      return fw.includes("north third") || rm.startsWith("nt");
    }
    if (filterVal.includes("South Third") || filterVal === "ST") {
      return fw.includes("south third") || rm.startsWith("st");
    }

    // Wing groupings
    if (filterVal.includes("All North Wing")) {
      return fw.includes("north") || rm.startsWith("ng") || rm.startsWith("nf") || rm.startsWith("ns") || rm.startsWith("nt");
    }
    if (filterVal.includes("All South Wing")) {
      return fw.includes("south") || rm.startsWith("sg") || rm.startsWith("sf") || rm.startsWith("ss") || rm.startsWith("st");
    }

    // Floor groupings
    if (filterVal.includes("Ground Floor")) {
      return fw.includes("ground") || rm.startsWith("ng") || rm.startsWith("sg");
    }
    if (filterVal.includes("First Floor")) {
      return fw.includes("first") || rm.startsWith("nf") || rm.startsWith("sf");
    }
    if (filterVal.includes("Second Floor")) {
      return fw.includes("second") || rm.startsWith("ns") || rm.startsWith("ss");
    }
    if (filterVal.includes("Third Floor")) {
      return fw.includes("third") || rm.startsWith("nt") || rm.startsWith("st");
    }

    return true;
  };

  const getRoomNumberInt = (roomNum: string): number => {
    const m = roomNum.match(/\d+/);
    return m ? parseInt(m[0], 10) : 999;
  };

  const filteredRooms = rooms
    .filter(r => matchesFloorFilter(r, floorFilter))
    .filter(r => {
      if (!searchTerm.trim()) return true;
      const s = searchTerm.toLowerCase();
      const assetsStr = Object.entries(r.assets).map(([k,v]) => `${k}:${v}`).join(" ").toLowerCase();
      const b = r.building ? r.building.toLowerCase() : "";

      // Advanced numeric normalization helper
      const matchesNumericNormalization = (roomNum: string, searchVal: string): boolean => {
        const normRoom = roomNum.toLowerCase();
        const normSearch = searchVal.toLowerCase();
        if (normRoom.includes(normSearch)) return true;

        const getNormalizedKey = (text: string): string => {
          let t = text.toLowerCase();
          t = t.replace(/\broom\b|\bnumber\b|\bno\b|\bdept\b|\brm\b/g, "");
          t = t.replace(/\d+/g, (m) => String(parseInt(m, 10)));
          t = t.replace(/[^a-z0-9]/g, "");
          return t;
        };

        const roomKey = getNormalizedKey(roomNum);
        const searchKey = getNormalizedKey(searchVal);

        if (searchKey && roomKey.includes(searchKey)) {
          return true;
        }

        const searchInts = (normSearch.match(/\d+/g) || []).map(n => parseInt(n, 10));
        const roomInts = (normRoom.match(/\d+/g) || []).map(n => parseInt(n, 10));
        
        if (searchInts.length > 0) {
          return searchInts.every(si => roomInts.includes(si));
        }

        return false;
      };

      return (
        r.school.toLowerCase().includes(s) ||
        b.includes(s) ||
        r.dept.toLowerCase().includes(s) ||
        matchesNumericNormalization(r.roomNumber, searchTerm) ||
        r.className.toLowerCase().includes(s) ||
        (r.floorWing || "").toLowerCase().includes(s) ||
        assetsStr.includes(s) ||
        r.id.toLowerCase().includes(s)
      );
    })
    .sort((a, b) => getRoomNumberInt(a.roomNumber) - getRoomNumberInt(b.roomNumber));

  // Export selected data as simple readable document
  const handleExportCSVReport = () => {
    let output = "Room Details,Building Block,Floor / Wing,Department,Assets Allocated,Hardware Logs\n";
    const targets = selectedRoomIds.length > 0 ? rooms.filter(r => selectedRoomIds.includes(r.id)) : rooms;

    targets.forEach(r => {
      const details = `"${r.school} Branch Room ${r.roomNumber} (${r.className})"`;
      const block = `"${r.building || "LB Nagar Branch"}"`;
      const floor = `"${r.floorWing || "North Ground Floor"}"`;
      const department = `"${r.dept}"`;
      const assets = `"${Object.entries(r.assets).map(([k,v]) => `${k}: ${v}`).join(" | ")}"`;
      const logs = `"${r.hwLogs.replace(/\n/g, " | ")}"`;
      output += `${details},${block},${floor},${department},${assets},${logs}\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_ROOM_MASTER_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSyncSheetAllocations = () => {
    const sheetIds = new Set(SHEET_ALLOCATED_ROOMS.map(sr => sr.id));
    const nonSheetRooms = rooms.filter(r => !sheetIds.has(r.id) && !r.roomNumber.match(/^(NG|NF|NS|NT|SG|SF|SS|ST)/i));
    const merged = [...SHEET_ALLOCATED_ROOMS, ...nonSheetRooms];
    updateRooms(merged);
    setCustomAlert(`Successfully synchronized all ${SHEET_ALLOCATED_ROOMS.length} Official Campus Room Allocations with fully expanded Greek names & verified S.No 12 labs!`);
  };

  const handleExportPDFReport = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Birla Open Minds International School - Room Config Ledger", 14, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString("en-GB")}`, 14, 21);

    const targets = selectedRoomIds.length > 0 ? rooms.filter(r => selectedRoomIds.includes(r.id)) : filteredRooms;
    
    const tableColumn = ["Building", "Room / Class", "Dept", "Allocated Assets"];
    const tableRows = targets.map(r => {
      const assetsList = Object.entries(r.assets).map(([k,v]) => `${k}: ${v}`).join("\n");
      return [
        r.building || "LB Nagar Branch",
        `${r.roomNumber}\n(${r.className})`,
        r.dept,
        assetsList
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [44, 82, 130] },
      columnStyles: { 3: { cellWidth: 80 } },
    });

    doc.save(`BIRLA_INSTITUTE_ROOMS_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div id="room-master-tab" className="flex flex-col h-full bg-[#f8fafc] dark:bg-slate-900 text-slate-800 dark:text-slate-100 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-200">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            {/* Visual asset logo */}
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Birla Open Minds International School Logo" 
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl border border-slate-300 dark:border-slate-700 shadow-md object-contain bg-white shrink-0 block p-1" 
            />
            <h1 className="text-2xl font-black tracking-tight text-[#1E293B] dark:text-white font-sans uppercase">
              BIRLA OPEN MINDS INTERNATIONAL SCHOOL
            </h1>
          </div>
          <div className="text-xs font-extrabold text-slate-600 dark:text-slate-300 mt-1 tracking-wider uppercase flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded w-fit">
            🏫 SCHOOLROOM MASTER
          </div>
          <p className="text-xs text-slate-500 font-medium font-sans mt-1">Dynamic department checklists, custom asset logs, and room ledger controls</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2.5">
          <button
            onClick={handleSyncSheetAllocations}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import all 113 room allocations from official campus image sheet"
          >
            <School size={15} />
            📥 SYNC SHEET ALLOCATIONS (120 ROOMS)
          </button>
          <button
            onClick={handleExportPDFReport}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={15} />
            EXPORT PDF
          </button>
          <button
            onClick={handleExportCSVReport}
            className="px-4 py-2.5 bg-[#4299E1] hover:bg-blue-600 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ArrowUpRight size={15} />
            EXPORT LEDGER REPORT (.CSV)
          </button>
        </div>
      </div>

      <div className="my-8 flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Left Input Form Frame */}
        <form onSubmit={handleSave} className="w-full lg:w-96 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-100">
              {editingId ? "Update Registered Room" : "Register New Campus Room"}
            </h3>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">School Branch Location</label>
            <select
              value={school}
              onChange={(e) => setSchool(e.target.value as SchoolBranch)}
              className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
            >
              <option value="Birla Open Minds International School">Birla Open Minds International School</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Building/Campus Block</label>
            <select
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-850 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 focus:outline-none focus:bg-white dark:bg-slate-950 font-semibold"
            >
              <option value="LB Nagar Branch">🏢 LB Nagar Branch</option>

            </select>
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">Campus shares centralized inventory.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Room Dept</label>
              <select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              >
                {Object.keys(DEPT_ASSETS).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Room No</label>
              <input
                type="text"
                required
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="E.g. Room 202, Lab A"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Classroom / Teacher Name</label>
              <input
                type="text"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                placeholder="E.g. Grade 10-A, Staff Desk"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Floor / Wing Location</label>
              {isCustomFloor ? (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customFloorInput}
                    onChange={(e) => setCustomFloorInput(e.target.value)}
                    placeholder="E.g. East Ground Floor, Admin Wing"
                    className="w-full py-2 px-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomFloor(false);
                      setFloorWing("North Ground Floor");
                    }}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded shrink-0 cursor-pointer"
                    title="Back to default floor options"
                  >
                    List
                  </button>
                </div>
              ) : (
                <select
                  value={floorWing}
                  onChange={(e) => {
                    if (e.target.value === "+ Add Custom Floor/Wing") {
                      setIsCustomFloor(true);
                      setCustomFloorInput("");
                    } else {
                      setFloorWing(e.target.value);
                    }
                  }}
                  className="w-full py-2 px-2.5 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {DEFAULT_FLOOR_OPTIONS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="+ Add Custom Floor/Wing" className="font-bold text-indigo-600">+ Add Custom Floor/Wing...</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Academic Year / Session</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="E.g. 2026-2027"
              className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-600 focus:outline-none font-semibold text-indigo-650"
            />
            <p className="text-[10px] text-slate-400 mt-1">If the classroom name changes between academic years, the history is archived automatically!</p>
          </div>

          {/* Standard checklists derived dynamically based on Dept choice */}
          <div className="space-y-3 pt-3 border-t border-slate-150">
            <h4 className="text-xs font-extrabold text-[#D69E2E] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span>⚡</span> Standard Dept Hardware Checklist
            </h4>
            
            {Object.keys(dynamicInputs).length === 0 ? (
              <p className="text-xs text-slate-400">Select standard department first.</p>
            ) : (
              Object.entries(dynamicInputs).map(([k, v]) => (
                <div key={k} className="flex gap-2.5 items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 w-28 truncate" title={k}>{k}</span>
                  <input
                    type="text"
                    value={v}
                    onChange={(e) => {
                      const copy = { ...dynamicInputs };
                      copy[k] = e.target.value;
                      setDynamicInputs(copy);
                    }}
                    placeholder="Qty, Serial..."
                    className="flex-1 py-1.5 px-3 border border-slate-200 rounded text-xs bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))
            )}
          </div>

          {/* Custom hardware specs inputs */}
          <div className="space-y-3 pt-3 border-t border-slate-150">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-extrabold text-blue-600 uppercase tracking-wider">
                ➕ Unlimited Custom Hardware
              </h4>
              <button
                type="button"
                onClick={handleAddFieldRow}
                className="px-2.5 py-1 text-[10px] bg-slate-100 hover:bg-[#1E293B] hover:text-white rounded font-bold cursor-pointer transition-colors"
              >
                + Add Dynamic Row
              </button>
            </div>

            {customAssets.map((custom, index) => (
              <div key={index} className="flex gap-2 items-center">
                <input
                  type="text"
                  required
                  value={custom.key}
                  onChange={(e) => handleCustomFieldChange(index, "key", e.target.value)}
                  placeholder="Hardware Name"
                  className="w-1/2 py-1.5 px-2 border border-slate-200 rounded text-xs bg-slate-50 font-semibold text-slate-800"
                />
                <input
                  type="text"
                  required
                  value={custom.val}
                  onChange={(e) => handleCustomFieldChange(index, "val", e.target.value)}
                  placeholder="Qty / Info"
                  className="w-1/2 py-1.5 px-2 border border-slate-200 rounded text-xs bg-slate-50 text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => {
                    const copy = [...customAssets];
                    copy.splice(index, 1);
                    setCustomAssets(copy);
                  }}
                  className="text-rose-500 p-1 bg-rose-50 rounded"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-[#D69E2E] hover:bg-amber-600 text-white rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Save size={15} />
              {editingId ? "SAVE CONFIGURATION" : "SAVE TO MASTER"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold font-sans cursor-pointer transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* Right Active Room ledger list */}
        <div className="flex-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-xs bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 border border-slate-200 dark:border-slate-800 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 size={13} />
                DELETE CHECKED
              </button>
              
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="py-1.5 px-3 border border-amber-300 dark:border-slate-700 rounded-lg text-xs bg-amber-50/80 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-extrabold focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-xs cursor-pointer"
              >
                <option value="All Floors & Wings">🏫 All Floors & Wings (All 113 Rooms)</option>
                <optgroup label="📍 Specific Floor / Wing">
                  <option value="North Ground Floor (NG)">📍 North Ground Floor (NG 01 - NG 14)</option>
                  <option value="South Ground Floor (SG)">📍 South Ground Floor (SG 01 - SG 14)</option>
                  <option value="North First Floor (NF)">📍 North First Floor (NF 01 - NF 14)</option>
                  <option value="South First Floor (SF)">📍 South First Floor (SF 01 - SF 14)</option>
                  <option value="North Second Floor (NS)">📍 North Second Floor (NS 01 - NS 14)</option>
                  <option value="South Second Floor (SS)">📍 South Second Floor (SS 01 - SS 15)</option>
                  <option value="North Third Floor (NT)">📍 North Third Floor (NT 01 - NT 14)</option>
                  <option value="South Third Floor (ST)">📍 South Third Floor (ST 01 - ST 14)</option>
                </optgroup>
                <optgroup label="🧭 Entire Wing Filter">
                  <option value="All North Wing Floors (NG, NF, NS, NT)">🧭 All North Wing (NG, NF, NS, NT)</option>
                  <option value="All South Wing Floors (SG, SF, SS, ST)">🧭 All South Wing (SG, SF, SS, ST)</option>
                </optgroup>
                <optgroup label="🏢 Entire Floor Level">
                  <option value="Ground Floor (NG & SG)">🏢 Ground Floor (NG & SG)</option>
                  <option value="First Floor (NF & SF)">🏢 First Floor (NF & SF)</option>
                  <option value="Second Floor (NS & SS)">🏢 Second Floor (NS & SS)</option>
                  <option value="Third Floor (NT & ST)">🏢 Third Floor (NT & ST)</option>
                </optgroup>
              </select>
            </div>

            {/* Live Search bar */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Room specs..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Grid Headers */}
          <div className="grid grid-cols-12 gap-2 px-6 py-3 border-b border-slate-100 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={rooms.length > 0 && selectedRoomIds.length === rooms.length}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                className="w-3.5 h-3.5 border-slate-300 rounded focus:ring-2 focus:ring-blue-600 cursor-pointer"
              />
              <span className="text-[9px] font-sans text-slate-500 uppercase">S.No</span>
            </div>
            <div className="col-span-2">Department & Block</div>
            <div className="col-span-2">Room / Class</div>
            <div className="col-span-2">Floor / Wing Location</div>
            <div className="col-span-2">Allocated Hardware</div>
            <div className="col-span-2">Resolution Log History</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Grid Content */}
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[550px] custom-scrollbar">
            {filteredRooms.length === 0 ? (
               <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <School size={40} className="stroke-slate-300 animate-pulse" />
                <p className="text-xs font-semibold">No room entries match your layout query.</p>
              </div>
            ) : (
              filteredRooms.map((r, idx) => {
                const isChecked = selectedRoomIds.includes(r.id);
                return (
                  <div 
                    key={r.id}
                    className={`grid grid-cols-12 gap-2 px-6 py-4 items-center ${
                      isChecked ? "bg-blue-50/30" : "hover:bg-slate-50/20"
                    } transition-colors`}
                  >
                    {/* Checkbox & S.No */}
                    <div className="col-span-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleRoomCheck(r.id)}
                        className="w-3.5 h-3.5 border-slate-300 rounded focus:ring-2 focus:ring-blue-650 cursor-pointer shrink-0"
                      />
                      <span className="text-[10px] font-mono font-black text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded leading-none shrink-0" title={`Item #${idx + 1}`}>
                        {idx + 1}
                      </span>
                    </div>

                    {/* School & Dept */}
                    <div className="col-span-2 space-y-1.5">
                      <div className="text-xs font-extrabold text-[#1E293B] dark:text-slate-100 flex items-center gap-1 uppercase tracking-wide truncate" title={r.dept}>
                        📂 {r.dept}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold tracking-wide bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200/50">
                          🏢 LB Nagar Branch
                        </span>
                      </div>
                    </div>

                    {/* Room & Class */}
                    <div className="col-span-2 space-y-1">
                      <div className="text-xs font-bold text-slate-700">🚪 Room: {r.roomNumber}</div>
                      <div className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400 truncate" title={r.className}>
                        {r.className || <span className="text-slate-400 italic font-normal">Unassigned</span>}
                      </div>
                      {r.academicYear && (
                        <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 rounded-md border border-indigo-100/40 w-fit">
                          <span className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse"></span>
                          {r.academicYear}
                        </div>
                      )}
                    </div>

                    {/* Floor / Wing Location (Dedicated Column) */}
                    <div className="col-span-2 space-y-1">
                      <div className="text-[11px] font-extrabold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 rounded-lg border border-amber-200/60 shadow-xs w-fit">
                        <span>📍</span>
                        <span>{r.floorWing || "North Ground Floor"}</span>
                      </div>
                    </div>

                    {/* Assigned Assets display box */}
                    <div className="col-span-2 pr-2">
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                        {Object.keys(r.assets).length === 0 ? (
                          <span className="text-slate-400 italic text-xs">No assigned items listed</span>
                        ) : (
                          Object.entries(r.assets).map(([k, v]) => (
                            <span 
                              key={k} 
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50/70 dark:bg-slate-800 border border-amber-200/50 dark:border-slate-700/80 rounded-lg text-[10px] text-amber-800 dark:text-slate-200 font-sans shadow-sm transition-all hover:scale-[1.02] hover:bg-amber-100/50 dark:hover:bg-slate-750"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse shrink-0"></span>
                              <span className="font-extrabold text-[#1E293B] dark:text-slate-300">{k}:</span>
                              <span className="font-bold text-amber-700 dark:text-emerald-400">{v}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Historical log history logs snippet */}
                    <div className="col-span-2 pr-2">
                      <div className="p-2 border border-slate-100 rounded bg-[#F8FAFC] text-[9px] text-slate-500 max-h-24 overflow-y-auto leading-normal font-sans select-text custom-scrollbar">
                        {r.hwLogs ? (
                          r.hwLogs.split("\n").map((line, idx2) => (
                            <div key={idx2} className="border-b border-slate-100/50 py-0.5 leading-snug truncate" title={line}>
                              {line}
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400 italic">No updates in hardware logs</span>
                        )}
                      </div>
                    </div>

                    {/* Edit & Delete Trigger */}
                    <div className="col-span-1 flex flex-col gap-1 items-end">
                      <button
                        onClick={() => setViewTarget(r)}
                        className="w-full px-3 py-1.5 text-[10px] bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-500 hover:text-white text-indigo-600 dark:text-indigo-400 rounded font-bold transition-colors cursor-pointer"
                      >
                        VIEW
                      </button>
                      <button
                        onClick={() => handleEditSetup(r)}
                        className="w-full px-3 py-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-[#1E293B] hover:text-white rounded font-bold transition-colors cursor-pointer"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => setDeleteTarget(r.id)}
                        className="w-full px-3 py-1.5 text-[10px] bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-500 hover:text-white text-rose-600 rounded font-bold transition-colors cursor-pointer"
                      >
                        DELETE
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* Custom Alert Modal */}
      {customAlert && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-105 dark:border-slate-800 bg-amber-500 text-white flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <h3 className="font-bold text-sm tracking-wide uppercase">System Alert</h3>
            </div>
            <div className="p-6 text-sm text-slate-700 dark:text-slate-300 font-semibold select-text">
              {customAlert}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setCustomAlert(null)}
                className="px-5 py-2.5 bg-[#1E293B] dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-105 dark:border-slate-800 bg-rose-600 text-white flex items-center gap-2">
              <span className="text-xl">🗑️</span>
              <h3 className="font-bold text-sm tracking-wide uppercase">Confirm Deletion</h3>
            </div>
            <div className="p-6 text-sm text-slate-755 dark:text-slate-300 font-semibold leading-relaxed">
              {deleteTarget === "selected" ? (
                <span>Are you sure you want to permanently delete the <span className="text-rose-650 dark:text-rose-450 font-extrabold">{selectedRoomIds.length} checked rooms</span> from Birla Open Minds International School Master registry? This action is irreversible.</span>
              ) : (
                <span>Are you sure you want to permanently delete room <span className="text-rose-650 dark:text-rose-450 font-extrabold">{deleteTarget}</span> from Birla Open Minds International School Master registry? This action is irreversible.</span>
              )}
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-101 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 dark:text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                Yes, Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Room Detailed Modal */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
            <div className="p-5 border-b border-slate-105 dark:border-slate-800 bg-indigo-600 dark:bg-indigo-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">🏫</span>
                <h3 className="font-bold text-sm tracking-wide uppercase">Room Detailed View</h3>
              </div>
              <button onClick={() => setViewTarget(null)} className="text-white hover:text-indigo-200 font-bold px-2 py-1 bg-white/10 rounded cursor-pointer transition-colors duration-200">
                Close
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50 dark:bg-slate-950/50">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">School Campus</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{viewTarget.school}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Building/Block</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-500 rounded font-bold text-xs inline-flex items-center gap-1">
                      🏫 {viewTarget.building || "N/A"}
                    </span>
                  </div>
                </div>
                
                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Room ID</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{viewTarget.id}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Department</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{viewTarget.dept}</div>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Room Number</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{viewTarget.roomNumber}</div>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Classroom/Teacher</h4>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {viewTarget.className || "Unassigned"}
                    {viewTarget.academicYear && (
                      <span className="ml-2 px-2 py-0.5 text-[10px] font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded">
                        ({viewTarget.academicYear})
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Floor / Wing Location</h4>
                  <div className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span>📍</span>
                    <span>{viewTarget.floorWing || "North Ground Floor"}</span>
                  </div>
                </div>

                {/* Academic Year Allocation History */}
                <div className="col-span-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-4 h-0.5 bg-slate-300 dark:bg-slate-700"></span> Academic Year Allocation History
                    </h4>
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100/30">
                      Annual Class Tracking Active
                    </span>
                  </div>

                  {/* Manual snapshot seed/history injector */}
                  <div className="bg-slate-100 dark:bg-slate-900/40 rounded-xl p-3 mb-4 border border-slate-200/50">
                    <p className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">
                      ➕ Retroactively Log Past Year's Allocation (Self-Seeding)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        placeholder="Year (e.g. 2024-2025)"
                        value={historyYearInput}
                        onChange={(e) => setHistoryYearInput(e.target.value)}
                        className="p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        placeholder="Class / Teacher Name"
                        value={historyClassInput}
                        onChange={(e) => setHistoryClassInput(e.target.value)}
                        className="p-1.5 border border-slate-200 rounded text-xs bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleAddManualHistory(viewTarget.id)}
                        type="button"
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded transition-colors cursor-pointer"
                      >
                        + Add Record
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/55 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-200 dark:border-slate-800">
                          <th className="p-3">Academic Session</th>
                          <th className="p-3">Classroom / occupant Assignment</th>
                          <th className="p-3">Registered Date</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {/* Current Active Allocation listed first for complete clarity */}
                        <tr className="bg-indigo-50/40 dark:bg-indigo-950/15 font-medium">
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              {viewTarget.academicYear || "Current (Active)"}
                            </span>
                          </td>
                          <td className="p-3 text-slate-700 dark:text-slate-200 font-bold">
                            {viewTarget.className || "Unassigned"}
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[10px]">Active now</td>
                          <td className="p-3 text-right">
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-[8px] font-black uppercase rounded">
                              Current Target
                            </span>
                          </td>
                        </tr>

                        {/* Historical database lists */}
                        {viewTarget.classHistory && viewTarget.classHistory.length > 0 ? (
                          viewTarget.classHistory.map((hist) => (
                            <tr key={hist.id} className="hover:bg-slate-50/55 dark:hover:bg-slate-800/20 text-slate-700 dark:text-slate-300">
                              <td className="p-3 font-semibold">
                                📅 {hist.academicYear}
                              </td>
                              <td className="p-3 font-semibold">
                                {hist.className}
                              </td>
                              <td className="p-3 text-slate-400 font-mono text-[10px]">
                                {hist.allocatedAt || "N/A"}
                              </td>
                              <td className="p-3 text-right">
                                <button
                                  onClick={() => handleDeleteHistoryItem(viewTarget.id, hist.id)}
                                  type="button"
                                  className="text-slate-450 hover:text-rose-600 transition-colors duration-150 font-bold text-[10px] cursor-pointer"
                                  title="Delete historical allocation line"
                                >
                                  ❌ Remove
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center italic text-slate-400">
                              No previous historical years logged. Modify the class name in edit form above or enter past years retroactively to seed.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="col-span-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-slate-300 dark:bg-slate-700"></span> Default Hardware Assets
                  </h4>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(viewTarget.assets).map(([key, val], idx) => {
                      const strVal = String(val || "");
                      if (!strVal || strVal.trim() === "0" || strVal.toLowerCase() === "no") return null;
                      return (
                        <div key={idx} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 shadow-sm flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wide">{key}</span>
                          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{strVal}</span>
                        </div>
                      );
                    })}
                  </div>
                  {Object.entries(viewTarget.assets).every(([k, v]) => {
                    const strV = String(v || "");
                    return !strV || strV.trim() === "0" || strV.toLowerCase() === "no";
                  }) && (
                    <div className="text-sm italic text-slate-400">No default hardware allocated.</div>
                  )}
                </div>

                {/* Additional IT Assigned Hardware from EmployeeAssets */}
                <div className="col-span-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-indigo-300 dark:bg-indigo-700"></span> IT Assigned Hardware & Materials
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      const roomMatches = allocations?.filter(a => a.status === "Active" && a.room === `${viewTarget.roomNumber} (${viewTarget.className})`) || [];
                      if (roomMatches.length === 0) {
                        return <div className="text-sm italic text-slate-400">No additional hardware manually assigned to this room yet.</div>;
                      }
                      return roomMatches.map((alloc) => (
                        <div key={alloc.id} className="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/50 rounded-lg p-3 shadow-sm flex flex-col gap-1.5">
                          <span className="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">{alloc.itemName} x{alloc.qty}</span>
                          <div className="text-[10px] font-semibold text-slate-500">
                            <span className="block font-mono mb-0.5">📅 Added: {alloc.assignedOn}</span>
                            <span className="block">👤 By: {alloc.empName}</span>
                          </div>
                          {alloc.remarks && (
                            <span className="text-[9px] text-slate-400 italic block mt-1 line-clamp-2" title={alloc.remarks}>
                              🏷️ {alloc.remarks}
                            </span>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-0.5 bg-slate-300 dark:bg-slate-700"></span> Resolution / Update Logs
                  </h4>
                  <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 max-h-40 overflow-y-auto custom-scrollbar text-xs font-mono text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {viewTarget.hwLogs ? (
                      viewTarget.hwLogs.split("\n").map((line, idx) => (
                        <div key={idx} className="mb-1 border-b border-slate-200/50 dark:border-slate-800/50 pb-1 last:border-0 last:pb-0">{line}</div>
                      ))
                    ) : (
                      <span className="italic text-slate-400">No history logged for this room.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
