export type SchoolBranch = "Birla Open Minds International School";

export type TicketStatus = "open" | "pending" | "resolved";
export type Priority = "High" | "Medium" | "Low";

export interface Ticket {
  id: string;
  issue: string; // formatted: [Staff Name] Describe Issue
  staffName: string;
  actualIssue: string;
  mobile: string;
  priority: Priority;
  status: TicketStatus;
  linkedRoom: string; // school - dept - room (class_name)
  date: string;
  fixedAt?: string;
  remarks?: string;
  building?: string; // e.g., "New Building School" or "Old Building School"
}

export interface InventoryItem {
  id: string;
  itemName: string;
  assetType: "Consumable (Count Only)" | "Fixed Asset (Need Serials)";
  category: string;
  totalQty: number;
  usedQty: number;
  balanceQty: number;
  serials: string;
  vendor: string;
  vendorCode?: string; // Standardized code (e.g., VND-01)
  paymentCycle?: "Monthly" | "Bi-Monthly (2 Months)" | "Quarterly (3 Months)" | "Half-Yearly (6 Months)" | "Yearly"; // Payment settlement cycle
  unitPrice?: number; // Optional hardware cost for financial summation
  date: string;
  warranty: string;
  remarks: string;
  logs: string; // New logs are prepended with timestamps
  reorderLevel?: number; // Minimum balance threshold for low stock alert
}

export interface ClassHistoryItem {
  id: string;
  className: string;
  academicYear: string;
  allocatedAt: string; // "DD-MM-YYYY HH:MM"
}

export interface Room {
  id: string;
  school: SchoolBranch;
  building?: string; // e.g. "New Building School" or "Old Building School"
  dept: string;
  roomNumber: string;
  className: string;
  floorWing?: string; // e.g. "North Ground Floor", "North First Floor", "South Ground Floor", custom floor, etc.
  assets: Record<string, string>; // name -> quantity/details
  hwLogs: string;
  classHistory?: ClassHistoryItem[]; // Historical class allocations
  academicYear?: string; // e.g. "2025-2026"
}

export interface EmployeeAllocation {
  id: string;
  empName: string;
  itemName: string;
  invId: string;
  qty: number;
  remarks: string;
  assignedOn: string;
  returnedOn?: string;
  status: "Active" | "Returned";
  condition?: "Working" | "Damaged";
  building?: string;
  room?: string;
  assigneeType?: "Employee" | "Room";
}

export interface WarrantyContract {
  id: string;
  itemName: string;
  type: "Hardware Warranty" | "AMC (Annual Maintenance)";
  expiryDate: string; // DD-MM-YYYY
  vendor: string;
  registeredOn: string;
  isAutoFromInventory?: boolean;
  isNoWarranty?: boolean;
}

