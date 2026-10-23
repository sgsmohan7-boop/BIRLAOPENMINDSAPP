import React, { useState, useEffect } from "react";
import { Settings, ShieldAlert, User, CheckCircle2, RefreshCw, Server, Wifi, WifiOff, Users, Plus, Trash2, Lock, Database, ArrowRightLeft, HardDrive, Cloud, Sliders, ShieldCheck, Edit3, Key, Eye, EyeOff, CheckSquare, Square, X, Check, Layers, Sparkles, Link2, Copy, ExternalLink, Share2 } from "lucide-react";
import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, ITStaffAccount, ArchivedITStaffAccount } from "../types";
import { loadITStaffAccounts, saveITStaffAccounts, mergeWithDefaultITStaffAccounts, loadArchivedITStaffAccounts, saveArchivedITStaffAccounts, recordDeletedITStaffAccountId, unrecordDeletedITStaffAccountId } from "../utils/storage";
import { db, saveDocument, deleteDocument, isFirebaseConfigured } from "../utils/firebase";
import { doc, getDocFromServer } from "firebase/firestore";
import { 
  checkBackupStatus, 
  syncAllToMongoBackup, 
  fetchFromMongoBackup 
} from "../utils/backupClient";

const SIDEBAR_FEATURES_CATALOG = [
  { id: "dashboard", label: "Dashboard", icon: "📊", desc: "Central Ticket Ledger & Resolution Desk", group: "Core IT Operations" },
  { id: "portal-links", label: "Staff Portal Links", icon: "🔗", desc: "Shareable Portal Links & QR Codes", group: "Portals & Access" },
  { id: "counselling-dept", label: "Counselling Dept", icon: "🎓", desc: "Parent Admissions & Enquiry Desk", group: "Department Desks" },
  { id: "management-desk", label: "Executive Management", icon: "🏆", desc: "Director & Management Portal", group: "Department Desks" },
  { id: "google-drive", label: "Google Drive (5 TB)", icon: "💾", desc: "5 TB Audio Recording Vault", group: "Cloud Storage" },
  { id: "cloudflare-r2", label: "Cloudflare R2 Storage", icon: "☁️", desc: "10 GB Cloudflare R2 Storage", group: "Cloud Storage" },
  { id: "raise-ticket", label: "Raise Ticket", icon: "➕", desc: "New Helpdesk Ticket Entry", group: "Core IT Operations" },
  { id: "inventory", label: "Inventory", icon: "📦", desc: "Hardware & Consumables Stock", group: "Asset Management" },
  { id: "emp-assets", label: "Emp Assets", icon: "👥", desc: "Employee Asset Allocations", group: "Asset Management" },
  { id: "room-master", label: "Room Master", icon: "🏫", desc: "Classroom Hardware Infrastructure", group: "Asset Management" },
  { id: "analytics", label: "Analytics", icon: "📈", desc: "SLA Resolution & Performance Reports", group: "Core IT Operations" },
  { id: "warranty-tracker", label: "Warranty & AMC", icon: "🛡️", desc: "Vendor Warranty & AMC Ledger", group: "Asset Management" },
  { id: "network-speed", label: "Network Speed", icon: "⚡", desc: "Network Bandwidth Diagnostics", group: "Diagnostics & CCTV" },
  { id: "cctv-watchdog", label: "CCTV Watchdog Hub", icon: "📹", desc: "CCTV Cameras & NVR Storage", group: "Diagnostics & CCTV" },
  { id: "transport-dashboard", label: "GPS Transport", icon: "🚚", desc: "Bus Tracking & Driver Routes", group: "Portals & Access" },
  { id: "settings", label: "Settings", icon: "⚙️", desc: "System Configuration & Backups", group: "System Administration" }
];

interface IAMUser {
  id: string;
  email: string;
  role: string;
  status: 'ACTIVE' | 'SUSPENDED';
  addedAt: string;
}

interface SettingsProps {
  userEmail: string;
  userRole: string;
  onWipeDatabase: () => void;
  onRestoreDatabaseMock: () => void;
  // MongoDB redundancy props
  tickets: Ticket[];
  history: Ticket[];
  inventory: InventoryItem[];
  rooms: Room[];
  allocations: EmployeeAllocation[];
  warranty: WarrantyContract[];
  onImportFromBackup: (data: {
    tickets: Ticket[];
    history: Ticket[];
    inventory: InventoryItem[];
    rooms: Room[];
    allocations: EmployeeAllocation[];
    warranty: WarrantyContract[];
  }) => void;
}

