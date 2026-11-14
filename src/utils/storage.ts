import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, SchoolBranch, CounsellingEnquiry, CounsellorAccount, DEFAULT_COUNSELLOR_ACCOUNTS, ITStaffAccount, DEFAULT_IT_STAFF_ACCOUNTS, ArchivedITStaffAccount } from "../types";
import { isObsoleteOrDuplicateCounsellorAccount, normalizeCounsellorIdentity, normalizeEnquiryCounsellor, CANONICAL_COUNSELLORS, cleanAndNormalizeCounsellorAccounts } from "./counsellorNormalizer";
import { isSameStudentRecord } from "./enquirySynthesis";

export const DEMO_COUNSELLING: CounsellingEnquiry[] = [
  {
    id: "ENQ-2026-02",
    enquiryNo: "ENQ-2026-02",
    date: new Date().toISOString().slice(0, 10),
    studentName: "Sravan",
    applyingForClass: "Class 5",
    dateOfBirth: "2015-05-15",
    gender: "Male",
    fatherName: "Sravan Kumar",
    motherName: "Sravan Parent",
    contactNo: "9876543210",
    whatsappNo: "9876543210",
    previousSchool: "Birla Open Minds International School",
    previousClass: "Class 4",
    heardAboutSchool: ["Google/Online", "Reference"],
    reasonForChoosing: "Good academic curriculum and sports infrastructure",
    preferredContact: "Call",
    bestTimeToContact: "Morning 10 AM",
    academicPerformance: "Above Average",
    studentInterests: "Mathematics & Cricket",
    strengths: "Quick Learner",
    areasNeedingSupport: "Spoken English",
    transportRequired: true,
    hostelRequired: false,
    specialLearningSupport: false,
    specialLearningDetails: "",
    pointsDiscussed: "Discussed fee structure, bus routes, CBSE curriculum and term installment options.",
    counsellorObservations: "Parents are keen to finalize admission for Class 5.",
    explainedSchoolFacilities: true,
    explainedAcademicProgramme: true,
    explainedFeeStructure: true,
    explainedTransportDetails: true,
    explainedSchoolRules: true,
    explainedActivitiesSports: true,
    admissionStatus: "Follow-up Required",
    followUpDate: new Date().toISOString().slice(0, 10),
    counsellorId: "COUNSELLOR-02",
    counsellorName: "sravan",
    parentSignatureRecorded: true,
    parentSpokenLanguage: "English / Regional",
    officeRemarks: "Parent meeting completed. Parent inquired regarding Class 5 admissions, fee structure, installments and school bus transport routes.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "ENQ-2026-01",
    enquiryNo: "ENQ-2026-01",
    date: new Date().toISOString().slice(0, 10),
    studentName: "Radhika",
    applyingForClass: "Class 1",
    dateOfBirth: "2019-08-20",
    gender: "Female",
    fatherName: "Radhika Father",
    motherName: "Radhika Mother",
    contactNo: "9123456789",
    whatsappNo: "9123456789",
    previousSchool: "Kindergarten Preschool",
    previousClass: "UKG",
    heardAboutSchool: ["Website", "Existing Parent"],
    reasonForChoosing: "Proximity to home and excellent early childhood program",
    preferredContact: "WhatsApp",
    bestTimeToContact: "Evening 5 PM",
    academicPerformance: "Good",
    studentInterests: "Drawing & Music",
    strengths: "Creative and attentive",
    areasNeedingSupport: "None",
    transportRequired: true,
    hostelRequired: false,
    specialLearningSupport: false,
    specialLearningDetails: "",
    pointsDiscussed: "Class 1 syllabus and school timing details.",
    counsellorObservations: "Interested parent.",
    explainedSchoolFacilities: true,
    explainedAcademicProgramme: true,
    explainedFeeStructure: true,
    explainedTransportDetails: true,
    explainedSchoolRules: true,
    explainedActivitiesSports: true,
    admissionStatus: "Follow-up Required",
    followUpDate: new Date().toISOString().slice(0, 10),
    counsellorId: "COUNSELLOR-01",
    counsellorName: "radhika",
    parentSignatureRecorded: true,
    parentSpokenLanguage: "English / Regional",
    officeRemarks: "Primary enquiry for Class 1 admission.",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const DEMO_INVENTORY: InventoryItem[] = [
  {
    id: "INV-1001",
    itemName: "Dell OptiPlex 7090 Desktop",
    assetType: "Fixed Asset (Need Serials)",
    category: "Major Assets",
    totalQty: 25,
    usedQty: 18,
    balanceQty: 7,
    serials: "S/N: DL-40192A, DL-40192B, DL-40192C, DL-40192D",
    vendor: "Dell Tech India Ltd",
    date: "12-04-2025",
    warranty: "3 Years ProSupport",
    remarks: "Initial setup for lab computers",
    logs: "• [12-04-2025 10:00 AM] 📦 Created Master Entry. Added 25 units, 3 Years ProSupport Warranty. Vendor: Dell Tech India Ltd\n• [15-04-2025 02:00 PM] 👤 Assigned 15 units to Lab 1\n• [18-04-2025 11:30 AM] 👤 Assigned 3 units to Accounts Dept"
  },
  {
    id: "INV-1002",
    itemName: "Epson L3210 EcoTank Printer",
    assetType: "Fixed Asset (Need Serials)",
    category: "Printers & Inks",
    totalQty: 8,
    usedQty: 5,
    balanceQty: 3,
    serials: "S/N: EPS-90210A, EPS-90210B",
    vendor: "Birla Printers Corp",
    date: "10-05-2025",
    warranty: "1 Year Standard",
    remarks: "Printers for staff rooms and admin office",
    logs: "• [10-05-2025 09:30 AM] 📦 Created Master Entry. Added 8 units. Vendor: Birla Printers Corp"
  },
  {
    id: "INV-1003",
    itemName: "HP Wired Mouse M100",
    assetType: "Consumable (Count Only)",
    category: "Consumables (Mouse/Keyboard)",
    totalQty: 100,
    usedQty: 85,
    balanceQty: 15,
    serials: "N/A",
    vendor: "Generic IT Spares Ltd",
    date: "01-05-2025",
    warranty: "6 Months Vendor",
    remarks: "Wired USB mice for labs and office desks",
    logs: "• [01-05-2025 08:00 AM] 📦 Created Master Entry. Added 100 units. Vendor: Generic IT Spares Ltd"
  },
  {
    id: "INV-1004",
    itemName: "Crucial 500GB NVMe SSD",
    assetType: "Consumable (Count Only)",
    category: "Spares (RAM/SSD)",
    totalQty: 12,
    usedQty: 10,
    balanceQty: 2, // Low stock warning (< 5 trigger working)
    serials: "N/A",
    vendor: "Tech Hardware Distributors",
    date: "20-05-2025",
    warranty: "3 Years Brand Warranty",
    remarks: "SSDs purchased for system upgrades",
    logs: "• [20-05-2025 11:00 AM] 📦 Created Master Entry. Added 12 units. Vendor: Tech Hardware Distributors"
  }
];

import { SHEET_ALLOCATED_ROOMS } from "./sheetAllocations";

const DEMO_ROOMS: Room[] = SHEET_ALLOCATED_ROOMS;

const DEMO_TICKETS: Ticket[] = [
  {
    id: "TKT-3001",
    issue: "[Santhosh Kumar] Classroom Projector flickering repeatedly during lectures",
    staffName: "Santhosh Kumar",
    actualIssue: "Classroom Projector flickering repeatedly during lectures",
    mobile: "9876543210",
    priority: "High",
    status: "open",
    linkedRoom: "Birla Open Minds International School - Classroom - Room 304 (Grade 10-A)",
    date: "26-05-2026 09:15 AM"
  },
  {
    id: "TKT-3002",
    issue: "[Latha Maam] Computer systems in accounts department won't connect to LAN switch",
    staffName: "Latha Maam",
    actualIssue: "Computer systems in accounts department won't connect to LAN switch",
    mobile: "9123456780",
    priority: "Medium",
    status: "pending",
    linkedRoom: "Birla Open Minds International School - Accounts - Rm 102 (Accounts Desk)",
    date: "25-05-2026 11:45 AM"
  }
];

const DEMO_HISTORY: Ticket[] = [
  {
    id: "TKT-3501",
    issue: "[Prasad Sir] Keyboard keys A, S, D, F are sticky and non-functional",
    staffName: "Prasad Sir",
    actualIssue: "Keyboard keys A, S, D, F are sticky and non-functional",
    mobile: "9440123456",
    priority: "Low",
    status: "resolved",
    linkedRoom: "Birla Open Minds International School - Labs - Lab 1 (Primary Lab)",
    date: "24-05-2026 10:00 AM",
    fixedAt: "24-05-2026 03:30 PM",
    remarks: "Tech: Tech_Rama | HW: HP Wired Keyboard (x1) | Notes: Replaced sticky keyboard with a fresh pack from inventory."
  }
];

const DEMO_ALLOCATIONS: EmployeeAllocation[] = [
  {
    id: "EMP-AST-4001",
    empName: "PRENITHA MAAM",
    itemName: "Epson L3210 EcoTank Printer",
    invId: "INV-1002",
    qty: 1,
    remarks: "S/N: EPS-90210A | Assigned for administrative operations.",
    assignedOn: "15-05-2025 04:00 PM",
    status: "Active"
  },
  {
    id: "EMP-AST-4002",
    empName: "RAMESH CHANDRA",
    itemName: "HP Wired Mouse M100",
    invId: "INV-1003",
    qty: 2,
    remarks: "Spares for classroom desk desktops",
    assignedOn: "18-05-2025 10:30 AM",
    returnedOn: "24-05-2025 01:15 PM",
    status: "Returned",
    condition: "Working"
  }
];

const DEMO_WARRANTY: WarrantyContract[] = [
  {
    id: "WAR-5001",
    itemName: "Dell OptiPlex 7090 Desktop (Major Assets)",
    type: "Hardware Warranty",
    expiryDate: "12-04-2028",
    vendor: "Dell Tech India Ltd",
    registeredOn: "12-04-2025"
  },
  {
    id: "WAR-5002",
    itemName: "HP Wired Mouse M100 (Consumables)",
    type: "Hardware Warranty",
    expiryDate: "01-11-2025",
    vendor: "Generic IT Spares Ltd",
    registeredOn: "01-05-2025"
  },
  {
    id: "WAR-5003",
    itemName: "Epson L3210 EcoTank Printer (Printers & Inks)",
    type: "AMC (Annual Maintenance)",
    expiryDate: "10-06-2026",
    vendor: "Birla Printers Corp",
    registeredOn: "10-05-2025"
  }
];

// Demo/Default fallback structures for initial installations & refreshing
export const DEFAULT_INVENTORY: InventoryItem[] = DEMO_INVENTORY;
export const DEFAULT_ROOMS: Room[] = DEMO_ROOMS;
export const DEFAULT_TICKETS: Ticket[] = DEMO_TICKETS;
export const DEFAULT_HISTORY: Ticket[] = DEMO_HISTORY;
export const DEFAULT_ALLOCATIONS: EmployeeAllocation[] = DEMO_ALLOCATIONS;
export const DEFAULT_WARRANTY: WarrantyContract[] = DEMO_WARRANTY;

const KEYS = {
  INVENTORY: "it_command_inventory",
  ROOMS: "it_command_rooms",
  TICKETS: "it_command_tickets",
  HISTORY: "it_command_history",
  ALLOCATIONS: "it_command_allocations",
  WARRANTY: "it_command_warranty",
  CONFIG: "it_command_config",
  COUNSELLING: "it_command_counselling",
  COUNSELLOR_ACCOUNTS: "it_command_counsellor_accounts"
};

const safeParse = (key: string, defaultData: any) => {
  try {
    const data = localStorage.getItem(key);
    if (!data) return defaultData;
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : defaultData;
  } catch {
    return defaultData;
  }
};

export const loadData = () => {
  const isWiped = typeof window !== "undefined" && (
    localStorage.getItem("sgs_wiping_database") === "true" ||
    localStorage.getItem("sgs_database_is_wiped") === "true"
  );
  if (isWiped) {
    return {
      inventory: safeParse(KEYS.INVENTORY, []),
      rooms: safeParse(KEYS.ROOMS, []),
      tickets: safeParse(KEYS.TICKETS, []),
      history: safeParse(KEYS.HISTORY, []),
      allocations: safeParse(KEYS.ALLOCATIONS, []),
      warranty: safeParse(KEYS.WARRANTY, [])
    };
  }

  const rawInv = typeof window !== "undefined" ? localStorage.getItem(KEYS.INVENTORY) : null;
  const inventory = rawInv !== null ? safeParse(KEYS.INVENTORY, []) : DEMO_INVENTORY;

  const rawRooms = typeof window !== "undefined" ? localStorage.getItem(KEYS.ROOMS) : null;
  const rooms = rawRooms !== null ? safeParse(KEYS.ROOMS, []) : DEMO_ROOMS;

  const rawTickets = typeof window !== "undefined" ? localStorage.getItem(KEYS.TICKETS) : null;
  const tickets = rawTickets !== null ? safeParse(KEYS.TICKETS, []) : DEMO_TICKETS;

  const rawHistory = typeof window !== "undefined" ? localStorage.getItem(KEYS.HISTORY) : null;
  const history = rawHistory !== null ? safeParse(KEYS.HISTORY, []) : DEMO_HISTORY;

  const rawAlloc = typeof window !== "undefined" ? localStorage.getItem(KEYS.ALLOCATIONS) : null;
  const allocations = rawAlloc !== null ? safeParse(KEYS.ALLOCATIONS, []) : DEMO_ALLOCATIONS;

  const rawWarranty = typeof window !== "undefined" ? localStorage.getItem(KEYS.WARRANTY) : null;
  const warranty = rawWarranty !== null ? safeParse(KEYS.WARRANTY, []) : DEMO_WARRANTY;

  return { inventory, rooms, tickets, history, allocations, warranty };
};

export const resetToDefaults = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("sgs_database_is_wiped");
    localStorage.removeItem("sgs_counselling_is_wiped");
  }
  localStorage.setItem(KEYS.INVENTORY, JSON.stringify(DEMO_INVENTORY));
  localStorage.setItem(KEYS.ROOMS, JSON.stringify(DEMO_ROOMS));
  localStorage.setItem(KEYS.TICKETS, JSON.stringify(DEMO_TICKETS));
  localStorage.setItem(KEYS.HISTORY, JSON.stringify(DEMO_HISTORY));
  localStorage.setItem(KEYS.ALLOCATIONS, JSON.stringify(DEMO_ALLOCATIONS));
  localStorage.setItem(KEYS.WARRANTY, JSON.stringify(DEMO_WARRANTY));
  localStorage.setItem(KEYS.COUNSELLING, JSON.stringify(DEMO_COUNSELLING));
  return {
    inventory: DEMO_INVENTORY,
    rooms: DEMO_ROOMS,
    tickets: DEMO_TICKETS,
    history: DEMO_HISTORY,
    allocations: DEMO_ALLOCATIONS,
    warranty: DEMO_WARRANTY,
    counselling: DEMO_COUNSELLING
  };
};