export function parseTicketDateToTimestamp(dateStr: string): number {
  if (!dateStr || typeof dateStr !== "string") return 0;

  const trimmed = dateStr.trim();
  
  // Try native Date.parse first for US-style or standard ISO slashes (e.g. 6/1/2026)
  // to avoid custom rules treating 1st number as day.
  // We only run this if it contains "/" and doesn't explicitly start with a fixed 2-digit day like "30/05/"
  if (trimmed.includes("/")) {
    const parts = trimmed.split(/[\/\s]/);
    const dayVal = parseInt(parts[0], 10);
    const monthVal = parseInt(parts[1], 10);
    // If the first number is month and <= 12, let's see if native parse handles it as US style M/D/YYYY
    if (dayVal <= 12 && monthVal <= 12 && parts[0].length === 1) {
      const nativeParsed = Date.parse(trimmed);
      if (!isNaN(nativeParsed) && nativeParsed > 0) {
        return nativeParsed;
      }
    }
  }

  // Normalize delimiters to space e.g. dots, slashes, hyphens, commas
  let cleanStr = trimmed.replace(/,/g, " ").replace(/\s+/g, " ");
  
  // Match standard Day/Month/Year or Year/Month/Day formats
  const dmyMatch = cleanStr.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  const ymdMatch = cleanStr.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  
  let year = 0;
  let month = 0; // 0-indexed
  let day = 0;
  let restOfStr = "";
  
  if (dmyMatch) {
    const first = parseInt(dmyMatch[1], 10);
    const second = parseInt(dmyMatch[2], 10);
    const third = parseInt(dmyMatch[3], 10);

    // Heuristic: If it contains slash and first element length is 1 (e.g. "6/1/2026"), it's likely Month/Day/Year
    const isSlash = cleanStr.includes("/");
    if (isSlash && first <= 12 && second <= 31 && dmyMatch[1].length === 1) {
      month = first - 1;
      day = second;
    } else {
      day = first;
      month = second - 1;
    }
    year = third;
    restOfStr = cleanStr.substring(dmyMatch[0].length).trim();
  } else if (ymdMatch) {
    year = parseInt(ymdMatch[1], 10);
    month = parseInt(ymdMatch[2], 10) - 1;
    day = parseInt(ymdMatch[3], 10);
    restOfStr = cleanStr.substring(ymdMatch[0].length).trim();
  } else {
    // Check if it matches named months like "01-Jun-2026" or "1 Jun 2026"
    const namedMonthMatch = cleanStr.match(/^(\d{1,2})[\s\-\.\/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-\.\/](\d{4})/i);
    if (namedMonthMatch) {
      day = parseInt(namedMonthMatch[1], 10);
      const monthStr = namedMonthMatch[2].toLowerCase();
      const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
      month = monthNames.indexOf(monthStr);
      year = parseInt(namedMonthMatch[3], 10);
      restOfStr = cleanStr.substring(namedMonthMatch[0].length).trim();
    } else {
      // Fallback to native parsing
      const parsed = Date.parse(trimmed);
      return isNaN(parsed) ? 0 : parsed;
    }
  }
  
  // Parse time part
  let hour = 0;
  let minute = 0;
  let second = 0;
  
  if (restOfStr) {
    const timeMatch = restOfStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
      minute = parseInt(timeMatch[2], 10);
      if (timeMatch[3]) {
        second = parseInt(timeMatch[3], 10);
      }
      
      const ampmMatch = restOfStr.match(/(am|pm)/i);
      if (ampmMatch) {
        const ampm = ampmMatch[1].toLowerCase();
        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;
      }
    }
  }
  
  const dateObj = new Date(year, month, day, hour, minute, second);
  const time = dateObj.getTime();
  return isNaN(time) ? 0 : time;
}

export function getNowFormatted(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
}

