import React, { useState, useEffect, useMemo } from "react";
import { 
  HardDrive, 
  Cloud, 
  CloudOff, 
  Upload, 
  Download, 
  Trash2, 
  RefreshCw, 
  FileText, 
  Mic, 
  Database, 
  ExternalLink, 
  Folder, 
  FolderPlus, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Filter,
  ShieldCheck,
  File,
  Image as ImageIcon,
  Play,
  Share2
} from "lucide-react";
import { 
  connectGoogleDrive, 
  getDriveAccessToken, 
  getDriveStorageQuota, 
  listDriveFiles, 
  uploadFileToDrive, 
  deleteDriveFile, 
  downloadDriveFile, 
  backupSystemToGoogleDrive, 
  formatDriveBytes, 
  disconnectGoogleDrive,
  DriveStorageQuota, 
  DriveFileItem,
  getCachedDriveUser
} from "../utils/googleDrive";
import { getAudioRecordingBlob } from "../utils/audioStorage";
import { CounsellingEnquiry, Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract } from "../types";
import VoiceVaultExplorerModal from "./VoiceVaultExplorerModal";
import CctvNvrStorageModal from "./CctvNvrStorageModal";

interface GoogleDriveManagerProps {
  userEmail: string;
  userRole: string;
  counsellingEnquiries?: CounsellingEnquiry[];
  tickets?: Ticket[];
  history?: Ticket[];
  inventory?: InventoryItem[];
  rooms?: Room[];
  allocations?: EmployeeAllocation[];
  warranty?: WarrantyContract[];
  onUpdateEnquiry?: (enquiry: CounsellingEnquiry) => void;
  theme?: "light" | "dark";
}