export const clearAllData = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem("sgs_database_is_wiped", "true");
    localStorage.setItem("sgs_counselling_is_wiped", "true");
    localStorage.setItem(KEYS.INVENTORY, JSON.stringify([]));
    localStorage.setItem(KEYS.ROOMS, JSON.stringify([]));
    localStorage.setItem(KEYS.TICKETS, JSON.stringify([]));
    localStorage.setItem(KEYS.HISTORY, JSON.stringify([]));
    localStorage.setItem(KEYS.ALLOCATIONS, JSON.stringify([]));
    localStorage.setItem(KEYS.WARRANTY, JSON.stringify([]));
    localStorage.setItem(KEYS.COUNSELLING, JSON.stringify([]));
  }
  return {
    inventory: [],
    rooms: [],
    tickets: [],
    history: [],
    allocations: [],
    warranty: [],
    counselling: []
  };
};

export const saveData = (data: {
  inventory?: InventoryItem[];
  rooms?: Room[];
  tickets?: Ticket[];
  history?: Ticket[];
  allocations?: EmployeeAllocation[];
  warranty?: WarrantyContract[];
}) => {
  if (data.inventory) localStorage.setItem(KEYS.INVENTORY, JSON.stringify(data.inventory));
  if (data.rooms) localStorage.setItem(KEYS.ROOMS, JSON.stringify(data.rooms));
  if (data.tickets) localStorage.setItem(KEYS.TICKETS, JSON.stringify(data.tickets));
  if (data.history) localStorage.setItem(KEYS.HISTORY, JSON.stringify(data.history));
  if (data.allocations) localStorage.setItem(KEYS.ALLOCATIONS, JSON.stringify(data.allocations));
  if (data.warranty) localStorage.setItem(KEYS.WARRANTY, JSON.stringify(data.warranty));
};