export function getNowFormattedNoSeconds(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function getNextTicketId(tickets: Ticket[], history: Ticket[]): string {
  const all = [...tickets, ...history];
  let maxNum = 0;
  all.forEach(t => {
    const match = t.id.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  });
  const nextNum = maxNum > 0 ? maxNum + 1 : 1;
  return `BI-TKT-${String(nextNum).padStart(2, "0")}`;
}

export type AdmissionStatus = 
  | "Interested" 
  | "Application Taken" 
  | "Entrance Test Required" 
  | "Admission Confirmed" 
  | "Follow-up Required" 
  | "Not Interested";

export const ADMISSION_CLASSES = [
  "Playgroup",
  "Nursery",
  "PP1 (LKG)",
  "PP2 (UKG)",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11 (Science)",
  "Grade 11 (Commerce)",
  "Grade 12 (Science)",
  "Grade 12 (Commerce)"
] as const;

export type AdmissionClass = (typeof ADMISSION_CLASSES)[number];

export interface CounsellingEnquiry {
  id: string; // e.g. "ENQ-2026-001"
  enquiryNo: string;
  date: string; // "DD-MM-YYYY"
  
  // 1. Student & Parent Details
  studentName: string;
  applyingForClass: string;
  academicYear?: string; // "2026-2027" | "2027-2028" | "2028-2029" | "2025-2026"
  dateOfBirth: string;
  gender: "Male" | "Female" | "Other";
  fatherName: string;
  motherName: string;
  contactNo: string;
  whatsappNo: string;
  previousSchool: string;
  previousClass: string;
  residentialAddress?: string;

  // 2. Parent Enquiry
  heardAboutSchool: string[]; // ["Google/Online", "Website", "Reference", "Existing Parent", "Advertisement", "Other"]
  reasonForChoosing: string;
  preferredContact: "Call" | "WhatsApp";
  bestTimeToContact: string;

  // 3. Student Information & Parent Expectations
  academicPerformance: string;
  studentInterests: string;
  strengths: string;
  areasNeedingSupport: string;
  transportRequired: boolean;
  hostelRequired: boolean;
  specialLearningSupport: boolean;
  specialLearningDetails: string;

  // 4. Counselling / Interaction Notes
  pointsDiscussed: string;
  counsellorObservations: string;

  // 5. Information Explained
  explainedSchoolFacilities: boolean;
  explainedAcademicProgramme: boolean;
  explainedFeeStructure: boolean;
  explainedTransportDetails: boolean;
  explainedSchoolRules: boolean;
  explainedActivitiesSports: boolean;

  // 6. Admission Status & Follow-up
  admissionStatus: AdmissionStatus;
  followUpDate: string;
  counsellorId?: string; // e.g. "COUNSELLOR-01" to "COUNSELLOR-10"
  counsellorName: string;
  parentSignatureRecorded: boolean;
  parentSignatureNotes?: string;
  officeRemarks?: string;

  // Multilingual Parent Communication Profile
  parentSpokenLanguage?: ParentSpokenLanguage;
  conversationLanguageNotes?: string;

  // 7. Live Meeting Audio Recording (Voice Vault)
  audioRecording?: CounsellingAudioRecord;
  removeAudio?: boolean;

  // Interaction & Follow-up History Log
  followUpLogs?: CounsellingFollowUpLog[];

  // CCTV NVR & MOM AI Fields
  isStarred?: boolean;
  nvrArchived?: boolean;
  momReport?: {
    generatedAt: string;
    format: "mom" | "executive" | "bilingual";
    content: string;
    actionItems?: string[];
  };

  createdAt: string;
  updatedAt: string;
}

export interface ParentSelfEntry {
  id: string; // e.g. "PSE-2026-001"
  studentName: string;
  applyingForClass: string;
  academicYear?: string;
  dateOfBirth?: string;
  gender?: "Male" | "Female" | "Other";
  fatherName?: string;
  motherName?: string;
  contactNo: string;
  whatsappNo?: string;
  previousSchool?: string;
  previousClass?: string;
  residentialAddress?: string;
  heardAboutSchool?: string[];
  reasonForChoosing?: string;
  preferredContact?: "Call" | "WhatsApp";
  transportRequired?: boolean;
  specialLearningSupport?: boolean;
  submittedAt: string; // ISO string
  formattedDate: string; // "DD-MM-YYYY HH:MM"
  status: "pending" | "claimed" | "dismissed";
  claimedBy?: string; // counsellorId
  claimedByName?: string; // counsellorName
  claimedAt?: string;
  dailyTokenNo?: number; // Daily arrival token/S.No (resets to 1 each new day)
  entryDate?: string; // "DD-MM-YYYY" e.g. "27-10-2026"
  dateKey?: string; // "YYYY-MM-DD" e.g. "2026-10-27"
}

export interface CounsellingFollowUpLog {
  id: string;
  timestamp: string;
  mode: "Phone Call" | "WhatsApp" | "In-Person Visit" | "Campus Tour";
  counsellorName: string;
  notes: string;
  sentiment?: "Positive" | "Hesitant" | "Budget Concern" | "Ready to Join";
  nextFollowUpDate?: string;
}

export type ParentSpokenLanguage = 
  | "English"
  | "English + Regional (Bilingual)"
  | "Hindi + English"
  | "Regional Language"
  | "Other"
  | (string & {});

export interface CounsellingAudioRecord {
  id: string; // Unique recording ID
  audioData?: string; // base64 or blob URL for immediate playback
  audioUrl?: string; // Server streaming URL accessible across all portals & devices
  storageKey?: string; // IndexedDB persistent key
  fileName: string;
  durationSeconds: number;
  durationFormatted?: string;
  fileSizeBytes: number;
  mimeType: string;
  recordedAt: string;
  counsellorId: string;
  counsellorName: string;
  enquiryNo: string;
  studentName: string;

  // Multilingual Parent Interaction Details
  parentLanguage?: ParentSpokenLanguage;
  conversationLanguageNotes?: string; // Key points discussed in Multilingual Regional / English
  audioSource?: "Hardware Microphone" | "Smart In-App Voice Vault" | "Phone Audio Upload";
  meetingTextSummary?: string; // Auto-generated counselling text transcript report
  
  // Executive Management Audit Fields
  reviewedBy?: string;
  reviewedAt?: string;
  qualityRating?: number; // 1 to 5 stars
  managementRemarks?: string;
  reviewStatus?: "Pending" | "Reviewed - Approved" | "Follow-up Required";

  // Counsellor Action Taken in response to Management Feedback
  counsellorActionTaken?: string;
  counsellorActionTimestamp?: string;

  // CCTV NVR Storage Protection & Rolling FIFO
  isStarred?: boolean; // Starred/Bookmarked files are NEVER auto-deleted by NVR FIFO
  isLockedFromNvrPurge?: boolean;
  nvrArchived?: boolean;

  // AI Meeting Minutes (MOM) & Notes Report
  momReport?: {
    generatedAt: string;
    format: "mom" | "executive" | "bilingual";
    content: string;
    actionItems?: string[];
    decisions?: string[];
    parentQuestions?: string[];
    counsellorTrainingTips?: string[];
  };

  // Google Drive Cloud Vault (5 TB Storage Integration)
  driveFileId?: string;
  driveFileUrl?: string;
  driveSyncedAt?: string;

  // Trilingual Audio Translation & Voice-to-Voice Playback
  translatedTranscript?: string;
  translatedDialogueTurns?: Array<{
    timestamp: string;
    speaker: "Counsellor" | "Parent" | string;
    originalText: string;
    englishTranslation: string;
  }>;
  translationSummary?: {
    feeDetails?: string;
    transportDetails?: string;
    curriculumDetails?: string;
    parentConcerns?: string[];
    counsellorTrainingTips?: string[];
    executiveSummary?: string;
  };
  translatedAudioData?: string;
  translatedAudioMimeType?: string;
  translatedAt?: string;
}

export interface NvrStorageStatus {
  usedBytes: number;
  quotaBytes: number;
  usagePercent: number;
  formattedUsed: string;
  formattedQuota: string;
  formattedFree: string;
  totalAudioFiles: number;
  starredProtectedFiles: number;
  oldestRecordingDate?: string;
  newestRecordingDate?: string;
  autoDeleteEnabled: boolean;
  protectStarred: boolean;
  retentionDays: number;
  cloudflareR2Configured: boolean;
  cloudflareBucketName?: string;
  cloudflareAccountId?: string;
  cloudflareAccessKeyId?: string;
  cloudflareSecretAccessKey?: string;
  recycleHistory: Array<{
    fileName: string;
    enquiryNo?: string;
    studentName?: string;
    freedBytes: number;
    deletedAt: string;
    reason: string;
  }>;
}

export interface CounsellorProfile {
  id: string; // "COUNSELLOR-01" to "COUNSELLOR-10"
  name: string;
  email: string;
  roleTitle: string;
  phone: string;
  color: string;
}

export interface CounsellorAccount {
  id: string; // e.g. "COUNSELLOR-01"
  name: string;
  username: string; // Username used to login into Counsellor portal
  password: string; // Password or PIN created by School Admin
  email: string;
  phone: string;
  roleTitle: string;
  assignedGrades: string;
  status: "active" | "inactive";
  color: string;
  createdAt: string;
  lastLogin?: string;
  notes?: string;
}

export const DEFAULT_COUNSELLOR_ACCOUNTS: CounsellorAccount[] = [
  {
    id: "COUNSELLOR-01",
    name: "K. Radhika",
    username: "radhika",
    password: "Password@111",
    email: "radhika.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00011",
    roleTitle: "Admissions & Parent Counsellor",
    assignedGrades: "All Grades / Parent Liaison",
    status: "active",
    color: "#F97316",
    createdAt: "01-08-2025"
  },
  {
    id: "COUNSELLOR-02",
    name: "sravan",
    username: "sravan",
    password: "123456",
    email: "counsellor2@birlainstitute.edu.in",
    phone: "+91 98765 00000",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active",
    color: "#2563EB",
    createdAt: "11-10-2026"
  },
  {
    id: "COUNSELLOR-03",
    name: "P. Sunitha",
    username: "sunitha",
    password: "Password@101",
    email: "sunitha.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00001",
    roleTitle: "Head Admissions Counsellor",
    assignedGrades: "All Grades / Admissions Lead",
    status: "active",
    color: "#EA580C",
    createdAt: "01-06-2025"
  },
  {
    id: "COUNSELLOR-04",
    name: "M. Haritha",
    username: "haritha",
    password: "Password@102",
    email: "haritha.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00002",
    roleTitle: "Primary Wing Counsellor",
    assignedGrades: "Grades 1 to 5",
    status: "active",
    color: "#2563EB",
    createdAt: "01-06-2025"
  },
  {
    id: "COUNSELLOR-05",
    name: "K. Rajesh",
    username: "rajesh",
    password: "Password@103",
    email: "rajesh.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00003",
    roleTitle: "Middle School Counsellor",
    assignedGrades: "Grades 6 to 8",
    status: "active",
    color: "#059669",
    createdAt: "01-06-2025"
  },
  {
    id: "COUNSELLOR-06",
    name: "S. Priya",
    username: "priya",
    password: "Password@104",
    email: "priya.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00004",
    roleTitle: "High School Counsellor",
    assignedGrades: "Grades 9 to 10",
    status: "active",
    color: "#7C3AED",
    createdAt: "15-06-2025"
  },
  {
    id: "COUNSELLOR-07",
    name: "V. Anjali",
    username: "anjali",
    password: "Password@105",
    email: "anjali.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00005",
    roleTitle: "Pre-Primary Counsellor",
    assignedGrades: "Playgroup, Nursery, PP1, PP2",
    status: "active",
    color: "#DB2777",
    createdAt: "15-06-2025"
  },
  {
    id: "COUNSELLOR-08",
    name: "R. Sandeep",
    username: "sandeep",
    password: "Password@106",
    email: "sandeep.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00006",
    roleTitle: "Senior Secondary Counsellor",
    assignedGrades: "Grades 11 to 12 (Science/Comm)",
    status: "active",
    color: "#D97706",
    createdAt: "01-07-2025"
  },
  {
    id: "COUNSELLOR-09",
    name: "T. Kavitha",
    username: "kavitha",
    password: "Password@107",
    email: "kavitha.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00007",
    roleTitle: "International Curriculum Counsellor",
    assignedGrades: "Cambridge / IB Primary & Middle",
    status: "active",
    color: "#0D9488",
    createdAt: "01-07-2025"
  },
  {
    id: "COUNSELLOR-10",
    name: "N. Ramesh",
    username: "ramesh",
    password: "Password@108",
    email: "ramesh.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00008",
    roleTitle: "Special Needs Support Counsellor",
    assignedGrades: "Inclusive Education & Remedial",
    status: "active",
    color: "#4F46E5",
    createdAt: "10-07-2025"
  },
  {
    id: "COUNSELLOR-11",
    name: "D. Sneha",
    username: "sneha",
    password: "Password@109",
    email: "sneha.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00009",
    roleTitle: "Day Boarding & Campus Tour Incharge",
    assignedGrades: "Boarding & Day-Care Facilities",
    status: "active",
    color: "#E11D48",
    createdAt: "15-07-2025"
  },
  {
    id: "COUNSELLOR-12",
    name: "G. Deepa",
    username: "deepa",
    password: "Password@110",
    email: "deepa.counsellor@birlainstitute.edu.in",
    phone: "+91 98765 00010",
    roleTitle: "Parent Relations & Enrollment Officer",
    assignedGrades: "Walk-ins & Telephonic Followups",
    status: "active",
    color: "#0284C7",
    createdAt: "01-08-2025"
  }
];

export const COUNSELLORS_LIST: CounsellorProfile[] = DEFAULT_COUNSELLOR_ACCOUNTS.map(a => ({
  id: a.id,
  name: a.name,
  email: a.email,
  roleTitle: a.roleTitle,
  phone: a.phone,
  color: a.color
}));

export interface DraftReservation {
  tabId?: string;
  counsellorId: string;
  counsellorName?: string;
  enquiryNo: string;
  timestamp: number;
}

const RESERVATIONS_KEY = "sgs_active_draft_reservations";
const HIGHEST_ENQUIRY_KEY = "sgs_highest_enquiry_issued";

// Retrieve unique tab session ID to isolate tabs even when same counsellor is selected
export function getTabSessionId(): string {
  if (typeof window === "undefined") return "tab_default";
  try {
    let id = sessionStorage.getItem("sgs_tab_session_id");
    if (!id) {
      id = "tab_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now();
      sessionStorage.setItem("sgs_tab_session_id", id);
    }
    return id;
  } catch {
    return "tab_default";
  }
}

// Retrieve active reservations across tabs/counsellors (valid for 30 minutes)
export function getActiveDraftReservations(): Record<string, DraftReservation> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(RESERVATIONS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const valid: Record<string, DraftReservation> = {};
    for (const [key, res] of Object.entries(parsed as Record<string, DraftReservation>)) {
      if (res && res.enquiryNo && now - res.timestamp < 30 * 60 * 1000) {
        valid[key] = res;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

// Reserve an enquiry number for a specific counsellor and browser tab while their form is open
export function reserveDraftEnquiryNo(counsellorId: string, enquiryNo: string, counsellorName?: string, tabId?: string) {
  if (typeof window === "undefined" || !counsellorId || !enquiryNo) return;
  try {
    const activeTab = tabId || getTabSessionId();
    const current = getActiveDraftReservations();
    const key = `${activeTab}_${counsellorId.toLowerCase()}`;
    current[key] = {
      tabId: activeTab,
      counsellorId,
      counsellorName,
      enquiryNo,
      timestamp: Date.now()
    };
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(current));
  } catch {}
}

// Release reservation when form saved or cancelled
export function releaseDraftReservation(counsellorId?: string, tabId?: string) {
  if (typeof window === "undefined") return;
  try {
    const activeTab = tabId || getTabSessionId();
    const current = getActiveDraftReservations();
    for (const key of Object.keys(current)) {
      const res = current[key];
      if (
        (activeTab && res?.tabId === activeTab) ||
        (counsellorId && res?.counsellorId?.toLowerCase() === counsellorId.toLowerCase())
      ) {
        delete current[key];
      }
    }
    localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(current));
  } catch {}
}

// Record highest ever issued enquiry number to ensure numbers never step backwards after deletions
export function recordHighestEnquiryNumber(num: number) {
  if (typeof window === "undefined" || isNaN(num) || num <= 0 || num >= 5000) return;
  try {
    const current = parseInt(localStorage.getItem(HIGHEST_ENQUIRY_KEY) || "0", 10);
    if (num > current && num < 5000) {
      localStorage.setItem(HIGHEST_ENQUIRY_KEY, String(num));
    }
  } catch {}
}

export function getNextEnquiryNo(
  enquiries: CounsellingEnquiry[], 
  requestingCounsellorId?: string,
  counsellorCode?: string,
  requestingTabId?: string
): string {
  const currentYear = new Date().getFullYear();
  let maxNum = 0;
  const combined = [...(Array.isArray(enquiries) ? enquiries : [])];
  const occupiedNumbers = new Set<string>();
  const currentTab = requestingTabId || (typeof window !== "undefined" ? getTabSessionId() : "");

  // 1. Scan active memory enquiries
  combined.forEach(e => {
    if (!e || !e.enquiryNo) return;
    const cleanNo = e.enquiryNo.trim().toUpperCase();
    occupiedNumbers.add(cleanNo);
    const match = cleanNo.match(/ENQ-.*-(\d+)/i) || cleanNo.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1] || match[0], 10);
      if (!isNaN(num) && num > maxNum && num < 5000) {
        maxNum = num;
      }
    }
  });

  // 2. Also check raw localStorage to find any newly saved enquiry from other counsellors or tabs
  if (typeof window !== "undefined") {
    let localSavedCount = 0;
    try {
      const raw = localStorage.getItem("it_command_counselling") || localStorage.getItem("it_command_counselling_forms");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(item => {
            if (item && item.enquiryNo) {
              localSavedCount++;
              const cleanNo = item.enquiryNo.trim().toUpperCase();
              occupiedNumbers.add(cleanNo);
              const match = cleanNo.match(/ENQ-.*-(\d+)/i) || cleanNo.match(/(\d+)$/);
              if (match) {
                const num = parseInt(match[1] || match[0], 10);
                if (!isNaN(num) && num > maxNum && num < 5000) {
                  maxNum = num;
                }
              }
            }
          });
        }
      }
    } catch {}

    const totalActiveCount = combined.length + localSavedCount;

    // 3. Scan DELETED enquiries only if there have been saved records, so deleted serial numbers are NEVER reused
    if (totalActiveCount > 0) {
      try {
        const rawDel = localStorage.getItem("sgs_deleted_enquiry_ids");
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            parsedDel.forEach((delItem: string) => {
              if (!delItem) return;
              const cleanDel = String(delItem).trim().toUpperCase();
              occupiedNumbers.add(cleanDel);
              const match = cleanDel.match(/ENQ-.*-(\d+)/i) || cleanDel.match(/(\d+)$/);
              if (match) {
                const num = parseInt(match[1] || match[0], 10);
                if (!isNaN(num) && num > maxNum && num < 5000) {
                  maxNum = num;
                }
              }
            });
          }
        }
      } catch {}

      // 4. Scan highest issued watermark counter (strictly ignore any runaway values)
      try {
        const highestStored = parseInt(localStorage.getItem(HIGHEST_ENQUIRY_KEY) || "0", 10);
        if (highestStored >= 5000) {
          localStorage.removeItem(HIGHEST_ENQUIRY_KEY);
        } else if (!isNaN(highestStored) && highestStored > maxNum) {
          maxNum = highestStored;
        }
      } catch {}
    } else {
      // If 0 active records exist, ensure any stale watermark is wiped
      try {
        localStorage.removeItem(HIGHEST_ENQUIRY_KEY);
      } catch {}
    }

    // 5. Scan active reservations currently being filled by OTHER counsellors or other browser tabs
    try {
      const activeRes = getActiveDraftReservations();
      const myIdLower = (requestingCounsellorId || "").toLowerCase();
      for (const [, res] of Object.entries(activeRes)) {
        if (!res || !res.enquiryNo) continue;
        const isThisTab = Boolean(currentTab && res.tabId === currentTab);
        const isSameCounsellorWithoutTab = Boolean(!currentTab && res.counsellorId?.toLowerCase() === myIdLower);
        
        // If reservation belongs to another tab or another counsellor, reserve candidate without inflating maxNum
        if (!isThisTab && !isSameCounsellorWithoutTab) {
          const resNo = res.enquiryNo.trim().toUpperCase();
          occupiedNumbers.add(resNo);
        }
      }
    } catch {}
  }

  // Find next un-occupied sequential candidate starting from 01
  let candidateNum = maxNum > 0 ? maxNum + 1 : 1;
  const formatPad = (n: number) => n < 100 ? String(n).padStart(2, "0") : String(n);
  let numStr = formatPad(candidateNum);

  let candidateStr = `ENQ-${currentYear}-${numStr}`;

  // Collision guard to ensure number is 100% free
  let guard = 0;
  while (occupiedNumbers.has(candidateStr.trim().toUpperCase()) && guard < 500) {
    candidateNum++;
    const nextPad = formatPad(candidateNum);
    candidateStr = `ENQ-${currentYear}-${nextPad}`;
    guard++;
  }

  return candidateStr;
}

