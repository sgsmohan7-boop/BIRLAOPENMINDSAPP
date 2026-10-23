import { Ticket, InventoryItem, Room, EmployeeAllocation, WarrantyContract, SchoolBranch, CounsellingEnquiry, CounsellorAccount, DEFAULT_COUNSELLOR_ACCOUNTS, ITStaffAccount, DEFAULT_IT_STAFF_ACCOUNTS, ArchivedITStaffAccount } from "../types";

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
    admissionStatus: "Interested",
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

  for (const rawItem of items) {
    if (!rawItem) continue;
    const item = { ...rawItem };
    const idKey = (item.id || "").trim().toLowerCase();
    const noKey = (item.enquiryNo || "").trim().toLowerCase();

    if (!idKey && !noKey) continue;

    const existingIndex = result.findIndex(existing => {
      const eId = (existing.id || "").trim().toLowerCase();
      const eNo = (existing.enquiryNo || "").trim().toLowerCase();
      return (idKey && eId === idKey) || (noKey && eNo && eNo === noKey);
    });

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const merged: CounsellingEnquiry = {
        ...existing,
        ...item,
        audioRecording: item.audioRecording || existing.audioRecording
      };
      if (!merged.id || (item.id && item.id.length >= existing.id.length)) {
        merged.id = item.id || existing.id;
      }
      if (!merged.enquiryNo) {
        merged.enquiryNo = item.enquiryNo || existing.enquiryNo;
      }
      result[existingIndex] = merged;
    } else {
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

  // 1. First prioritize active saved items in LocalStorage if present
  let raw = typeof window !== "undefined" ? localStorage.getItem(KEYS.COUNSELLING) : null;
  if (!raw && typeof window !== "undefined") {
    raw = localStorage.getItem("it_command_counselling_forms");
  }

  if (raw !== null) {
    try {
      const loaded = JSON.parse(raw);
      if (Array.isArray(loaded)) {
        // Clear stale wiped flags if loaded has items
        if (loaded.length > 0 && typeof window !== "undefined") {
          localStorage.removeItem("sgs_counselling_is_wiped");
          localStorage.removeItem("sgs_database_is_wiped");
          localStorage.removeItem("sgs_wiping_database");
          loaded.forEach(item => {
            if (item) unmarkDeletedEnquiryId(item.id, item.enquiryNo);
          });
        }
        return deduplicateEnquiries(loaded);
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
    delete (copyRec as any).audioData;
    if (!copyRec.driveFileUrl && copyRec.fileName) {
      copyRec.driveFileUrl = `/api/audios/${copyRec.fileName}`;
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
    // Actively unmark every saved enquiry from deleted set
    deduped.forEach(item => {
      if (item) unmarkDeletedEnquiryId(item.id, item.enquiryNo);
    });
  }

  try {
    const safeList = deduped.map(cleanEnquiryForStorage);
    localStorage.setItem(KEYS.COUNSELLING, JSON.stringify(safeList));
    localStorage.setItem("it_command_counselling_forms", JSON.stringify(safeList));
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
      localStorage.setItem("it_command_counselling_forms", JSON.stringify(stripped));
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
    // Ensure radhika and counsellor-01 are protected and cleaned from local deleted set
    const cleaned = parsed.filter(d => {
      const lower = String(d).toLowerCase();
      return lower !== "radhika" && lower !== "counsellor-01";
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
    const deleted = getDeletedCounsellorAccountIds();
    const set = new Set(deleted.map(d => d.toLowerCase()));
    if (id && id.toLowerCase() !== "counsellor-01") set.add(id.toLowerCase());
    if (username && username.toLowerCase() !== "radhika") set.add(username.toLowerCase());
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const recordDeletedCounsellorAccountIds = (ids: string[]) => {
  if (typeof window === "undefined" || !Array.isArray(ids)) return;
  try {
    const deleted = getDeletedCounsellorAccountIds();
    const set = new Set(deleted.map(d => d.toLowerCase()));
    ids.forEach(i => {
      if (i) {
        const lower = String(i).toLowerCase();
        if (lower !== "radhika" && lower !== "counsellor-01") {
          set.add(lower);
        }
      }
    });
    localStorage.setItem(DELETED_ACCOUNTS_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const mergeWithDefaultCounsellorAccounts = (
  items: CounsellorAccount[],
  extraDeletedIds?: string[]
): CounsellorAccount[] => {
  const localDeleted = getDeletedCounsellorAccountIds().map(d => d.toLowerCase());
  const extraClean = (extraDeletedIds || []).map(d => String(d).toLowerCase());
  const deletedSet = new Set([...localDeleted, ...extraClean]);
  // Never treat main radhika account as deleted
  deletedSet.delete("radhika");
  deletedSet.delete("counsellor-01");

  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const result: CounsellorAccount[] = [];

  const addAccount = (acc: CounsellorAccount) => {
    if (!acc || !acc.username) return;
    const userLower = acc.username.trim().toLowerCase();
    const idLower = (acc.id || "").trim().toLowerCase();

    // Skip if explicitly deleted by user action
    if (deletedSet.has(idLower) || deletedSet.has(userLower)) return;

    // Skip if username is already present (preserves user updates & deactivations)
    if (seenUsernames.has(userLower)) return;

    // Pin canonical IDs for primary accounts
    let finalId = (acc.id || "").trim();
    if (userLower === "radhika") {
      finalId = "COUNSELLOR-01";
    } else if (userLower === "sravan") {
      finalId = "COUNSELLOR-02";
    }

    // Ensure unique ID across all accounts if ID is missing or collides
    if (!finalId || seenIds.has(finalId.toLowerCase())) {
      let num = 1;
      while (seenIds.has(`counsellor-${String(num).padStart(2, "0")}`)) {
        num++;
      }
      finalId = `COUNSELLOR-${String(num).padStart(2, "0")}`;
    }

    seenIds.add(finalId.toLowerCase());
    seenUsernames.add(userLower);
    result.push({
      ...acc,
      id: finalId,
      username: userLower,
      name: acc.name ? acc.name.trim() : (userLower === "radhika" ? "K. Radhika" : userLower === "sravan" ? "sravan" : userLower)
    });
  };

  // 1. Process custom or dynamic items passed in FIRST (from state, local storage, server, or Firestore)
  // This ensures user edits, status toggles (active -> inactive), and credential updates take priority!
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

  return result;
};

export const loadCounsellorAccounts = (): CounsellorAccount[] => {
  const isWiped = typeof window !== "undefined" && localStorage.getItem("sgs_wiping_database") === "true";
  if (isWiped) return [];

  const raw = typeof window !== "undefined" ? localStorage.getItem(KEYS.COUNSELLOR_ACCOUNTS) : null;
  if (!raw) {
    const initial = mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS);
    if (typeof window !== "undefined") {
      try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(initial)); } catch {}
    }
    return initial;
  }

  try {
    const loaded = JSON.parse(raw);
    if (!Array.isArray(loaded) || loaded.length === 0) {
      const initial = mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS);
      if (typeof window !== "undefined") {
        try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(initial)); } catch {}
      }
      return initial;
    }

    // Always merge in default counsellor accounts so old accounts never disappear when adding a new account
    const merged = mergeWithDefaultCounsellorAccounts(loaded);
    if (merged.length !== loaded.length && typeof window !== "undefined") {
      try { localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(merged)); } catch {}
    }
    return merged;
  } catch {
    return mergeWithDefaultCounsellorAccounts(DEFAULT_COUNSELLOR_ACCOUNTS);
  }
};

export const saveCounsellorAccounts = (accounts: CounsellorAccount[]) => {
  localStorage.setItem(KEYS.COUNSELLOR_ACCOUNTS, JSON.stringify(accounts));
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