const DELETED_ENQUIRIES_KEY = "sgs_deleted_enquiry_ids";

export const getDeletedEnquiryIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_ENQUIRIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const recordDeletedEnquiryId = (id: string, enquiryNo?: string) => {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedEnquiryIds();
    const set = new Set(current.map((x) => x.toLowerCase()));
    if (id) set.add(id.toLowerCase());
    if (enquiryNo) set.add(enquiryNo.toLowerCase());
    localStorage.setItem(DELETED_ENQUIRIES_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const recordDeletedEnquiryIds = (ids: string[]) => {
  if (typeof window === "undefined" || !Array.isArray(ids)) return;
  try {
    const current = getDeletedEnquiryIds();
    const set = new Set(current.map((x) => x.toLowerCase()));
    ids.forEach((i) => {
      if (i) set.add(String(i).toLowerCase());
    });
    localStorage.setItem(DELETED_ENQUIRIES_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const unmarkDeletedEnquiryId = (id: string, enquiryNo?: string) => {
  if (typeof window === "undefined") return;
  try {
    const current = getDeletedEnquiryIds();
    const idLower = (id || "").toLowerCase();
    const noLower = (enquiryNo || "").toLowerCase();
    const filtered = current.filter(x => {
      const xLower = x.toLowerCase();
      return xLower !== idLower && xLower !== noLower;
    });
    localStorage.setItem(DELETED_ENQUIRIES_KEY, JSON.stringify(filtered));
  } catch {}
};

export const mergeWithDemoEnquiries = (items: CounsellingEnquiry[]): CounsellingEnquiry[] => {
  if (typeof window !== "undefined" && (
    localStorage.getItem("sgs_counselling_is_wiped") === "true" ||
    localStorage.getItem("sgs_database_is_wiped") === "true" ||
    localStorage.getItem(KEYS.COUNSELLING) !== null
  )) {
    const deletedSet = new Set(getDeletedEnquiryIds().map((x) => x.toLowerCase()));
    return (items || []).filter(
      (x) => !deletedSet.has((x.id || "").toLowerCase()) && !deletedSet.has((x.enquiryNo || "").toLowerCase())
    );
  }
  const deletedSet = new Set(getDeletedEnquiryIds().map((x) => x.toLowerCase()));
  const safeItems = (items || []).filter(
    (x) => !deletedSet.has((x.id || "").toLowerCase()) && !deletedSet.has((x.enquiryNo || "").toLowerCase())
  );
  
  const existingIds = new Set(safeItems.map((x) => (x.id || x.enquiryNo || "").toLowerCase()));
  const merged = [...safeItems];
  
  DEMO_COUNSELLING.forEach((demo) => {
    const demoIdLower = (demo.id || "").toLowerCase();
    const demoNoLower = (demo.enquiryNo || "").toLowerCase();
    
    if (
      !deletedSet.has(demoIdLower) &&
      !deletedSet.has(demoNoLower) &&
      !existingIds.has(demoIdLower) &&
      !existingIds.has(demoNoLower)
    ) {
      merged.push(demo);
    }
  });
  
  return merged;
};

export const deduplicateEnquiries = (items: CounsellingEnquiry[]): CounsellingEnquiry[] => {
  if (!Array.isArray(items)) return [];
  const result: CounsellingEnquiry[] = [];
  const usedIds = new Set<string>();

  for (const rawItem of items) {
    if (!rawItem) continue;
    const { normalized } = normalizeEnquiryCounsellor(rawItem);
    const item = { ...normalized };
    const idKey = (item.id || "").trim().toLowerCase();
    const noKey = (item.enquiryNo || "").trim().toLowerCase();

    if (!idKey && !noKey) continue;

    // Only merge with an existing entry if BOTH share the id/enquiryNo AND represent the SAME student
    const existingIndex = result.findIndex(existing => {
      const eId = (existing.id || "").trim().toLowerCase();
      const eNo = (existing.enquiryNo || "").trim().toLowerCase();
      const keyMatches = (idKey && eId === idKey) || (noKey && eNo && eNo === noKey);
      if (!keyMatches) return false;
      const eName = (existing.studentName || "").trim();
      const iName = (item.studentName || "").trim();
      if (!eName || !iName) return true;
      return isSameStudentRecord(existing, item);
    });

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const itemTs = Number(item.updatedAtTimestamp || 0);
      const existingTs = Number(existing.updatedAtTimestamp || 0);
      // First item in list (e.g. live Firestore snapshot / saved record) is authoritative unless fallback has a strictly newer updatedAtTimestamp
      const primary = (itemTs > 0 && itemTs > existingTs) ? item : existing;
      const secondary = primary === existing ? item : existing;

      const mergedAudio = (primary.audioRecording || secondary.audioRecording)
        ? ({
            ...(secondary.audioRecording || {}),
            ...(primary.audioRecording || {}),
            audioData: primary.audioRecording?.audioData || secondary.audioRecording?.audioData,
            translatedAudioData: primary.audioRecording?.translatedAudioData || secondary.audioRecording?.translatedAudioData
          } as any)
        : undefined;

      const merged: CounsellingEnquiry = {
        ...secondary,
        ...primary,
        audioRecording: primary.removeAudio ? undefined : mergedAudio
      };
      if (!merged.id) {
        merged.id = primary.id || secondary.id;
      }
      if (!merged.enquiryNo) {
        merged.enquiryNo = primary.enquiryNo || secondary.enquiryNo;
      }
      result[existingIndex] = merged;
      if (merged.id) usedIds.add(merged.id.trim().toLowerCase());
    } else {
      // If a different student collided on the exact same internal `id`, assign a distinct `id` while preserving `enquiryNo`
      let assignedId = (item.id || item.enquiryNo || "").trim();
      if (assignedId && usedIds.has(assignedId.toLowerCase())) {
        let suffix = 2;
        const baseId = assignedId;
        assignedId = `${baseId}__${suffix}`;
        while (usedIds.has(assignedId.toLowerCase())) {
          suffix++;
          assignedId = `${baseId}__${suffix}`;
        }
        item.id = assignedId;
      }
      if (assignedId) usedIds.add(assignedId.toLowerCase());
      result.push(item);
    }
  }

  return result;
};

export const loadCounselling = (): CounsellingEnquiry[] => {
  if (typeof window !== "undefined") {
    if (!localStorage.getItem("sgs_clean_no_demo_audios_v2026_04")) {
      try {
        const raw = localStorage.getItem(KEYS.COUNSELLING);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.map((e: any) => {
              if (
                e.audioRecording?.id === "AUDIO-ENQ-2026-02-sravan" ||
                e.audioRecording?.id === "AUDIO-ENQ-2026-01-radhika" ||
                e.audioRecording?.audioUrl?.includes("/api/counselling/audio/")
              ) {
                const copy = { ...e };
                delete copy.audioRecording;
                return copy;
              }
              return e;
            });
            localStorage.setItem(KEYS.COUNSELLING, JSON.stringify(cleaned));
          }
        }
        localStorage.setItem("sgs_clean_no_demo_audios_v2026_04", "true");
      } catch {}
    }
  }

  // 1. First prioritize active saved items in LocalStorage if present (migrate & drop legacy duplicate key)
  let raw = typeof window !== "undefined" ? localStorage.getItem(KEYS.COUNSELLING) : null;
  if (typeof window !== "undefined") {
    const legacyRaw = localStorage.getItem("it_command_counselling_forms");
    if (!raw && legacyRaw) {
      raw = legacyRaw;
      try { localStorage.setItem(KEYS.COUNSELLING, legacyRaw); } catch {}
    }
    if (legacyRaw !== null) {
      try { localStorage.removeItem("it_command_counselling_forms"); } catch {}
    }
  }

  if (raw !== null) {
    try {
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        // Filter out any explicitly deleted enquiry IDs
        const deletedSet = new Set(getDeletedEnquiryIds().map((x) => x.toLowerCase()));
        const nonDeletedLoaded = loaded.filter(
          (item) => item && 
            (!item.id || !deletedSet.has(item.id.toLowerCase())) && 
            (!item.enquiryNo || !deletedSet.has(item.enquiryNo.toLowerCase()))
        );

        if (nonDeletedLoaded.length > 0 && typeof window !== "undefined") {
          localStorage.removeItem("sgs_counselling_is_wiped");
          localStorage.removeItem("sgs_database_is_wiped");
          localStorage.removeItem("sgs_wiping_database");
        }
        return deduplicateEnquiries(nonDeletedLoaded);
      }
    } catch {}
  }

  // 2. If wiped flag is actively set and no new records were saved, return empty array
  const isWiped = typeof window !== "undefined" && (
    localStorage.getItem("sgs_wiping_database") === "true" ||
    localStorage.getItem("sgs_counselling_is_wiped") === "true" ||
    localStorage.getItem("sgs_database_is_wiped") === "true"
  );
  if (isWiped) return [];

  // 3. Production school portal: Never resurrect demo enquiries when database is empty or forms are deleted
  const deletedSet = new Set(getDeletedEnquiryIds().map((x) => x.toLowerCase()));
  if (deletedSet.size > 0 || (typeof window !== "undefined" && localStorage.getItem("sgs_counselling_init_done") === "true")) {
    return [];
  }

  // 4. Clean zero-state fallback
  return [];
};

export const cleanEnquiryForStorage = (item: CounsellingEnquiry): CounsellingEnquiry => {
  if (!item) return item;
  if (item.audioRecording) {
    const copyRec = { ...item.audioRecording };
    const hasExternalOrIdbRef = Boolean(
      copyRec.storageKey ||
      copyRec.driveFileUrl ||
      copyRec.audioUrl ||
      copyRec.fileName
    );
    // Full audio lives in IndexedDB / Cloudflare R2 / Drive / Server; strip base64 blobs > 32KB (or when backed externally) to prevent 5MB localStorage overflow
    if (copyRec.audioData && typeof copyRec.audioData === "string" && (hasExternalOrIdbRef || copyRec.audioData.length > 32 * 1024)) {
      delete (copyRec as any).audioData;
    }
    // Only set /api/audios/ fallback if running on local dev server
    const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (!copyRec.driveFileUrl && copyRec.fileName && isLocal) {
      copyRec.driveFileUrl = `/api/audios/${encodeURIComponent(copyRec.fileName)}`;
    }
    return { ...item, audioRecording: copyRec };
  }
  return item;
};

export const saveCounselling = (enquiries: CounsellingEnquiry[]) => {
  if (typeof window === "undefined") return;

  const deduped = deduplicateEnquiries(enquiries);

  // Clear wiped flags whenever user saves records so refreshes preserve data
  if (deduped && deduped.length > 0) {
    localStorage.removeItem("sgs_counselling_is_wiped");
    localStorage.removeItem("sgs_database_is_wiped");
    localStorage.removeItem("sgs_wiping_database");
  }

  // Always remove legacy duplicate keys first to free browser 5MB localStorage quota
  try {
    localStorage.removeItem("it_command_counselling_forms");
    localStorage.removeItem("parent_self_entries");
  } catch {}

  try {
    const safeList = deduped.map(cleanEnquiryForStorage);
    localStorage.setItem(KEYS.COUNSELLING, JSON.stringify(safeList));
  } catch (err) {
    try {
      const stripped = deduped.map(e => {
        const c = { ...e };
        if (c.audioRecording) {
          c.audioRecording = { ...c.audioRecording };
          delete (c.audioRecording as any).audioData;
        }
        return c;
      });
      localStorage.setItem(KEYS.COUNSELLING, JSON.stringify(stripped));
    } catch {}
  }
};

const DELETED_ACCOUNTS_KEY = "sgs_deleted_counsellor_accounts";

export const getDeletedCounsellorAccountIds = (): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Protect core staff accounts from local deletion state
    const PROTECTED_CORE = new Set([
      "radhika", "counsellor-01",
      "sravan", "counsellor-02",
      "sowjanya", "counsellor-03",
      "kavya", "counsellor-04",
      "test", "counsellor-05"
    ]);
    const cleaned = parsed.filter(d => {
      const lower = String(d).toLowerCase();
      return !PROTECTED_CORE.has(lower);
    });
    if (cleaned.length !== parsed.length) {
      localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
};

export const recordDeletedCounsellorAccountId = (id: string, username?: string) => {
  if (typeof window === "undefined") return;
  try {
    const PROTECTED_CORE = new Set([
      "radhika", "counsellor-01",
      "sravan", "counsellor-02",
      "sowjanya", "counsellor-03",
      "kavya", "counsellor-04",
      "test", "counsellor-05"
    ]);
    const deleted = getDeletedCounsellorAccountIds();
    const set = new Set(deleted.map(d => d.toLowerCase()));
    if (id && !PROTECTED_CORE.has(id.toLowerCase())) set.add(id.toLowerCase());
    if (username && !PROTECTED_CORE.has(username.toLowerCase())) set.add(username.toLowerCase());
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const recordDeletedCounsellorAccountIds = (ids: string[]) => {
  if (typeof window === "undefined" || !Array.isArray(ids)) return;
  try {
    const PROTECTED_CORE = new Set([
      "radhika", "counsellor-01",
      "sravan", "counsellor-02",
      "sowjanya", "counsellor-03",
      "kavya", "counsellor-04",
      "test", "counsellor-05"
    ]);
    const deleted = getDeletedCounsellorAccountIds();
    const set = new Set(deleted.map(d => d.toLowerCase()));
    ids.forEach(i => {
      if (i) {
        const lower = String(i).toLowerCase();
        if (!PROTECTED_CORE.has(lower)) {
          set.add(lower);
        }
      }
    });
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const unrecordDeletedCounsellorAccountId = (id: string, username?: string) => {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedCounsellorAccountIds();
    const idLower = (id || "").toLowerCase();
    const uLower = (username || "").toLowerCase();
    const cleaned = deleted.filter(d => d !== idLower && d !== uLower);
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(cleaned));
  } catch {}
};


export const mergeWithDefaultCounsellorAccounts = (
  items: CounsellorAccount[],
  extraDeletedIds?: string[]
): CounsellorAccount[] => {
  const localDeleted = getDeletedCounsellorAccountIds().map(d => d.toLowerCase());
  const extraClean = (extraDeletedIds || []).map(d => String(d).toLowerCase());
  const deletedSet = new Set([...localDeleted, ...extraClean]);

  // Permanently blacklist obsolete duplicate alias accounts from ever showing up
  deletedSet.add("r sowjanya");
  deletedSet.add("rsowjanya");
  deletedSet.add("r.sowjanya");
  deletedSet.add("r_sowjanya");
  deletedSet.add("kavyarao");

  // Never treat core staff as deleted
  deletedSet.delete("radhika");
  deletedSet.delete("counsellor-01");
  deletedSet.delete("sravan");
  deletedSet.delete("counsellor-02");
  deletedSet.delete("sowjanya");
  deletedSet.delete("counsellor-03");
  deletedSet.delete("kavya");
  deletedSet.delete("counsellor-04");
  deletedSet.delete("test");
  deletedSet.delete("counsellor-05");

  const seenIds = new Set<string>();
  const seenUsernames = new Map<string, string>(); // username -> account ID
  const result: CounsellorAccount[] = [];

  const addAccount = (acc: CounsellorAccount) => {
    if (!acc || !acc.username) return;
    if (isObsoleteOrDuplicateCounsellorAccount(acc)) return;

    let userLower = acc.username.trim().toLowerCase();
    const idLower = (acc.id || "").trim().toLowerCase();
    const nameLower = (acc.name || "").trim().toLowerCase();

    // Deduplicate any Sowjanya variation into canonical 'sowjanya'
    if (
      userLower === "sowjanya" || 
      userLower.includes("sowjanya") || 
      nameLower.includes("sowjanya") || 
      idLower === "counsellor-03"
    ) {
      userLower = "sowjanya";
    }

    // Deduplicate any Kavya variation into canonical 'kavya'
    if (
      userLower === "kavya" || 
      userLower.includes("kavya") || 
      nameLower.includes("kavya") || 
      idLower === "counsellor-04"
    ) {
      userLower = "kavya";
    }

    // Skip if explicitly deleted by user action
    if (deletedSet.has(idLower) || deletedSet.has(userLower)) return;

    // Pin canonical IDs for primary accounts
    let finalId = (acc.id || "").trim();
    if (userLower === "radhika") {
      finalId = "COUNSELLOR-01";
    } else if (userLower === "sravan") {
      finalId = "COUNSELLOR-02";
    } else if (userLower === "sowjanya") {
      finalId = "COUNSELLOR-03";
    } else if (userLower === "kavya") {
      finalId = "COUNSELLOR-04";
    } else if (userLower === "test") {
      finalId = "COUNSELLOR-05";
    }

    // If ID or username already registered from a higher priority source, skip to avoid duplicates/overwriting
    if (seenIds.has(finalId.toLowerCase()) || seenUsernames.has(userLower)) {
      return;
    }

    // Ensure unique ID across all accounts if ID is missing
    if (!finalId) {
      let num = 1;
      while (seenIds.has(`counsellor-${String(num).padStart(2, "0")}`)) {
        num++;
      }
      finalId = `COUNSELLOR-${String(num).padStart(2, "0")}`;
    }

    seenIds.add(finalId.toLowerCase());
    seenUsernames.set(userLower, finalId.toLowerCase());
    result.push({
      ...acc,
      id: finalId,
      username: userLower,
      name: userLower === "sowjanya" ? "sowjanya" : userLower === "kavya" ? "kavya rao" : acc.name ? acc.name.trim() : (userLower === "radhika" ? "RADHIKA DAS V" : userLower === "sravan" ? "sravan" : userLower),
      password: userLower === "sowjanya" ? (acc.password || "12345") : userLower === "kavya" ? (acc.password || "12345") : acc.password
    });
  };

  // 1. Process custom or dynamic items passed in FIRST (from state, local storage, server, or Firestore)
  if (Array.isArray(items)) {
    items.forEach(addAccount);
  }

  // 2. Also merge items from LocalStorage if present so locally created users are never wiped on refresh
  if (typeof window !== "undefined") {
    try {
      const rawLocal = localStorage.getItem(KEYS.COUNSELLOR_ACCOUNTS);
      if (rawLocal) {
        const parsedLocal = JSON.parse(rawLocal);
        if (Array.isArray(parsedLocal)) {
          parsedLocal.forEach(addAccount);
        }
      }
    } catch {}
  }

  // 3. Process default counsellor accounts THIRD to populate any remaining un-edited default accounts
  DEFAULT_COUNSELLOR_ACCOUNTS.forEach(addAccount);

  return cleanAndNormalizeCounsellorAccounts(result);
};

export const loadCounsellorAccounts = (): CounsellorAccount[] => {
  const isWiped = typeof window !== "undefined" && localStorage.getItem("sgs_wiping_database") === "true";
  if (isWiped) return [];

  const raw = typeof window !== "undefined" ? localStorage.getItem(KEYS.COUNSELLOR_ACCOUNTS) : null;
  if (!raw) {
    const initial = mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS);
    const cleaned = cleanAndNormalizeCounsellorAccounts(initial);
    if (typeof window !== "undefined") {
      try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(cleaned)); } catch {}
    }
    return cleaned;
  }

  try {
    const loaded = JSON.parse(raw);
    if (!Array.isArray(loaded) || loaded.length === 0) {
      const initial = mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS);
      const cleaned = cleanAndNormalizeCounsellorAccounts(initial);
      if (typeof window !== "undefined") {
        try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(cleaned)); } catch {}
      }
      return cleaned;
    }

    // Always merge in default counsellor accounts and clean duplicates
    const merged = mergeWithDefaultCounsellorAccounts(loaded);
    const cleaned = cleanAndNormalizeCounsellorAccounts(merged);
    if (typeof window !== "undefined") {
      try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(cleaned)); } catch {}
    }
    return cleaned;
  } catch {
    return cleanAndNormalizeCounsellorAccounts(mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS));
  }
};