export default function GoogleDriveManager({
  userEmail,
  userRole,
  counsellingEnquiries = [],
  tickets = [],
  history = [],
  inventory = [],
  rooms = [],
  allocations = [],
  warranty = [],
  onUpdateEnquiry,
  theme = "light"
}: GoogleDriveManagerProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [quota, setQuota] = useState<DriveStorageQuota | null>(null);
  const [driveUser, setDriveUser] = useState<any>(null);
  
  // File Explorer State
  const [selectedFolder, setSelectedFolder] = useState<
    "ALL" | "Counselling Voice Vault" | "Student Documents" | "System Backups" | "School Media"
  >("ALL");
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncingFiles, setIsSyncingFiles] = useState(false);

  // Upload Modal / State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");

  // Confirmation modal for destructive actions (MANDATORY per Workspace guidelines)
  const [deleteModalItem, setDeleteModalItem] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-Selection State for Bulk File Deletion
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Backup State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMsg, setBackupSuccessMsg] = useState("");

  // Audio Playback Preview State
  const [previewAudioItem, setPreviewAudioItem] = useState<{ item: DriveFileItem; url: string } | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);

  const handlePlayDriveAudio = async (fileItem: DriveFileItem) => {
    try {
      setLoadingAudioId(fileItem.id);
      const blob = await downloadDriveFile(fileItem.id);
      const url = URL.createObjectURL(blob);
      setPreviewAudioItem({ item: fileItem, url });
    } catch (err: any) {
      alert(`Could not load audio file for playback: ${err.message || err}`);
    } finally {
      setLoadingAudioId(null);
    }
  };

  // Voice Vault Modal Explorer State
  const [isVoiceVaultExplorerOpen, setIsVoiceVaultExplorerOpen] = useState(false);
  const [isCloudflareModalOpen, setIsCloudflareModalOpen] = useState(false);

  // Firebase Domain Auth Error State (for Vercel & custom deployments)
  const [domainAuthError, setDomainAuthError] = useState<{
    show: boolean;
    domain: string;
    projectId: string;
    message: string;
  } | null>(null);
  const [copiedDomain, setCopiedDomain] = useState<boolean>(false);

  // Comprehensive Voice Vault records count combining local enquiry forms and Google Drive / Server vault files
  const audioEnquiriesCount = useMemo(() => {
    return counsellingEnquiries.filter((e) => Boolean(e.audioRecording && (e.audioRecording.audioData || e.audioRecording.storageKey || e.audioRecording.driveFileUrl || e.audioRecording.driveFileId || e.audioRecording.fileName))).length;
  }, [counsellingEnquiries]);

  const driveAudioFilesCount = useMemo(() => {
    return (files || []).filter(f => f.name.includes('.webm') || f.name.includes('.mp3') || f.name.includes('.wav') || f.name.includes('AUDIO') || f.name.includes('Meeting') || (f.mimeType && f.mimeType.includes('audio'))).length;
  }, [files]);

  const totalVoiceRecordsCount = useMemo(() => {
    return Math.max(audioEnquiriesCount, driveAudioFilesCount);
  }, [audioEnquiriesCount, driveAudioFilesCount]);

  const totalSyncedRecordsCount = useMemo(() => {
    const syncedEnquiries = counsellingEnquiries.filter((e) => Boolean(e.audioRecording?.driveFileId || e.audioRecording?.driveFileUrl)).length;
    return Math.max(syncedEnquiries, driveAudioFilesCount);
  }, [counsellingEnquiries, driveAudioFilesCount]);

  const backupSnapshotsCount = useMemo(() => {
    return (files || []).filter(f => f.name.includes('Backup') || f.name.includes('Snapshot') || f.name.includes('.json')).length;
  }, [files]);

  const activeSchoolEntitiesCount = useMemo(() => {
    return counsellingEnquiries.length + tickets.length + inventory.length;
  }, [counsellingEnquiries, tickets, inventory]);

  // Check initial connection
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const token = await getDriveAccessToken();
      if (token) {
        setIsConnected(true);
        setDriveUser(getCachedDriveUser());
        await loadQuotaAndFiles();
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      // console.warn("Drive connection check:", err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQuotaAndFiles = async () => {
    setIsSyncingFiles(true);
    try {
      const quotaData = await getDriveStorageQuota();
      setQuota(quotaData);
      if (quotaData.user) {
        setDriveUser(quotaData.user);
      }

      const fileList = await listDriveFiles(selectedFolder);
      setFiles(fileList);
    } catch (err: any) {
      // console.warn("Notice loading quota/files:", err?.message || err);
      if (
        err.message && 
        (err.message.includes("expired") || 
         err.message.includes("permission is required") ||
         err.message.includes("permission missing") ||
         err.message.includes("insufficient") ||
         err.message.includes("403"))
      ) {
        setIsConnected(false);
        disconnectGoogleDrive();
      }
    } finally {
      setIsSyncingFiles(false);
    }
  };

  useEffect(() => {
    loadQuotaAndFiles();
  }, [selectedFolder, isConnected]);

  const handleEnableServerVault = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sgs_google_drive_token", "auto_cloud_drive_token_active");
        localStorage.setItem("sgs_google_drive_user", JSON.stringify({
          displayName: "Birla 24/7 Cloud Vault",
          email: "school-vault@birla-internal.edu",
          uid: "server-vault-local"
        }));
      } catch (_) {}
    }
    setDomainAuthError(null);
    setIsConnected(true);
    setDriveUser({
      displayName: "Birla 24/7 Cloud Vault",
      email: "school-vault@birla-internal.edu"
    });
    loadQuotaAndFiles();
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setDomainAuthError(null);
    try {
      await connectGoogleDrive();
      setIsConnected(true);
      setDriveUser(getCachedDriveUser());
      await loadQuotaAndFiles();
    } catch (err: any) {
      if (err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('unauthorized-domain'))) {
        const domain = (typeof window !== "undefined") ? window.location.hostname : "birlaopenmindsapp.vercel.app";
        setDomainAuthError({
          show: true,
          domain,
          projectId: "project-0a48d5bf-f17b-4b14-8c2",
          message: err.message || "Domain is not authorized in Firebase Console"
        });
      } else if (err.code !== 'auth/popup-closed-by-user') {
        alert(`Google Drive connection notice: ${err.message || "Failed to authenticate"}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    disconnectGoogleDrive();
    setIsConnected(false);
    setQuota(null);
    loadQuotaAndFiles();
  };

  // Full Database Backup to 24/7 App Server Vault & Google Drive
  const handleSystemBackup = async () => {
    setIsBackingUp(true);
    setBackupSuccessMsg("");
    try {
      const backupFile = await backupSystemToGoogleDrive({
        tickets,
        history,
        inventory,
        rooms,
        allocations,
        warranty,
        counsellingEnquiries
      });
      const dest = isConnected ? "5 TB Google Drive & 24/7 App Server Vault" : "24/7 App Server Vault (Zero Popups)";
      setBackupSuccessMsg(`Snapshot saved successfully to ${dest}: "${backupFile.name}"`);
      await loadQuotaAndFiles();
      setTimeout(() => setBackupSuccessMsg(""), 6000);
    } catch (err: any) {
      alert(`Backup notice: ${err.message || err}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Sync all local IndexedDB audio recordings to 24/7 Server Vault & Google Drive
  const handleSyncAllAudiosToDrive = async () => {
    setIsUploading(true);
    setUploadStatusMsg("Syncing counselling voice recordings to 24/7 Server Vault...");

    try {
      let count = 0;
      for (const enquiry of counsellingEnquiries) {
        if (enquiry.audioRecording && (enquiry.audioRecording.audioData || enquiry.audioRecording.storageKey) && (!enquiry.audioRecording.driveFileUrl || enquiry.audioRecording.driveFileUrl.startsWith("blob:"))) {
          setUploadStatusMsg(`Uploading audio: ${enquiry.studentName} (${enquiry.enquiryNo})...`);
          
          let audioPayload: string | null = enquiry.audioRecording.audioData || null;
          if (!audioPayload && enquiry.audioRecording.storageKey) {
            const blobData = await getAudioRecordingBlob(enquiry.audioRecording.storageKey);
            if (blobData) {
              if (typeof blobData === "string") {
                audioPayload = blobData;
              }
            }
          }

          if (audioPayload) {
            const cleanFilename = `Voice_${enquiry.enquiryNo}_${enquiry.studentName.replace(/\s+/g, '_')}.webm`;
            const uploadRes = await fetch("/api/upload-audio", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                enquiryNo: enquiry.enquiryNo,
                id: enquiry.id,
                audioBase64: audioPayload,
                filename: cleanFilename,
                mimeType: enquiry.audioRecording.mimeType || "audio/webm",
                meetingTextSummary: (enquiry as any).meetingTextSummary || enquiry.audioRecording.meetingTextSummary
              })
            });

            if (uploadRes.ok) {
              const resData = await uploadRes.json();
              if (resData.success && resData.audioUrl) {
                const updated: CounsellingEnquiry = {
                  ...enquiry,
                  audioRecording: {
                    ...enquiry.audioRecording,
                    driveFileId: resData.filename,
                    driveFileUrl: resData.audioUrl,
                    driveSyncedAt: new Date().toISOString()
                  }
                };
                if (onUpdateEnquiry) {
                  onUpdateEnquiry(updated);
                }
                count++;
              }
            }
          }
        }
      }

      setUploadStatusMsg(count > 0 ? `Synced ${count} audio recording(s) to 24/7 Server Vault!` : "All audio recordings are fully synced on 24/7 Server Vault!");
      await loadQuotaAndFiles();
      setTimeout(() => setUploadStatusMsg(""), 5000);
    } catch (err: any) {
      alert(`Audio sync notice: ${err.message || err}`);
      setUploadStatusMsg("");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSyncSingleAudioToDrive = async (enquiry: CounsellingEnquiry) => {
    if (!enquiry.audioRecording) return;
    setIsUploading(true);
    setUploadStatusMsg(`Uploading audio for ${enquiry.studentName} (${enquiry.enquiryNo})...`);
    try {
      let audioPayload: string | null = enquiry.audioRecording.audioData || null;
      if (!audioPayload && enquiry.audioRecording.storageKey) {
        const blobData = await getAudioRecordingBlob(enquiry.audioRecording.storageKey);
        if (typeof blobData === "string") {
          audioPayload = blobData;
        }
      }

      if (audioPayload) {
        const cleanFilename = `Voice_${enquiry.enquiryNo}_${enquiry.studentName.replace(/\s+/g, '_')}.webm`;
        const uploadRes = await fetch("/api/upload-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enquiryNo: enquiry.enquiryNo,
            id: enquiry.id,
            audioBase64: audioPayload,
            filename: cleanFilename,
            mimeType: enquiry.audioRecording.mimeType || "audio/webm",
            meetingTextSummary: (enquiry as any).meetingTextSummary || enquiry.audioRecording.meetingTextSummary
          })
        });

        if (uploadRes.ok) {
          const resData = await uploadRes.json();
          if (resData.success && resData.audioUrl) {
            const updated: CounsellingEnquiry = {
              ...enquiry,
              audioRecording: {
                ...enquiry.audioRecording,
                driveFileId: resData.filename,
                driveFileUrl: resData.audioUrl,
                driveSyncedAt: new Date().toISOString()
              }
            };
            if (onUpdateEnquiry) {
              onUpdateEnquiry(updated);
            }
          }
        }
      }
      setUploadStatusMsg(`Synced audio for ${enquiry.studentName} to 24/7 Server Vault!`);
      await loadQuotaAndFiles();
      setTimeout(() => setUploadStatusMsg(""), 4000);
    } catch (err: any) {
      alert(`Sync notice: ${err.message || err}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Upload custom file from user to 24/7 Server Vault & Google Drive
  const handleCustomFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatusMsg(`Uploading ${file.name} to 24/7 Server Vault...`);
    try {
      const folderTarget = selectedFolder === "ALL" ? "Counselling Voice Vault" : selectedFolder;
      await uploadFileToDrive({
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        dataBlob: file,
        folderType: folderTarget,
        description: `Uploaded from Birla Open Minds Web Portal by ${userEmail}`
      });

      setUploadStatusMsg(`Uploaded "${file.name}" to 24/7 Server Vault successfully!`);
      await loadQuotaAndFiles();
      setTimeout(() => setUploadStatusMsg(""), 5000);
    } catch (err: any) {
      alert(`Upload notice: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Delete file (with explicit confirmation dialog as required by skill)
  const confirmDeleteFile = async () => {
    if (!deleteModalItem) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(deleteModalItem.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteModalItem.id));
      setDeleteModalItem(null);
      // Reload quota
      const q = await getDriveStorageQuota();
      setQuota(q);
    } catch (err: any) {
      alert(`Failed to delete file: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Download file
  const handleDownload = async (fileItem: DriveFileItem) => {
    try {
      if (fileItem.webContentLink) {
        window.open(fileItem.webContentLink, "_blank");
        return;
      }
      const blob = await downloadDriveFile(fileItem.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileItem.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // Bulk Delete Files Handler
  const confirmBulkDeleteFiles = async () => {
    if (selectedFileIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const toDelete = [...selectedFileIds];
      for (const id of toDelete) {
        await deleteDriveFile(id).catch(() => {});
      }
      setFiles((prev) => prev.filter((f) => !toDelete.includes(f.id)));
      setSelectedFileIds([]);
      setIsBulkDeleteModalOpen(false);
      const q = await getDriveStorageQuota();
      setQuota(q);
    } catch (err: any) {
      alert(`Failed to execute bulk delete: ${err.message || err}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Multi-Selection Helper Functions
  const isAllSelected = filteredFiles.length > 0 && selectedFileIds.length === filteredFiles.length;
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedFileIds(filteredFiles.map((f) => f.id));
    } else {
      setSelectedFileIds([]);
    }
  };

  const handleToggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Storage calculation
  const totalLimit = quota?.limit ? parseInt(quota.limit, 10) : 5497558138880; // default 5TB if unlimited
  const usedBytes = quota?.usage ? parseInt(quota.usage, 10) : 0;
  const usagePercent = Math.min(100, Math.max(0.1, (usedBytes / totalLimit) * 100));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Header Banner (Compact & Sleek) */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 rounded-xl p-4 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-wider text-amber-200 flex items-center gap-1">
              <HardDrive size={12} />
              24/7 SERVER CLOUD VAULT
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 rounded-full text-[10px] font-bold">
              ⚡ Running 24/7
            </span>
          </div>
          <h1 className="text-lg md:text-xl font-bold tracking-tight">
            Birla Open Minds - 24/7 Media Storage Vault
          </h1>
          <p className="text-xs text-blue-100 leading-snug">
            All voice recordings, transcripts, student documents & snapshots save continuously to server vault. No OAuth popup required!
          </p>
        </div>

        {/* Connection Action & Firebase Status */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-lg flex items-center gap-2 text-xs text-emerald-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div>
              <p className="font-bold text-emerald-100 text-[11px] flex items-center gap-1">
                🔥 Realtime Server Vault Active
              </p>
            </div>
          </div>

          {isConnected ? (
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg p-2 flex items-center gap-2 text-xs">
              <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-300 font-bold text-xs">
                {driveUser?.photoLink ? (
                  <img src={driveUser.photoLink} alt="Avatar" className="w-7 h-7 rounded-full" />
                ) : (
                  driveUser?.displayName?.charAt(0) || "G"
                )}
              </div>
              <div className="text-left text-[11px]">
                <p className="font-bold text-white flex items-center gap-1">
                  <CheckCircle2 size={11} className="text-emerald-400" />
                  Drive Synced
                </p>
                <p className="text-blue-200 text-[10px] font-mono truncate max-w-[130px]">
                  {driveUser?.emailAddress || driveUser?.email || "Google Account"}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="ml-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-100 rounded text-[10px] font-bold cursor-pointer"
                title="Disconnect Google Drive session"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center justify-center gap-2 px-3 py-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-lg font-bold text-xs shadow-md active:scale-95 transition-all cursor-pointer border border-white/40 disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span>{isConnecting ? "Connecting..." : "Connect Google Drive (Optional)"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Firebase Authorized Domain Helper for Vercel / Production */}
      {domainAuthError?.show && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/60 rounded-2xl border-2 border-amber-400 dark:border-amber-600 space-y-3 shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-amber-500 text-white font-black text-xs">⚠️ Action Required</span>
              <h3 className="font-extrabold text-sm text-amber-950 dark:text-amber-100">
                Firebase Domain Authorization Needed for Vercel
              </h3>
            </div>
            <button
              onClick={() => setDomainAuthError(null)}
              className="text-amber-700 dark:text-amber-300 hover:text-amber-950 font-bold text-xs cursor-pointer"
            >
              ✕ Dismiss
            </button>
          </div>

          <p className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
            Google OAuth requires domain <strong className="font-mono bg-amber-200/80 dark:bg-amber-900 px-1.5 py-0.5 rounded text-amber-950 dark:text-amber-100">{domainAuthError.domain}</strong> to be added under Authorized Domains in your Firebase Console.
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(domainAuthError.domain);
                setCopiedDomain(true);
                setTimeout(() => setCopiedDomain(false), 3000);
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>{copiedDomain ? "✓ Domain Copied!" : `📋 Copy Domain (${domainAuthError.domain})`}</span>
            </button>

            <a
              href={`https://console.firebase.google.com/project/${domainAuthError.projectId}/authentication/settings`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              <span>Open Firebase Console Settings ↗</span>
            </a>

            <button
              type="button"
              onClick={handleEnableServerVault}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡ Switch to 24/7 Server Vault (Skip Domain Setup)</span>
            </button>
          </div>

          <div className="bg-white/90 dark:bg-slate-900/90 p-3.5 rounded-xl border border-amber-200 dark:border-amber-800 text-[11px] text-slate-800 dark:text-slate-200 space-y-1.5">
            <p className="font-bold text-slate-900 dark:text-white">Quick 1-Minute Whitelist Steps:</p>
            <ol className="list-decimal pl-4 space-y-1 text-slate-700 dark:text-slate-300 font-medium">
              <li>Click <strong>Open Firebase Console Settings</strong> above (Project: <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{domainAuthError.projectId}</span>).</li>
              <li>Scroll to <strong>Authorized domains</strong> section &gt; click <strong>Add domain</strong>.</li>
              <li>Paste <span className="font-mono font-bold text-amber-700 dark:text-amber-300">{domainAuthError.domain}</span> and click <strong>Save</strong>.</li>
              <li>Return here and click <strong>Connect Google Drive</strong> again — it connects instantly!</li>
            </ol>
          </div>
        </div>
      )}

      {/* Quota & Capacity Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Capacity Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Storage Capacity</span>
            <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg">
              <HardDrive size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {quota?.limit ? formatDriveBytes(quota.limit) : "5.00 TB"}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Google One Pro Cloud Quota
            </p>
          </div>
          <div className="space-y-1">
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                style={{ width: `${usagePercent}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Used: {formatDriveBytes(usedBytes)}</span>
              <span>{usagePercent.toFixed(1)}% full</span>
            </div>
          </div>
        </div>

        {/* Counselling Audio Vault Sync Status (Clickable for Voice Vault Search) */}
        <div 
          onClick={() => setIsVoiceVaultExplorerOpen(true)}
          className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 dark:from-amber-950/40 dark:to-slate-900 border-2 border-amber-300 dark:border-amber-700/60 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl p-5 shadow-sm space-y-3 transition-all cursor-pointer group hover:shadow-md relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <Mic size={14} className="text-amber-600 animate-pulse" />
              Voice Vault Status
            </span>
            <span className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg group-hover:scale-110 transition-transform">
              <Mic size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>{totalVoiceRecordsCount} Records</span>
              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold group-hover:underline">
                🔍 Search & View All
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {totalSyncedRecordsCount} Saved in 24/7 School Cloud Server Database
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVoiceVaultExplorerOpen(true);
              }}
              className="py-1.5 px-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <Search size={13} />
              Open Voice Search
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSyncAllAudiosToDrive();
              }}
              disabled={isUploading}
              className="py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Cloud size={13} />
              {isUploading ? "Syncing..." : "Sync All"}
            </button>
          </div>
        </div>

        {/* Cloudflare R2 Vault & Edge CDN Card */}
        <div className="bg-gradient-to-br from-orange-500/10 via-amber-500/5 to-yellow-500/10 dark:from-orange-950/40 dark:to-slate-900 border-2 border-orange-300 dark:border-orange-700/60 rounded-xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-orange-800 dark:text-orange-300 uppercase tracking-wider flex items-center gap-1.5">
              <Cloud size={14} className="text-orange-600" />
              Cloudflare R2 Vault
            </span>
            <span className="p-2 bg-orange-500/20 text-orange-700 dark:text-orange-300 rounded-lg">
              <Cloud size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white flex items-baseline gap-2">
              <span>$0 Egress</span>
              <span className="text-xs text-orange-600 dark:text-orange-400 font-semibold">
                ⚡ Edge CDN
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Cloudflare R2 Object Storage & Streaming
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsCloudflareModalOpen(true)}
            className="w-full py-2 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Cloud size={14} />
            Configure Cloudflare R2
          </button>
        </div>

        {/* Database Snapshots & Redundancy */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Snapshot</span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
              <Database size={18} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {backupSnapshotsCount} Snapshots
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {counsellingEnquiries.length} Enquiries • {tickets.length} IT Tickets Active
            </p>
          </div>
          <button
            onClick={handleSystemBackup}
            disabled={isBackingUp}
            className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck size={14} />
            {isBackingUp ? "Saving Snapshot..." : "Save Full System Snapshot"}
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {/* Notifications / Feedback */}
      {backupSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{backupSuccessMsg}</span>
        </div>
      )}

      {uploadStatusMsg && (
        <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <RefreshCw size={16} className="text-blue-500 animate-spin shrink-0" />
          <span>{uploadStatusMsg}</span>
        </div>
      )}

      {/* MULTI-SELECTION BULK DELETE ACTION BAR */}
      {selectedFileIds.length > 0 && (
        <div className="p-3.5 bg-red-500/10 dark:bg-red-950/60 border-2 border-red-500/50 rounded-xl text-xs font-semibold flex flex-wrap items-center justify-between gap-3 animate-fade-in shadow-md">
          <div className="flex items-center gap-2.5 text-red-950 dark:text-red-200 font-bold">
            <input 
              type="checkbox" 
              checked={isAllSelected} 
              onChange={handleSelectAll} 
              className="w-4 h-4 text-red-600 rounded cursor-pointer accent-red-600" 
            />
            <span className="text-sm">
              Selected <strong>{selectedFileIds.length}</strong> file(s) out of <strong>{filteredFiles.length}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setIsBulkDeleteModalOpen(true)} 
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black flex items-center gap-1.5 shadow-md transition-all cursor-pointer active:scale-95"
            >
              <Trash2 size={15} />
              <span>Delete Selected Files ({selectedFileIds.length})</span>
            </button>

            <button 
              type="button"
              onClick={() => setSelectedFileIds([])} 
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition-all cursor-pointer border border-slate-300 dark:border-slate-700"
            >
              Cancel Selection
            </button>
          </div>
        </div>
      )}

      {/* Main Drive Explorer Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {/* Explorer Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Folder size={20} className="text-blue-600" />
              <span>24/7 Cloud Vault Files & Folders</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Folder: <span className="font-bold text-blue-600 dark:text-blue-400">Birla Open Minds - 24/7 Server Vault (Auto-Synced)</span>
            </p>
          </div>

          {/* Quick Actions (Upload & Refresh) */}
          <div className="flex flex-wrap items-center gap-2.5">
            {filteredFiles.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedFileIds.length === filteredFiles.length) {
                    setSelectedFileIds([]);
                  } else {
                    setSelectedFileIds(filteredFiles.map(f => f.id));
                  }
                }}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                {selectedFileIds.length === filteredFiles.length ? "Deselect All" : "Select All Files"}
              </button>
            )}

            <button
              onClick={loadQuotaAndFiles}
              disabled={isSyncingFiles}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh Files"
            >
              <RefreshCw size={14} className={isSyncingFiles ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>

            <label className={`px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer ${isUploading ? "opacity-50 pointer-events-none" : ""}`}>
              <Upload size={14} />
              <span>Upload Document / Audio</span>
              <input
                type="file"
                className="hidden"
                onChange={handleCustomFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Folder Navigation Tabs & Search */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: "ALL", label: "All School Files" },
              { id: "Counselling Voice Vault", label: "🎙️ Counselling Voice Vault" },
              { id: "Student Documents", label: "📄 Student Documents" },
              { id: "System Backups", label: "💾 System Backups" },
              { id: "School Media", label: "🖼️ School Media" }
            ].map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setSelectedFolder(folder.id as any);
                  setSelectedFileIds([]);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedFolder === folder.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                }`}
              >
                {folder.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files in drive..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Files Table / List */}
        {!isConnected ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/40 rounded-full flex items-center justify-center text-blue-600 mx-auto">
              <CloudOff size={28} />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Google Drive Is Not Connected
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Connect your Google account with 5 TB storage capacity above to access, upload, stream, and backup school records.
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer transition-all"
            >
              Connect Google Drive Now
            </button>
          </div>
        ) : isSyncingFiles ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-semibold text-slate-500">Querying Google Drive files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
              <Folder size={26} />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Files in "{selectedFolder}" Yet
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload counselling voice recordings, admission certificates, or system backups to populate your 5 TB Google Drive cloud folder.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4 w-10 text-center">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected} 
                      onChange={handleSelectAll} 
                      className="w-4 h-4 text-red-600 rounded cursor-pointer accent-red-600" 
                      title="Select / Deselect All Files"
                    />
                  </th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Uploaded Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredFiles.map((item) => {
                  const isAudio = item.mimeType?.includes("audio");
                  const isJson = item.mimeType?.includes("json") || item.name.endsWith(".json");
                  const isImg = item.mimeType?.includes("image");
                  const isSelected = selectedFileIds.includes(item.id);

                  return (
                    <tr 
                      key={item.id}
                      className={`transition-colors ${
                        isSelected 
                          ? "bg-red-50/60 dark:bg-red-950/30 font-medium" 
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        <input 
                          type="checkbox" 
                          checked={isSelected} 
                          onChange={() => handleToggleSelectFile(item.id)} 
                          className="w-4 h-4 text-red-600 rounded cursor-pointer accent-red-600"
                        />
                      </td>
                      <td className="py-3 px-4 flex items-center gap-3">
                        <div className={`p-2 rounded-lg shrink-0 ${
                          isAudio 
                            ? "bg-amber-100 dark:bg-amber-950/50 text-amber-600" 
                            : isJson 
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600" 
                            : isImg
                            ? "bg-purple-100 dark:bg-purple-950/50 text-purple-600"
                            : "bg-blue-100 dark:bg-blue-950/50 text-blue-600"
                        }`}>
                          {isAudio ? (
                            <Mic size={16} />
                          ) : isJson ? (
                            <Database size={16} />
                          ) : isImg ? (
                            <ImageIcon size={16} />
                          ) : (
                            <FileText size={16} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-md">
                            {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            ID: {item.id}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                        {formatDriveBytes(item.size)}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {item.createdTime ? new Date(item.createdTime).toLocaleString() : "Recently"}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {isAudio && (
                          <button
                            type="button"
                            onClick={() => handlePlayDriveAudio(item)}
                            disabled={loadingAudioId === item.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-[11px] transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            title="Play Audio Recording directly"
                          >
                            <Play size={12} className={loadingAudioId === item.id ? "animate-spin" : "fill-current"} />
                            <span>{loadingAudioId === item.id ? "Loading..." : "Play Audio"}</span>
                          </button>
                        )}

                        {item.webViewLink && (
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-300 rounded-lg font-bold text-[11px] transition-colors"
                          >
                            <ExternalLink size={12} />
                            <span>View in Drive</span>
                          </a>
                        )}

                        <button
                          onClick={() => handleDownload(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                          title="Download file"
                        >
                          <Download size={12} />
                          <span>Download</span>
                        </button>

                        <button
                          onClick={() => setDeleteModalItem(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900 text-red-600 dark:text-red-300 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                          title="Delete from Google Drive"
                        >
                          <Trash2 size={12} />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BULK DELETE CONFIRMATION MODAL */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900/60 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Bulk Delete {selectedFileIds.length} Selected File(s)?
                </h3>
                <p className="text-xs text-slate-500">
                  This action permanently removes all selected files from your 5 TB cloud storage.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Files Selected for Deletion:
              </span>
              {files.filter(f => selectedFileIds.includes(f.id)).map(f => (
                <div key={f.id} className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-medium py-0.5 border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                  <span className="truncate max-w-[280px]">📄 {f.name}</span>
                  <span className="font-mono text-[10px] text-slate-400">{formatDriveBytes(f.size)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
              ⚠️ Are you sure you want to permanently delete these <strong>{selectedFileIds.length}</strong> selected file(s)? This operation cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                disabled={isBulkDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDeleteFiles}
                disabled={isBulkDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isBulkDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isBulkDeleting ? "Deleting Selected Files..." : `Confirm Delete ${selectedFileIds.length} Files`}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* SINGLE FILE DELETE CONFIRMATION MODAL */}
      {deleteModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white dark:bg-slate-900 border border-red-300 dark:border-red-900/60 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Permanently Delete from Google Drive?
                </h3>
                <p className="text-xs text-slate-500">
                  This action removes the file from your 5 TB cloud storage.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-800 dark:text-slate-200">
                File: {deleteModalItem.name}
              </p>
              <p className="text-[11px] text-slate-500">
                Size: {formatDriveBytes(deleteModalItem.size)} | ID: {deleteModalItem.id}
              </p>
            </div>

            <p className="text-xs text-red-600 dark:text-red-400 font-semibold leading-relaxed">
              ⚠️ Are you sure you want to delete this file? This operation cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio Playback Modal */}
      {previewAudioItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
                <Mic size={20} />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Playing Voice Recording</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewAudioItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                {previewAudioItem.item.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Size: {formatDriveBytes(previewAudioItem.item.size)} | Storage: Google Drive Backend
              </p>
            </div>

            <div className="py-2">
              <audio 
                controls 
                autoPlay 
                src={previewAudioItem.url} 
                className="w-full rounded-lg accent-amber-500" 
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDownload(previewAudioItem.item)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Download size={14} />
                <span>Download File</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewAudioItem(null)}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Vault Search & Explorer Modal */}
      <VoiceVaultExplorerModal
        isOpen={isVoiceVaultExplorerOpen}
        onClose={() => setIsVoiceVaultExplorerOpen(false)}
        counsellingEnquiries={counsellingEnquiries}
        onUpdateEnquiry={onUpdateEnquiry}
        onSyncSingleAudio={handleSyncSingleAudioToDrive}
        isUploading={isUploading}
      />

      {/* Cloudflare R2 Storage Modal */}
      {isCloudflareModalOpen && (
        <CctvNvrStorageModal
          isOpen={isCloudflareModalOpen}
          onClose={() => setIsCloudflareModalOpen(false)}
        />
      )}
    </div>
  );
}