export interface ManagementAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  email: string;
  phone?: string;
  roleTitle: string; // e.g. "Managing Director", "Principal", "Academic Director", "Trustee"
  status: "active" | "inactive";
  color?: string;
  createdAt: string;
  lastLogin?: string;
  notes?: string;
}

export const DEFAULT_MANAGEMENT_ACCOUNTS: ManagementAccount[] = [
  {
    id: "MGMT-01",
    name: "Dr. K. Srinivas Rao",
    username: "director",
    password: "Director@2026",
    email: "director@birla.edu.in",
    roleTitle: "Managing Director & Trustee",
    phone: "+91 99887 76655",
    status: "active",
    color: "#8B5CF6",
    createdAt: "01-01-2025"
  },
  {
    id: "MGMT-02",
    name: "Dr. Shailaja Reddy",
    username: "principal",
    password: "Principal@2026",
    email: "principal@birla.edu.in",
    roleTitle: "Senior Principal & Executive Dean",
    phone: "+91 99887 76656",
    status: "active",
    color: "#EC4899",
    createdAt: "01-01-2025"
  },
  {
    id: "MGMT-03",
    name: "K. Radhika",
    username: "radhika",
    password: "Password@111",
    email: "radhika.mgmt@birla.edu.in",
    roleTitle: "Admissions Management & Audit Lead",
    phone: "+91 98765 00011",
    status: "active",
    color: "#F97316",
    createdAt: "01-01-2025"
  }
];