export const saveCounsellorAccounts = (accounts: CounsellorAccount[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(accounts));
    window.dispatchEvent(new CustomEvent("counsellor_accounts_updated", { detail: accounts }));
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("birla_accounts_sync");
      channel.postMessage({ type: "COUNSELLORS_SYNC", accounts });
      channel.close();
    }
  } catch {}
};

const parseAbsoluteDateStr = (str: string): string | null => {
  if (!str) return null;
  const clean = str.replace(/[\/\.]/g, "-").trim();
  
  // Search for DD-MM-YYYY or DD-MM-YY anywhere in the string
  const dmyMatch = clean.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) {
      year = year < 70 ? 2000 + year : 1900 + year;
    }
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${dd}-${mm}-${year}`;
    }
  }

  // Search for YYYY-MM-DD
  const ymdMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    let month = parseInt(ymdMatch[2], 10);
    let day = parseInt(ymdMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      const dd = String(day).padStart(2, "0");
      const mm = String(month).padStart(2, "0");
      return `${dd}-${mm}-${year}`;
    }
  }

  return null;
};

/**
 * Helper to calculate warranty expiry date from purchase date (DD-MM-YYYY) and a warranty text string.
 */
export const calculateExpiryDate = (purchaseDateStr: string, warrantyStr: string): string => {
  if (!purchaseDateStr || typeof purchaseDateStr !== "string") return purchaseDateStr;

  const wClean = (warrantyStr || "").toLowerCase().trim();
  if (
    !wClean || 
    wClean.includes("no warranty") || 
    wClean.includes("no warrenty") || 
    wClean === "none" || 
    wClean === "no" || 
    wClean === "unprotected" || 
    wClean === "n/a" || 
    wClean === "na" || 
    wClean === "nil" ||
    wClean.includes("no active")
  ) {
    // Return same date representing no warranty cover
    return purchaseDateStr;
  }

  // Check if warrantyStr itself contains an absolute date
  const absoluteDate = parseAbsoluteDateStr(warrantyStr);
  if (absoluteDate) {
    return absoluteDate;
  }

  // Split date by "/" or "-"
  const delimiter = purchaseDateStr.includes("/") ? "/" : "-";
  const parts = purchaseDateStr.split(delimiter);
  if (parts.length !== 3) return purchaseDateStr;

  let day = parseInt(parts[0].trim(), 10);
  let month = parseInt(parts[1].trim(), 10) - 1; // 0-indexed months
  let year = parseInt(parts[2].trim(), 10);

  // If format is YYYY-MM-DD (fallback)
  if (parts[0].length === 4) {
    year = parseInt(parts[0].trim(), 10);
    month = parseInt(parts[1].trim(), 10) - 1;
    day = parseInt(parts[2].trim(), 10);
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return purchaseDateStr;

  const d = new Date(year, month, day);

  // Parse first digit group
  const numMatch = wClean.match(/(\d+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (wClean.includes("month") || wClean.includes("mon") || (wClean.includes("m") && !wClean.includes("year") && !wClean.includes("y"))) {
      d.setMonth(d.getMonth() + num);
    } else {
      // Default to years
      d.setFullYear(d.getFullYear() + num);
    }
  } else {
    // If warranty text is non-empty but doesn't have a number, e.g. "Brand Warranty", default to 1 year
    d.setFullYear(d.getFullYear() + 1);
  }

  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const getAllowCounsellorMultiDelete = (): boolean => {
  if (typeof window !== "undefined") {
    const val = localStorage.getItem("sgs_allow_counsellor_multi_delete");
    if (val !== null) return val === "true";
  }
  return false; // Default disabled for Counsellors until Super Admin enables it
};

export const setAllowCounsellorMultiDelete = (enabled: boolean): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem("sgs_allow_counsellor_multi_delete", String(enabled));
  }
};

const DELETED_IT_STAFF_ACCOUNTS_KEY = "sgs_deleted_it_staff_accounts";

export function getDeletedITStaffAccountIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DELETED_IT_STAFF_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(d => String(d).toLowerCase());
  } catch {
    return [];
  }
}

export function recordDeletedITStaffAccountId(id: string, username?: string): void {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedITStaffAccountIds();
    const set = new Set(deleted.map(d => String(d).toLowerCase()));
    if (id) set.add(id.toLowerCase());
    if (username) set.add(username.toLowerCase());
    localStorage.setItem(DELETED_IT_STAFF_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

export function unrecordDeletedITStaffAccountId(id: string, username?: string): void {
  if (typeof window === "undefined") return;
  try {
    const deleted = getDeletedITStaffAccountIds();
    const cleanId = (id || "").toLowerCase();
    const cleanUname = (username || "").toLowerCase();
    const filtered = deleted.filter(d => d !== cleanId && d !== cleanUname);
    localStorage.setItem(DELETED_IT_STAFF_ACCOUNTS_KEY, JSON.stringify(filtered));
  } catch {}
}

export function mergeWithDefaultITStaffAccounts(
  items: ITStaffAccount[],
  extraDeletedIds?: string[]
): ITStaffAccount[] {
  const localDeleted = getDeletedITStaffAccountIds().map(d => d.toLowerCase());
  const extraClean = (extraDeletedIds || []).map(d => String(d).toLowerCase());
  const deletedSet = new Set([...localDeleted, ...extraClean]);

  const existingIds = new Set<string>();
  const existingUsernames = new Set<string>();
  const result: ITStaffAccount[] = [];

  const addAccount = (acc: ITStaffAccount) => {
    if (!acc || !acc.username) return;
    const u = acc.username.trim().toLowerCase();
    if (deletedSet.has(u)) return;

    let id = (acc.id || "").trim();
    let idLower = id.toLowerCase();
    if (deletedSet.has(idLower)) return;

    if (existingUsernames.has(u)) return;

    if (!id || existingIds.has(idLower)) {
      id = `IT-STAFF-${String(result.length + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4)}`;
      idLower = id.toLowerCase();
    }

    existingIds.add(idLower);
    existingUsernames.add(u);
    result.push({ ...acc, id, username: u });
  };

  if (Array.isArray(items)) {
    items.forEach(addAccount);
  }

  // Also merge items from LocalStorage if present so locally created users are never wiped on refresh
  if (typeof window !== "undefined") {
    try {
      const rawLocal = localStorage.getItem("sgs_it_staff_accounts");
      if (rawLocal) {
        const parsedLocal = JSON.parse(rawLocal);
        if (Array.isArray(parsedLocal)) {
          parsedLocal.forEach(addAccount);
        }
      }
    } catch {}
  }

  DEFAULT_IT_STAFF_ACCOUNTS.forEach((demo) => {
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

export function loadITStaffAccounts(): ITStaffAccount[] {
  if (typeof window === "undefined") return mergeWithDefaultITStaffAccounts(DEFAULT_IT_STAFF_ACCOUNTS);
  try {
    const raw = localStorage.getItem("sgs_it_staff_accounts");
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return mergeWithDefaultITStaffAccounts(parsed);
      }
    }
  } catch {}
  return mergeWithDefaultITStaffAccounts([]);
}

export function saveITStaffAccounts(accounts: ITStaffAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    const merged = mergeWithDefaultITStaffAccounts(accounts);
    localStorage.setItem("sgs_it_staff_accounts", JSON.stringify(merged));
  } catch {}
}

export function loadArchivedITStaffAccounts(): ArchivedITStaffAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("sgs_archived_it_staff_accounts");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveArchivedITStaffAccounts(accounts: ArchivedITStaffAccount[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("sgs_archived_it_staff_accounts", JSON.stringify(accounts));
  } catch {}
}

export function getDismissedParentEntryIds(counsellorId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const rawGlobal = localStorage.getItem("sgs_dismissed_parent_entries");
    const globalList: string[] = rawGlobal ? JSON.parse(rawGlobal) : [];
    if (!counsellorId) return globalList;
    const key = `sgs_dismissed_parent_entries_${counsellorId.toLowerCase()}`;
    const rawLocal = localStorage.getItem(key);
    const localList: string[] = rawLocal ? JSON.parse(rawLocal) : [];
    return Array.from(new Set([...globalList, ...localList]));
  } catch {}
  return [];
}

export function recordDismissedParentEntryId(id: string, counsellorId?: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    if (counsellorId) {
      const key = `sgs_dismissed_parent_entries_${counsellorId.toLowerCase()}`;
      const raw = localStorage.getItem(key);
      const existing: string[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(id)) {
        existing.push(id);
        localStorage.setItem(key, JSON.stringify(existing));
      }
    } else {
      const existing = getDismissedParentEntryIds();
      if (!existing.includes(id)) {
        existing.push(id);
        localStorage.setItem("sgs_dismissed_parent_entries", JSON.stringify(existing));
      }
    }
  } catch {}
}

export function loadParentSelfEntries(counsellorId?: string): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("sgs_parent_self_entries") || localStorage.getItem("parent_self_entries");
    if (localStorage.getItem("parent_self_entries") !== null) {
      try {
        if (!localStorage.getItem("sgs_parent_self_entries") && raw) {
          localStorage.setItem("sgs_parent_self_entries", raw);
        }
        localStorage.removeItem("parent_self_entries");
      } catch {}
    }
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const dismissedSet = new Set(getDismissedParentEntryIds(counsellorId));
        return parsed.map(e => (dismissedSet.has(e.id) ? { ...e, status: "dismissed" } : e));
      }
    }
  } catch {}
  return [];
}

export function saveParentSelfEntries(entries: any[]): void {
  if (typeof window === "undefined" || !Array.isArray(entries)) return;
  try {
    try { localStorage.removeItem("parent_self_entries"); } catch {}
    const serialized = JSON.stringify(entries);
    if (localStorage.getItem("sgs_parent_self_entries") !== serialized) {
      localStorage.setItem("sgs_parent_self_entries", serialized);
    }
  } catch {}
}

export function unrecordDismissedParentEntryId(id: string, counsellorId?: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const rawGlobal = localStorage.getItem("sgs_dismissed_parent_entries");
    if (rawGlobal) {
      const list: string[] = JSON.parse(rawGlobal);
      localStorage.setItem("sgs_dismissed_parent_entries", JSON.stringify(list.filter(x => x !== id)));
    }
    if (counsellorId) {
      const key = `sgs_dismissed_parent_entries_${counsellorId.toLowerCase()}`;
      const rawLocal = localStorage.getItem(key);
      if (rawLocal) {
        const list: string[] = JSON.parse(rawLocal);
        localStorage.setItem(key, JSON.stringify(list.filter(x => x !== id)));
      }
    }
  } catch {}
}

export function saveDismissedParentEntry(entry: any): void {
  if (typeof window === "undefined" || !entry || !entry.id) return;
  try {
    const raw = localStorage.getItem("sgs_archived_dismissed_entries");
    const list: any[] = raw ? JSON.parse(raw) : [];
    const updated = [entry, ...list.filter((e: any) => e.id !== entry.id)];
    localStorage.setItem("sgs_archived_dismissed_entries", JSON.stringify(updated));
  } catch {}
}

export function loadDismissedParentEntries(): any[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("sgs_archived_dismissed_entries");
    return raw ? JSON.parse(raw) : [];
  } catch {}
  return [];
}

export function removeDismissedParentEntryFromArchive(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const raw = localStorage.getItem("sgs_archived_dismissed_entries");
    if (raw) {
      const list: any[] = JSON.parse(raw);
      localStorage.setItem("sgs_archived_dismissed_entries", JSON.stringify(list.filter(e => e.id !== id)));
    }
  } catch {}
}

const UNSYNCED_ENQUIRY_IDS_KEY = "sgs_unsynced_enquiry_ids";

export function getUnsyncedEnquiryIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(UNSYNCED_ENQUIRY_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(x => String(x || "").trim()).filter(Boolean);
    }
  } catch {}
  return [];
}

export function markEnquiryUnsynced(...ids: (string | undefined)[]): void {
  if (typeof window === "undefined") return;
  try {
    const existing = new Set(getUnsyncedEnquiryIds().map(x => x.toLowerCase()));
    ids.forEach(id => {
      if (id && id.trim()) existing.add(id.trim().toLowerCase());
    });
    localStorage.setItem(UNSYNCED_ENQUIRY_IDS_KEY, JSON.stringify(Array.from(existing)));
  } catch {}
}

export function unmarkEnquiryUnsynced(...ids: (string | undefined)[]): void {
  if (typeof window === "undefined") return;
  try {
    const removeSet = new Set(ids.filter(Boolean).map(x => String(x).trim().toLowerCase()));
    if (removeSet.size === 0) return;
    const filtered = getUnsyncedEnquiryIds().filter(x => !removeSet.has(x.toLowerCase()));
    localStorage.setItem(UNSYNCED_ENQUIRY_IDS_KEY, JSON.stringify(filtered));
  } catch {}
}
