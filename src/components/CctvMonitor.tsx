import React, { useState, useEffect, useRef } from "react";
import { 
  Video, 
  Activity, 
  Check, 
  X, 
  Download, 
  Trash2, 
  Edit, 
  Save, 
  FileText, 
  FileSpreadsheet, 
  Play, 
  Calendar,
  Terminal,
  RefreshCw,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";
import { getNowFormatted } from "../types";
import { 
  loadCamsFromIndexedDB, 
  saveCamsToIndexedDB, 
  loadLogsFromIndexedDB, 
  saveLogsToIndexedDB 
} from "../utils/indexedDB";
import { checkCameraHttpHealth, isLocalBridgeActive, executePingSweep, isValidIpv4 } from "../utils/network";

export interface CctvCamera {
  id: string;
  sNo: number;
  ipAddress: string;
  cameraName: string;
  roomNumber: string; // Used for ROOM NO
  classNameField?: string; // Used for CLASS NAME
  floor?: string; // Used for FLOOR
  cameraType?: string; // Used for CAMERA
  dvrNvr?: string; // Used for DVR/NVR
  status: "online" | "offline";
  networkZone: string;
  lastPingTime?: string;
  latency?: number;
}

export interface CctvLog {
  id: string;
  sNo: number;
  date: string; // DD/MM/YYYY
  ipAddress: string;
  cameraName: string;
  roomNumber: string;
  classNameField?: string;
  floor?: string;
  cameraType?: string;
  dvrNvr?: string;
  status: "online" | "offline";
  time: string; // HH:MM
  networkZone: string;
}

// Initial default seed mapping lists
const DEFAULT_CAMERAS: CctvCamera[] = [
  {
    id: "cam-101",
    sNo: 1,
    ipAddress: "192.168.1.101",
    cameraName: "Front Gate Entrance Dome",
    roomNumber: "Gate 1",
    status: "online",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-102",
    sNo: 2,
    ipAddress: "192.168.1.102",
    cameraName: "Science Lab PTZ 4K",
    roomNumber: "Class Room 102",
    status: "online",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-103",
    sNo: 3,
    ipAddress: "192.168.1.103",
    cameraName: "Grade 10 Corridors West",
    roomNumber: "Room 304",
    status: "offline",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-104",
    sNo: 4,
    ipAddress: "192.168.1.104",
    cameraName: "Primary Wing Play Area",
    roomNumber: "Lab 1",
    status: "online",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-201",
    sNo: 1,
    ipAddress: "192.168.2.201",
    cameraName: "Old Library Book Rack East",
    roomNumber: "Library Hall",
    status: "online",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-202",
    sNo: 2,
    ipAddress: "192.168.2.202",
    cameraName: "Principal Lobby Bullet Cam",
    roomNumber: "Accounts Desk",
    status: "offline",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "cam-203",
    sNo: 3,
    ipAddress: "192.168.2.203",
    cameraName: "Old Staff Room Ceiling",
    roomNumber: "Staff Room",
    status: "online",
    networkZone: "192.168.0.x Series"
  }
];

// Initial default logs matching the hand-drawn log table
const DEFAULT_LOGS: CctvLog[] = [
  {
    id: "log-1",
    sNo: 1,
    date: "01/06/2026",
    ipAddress: "192.168.0.1",
    cameraName: "Main Entrance Gate-A",
    roomNumber: "R.No 1 | gamma",
    status: "online",
    time: "10:15",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "log-2",
    sNo: 2,
    date: "01/06/2026",
    ipAddress: "192.168.0.4",
    cameraName: "Primary corridor Dome",
    roomNumber: "Lab 1",
    status: "offline",
    time: "10:16",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "log-3",
    sNo: 3,
    date: "02/06/2026",
    ipAddress: "192.168.1.102",
    cameraName: "Science Lab PTZ 4K",
    roomNumber: "Class Room 102",
    status: "online",
    time: "09:30",
    networkZone: "192.168.0.x Series"
  },
  {
    id: "log-4",
    sNo: 4,
    date: "02/06/2026",
    ipAddress: "192.168.2.202",
    cameraName: "Principal Lobby Bullet Cam",
    roomNumber: "Accounts Desk",
    status: "offline",
    time: "11:22",
    networkZone: "192.168.0.x Series"
  }
];

export default function CctvMonitor() {
  // Database states
  const [cameras, setCameras] = useState<CctvCamera[]>(() => {
    try {
      const local = localStorage.getItem("sgs_cctv_mappings");
      if (local) {
        let parsed = JSON.parse(local) as CctvCamera[];
        let dirty = false;
        parsed = parsed.map(c => {
          let updated = { ...c };
          if (c.roomNumber && c.roomNumber.toUpperCase().includes("FLOOR")) {
            dirty = true;
            updated.floor = c.roomNumber.trim();
            updated.roomNumber = "";
          }
          // If IP is invalid (e.g. 192.168.0.500), force it offline
          if (!isValidIpv4(c.ipAddress) && c.ipAddress !== "localhost" && c.ipAddress !== "127.0.0.1") {
            dirty = true;
            updated.status = "offline";
            updated.latency = undefined;
          }
          return updated;
        });
        if (dirty) localStorage.setItem("sgs_cctv_mappings", JSON.stringify(parsed));
        return parsed;
      }
      return DEFAULT_CAMERAS;
    } catch {
      return DEFAULT_CAMERAS;
    }
  });

  const [logs, setLogs] = useState<CctvLog[]>(() => {
    try {
      const local = localStorage.getItem("sgs_cctv_logs");
      if (local) {
         let parsed = JSON.parse(local) as CctvLog[];
         let dirty = false;
         parsed = parsed.map(l => {
            if (l.roomNumber && l.roomNumber.toUpperCase().includes("FLOOR")) {
               dirty = true;
               return { ...l, floor: l.roomNumber.trim(), roomNumber: "" };
            }
            return l;
         });
         if (dirty) localStorage.setItem("sgs_cctv_logs", JSON.stringify(parsed));
         return parsed;
      }
      return DEFAULT_LOGS;
    } catch {
      return DEFAULT_LOGS;
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          let importedText = "";
          if (Array.isArray(parsed)) {
            parsed.forEach(item => {
              const ip = item.ipAddress || item.ip || item.IP_ADDRESS || "";
              const name = item.cameraName || item.name || item.CAMERA_NAME || "";
              const room = item.roomNumber || item.room || item.LOCATION_ROOM || "";
              if (ip) {
                importedText += `${ip}, ${name}, ${room}\n`;
              }
            });
          }
          setBatchText(prev => prev ? prev + "\n" + importedText.trim() : importedText.trim());
        } else {
          setBatchText(prev => prev ? prev + "\n" + content.trim() : content.trim());
        }
      } catch (err) {
        alert("Error parsing file. Ensure it is a valid JSON or CSV format.");
        // console.error(err);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // User-defined camera groups / networkZones
  const defaultGroups = ["192.168.0.x Series", "192.168.1.x Series", "192.168.2.x Series"];
  const [cameraGroups, setCameraGroups] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem("sgs_cctv_groups");
      const parsed = local ? JSON.parse(local) : null;
      if (parsed && parsed.length > 0) {
        // Force migration for old "LB Nagar Branch"
        if (parsed.includes("LB Nagar Branch")) {
          return defaultGroups;
        }
        return parsed;
      }
      return defaultGroups;
    } catch {
      return defaultGroups;
    }
  });

  const [newGroupName, setNewGroupName] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);

  // Selected networkZone toggle state ("choose opposition")
  const [selectedZone, setSelectedZone] = useState<string>("192.168.0.x Series");

  // Filter networkZone state for bottom reports section ("Choose option")
  const [reportZone, setReportZone] = useState<string>("192.168.0.x Series");

  // Force migrate on mount
  useEffect(() => {
    try {
      const localGroups = localStorage.getItem("sgs_cctv_groups");
      const requiresMigration = localGroups && (
        localGroups.includes("LB Nagar Branch") || 
        localGroups.toLowerCase().includes("new building") || 
        localGroups.toLowerCase().includes("old building")
      );

      if (requiresMigration) {
        const migratedGroups = [...defaultGroups];
        
        // Let's just forcibly wipe and use default groups
        localStorage.setItem("sgs_cctv_groups", JSON.stringify(migratedGroups));
        setCameraGroups(migratedGroups);
        
        // Migrate cameras too
        const localCams = localStorage.getItem("sgs_cctv_cameras");
        if (localCams) {
          const parsedCams = JSON.parse(localCams) as CctvCamera[];
          let dirty = false;
          const updatedCams = parsedCams.map(cam => {
            const zLower = cam.networkZone.toLowerCase();
            if (zLower.includes("lb nagar") || zLower.includes("old building")) {
              dirty = true;
              return { ...cam, networkZone: "192.168.0.x Series" };
            } else if (zLower.includes("new building")) {
              dirty = true;
              return { ...cam, networkZone: "192.168.1.x Series" };
            }
            return cam;
          });
          if (dirty) {
            localStorage.setItem("sgs_cctv_cameras", JSON.stringify(updatedCams));
            setCameras(updatedCams);
          }
        }
        
        // Update selected and report zones
        setSelectedZone("192.168.0.x Series");
        setReportZone("192.168.0.x Series");
      }
    } catch (err) {
      // console.error("Migration error:", err);
    }
  }, []);

  // Check local bridge agent on mount
  useEffect(() => {
    isLocalBridgeActive()
      .then(active => setIsBridgeOnline(active))
      .catch(() => setIsBridgeOnline(false));
  }, []);

  // Date filters for reporting
  const [filterMode, setFilterMode] = useState<"range" | "single">("range");
  const [fromDate, setFromDate] = useState<string>("2026-06-01");
  const [endDate, setEndDate] = useState<string>("2026-06-30");
  const [targetDate, setTargetDate] = useState<string>("2026-06-01");

  // Helper to convert DD/MM/YYYY to YYYY-MM-DD
  const ddmmyyyyToYyyymmdd = (ddmmyyyy: string): string => {
    if (!ddmmyyyy || typeof ddmmyyyy !== "string") return "";
    const parts = ddmmyyyy.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return "";
  };

  // Helper to convert YYYY-MM-DD to DD/MM/YYYY
  const yyyymmddToDdmmyyyy = (yyyymmdd: string): string => {
    if (!yyyymmdd || typeof yyyymmdd !== "string") return "";
    const parts = yyyymmdd.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return yyyymmdd;
  };

  // Derive day-wise statistics grouped by date
  const getDayWiseSummary = () => {
    const zoneLogs = logs.filter(l => l.networkZone === reportZone);
    
    // Deduplicate logs per day per session (Morning / Evening) keeping the latest
    const dedupedLogsMap = new Map<string, CctvLog>();
    zoneLogs.forEach(log => {
      let session = "Morning";
      if (log.time) {
        const hour = parseInt(log.time.split(":")[0], 10);
        if (hour >= 13) {
          session = "Evening";
        }
      }
      const uniqueKey = `${log.ipAddress}_${log.date}_${session}`;
      dedupedLogsMap.set(uniqueKey, log);
    });

    const dedupedLogs = Array.from(dedupedLogsMap.values());

    const groups: { [date: string]: CctvLog[] } = {};
    
    dedupedLogs.forEach(log => {
      if (!groups[log.date]) {
        groups[log.date] = [];
      }
      groups[log.date].push(log);
    });

    const summary = Object.keys(groups).map(dateStr => {
      const dayLogs = groups[dateStr];
      const online = dayLogs.filter(l => l.status === "online").length;
      const offline = dayLogs.filter(l => l.status === "offline").length;
      const total = dayLogs.length;
      const rate = total > 0 ? Math.round((online / total) * 100) : 0;
      const sortKey = ddmmyyyyToYyyymmdd(dateStr) || dateStr;

      return {
        dateString: dateStr,
        sortKey,
        online,
        offline,
        total,
        rate,
        rawLogs: dayLogs
      };
    });

    return summary.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  };

  // Print single target day report PDF
  const handlePrintDayReport = (dateStr: string, dayLogs: CctvLog[]) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented launching paper print window. Please trust this app to print.");
      return;
    }

    let contentHtml = "";

    if (dayLogs.length === 0) {
       contentHtml = '<p style="text-align: center;">No audit logs stored for this day.</p>';
    } else {
       contentHtml += `
         <table>
           <thead>
             <tr>
               <th style="width: 5%;">S.No</th>
               <th style="width: 15%;">ROOM NO</th>
               <th style="width: 20%;">CLASS NAME</th>
               <th style="width: 15%;">CAMERA NAME</th>
               <th style="width: 20%;">IP ADDRESS</th>
               <th style="width: 10%;">STATUS AUDIT</th>
               <th style="width: 15%;">SNAPSHOT TIME</th>
             </tr>
           </thead>
           <tbody>
       `;

       dayLogs.forEach((log, index) => {
          contentHtml += `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 8px;">${index+1}</td>
              <td style="padding: 8px;">${log.roomNumber || ""}</td>
              <td style="padding: 8px;">${log.classNameField || ""}</td>
              <td style="padding: 8px;">${log.cameraName}</td>
              <td style="padding: 8px; font-family: monospace;">${log.ipAddress}</td>
              <td style="padding: 8px; font-weight: bold; color: ${log.status === "online" ? "green" : "red"};">
                ${log.status.toUpperCase()}
              </td>
              <td style="padding: 8px; font-family: monospace;">${log.time || ""}</td>
            </tr>
          `;
       });

       contentHtml += `
           </tbody>
         </table>
       `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>BI Daily CCTV Attendance - ${dateStr}</title>
          <style>
            @page { size: portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; margin: 0; color: #000; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .header-box { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <h2 style="margin-bottom: 5px;">Birla Open Minds International School Daily CCTV Status Report</h2>
            <p style="margin: 3px 0;"><strong>Network Cluster Location:</strong> ${reportZone}</p>
            <p style="margin: 3px 0;"><strong>Selected Target Day:</strong> ${dateStr}</p>
            <p style="margin: 3px 0;"><strong>System Audit Timestamp:</strong> ${currentTime}</p>
            <p style="margin: 3px 0;"><strong>Overall Active Rates:</strong> ${dayLogs.filter(c => c.status === "online").length} OK of ${dayLogs.length} Checked</p>
          </div>
          ${contentHtml}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Interactive Live Clock State
  const [currentTime, setCurrentTime] = useState("");

  // Scanner sweep terminal simulation states
  const [isTriggeringPing, setIsTriggeringPing] = useState(false);
  const [pingConsoleLogs, setPingConsoleLogs] = useState<string[]>([]);
  const [currentPingTarget, setCurrentPingTarget] = useState<string | null>(null);
  const [isBridgeOnline, setIsBridgeOnline] = useState<boolean | null>(null);
  const [pingingCameraId, setPingingCameraId] = useState<string | null>(null);

  const handleSingleCameraPing = async (cam: CctvCamera) => {
    if (pingingCameraId) return;
    setPingingCameraId(cam.id);
    const result = await checkCameraHttpHealth(cam.ipAddress, 1500);
    const updated = cameras.map(c => {
      if (c.id === cam.id) {
        return {
          ...c,
          status: result.status,
          latency: result.status === "online" ? result.latency : undefined,
          lastPingTime: new Date().toLocaleTimeString()
        };
      }
      return c;
    });
    saveCamsToStorage(updated);
    setPingingCameraId(null);
  };

  // New Camera Mapping Form States
  const [formSNo, setFormSNo] = useState<number>(1);
  const [formIp, setFormIp] = useState("");
  const [formName, setFormName] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formClassName, setFormClassName] = useState("");
  const [formFloor, setFormFloor] = useState("GROUND FLOOR");
  const [formType, setFormType] = useState("IP CAMERA");
  const [formDvr, setFormDvr] = useState("DVR");
  const [formStatus, setFormStatus] = useState<"online" | "offline">("online");
  const [editingCameraId, setEditingCameraId] = useState<string | null>(null);

  // High-Range Enterprise Utilities states
  const [activeUtilityTab, setActiveUtilityTab] = useState<"form" | "batch" | "subnet">("form");
  const [batchText, setBatchText] = useState("");
  const [subnetPrefix, setSubnetPrefix] = useState("192.168.1");
  const [subnetStart, setSubnetStart] = useState(1);
  const [subnetEnd, setSubnetEnd] = useState(60);
  const [subnetLabelPattern, setSubnetLabelPattern] = useState("Classroom CCTV");
  const [subnetRoomPattern, setSubnetRoomPattern] = useState("Classroom");

  // Multi-threaded High-Performance Ping preference ("parallel" for ultra fast 500+ pings, "sequential" for single pings)
  const [pingConcurrency, setPingConcurrency] = useState<"parallel" | "sequential">("parallel");

  // Daily Automations Scheduler states
  const [autoMorningEnabled, setAutoMorningEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sgs_auto_morning_enabled");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [autoEveningEnabled, setAutoEveningEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("sgs_auto_evening_enabled");
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [morningSweepTime, setMorningSweepTime] = useState<string>(() => {
    try {
      return localStorage.getItem("sgs_morning_sweep_time") || "09:00";
    } catch {
      return "09:00";
    }
  });
  const [eveningSweepTime, setEveningSweepTime] = useState<string>(() => {
    try {
      return localStorage.getItem("sgs_evening_sweep_time") || "17:00";
    } catch {
      return "17:00";
    }
  });
  const [executedSweeps, setExecutedSweeps] = useState<string[]>(() => {
    try {
      const s = localStorage.getItem("sgs_executed_sweeps");
      return s ? JSON.parse(s) : [];
    } catch {
      return [];
    }
  });

  // Target date configuration for the active Sweep
  const [sweepTargetType, setSweepTargetType] = useState<"today" | "history">("today");
  const [sweepHistoryDate, setSweepHistoryDate] = useState<string>(() => {
    // defaults to today's date format (YYYY-MM-DD)
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });

  // Quick filtration and search states for managing 500+ devices list easily
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline">("all");
  const [visibleLimit, setVisibleLimit] = useState(40);

  // Multi-select for deleting cameras in bulk
  const [selectedCameraIds, setSelectedCameraIds] = useState<string[]>([]);

  // Local Help and Diagnostics Setup Guide State
  const [showAdvancedHelp, setShowAdvancedHelp] = useState(false);

  const BRIDGE_SCRIPT_CODE = `/**
 * CCTV WATCHDOG - STANDALONE LOCAL PING BRIDGE
 * Run using: node local-ping-bridge.js
 */
const http = require("http");
const net = require("net");
const { exec } = require("child_process");

const PORT = 3555;
const HOST = "127.0.0.1";
const PORTS_TO_PROBE = [80, 554, 443, 8000, 37777];

function runSystemPing(ip, timeoutMs) {
  return new Promise((resolve) => {
    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? \`ping -n 1 -w \${timeoutMs} \${ip}\`
      : \`ping -c 1 -W \${Math.max(1, Math.round(timeoutMs / 1000))} \${ip}\`;

    exec(cmd, (error, stdout) => {
      const output = (stdout || "").toLowerCase();
      resolve(output.includes("ttl="));
    });
  });
}

function probePort(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let completed = false;
    socket.setTimeout(timeoutMs);

    socket.connect(port, ip, () => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(true);
      }
    });

    socket.on("error", (err) => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(err.code === "ECONNREFUSED");
      }
    });

    socket.on("timeout", () => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(false);
      }
    });
  });
}

function isValidIpv4(ip) {
  const clean = ip.trim();
  if (clean === "localhost" || clean === "127.0.0.1") return true;
  const parts = clean.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

async function pingLocalIp(ip, timeoutMs = 1200) {
  const cleanIp = ip.trim();
  if (!isValidIpv4(cleanIp)) {
    return { ip: cleanIp, status: "offline", error: "Invalid IPv4" };
  }
  const startTime = Date.now();

  const isIcmpOnline = await runSystemPing(cleanIp, timeoutMs);
  if (isIcmpOnline) {
    return { ip: cleanIp, status: "online", latencyMs: Date.now() - startTime };
  }

  const probes = PORTS_TO_PROBE.map((port) => probePort(cleanIp, port, timeoutMs));
  const results = await Promise.all(probes);
  const isTcpOnline = results.some((res) => res === true);

  return {
    ip: cleanIp,
    status: isTcpOnline ? "online" : "offline",
    latencyMs: Date.now() - startTime,
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Private-Network", "true");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, \`http://\${req.headers.host}\`);

  if (url.pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "active", system: "CCTV Watchdog Local Bridge" }));
    return;
  }

  if (url.pathname === "/ping" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        if (!payload.ip) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing Target IP" }));
          return;
        }
        const result = await pingLocalIp(payload.ip, payload.timeoutMs || 1200);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal Error" }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, HOST, () => {
  console.log(\`🔒 CCTV Watchdog Local Bridge running on http://\${HOST}:\${PORT}\`);
});
`;

  const BAT_CODE = `@echo off
title CCTV Watchdog Local Ping Bridge (Port 3555)
color 0A
echo ===================================================
echo   CCTV WATCHDOG - LOCAL LAN PING BRIDGE STARTUP
echo ===================================================
echo.
echo Checking Node.js installation...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed! Please install Node.js from https://nodejs.org
    pause
    exit /b
)

echo Starting Local Ping Bridge on http://127.0.0.1:3555 ...
echo Keep this window open while using the CCTV Watchdog Hub dashboard.
echo.
node local-ping-bridge.js
pause
`;

  const downloadBridgeScript = () => {
    const blob = new Blob([BRIDGE_SCRIPT_CODE], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "local-ping-bridge.js";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadBridgeBat = () => {
    const blob = new Blob([BAT_CODE], { type: "application/x-bat" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "run-ping-bridge.bat";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBridgeScript = () => {
    navigator.clipboard.writeText(BRIDGE_SCRIPT_CODE);
    alert("📋 Local Bridge JavaScript code copied to clipboard! Save as 'local-ping-bridge.js' and run 'node local-ping-bridge.js' in CMD.");
  };

  const checkLocalBridgeHealth = async (): Promise<boolean> => {
    return isLocalBridgeActive();
  };

  // Report results list
  const [filteredLogs, setFilteredLogs] = useState<CctvLog[]>(() => {
    // defaults to all
    return DEFAULT_LOGS;
  });

  // Keep live clock ticking and set default form indices
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // conversion 0 to 12
      const min = String(now.getMinutes()).padStart(2, '0');
      const sec = String(now.getSeconds()).padStart(2, '0');
      setCurrentTime(`${dd}/${mm}/${yyyy} ${String(hours).padStart(2, '0')}:${min}:${sec} ${ampm}`);
    }, 1000);

    // Initial run
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const min = String(now.getMinutes()).padStart(2, '0');
    const sec = String(now.getSeconds()).padStart(2, '0');
    setCurrentTime(`${dd}/${mm}/${yyyy} ${String(hours).padStart(2, '0')}:${min}:${sec} ${ampm}`);

    return () => clearInterval(timer);
  }, []);

  // Update next sNo count based on active networkZone when loading
  useEffect(() => {
    const networkZoneCams = cameras.filter(c => c.networkZone === selectedZone);
    const maxSNo = networkZoneCams.reduce((max, c) => (c.sNo > max ? c.sNo : max), 0);
    setFormSNo(maxSNo + 1);
  }, [cameras, selectedZone]);

  // Synchronize reports networkZone filter automatically with selected networkZone zone
  useEffect(() => {
    setReportZone(selectedZone);
  }, [selectedZone]);

  // Persist camera groups
  useEffect(() => {
    localStorage.setItem("sgs_cctv_groups", JSON.stringify(cameraGroups));
  }, [cameraGroups]);

  // Load initial camera registry and transaction logs from IndexedDB on initialization
  useEffect(() => {
    let active = true;
    const fetchIndexedDBData = async () => {
      try {
        const dbCams = await loadCamsFromIndexedDB();
        if (active && dbCams && dbCams.length > 0) {
          setCameras(dbCams);
        }
        const dbLogs = await loadLogsFromIndexedDB();
        if (active && dbLogs && dbLogs.length > 0) {
          setLogs(dbLogs);
        }
      } catch (err) {
        // console.error("Failed to fetch initial IndexedDB data:", err);
      }
    };
    fetchIndexedDBData();
    return () => {
      active = false;
    };
  }, []);

  // Persist storage whenever collections change
  const saveCamsToStorage = (updatedCams: CctvCamera[]) => {
    setCameras(updatedCams);
    localStorage.setItem("sgs_cctv_mappings", JSON.stringify(updatedCams));
    saveCamsToIndexedDB(updatedCams).catch(err => {
      // console.error("IndexedDB error writing mappings:", err);
    });
  };

  // Let the user toggle camera status manually on click (extremely useful for Cloud Preview/Demo)
  const handleToggleCameraStatus = (camId: string) => {
    const updated = cameras.map(cam => {
      if (cam.id === camId) {
        const nextStatus = cam.status === "online" ? ("offline" as const) : ("online" as const);
        return {
          ...cam,
          status: nextStatus,
          latency: nextStatus === "online" ? (cam.latency || 18) : undefined,
          lastPingTime: new Date().toLocaleTimeString()
        };
      }
      return cam;
    });
    saveCamsToStorage(updated);
  };


  const saveLogsToStorage = (updatedLogs: CctvLog[]) => {
    setLogs(updatedLogs);
    localStorage.setItem("sgs_cctv_logs", JSON.stringify(updatedLogs));
    saveLogsToIndexedDB(updatedLogs).catch(err => {
      // console.error("IndexedDB error writing logs:", err);
    });
  };

  // Filter logs for the Report view automatically based on parameters
  useEffect(() => {
    handleRunQuery();
  }, [logs, reportZone, filterMode, fromDate, endDate, targetDate]);

  // Persist Scheduler parameters to localStorage on change
  useEffect(() => {
    localStorage.setItem("sgs_auto_morning_enabled", JSON.stringify(autoMorningEnabled));
  }, [autoMorningEnabled]);

  useEffect(() => {
    localStorage.setItem("sgs_auto_evening_enabled", JSON.stringify(autoEveningEnabled));
  }, [autoEveningEnabled]);

  useEffect(() => {
    localStorage.setItem("sgs_morning_sweep_time", morningSweepTime);
  }, [morningSweepTime]);

  useEffect(() => {
    localStorage.setItem("sgs_evening_sweep_time", eveningSweepTime);
  }, [eveningSweepTime]);

  // Hourly Scheduler background check loop (every 15s)
  useEffect(() => {
    const runScheduledChecks = () => {
      if (isTriggeringPing) return;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentDate = String(now.getDate()).padStart(2, '0');
      const todayYMD = `${currentYear}-${currentMonth}-${currentDate}`;

      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMins = String(now.getMinutes()).padStart(2, '0');
      const currentTimeString = `${currentHours}:${currentMins}`;

      // Morning trigger check
      if (autoMorningEnabled) {
        const morningKey = `${todayYMD}-morning`;
        if (currentTimeString === morningSweepTime && !executedSweeps.includes(morningKey)) {
          setExecutedSweeps(prev => {
            const next = [...prev, morningKey];
            localStorage.setItem("sgs_executed_sweeps", JSON.stringify(next));
            return next;
          });
          setPingConsoleLogs(prev => [
            `⏰ [SCHEDULER] Automatically triggering scheduled MORNING check...`,
            ...prev
          ]);
          handleTriggerPingSweep();
        }
      }

      // Evening trigger check
      if (autoEveningEnabled) {
        const eveningKey = `${todayYMD}-evening`;
        if (currentTimeString === eveningSweepTime && !executedSweeps.includes(eveningKey)) {
          setExecutedSweeps(prev => {
            const next = [...prev, eveningKey];
            localStorage.setItem("sgs_executed_sweeps", JSON.stringify(next));
            return next;
          });
          setPingConsoleLogs(prev => [
            `⏰ [SCHEDULER] Automatically triggering scheduled EVENING check...`,
            ...prev
          ]);
          handleTriggerPingSweep();
        }
      }
    };

    const interval = setInterval(runScheduledChecks, 15000);
    return () => clearInterval(interval);
  }, [autoMorningEnabled, autoEveningEnabled, morningSweepTime, eveningSweepTime, executedSweeps, isTriggeringPing, cameras, selectedZone]);

  // On-load dynamic auto sweep (morning & evening backup check)
  useEffect(() => {
    const catchupAutosweeps = () => {
      const now = new Date();
      const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const currentHour = now.getHours();

      // Morning window backup: 8 AM - 12 PM
      if (autoMorningEnabled && currentHour >= 8 && currentHour < 12) {
        const morningKey = `${todayYMD}-morning`;
        if (!executedSweeps.includes(morningKey)) {
          setExecutedSweeps(prev => {
            const next = [...prev, morningKey];
            localStorage.setItem("sgs_executed_sweeps", JSON.stringify(next));
            return next;
          });
          setPingConsoleLogs(prev => [
            `⏰ [AUTOPILOT] Morning sweep caught up automatically on page load!`,
            ...prev
          ]);
          setTimeout(() => {
            handleTriggerPingSweep();
          }, 1500);
        }
      }

      // Evening window backup: 3 PM (15:00) - 8 PM (20:00)
      if (autoEveningEnabled && currentHour >= 15 && currentHour < 20) {
        const eveningKey = `${todayYMD}-evening`;
        if (!executedSweeps.includes(eveningKey)) {
          setExecutedSweeps(prev => {
            const next = [...prev, eveningKey];
            localStorage.setItem("sgs_executed_sweeps", JSON.stringify(next));
            return next;
          });
          setPingConsoleLogs(prev => [
            `⏰ [AUTOPILOT] Evening sweep caught up automatically on page load!`,
            ...prev
          ]);
          setTimeout(() => {
            handleTriggerPingSweep();
          }, 1500);
        }
      }
    };

    const t = setTimeout(catchupAutosweeps, 2500);
    return () => clearTimeout(t);
  }, [executedSweeps]);

  const handleRunQuery = () => {
    const rawFiltered = logs.filter(log => {
      // Filter by networkZone
      if (log.networkZone !== reportZone) return false;

      // Filter by date (Format: DD/MM/YYYY)
      const logIso = ddmmyyyyToYyyymmdd(log.date);
      if (!logIso) return false;

      if (filterMode === "single") {
        return logIso === targetDate;
      } else {
        const start = fromDate || "0000-00-00";
        const end = endDate || "9999-12-31";
        return logIso >= start && logIso <= end;
      }
    });

    // Deduplicate logic to prevent double reporting: 
    // Keep only the latest log per IP per Date
    const latestLogsMap = new Map<string, CctvLog>();
    
    rawFiltered.forEach(log => {
      // Determine Morning vs Evening Session to allow two logs per day (e.g., Morning and Evening)
      let session = "Morning";
      if (log.time) {
        const hour = parseInt(log.time.split(":")[0], 10);
        if (hour >= 13) { // 1:00 PM onwards considered Evening session
          session = "Evening";
        }
      }
      
      // Key by IP, Date, and Session (so Morning and Evening records don't overwrite each other)
      const uniqueKey = `${log.ipAddress}_${log.date}_${session}`;
      latestLogsMap.set(uniqueKey, log);
    });

    const deduplicatedLogs = Array.from(latestLogsMap.values());

    setFilteredLogs(deduplicatedLogs);
  };

  // Helper to ping via fetch - cleanly routing via our high-performance HTTP network health utility
  const checkIpResponse = async (
    ip: string, 
    timeoutMs = 1200
  ): Promise<{ status: "online" | "offline"; latency?: number; source?: string }> => {
    return checkCameraHttpHealth(ip, timeoutMs);
  };

  // IP TRIGGER PING command simulation with full live LAN routing check
  const handleTriggerPingSweep = async () => {
    if (isTriggeringPing) return;

    const networkZoneCams = cameras.filter(c => c.networkZone === selectedZone);
    if (networkZoneCams.length === 0) {
      alert(`The ${selectedZone} mapping registry is currently empty. Please register camera units first!`);
      return;
    }

    setIsTriggeringPing(true);
    
    const isRunLocally = typeof window !== "undefined" && 
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

    const bridgeActive = await isLocalBridgeActive();
    setIsBridgeOnline(bridgeActive);

    const bannerLogs = [
      `[WATCHDOG INITIALIZING PHYSICAL IP SWEEP - ${selectedZone.toUpperCase()}]`,
      `System timestamp: ${new Date().toLocaleString()}`,
      `Scan Mode: ${pingConcurrency === "parallel" ? "✓ ULTRA-FAST CONCURRENT PIPE (Multi-threaded)" : "⌛ STEP-BY-STEP SEQUENTIAL"}`,
      `Subnet diagnostic target size: ${networkZoneCams.length} IP nodes...`,
      bridgeActive
        ? `🔌 Hardware Bridge: 🟢 LOCAL BRIDGE ACTIVE (http://127.0.0.1:3555 - Subnet LAN socket probe)`
        : isRunLocally 
        ? `🌍 Execution Mode: 🟢 LOCAL SYSTEM HOST (Node Server direct LAN ping active)`
        : `🌍 Execution Mode: 🔵 CLOUD PREVIEW (Sandbox registry fallback active)`
    ];

    if (!bridgeActive && !isRunLocally) {
      bannerLogs.push(
        `💡 Tip: Run 'node local-ping-bridge.js' on your school PC for 100% real Windows ICMP pings.`
      );
    }
    bannerLogs.push(`----------------------------------------------------`);
    setPingConsoleLogs(bannerLogs);

    let tempCams = [...cameras];
    const tempLogs: CctvLog[] = [];

    if (pingConcurrency === "parallel") {
      // Multi-camera batch ping sweep with batch concurrency of 25 nodes (prevents network congestion)
      const chunkSize = 25; 
      for (let offset = 0; offset < networkZoneCams.length; offset += chunkSize) {
        const chunk = networkZoneCams.slice(offset, offset + chunkSize);
        setCurrentPingTarget(`Batch [${offset + 1} - ${Math.min(offset + chunkSize, networkZoneCams.length)}]`);

        setPingConsoleLogs(prev => [
          ...prev,
          `⚡ Launching active diagnostic pipeline for IP chunk [${offset + 1} - ${Math.min(offset + chunkSize, networkZoneCams.length)}] / ${networkZoneCams.length}...`
        ]);

        const chunkResponses = await Promise.all(
          chunk.map(async (cam, relativeIdx) => {
            const absoluteIdx = offset + relativeIdx;
            const healthResult = await checkIpResponse(cam.ipAddress, 1200);
            const latency = healthResult.latency ?? 18;
            return { cam, status: healthResult.status, latency, source: healthResult.source, index: absoluteIdx };
          })
        );

        // Process chunk responses
        chunkResponses.forEach(({ cam, status, latency, source, index }) => {
          const sourceTag = source ? ` [${source.toUpperCase()}]` : "";
          setPingConsoleLogs(prev => [
            ...prev,
            status === "online"
              ? `  [✓ ONLINE${sourceTag}] ${cam.ipAddress} (${cam.cameraName}) replied in ${latency}ms (Live OK)`
              : `  [✗ TIMEOUT${sourceTag}] Request elapsed timeout for index=${index + 1} ip_addr=${cam.ipAddress} (No respond)`
          ]);

          // Update in local camera registry lists
          tempCams = tempCams.map(c => {
            if (c.id === cam.id) {
              return { ...c, status, latency: status === "online" ? latency : undefined, lastPingTime: new Date().toLocaleTimeString() };
            }
            return c;
          });

          // Generate attendance logs
          let formattedDate = "";
          let formattedTime = "";
          if (sweepTargetType === "history" && sweepHistoryDate) {
            const parts = (sweepHistoryDate || "").split("-");
            formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : sweepHistoryDate;
            formattedTime = "12:00"; // administrative snapshot representation
          } else {
            const today = new Date();
            const dd = String(today.getDate()).padStart(2, "0");
            const mm = String(today.getMonth() + 1).padStart(2, "0");
            const yyyy = today.getFullYear();
            formattedDate = `${dd}/${mm}/${yyyy}`;
            formattedTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
          }

          const newLog: CctvLog = {
            id: `log-ping-${Date.now()}-${index}`,
            sNo: logs.length + tempLogs.length + 1,
            date: formattedDate,
            ipAddress: cam.ipAddress,
            cameraName: cam.cameraName,
            roomNumber: cam.roomNumber,
            classNameField: cam.classNameField,
            floor: cam.floor,
            cameraType: cam.cameraType,
            dvrNvr: cam.dvrNvr,
            status,
            time: formattedTime,
            networkZone: selectedZone
          };
          tempLogs.push(newLog);
        });

        // Instant React state flush for real-time visual progress
        setCameras([...tempCams]);
        await new Promise(resolve => setTimeout(resolve, 80)); // Snappy break for rendering
      }

    } else {
      // Step-by-step classic visual sweep
      for (let i = 0; i < networkZoneCams.length; i++) {
        const cam = networkZoneCams[i];
        setCurrentPingTarget(cam.ipAddress);

        setPingConsoleLogs(prev => [
          ...prev,
          `PINGING IP: ${cam.ipAddress} (${cam.cameraName}) Room: ${cam.roomNumber}...`
        ]);

        const healthResult = await checkIpResponse(cam.ipAddress, 1200);
        const liveStatusResult = healthResult.status;
        const latency = healthResult.latency ?? 1;
        const sourceTag = healthResult.source ? ` [${healthResult.source.toUpperCase()}]` : "";

        setPingConsoleLogs(prev => [
          ...prev,
          liveStatusResult === "online"
            ? `  [✓ CLOUD-REPLY${sourceTag}] 64 bytes from ${cam.ipAddress}: icmp_seq=${i} ttl=128 time=${latency}ms`
            : `  [✗ TIMEOUT${sourceTag}] Request timeout sequence for sequence_id=${i} - Transmission Halt`
        ]);

        tempCams = tempCams.map(c => {
          if (c.id === cam.id) {
            return { ...c, status: liveStatusResult, latency: liveStatusResult === "online" ? latency : undefined, lastPingTime: new Date().toLocaleTimeString() };
          }
          return c;
        });

        setCameras(prev => prev.map(c => {
          if (c.id === cam.id) {
            return { ...c, status: liveStatusResult, latency: liveStatusResult === "online" ? latency : undefined, lastPingTime: new Date().toLocaleTimeString() };
          }
          return c;
        }));

        let formattedDate = "";
        let formattedTime = "";
        if (sweepTargetType === "history" && sweepHistoryDate) {
          const parts = (sweepHistoryDate || "").split("-");
          formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : sweepHistoryDate;
          formattedTime = "12:00"; // administrative snapshot representation
        } else {
          const today = new Date();
          const dd = String(today.getDate()).padStart(2, "0");
          const mm = String(today.getMonth() + 1).padStart(2, "0");
          const yyyy = today.getFullYear();
          formattedDate = `${dd}/${mm}/${yyyy}`;
          formattedTime = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
        }

        const newLog: CctvLog = {
          id: `log-ping-${Date.now()}-${i}`,
          sNo: logs.length + tempLogs.length + 1,
          date: formattedDate,
          ipAddress: cam.ipAddress,
          cameraName: cam.cameraName,
          roomNumber: cam.roomNumber,
          classNameField: cam.classNameField,
          floor: cam.floor,
          cameraType: cam.cameraType,
          dvrNvr: cam.dvrNvr,
          status: liveStatusResult,
          time: formattedTime,
          networkZone: selectedZone
        };
        tempLogs.push(newLog);

        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    setCurrentPingTarget(null);

    // Commit batch updates
    saveCamsToStorage(tempCams);
    saveLogsToStorage([...tempLogs, ...logs]);

    const endLogs = [
      `----------------------------------------------------`,
      `✓ SUCCESS: ACTIVE ATTENDANCE SWEEP COMPLETED SECURELY!`,
      `State mappings persistent logged and synchronized cache successfully.`
    ];

    if (!bridgeActive && !isRunLocally) {
      endLogs.push(
        `💡 Tip: Start local-ping-bridge.js (port 3555) on your local computer to ping real physical cameras on your school LAN.`,
        `👆 Note: You can click any ONLINE / OFFLINE badge in the table to toggle its state manually for testing!`
      );
    }

    setPingConsoleLogs(prev => [...prev, ...endLogs]);
    setIsTriggeringPing(false);
  };

  // Add / Edit mapping operations with automated real-time dynamic check on save
  const handleSaveCameraMapping = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanIp = formIp.trim();
    if (!cleanIp || !formName.trim() || !formRoom.trim()) {
      alert("Please fill in camera name, class location, and target IP address!");
      return;
    }

    if (!isValidIpv4(cleanIp)) {
      alert(`"${cleanIp}" is not a valid IPv4 address!\nIPv4 addresses must consist of 4 numbers between 0 and 255 separated by dots (e.g. 192.168.0.50).`);
      return;
    }

    // Auto-detect IP status on save - tests live response from device
    const healthResult = await checkCameraHttpHealth(cleanIp, 1500);
    const detectedStatus: "online" | "offline" = healthResult.status;
    const latency = healthResult.status === "online" ? healthResult.latency : undefined;

    if (editingCameraId) {
      // Editing Mode
      const updated = cameras.map(cam => {
        if (cam.id === editingCameraId) {
          return {
            ...cam,
            sNo: formSNo,
            ipAddress: cleanIp,
            cameraName: formName.trim(),
            roomNumber: formRoom.trim(),
            classNameField: formClassName.trim(),
            floor: formFloor.trim(),
            cameraType: formType.trim(),
            dvrNvr: formDvr.trim(),
            status: detectedStatus,
            latency,
            networkZone: selectedZone
          };
        }
        return cam;
      });
      saveCamsToStorage(updated);
      setEditingCameraId(null);
      if (detectedStatus === "online") {
        alert(`✅ Camera mapping updated! IP ${cleanIp} responded in ${latency}ms (ONLINE).`);
      } else {
        alert(`⚠️ Camera mapping updated! IP ${cleanIp} did not respond (OFFLINE).`);
      }
    } else {
      // Adding Mode
      // Check for duplication
      const isIpExists = cameras.some(c => c.ipAddress === cleanIp && c.networkZone === selectedZone);
      if (isIpExists) {
        alert(`Camera IP ${cleanIp} is already registered in ${selectedZone}!`);
        return;
      }

      const newCam: CctvCamera = {
        id: `cam-${Date.now()}`,
        sNo: formSNo,
        ipAddress: cleanIp,
        cameraName: formName.trim(),
        roomNumber: formRoom.trim(),
        classNameField: formClassName.trim(),
        floor: formFloor.trim(),
        cameraType: formType.trim(),
        dvrNvr: formDvr.trim(),
        status: detectedStatus,
        latency,
        networkZone: selectedZone
      };

      saveCamsToStorage([...cameras, newCam]);
      if (detectedStatus === "online") {
        alert(`✅ Registered new camera! IP ${cleanIp} responded in ${latency}ms (ONLINE).`);
      } else {
        alert(`⚠️ Registered new camera! IP ${cleanIp} did not respond (OFFLINE).`);
      }
    }

    // Reset Form
    setFormIp("");
    setFormName("");
    setFormRoom("");
    setFormClassName("");
    setFormFloor("GROUND FLOOR");
    setFormType("IP CAMERA");
    setFormDvr("DVR");
    setFormStatus("online");
  };

  // Bulk Raw Text Paste parse & import mapping
  const handleBatchImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchText.trim()) {
      alert("Please paste some comma-separated camera mappings first!");
      return;
    }

    const lines = batchText.split("\n");
    const parsedCams: CctvCamera[] = [];
    let dupCount = 0;
    let formatErrorCount = 0;

    // Get current max sNo for this networkZone
    const currentNetworkCams = cameras.filter(c => c.networkZone === selectedZone);
    let nextSNo = currentNetworkCams.reduce((max, c) => (c.sNo > max ? c.sNo : max), 0) + 1;

    lines.forEach((line, lIdx) => {
      const cleanLine = line.trim();
      if (!cleanLine) return; // skip empty line

      // Smart Auto-detect delimiter: try tab first, then comma, then spaces
      let parts: string[] = [];
      if (cleanLine.includes("\t")) {
        parts = cleanLine.split("\t").map(p => p.trim());
      } else if (cleanLine.includes(",")) {
        parts = cleanLine.split(",").map(p => p.trim());
      } else {
        parts = cleanLine.split(/\s{2,}/).map(p => p.trim());
      }

      const ipRegex = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}/;
      let rawIp = "";
      let rawName = "Unknown Camera";
      let rawRoom = "";
      let rawClassName = "";
      let rawFloor = "GROUND FLOOR";
      let rawType = "IP CAMERA";
      let rawDvr = "DVR";

      if (parts.length >= 2 && ipRegex.test(cleanLine)) {
         const extractIpMatch = cleanLine.match(ipRegex);
         if (extractIpMatch) rawIp = extractIpMatch[0];

         const ipIdx = parts.findIndex(p => ipRegex.test(p));
         
         if (ipIdx !== -1) {
             rawDvr = parts[ipIdx + 1] || "DVR";
             
             let pre = parts.slice(0, ipIdx);
             
             // 1. Drop S.No if present (pure digits string at index 0)
             if (pre.length > 0 && /^\d+$/.test(pre[0])) {
                 pre.shift();
             }
             
             // Now pre contains [Floor, Room, ClassName, Type, Name] depending on what users provided.
             if (pre.length >= 1) {
                 // Usually the first string is ALWAYS Floor
                 rawFloor = pre[0];
             }
             
             if (pre.length === 2) {
                 // [Floor, Name]
                 rawName = pre[1];
             } else if (pre.length === 3) {
                 // [Floor, Room, Name]
                 rawRoom = pre[1];
                 rawName = pre[2];
             } else if (pre.length === 4) {
                 // [Floor, Room, Type, Name] or [Floor, Room, ClassName, Name]
                 rawRoom = pre[1];
                 if (/CAMERA|ONVIF|IP|ANALOG/i.test(pre[2])) {
                     rawType = pre[2];
                 } else {
                     rawClassName = pre[2];
                 }
                 rawName = pre[3];
             } else if (pre.length >= 5) {
                 // [Floor, Room, ClassName, Type, Name]
                 rawRoom = pre[1];
                 rawClassName = pre[2];
                 rawType = pre[3];
                 rawName = pre.slice(4).join(" ");
             } else if (pre.length === 0) {
                 // IP was the very first or right after S.No
                 rawName = "Unknown Camera";
             }
         }
      } else {
         // Generic fallback
         const match = cleanLine.match(ipRegex);
         if (match) rawIp = match[0];
         
         let pre = parts.filter(p => !ipRegex.test(p));
         if (pre.length > 0 && /^\d+$/.test(pre[0])) pre.shift();
         
         if (pre.length >= 2) {
             rawFloor = pre[0];
             rawName = pre.slice(1).join(" ");
         } else if (pre.length === 1) {
             rawName = pre[0];
         }
      }

      if (!rawIp) {
        formatErrorCount++;
        return;
      }

      // Check duplication in existing mapping
      const isAlreadyInDb = cameras.some(c => c.ipAddress === rawIp && c.networkZone === selectedZone) || 
                            parsedCams.some(c => c.ipAddress === rawIp);
      if (isAlreadyInDb) {
        dupCount++;
        return;
      }

      parsedCams.push({
        id: `cam-batch-${Date.now()}-${lIdx}`,
        sNo: nextSNo++,
        ipAddress: rawIp,
        cameraName: rawName,
        roomNumber: rawRoom,
        classNameField: rawClassName,
        floor: rawFloor,
        cameraType: rawType,
        dvrNvr: rawDvr,
        status: "offline", // default, will get detected on sweep trigger
        networkZone: selectedZone
      });
    });

    if (parsedCams.length === 0) {
      alert(`Import failed. Found ${formatErrorCount} poorly formatted lines. Duplicate count: ${dupCount}`);
      return;
    }

    const updatedList = [...cameras, ...parsedCams];
    saveCamsToStorage(updatedList);
    setBatchText("");
    alert(`Successfully imported ${parsedCams.length} new camera maps to ${selectedZone}! (Duplicate skipped: ${dupCount}, Format issues skipped: ${formatErrorCount})`);
  };

  // Subnet Block Generator mapping tool
  const handleGenerateSubnet = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPrefix = subnetPrefix.trim();
    if (!cleanPrefix) {
      alert("Subnet prefix cannot be empty!");
      return;
    }

    if (subnetStart < 0 || subnetEnd > 255 || subnetStart > subnetEnd) {
      alert("Please ensure starting host matches index bounds: 0 to 255, and is less than or equal to End host!");
      return;
    }

    const generatedSize = subnetEnd - subnetStart + 1;
    if (generatedSize > 120) {
      if (!confirm(`Warning: You are generating ${generatedSize} cameras. Generating too many custom device mappings at once might slow the browser. Continue?`)) {
        return;
      }
    }

    const generatedCams: CctvCamera[] = [];
    const currentNetworkCams = cameras.filter(c => c.networkZone === selectedZone);
    let nextSNo = currentNetworkCams.reduce((max, c) => (c.sNo > max ? c.sNo : max), 0) + 1;

    for (let host = subnetStart; host <= subnetEnd; host++) {
      const targetIp = `${cleanPrefix}.${host}`;
      
      // Duplication shield
      const exists = cameras.some(c => c.ipAddress === targetIp && c.networkZone === selectedZone);
      if (exists) continue;

      generatedCams.push({
        id: `cam-sub-${Date.now()}-${host}`,
        sNo: nextSNo++,
        ipAddress: targetIp,
        cameraName: `${subnetLabelPattern} #${host}`,
        roomNumber: `${subnetRoomPattern} ${host}`,
        status: "offline", // initialized down, user will trigger speedy sweep!
        networkZone: selectedZone
      });
    }

    if (generatedCams.length === 0) {
      alert("All generated IPs already exist in this networkZone mapping registry range!");
      return;
    }

    saveCamsToStorage([...cameras, ...generatedCams]);
    alert(`⚡ Generatively created ${generatedCams.length} device mappings for ${selectedZone}! Hit "IP TRIGGER PING" to run multi-threaded audit check on them!`);
  };

  // Load 160+ high volume demo school cameras
  const handleLoadSchoolDemo = () => {
    if (!confirm("Are you sure you want to load 160+ school-wide registered CCTV cameras? This will populate both networkZones with sample mappings to demonstrate high-range concurrency sweeps!")) {
      return;
    }

    const demoCams: CctvCamera[] = [];
    const floors = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"];
    const locations = ["Main Corridor", "Primary West Corridor", "Computer Science Lab", "Library Bookrack Sec-C", "Principal Lobby Entrance", "Back Gate Garden", "Playground Left Arc", "Sports Office Dome", "Auditorium Side Exit"];
    
    // Create ~160 cameras
    for (let i = 1; i <= 165; i++) {
      const level = floors[i % floors.length];
      const loc = locations[i % locations.length];
      const networkZoneChoice = "192.168.0.x Series";
      const roomNumber = `R .No ${100 + i}`;
      const octet = (10 + i) % 254;
      const ip = `192.168.0.${octet}`;

      demoCams.push({
        id: `cam-demo-${i}-${Date.now()}`,
        sNo: 0, // adjusted below
        ipAddress: ip,
        cameraName: `${level} ${loc} Dome ${i}`,
        roomNumber: `${roomNumber} | Wing-${i % 3 === 0 ? 'A' : 'B'}`,
        status: Math.random() > 0.15 ? "online" : "offline", // mixed healthy state 85% online
        networkZone: networkZoneChoice
      });
    }

    // Align sNo
    const aligned = demoCams.map((c, idx) => ({ ...c, sNo: idx + 1 }));
    saveCamsToStorage(aligned);
    alert("🎉 SUCCESS: Populated 160+ School Classroom & Corridor Dome mappings! Try the 'MULTI-THREADED' IP Trigger Ping sweet scans or quick filters!");
  };

  const handleEditSelect = (cam: CctvCamera) => {
    setEditingCameraId(cam.id);
    setFormSNo(cam.sNo ?? 1);
    setFormIp(cam.ipAddress || "");
    setFormName(cam.cameraName || "");
    setFormRoom(cam.roomNumber || "");
    setFormClassName(cam.classNameField || "");
    setFormFloor(cam.floor || "GROUND FLOOR");
    setFormType(cam.cameraType || "IP CAMERA");
    setFormDvr(cam.dvrNvr || "DVR");
    setFormStatus(cam.status || "online");
  };

  const handleDeleteCamera = (camId: string) => {
    const targetCam = cameras.find(c => c.id === camId);
    if (!targetCam) return;

    if (confirm(`Are you sure you want to delete camera mapping [${targetCam.cameraName}] from the core Watchdog database?`)) {
      const updated = cameras.filter(c => c.id !== camId);
      // Recalculate SNo numbers for beautiful alignment
      const corrected = updated
        .filter(c => c.networkZone === targetCam.networkZone)
        .map((c, idx) => ({ ...c, sNo: idx + 1 }));

      const finalCams = [
        ...updated.filter(c => c.networkZone !== targetCam.networkZone),
        ...corrected
      ];

      saveCamsToStorage(finalCams);
      alert("Camera mapping purged.");

      // If we were editing that camera, clear editor
      if (editingCameraId === camId) {
        setEditingCameraId(null);
        setFormIp("");
        setFormName("");
        setFormRoom("");
      }
    }
  };

  // Reset selected camera IDs on networkZone change
  useEffect(() => {
    setSelectedCameraIds([]);
  }, [selectedZone]);

  const handleDeleteSelectedCameras = () => {
    if (selectedCameraIds.length === 0) {
      alert("Please select the checkboxes of the cameras you wish to delete first.");
      return;
    }

    if (confirm(`Are you sure you want to permanently delete the ${selectedCameraIds.length} selected camera mappings?`)) {
      const updated = cameras.filter(c => !selectedCameraIds.includes(c.id));
      
      // Clean up SNo alignment for the selected networkZone
      const currentBldCams = updated.filter(c => c.networkZone === selectedZone);
      const reindexedCurrentBldCams = currentBldCams.map((c, idx) => ({ ...c, sNo: idx + 1 }));
      
      const finalCams = [
        ...updated.filter(c => c.networkZone !== selectedZone),
        ...reindexedCurrentBldCams
      ];

      saveCamsToStorage(finalCams);
      setSelectedCameraIds([]);
      alert("Selected camera mappings have been deleted successfully.");
    }
  };

  const handleClearAllNetworkCameras = () => {
    const zoneCamsCount = cameras.filter(c => c.networkZone === selectedZone).length;
    if (zoneCamsCount === 0) {
      alert("There are no registered cameras in this networkZone.");
      return;
    }

    if (confirm(`WARNING ⚠️: This will permanently delete ALL ${zoneCamsCount} registered cameras inside ${selectedZone}. Do you want to proceed?`)) {
      const otherBldCams = cameras.filter(c => c.networkZone !== selectedZone);
      saveCamsToStorage(otherBldCams);
      setSelectedCameraIds([]);
      alert("All registered cameras in this networkZone have been cleared.");
    }
  };

  // FULL OFFLINE BACKUP EXPORT & RESTORE ENGINE (FREE MULTI-YEAR SOLUTION)
  const handleExportCctvBackup = () => {
    try {
      const backupData = {
        appSignature: "sgs_cctv_watchdog_v2",
        exportTimestamp: Date.now(),
        exportDateStr: new Date().toLocaleDateString("en-IN"),
        camerasCount: cameras.length,
        logsCount: logs.length,
        cameras,
        logs
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      const dateString = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `BI_CCTV_Full_OfflineBackup_${dateString}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      // console.error("Backup failed:", err);
      alert("Failed to compile and download backup file.");
    }
  };

  const handleImportCctvBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rawContent = e.target?.result as string;
        const parsed = JSON.parse(rawContent);

        if (parsed.appSignature !== "sgs_cctv_watchdog_v2" || !Array.isArray(parsed.cameras) || !Array.isArray(parsed.logs)) {
          alert("Invalid or corrupt backup file. Please select a valid CCTV Watchdog Hub JSON backup file.");
          return;
        }

        if (confirm(`Do you want to restore ${parsed.cameras.length} camera mappings and ${parsed.logs.length} attendance records? This will overwrite your current configuration. Proceed?`)) {
          saveCamsToStorage(parsed.cameras);
          saveLogsToStorage(parsed.logs);
          alert(`🎉 Backup Restored Successfully!\n- Cameras Restored: ${parsed.cameras.length}\n- Log Records Restored: ${parsed.logs.length}\nYour original configuration has been loaded successfully!`);
        }
      } catch (err) {
        // console.error("Failed to parse backup:", err);
        alert("Failed to read the file. Please ensure it is a valid backup file.");
      }
    };
    reader.readAsText(file);
    // Clear input so same file can be selected again
    event.target.value = "";
  };

  const handlePurgeLogsOlderThan = (days: number) => {
    if (logs.length === 0) {
      alert("The backup database contains no attendance records to purge.");
      return;
    }

    const titleMsg = days === 0 
      ? `WARNING ⚠️: Are you sure you want to clean all attendance history logs (${logs.length} records)?`
      : `WARNING ⚠️: Are you sure you want to clean attendance logs older than ${days} days?`;

    const subMsg = days === 0
      ? "This action will permanently wipe all history. Recommendation: Download a backup copy first! Proceed to wipe everything?"
      : `This will permanently delete logs older than ${days} days from browser storage. Proceed?`;

    if (confirm(`${titleMsg}\n${subMsg}`)) {
      if (days === 0) {
        saveLogsToStorage([]);
        alert("All attendance history logs have been cleared successfully.");
      } else {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        const remaining = logs.filter(log => {
          const ymd = ddmmyyyyToYyyymmdd(log.date);
          if (!ymd) return true; // keep unknown structure
          const logTime = new Date(ymd).getTime();
          return logTime >= cutoffTime;
        });

        const deletedCount = logs.length - remaining.length;
        saveLogsToStorage(remaining);
        alert(`Successfully cleared ${deletedCount} old records. ${remaining.length} records remain in offline storage.`);
      }
    }
  };

  // Report download exporters (CSV structure)
  const downloadCsv = (dataList: any[], filename: string) => {
    if (dataList.length === 0) {
      alert("No attendance metrics are found in this query to write.");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\r\n";
    csvContent += "S.No,ROOM NO,CLASS NAME,CAMERA NAME,IP ADDRESS,STATUS AUDIT,SNAPSHOT TIME\r\n";
    
    dataList.forEach((item, index) => {
      const sNo = index + 1;
      const roomNo = `"${item.roomNumber || item.location || ""}"`;
      const clsName = `"${item.classNameField || ""}"`;
      const name = `"${item.cameraName || item.deviceName || ""}"`;
      const ip = `"${item.ipAddress || item.ip || ""}"`;
      const stat = (item.status || "online").toUpperCase();
      const timeStr = `"${item.time || item.timestamp || ""}"`;
      csvContent += `${sNo},${roomNo},${clsName},${name},${ip},${stat},${timeStr}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadExcelReport = () => {
    // Current networkZone mapping
    const zoneCams = cameras.filter(c => c.networkZone === selectedZone);
    downloadCsv(zoneCams, `BI_CCTV_Mapping_${selectedZone.replace(" ", "_")}`);
  };

  // Print friendly view Modal / Trigger
  const handlePrintPdfReport = () => {
    const zoneCams = cameras.filter(c => c.networkZone === selectedZone);
    if (zoneCams.length === 0) {
      alert("No camera coordinates mapped. Registered lists are empty.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Popup blocker prevented launching paper print window. Please trust this app to print.");
      return;
    }

    let contentHtml = `
      <table>
        <thead>
          <tr>
            <th style="width: 5%;">S.No</th>
            <th style="width: 15%;">ROOM NO</th>
            <th style="width: 20%;">CLASS NAME</th>
            <th style="width: 15%;">CAMERA NAME</th>
            <th style="width: 20%;">IP ADDRESS</th>
            <th style="width: 10%;">STATUS AUDIT</th>
            <th style="width: 15%;">SNAPSHOT TIME</th>
          </tr>
        </thead>
        <tbody>
    `;

    zoneCams.forEach((c, index) => {
      contentHtml += `
        <tr style="border-bottom: 1px solid #ddd;">
          <td style="padding: 8px;">${index+1}</td>
          <td style="padding: 8px;">${c.roomNumber || ""}</td>
          <td style="padding: 8px;">${c.classNameField || ""}</td>
          <td style="padding: 8px;">${c.cameraName}</td>
          <td style="padding: 8px; font-family: monospace;">${c.ipAddress}</td>
          <td style="padding: 8px; font-weight: bold; color: ${c.status === "online" ? "green" : "red"};">
            ${c.status.toUpperCase()}
          </td>
          <td style="padding: 8px; font-family: monospace;">-</td>
        </tr>
      `;
    });

    contentHtml += `
        </tbody>
      </table>
    `;

    printWindow.document.write(`
      <html>
        <head>
          <title>BI CCTV Mapping Status Audit</title>
          <style>
            @page { size: portrait; margin: 15mm; }
            body { font-family: Arial, sans-serif; color: #000; margin: 0; }
            h1 { font-family: monospace; color: #d97706; margin-bottom: 5px; text-transform: uppercase; font-size: 20px;}
            p { font-size: 12px; color: #333; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: left; }
            th, td { border: 1px solid #000; padding: 6px 8px; font-size: 11px; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .header-box { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header-box">
            <h1>Corporate Subnet Node Export Registry</h1>
            <p><strong>Network Cluster:</strong> ${selectedZone}</p>
            <p><strong>Generated Date & Time:</strong> ${currentTime}</p>
            <p><strong>Total Active Units:</strong> ${zoneCams.filter(c => c.status === "online").length} of ${zoneCams.length}</p>
          </div>
          ${contentHtml}
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Derive metrics safely
  const activeNetworkCams = cameras.filter(c => c.networkZone === selectedZone);
  const onlineCount = activeNetworkCams.filter(c => c.status === "online").length;
  const offlineCount = activeNetworkCams.filter(c => c.status === "offline").length;
  const totalCount = activeNetworkCams.length;

  const searchedCams = activeNetworkCams.filter(cam => {
    const matchesSearch = cam.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cam.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cam.roomNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || cam.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="cctv-watchdog-hub" className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950 font-sans custom-scrollbar text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 border-slate-200 dark:border-slate-800 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-16 h-12 sm:w-20 sm:h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex items-center justify-center shadow-sm shrink-0 relative group">
            <img 
              src="/birla_open_minds_logo.png" 
              alt="Birla Open Minds International School Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.classList.add('bg-pink-500/10', 'border-pink-500/20');
              }}
            />
            {/* Fallback icon if image fails to load */}
            <Video size={24} className="text-pink-500 animate-pulse absolute -z-10 group-hover:opacity-0 transition-opacity" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black font-mono tracking-tight text-slate-800 dark:text-slate-100 uppercase">
              Centralized IP Camera & Topology Registry
            </h1>
            <p className="text-xs text-slate-450 font-medium mt-1">
              Automated Subnet Watchdog & Device Ping Matrix
            </p>
          </div>
        </div>
        <div className="bg-slate-100 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl px-4 py-2.5 flex flex-col items-end shadow-sm">
          <span className="text-[9px] font-extrabold tracking-widest text-[#F6AD55] uppercase">SYSTEM REAL TIME CLOCK</span>
          <span className="text-sm font-bold font-mono text-indigo-600 dark:text-indigo-400 select-all tracking-tight animate-fade-in">
            {currentTime || "Synchronizing..."}
          </span>
        </div>
      </div>

      {/* Local Bridge / Cloud Diagnostic Status & Tip Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-sm transition-all duration-200 ${
        isBridgeOnline 
          ? "bg-emerald-50/85 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
          : "bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200"
      }`}>
        <div className="flex items-start md:items-center gap-3">
          <div className={`p-2 rounded-xl shrink-0 ${
            isBridgeOnline 
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
              : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
          }`}>
            {isBridgeOnline ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm tracking-tight">
                {isBridgeOnline 
                  ? "🟢 Local Ping Bridge Active (Port 3555)" 
                  : "Tip: Start local-ping-bridge.js (port 3555) on your local computer to ping real physical cameras on your school LAN."}
              </span>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isBridgeOnline 
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
              }`}>
                {isBridgeOnline ? "LAN Connected" : "Cloud Sandbox Preview"}
              </span>
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed">
              {isBridgeOnline 
                ? "Direct on-premise ICMP and high-speed TCP socket probes (ports 80, 554, 443, 8000, 37777) are active with low latency."
                : "Cloud sandbox browsers isolate local private subnets (RFC 1918). Run 'node local-ping-bridge.js' for physical cameras, or click any ONLINE / OFFLINE badge in the table to toggle its state manually for instant report & PDF testing."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
          <button
            type="button"
            onClick={() => {
              isLocalBridgeActive().then(res => setIsBridgeOnline(res));
            }}
            className="px-3 py-1.5 text-xs font-bold rounded-xl border bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5 text-slate-700 dark:text-slate-200"
            title="Re-check local ping bridge connection"
          >
            <RefreshCw size={12} className={isBridgeOnline ? "" : "text-amber-500"} />
            <span>Check Bridge</span>
          </button>
        </div>
      </div>

      {/* Real-time CCTV Health Summary Card Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="cctv-realtime-health-summary-panel">
        
        {/* Total Nodes Card */}
        <button 
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`relative p-5 text-left rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 cursor-pointer select-none group w-full ${
            statusFilter === "all" 
              ? "border-indigo-500 shadow-md ring-2 ring-indigo-500/10 scale-[1.01]" 
              : "border-slate-205 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow shadow-sm active:scale-99"
          }`}
          title="Click to view all camera mapping registries"
          id="visual-summary-total-card"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-500 block">
                Total Cameras Registered
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100">
                  {totalCount}
                </span>
                <span className="text-xs font-bold text-slate-450 uppercase font-mono">
                  Units
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl transition-colors ${
              statusFilter === "all"
                ? "bg-indigo-500/15 text-indigo-550 dark:text-indigo-400"
                : "bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400"
            }`}>
              <Video size={22} />
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-450">Active Network Nodes:</span>
            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-350 font-mono">
              100% Core List
            </span>
          </div>

          {statusFilter === "all" && (
            <span className="absolute top-2 right-2 text-[8px] font-black tracking-widest text-indigo-650 dark:text-indigo-400 bg-indigo-500/15 rounded px-1.5 py-0.5 uppercase">
              Filtered
            </span>
          )}
        </button>

        {/* Online Status Card */}
        <button 
          type="button"
          onClick={() => setStatusFilter("online")}
          className={`relative p-5 text-left rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 cursor-pointer select-none group w-full ${
            statusFilter === "online" 
              ? "border-emerald-500 shadow-md ring-2 ring-emerald-500/10 scale-[1.01]" 
              : "border-slate-205 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow shadow-sm active:scale-99"
          }`}
          title="Click to filter list to Online Cameras"
          id="visual-summary-online-card"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 block">
                Online Devices (Online Status)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-emerald-600 dark:text-emerald-400">
                  {onlineCount}
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {totalCount > 0 ? Math.round((onlineCount / totalCount) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl transition-colors relative ${
              statusFilter === "online"
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400"
            }`}>
              <Check size={22} />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-900 animate-ping"></span>
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white dark:border-slate-900"></span>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-450">Network Status:</span>
            <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-650 dark:text-emerald-350 font-mono">
              Active Responses
            </span>
          </div>

          {statusFilter === "online" && (
            <span className="absolute top-2 right-2 text-[8px] font-black tracking-widest text-emerald-650 dark:text-emerald-450 bg-emerald-500/15 rounded px-1.5 py-0.5 uppercase">
              Filtered
            </span>
          )}
        </button>

        {/* Offline Status Card */}
        <button 
          type="button"
          onClick={() => setStatusFilter("offline")}
          className={`relative p-5 text-left rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-200 cursor-pointer select-none group w-full ${
            statusFilter === "offline" 
              ? "border-rose-500 shadow-md ring-2 ring-rose-500/10 scale-[1.01]" 
              : "border-slate-205 dark:border-slate-800/80 hover:border-slate-350 dark:hover:border-slate-700 hover:shadow shadow-sm active:scale-99"
          }`}
          title="Click to filter list to Offline Cameras"
          id="visual-summary-offline-card"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">
                Offline Devices (Offline Status)
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400">
                  {offlineCount}
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono border ${
                  offlineCount > 0 
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" 
                    : "bg-slate-100 dark:bg-slate-950 text-slate-400 border-transparent"
                }`}>
                  {totalCount > 0 ? Math.round((offlineCount / totalCount) * 100) : 0}%
                </span>
              </div>
            </div>
            <div className={`p-3 rounded-xl transition-colors ${
              statusFilter === "offline"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                : "bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400"
            }`}>
              <X size={22} />
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-450">Diagnostic Signal:</span>
            <span className={`px-2 py-0.5 rounded font-mono ${
              offlineCount > 0 
                ? "bg-rose-50 dark:bg-rose-950/40 text-rose-650 dark:text-rose-350" 
                : "bg-slate-50 dark:bg-slate-950/20 text-slate-450"
            }`}>
              {offlineCount > 0 ? "Requires Review" : "Network Clean"}
            </span>
          </div>

          {statusFilter === "offline" && (
            <span className="absolute top-2 right-2 text-[8px] font-black tracking-widest text-rose-650 dark:text-rose-450 bg-rose-500/15 rounded px-1.5 py-0.5 uppercase">
              Filtered
            </span>
          )}
        </button>

      </div>

      {/* Network Selector ("choose opposition") & IP Trigger Ping Controls Row */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-205 dark:border-slate-800/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5 shrink-0 w-full md:w-auto">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Choose Network Zone:</label>
          <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 w-full md:w-auto gap-2">
            {cameraGroups.map(group => (
              <div key={group} className="flex relative items-center group/btn">
                <button
                  onDoubleClick={() => {
                    const newName = prompt(`Rename networkZone "${group}" to:`, group);
                    if (newName && newName.trim() && newName.trim() !== group && !cameraGroups.includes(newName.trim())) {
                      const finalName = newName.trim();
                      const updatedGroups = cameraGroups.map(g => g === group ? finalName : g);
                      setCameraGroups(updatedGroups);
                      if (selectedZone === group) setSelectedZone(finalName);
                      
                      const updatedCameras = cameras.map(c => c.networkZone === group ? { ...c, networkZone: finalName } : c);
                      setCameras(updatedCameras);
                      localStorage.setItem("sgs_cctv_mappings", JSON.stringify(updatedCameras));
                    } else if (newName && cameraGroups.includes(newName.trim()) && newName.trim() !== group) {
                      alert("A networkZone with that name already exists!");
                    }
                  }}
                  onClick={() => {
                    setSelectedZone(group);
                    setEditingCameraId(null);
                  }}
                  className={`flex-1 md:flex-initial px-5 py-3 rounded-md text-xs font-semibold tracking-wider transition-all uppercase flex items-center justify-center gap-2.5 cursor-pointer whitespace-nowrap border-b-2 ${
                    selectedZone === group
                      ? "bg-blue-50/50 text-blue-700 border-blue-600 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500 shadow-sm" 
                      : "bg-transparent text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${selectedZone === group ? 'bg-blue-600 dark:bg-blue-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                  <span>{group}</span>
                </button>
                {cameraGroups.length > 1 && (
                  <button 
                    onClick={() => {
                      const hasCameras = cameras.some(c => c.networkZone === group);
                      if (hasCameras) {
                        alert(`Cannot delete "${group}" because it contains CCTV cameras. Please delete or move all cameras in this networkZone first to prevent data loss.`);
                        return;
                      }
                      if (confirm(`Remove empty networkZone zone "${group}"?`)) {
                        const updated = cameraGroups.filter(g => g !== group);
                        setCameraGroups(updated);
                        if (selectedZone === group) setSelectedZone(updated[0]);
                      }
                    }}
                    className="absolute -top-1 -right-1 hidden group-hover/btn:flex bg-red-500 text-white rounded-full w-4 h-4 items-center justify-center text-[10px] font-bold hover:bg-red-600 shadow-sm z-10"
                    title="Delete Network Zone"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!isAddingGroup && (
              <button
                type="button"
                onClick={() => setIsAddingGroup(true)}
                className="flex items-center justify-center w-8 h-8 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors ml-1 my-auto"
                title="Add Network Zone"
              >
                +
              </button>
            )}
            {isAddingGroup && (
              <form onSubmit={e => {
                e.preventDefault();
                if (newGroupName.trim() && !cameraGroups.includes(newGroupName.trim())) {
                  const updatedGroups = [...cameraGroups, newGroupName.trim()];
                  setCameraGroups(updatedGroups);
                  setSelectedZone(newGroupName.trim());
                  setNewGroupName("");
                  setIsAddingGroup(false);
                }
              }} className="flex-1 md:flex-initial flex items-center px-1">
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  placeholder="New zone..."
                  className="w-24 text-[10px] font-bold px-2 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 outline-none"
                  autoFocus
                  onBlur={() => setTimeout(() => setIsAddingGroup(false), 200)}
                />
              </form>
            )}
          </div>
        </div>

        {/* Concurrency speed selector & Live Network-wide Ping Command Trigger Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          
          <div className="flex flex-col space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sweep Speed Mode:</span>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 gap-1 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setPingConcurrency("parallel")}
                className={`py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  pingConcurrency === "parallel"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                title="Recommended for 500+ cameras: diagnostics are run in parallel, completing in seconds!"
              >
                ⚡ CONCURRENT (Fast)
              </button>
              <button
                type="button"
                onClick={() => setPingConcurrency("sequential")}
                className={`py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  pingConcurrency === "sequential"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                title="Traditional step-by-step sequential ping: slow but thorough visual feedback."
              >
                ⌛ SEQUENTIAL
              </button>
            </div>
          </div>

          <div className="flex items-end h-full">
            <button
              onClick={handleTriggerPingSweep}
              disabled={isTriggeringPing}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl font-bold text-xs tracking-wider uppercase shadow transition-all cursor-pointer ${
                isTriggeringPing
                  ? "bg-amber-500 text-slate-950 animate-pulse cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95"
              }`}
            >
              {isTriggeringPing ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>SWEATING PINGS...</span>
                </>
              ) : (
                <>
                  <Activity size={14} />
                  <span>IP TRIGGER PING</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      {/* HTTPS Mixed-Content Private subnet warning and Local Bridge status helper */}
      {typeof window !== "undefined" && !(window as any).electronAPI && (
        <div className="space-y-3">
          <div className="flex justify-start sm:justify-end">
            <button
              type="button"
              onClick={() => setShowAdvancedHelp(!showAdvancedHelp)}
              className="px-4 py-2 bg-indigo-50/60 dark:bg-slate-950 hover:bg-indigo-100 dark:hover:bg-slate-900 text-indigo-700 dark:text-indigo-400 font-extrabold text-[11px] tracking-wider uppercase rounded-xl cursor-pointer transition-all border border-indigo-100 dark:border-indigo-950 flex items-center gap-1.5 shadow-sm"
            >
              <span>{showAdvancedHelp ? "❌ Close Setup Guide" : "ℹ️ Install Native Desktop Application (.EXE)"}</span>
            </button>
          </div>

          {showAdvancedHelp && (
            <div className="border border-indigo-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm text-xs animate-fade-in bg-indigo-500/5 dark:bg-indigo-950/20 text-slate-850 dark:text-slate-200">
              <div className="flex flex-col md:flex-row items-start gap-4">
                <div className="p-2.5 rounded-xl shrink-0 mt-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Terminal size={20} />
                </div>
                
                <div className="space-y-3 flex-1 w-full">
                  <p className="font-extrabold uppercase tracking-wider text-[11.5px] text-indigo-700 dark:text-indigo-400">
                    💻 Run Directly on Local PC (Local CMD Ping for School LAN)
                  </p>

                  <div className="space-y-2 leading-relaxed text-[12px]">
                    <p>
                      Because Google Cloud containers cannot physically ping private school LAN IPs (<code className="font-mono text-pink-500">192.168.x.x</code>), running locally on your school PC connects your web dashboard directly to your Windows CMD <code className="font-mono text-emerald-500">ping 192.168.6.10</code> terminal!
                    </p>
                  </div>

                  {/* 1-Click Download Action Bar */}
                  <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100">
                      ⚡ Option 1: One-Click Local Ping Bridge (Keep using this Cloud UI!)
                    </p>
                    <p className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                      To ping physical cameras located on your local school network/LAN directly from this web portal, create a file named <code className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">local-bridge.js</code> on your local computer and paste the following code:
                    </p>

                    <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl text-[10.5px] font-mono overflow-x-auto select-all max-h-48 custom-scrollbar">
{`// local-bridge.js
const http = require("http");
const { exec } = require("child_process");

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, \`http://\${req.headers.host}\`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === "/ping") {
    const ip = url.searchParams.get("ip");
    if (!ip) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing ip parameter" }));
      return;
    }

    const isWin = process.platform === "win32";
    const cmd = isWin ? \`ping -n 1 -w 1000 \${ip}\` : \`ping -c 1 -W 1 \${ip}\`;

    exec(cmd, (error, stdout) => {
      const isOnline = !error && (stdout.includes("TTL=") || stdout.includes("ttl="));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ip,
        status: isOnline ? "online" : "offline",
        latency: isOnline ? 18 : null
      }));
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(3555, "127.0.0.1", () => {
  console.log("Local Ping Bridge is running on http://127.0.0.1:3555");
});`}
                    </pre>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={downloadBridgeBat}
                        className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-transform active:scale-95"
                      >
                        <Download size={13} />
                        <span>Download Launcher (run-ping-bridge.bat)</span>
                      </button>

                      <button
                        type="button"
                        onClick={downloadBridgeScript}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700"
                      >
                        <Download size={13} />
                        <span>Download Script (local-bridge.js)</span>
                      </button>

                      <button
                        type="button"
                        onClick={copyBridgeScript}
                        className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700"
                      >
                        <FileText size={13} />
                        <span>Copy Code</span>
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Full Local Development Server */}
                  <div className="p-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <p className="font-bold text-xs text-slate-800 dark:text-slate-100">
                      🚀 Option 2: Run Entire Web App Locally (http://localhost:3000)
                    </p>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Download the full project ZIP from the top menu, extract it, open terminal in folder, and run:
                    </p>
                    <code className="block bg-slate-900 text-emerald-400 p-2.5 rounded-lg text-xs font-mono select-all">
                      npm install && npm run dev
                    </code>
                    <p className="text-[10px] text-slate-450 font-medium">
                      Open <strong className="text-indigo-500">http://localhost:3000</strong> in your browser. The Node.js server running on your PC will automatically handle all LAN pings via native OS ping!
                    </p>
                  </div>

                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Date Target block for the sweep session */}
      <div className="bg-slate-100 dark:bg-slate-900 border border-slate-205 dark:border-slate-800 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <span className="p-1 px-2.5 text-[9px] font-black uppercase text-pink-600 dark:text-pink-400 bg-pink-500/10 border border-pink-550/20 rounded-md">
            Date Target Scope:
          </span>
          <div className="flex p-0.5 bg-slate-200/60 dark:bg-slate-950 rounded-xl border border-slate-250 dark:border-slate-850 gap-0.5">
            <button
              type="button"
              onClick={() => setSweepTargetType("today")}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                sweepTargetType === "today" 
                  ? "bg-indigo-600 text-white shadow" 
                  : "text-slate-500 hover:text-slate-850 dark:hover:text-amber-400"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSweepTargetType("history")}
              className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer ${
                sweepTargetType === "history" 
                  ? "bg-indigo-600 text-white shadow" 
                  : "text-slate-500 hover:text-slate-850 dark:hover:text-amber-400"
              }`}
            >
              Past Date
            </button>
          </div>
        </div>

        {sweepTargetType === "history" && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 animate-fade-in w-full sm:w-auto bg-white dark:bg-slate-950 p-2 rounded-xl border border-dashed border-slate-250 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-450 uppercase">Simulation Date:</span>
              <input
                type="date"
                value={sweepHistoryDate}
                onChange={(e) => setSweepHistoryDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-indigo-650"
              />
            </div>
            <span className="text-[9px] text-amber-500 dark:text-amber-400 font-extrabold leading-tight">
              ⚠️ Sweeping logs on {sweepHistoryDate ? sweepHistoryDate.split("-").reverse().join("/") : ""}!
            </span>
          </div>
        )}
      </div>

      {/* HIGH-CAPACITY STORAGE ENGINE & OFFLINE YEAR BACKUP PANEL */}
      <div id="high-capacity-storage-panel" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 transition-all hover:shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-500/10 dark:bg-indigo-500/15 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl text-lg">💾</span>
            <div>
              <h2 className="text-sm font-black font-mono tracking-wider uppercase text-slate-850 dark:text-indigo-400">
                HIGH-CAPACITY FREE OFFLINE BACKUP & STORAGE CENTER
              </h2>
              <p className="text-[10px] text-slate-450 uppercase font-semibold">
                Store up to 5+ years of daily logs in browser IndexedDB with 100% free server-independent storage
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <span>Infinite Free Storage Active (100% Free)</span>
          </div>
        </div>

        {/* Storage architecture explanation details */}
        <div className="text-xs bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-850 leading-relaxed text-slate-700 dark:text-slate-300">
          <p className="font-extrabold text-indigo-650 dark:text-indigo-300 mb-1">💡 Unlimited Free Offline Storage Architecture:</p>
          <div className="space-y-1 text-[11px] font-medium leading-relaxed">
            <p>
              1. <strong>Local Database Storage (Browser IndexedDB Store):</strong> All camera configuration records and ping logs are saved directly within your browser's secure <strong>IndexedDB local database</strong> storage container without size caps or subscription fees.
            </p>
            <p>
              2. <strong>Portability & Disaster Recovery:</strong> Download JSON backups periodically to easily move your complete environment configuration over to school monitoring systems!
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Diagnostic Metrics Display */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850/60 flex flex-col justify-between space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              💻 Storage Health Diagnostics (Database Status)
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between font-bold">
                <span className="text-slate-450">Active DB Engine:</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-mono font-black">IndexedDB v1</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-450">Saved Cameras:</span>
                <span className="text-slate-800 dark:text-white font-mono font-black">{cameras.length} Nodes</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-slate-450">Total Copied Logs:</span>
                <span className="text-slate-800 dark:text-white font-mono font-black">{logs.length} Pings</span>
              </div>
            </div>
            <div className="text-[9px] text-[#F6AD55] dark:text-[#F6AD55] font-black uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded text-center border border-amber-500/20">
              ⚡ Status: 0 Server usage bills (100% Cost-Free)
            </div>
          </div>

          {/* Backup Save Actions */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850/60 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                📥 Backup & Portability Actions
              </span>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                Download your full CCTV configuration + logs as an offline backup file to save safely on your system or Google Sheets/Drive.
              </p>
            </div>
            
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleExportCctvBackup}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-all active:scale-95 shadow-sm"
              >
                <Download size={12} />
                <span>Download Backup (.JSON)</span>
              </button>

              <label className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl text-[10px] font-extrabold uppercase tracking-wide cursor-pointer transition-all">
                <RefreshCw size={12} className="text-emerald-500 animate-spin" />
                <span>Restore Backup (.JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportCctvBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Log database maintenance & clean up */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-850/60 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">
                🧹 Database Purge & Storage Cleanup
              </span>
              <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                Periodically clear old historical attendance check logs to save browser space. Download a backup file before running any purge routines.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-[9px] font-black uppercase tracking-wider">
              <button
                type="button"
                onClick={() => handlePurgeLogsOlderThan(30)}
                className="py-2.5 px-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 border border-rose-500/20 rounded-xl cursor-pointer transition-colors"
                title="Wipes log records older than 30 days"
              >
                30 Days Old Wiped
              </button>
              <button
                type="button"
                onClick={() => handlePurgeLogsOlderThan(90)}
                className="py-2.5 px-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/15 border border-rose-500/20 rounded-xl cursor-pointer transition-colors"
                title="Wipes log records older than 90 days"
              >
                90 Days Old Wiped
              </button>
              <button
                type="button"
                onClick={() => handlePurgeLogsOlderThan(180)}
                className="py-2.5 px-1 bg-amber-500/10 text-[#F6AD55] hover:bg-amber-500/15 border border-amber-500/20 rounded-xl cursor-pointer transition-colors"
                title="Wipes log records older than 180 days"
              >
                180 Days Old Wiped
              </button>
              <button
                type="button"
                onClick={() => handlePurgeLogsOlderThan(0)}
                className="py-2.5 px-1 bg-red-650 text-white hover:bg-red-700 rounded-xl cursor-pointer transition-all active:scale-95"
                title="Clears all logs unconditionally"
              >
                Clear All Logs ⚠️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DAILY AUTOMATED ATTENDANCE SCHEDULER PANEL */}
      <div id="auto-scheduler-panel" className="bg-gradient-to-br from-indigo-900/10 to-indigo-950/25 dark:from-indigo-950/30 dark:to-slate-950/60 border border-indigo-200/50 dark:border-indigo-900/50 rounded-2xl p-5 shadow-sm space-y-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-indigo-120 dark:border-indigo-950 pb-3 gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">⏰</span>
            <div>
              <h2 className="text-sm font-black font-mono tracking-wider uppercase text-indigo-600 dark:text-indigo-400">
                DAILY AUTOMATED ATTENDANCE SCHEDULER
              </h2>
              <p className="text-[10px] text-slate-450 uppercase font-semibold">
                Set and watch automated morning and evening camera snap pings dynamically
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[9px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              Active Scheduler Engine (Running)
            </span>
          </div>
        </div>

        {/* Informative English text about the automation boundaries */}
        <div className="text-xs bg-white/75 dark:bg-slate-900/50 p-4 rounded-xl border border-indigo-100/30 dark:border-indigo-950/80 leading-relaxed text-slate-750 dark:text-slate-350 space-y-2">
          <div className="font-extrabold text-indigo-650 dark:text-indigo-300 text-[13px]">💡 How the Automated Attendance Scheduler Works:</div>
          <p className="text-[11px] font-medium leading-relaxed">
            1. <strong>Automated Session Sweeping:</strong> As long as this browser tab is open, the engine will run a silent background sweep of all camera states at your configured morning and evening scheduled hours.
          </p>
          <p className="text-[11px] font-medium leading-relaxed">
            2. <strong>Auto Catch-Up Sweep Window:</strong> If you open the dashboard during either critical session window (Morning: 8 AM - 12 PM, Evening: 3 PM - 8 PM), the system automatically sweeps and records logs for today if they were missed.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Morning Configuration Card */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                🌅 MORNING SESSION
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMorningEnabled}
                  onChange={(e) => setAutoMorningEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-805 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                <span className="ml-2 text-[10px] font-extrabold uppercase text-slate-400">
                  {autoMorningEnabled ? "ON" : "OFF"}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-1.5 border-t border-b border-slate-50 dark:border-slate-950 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-slate-500 font-bold">Scheduled Trigger Time:</span>
              <input
                type="time"
                value={morningSweepTime}
                onChange={(e) => setMorningSweepTime(e.target.value)}
                disabled={!autoMorningEnabled}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-bold text-xs focus:outline-none text-rose-600 dark:text-[#F6AD55] disabled:opacity-45"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-450 uppercase">Today's Status:</span>
              {(() => {
                const now = new Date();
                const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const checked = executedSweeps.includes(`${todayYMD}-morning`);
                return checked ? (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded border border-green-550/20 text-[9px] font-black uppercase flex items-center gap-1">
                    🟢 COMPLETED ✔ (logged)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-[#F6AD55] rounded border border-amber-550/20 text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                    ⏳ Scheduled at {morningSweepTime}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Evening Configuration Card */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-150 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                🌆 EVENING SESSION
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEveningEnabled}
                  onChange={(e) => setAutoEveningEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-805 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                <span className="ml-2 text-[10px] font-extrabold uppercase text-slate-400">
                  {autoEveningEnabled ? "ON" : "OFF"}
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between gap-4 py-1.5 border-t border-b border-slate-50 dark:border-slate-950 text-xs text-slate-700 dark:text-slate-300">
              <span className="text-slate-550 font-bold">Scheduled Trigger Time:</span>
              <input
                type="time"
                value={eveningSweepTime}
                onChange={(e) => setEveningSweepTime(e.target.value)}
                disabled={!autoEveningEnabled}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-bold text-xs focus:outline-none text-rose-600 dark:text-[#F6AD55] disabled:opacity-45"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-450 uppercase">Today's Status:</span>
              {(() => {
                const now = new Date();
                const todayYMD = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const checked = executedSweeps.includes(`${todayYMD}-evening`);
                return checked ? (
                  <span className="px-2 py-0.5 bg-green-500/10 text-green-500 rounded border border-green-550/20 text-[9px] font-black uppercase flex items-center gap-1">
                    🟢 COMPLETED ✔ (logged)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-amber-500/10 text-[#F6AD55] rounded border border-amber-550/20 text-[9px] font-black uppercase flex items-center gap-1 animate-pulse">
                    ⏳ Scheduled at {eveningSweepTime}
                  </span>
                );
              })()}
            </div>
          </div>

        </div>

      </div>

      {/* Sweep Terminal Interactive Console (Appears when active scan running or log present) */}
      {pingConsoleLogs.length > 0 && (
        <div className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl shadow-lg border border-slate-800">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Terminal size={12} className="text-indigo-400 animate-pulse" />
              Watchdog Active IP Sweep Command Console ({selectedZone.toUpperCase()})
            </span>
            <button 
              onClick={() => setPingConsoleLogs([])}
              className="hover:text-red-400 text-slate-500 transition-colors uppercase text-[9px]"
            >
              CLOSE TERMINAL
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar scroll-smooth">
            {pingConsoleLogs.map((logLine, idx) => (
              <p key={idx} className={logLine.includes("TIMEOUT") ? "text-red-400 font-bold" : logLine.includes("SUCCESS") ? "text-amber-300 font-extrabold animate-pulse" : "opacity-90"}>
                {logLine}
              </p>
            ))}
            {currentPingTarget && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 animate-pulse mt-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>SWEAPING PING PROTOCOL ON MAPPED IP {currentPingTarget}...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Summary Cards & Global Download Reports Block */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold tracking-widest text-[#2563EB] uppercase block">ACTIVE ONLINE IN {selectedZone.toUpperCase()}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">{onlineCount}</span>
            <span className="text-xs font-bold text-slate-450">Units Live</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? (onlineCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold tracking-widest text-slate-400 uppercase block">DEACTIVATED UNITS ({selectedZone.toUpperCase()})</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-red-600 dark:text-red-400">{offlineCount}</span>
            <span className="text-xs font-bold text-slate-450">Units Down</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-red-500 h-full transition-all duration-500" 
              style={{ width: `${totalCount > 0 ? (offlineCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-5 shadow-sm space-y-2">
          <span className="text-[10px] font-extrabold tracking-widest text-emerald-500 uppercase block">TOTAL ACTIVATED IN DATABASE</span>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black font-mono text-[#F6AD55]">{totalCount}</span>
            <span className="text-xs font-bold text-slate-450">/ 100 Limit Mapped</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-950 h-1.5 rounded-full overflow-hidden">
            <div 
              className="bg-[#F6AD55] h-full transition-all duration-500" 
              style={{ width: `${totalCount}%` }}
            />
          </div>
        </div>

        {/* Download CSV / PDF Layout of currently selected map */}
        <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-805 rounded-2xl p-4 shadow-sm flex flex-col justify-center space-y-2.5">
          <span className="text-[9px] font-black uppercase text-slate-450 block tracking-widest text-center">EXPORT CURRENT NETWORK ZONE MAP LISTS</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadExcelReport}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 hover:text-indigo-600 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={13} className="text-emerald-500" />
              <span>EXCEL REPORT</span>
            </button>
            <button
              onClick={handlePrintPdfReport}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 hover:text-pink-600 text-xs font-extrabold rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText size={13} className="text-red-500" />
              <span>PDF PORT/VIEW</span>
            </button>
          </div>
        </div>

      </div>

      {/* Main split: Left side registration mapping panel, Right side active cameras list */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL: ENTERPRISE CAMERA INTAKE CHANNELS (Tabbed Workspace) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-5 shadow-sm space-y-4">
          
          <div className="border-b border-slate-150 dark:border-slate-800 pb-2">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">CAMERA INGESTION PORT</span>
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-850 gap-1 text-[10px] font-bold mt-1">
              <button
                type="button"
                onClick={() => setActiveUtilityTab("form")}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeUtilityTab === "form"
                    ? "bg-indigo-650 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                ➕ Single Form
              </button>
              <button
                type="button"
                onClick={() => setActiveUtilityTab("batch")}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeUtilityTab === "batch"
                    ? "bg-indigo-650 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                title="Paste batch list of items"
              >
                📋 Bulk Paste
              </button>
              <button
                type="button"
                onClick={() => setActiveUtilityTab("subnet")}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeUtilityTab === "subnet"
                    ? "bg-indigo-650 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                }`}
                title="Generate subnet IP ranges"
              >
                🌐 Subnet Range
              </button>
            </div>
          </div>

          {/* TAB 1: SINGLE FORM WORKSPACE */}
          {activeUtilityTab === "form" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold font-mono uppercase tracking-tight text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                  <Plus size={15} />
                  {editingCameraId ? "EDIT ACTIVE CAMERA MAPPING" : "ADD NEW CAMERA MAPPING"}
                </h3>
                {editingCameraId && (
                  <button 
                    onClick={() => {
                      setEditingCameraId(null);
                      setFormIp("");
                      setFormName("");
                      setFormRoom("");
                      setFormStatus("online");
                    }}
                    className="text-[10px] text-red-500 font-bold uppercase tracking-wider hover:underline cursor-pointer"
                  >
                    CANCEL EDIT
                  </button>
                )}
              </div>

              <form onSubmit={handleSaveCameraMapping} className="space-y-4 text-xs font-bold">
                {/* Network Indicator */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 block font-normal uppercase">Active Zone targeted:</span>
                  <span className="text-xs font-black text-[#F6AD55] uppercase">🎯 Cluster: {selectedZone}</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 block">S.No / Alignment Index Position:</label>
                  <input
                    type="number"
                    required
                    value={formSNo}
                    onChange={(e) => setFormSNo(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>

                {/* CAMERA IP ADDRESS */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 block">CAMERA IP ADDRESS / LAN HOST:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 192.168.1.55"
                    value={formIp}
                    onChange={(e) => setFormIp(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>

                {/* CAMERA NAME */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 block">CCTV LABEL NAME:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Science Lab Entrance Dome"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>

                {/* R.No / CLASS NAME etc. */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-450 block">FLOOR LOCATION:</label>
                    <input
                      type="text"
                      placeholder="e.g. GROUND FLOOR"
                      value={formFloor}
                      onChange={(e) => setFormFloor(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-450 block">ROOM NO:</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Room 102"
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-450 block">CLASS NAME:</label>
                    <input
                      type="text"
                      placeholder="e.g. SPORTS"
                      value={formClassName}
                      onChange={(e) => setFormClassName(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold uppercase text-slate-450 block">CAMERA TYPE:</label>
                    <input
                      type="text"
                      placeholder="e.g. IP CAMERA"
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 block">DVR / NVR RECORDER:</label>
                  <input
                    type="text"
                    placeholder="e.g. DVR"
                    value={formDvr}
                    onChange={(e) => setFormDvr(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>

                {/* CRUD Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (editingCameraId) {
                        handleDeleteCamera(editingCameraId);
                      } else {
                        alert("Select a camera from the list table first!");
                      }
                    }}
                    className="py-2.5 px-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-xl text-[10px] font-black uppercase text-center cursor-pointer transition-colors border border-red-200/20"
                  >
                    DELETE
                  </button>
                  <button
                    type="button"
                    onClick={() => alert("Simple: click any edit pencil icon (✏) on the right table list to populate parameters instantly.")}
                    className="py-2.5 px-3 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 rounded-xl text-[10px] font-black uppercase text-center cursor-pointer transition-colors border border-indigo-200/20"
                  >
                    EDIT STATE
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase text-center cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
                  >
                    <Save size={11} />
                    <span>SAVE MAPPING</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: COPY-PASTE BULK INTERCEPTOR */}
          {activeUtilityTab === "batch" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold font-mono uppercase tracking-tight text-indigo-600 dark:text-indigo-400">
                  ⚡ BULK CAMERA CSV IMPORTER
                </h3>
                <p className="text-[10px] text-slate-450 font-normal leading-relaxed">
                  Have 500+ cameras? Paste them directly from Excel or in raw format! You can paste the entire table:
                  <br />
                  <code className="text-emerald-500 bg-slate-50 dark:bg-slate-950 px-1 py-0.5 rounded text-[9px] font-mono">
                    IP_ADDRESS, CAMERA_NAME, LOCATION_ROOM
                  </code> (or just copy-paste your Excel sheet!)
                </p>
              </div>

              <form onSubmit={handleBatchImport} className="space-y-3.5 text-xs font-bold">
                <textarea
                  rows={8}
                  value={batchText}
                  onChange={(e) => setBatchText(e.target.value)}
                  placeholder="e.g.&#10;192.168.1.155, Principal Desk Dome, Admin Office&#10;192.168.1.156, Playground West Pan, Outer Playfield&#10;192.168.1.157, Library Science Shelf, Main Library Block"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono text-slate-900 dark:text-emerald-400 focus:outline-none focus:border-[#F6AD55] placeholder-slate-400"
                />

                <div className="flex items-center justify-between border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-950">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Upload JSON or CSV</span>
                    <span className="text-[9px] text-slate-450 font-medium">Load list of IP addresses from a file</span>
                  </div>
                  <input 
                    type="file" 
                    accept=".json,.csv,.txt"
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] uppercase font-bold transition-colors"
                  >
                    Select File
                  </button>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-normal uppercase">Active Zone targeted:</span>
                  <span className="text-xs font-black text-[#F6AD55] uppercase">🎯 Cluster: {selectedZone}</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider text-center cursor-pointer shadow-md transition-all active:scale-95"
                >
                  🚀 IMPORT BATCH CAMERA MAPPINGS
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: NETWORK SUBNET IP BLOCK GENERATOR */}
          {activeUtilityTab === "subnet" && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold font-mono uppercase tracking-tight text-indigo-600 dark:text-indigo-400">
                  🌐 SUBNET IP RANGE GENERATOR
                </h3>
                <p className="text-[10px] text-slate-450 font-normal leading-relaxed">
                  Automatically generate a sequence of IP addresses within a subnet to map large NVR channels instantly!
                </p>
              </div>

              <form onSubmit={handleGenerateSubnet} className="space-y-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-450">Subnet Prefix:</label>
                    <input
                      type="text"
                      required
                      value={subnetPrefix}
                      onChange={(e) => setSubnetPrefix(e.target.value)}
                      placeholder="e.g. 192.168.1"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-wider text-slate-455">Range:</label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={255}
                        required
                        value={subnetStart}
                        onChange={(e) => setSubnetStart(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-1.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-center text-slate-900 dark:text-white"
                      />
                      <span className="text-slate-400 font-normal">-</span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        required
                        value={subnetEnd}
                        onChange={(e) => setSubnetEnd(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-full px-1.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-center text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-450">Label Template Name (Auto attaches host ID):</label>
                  <input
                    type="text"
                    required
                    value={subnetLabelPattern}
                    onChange={(e) => setSubnetLabelPattern(e.target.value)}
                    placeholder="e.g. Corridor Dome"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-wider text-slate-450">Room / Class Location Template:</label>
                  <input
                    type="text"
                    required
                    value={subnetRoomPattern}
                    onChange={(e) => setSubnetRoomPattern(e.target.value)}
                    placeholder="e.g. Classroom"
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-800 rounded-xl">
                  <span className="text-[10px] text-slate-400 block font-normal uppercase">Active Zone targeted:</span>
                  <span className="text-xs font-black text-[#F6AD55] uppercase">🎯 Cluster: {selectedZone}</span>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider text-center cursor-pointer shadow-md transition-all active:scale-95"
                >
                  ⚡ GENERATE SUBNET IP RANGE BLOCK
                </button>
              </form>
            </div>
          )}

        </div>

        {/* LIST TABLE: Registry matching currently selected opposition networkZone */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-5 shadow-sm space-y-4">
          
          <div className="border-b border-slate-150 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold font-mono uppercase tracking-tight text-[#F6AD55] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                LIVE {selectedZone.toUpperCase()} CAMERA REGISTRY
              </h2>
              <p className="text-[10px] text-slate-450 font-semibold uppercase">Currently registered camera channels inside cluster mapping</p>
            </div>
            
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-950 text-slate-400 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-800 whitespace-nowrap">
                {activeNetworkCams.length} Registered Cams
              </span>
            </div>
          </div>

          {/* Quick Filter & Search Bar - crucial for 500+ elements */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-850">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleLimit(40); // reset page limits on new filter typing triggers
                }}
                placeholder="Search by IP, Device Label or Class..."
                className="w-full pl-9 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-slate-950 dark:text-slate-150 focus:outline-none focus:border-indigo-650"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-450 hover:text-slate-850 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] font-black uppercase text-slate-450 mr-1 hidden md:inline">Filter Status:</span>
              <div className="flex p-0.5 bg-slate-200/80 dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-lg gap-1">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    statusFilter === "all"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("online")}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    statusFilter === "online"
                      ? "bg-green-650 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  Online
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("offline")}
                  className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded transition-all cursor-pointer ${
                    statusFilter === "offline"
                      ? "bg-red-650 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  Offline
                </button>
              </div>
            </div>
          </div>

          {/* BULK ACTIONS / MULTI-SELECT PANEL */}
          <div className="bg-slate-100/60 dark:bg-slate-950 p-4 rounded-xl border border-slate-205 dark:border-slate-850/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-2.5 w-full md:w-auto">
              <span className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 rounded-lg text-sm">⚙️</span>
              <div>
                <span className="font-extrabold text-slate-900 dark:text-slate-100 uppercase tracking-wide block">
                  Multi-Select Bulk Operations
                </span>
                <span className="text-[10px] text-slate-450 uppercase block font-semibold mt-0.5">
                  {selectedCameraIds.length} Camera(s) Selected / {activeNetworkCams.length} Total Registered in {selectedZone}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end flex-wrap">

              {selectedCameraIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedCameras}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-extrabold uppercase tracking-wider cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Trash2 size={12} />
                  <span>Delete Selected ({selectedCameraIds.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleClearAllNetworkCameras}
                className="px-4 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-450 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors border border-red-250/30 flex items-center gap-1.5"
              >
                <Trash2 size={12} />
                <span>Clear All Network (Clear All - {activeNetworkCams.length})</span>
              </button>
            </div>
          </div>

          {/* Table view */}
          <div className="overflow-auto max-h-[500px] rounded-xl border border-slate-200/60 dark:border-slate-800">
            <table className="w-full text-left text-xs font-bold border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase shadow-sm">
                  <th className="py-3 px-3 text-center w-12">
                    <input
                      type="checkbox"
                      title="Select All Visible"
                      checked={
                        searchedCams.length > 0 &&
                        searchedCams.slice(0, visibleLimit).every(cam => selectedCameraIds.includes(cam.id))
                      }
                      onChange={(e) => {
                        const visibleList = searchedCams.slice(0, visibleLimit);
                        if (e.target.checked) {
                          const visibleIds = visibleList.map(c => c.id);
                          setSelectedCameraIds(prev => Array.from(new Set([...prev, ...visibleIds])));
                        } else {
                          const visibleIds = visibleList.map(c => c.id);
                          setSelectedCameraIds(prev => prev.filter(id => !visibleIds.includes(id)));
                        }
                      }}
                      className="rounded border-slate-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-600 w-4 h-4 cursor-pointer accent-indigo-600"
                    />
                  </th>
                  <th className="py-3 px-3">S.No</th>
                  <th className="py-3 px-3">Room No</th>
                  <th className="py-3 px-3">Class Name</th>
                  <th className="py-3 px-3">Camera Type</th>
                  <th className="py-3 px-4">Camera Name</th>
                  <th className="py-3 px-3">IP Address</th>
                  <th className="py-3 px-3">DVR/NVR</th>
                  <th className="py-3 px-3">Live State</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(() => {
                  if (searchedCams.length === 0) {
                    return (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-400 font-semibold tracking-wide bg-white dark:bg-slate-900/40">
                          {activeNetworkCams.length === 0 
                            ? `Your CCTV Watchdog Database holds 0 camera mappings for ${selectedZone}. Make a single mapping or use Subnet Generator to populate!` 
                            : "No registered CCTV nodes match your active text/status filter parameters."}
                        </td>
                      </tr>
                    );
                  }

                  const paginatedList = searchedCams.slice(0, visibleLimit);

                  return (
                    <>
                      {paginatedList.map((cam) => {
                        const isSelectedForEdit = editingCameraId === cam.id;
                        const isChecked = selectedCameraIds.includes(cam.id);
                        return (
                          <tr 
                            key={cam.id} 
                            className={`transition-colors text-xs font-bold ${
                              isSelectedForEdit 
                                ? "bg-amber-500/10 hover:bg-amber-500/15" 
                                : isChecked
                                  ? "bg-indigo-500/5 hover:bg-indigo-500/10"
                                  : "hover:bg-slate-50/50 dark:hover:bg-slate-950/20"
                            }`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedCameraIds(prev => prev.filter(id => id !== cam.id));
                                  } else {
                                    setSelectedCameraIds(prev => [...prev, cam.id]);
                                  }
                                }}
                                className="rounded border-slate-300 dark:border-slate-800 text-indigo-650 focus:ring-indigo-600 w-4 h-4 cursor-pointer accent-indigo-600"
                              />
                            </td>
                            <td className="py-3 px-3 font-mono font-extrabold text-slate-400 text-center">{cam.sNo}</td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-semibold truncate max-w-28">{cam.roomNumber}</td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-semibold truncate max-w-28">{cam.classNameField}</td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-semibold">{cam.cameraType || "IP CAMERA"}</td>
                            <td className="py-3 px-4 text-slate-900 dark:text-white uppercase tracking-tight truncate max-w-44" title={cam.cameraName}>
                              {cam.cameraName}
                            </td>
                            <td className="py-3 px-3 font-mono select-all text-indigo-650 dark:text-indigo-400 font-black tracking-tight">{cam.ipAddress}</td>
                            <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-semibold">{cam.dvrNvr || "DVR"}</td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              {!isValidIpv4(cam.ipAddress) ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white bg-red-700 shadow-sm" title="Invalid IPv4 address - octet cannot exceed 255">
                                  INVALID IP ✘
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleToggleCameraStatus(cam.id)}
                                  className="group inline-flex items-center gap-1.5 focus:outline-none cursor-pointer transition-transform active:scale-95 text-left"
                                  title="Click to toggle status (ONLINE / OFFLINE) manually for testing"
                                >
                                  {cam.status === "online" ? (
                                    <div className="inline-flex items-center gap-1.5">
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white bg-green-600 dark:bg-green-500 shadow-sm group-hover:ring-2 group-hover:ring-green-400/50 transition-all">
                                        ONLINE ✔
                                      </span>
                                      {cam.latency !== undefined && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50/70 dark:bg-slate-800/80 text-indigo-650 dark:text-indigo-350 text-[9px] font-mono font-bold border border-indigo-100/40 dark:border-slate-750/80" title={`Ping response latency: ${cam.latency}ms`}>
                                          {cam.latency}ms
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider text-white bg-red-650 dark:bg-red-500 shadow-sm animate-pulse group-hover:ring-2 group-hover:ring-red-400/50 transition-all">
                                      OFFLINE ✘
                                    </span>
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  disabled={pingingCameraId === cam.id}
                                  onClick={() => handleSingleCameraPing(cam)}
                                  className={`p-1.5 rounded-lg transition-all border cursor-pointer ${
                                    pingingCameraId === cam.id
                                      ? "bg-indigo-100 text-indigo-700 border-indigo-300"
                                      : "bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-950 dark:hover:bg-slate-850 hover:text-indigo-600 text-indigo-500 border-indigo-200/50 dark:border-slate-800"
                                  }`}
                                  title="Test live ping response for this camera IP right now"
                                >
                                  <Activity size={11} className={pingingCameraId === cam.id ? "animate-spin" : ""} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditSelect(cam)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-850 hover:text-[#F6AD55] text-slate-500 rounded-lg transition-colors border border-slate-200/50 dark:border-slate-800 cursor-pointer"
                                  title="Sync to editor workspace"
                                >
                                  <Edit size={11} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCamera(cam.id)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 dark:bg-slate-950 dark:hover:bg-slate-850 hover:text-red-500 text-slate-400 rounded-lg transition-colors border border-slate-200/50 dark:border-slate-800 cursor-pointer"
                                  title="Purge camera"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {searchedCams.length > visibleLimit && (
                        <tr>
                          <td colSpan={7} className="py-3 text-center bg-slate-50 dark:bg-slate-950/40">
                            <div className="flex items-center justify-between px-4 text-slate-450 text-[10px]">
                              <span>Showing indices 1 - {visibleLimit} of {searchedCams.length} filtered items</span>
                              <button
                                type="button"
                                onClick={() => setVisibleLimit(prev => prev + 60)}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-[9px] uppercase cursor-pointer"
                              >
                                ＋ Show More (+60 Records)
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* 2. MONTHLY CCTV REGISTER & AUDIT REPORTS (Bottom panel exactly matching layout) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-805 rounded-2xl p-6 shadow-sm space-y-6">
        
        {/* Banner with heading */}
        <div className="border-b border-slate-150 dark:border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#F6AD55]/10 border border-[#F6AD55]/20 text-[#F6AD55] rounded-lg">
              <Calendar size={18} />
            </div>
            <h2 className="text-md font-black font-mono uppercase tracking-widest text-[#F6AD55]">
              MONTHLY CCTV REGISTER & AUDIT REPORTS
            </h2>
          </div>

          {/* Independent option select switcher */}
          <div className="flex flex-wrap items-center gap-1 bg-transparent border-b-2 border-slate-200 dark:border-slate-800 text-xs font-semibold w-full md:w-auto">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider px-2 block shrink-0 font-medium">Report Target:</span>
            {cameraGroups.map(group => (
              <button
                key={group}
                type="button"
                onClick={() => setReportZone(group)}
                className={`px-4 py-2 text-[10px] font-bold uppercase transition-all tracking-wider text-center cursor-pointer whitespace-nowrap border-b-2 -mb-[2px] ${
                  reportZone === group 
                    ? "text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-500" 
                    : "text-slate-500 border-transparent hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter Calenders and Download links rows */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50 dark:bg-slate-950/80 p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
          
          {/* Filter Mode Option Buttons */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-[10px] font-black uppercase text-slate-450 tracking-wider block">REPORT SCHEME:</label>
            <div className="flex bg-slate-200/50 dark:bg-slate-900 p-1 rounded-xl border border-slate-250 dark:border-slate-800 gap-1">
              <button
                type="button"
                onClick={() => setFilterMode("range")}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider text-center cursor-pointer ${
                  filterMode === "range" 
                    ? "bg-[#F6AD55] text-slate-950 shadow-sm scale-102" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                📅 Date Range
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("single")}
                className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all tracking-wider text-center cursor-pointer ${
                  filterMode === "single" 
                    ? "bg-[#F6AD55] text-slate-950 shadow-sm scale-102" 
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                }`}
              >
                📆 Single Day
              </button>
            </div>
          </div>

          {/* Calender Selection Block */}
          <div className="md:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filterMode === "range" ? (
              <>
                <div className="space-y-1.5 text-xs font-bold text-slate-500">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider block">FROM AUDIT DATE:</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>

                <div className="space-y-1.5 text-xs font-bold text-slate-500">
                  <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider block">TO END DATE:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                  />
                </div>
              </>
            ) : (
              <div className="col-span-2 space-y-1.5 text-xs font-bold text-slate-500">
                <label className="text-[10px] font-extrabold uppercase text-slate-450 tracking-wider block">CHOOSE SPECIFIC DAY FOR ATTENDANCE:</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#F6AD55]"
                />
              </div>
            )}
          </div>

          {/* Action Trigger Button for Query report */}
          <div className="md:col-span-3">
            <button
              onClick={handleRunQuery}
              className="w-full py-3 px-6 bg-[#F6AD55] hover:bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95 text-center cursor-pointer"
            >
              RUN REPORT INQUIRY
            </button>
          </div>

        </div>

        {/* Action Header Exporters for Reports selection - View Excel vs View PDF */}
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-100 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-150 dark:border-slate-800/80 gap-4">
          <div className="text-xs">
            <p className="font-extrabold text-slate-850 dark:text-slate-300">
              Query Result: <span className="text-indigo-600 dark:text-indigo-400 font-mono text-sm font-black">{filteredLogs.length}</span> Snapcheck records found
            </p>
            <p className="text-[10px] text-slate-450">Filter scope applies for {reportZone} between {fromDate || "N/A"} to {endDate || "N/A"}</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => downloadCsv(filteredLogs, `BI_CCTV_Logs_${reportZone.replace(" ", "_")}`)}
              className="flex-1 sm:flex-initial py-2 px-4 bg-white dark:bg-slate-900 hover:bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 rounded-xl border border-slate-205 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet size={12} className="text-emerald-500" />
              <span>VIEW EXCL REPORT (Download)</span>
            </button>
            <button
              onClick={() => {
                // Printable formatting of filtered historical logs
                const printWindow = window.open("", "_blank");
                if(!printWindow) return;

                let contentHtml = "";

                if (filteredLogs.length === 0) {
                   contentHtml = '<p style="text-align: center;">No audit logs stored for this timing range.</p>';
                } else {
                   contentHtml += `
                     <table>
                       <thead>
                         <tr>
                           <th style="width: 5%;">S.No</th>
                           <th style="width: 15%;">ROOM NO</th>
                           <th style="width: 20%;">CLASS NAME</th>
                           <th style="width: 15%;">CAMERA NAME</th>
                           <th style="width: 20%;">IP ADDRESS</th>
                           <th style="width: 10%;">STATUS AUDIT</th>
                           <th style="width: 15%;">SNAPSHOT TIME</th>
                         </tr>
                       </thead>
                       <tbody>
                   `;

                   filteredLogs.forEach((log, index) => {
                      contentHtml += `
                        <tr style="border-bottom: 1px solid #ddd;">
                          <td style="padding: 8px;">${index+1}</td>
                          <td style="padding: 8px;">${log.roomNumber || ""}</td>
                          <td style="padding: 8px;">${log.classNameField || ""}</td>
                          <td style="padding: 8px;">${log.cameraName}</td>
                          <td style="padding: 8px; font-family: monospace;">${log.ipAddress}</td>
                          <td style="padding: 8px; font-weight: bold; color: ${log.status === "online" ? "green" : "red"};">
                            ${log.status.toUpperCase()}
                          </td>
                          <td style="padding: 8px; font-family: monospace;">${log.time || ""}</td>
                        </tr>
                      `;
                   });

                   contentHtml += `
                       </tbody>
                     </table>
                   `;
                }

                printWindow.document.write(`
                  <html>
                    <head>
                      <title>BI Monthly CCTV Register Report</title>
                      <style>
                        @page { size: portrait; margin: 15mm; }
                        body { font-family: Arial, sans-serif; margin: 0; color: #000; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                        th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; }
                        th { background-color: #f0f0f0; font-weight: bold; }
                        .header-box { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                      </style>
                    </head>
                    <body>
                      <div class="header-box">
                        <h2>BI CCTV Attendance Log & Audit Register</h2>
                        <p style="margin: 3px 0;"><strong>Network Cluster:</strong> ${reportZone}</p>
                        <p style="margin: 3px 0;"><strong>Query Period:</strong> ${fromDate} to ${endDate}</p>
                      </div>
                      ${contentHtml}
                    </body>
                  </html>
                `);
                printWindow.print();
                printWindow.close();
              }}
              className="flex-1 sm:flex-initial py-2 px-4 bg-white dark:bg-slate-900 hover:bg-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 rounded-xl border border-slate-205 dark:border-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText size={12} className="text-red-500" />
              <span>VIEW PDF REPORT (Print)</span>
            </button>
          </div>
        </div>

        {/* Dynamic visual representations of the log check table */}
        <div className="overflow-auto max-h-[500px] rounded-xl border border-slate-200 dark:border-slate-805">
          <table className="w-full text-left font-bold text-xs border-collapse relative">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-400 font-semibold tracking-wide">
                    No snap-logs captured for {reportZone} within this range. Run "IP TRIGGER PING" above first to log fresh records!
                  </td>
                </tr>
              ) : (
                <React.Fragment>
                  {/* Column Headers */}
                  <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                    <th className="py-3 px-4">S.No</th>
                    <th className="py-3 px-3">DATE / DAY</th>
                    <th className="py-3 px-4">ROOM NO</th>
                    <th className="py-3 px-4">CLASS NAME</th>
                    <th className="py-3 px-3">CAM TYPE</th>
                    <th className="py-3 px-3">DEVICE NAME</th>
                    <th className="py-3 px-3">IP ADDRESS</th>
                    <th className="py-3 px-3">DVR/NVR</th>
                    <th className="py-3 px-3 border-l ml-2 border-slate-200 dark:border-slate-800">AUDIT STATUS</th>
                    <th className="py-3 px-4">TIME SNAP</th>
                  </tr>
                  {/* Logs */}
                  {filteredLogs.map((log, index) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors text-xs font-bold">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-400">{index + 1}</td>
                      <td className="py-3.5 px-3 mb-0 text-slate-800 dark:text-slate-200 select-all font-mono tracking-tight">{log.date}</td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-black tracking-tight">{log.roomNumber}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-medium tracking-tight truncate">{log.classNameField || ""}</td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 uppercase text-[10px]">{log.cameraType || "IP CAMERA"}</td>
                      <td className="py-3.5 px-3 text-slate-800 dark:text-slate-200 font-semibold truncate max-w-36">{log.cameraName}</td>
                      <td className="py-3.5 px-3 font-mono font-black text-indigo-500 truncate select-all">{log.ipAddress}</td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 uppercase text-[10px]">{log.dvrNvr || "DVR"}</td>
                      <td className="py-3.5 px-3 border-l border-slate-100 dark:border-slate-800">
                        {log.status === "online" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase">online ✔</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 text-[10px] font-black uppercase">offline ✘</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] truncate">{log.time}</td>
                    </tr>
                  ))}
                </React.Fragment>
              )}
            </tbody>
          </table>
        </div>

        {/* Day-Wise Aggregated Summary Statistics */}
        <div id="day-wise-summary-ledger" className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
            <h3 className="text-xs font-black font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200">
              BI DAY-WISE SYSTEM ATTENDANCE SUMMARY LEDGER
            </h3>
          </div>
          
          <div className="overflow-auto max-h-[500px] rounded-xl border border-slate-200 dark:border-slate-805">
            <table className="w-full text-left font-bold text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold shadow-sm">
                  <th className="py-2.5 px-4 font-black">S.No</th>
                  <th className="py-2.5 px-3">Date (Day Stamp)</th>
                  <th className="py-2.5 px-3 text-center">Total Devices Checked</th>
                  <th className="py-2.5 px-3 text-center text-emerald-500 font-bold">Online OK</th>
                  <th className="py-2.5 px-3 text-center text-red-500 font-bold">Offline Error</th>
                  <th className="py-2.5 px-4 text-center">Stability Ratio</th>
                  <th className="py-2.5 px-4 text-right">Daily Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {getDayWiseSummary().length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 font-semibold text-xs text-slate-400">
                      No logs mapped for this report networkZone yet. Run "IP TRIGGER PING" above to log records!
                    </td>
                  </tr>
                ) : (
                  getDayWiseSummary().map((day, dIdx) => {
                    return (
                      <tr key={day.dateString} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/10 transition-colors text-xs font-bold">
                        <td className="py-3 px-4 font-mono font-medium text-slate-400">{dIdx + 1}</td>
                        <td className="py-3 px-3 text-slate-800 dark:text-slate-100 select-all font-mono tracking-tight">{day.dateString}</td>
                        <td className="py-3 px-3 font-semibold text-center text-slate-500 dark:text-slate-400">{day.total} checked</td>
                        <td className="py-3 px-3 text-emerald-600 dark:text-emerald-450 text-center font-mono">{day.online} units</td>
                        <td className="py-3 px-3 text-red-600 dark:text-red-450 text-center font-mono">{day.offline} units</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden shrink-0">
                              <div 
                                className={`h-full rounded-full ${
                                  day.rate >= 90 ? "bg-emerald-500" : day.rate >= 70 ? "bg-amber-500" : "bg-red-500"
                                }`}
                                style={{ width: `${day.rate}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px] font-black w-8 text-right select-none">{day.rate}%</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => downloadCsv(day.rawLogs, `BI_CCTV_Daily_${day.dateString.replace(/\//g, "-")}`)}
                              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[9px] hover:bg-slate-100 font-black tracking-wider text-slate-650 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Export Day report to spreadsheet"
                            >
                              <FileSpreadsheet size={10} className="text-emerald-500" />
                              <span>CSV</span>
                            </button>
                            <button
                              onClick={() => handlePrintDayReport(day.dateString, day.rawLogs)}
                              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-[9px] hover:bg-slate-100 font-black tracking-wider text-slate-650 dark:text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                              title="Print Day report as PDF"
                            >
                              <FileText size={10} className="text-red-500" />
                              <span>PDF</span>
                            </button>
                          </div>
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

    </div>
  );
}