const DELETED_MGMT_ACCOUNTS_KEY = "sgs_deleted_management_accounts";

export function getDeletedManagementAccountIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_MGMT_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(d => String(d).toLowerCase() !== "radhika");
  } catch {
    return [];
  }
}

export function recordDeletedManagementAccountId(id: string, username?: string): void {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedManagementAccountIds();
    const set = new Set(deleted.map(d => String(d).toLowerCase()));
    if (id) set.add(id.toLowerCase());
    if (username && username.toLowerCase() !== "radhika") set.add(username.toLowerCase());
    localStorage.setItem(DELETED_MGMT_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function mergeWithDefaultManagementAccounts(
  items: ManagementAccount[],
  extraDeletedIds?: string[]
): ManagementAccount[] {
  const localDeleted = getDeletedManagementAccountIds().map(d => d.toLowerCase());
  const extraClean = (extraDeletedIds || []).map(d => String(d).toLowerCase());
  const deletedSet = new Set([...localDeleted, ...extraClean]);
  deletedSet.delete("radhika");

  const existingIds = new Set<string>();
  const existingUsernames = new Set<string>();
  const result: ManagementAccount[] = [];

  if (Array.isArray(items)) {
    items.forEach(acc => {
      if (!acc || !acc.username) return;
      const u = acc.username.trim().toLowerCase();
      const idLower = (acc.id || "").trim().toLowerCase();
      if (deletedSet.has(u) || deletedSet.has(idLower)) return;
      if (existingUsernames.has(u)) return;
      existingIds.add(idLower);
      existingUsernames.add(u);
      result.push({ ...acc, username: u });
    });
  }

  // Also merge items from LocalStorage if present so locally created users are never wiped on refresh
  if (typeof window !== "undefined") {
    try {
      const rawLocal = localStorage.getItem("sgs_management_accounts");
      if (rawLocal) {
        const parsedLocal = JSON.parse(rawLocal);
        if (Array.isArray(parsedLocal)) {
          parsedLocal.forEach(acc => {
            if (!acc || !acc.username) return;
            const u = acc.username.trim().toLowerCase();
            const idLower = (acc.id || "").trim().toLowerCase();
            if (deletedSet.has(u) || deletedSet.has(idLower)) return;
            if (existingUsernames.has(u)) return;
            existingIds.add(idLower);
            existingUsernames.add(u);
            result.push({ ...acc, username: u });
          });
        }
      }
    } catch {}
  }

  DEFAULT_MANAGEMENT_ACCOUNTS.forEach((demo) => {
    const idLower = demo.id.toLowerCase();
    const userLower = demo.username.toLowerCase();
    if (deletedSet.has(idLower) || deletedSet.has(userLower)) return;
    if (!existingIds.has(idLower) && !existingUsernames.has(userLower)) {
      result.push(demo);
      existingIds.add(idLower);
      existingUsernames.add(userLower);
    }
  });

  return result;
}

export function loadManagementAccounts(): ManagementAccount[] {
  if (typeof window === "undefined") return mergeWithDefaultManagementAccounts(DEFAULT_MANAGEMENT_ACCOUNTS);
  try {
    const raw = localStorage.getItem("sgs_management_accounts");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return mergeWithDefaultManagementAccounts(parsed);
      }
    }
  } catch {}
  return mergeWithDefaultManagementAccounts(DEFAULT_MANAGEMENT_ACCOUNTS);
}

export function saveManagementAccounts(accounts: ManagementAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("sgs_management_accounts", JSON.stringify(accounts));
  } catch {}
}

export interface ITStaffAccount {
  id: string;
  name: string;
  username: string;
  password: string;
  email: string;
  phone?: string;
  roleTitle: string;
  allowedFeatures: string[]; // e.g. ["dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"]
  status: "active" | "inactive";
  createdAt: string;
  lastLogin?: string;
  notes?: string;
}

export const DEFAULT_IT_STAFF_ACCOUNTS: ITStaffAccount[] = [
  {
    id: "IT-STAFF-01",
    name: "Suresh Kumar",
    username: "suresh",
    password: "Password@123",
    email: "suresh.it@birla.edu.in",
    roleTitle: "Junior IT Support Specialist",
    allowedFeatures: ["dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"],
    status: "active",
    createdAt: "01-06-2025"
  }
];

export interface ArchivedITStaffAccount extends ITStaffAccount {
  deletedAt: string;
  deletedBy: string;
  workSummary: {
    ticketsHandledCount: number;
    ticketsList?: string[];
    inventoryActionsCount?: number;
    lastActiveDate?: string;
  };
}