export default function SettingsView({ 
  userEmail, 
  userRole, 
  onWipeDatabase, 
  onRestoreDatabaseMock,
  tickets,
  history,
  inventory,
  rooms,
  allocations,
  warranty,
  onImportFromBackup
}: SettingsProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  const formatSyncTime = (key: string) => {
    const timestamp = localStorage.getItem(`sgs_last_sync_${key}`);
    if (!timestamp) return "Realtime Listener";
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString() + " " + date.toLocaleDateString();
    } catch {
      return "Connected";
    }
  };

  // Custom dialog states to replace blocked browser iframe alert/confirm prompts
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalType, setModalType] = useState<"wipe" | "restore_seeds" | "restore_mongo" | "alert_length" | "alert_mismatch" | "">("");

  // MongoDB Backup states
  const [mongoConnected, setMongoConnected] = useState<boolean>(false);
  const [mongoMessage, setMongoMessage] = useState<string>("Connecting to remote bridge...");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [mongoCounts, setMongoCounts] = useState<Record<string, number>>({});

  // Access Control states
  const [isRestricted, setIsRestricted] = useState<boolean>(false);
  const [iamUsers, setIamUsers] = useState<IAMUser[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState("IT Admin");
  const [isAccessLoading, setIsAccessLoading] = useState(false);

  // Technician Master States
  const [technicians, setTechnicians] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sgs_technicians");
      return saved ? JSON.parse(saved) : ["Mohan"];
    } catch {
      return ["Mohan"];
    }
  });
  const [newTechName, setNewTechName] = useState("");

  const handleAddTech = () => {
    const name = newTechName.trim();
    if (name && !technicians.includes(name)) {
      const updated = [...technicians, name];
      setTechnicians(updated);
      localStorage.setItem("sgs_technicians", JSON.stringify(updated));
      setNewTechName("");
    }
  };

  const handleRemoveTech = (t: string) => {
    let updated = technicians.filter(tech => tech !== t);
    if (updated.length === 0) updated = ["Mohan"];
    setTechnicians(updated);
    localStorage.setItem("sgs_technicians", JSON.stringify(updated));
  };

  // IT Staff Accounts & Custom Sidebar Feature Access Control state
  const [itStaffAccounts, setItStaffAccounts] = useState<ITStaffAccount[]>(() => loadITStaffAccounts());
  const [showAddITModal, setShowAddITModal] = useState(false);
  const [newITName, setNewITName] = useState("");
  const [newITUsername, setNewITUsername] = useState("");
  const [newITEmail, setNewITEmail] = useState("");
  const [newITPassword, setNewITPassword] = useState("Password@123");
  const [showNewITPass, setShowNewITPass] = useState(false);
  const [newITRoleTitle, setNewITRoleTitle] = useState("IT Support Specialist");
  const [newITAllowedFeatures, setNewITAllowedFeatures] = useState<string[]>([
    "dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"
  ]);

  // Edit IT Person permissions modal state
  const [editingITStaff, setEditingITStaff] = useState<ITStaffAccount | null>(null);
  const [editAllowedFeatures, setEditAllowedFeatures] = useState<string[]>([]);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPass, setShowEditPass] = useState(false);

  // Permanent Direct IT Portal URL Generator
  const [copiedITLinkId, setCopiedITLinkId] = useState<string | null>(null);
  const [createdITLink, setCreatedITLink] = useState<{ name: string; username: string; url: string } | null>(null);

  // Archived IT Personnel state & Work Audit Log
  const [archivedITAccounts, setArchivedITAccounts] = useState<ArchivedITStaffAccount[]>(() => loadArchivedITStaffAccounts());
  const [selectedArchivedIT, setSelectedArchivedIT] = useState<ArchivedITStaffAccount | null>(null);
  const [deletingITAccount, setDeletingITAccount] = useState<ITStaffAccount | null>(null);

  const getITPortalUrl = (username: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    let publicUrl = origin;
    if (origin.includes("-dev-")) {
      publicUrl = origin.replace("-dev-", "-pre-");
    }
    return `${publicUrl}?portal=it&user=${encodeURIComponent(username)}`;
  };

  // Sync state to server, local storage & Firestore
  const syncITStaffAccounts = (updated: ITStaffAccount[]) => {
    setItStaffAccounts(updated);
    saveITStaffAccounts(updated);
    if (isFirebaseConfigured()) {
      updated.forEach(acc => {
        if (acc && acc.id) {
          saveDocument("it_staff_accounts", acc.id, acc);
        }
      });
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
    }
  };

  useEffect(() => {
    const handleStorageChange = () => {
      setItStaffAccounts(loadITStaffAccounts());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorageChange);
    }
    const interval = setInterval(() => {
      setItStaffAccounts(loadITStaffAccounts());
    }, 3000);
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorageChange);
      }
      clearInterval(interval);
    };
  }, []);

  const handleToggleFeatureNew = (featureId: string) => {
    setNewITAllowedFeatures(prev => 
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const handleSelectAllNew = () => {
    setNewITAllowedFeatures(SIDEBAR_FEATURES_CATALOG.map(f => f.id));
  };

  const handleDeselectAllNew = () => {
    setNewITAllowedFeatures(["dashboard"]);
  };

  const handleCreateITStaff = () => {
    const nameClean = newITName.trim();
    const unameClean = newITUsername.trim().toLowerCase().replace(/\s+/g, "");
    const emailClean = newITEmail.trim().toLowerCase();
    const passClean = newITPassword.trim();

    if (!nameClean || !unameClean || !emailClean || !passClean) {
      alert("Please enter Name, Username, Email, and Password!");
      return;
    }

    if (itStaffAccounts.some(s => s.username.toLowerCase() === unameClean || s.email.toLowerCase() === emailClean)) {
      alert(`An IT Staff account with username "${unameClean}" or email "${emailClean}" already exists!`);
      return;
    }

    const existingMaxNum = itStaffAccounts.reduce((max, a) => {
      const match = (a.id || "").match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 0;
      return Math.max(max, num);
    }, 0);
    const nextNum = String(existingMaxNum + 1).padStart(2, "0");

    const newAccount: ITStaffAccount = {
      id: `IT-STAFF-${nextNum}`,
      name: nameClean,
      username: unameClean,
      email: emailClean,
      password: passClean,
      roleTitle: newITRoleTitle.trim() || "IT Support Specialist",
      allowedFeatures: newITAllowedFeatures.length > 0 ? newITAllowedFeatures : ["dashboard"],
      status: "active",
      createdAt: new Date().toLocaleDateString("en-GB")
    };

    // Un-delete this username and ID from deleted tracking so fresh creation is never blocked
    unrecordDeletedITStaffAccountId(newAccount.id, unameClean);
    if (isFirebaseConfigured()) {
      deleteDocument("deleted_it_staff_accounts", newAccount.id.toLowerCase());
      if (unameClean) deleteDocument("deleted_it_staff_accounts", unameClean);
    }

    const updated = [newAccount, ...itStaffAccounts];
    syncITStaffAccounts(updated);

    fetch("/api/accounts/it-staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAccount)
    }).catch(() => {});

    setNewITName("");
    setNewITUsername("");
    setNewITEmail("");
    setNewITPassword("Password@123");
    setNewITRoleTitle("IT Support Specialist");
    setNewITAllowedFeatures(["dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"]);
    setShowAddITModal(false);
    setCreatedITLink({
      name: nameClean,
      username: unameClean,
      url: getITPortalUrl(unameClean)
    });
    setInfoMessage(`🎉 IT Person account created for "${nameClean}" with permanent portal link generated!`);
    setTimeout(() => setInfoMessage(""), 5000);
  };

  const handleStartEditIT = (acc: ITStaffAccount) => {
    setEditingITStaff(acc);
    setEditAllowedFeatures([...(acc.allowedFeatures || [])]);
    setEditPassword(acc.password || "");
  };

  const handleToggleFeatureEdit = (featureId: string) => {
    setEditAllowedFeatures(prev => 
      prev.includes(featureId) ? prev.filter(f => f !== featureId) : [...prev, featureId]
    );
  };

  const handleSelectAllEdit = () => {
    setEditAllowedFeatures(SIDEBAR_FEATURES_CATALOG.map(f => f.id));
  };

  const handleDeselectAllEdit = () => {
    setEditAllowedFeatures(["dashboard"]);
  };

  const handleSaveEditIT = () => {
    if (!editingITStaff) return;
    const updated = itStaffAccounts.map(acc => {
      if (acc.id === editingITStaff.id) {
        return {
          ...acc,
          allowedFeatures: editAllowedFeatures.length > 0 ? editAllowedFeatures : ["dashboard"],
          password: editPassword || acc.password
        };
      }
      return acc;
    });

    syncITStaffAccounts(updated);

    const target = updated.find(a => a.id === editingITStaff.id);
    if (target) {
      fetch("/api/accounts/it-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target)
      }).catch(() => {});
    }

    setEditingITStaff(null);
    setInfoMessage(`🎉 Updated sidebar access permissions for "${editingITStaff.name}"!`);
    setTimeout(() => setInfoMessage(""), 4000);
  };

  const handleToggleITStatus = (id: string) => {
    const updated = itStaffAccounts.map(acc => {
      if (acc.id === id) {
        const nextStatus = (acc.status === "active" ? "inactive" : "active") as "active" | "inactive";
        const updatedAcc = { ...acc, status: nextStatus };
        fetch("/api/accounts/it-staff", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedAcc)
        }).catch(() => {});
        return updatedAcc;
      }
      return acc;
    });
    syncITStaffAccounts(updated);
  };

  const handleDeleteITStaff = (id: string) => {
    const target = itStaffAccounts.find(a => a.id === id);
    if (!target) return;

    if (window.confirm(`Are you sure you want to delete IT Account "${target.name}" (@${target.username})?\n\nAll tickets, updates, and work history handled by them will remain 100% saved in Super Admin Master Ledger & Archived Audit Log!`)) {
      const targetId = target.id;
      const targetNameLower = target.name.toLowerCase();
      const targetUnameLower = target.username.toLowerCase();
      
      const matchedTickets = [...(tickets || []), ...(history || [])].filter(t => 
        (t.staffName || "").toLowerCase().includes(targetNameLower) ||
        (t.remarks || "").toLowerCase().includes(targetNameLower) ||
        (t.remarks || "").toLowerCase().includes(targetUnameLower) ||
        (t.issue || "").toLowerCase().includes(targetNameLower)
      );

      const archivedRecord: ArchivedITStaffAccount = {
        ...target,
        deletedAt: new Date().toLocaleDateString("en-GB") + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        deletedBy: userEmail || "Super Admin",
        workSummary: {
          ticketsHandledCount: matchedTickets.length,
          ticketsList: matchedTickets.map(t => `${t.id}: ${t.actualIssue || t.issue} [${t.status.toUpperCase()}]`),
          lastActiveDate: target.createdAt
        }
      };

      const updatedArchived = [archivedRecord, ...archivedITAccounts];
      setArchivedITAccounts(updatedArchived);
      saveArchivedITStaffAccounts(updatedArchived);

      // Record deleted ID permanently so default accounts never restore it on refresh
      recordDeletedITStaffAccountId(targetId, target.username);

      if (isFirebaseConfigured()) {
        deleteDocument("it_staff_accounts", targetId);
        saveDocument("deleted_it_staff_accounts", targetId.toLowerCase(), {
          id: targetId.toLowerCase(),
          username: target.username.toLowerCase(),
          deletedAt: Date.now()
        });
      }

      // Remove credential account from active IT accounts
      const updated = itStaffAccounts.filter(a => a.id !== targetId);
      syncITStaffAccounts(updated);

      fetch(`/api/accounts/it-staff/${encodeURIComponent(targetId)}`, {
        method: "DELETE"
      }).catch(() => {});

      setInfoMessage(`✅ IT Account "${target.name}" deleted. All ${matchedTickets.length} tickets & work updates handled by them remain 100% saved in Super Admin Master Ledger!`);
      setTimeout(() => setInfoMessage(""), 5000);
      setDeletingITAccount(null);
    }
  };

  const handleDeleteArchivedITRecord = (archId: string, archName: string) => {
    if (window.confirm(`Are you sure you want to permanently remove "${archName}" from the archived IT personnel audit history log?`)) {
      const updated = archivedITAccounts.filter(a => a.id !== archId);
      setArchivedITAccounts(updated);
      saveArchivedITStaffAccounts(updated);
      setInfoMessage(`🗑️ Permanently removed "${archName}" record from Archived IT Audit History Log.`);
      setTimeout(() => setInfoMessage(""), 4000);
      if (selectedArchivedIT?.id === archId) {
        setSelectedArchivedIT(null);
      }
    }
  };

  const handleClearAllArchivedRecords = () => {
    if (window.confirm("Are you sure you want to completely clear all archived IT personnel audit records?")) {
      setArchivedITAccounts([]);
      saveArchivedITStaffAccounts([]);
      if (typeof window !== "undefined") {
        localStorage.removeItem("sgs_archived_it_staff_accounts");
      }
      setSelectedArchivedIT(null);
      setInfoMessage("🗑️ Cleared all archived IT personnel audit logs.");
      setTimeout(() => setInfoMessage(""), 4000);
    }
  };

  // Load MongoDB Status
  const loadMongoStatus = async () => {
    const status = await checkBackupStatus();
    setMongoConnected(status.connected);
    setMongoMessage(status.message);
    setMongoCounts(status.counts || {});
  };

  const loadAccessControl = async () => {
    if (!isFirebaseConfigured()) return;
    try {
      const metaDoc = await getDocFromServer(doc(db, "system_metadata", "access_control"));
      if (metaDoc.exists()) {
        const data = metaDoc.data();
        setIsRestricted(data.isRestricted || false);
        
        if (data.allowedUsers && Array.isArray(data.allowedUsers)) {
          setIamUsers(data.allowedUsers);
        } else if (data.allowedEmails && Array.isArray(data.allowedEmails)) {
          // Backward compatibility migration
          const migrated: IAMUser[] = data.allowedEmails.map((e: string, idx: number) => ({
            id: `legacy_${idx}`,
            email: e,
            role: e.toLowerCase().includes('super') ? "Super Admin" : "IT Admin",
            status: "ACTIVE",
            addedAt: new Date().toISOString()
          }));
          setIamUsers(migrated);
        }
      } else {
        // First time initialization
        if (userEmail) {
          const defaultUser: IAMUser = {
            id: crypto.randomUUID(),
            email: userEmail,
            role: "Super Admin",
            status: "ACTIVE",
            addedAt: new Date().toISOString()
          };
          await saveDocument("system_metadata", "access_control", { 
            isRestricted: false, 
            allowedUsers: [defaultUser] 
          });
          setIamUsers([defaultUser]);
        }
      }
    } catch (err) {
      // console.warn("Could not load IAM access list:", err);
    }
  };

  useEffect(() => {
    loadAccessControl();
    loadMongoStatus();

    let isMounted = true;
    fetch("/api/accounts/it-staff")
      .then(res => res.json())
      .then(data => {
        if (isMounted && data.success && Array.isArray(data.itStaff)) {
          const merged = mergeWithDefaultITStaffAccounts(data.itStaff, data.deletedItStaff || []);
          setItStaffAccounts(merged);
          saveITStaffAccounts(merged);
        }
      })
      .catch(() => {});
    
    // Periodically poll MongoDB connectivity health
    const interval = setInterval(() => {
      loadMongoStatus();
    }, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [userEmail]);

  const handleUpdateAccessRules = async (restrictedState: boolean, currentList: IAMUser[]) => {
    setIsAccessLoading(true);
    try {
      await saveDocument("system_metadata", "access_control", { 
        isRestricted: restrictedState, 
        allowedUsers: currentList 
      });
      setIsRestricted(restrictedState);
      setIamUsers(currentList);
      setInfoMessage(restrictedState ? "IAM Firewall is now LOCKED (Strict access)." : "IAM Firewall is OPEN (Anyone can provision).");
      setTimeout(() => setInfoMessage(""), 3000);
    } catch (err) {
      // console.error(err);
    } finally {
      setIsAccessLoading(false);
    }
  };

  const handleAddUser = () => {
    const cleanAdd = newUserEmail.trim().toLowerCase();
    if (cleanAdd && cleanAdd.includes("@") && !iamUsers.some(u => u.email === cleanAdd)) {
      const newUser: IAMUser = {
        id: crypto.randomUUID(),
        email: cleanAdd,
        role: newUserRole,
        status: 'ACTIVE',
        addedAt: new Date().toISOString()
      };
      const updatedList = [...iamUsers, newUser];
      handleUpdateAccessRules(isRestricted, updatedList);
      setNewUserEmail("");
      setNewUserRole("IT Admin");
    }
  };

  const handleRevokeUser = (idToRemove: string) => {
    const targetUser = iamUsers.find(u => u.id === idToRemove);
    if (targetUser && targetUser.email.toLowerCase() === userEmail.toLowerCase()) {
      alert("System Policy Error: You cannot revoke your own active admin session.");
      return;
    }
    const updatedList = iamUsers.filter(u => u.id !== idToRemove);
    handleUpdateAccessRules(isRestricted, updatedList);
  };

  const handleToggleUserStatus = (idToToggle: string) => {
    const targetUser = iamUsers.find(u => u.id === idToToggle);
    if (targetUser && targetUser.email.toLowerCase() === userEmail.toLowerCase()) {
      alert("System Policy Error: You cannot suspend your own active admin session.");
      return;
    }
    const updatedList: IAMUser[] = iamUsers.map(u => 
      u.id === idToToggle ? { ...u, status: (u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE') as 'ACTIVE' | 'SUSPENDED' } : u
    );
    handleUpdateAccessRules(isRestricted, updatedList);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4) {
      setModalType("alert_length");
      setShowConfirmModal(true);
      return;
    }
    if (password !== confirmPassword) {
      setModalType("alert_mismatch");
      setShowConfirmModal(true);
      return;
    }

    setInfoMessage("Updating your credentials... Please stand by.");
    setTimeout(() => {
      setInfoMessage("Success! Access Key updated in local database securely.");
      setPassword("");
      setConfirmPassword("");
    }, 1000);
  };

  // Trigger manual push of all collections to MongoDB Backup
  const handleManualBackupToMongo = async () => {
    setIsSyncing(true);
    setInfoMessage("Initiating full multi-collection backup synchronisation to MongoDB server...");
    
    const dataToSync = {
      tickets,
      history,
      inventory,
      rooms,
      allocations,
      warranty
    };

    const success = await syncAllToMongoBackup(dataToSync);
    setIsSyncing(false);
    
    if (success) {
      setInfoMessage("🎉 MongoDB Backup completed successfully! All helpdesk collections are fully mirrored.");
      await loadMongoStatus();
    } else {
      setInfoMessage("⚠️ Sync warning: Could not dual-write fully. Verify MONGODB_URI starts and connects successfully.");
    }
  };

  // Trigger manual pull of all collections from MongoDB Backup to restore state
  const handleRestoreFromMongo = async () => {
    setModalType("restore_mongo");
    setShowConfirmModal(true);
  };

  const executeRestoreFromMongo = async () => {
    setIsRestoring(true);
    setInfoMessage("Downloading and validating data batches from MongoDB backup server...");

    try {
      const activeTickets = await fetchFromMongoBackup<Ticket>("tickets");
      const activeHistory = await fetchFromMongoBackup<Ticket>("history");
      const activeInventory = await fetchFromMongoBackup<InventoryItem>("inventory");
      const activeRooms = await fetchFromMongoBackup<Room>("rooms");
      const activeAllocs = await fetchFromMongoBackup<EmployeeAllocation>("allocations");
      const activeWarranty = await fetchFromMongoBackup<WarrantyContract>("warranty");

      onImportFromBackup({
        tickets: activeTickets,
        history: activeHistory,
        inventory: activeInventory,
        rooms: activeRooms,
        allocations: activeAllocs,
        warranty: activeWarranty
      });

      setInfoMessage("🟢 Success! BI IT Helpdesk has been fully restored from your active MongoDB cluster records.");
    } catch (err) {
      // console.error(err);
      setInfoMessage("❌ Restore failed: Error reading records from offline backup.");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div id="settings-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Header bar */}
      <div className="flex pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">⚙️ SYSTEM BACKUP & ACCOUNT SECURITY</h2>
          <p className="text-xs text-slate-500 font-medium">Configure database backups, security levels, and administrator credentials</p>
        </div>
      </div>

      <div className="my-8 max-w-xl mx-auto w-full space-y-8">
        
        {/* MongoDB Dual Database Redundancy Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="text-indigo-600 size-6 animate-pulse" />
              <h3 className="text-md font-bold text-slate-900 font-sans uppercase">MongoDB Active Failover Backup</h3>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold ${mongoConnected ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"}`}>
              {mongoConnected ? (
                <>
                  <Wifi size={12} className="text-emerald-500" />
                  ONLINE BACKUP ACTIVE
                </>
              ) : (
                <>
                  <WifiOff size={12} className="text-rose-500" />
                  BACKUP STANDBY
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            BI IT Helpdesk relies on <span className="text-slate-900 font-bold">dual-write synchronization</span>. It handles automatic backups to MongoDB in the background. If the principal Firestore cloud platform goes offline, you can seamlessly retrieve and sync your state using MongoDB records.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 border-b border-slate-200 pb-2">
              <Server size={14} className="text-slate-500" />
              <span>MongoDB Node Status Ledger</span>
            </div>
            
            <p className="text-[11px] text-slate-600 font-mono leading-tight bg-slate-100 p-2.5 rounded border border-slate-200">
              {mongoMessage}
            </p>

            {mongoConnected && (
              <div className="pt-2 grid grid-cols-3 gap-2">
                <div className="bg-white p-2 border border-slate-150 rounded-lg text-center shadow-xs">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tickets</span>
                  <span className="text-lg font-black text-slate-800">{mongoCounts["tickets"] ?? 0}</span>
                </div>
                <div className="bg-white p-2 border border-slate-150 rounded-lg text-center shadow-xs">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inventory</span>
                  <span className="text-lg font-black text-slate-800">{mongoCounts["inventory"] ?? 0}</span>
                </div>
                <div className="bg-white p-2 border border-slate-150 rounded-lg text-center shadow-xs">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Allocations</span>
                  <span className="text-lg font-black text-slate-800">{mongoCounts["allocations"] ?? 0}</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleManualBackupToMongo}
              disabled={isSyncing}
              className="py-3 bg-gradient-to-r from-indigo-650 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold tracking-wider shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "SYNCING..." : "SYNC NOW TO MONGO"}
            </button>

            <button
              onClick={handleRestoreFromMongo}
              disabled={isRestoring || !mongoConnected}
              className="py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold tracking-wider shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ArrowRightLeft size={14} className={isRestoring ? "animate-pulse" : ""} />
              RESTORE FROM MONGO
            </button>
          </div>
        </div>

        {/* DATABASE STATUS LEDGER - ROOT SYSTEM ADMINISTRATOR EXCLUSIVE */}
        {userRole === "Super Admin" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
              <Database className="text-amber-500 size-6" />
              <div>
                <h3 className="text-md font-bold text-slate-900 font-sans uppercase tracking-tight">🔒 Live Database Connectivity & Ledger Status</h3>
                <p className="text-[11px] text-slate-400 font-medium">Administrator Console • Real-time Sync Status & Verification</p>
              </div>
            </div>

            {/* Core Database Engine Health Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Firestore Cloud Engine */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 tracking-wider">Cloud Firestore Engine</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold ${isFirebaseConfigured() ? "bg-emerald-50 text-emerald-700 border border-emerald-250" : "bg-dashed bg-rose-50 text-rose-700 border border-rose-200"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isFirebaseConfigured() ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                    {isFirebaseConfigured() ? "COSMIC ACTIVE" : "LOCAL COLD START"}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-normal">
                  Primary live cloud database storing 100% of tickets, inventory, rooms, allocations, and text records in real-time.
                </p>
              </div>

              {/* Google Drive 5 TB Vault */}
              <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-blue-900 tracking-wider flex items-center gap-1.5">
                    <HardDrive size={13} className="text-blue-600" />
                    Google Drive 5 TB Vault
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold bg-blue-100 text-blue-700 border border-blue-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    AUDIO VAULT
                  </span>
                </div>
                <p className="text-[10px] text-blue-600/80 font-medium leading-normal">
                  High-capacity cloud archive reserved exclusively for parent counselling voice audio recordings (.webm / .wav).
                </p>
              </div>
            </div>

            {/* Collection Document Counts Ledger Section */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Active System Collections</h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                      <th className="py-2.5 px-3">Collection Name</th>
                      <th className="py-2.5 px-3 text-center">Firestore Count</th>
                      <th className="py-2.5 px-3 text-right">Last Synchronized</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">🎫 tickets</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? tickets.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("tickets")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">📚 history</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? history.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("history")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">📦 inventory</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? inventory.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("inventory")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">🏫 rooms</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? rooms.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("rooms")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">👥 allocations</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? allocations.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("allocations")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold">🛡️ warranty</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900">{isFirebaseConfigured() ? warranty.length : "N/A (Local)"}</td>
                      <td className="py-2.5 px-3 text-right text-[10px] font-mono text-slate-400">{formatSyncTime("warranty")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Enterprise IAM System - Restricted to Super Admins */}
        {userRole === "Super Admin" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="text-indigo-600 size-6" />
              <h3 className="text-md font-bold text-slate-900 font-sans uppercase tracking-tight">Enterprise IAM (Identity & Access)</h3>
            </div>
            
            <button 
              onClick={() => handleUpdateAccessRules(!isRestricted, iamUsers)}
              disabled={isAccessLoading}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                isRestricted 
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200" 
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200"
              }`}
            >
              {isAccessLoading ? <RefreshCw size={12} className="animate-spin" /> : <Lock size={12} />}
              {isRestricted ? "IAM FIREWALL: STRICT MODE" : "IAM FIREWALL: OPEN PROVISIONING"}
            </button>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            Manage system access roles and provisioned corporate identities. In Strict Mode, users not listed here will be actively denied authentication.
          </p>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Corporate Email Identity</label>
                <input
                  type="email"
                  placeholder="E.g. staff@school.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="w-full sm:w-48">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Assigned Security Role</label>
                <select 
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Super Admin">System Administrator</option>
                  <option value="IT Admin">IT Support Coordinator</option>
                  <option value="Teacher">Instructional Staff</option>
                  <option value="Auditor">Compliance Auditor</option>
                </select>
              </div>
              <button
                onClick={handleAddUser}
                disabled={!newUserEmail.includes("@") || isAccessLoading}
                className="w-full sm:w-auto h-10 px-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus size={14} /> PROVISION
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-4">
              {iamUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium border-dashed border-2 border-slate-100 m-4 rounded-xl">
                  No identities provisioned. Add an identity credential to secure the network zone.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Identity / Email Address</th>
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">IAM Role</th>
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Auth Status</th>
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {iamUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                              {u.email.charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 tracking-tight">{u.email}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-600 bg-white shadow-sm">
                              {u.role === 'Super Admin' ? 'System Administrator' :
                               u.role === 'IT Admin' ? 'IT Support Coordinator' :
                               u.role === 'Teacher' ? 'Instructional Staff' :
                               u.role === 'Auditor' ? 'Compliance Auditor' : u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleUserStatus(u.id)}
                              disabled={isAccessLoading}
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded font-bold text-[10px] uppercase tracking-wider cursor-pointer transition-colors ${
                                u.status === 'ACTIVE' 
                                  ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                  : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? <CheckCircle2 size={12} /> : null}
                              {u.status}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRevokeUser(u.id)}
                              disabled={isAccessLoading}
                              className="px-2 py-1.5 text-rose-500 hover:text-white hover:bg-rose-500 border border-slate-100 hover:border-transparent bg-white rounded-md transition-all cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold uppercase shadow-sm"
                              title="Revoke access completely"
                            >
                              <Trash2 size={12} /> Revoke
                            </button>
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
        )}

        {/* Support Technicians Master - Restricted to Super Admins */}
        {userRole === "Super Admin" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <Users className="text-indigo-600 size-6" />
                <h3 className="text-md font-bold text-slate-900 font-sans uppercase tracking-tight">Support Technicians Master</h3>
              </div>
            </div>
            
            <p className="text-xs text-slate-500 leading-relaxed font-medium">
              Manage the list of allowed technicians who can resolve tickets. Technicians will be able to select their name (or have it mapped by email) when closing service jobs in the Dashboard.
            </p>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technician Display Name</label>
                  <input
                    type="text"
                    placeholder="E.g. Mohan Rao"
                    value={newTechName}
                    onChange={(e) => setNewTechName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTech();
                      }
                    }}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleAddTech}
                  className="w-full sm:w-auto h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> ADD TECHNICIAN
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">Technician Name</th>
                        <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {technicians.map((t: string) => (
                        <tr key={t} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs uppercase shadow-inner">
                              {t.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 tracking-tight">{t}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleRemoveTech(t)}
                              className="px-2 py-1.5 text-rose-500 hover:text-white hover:bg-rose-500 border border-slate-100 hover:border-transparent bg-white rounded-md transition-all cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold uppercase shadow-sm"
                            >
                              <Trash2 size={12} /> Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* IT Person Accounts & Custom Sidebar Feature Access Permission Control - Restricted to Super Admins */}
        {userRole === "Super Admin" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-150 rounded-xl text-indigo-600">
                  <Sliders size={22} />
                </div>
                <div>
                  <h3 className="text-md font-bold text-slate-900 font-sans uppercase tracking-tight flex items-center gap-2">
                    👨‍💻 IT Person Custom Feature Access Manager
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-indigo-100 text-indigo-700 border border-indigo-200">
                      NEW FEATURE
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Granular feature access control manager for assigning specific sidebar permissions to secondary IT personnel
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddITModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Plus size={15} />
                CREATE NEW IT PERSON ACCOUNT
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100">
              💡 <span className="font-bold text-indigo-950">How it works:</span> Create access for another IT person by selecting which sidebar features (Dashboard, Inventory, Room Master, Warranty, Analytics, etc.) they can access. When they log in, <span className="underline decoration-indigo-400 font-bold">only those selected features</span> will appear in their sidebar navigation!
            </p>



            {/* List of Created IT Staff Accounts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={14} className="text-indigo-600" />
                  Active IT Person Accounts ({itStaffAccounts.length})
                </h4>
              </div>

              {itStaffAccounts.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-medium border-dashed border-2 border-slate-200 rounded-xl">
                  No custom IT staff accounts created yet. Click "CREATE NEW IT PERSON ACCOUNT" above to grant restricted feature access to another IT person.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {itStaffAccounts.map((acc, idx) => {
                    const allowedCount = (acc.allowedFeatures || []).length;
                    const isInactive = acc.status === "inactive";
                    return (
                      <div 
                        key={acc.id ? `${acc.id}-${acc.username}` : `it-staff-${idx}`}
                        className={`p-5 rounded-xl border transition-all ${
                          isInactive 
                            ? "bg-slate-50 border-slate-200 opacity-60" 
                            : "bg-white border-slate-200 shadow-sm hover:border-indigo-300"
                        }`}
                      >
                        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-4 overflow-hidden">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                              {acc.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="text-sm font-bold text-slate-900 truncate">{acc.name}</h5>
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                                  @{acc.username}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${
                                  acc.status === "active"
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : "bg-rose-100 text-rose-700 border border-rose-200"
                                }`}>
                                  {acc.status === "active" ? "ACTIVE" : "INACTIVE"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate flex flex-wrap items-center gap-2">
                                <span>{acc.roleTitle} • <span className="text-slate-700 font-mono">{acc.email}</span></span>
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold shrink-0">
                                  🔑 Passcode: {acc.password || "Password@123"}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleStartEditIT(acc)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                            >
                              <Edit3 size={13} />
                              <span>Edit Access ({allowedCount})</span>
                            </button>

                            <button
                              onClick={() => handleToggleITStatus(acc.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border whitespace-nowrap ${
                                acc.status === "active"
                                  ? "bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
                                  : "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {acc.status === "active" ? "Suspend" : "Activate"}
                            </button>

                            <button
                              onClick={() => handleDeleteITStaff(acc.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-transparent rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                              title="Delete IT Staff Account and Archive Work History"
                            >
                              <Trash2 size={13} />
                              <span>Delete Account</span>
                            </button>
                          </div>
                        </div>

                        {/* Allowed Feature Badges Summary */}
                        <div className="pt-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex flex-wrap items-center justify-between gap-1">
                            <span>Sidebar Features Granted ({allowedCount} / {SIDEBAR_FEATURES_CATALOG.length}):</span>
                            <span className="text-indigo-600 font-semibold lowercase">click "Edit Access" to modify</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {SIDEBAR_FEATURES_CATALOG.map((f) => {
                              const isGranted = (acc.allowedFeatures || []).includes(f.id);
                              if (!isGranted) return null;
                              return (
                                <span 
                                  key={f.id}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200/80 shadow-2xs"
                                >
                                  <span>{f.icon}</span>
                                  <span>{f.label}</span>
                                </span>
                              );
                            })}
                          </div>
                        </div>

                        {/* Permanent Dedicated Direct Portal Link Box */}
                        <div className="mt-4 p-3 bg-slate-900 rounded-xl border border-slate-800 text-slate-200 text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-indigo-400 font-extrabold text-[11px] uppercase tracking-wider">
                              <Link2 size={13} />
                              <span>Permanent Portal Link for {acc.name}:</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              🔒 Isolated IT View
                            </span>
                          </div>

                          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-slate-950 p-2 rounded-lg border border-slate-800/80">
                            <input 
                              type="text" 
                              readOnly 
                              value={getITPortalUrl(acc.username)} 
                              className="bg-transparent text-indigo-300 font-mono text-[11px] w-full focus:outline-none select-all truncate"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(getITPortalUrl(acc.username));
                                  setCopiedITLinkId(acc.id);
                                  setTimeout(() => setCopiedITLinkId(null), 2500);
                                }}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-bold transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-xs whitespace-nowrap"
                              >
                                {copiedITLinkId === acc.id ? (
                                  <>
                                    <Check size={13} className="text-emerald-300" />
                                    <span>COPIED!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy size={13} />
                                    <span>COPY LINK</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => window.open(getITPortalUrl(acc.username), "_blank")}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer"
                                title="Open Direct IT Portal Link in New Tab"
                              >
                                <ExternalLink size={14} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-snug">
                            💡 Send this permanent link to <strong className="text-slate-200">{acc.name}</strong>. Opening this link automatically locks the login window to IT Person login and hides all other department portals!
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Archived IT Staff & Work Audit Trail (Super Admin Only) */}
              {archivedITAccounts.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-200 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Database size={15} className="text-purple-600" />
                        📜 Archived IT Personnel & Work History Audit ({archivedITAccounts.length})
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Deleted IT personnel credentials. All tickets, updates, and asset logs handled by them are <span className="font-bold text-purple-700 underline">permanently preserved</span> for Super Admin inspection.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearAllArchivedRecords}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-transparent rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                    >
                      <Trash2 size={13} />
                      <span>Clear All Archived Logs</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {archivedITAccounts.map((arch) => (
                      <div 
                        key={`arch-${arch.id}-${arch.deletedAt}`}
                        className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 flex flex-col xl:flex-row xl:items-center justify-between gap-3 overflow-hidden shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {arch.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h5 className="text-xs font-bold text-slate-500 line-through truncate">{arch.name}</h5>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-200 text-slate-600 shrink-0">
                                @{arch.username}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                DELETED & WORK ARCHIVED
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                              Deleted on: <span className="font-mono text-slate-700">{arch.deletedAt}</span> by <strong className="text-slate-700">{arch.deletedBy}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-200 whitespace-nowrap">
                            {arch.workSummary?.ticketsHandledCount || 0} Tickets Preserved
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedArchivedIT(arch)}
                            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                          >
                            <Eye size={13} />
                            <span>View Work Log</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteArchivedITRecord(arch.id, arch.name)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-transparent rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs whitespace-nowrap"
                            title="Permanently delete this archived audit record"
                          >
                            <Trash2 size={13} />
                            <span>Delete Record</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User security specifications & password edit view */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
          
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
            <div className="w-12 h-12 bg-[#cbd5e1] rounded-full flex items-center justify-center font-bold text-slate-700 text-lg uppercase">
              {userEmail.slice(0,2).toUpperCase()}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 leading-snug block">{userEmail}</span>
              <span className="text-xs font-semibold text-slate-400 capitalize flex items-center gap-1">
                <User size={12} /> {userRole} Profile
              </span>
            </div>
          </div>

          {infoMessage && (
            <div className="p-3 bg-blue-50 border-l-4 border-blue-500 text-xs text-blue-700 font-bold rounded flex items-center gap-1.5 animate-pulse">
              <CheckCircle2 size={15} />
              {infoMessage}
            </div>
          )}

          {/* Form changing access keys */}
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              Change Secret Access Key
            </h3>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">
                New Access Key
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#4A5568]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">
                Confirm Access Key
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#4A5568]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-[#4A5568] hover:bg-slate-700 text-white rounded-lg text-xs font-bold tracking-wider shadow transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              UPDATE SECURITY SETTING
            </button>
          </form>

          {/* Database utility tools */}
          <div className="pt-6 border-t border-slate-150 space-y-4">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">
              💿 SYSTEM DATABASE CONTROLS (WIPE / RESET)
            </h3>
            
            <p className="text-[11px] leading-relaxed text-slate-500 font-sans font-medium">
              Use the buttons below to easily clear the system database to a blank slate, or restore the preloaded demo school seeds for instant testing and presentation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  setModalType("wipe");
                  setShowConfirmModal(true);
                }}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[11px] font-bold tracking-wider shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans"
              >
                🚨 Wipe All App Data
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalType("restore_seeds");
                  setShowConfirmModal(true);
                }}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white rounded-xl text-[11px] font-bold tracking-wider shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer uppercase font-sans"
              >
                🔄 Restore Demo Seeds
              </button>
            </div>
          </div>

          {/* Environmental specifications */}
          <div className="pt-6 border-t border-slate-100 flex flex-col gap-2.5 text-xs text-slate-400 font-medium">
            <div className="flex justify-between">
              <span>Security Protocols Status:</span>
              <span className="text-emerald-600 font-bold">Standard RSA-256 Enabled</span>
            </div>
            <div className="flex justify-between">
              <span>LocalStorage Persistence:</span>
              <span className="text-emerald-600 font-bold">Ready & Synced</span>
            </div>
            <div className="flex justify-between">
              <span>Environment Node Sandbox:</span>
              <span className="text-slate-600 font-mono font-semibold">production-v6.0</span>
            </div>
          </div>

        </div>
      </div>

      {/* Custom React Dialog modal box to replace standard blocked iframe alerts/confirms */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 antialiased overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-2xl p-6 animate-in scale-in duration-200">
            <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3 uppercase font-sans">
              {modalType === "wipe" && "🚨 WIPE SYSTEM DATABASE"}
              {modalType === "restore_seeds" && "🔄 RESTORE DATABASE SEEDS"}
              {modalType === "restore_mongo" && "🔄 RESTORE FROM MONGODB"}
              {modalType === "alert_length" && "⚠️ Access Key Alert"}
              {modalType === "alert_mismatch" && "⚠️ Mismatched passwords"}
            </h3>

            <p className="mt-3 text-xs leading-relaxed text-slate-600 font-sans font-medium">
              {modalType === "wipe" && "⚠️ WARNING: This will permanently DELETE all active inventory records, room assets, service tickets, allocations and warranties both from local memory and connected cloud servers.\n\nDo you want to wipe all data now?"}
              {modalType === "restore_seeds" && "🔄 This will overwrite the current active blank state and restore the pre-populated school demo database seeds (including sample open/closed tickets and assets catalog).\n\nDo you want to proceed?"}
              {modalType === "restore_mongo" && "🔄 Are you sure you want to download and restore the entire BI IT Helpdesk directory from your active MongoDB cluster records? This will overwrite your current active window state!"}
              {modalType === "alert_length" && "The password access key must contain at least 4 characters to protect database interfaces."}
              {modalType === "alert_mismatch" && "The entered passwords do not match. Please verify and try again."}
            </p>

            <div className="mt-6 flex justify-end gap-2 text-xs font-bold font-sans">
              {(modalType === "alert_length" || modalType === "alert_mismatch") ? (
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors cursor-pointer"
                >
                  Okay, understood
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-250 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (modalType === "wipe") {
                        onWipeDatabase();
                      } else if (modalType === "restore_seeds") {
                        onRestoreDatabaseMock();
                      } else if (modalType === "restore_mongo") {
                        executeRestoreFromMongo();
                      }
                      setShowConfirmModal(false);
                    }}
                    className={`px-4 py-2.5 text-white rounded-lg transition-all cursor-pointer ${
                      modalType === "wipe"
                        ? "bg-red-600 hover:bg-red-700 shadow-sm"
                        : "bg-indigo-650 hover:bg-indigo-700"
                    }`}
                  >
                    {modalType === "wipe" ? "PERMANENTLY WIPE" : "YES, PROCEED"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW IT PERSON ACCOUNT MODAL */}
      {showAddITModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 antialiased overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl p-6 my-8 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans uppercase tracking-tight">
                    Create New IT Person Account & Select Allowed Features
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Configure individual staff login credentials and grant custom sidebar feature permissions
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddITModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-6 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Profile Details Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Ramesh Kumar"
                    value={newITName}
                    onChange={(e) => setNewITName(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Login Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. ramesh"
                    value={newITUsername}
                    onChange={(e) => setNewITUsername(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="E.g. ramesh.it@birla.edu.in"
                    value={newITEmail}
                    onChange={(e) => setNewITEmail(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Hardware & Network Support Specialist"
                    value={newITRoleTitle}
                    onChange={(e) => setNewITRoleTitle(e.target.value)}
                    className="w-full py-2.5 px-3 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider mb-1">
                    Login Password Passcode *
                  </label>
                  <div className="relative">
                    <input
                      type={showNewITPass ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={newITPassword}
                      onChange={(e) => setNewITPassword(e.target.value)}
                      className="w-full py-2.5 px-3 pr-10 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewITPass(!showNewITPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewITPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar Feature Checkboxes Selection */}
              <div className="border-t border-slate-200 pt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-150">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                      <Layers size={14} className="text-indigo-600" />
                      Sidebar Feature Permissions Checklist
                    </h4>
                    <p className="text-[11px] text-indigo-700 font-medium">
                      Check the features you want to allow. Unchecked features will be hidden from their sidebar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllNew}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      SELECT ALL ({SIDEBAR_FEATURES_CATALOG.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllNew}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      DESELECT ALL
                    </button>
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-600">
                  Selected Features: <span className="text-indigo-600 font-extrabold">{newITAllowedFeatures.length} / {SIDEBAR_FEATURES_CATALOG.length}</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SIDEBAR_FEATURES_CATALOG.map((f) => {
                    const isChecked = newITAllowedFeatures.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleToggleFeatureNew(f.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isChecked
                            ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-xs"
                            : "bg-slate-50 hover:bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <div className={`mt-0.5 p-1 rounded-md shrink-0 transition-colors ${
                          isChecked ? "bg-indigo-600 text-white" : "bg-white border border-slate-300 text-transparent"
                        }`}>
                          <Check size={13} strokeWidth={3} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{f.icon}</span>
                            <span className="text-xs font-bold">{f.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setShowAddITModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateITStaff}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                CREATE IT PERSON ACCOUNT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT IT PERSON PERMISSIONS MODAL */}
      {editingITStaff && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 antialiased overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-3xl shadow-2xl p-6 my-8 animate-in scale-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                  {editingITStaff.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">
                    Edit Allowed Sidebar Features: <span className="text-indigo-600">{editingITStaff.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium font-mono">
                    @{editingITStaff.username} • {editingITStaff.email}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setEditingITStaff(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5 max-h-[70vh] overflow-y-auto pr-1 custom-scrollbar">
              {/* Optional Password Reset */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                <label className="block text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                  Update Account Password (Optional)
                </label>
                <div className="relative max-w-md">
                  <input
                    type={showEditPass ? "text" : "password"}
                    placeholder="Enter new password to update"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full py-2 px-3 pr-10 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showEditPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Sidebar Feature Checkboxes Selection */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-150">
                  <div>
                    <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                      <Sliders size={14} className="text-indigo-600" />
                      Allowed Sidebar Features Permissions
                    </h4>
                    <p className="text-[11px] text-indigo-700 font-medium">
                      Select which sidebar features {editingITStaff.name} can see and open when logged in.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllEdit}
                      className="px-2.5 py-1 bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      SELECT ALL ({SIDEBAR_FEATURES_CATALOG.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllEdit}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                    >
                      DESELECT ALL
                    </button>
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-600">
                  Currently Granted: <span className="text-indigo-600 font-extrabold">{editAllowedFeatures.length} / {SIDEBAR_FEATURES_CATALOG.length} Features</span>
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SIDEBAR_FEATURES_CATALOG.map((f) => {
                    const isChecked = editAllowedFeatures.includes(f.id);
                    return (
                      <div
                        key={f.id}
                        onClick={() => handleToggleFeatureEdit(f.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-3 select-none ${
                          isChecked
                            ? "bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-xs"
                            : "bg-slate-50 hover:bg-white border-slate-200 text-slate-600"
                        }`}
                      >
                        <div className={`mt-0.5 p-1 rounded-md shrink-0 transition-colors ${
                          isChecked ? "bg-indigo-600 text-white" : "bg-white border border-slate-300 text-transparent"
                        }`}>
                          <Check size={13} strokeWidth={3} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{f.icon}</span>
                            <span className="text-xs font-bold">{f.label}</span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                            {f.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-4 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                onClick={() => setEditingITStaff(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditIT}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 size={16} />
                SAVE FEATURE PERMISSIONS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE IT STAFF ACCOUNT SAFEGUARD CONFIRMATION MODAL */}
      {deletingITAccount && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 antialiased">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-rose-100 space-y-5 animate-scaleUp">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Delete IT Account: {deletingITAccount.name}?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Revoke login credentials for <span className="font-mono font-bold text-slate-700">@{deletingITAccount.username}</span>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setDeletingITAccount(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* WORK PRESERVATION ASSURANCE BANNER */}
            <div className="p-4 bg-purple-50 border-l-4 border-purple-600 rounded-xl space-y-2 text-xs text-purple-950">
              <div className="flex items-center gap-2 font-bold text-purple-900">
                <ShieldCheck size={18} className="text-purple-600 shrink-0" />
                <span>🛡️ Work History Protection Safeguard</span>
              </div>
              <p className="text-[11px] text-purple-800 leading-relaxed">
                Deleting this account will <strong>permanently disable login credentials</strong> for {deletingITAccount.name}. However, <strong className="underline text-purple-950">ALL tickets, resolution remarks, hardware updates, and asset logs</strong> created or updated by {deletingITAccount.name} will remain <strong>100% STORED & PRESERVED</strong> in the Super Admin Master Ledger and Archived Audit Log!
              </p>
            </div>

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-medium">
              <p>👤 <strong>Staff Name:</strong> {deletingITAccount.name}</p>
              <p>📧 <strong>Email:</strong> {deletingITAccount.email}</p>
              <p>💼 <strong>Role:</strong> {deletingITAccount.roleTitle}</p>
              <p>🔑 <strong>Features Access Revoked:</strong> {deletingITAccount.allowedFeatures.length} sidebar features</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingITAccount(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel & Keep Account
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = deletingITAccount.id;
                  setDeletingITAccount(null);
                  handleDeleteITStaff(id);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Trash2 size={15} />
                CONFIRM DELETION & ARCHIVE WORK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVED IT PERSON WORK LOG DETAIL MODAL */}
      {selectedArchivedIT && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 antialiased">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
                  <Database size={22} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    Work Audit Log: {selectedArchivedIT.name}
                    <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 font-mono">
                      @{selectedArchivedIT.username}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Deleted on {selectedArchivedIT.deletedAt} by {selectedArchivedIT.deletedBy}
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setSelectedArchivedIT(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl text-xs text-indigo-900 leading-relaxed font-medium">
              💡 All tickets and activity entries created by <strong>{selectedArchivedIT.name}</strong> remain permanently stored in the main Super Admin database ledger.
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Preserved Tickets & Updates ({selectedArchivedIT.workSummary?.ticketsHandledCount || 0}):</span>
              </h4>

              {(!selectedArchivedIT.workSummary?.ticketsList || selectedArchivedIT.workSummary.ticketsList.length === 0) ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium border-dashed border-2 border-slate-200 rounded-xl">
                  No ticket resolution history recorded under this account name before deletion.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {selectedArchivedIT.workSummary.ticketsList.map((tItem, idx) => (
                    <div 
                      key={`arch-item-${idx}`}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 flex items-center gap-2"
                    >
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      <span className="truncate">{tItem}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDeleteArchivedITRecord(selectedArchivedIT.id, selectedArchivedIT.name)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-transparent rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>Permanently Delete Audit Record</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedArchivedIT(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Work Audit View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

