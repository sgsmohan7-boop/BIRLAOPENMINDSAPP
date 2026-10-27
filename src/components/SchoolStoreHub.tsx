import React, { useState, useEffect, useMemo, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Store,
  Package,
  Plus,
  Search,
  Send,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  Calendar,
  User,
  School,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Clock,
  History,
  X,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Filter,
  ArrowUpRight,
  Building2,
  Trash2,
  Eye,
  RefreshCw,
  RotateCcw,
  QrCode,
  Edit,
  Check,
  Tag,
  Layers,
  ArrowDownLeft,
  ArrowUpRight as ArrowOut,
  MapPin,
  ClipboardList,
  AlertCircle,
  HelpCircle,
  FileCheck,
  CheckCheck
} from "lucide-react";
import { 
  isFirebaseConfigured, 
  saveDocument, 
  deleteDocument, 
  syncCollection 
} from "../utils/firebase";

// ==========================================
// DATA MODELS & TYPES
// ==========================================

export interface StoreItem {
  id: string;
  itemName: string;
  category: string;
  itemType: "Consumable" | "Fixed Asset / Equipment";
  unit: string; // e.g. Bundles, Pcs, Boxes, Units, Reams, Rolls, Pairs
  rackLocation: string; // e.g. Rack A-01, Shelf 2
  totalQty: number; // Cumulative purchased
  issuedQty: number; // Dispatched out
  returnedQty: number; // Returned back to store
  balanceQty: number; // Current available (totalQty - issuedQty + returnedQty)
  minReorderLevel: number;
  unitPrice: number;
  vendorName: string;
  vendorCode: string;
  vendorContact?: string;
  invoiceNo?: string;
  purchaseDate: string;
  warrantyExpiry?: string;
  serialNumber?: string;
  remarks?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DispatchLog {
  id: string;
  voucherNo: string; // DISPATCH-XXXXXX
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  qty: number;
  issuedToStaff: string; // Teacher / Employee
  staffRole?: string;
  allocatedRoom: string; // Room / Class / Lab
  purpose: string;
  isReturnable: boolean;
  expectedReturnDate?: string;
  returnStatus: "Not Returnable" | "Pending Return" | "Returned" | "Overdue";
  issuedDate: string;
  issuedBy: string;
  notes?: string;
  createdAt: number;
}

export interface InwardLog {
  id: string;
  inwardNo: string; // INWARD-XXXXXX
  vendorName: string;
  vendorCode: string;
  vendorContact?: string;
  billNo: string;
  billDate: string;
  billAmount: number;
  paymentStatus: "Paid" | "Pending" | "Partial";
  itemsReceived: {
    itemId?: string;
    itemName: string;
    category: string;
    qty: number;
    unitPrice: number;
    totalAmount: number;
  }[];
  date: string;
  receivedBy: string;
  remarks?: string;
  createdAt: number;
}

export interface ReturnLog {
  id: string;
  returnVoucherNo: string; // RETURN-XXXXXX
  dispatchVoucherNo?: string;
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  returnedBy: string;
  returnedFromRoom: string;
  condition: "Good (Restocked)" | "Slightly Damaged" | "Damaged (Quarantined)" | "Partially Consumed";
  actionTaken: "Restocked to Store Balance" | "Quarantined for Repair" | "Scrapped / Written Off";
  returnDate: string;
  receivedBy: string;
  remarks?: string;
  createdAt: number;
}

// Pre-defined categories for School & IT Store
export const STORE_CATEGORIES = [
  "All Categories",
  "Stationery & Exam Supplies",
  "Computer Lab & IT Spares",
  "Printers & Ink Cartridges",
  "Textbooks & Workbooks",
  "Smart Class & Projectors",
  "Science Lab Apparatus",
  "Sports & Physical Education",
  "Uniforms & Accessories",
  "Housekeeping & Hygiene",
  "Electrical & Campus Maintenance"
];

export const UNIT_TYPES = [
  "Units",
  "Bundles",
  "Boxes",
  "Pcs",
  "Reams",
  "Packs",
  "Sets",
  "Rolls",
  "Bottles",
  "Pairs"
];

// Recommended standard school catalog for 1-click loading if user wants real seed items
const RECOMMENDED_SCHOOL_CATALOG: StoreItem[] = [
  {
    id: "STR-1001",
    itemName: "A4 Copier Paper (JK Copier 75 GSM - 500 Sheets/Ream)",
    category: "Stationery & Exam Supplies",
    itemType: "Consumable",
    unit: "Reams",
    rackLocation: "Rack A-01 (Stationery Bay)",
    totalQty: 100,
    issuedQty: 75,
    returnedQty: 0,
    balanceQty: 25,
    minReorderLevel: 20,
    unitPrice: 290,
    vendorName: "Sri Laxmi Paper Mart",
    vendorCode: "VND-PAP-01",
    vendorContact: "+91 98480 11223",
    invoiceNo: "INV-2026-881",
    purchaseDate: "10-01-2026",
    remarks: "Exam Question paper & circular printing stock",
    createdAt: Date.now() - 30 * 86400000,
    updatedAt: Date.now()
  },
  {
    id: "STR-1002",
    itemName: "Whiteboard Dry Erase Bullet Markers (Pack of 10 Assorted)",
    category: "Stationery & Exam Supplies",
    itemType: "Consumable",
    unit: "Packs",
    rackLocation: "Rack A-02 (Teacher Shelf)",
    totalQty: 60,
    issuedQty: 35,
    returnedQty: 0,
    balanceQty: 25,
    minReorderLevel: 15,
    unitPrice: 220,
    vendorName: "Balaji Stationery Wholesalers",
    vendorCode: "VND-BAL-02",
    vendorContact: "+91 98492 44556",
    invoiceNo: "INV-2026-904",
    purchaseDate: "15-01-2026",
    remarks: "Black, Blue, Red markers for classrooms",
    createdAt: Date.now() - 25 * 86400000,
    updatedAt: Date.now()
  },
  {
    id: "STR-1003",
    itemName: "Optical USB Mouse (Logitech B100 High Durability)",
    category: "Computer Lab & IT Spares",
    itemType: "Fixed Asset / Equipment",
    unit: "Pcs",
    rackLocation: "Rack C-01 (IT Hardware Cabinet)",
    totalQty: 30,
    issuedQty: 28,
    returnedQty: 0,
    balanceQty: 2, // Low stock warning
    minReorderLevel: 6,
    unitPrice: 360,
    vendorName: "TechnoVision Systems",
    vendorCode: "VND-TECH-04",
    vendorContact: "+91 94401 88776",
    invoiceNo: "INV-2026-920",
    purchaseDate: "18-01-2026",
    serialNumber: "LOG-B100-2026-001 TO 030",
    remarks: "Replacement mouse stock for Computer Lab 1 & 2",
    createdAt: Date.now() - 20 * 86400000,
    updatedAt: Date.now()
  },
  {
    id: "STR-1004",
    itemName: "Epson Original 003 Black Ink Bottle (EcoTank)",
    category: "Printers & Ink Cartridges",
    itemType: "Consumable",
    unit: "Bottles",
    rackLocation: "Rack C-03 (Printer Toner Locker)",
    totalQty: 12,
    issuedQty: 11,
    returnedQty: 0,
    balanceQty: 1, // Low stock alert
    minReorderLevel: 3,
    unitPrice: 650,
    vendorName: "Sri Laxmi Paper Mart",
    vendorCode: "VND-PAP-01",
    vendorContact: "+91 98480 11223",
    invoiceNo: "INV-2026-940",
    purchaseDate: "02-02-2026",
    remarks: "Principal & Admin Desk L3150 / L3250 printers",
    createdAt: Date.now() - 15 * 86400000,
    updatedAt: Date.now()
  },
  {
    id: "STR-1005",
    itemName: "Epson 3LCD Portable Projector EB-E01 (3300 Lumens)",
    category: "Smart Class & Projectors",
    itemType: "Fixed Asset / Equipment",
    unit: "Units",
    rackLocation: "Locker AV-1 (Secured Vault)",
    totalQty: 6,
    issuedQty: 5,
    returnedQty: 0,
    balanceQty: 1,
    minReorderLevel: 2,
    unitPrice: 38500,
    vendorName: "TechnoVision Systems",
    vendorCode: "VND-TECH-04",
    vendorContact: "+91 94401 88776",
    invoiceNo: "INV-PROJ-2026-11",
    purchaseDate: "05-01-2026",
    warrantyExpiry: "05-01-2028",
    serialNumber: "EP-EB-2026-99120",
    remarks: "Class 10-A, 10-B, Science AV, Library",
    createdAt: Date.now() - 40 * 86400000,
    updatedAt: Date.now()
  },
  {
    id: "STR-1006",
    itemName: "Grade 1-5 Student Academic Handbooks & Calendars",
    category: "Textbooks & Workbooks",
    itemType: "Consumable",
    unit: "Sets",
    rackLocation: "Rack D-02 (Book Storage)",
    totalQty: 250,
    issuedQty: 215,
    returnedQty: 0,
    balanceQty: 35,
    minReorderLevel: 25,
    unitPrice: 180,
    vendorName: "Birla Publications Hub",
    vendorCode: "VND-PUB-09",
    purchaseDate: "05-01-2026",
    remarks: "Primary student induction kit",
    createdAt: Date.now() - 45 * 86400000,
    updatedAt: Date.now()
  }
];

export default function SchoolStoreHub() {
  // Navigation sub-tabs
  const [activeTab, setActiveTab] = useState<"inventory" | "dispatch" | "inward" | "returns" | "reorder" | "ledger">("inventory");

  // Core State with LocalStorage Persistence
  const [storeItems, setStoreItems] = useState<StoreItem[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_items");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return RECOMMENDED_SCHOOL_CATALOG;
  });

  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_dispatches");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [
      {
        id: "DSP-101",
        voucherNo: "DISPATCH-88102",
        itemId: "STR-1001",
        itemName: "A4 Copier Paper (JK Copier 75 GSM - 500 Sheets/Ream)",
        category: "Stationery & Exam Supplies",
        unit: "Reams",
        qty: 5,
        issuedToStaff: "Smt. K. Anitha (Academic Coordinator)",
        staffRole: "Academic Coordinator",
        allocatedRoom: "Exam Cell / Printing Dept",
        purpose: "Unit Test 2 Question Paper Printing",
        isReturnable: false,
        returnStatus: "Not Returnable",
        issuedDate: "20-02-2026 10:30 AM",
        issuedBy: "Store Manager",
        createdAt: Date.now() - 7 * 86400000
      },
      {
        id: "DSP-102",
        voucherNo: "DISPATCH-88103",
        itemId: "STR-1005",
        itemName: "Epson 3LCD Portable Projector EB-E01 (3300 Lumens)",
        category: "Smart Class & Projectors",
        unit: "Units",
        qty: 1,
        issuedToStaff: "Mr. Ramesh V. (Senior Physics Teacher)",
        staffRole: "Physics Faculty",
        allocatedRoom: "Science Lab / AV Demonstration Hall",
        purpose: "Guest Lecture on Optics & Photonics",
        isReturnable: true,
        expectedReturnDate: "28-02-2026",
        returnStatus: "Pending Return",
        issuedDate: "22-02-2026 02:15 PM",
        issuedBy: "Store Manager",
        notes: "Power cable and HDMI lead included with projector carry bag.",
        createdAt: Date.now() - 5 * 86400000
      }
    ];
  });

  const [inwardLogs, setInwardLogs] = useState<InwardLog[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_inwards");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [
      {
        id: "INW-1",
        inwardNo: "INWARD-2026-01",
        vendorName: "Sri Laxmi Paper Mart",
        vendorCode: "VND-PAP-01",
        vendorContact: "+91 98480 11223",
        billNo: "INV-2026-881",
        billDate: "10-01-2026",
        billAmount: 29000,
        paymentStatus: "Paid",
        itemsReceived: [
          { itemName: "A4 Copier Paper (JK Copier 75 GSM - 500 Sheets/Ream)", category: "Stationery & Exam Supplies", qty: 100, unitPrice: 290, totalAmount: 29000 }
        ],
        date: "10-01-2026",
        receivedBy: "Store Manager",
        createdAt: Date.now() - 30 * 86400000
      },
      {
        id: "INW-2",
        inwardNo: "INWARD-2026-02",
        vendorName: "TechnoVision Systems",
        vendorCode: "VND-TECH-04",
        vendorContact: "+91 94401 88776",
        billNo: "INV-2026-920",
        billDate: "18-01-2026",
        billAmount: 10800,
        paymentStatus: "Paid",
        itemsReceived: [
          { itemName: "Optical USB Mouse (Logitech B100 High Durability)", category: "Computer Lab & IT Spares", qty: 30, unitPrice: 360, totalAmount: 10800 }
        ],
        date: "18-01-2026",
        receivedBy: "Store Manager",
        createdAt: Date.now() - 20 * 86400000
      }
    ];
  });

  const [returnLogs, setReturnLogs] = useState<ReturnLog[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_returns");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Sync to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem("bims_school_store_items", JSON.stringify(storeItems));
    } catch {}
  }, [storeItems]);

  useEffect(() => {
    try {
      localStorage.setItem("bims_school_store_dispatches", JSON.stringify(dispatchLogs));
    } catch {}
  }, [dispatchLogs]);

  useEffect(() => {
    try {
      localStorage.setItem("bims_school_store_inwards", JSON.stringify(inwardLogs));
    } catch {}
  }, [inwardLogs]);

  useEffect(() => {
    try {
      localStorage.setItem("bims_school_store_returns", JSON.stringify(returnLogs));
    } catch {}
  }, [returnLogs]);

  // Firestore Synchronization (if Firebase is active)
  const syncToCloud = () => {
    if (!isFirebaseConfigured()) return;
    try {
      storeItems.forEach(item => saveDocument("store_items", item.id, item));
      dispatchLogs.forEach(disp => saveDocument("store_dispatches", disp.id, disp));
      inwardLogs.forEach(inw => saveDocument("store_inwards", inw.id, inw));
      returnLogs.forEach(ret => saveDocument("store_returns", ret.id, ret));
    } catch (err) {
      console.warn("Firestore store sync error:", err);
    }
  };

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Categories");
  const [stockHealthFilter, setStockHealthFilter] = useState<"All" | "In Stock" | "Low Stock" | "Depleted">("All");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Selected item targets for modals
  const [activeItemForAction, setActiveItemForAction] = useState<StoreItem | null>(null);

  // Form State: Add / Edit Item
  const [editItemId, setEditItemId] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formCategory, setFormCategory] = useState(STORE_CATEGORIES[1]);
  const [formItemType, setFormItemType] = useState<"Consumable" | "Fixed Asset / Equipment">("Consumable");
  const [formUnit, setFormUnit] = useState("Units");
  const [formRackLocation, setFormRackLocation] = useState("");
  const [formTotalQty, setFormTotalQty] = useState(10);
  const [formMinReorder, setFormMinReorder] = useState(5);
  const [formUnitPrice, setFormUnitPrice] = useState(100);
  const [formVendorName, setFormVendorName] = useState("");
  const [formVendorCode, setFormVendorCode] = useState("");
  const [formVendorContact, setFormVendorContact] = useState("");
  const [formInvoiceNo, setFormInvoiceNo] = useState("");
  const [formSerial, setFormSerial] = useState("");
  const [formWarranty, setFormWarranty] = useState("");
  const [formRemarks, setFormRemarks] = useState("");

  // Form State: Material Dispatch / Issue
  const [dispSelectedItemId, setDispSelectedItemId] = useState("");
  const [dispStaffName, setDispStaffName] = useState("");
  const [dispStaffRole, setDispStaffRole] = useState("");
  const [dispRoom, setDispRoom] = useState("");
  const [dispQty, setDispQty] = useState(1);
  const [dispPurpose, setDispPurpose] = useState("");
  const [dispIsReturnable, setDispIsReturnable] = useState(false);
  const [dispExpectedReturn, setDispExpectedReturn] = useState("");
  const [dispNotes, setDispNotes] = useState("");

  // Form State: Quick Inward Purchase
  const [inwVendor, setInwVendor] = useState("");
  const [inwVendorCode, setInwVendorCode] = useState("");
  const [inwBillNo, setInwBillNo] = useState("");
  const [inwBillDate, setInwBillDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [inwSelectedItemId, setInwSelectedItemId] = useState("");
  const [inwQty, setInwQty] = useState(10);
  const [inwUnitPrice, setInwUnitPrice] = useState(100);
  const [inwPaymentStatus, setInwPaymentStatus] = useState<"Paid" | "Pending" | "Partial">("Paid");

  // Form State: Material Return
  const [retDispatchVoucher, setRetDispatchVoucher] = useState("");
  const [retSelectedItemId, setRetSelectedItemId] = useState("");
  const [retQty, setRetQty] = useState(1);
  const [retStaff, setRetStaff] = useState("");
  const [retRoom, setRetRoom] = useState("");
  const [retCondition, setRetCondition] = useState<"Good (Restocked)" | "Slightly Damaged" | "Damaged (Quarantined)" | "Partially Consumed">("Good (Restocked)");
  const [retAction, setRetAction] = useState<"Restocked to Store Balance" | "Quarantined for Repair" | "Scrapped / Written Off">("Restocked to Store Balance");
  const [retRemarks, setRetRemarks] = useState("");

  // Filtered store items
  const filteredStoreItems = useMemo(() => {
    return storeItems.filter(item => {
      const matchSearch =
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.rackLocation && item.rackLocation.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat = selectedCategory === "All Categories" || item.category === selectedCategory;

      let matchHealth = true;
      if (stockHealthFilter === "In Stock") {
        matchHealth = item.balanceQty > item.minReorderLevel;
      } else if (stockHealthFilter === "Low Stock") {
        matchHealth = item.balanceQty <= item.minReorderLevel && item.balanceQty > 0;
      } else if (stockHealthFilter === "Depleted") {
        matchHealth = item.balanceQty <= 0;
      }

      return matchSearch && matchCat && matchHealth;
    });
  }, [storeItems, searchTerm, selectedCategory, stockHealthFilter]);

  // Derived low stock items
  const lowStockItems = useMemo(() => {
    return storeItems.filter(item => item.balanceQty <= item.minReorderLevel);
  }, [storeItems]);

  // KPI Metrics
  const totalStoreValue = useMemo(() => {
    return storeItems.reduce((acc, item) => acc + (Math.max(0, item.balanceQty) * (item.unitPrice || 0)), 0);
  }, [storeItems]);

  const totalDispatchedCount = useMemo(() => {
    return dispatchLogs.reduce((acc, log) => acc + log.qty, 0);
  }, [dispatchLogs]);

  const pendingReturnableCount = useMemo(() => {
    return dispatchLogs.filter(d => d.isReturnable && d.returnStatus !== "Returned").length;
  }, [dispatchLogs]);

  // Handler: Open Add Modal
  const handleOpenAddModal = () => {
    setEditItemId("");
    setFormItemName("");
    setFormCategory(STORE_CATEGORIES[1]);
    setFormItemType("Consumable");
    setFormUnit("Units");
    setFormRackLocation("");
    setFormTotalQty(10);
    setFormMinReorder(5);
    setFormUnitPrice(100);
    setFormVendorName("");
    setFormVendorCode("");
    setFormVendorContact("");
    setFormInvoiceNo("");
    setFormSerial("");
    setFormWarranty("");
    setFormRemarks("");
    setShowAddModal(true);
  };

  // Handler: Open Edit Modal
  const handleOpenEditModal = (item: StoreItem) => {
    setEditItemId(item.id);
    setFormItemName(item.itemName);
    setFormCategory(item.category);
    setFormItemType(item.itemType || "Consumable");
    setFormUnit(item.unit || "Units");
    setFormRackLocation(item.rackLocation || "");
    setFormTotalQty(item.totalQty);
    setFormMinReorder(item.minReorderLevel);
    setFormUnitPrice(item.unitPrice);
    setFormVendorName(item.vendorName);
    setFormVendorCode(item.vendorCode);
    setFormVendorContact(item.vendorContact || "");
    setFormInvoiceNo(item.invoiceNo || "");
    setFormSerial(item.serialNumber || "");
    setFormWarranty(item.warrantyExpiry || "");
    setFormRemarks(item.remarks || "");
    setShowEditModal(true);
  };

  // Handler: Save Add or Edit Item
  const handleSaveItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName.trim()) {
      alert("Please enter a valid item name!");
      return;
    }

    const todayDate = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    if (editItemId) {
      // Update existing item
      setStoreItems(prev => prev.map(item => {
        if (item.id === editItemId) {
          const newBal = Number(formTotalQty) - item.issuedQty + item.returnedQty;
          return {
            ...item,
            itemName: formItemName.trim(),
            category: formCategory,
            itemType: formItemType,
            unit: formUnit,
            rackLocation: formRackLocation.trim() || "Main Store",
            totalQty: Number(formTotalQty),
            balanceQty: newBal,
            minReorderLevel: Number(formMinReorder),
            unitPrice: Number(formUnitPrice),
            vendorName: formVendorName.trim() || "General Supplier",
            vendorCode: formVendorCode.trim().toUpperCase() || "VND-GEN",
            vendorContact: formVendorContact.trim() || undefined,
            invoiceNo: formInvoiceNo.trim() || undefined,
            serialNumber: formSerial.trim() || undefined,
            warrantyExpiry: formWarranty.trim() || undefined,
            remarks: formRemarks.trim() || undefined,
            updatedAt: Date.now()
          };
        }
        return item;
      }));
      setShowEditModal(false);
    } else {
      // Create new item
      const newId = `STR-${1000 + storeItems.length + 1}`;
      const vCode = formVendorCode.trim()
        ? formVendorCode.trim().toUpperCase()
        : `VND-${(formVendorName || "GEN").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;

      const newItem: StoreItem = {
        id: newId,
        itemName: formItemName.trim(),
        category: formCategory,
        itemType: formItemType,
        unit: formUnit,
        rackLocation: formRackLocation.trim() || "Rack Main Store",
        totalQty: Number(formTotalQty),
        issuedQty: 0,
        returnedQty: 0,
        balanceQty: Number(formTotalQty),
        minReorderLevel: Number(formMinReorder),
        unitPrice: Number(formUnitPrice),
        vendorName: formVendorName.trim() || "General Supplier",
        vendorCode: vCode,
        vendorContact: formVendorContact.trim() || undefined,
        invoiceNo: formInvoiceNo.trim() || undefined,
        purchaseDate: todayDate,
        serialNumber: formSerial.trim() || undefined,
        warrantyExpiry: formWarranty.trim() || undefined,
        remarks: formRemarks.trim() || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      setStoreItems([newItem, ...storeItems]);

      // Automatically log inward receipt for new initial purchase
      const newInward: InwardLog = {
        id: `INW-${Date.now().toString().slice(-6)}`,
        inwardNo: `INWARD-2026-${String(inwardLogs.length + 1).padStart(2, "0")}`,
        vendorName: newItem.vendorName,
        vendorCode: newItem.vendorCode,
        vendorContact: newItem.vendorContact,
        billNo: newItem.invoiceNo || `BILL-${Date.now().toString().slice(-6)}`,
        billDate: todayDate,
        billAmount: newItem.totalQty * newItem.unitPrice,
        paymentStatus: "Paid",
        itemsReceived: [
          {
            itemId: newItem.id,
            itemName: newItem.itemName,
            category: newItem.category,
            qty: newItem.totalQty,
            unitPrice: newItem.unitPrice,
            totalAmount: newItem.totalQty * newItem.unitPrice
          }
        ],
        date: todayDate,
        receivedBy: "Store Manager",
        remarks: "Initial stock registration",
        createdAt: Date.now()
      };
      setInwardLogs([newInward, ...inwardLogs]);
      setShowAddModal(false);
    }
  };

  // Handler: Delete Item
  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`Are you sure you want to permanently delete "${name}" (${id}) from the School Store?`)) {
      setStoreItems(prev => prev.filter(i => i.id !== id));
      if (isFirebaseConfigured()) {
        deleteDocument("store_items", id);
      }
    }
  };

  // Handler: Issue / Dispatch Material
  const handleOpenDispatchModal = (item?: StoreItem) => {
    if (item) {
      setDispSelectedItemId(item.id);
      setDispIsReturnable(item.itemType === "Fixed Asset / Equipment");
    } else if (storeItems.length > 0) {
      setDispSelectedItemId(storeItems[0].id);
      setDispIsReturnable(storeItems[0].itemType === "Fixed Asset / Equipment");
    }
    setDispStaffName("");
    setDispStaffRole("");
    setDispRoom("");
    setDispQty(1);
    setDispPurpose("");
    setDispExpectedReturn("");
    setDispNotes("");
    setShowDispatchModal(true);
  };

  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const item = storeItems.find(i => i.id === dispSelectedItemId);
    if (!item) {
      alert("Please select a valid store item to issue!");
      return;
    }

    if (dispQty > item.balanceQty) {
      alert(`⚠️ Cannot dispatch ${dispQty} ${item.unit}! Available balance is only ${item.balanceQty} ${item.unit}.`);
      return;
    }

    if (!dispStaffName.trim() || !dispRoom.trim()) {
      alert("Please provide the Teacher/Staff name and Room/Classroom allocation!");
      return;
    }

    const voucherNo = `DISPATCH-${Date.now().toString().slice(-6)}`;
    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    const newLog: DispatchLog = {
      id: `DSP-${Date.now().toString().slice(-6)}`,
      voucherNo,
      itemId: item.id,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      qty: Number(dispQty),
      issuedToStaff: dispStaffName.trim(),
      staffRole: dispStaffRole.trim() || undefined,
      allocatedRoom: dispRoom.trim(),
      purpose: dispPurpose.trim() || "Academic / School Operations",
      isReturnable: dispIsReturnable,
      expectedReturnDate: dispIsReturnable ? dispExpectedReturn : undefined,
      returnStatus: dispIsReturnable ? "Pending Return" : "Not Returnable",
      issuedDate: nowStr,
      issuedBy: "Store Manager",
      notes: dispNotes.trim() || undefined,
      createdAt: Date.now()
    };

    // Update Store Balances
    setStoreItems(prev => prev.map(i => {
      if (i.id === item.id) {
        const newIssued = i.issuedQty + Number(dispQty);
        return {
          ...i,
          issuedQty: newIssued,
          balanceQty: i.totalQty - newIssued + i.returnedQty,
          updatedAt: Date.now()
        };
      }
      return i;
    }));

    setDispatchLogs([newLog, ...dispatchLogs]);
    setShowDispatchModal(false);

    // Prompt immediate PDF Voucher download
    generateDispatchVoucherPDF(newLog, item.unitPrice);
  };

  // Handler: Inward Purchase Receipt
  const handleOpenInwardModal = (item?: StoreItem) => {
    if (item) {
      setInwSelectedItemId(item.id);
      setInwVendor(item.vendorName);
      setInwVendorCode(item.vendorCode);
      setInwUnitPrice(item.unitPrice);
    } else if (storeItems.length > 0) {
      setInwSelectedItemId(storeItems[0].id);
      setInwVendor(storeItems[0].vendorName);
      setInwVendorCode(storeItems[0].vendorCode);
      setInwUnitPrice(storeItems[0].unitPrice);
    }
    setInwBillNo(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setInwBillDate(new Date().toISOString().slice(0, 10));
    setInwQty(10);
    setInwPaymentStatus("Paid");
    setShowInwardModal(true);
  };

  const handleConfirmInward = (e: React.FormEvent) => {
    e.preventDefault();
    const item = storeItems.find(i => i.id === inwSelectedItemId);
    if (!item) {
      alert("Please select a store item!");
      return;
    }

    const inwardNo = `INWARD-${Date.now().toString().slice(-6)}`;
    const lineTotal = Number(inwQty) * Number(inwUnitPrice);

    const newInward: InwardLog = {
      id: `INW-${Date.now().toString().slice(-6)}`,
      inwardNo,
      vendorName: inwVendor.trim() || item.vendorName,
      vendorCode: inwVendorCode.trim().toUpperCase() || item.vendorCode,
      billNo: inwBillNo.trim(),
      billDate: inwBillDate,
      billAmount: lineTotal,
      paymentStatus: inwPaymentStatus,
      itemsReceived: [
        {
          itemId: item.id,
          itemName: item.itemName,
          category: item.category,
          qty: Number(inwQty),
          unitPrice: Number(inwUnitPrice),
          totalAmount: lineTotal
        }
      ],
      date: new Date().toLocaleDateString("en-GB").replace(/\//g, "-"),
      receivedBy: "Store Manager",
      createdAt: Date.now()
    };

    // Update Store Balances (Increment total purchase quantity and update price)
    setStoreItems(prev => prev.map(i => {
      if (i.id === item.id) {
        const newTotal = i.totalQty + Number(inwQty);
        return {
          ...i,
          totalQty: newTotal,
          balanceQty: newTotal - i.issuedQty + i.returnedQty,
          unitPrice: Number(inwUnitPrice) > 0 ? Number(inwUnitPrice) : i.unitPrice,
          updatedAt: Date.now()
        };
      }
      return i;
    }));

    setInwardLogs([newInward, ...inwardLogs]);
    setShowInwardModal(false);
  };

  // Handler: Return Material to Store
  const handleOpenReturnModal = (disp?: DispatchLog) => {
    if (disp) {
      setRetDispatchVoucher(disp.voucherNo);
      setRetSelectedItemId(disp.itemId);
      setRetStaff(disp.issuedToStaff);
      setRetRoom(disp.allocatedRoom);
      setRetQty(disp.qty);
    } else if (dispatchLogs.length > 0) {
      const pending = dispatchLogs.find(d => d.isReturnable && d.returnStatus === "Pending Return") || dispatchLogs[0];
      setRetDispatchVoucher(pending.voucherNo);
      setRetSelectedItemId(pending.itemId);
      setRetStaff(pending.issuedToStaff);
      setRetRoom(pending.allocatedRoom);
      setRetQty(pending.qty);
    }
    setRetCondition("Good (Restocked)");
    setRetAction("Restocked to Store Balance");
    setRetRemarks("");
    setShowReturnModal(true);
  };

  const handleConfirmReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const item = storeItems.find(i => i.id === retSelectedItemId);
    if (!item) {
      alert("Please select a valid item!");
      return;
    }

    const returnVoucherNo = `RETURN-${Date.now().toString().slice(-6)}`;
    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    const newReturn: ReturnLog = {
      id: `RET-${Date.now().toString().slice(-6)}`,
      returnVoucherNo,
      dispatchVoucherNo: retDispatchVoucher.trim() || undefined,
      itemId: item.id,
      itemName: item.itemName,
      qty: Number(retQty),
      unit: item.unit,
      returnedBy: retStaff.trim() || "Staff Member",
      returnedFromRoom: retRoom.trim() || "School Campus",
      condition: retCondition,
      actionTaken: retAction,
      returnDate: nowStr,
      receivedBy: "Store Manager",
      remarks: retRemarks.trim() || undefined,
      createdAt: Date.now()
    };

    // If restocked to balance, increment returnedQty in Item Master
    if (retAction === "Restocked to Store Balance") {
      setStoreItems(prev => prev.map(i => {
        if (i.id === item.id) {
          const newRet = i.returnedQty + Number(retQty);
          return {
            ...i,
            returnedQty: newRet,
            balanceQty: i.totalQty - i.issuedQty + newRet,
            updatedAt: Date.now()
          };
        }
        return i;
      }));
    }

    // Update dispatch log return status if matching voucher exists
    if (retDispatchVoucher) {
      setDispatchLogs(prev => prev.map(d => {
        if (d.voucherNo === retDispatchVoucher) {
          return { ...d, returnStatus: "Returned" };
        }
        return d;
      }));
    }

    setReturnLogs([newReturn, ...returnLogs]);
    setShowReturnModal(false);
  };

  // Handler: Barcode & Label Modal
  const handleOpenBarcodeModal = (item: StoreItem) => {
    setActiveItemForAction(item);
    setShowBarcodeModal(true);
  };

  // Clear all Store Data (Production Purity)
  const handleClearAllStoreData = () => {
    if (confirm("⚠️ CAUTION: Are you sure you want to clear ALL school store items, vouchers, and receipts? This will wipe demo data for production.")) {
      setStoreItems([]);
      setDispatchLogs([]);
      setInwardLogs([]);
      setReturnLogs([]);
      localStorage.removeItem("bims_school_store_items");
      localStorage.removeItem("bims_school_store_dispatches");
      localStorage.removeItem("bims_school_store_inwards");
      localStorage.removeItem("bims_school_store_returns");
    }
  };

  // Load Recommended Standard Catalog
  const handleLoadRecommendedCatalog = () => {
    if (confirm("Load recommended Birla School standard store catalog? (Stationery, Lab spares, Books, Toners)")) {
      setStoreItems(RECOMMENDED_SCHOOL_CATALOG);
    }
  };

  // ==========================================
  // PDF GENERATORS
  // ==========================================

  // PDF 1: Professional Material Dispatch Voucher
  const generateDispatchVoucherPDF = (log: DispatchLog, unitPrice: number) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Header Banner
      doc.setFillColor(221, 107, 32); // Brand Amber #DD6B20
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text("CENTRAL STORE & MATERIAL DISTRIBUTION VOUCHER", 14, 22);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(`VOUCHER NO: #${log.voucherNo}`, 135, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Issue Date: ${log.issuedDate}`, 135, 22);

      // Section 1: Staff & Allocation Details
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("1. RECEIVER & DEPARTMENT DETAILS", 14, 48);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text([
        `Issued To Staff / Faculty : ${log.issuedToStaff} ${log.staffRole ? `(${log.staffRole})` : ""}`,
        `Destination Classroom / Lab: ${log.allocatedRoom}`,
        `Purpose of Material Issue  : ${log.purpose}`,
        `Store Custodian / Issuer   : ${log.issuedBy}`,
        `Item Return Policy         : ${log.isReturnable ? `RETURNABLE (Expected: ${log.expectedReturnDate || "Within 7 Days"})` : "CONSUMABLE / NON-RETURNABLE"}`
      ], 14, 56);

      // Section 2: Items Table
      const subtotal = log.qty * unitPrice;
      const tableColumn = ["S.No", "Store Code", "Item Description", "Category", "Quantity Issued", "Unit Price", "Estimated Value"];
      const tableRows = [
        ["1", log.itemId, log.itemName, log.category, `${log.qty} ${log.unit}`, `INR ${unitPrice.toLocaleString()}`, `INR ${subtotal.toLocaleString()}`]
      ];

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 88,
        theme: "striped",
        headStyles: { fillColor: [221, 107, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 130;

      // Note & Declaration
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text(
        "Note: The receiver acknowledges receiving the above store materials in good condition for official institutional use.",
        14,
        finalY + 12
      );

      // Signatures
      const sigY = Math.min(250, finalY + 45);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);

      doc.line(14, sigY, 80, sigY);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("RECEIVER FACULTY / STAFF SIGNATURE", 14, sigY + 5);

      doc.line(130, sigY, 196, sigY);
      doc.text("AUTHORIZED STORE IN-CHARGE SIGNATURE", 130, sigY + 5);

      doc.save(`Store_Voucher_${log.voucherNo}.pdf`);
    } catch (err: any) {
      alert(`PDF export error: ${err.message}`);
    }
  };

  // PDF 2: Purchase Requisition for Low Stock Items
  const generateReorderPDF = () => {
    if (lowStockItems.length === 0) {
      alert("All store items have adequate stock levels! No re-orders required.");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(185, 28, 28); // Rose/Red #B91C1C
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text("URGENT SCHOOL STORE RE-ORDER & PROCUREMENT REQUISITION", 14, 22);
      doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, 145, 14);

      let totalEstCost = 0;
      const tableColumn = ["S.No", "Store ID", "Material Name", "Category", "Current Stock", "Min Threshold", "Shortfall", "Est. Budget"];
      const tableRows = lowStockItems.map((item, idx) => {
        const shortfall = Math.max(1, (item.minReorderLevel * 2) - item.balanceQty);
        const estCost = shortfall * item.unitPrice;
        totalEstCost += estCost;
        return [
          (idx + 1).toString(),
          item.id,
          item.itemName,
          item.category,
          `${item.balanceQty} ${item.unit}`,
          `${item.minReorderLevel} ${item.unit}`,
          `+${shortfall} ${item.unit}`,
          `INR ${estCost.toLocaleString()}`
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: "striped",
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { fontSize: 8, textColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 120;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(185, 28, 28);
      doc.text(`Total Estimated Replenishment Budget: INR ${totalEstCost.toLocaleString()}`, 14, finalY + 12);

      const sigY = Math.min(255, finalY + 40);
      doc.setDrawColor(180, 180, 180);
      doc.line(14, sigY, 70, sigY);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text("STORE MANAGER", 14, sigY + 5);

      doc.line(78, sigY, 134, sigY);
      doc.text("ACCOUNTS / PURCHASE DESK", 78, sigY + 5);

      doc.line(142, sigY, 196, sigY);
      doc.text("PRINCIPAL / DIRECTOR APPROVAL", 142, sigY + 5);

      doc.save(`Store_Purchase_Requisition_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(`PDF export error: ${err.message}`);
    }
  };

  // CSV Export for Stock Register
  const handleExportStockCSV = () => {
    if (storeItems.length === 0) {
      alert("No store items to export!");
      return;
    }
    const headers = [
      "Item ID",
      "Item Name",
      "Category",
      "Item Type",
      "Unit",
      "Rack Location",
      "Total Purchased",
      "Total Dispatched",
      "Total Returned",
      "Available Balance",
      "Min Reorder Level",
      "Unit Price (INR)",
      "Total Valuation (INR)",
      "Vendor Name",
      "Vendor Code",
      "Invoice No",
      "Serial / Barcode",
      "Purchase Date"
    ];

    const rows = storeItems.map(i => [
      `"${i.id}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      `"${i.category}"`,
      `"${i.itemType}"`,
      `"${i.unit}"`,
      `"${i.rackLocation || ""}"`,
      i.totalQty,
      i.issuedQty,
      i.returnedQty,
      i.balanceQty,
      i.minReorderLevel,
      i.unitPrice,
      i.balanceQty * i.unitPrice,
      `"${i.vendorName || ""}"`,
      `"${i.vendorCode || ""}"`,
      `"${i.invoiceNo || ""}"`,
      `"${i.serialNumber || ""}"`,
      `"${i.purchaseDate || ""}"`
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Birla_School_Store_Register_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Render Barcode / Shelf Label Sticker
  const printableLabelRef = useRef<HTMLDivElement>(null);
  const handlePrintLabel = () => {
    window.print();
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-slate-800 p-5 shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 shrink-0 shadow-inner">
              <Store size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black text-white tracking-wide uppercase">
                  Central School Store & Asset Hub
                </h1>
                <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-black text-amber-300 uppercase tracking-wider">
                  Store Master
                </span>
                {isFirebaseConfigured() && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Cloud Synced
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Centralized Stock Register, Material Dispatches, Vendor Inward GRN, Teacher Returns & Re-Order Radar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenDispatchModal()}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Send size={15} />
              <span>⚡ Issue Stock to Staff/Room</span>
            </button>

            <button
              onClick={() => handleOpenInwardModal()}
              className="px-3.5 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95 border border-emerald-600/40"
            >
              <ArrowDownLeft size={15} />
              <span>Inward GRN</span>
            </button>

            <button
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>New Item Master</span>
            </button>

            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={syncToCloud}
                title="Sync and refresh from cloud"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw size={15} />
              </button>
              <button
                onClick={handleExportStockCSV}
                title="Export Store Inventory to CSV"
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all cursor-pointer"
              >
                <Download size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick KPI Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Master Catalog</p>
              <p className="text-xl font-black text-white mt-0.5">{storeItems.length} SKUs</p>
            </div>
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
              <Package size={18} />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Store Valuation</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">₹ {totalStoreValue.toLocaleString()}</p>
            </div>
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</p>
              <p className="text-xl font-black text-amber-400 mt-0.5">{dispatchLogs.length} Vouchers</p>
            </div>
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Send size={18} />
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3 rounded-2xl flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pending Returns</p>
              <p className="text-xl font-black text-indigo-400 mt-0.5">{pendingReturnableCount} Assets</p>
            </div>
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <RotateCcw size={18} />
            </div>
          </div>

          <div className={`p-3 rounded-2xl border flex items-center justify-between shadow-xs ${
            lowStockItems.length > 0
              ? "bg-rose-950/40 border-rose-800/80 text-rose-300"
              : "bg-slate-950/70 border-slate-800 text-slate-300"
          }`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider">Low Stock Warnings</p>
              <p className="text-xl font-black mt-0.5 text-rose-400">{lowStockItems.length} Items</p>
            </div>
            <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-5 py-2 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "inventory"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Package size={15} />
            <span>Stock Register ({storeItems.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("dispatch")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "dispatch"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Send size={15} />
            <span>Dispatches & Issues ({dispatchLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("inward")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "inward"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ArrowDownLeft size={15} />
            <span>Goods Inward GRN ({inwardLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("returns")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "returns"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <RotateCcw size={15} />
            <span>Returns to Store ({returnLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("reorder")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
              activeTab === "reorder"
                ? "bg-rose-600 text-white shadow-md shadow-rose-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <AlertTriangle size={15} />
            <span>Re-Order Radar ({lowStockItems.length})</span>
            {lowStockItems.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping absolute top-1.5 right-1.5"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "ledger"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <History size={15} />
            <span>Store Ledger</span>
          </button>
        </div>

        {/* Data Maintenance Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleLoadRecommendedCatalog}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-amber-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-amber-500/40 transition-all cursor-pointer"
            title="Populate recommended school catalog"
          >
            Load Catalog
          </button>
          <button
            onClick={handleClearAllStoreData}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded-lg hover:border-rose-500/40 transition-all cursor-pointer"
            title="Clear all demo items for production"
          >
            Clear Data
          </button>
        </div>
      </div>

      {/* Main Tab Content View */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">

        {/* ======================================================== */}
        {/* TAB 1: STOCK REGISTER (ITEM MASTER & INVENTORY)          */}
        {/* ======================================================== */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            {/* Filter, Search & Health Selector Bar */}
            <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between bg-slate-950/50 p-3 rounded-2xl border border-slate-800">
              <div className="flex flex-col sm:flex-row gap-2.5 flex-1">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3.5 top-3 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search material, code, vendor, rack shelf, serial..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={selectedCategory}
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {STORE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock Health Segment Filter */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 shrink-0">
                {(["All", "In Stock", "Low Stock", "Depleted"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStockHealthFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      stockHealthFilter === f
                        ? "bg-amber-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Inventory Table */}
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Store Code</th>
                      <th className="p-3.5">Material & Location</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 text-center">Purchased</th>
                      <th className="p-3.5 text-center">Dispatched</th>
                      <th className="p-3.5 text-center">Available Stock</th>
                      <th className="p-3.5">Primary Vendor</th>
                      <th className="p-3.5 text-right">Unit Price</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStoreItems.map(item => {
                      const isLow = item.balanceQty <= item.minReorderLevel && item.balanceQty > 0;
                      const isDepleted = item.balanceQty <= 0;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {item.id}
                            <span className="block text-[9px] font-sans font-normal text-slate-500">
                              {item.itemType === "Fixed Asset / Equipment" ? "Asset" : "Consumable"}
                            </span>
                          </td>
                          <td className="p-3.5 min-w-[200px]">
                            <p className="font-bold text-white text-xs leading-snug">{item.itemName}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1 text-slate-400">
                                <MapPin size={10} className="text-amber-500" />
                                {item.rackLocation || "Main Store"}
                              </span>
                              {item.serialNumber && (
                                <span className="font-mono text-slate-500">
                                  S/N: {item.serialNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-300 whitespace-nowrap">
                            {item.totalQty} {item.unit}
                          </td>
                          <td className="p-3.5 text-center font-bold text-amber-400 whitespace-nowrap">
                            {item.issuedQty} {item.unit}
                            {item.returnedQty > 0 && (
                              <span className="block text-[9px] text-indigo-400 font-normal">
                                ({item.returnedQty} returned)
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold inline-flex items-center gap-1 ${
                              isDepleted
                                ? "bg-rose-900/40 text-rose-300 border border-rose-700/60"
                                : isLow
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}>
                              {item.balanceQty} {item.unit}
                              {isDepleted && " (OUT OF STOCK)"}
                              {isLow && " ⚠️ LOW"}
                            </span>
                          </td>
                          <td className="p-3.5 min-w-[140px]">
                            <p className="font-bold text-slate-200">{item.vendorName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.vendorCode}</p>
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-400 whitespace-nowrap">
                            ₹ {item.unitPrice.toLocaleString()}
                            <span className="block text-[9px] text-slate-500 font-normal">
                              Total: ₹ {(item.balanceQty * item.unitPrice).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenDispatchModal(item)}
                                disabled={item.balanceQty <= 0}
                                className={`px-2.5 py-1.5 font-bold text-[10px] rounded-lg transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                                  item.balanceQty <= 0
                                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    : "bg-amber-600 hover:bg-amber-500 text-white"
                                }`}
                                title="Issue this item to staff or classroom"
                              >
                                <Send size={11} />
                                <span>Issue</span>
                              </button>

                              <button
                                onClick={() => handleOpenInwardModal(item)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Add stock / Inward GRN"
                              >
                                <Plus size={13} />
                              </button>

                              <button
                                onClick={() => handleOpenBarcodeModal(item)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Print Shelf / Bin Label Sticker"
                              >
                                <Tag size={13} />
                              </button>

                              <button
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
                                title="Edit Item Details"
                              >
                                <Edit size={13} />
                              </button>

                              <button
                                onClick={() => handleDeleteItem(item.id, item.itemName)}
                                className="p-1.5 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-lg transition-all cursor-pointer"
                                title="Delete Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {filteredStoreItems.length === 0 && (
                  <div className="text-center py-12 space-y-3">
                    <Package size={40} className="text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No store items found</p>
                    <p className="text-xs text-slate-500">
                      Try adjusting your search criteria, or click &ldquo;New Item Master&rdquo; or &ldquo;Load Catalog&rdquo;.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: MATERIAL DISPATCHES & STAFF ISSUE LOGS            */}
        {/* ======================================================== */}
        {activeTab === "dispatch" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <Send size={16} className="text-amber-400" />
                  Material Dispatch & Faculty Issue Register
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Official logged distribution slips issued to Teachers, Administrative departments, Labs & Classrooms.
                </p>
              </div>

              <button
                onClick={() => handleOpenDispatchModal()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>Issue New Material</span>
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Voucher No</th>
                      <th className="p-3.5">Material Issued</th>
                      <th className="p-3.5 text-center">Quantity</th>
                      <th className="p-3.5">Faculty / Staff Member</th>
                      <th className="p-3.5">Destination Room / Dept</th>
                      <th className="p-3.5">Issue Purpose</th>
                      <th className="p-3.5 text-center">Return Status</th>
                      <th className="p-3.5">Date & Time</th>
                      <th className="p-3.5 text-center">Voucher PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dispatchLogs.map(log => {
                      const isPending = log.isReturnable && log.returnStatus === "Pending Return";
                      const isReturned = log.returnStatus === "Returned";
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                            #{log.voucherNo}
                          </td>
                          <td className="p-3.5 min-w-[180px]">
                            <p className="font-bold text-white text-xs">{log.itemName}</p>
                            <p className="text-[10px] text-slate-400">{log.category}</p>
                          </td>
                          <td className="p-3.5 text-center font-bold text-amber-400 whitespace-nowrap">
                            {log.qty} {log.unit}
                          </td>
                          <td className="p-3.5 min-w-[140px]">
                            <p className="font-bold text-slate-200">{log.issuedToStaff}</p>
                            {log.staffRole && (
                              <p className="text-[10px] text-slate-500">{log.staffRole}</p>
                            )}
                          </td>
                          <td className="p-3.5 font-bold text-emerald-400 min-w-[130px]">
                            {log.allocatedRoom}
                          </td>
                          <td className="p-3.5 text-slate-400 max-w-[180px] truncate" title={log.purpose}>
                            {log.purpose}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {log.isReturnable ? (
                              isReturned ? (
                                <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-bold">
                                  ✓ Returned
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleOpenReturnModal(log)}
                                  className="px-2.5 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-full text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 mx-auto"
                                  title="Mark as returned to store"
                                >
                                  <RotateCcw size={10} />
                                  <span>Pending (Return)</span>
                                </button>
                              )
                            ) : (
                              <span className="px-2.5 py-1 bg-slate-900 text-slate-500 rounded-full text-[10px] font-semibold">
                                Consumable
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                            {log.issuedDate}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                const item = storeItems.find(i => i.id === log.itemId);
                                generateDispatchVoucherPDF(log, item ? item.unitPrice : 250);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white rounded-lg transition-all cursor-pointer"
                              title="Download PDF Dispatch Voucher"
                            >
                              <Download size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {dispatchLogs.length === 0 && (
                  <div className="text-center py-12 space-y-2">
                    <Send size={36} className="text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No material dispatches recorded yet</p>
                    <p className="text-xs text-slate-500">Click &ldquo;Issue New Material&rdquo; to issue stock to teachers or rooms.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: GOODS INWARD (GRN) & VENDOR INVOICES               */}
        {/* ======================================================== */}
        {activeTab === "inward" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <ArrowDownLeft size={16} className="text-emerald-400" />
                  Vendor Goods Inward Purchase Receipts (GRN)
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Complete record of vendor delivery bills, invoices, items accepted, and payment statuses.
                </p>
              </div>

              <button
                onClick={() => handleOpenInwardModal()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <Plus size={14} />
                <span>New Inward Shipment</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inwardLogs.map(inward => (
                <div key={inward.id} className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-md hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
                    <div>
                      <p className="font-mono text-xs font-bold text-amber-400">#{inward.inwardNo}</p>
                      <h4 className="text-sm font-bold text-white mt-0.5">{inward.vendorName}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">{inward.vendorCode}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                      inward.paymentStatus === "Paid"
                        ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                        : inward.paymentStatus === "Pending"
                        ? "bg-rose-500/20 border-rose-500/30 text-rose-300"
                        : "bg-amber-500/20 border-amber-500/30 text-amber-300"
                    }`}>
                      {inward.paymentStatus}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bill / Invoice No:</span>
                      <strong className="text-white font-mono">{inward.billNo}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Receipt Date:</span>
                      <span className="text-slate-200">{inward.date}</span>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-xl space-y-1 mt-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Items Inwarded:</p>
                      {inward.itemsReceived.map((item, i) => (
                        <div key={i} className="flex justify-between text-[11px] pt-0.5">
                          <span className="text-slate-300 font-medium">{item.itemName}</span>
                          <span className="font-bold text-emerald-400 whitespace-nowrap ml-2">
                            {item.qty} units @ ₹{item.unitPrice}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                    <span className="text-[11px] text-slate-400">Received By: {inward.receivedBy}</span>
                    <p className="text-sm font-black text-emerald-400">
                      ₹ {inward.billAmount.toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {inwardLogs.length === 0 && (
              <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-2">
                <ArrowDownLeft size={36} className="text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No goods inward receipts yet</p>
                <p className="text-xs text-slate-500">Record supplier shipments and replenishment deliveries using &ldquo;New Inward Shipment&rdquo;.</p>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: MATERIAL RETURNS TO STORE                         */}
        {/* ======================================================== */}
        {activeTab === "returns" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <RotateCcw size={16} className="text-indigo-400" />
                  Store Returns & Equipment Check-In Log
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Track returned project equipment, loaner laptops, projectors, cables, and recovered classroom assets.
                </p>
              </div>

              <button
                onClick={() => handleOpenReturnModal()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <RotateCcw size={14} />
                <span>Log Material Return</span>
              </button>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Return Voucher</th>
                      <th className="p-3.5">Material Returned</th>
                      <th className="p-3.5 text-center">Returned Qty</th>
                      <th className="p-3.5">Returned By Faculty</th>
                      <th className="p-3.5">Returned From Room</th>
                      <th className="p-3.5">Physical Condition</th>
                      <th className="p-3.5">Action Taken</th>
                      <th className="p-3.5">Return Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {returnLogs.map(ret => (
                      <tr key={ret.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-indigo-400 whitespace-nowrap">
                          #{ret.returnVoucherNo}
                        </td>
                        <td className="p-3.5 font-bold text-white min-w-[160px]">
                          {ret.itemName}
                        </td>
                        <td className="p-3.5 text-center font-bold text-indigo-300 whitespace-nowrap">
                          {ret.qty} {ret.unit}
                        </td>
                        <td className="p-3.5 font-bold text-slate-200">
                          {ret.returnedBy}
                        </td>
                        <td className="p-3.5 text-emerald-400 font-medium">
                          {ret.returnedFromRoom}
                        </td>
                        <td className="p-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            ret.condition === "Good (Restocked)"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          }`}>
                            {ret.condition}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-300 font-medium">
                          {ret.actionTaken}
                        </td>
                        <td className="p-3.5 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                          {ret.returnDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {returnLogs.length === 0 && (
                  <div className="text-center py-12 space-y-2">
                    <RotateCcw size={36} className="text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No returns logged yet</p>
                    <p className="text-xs text-slate-500">
                      When staff return projectors, cables, or surplus items, log them here to restore store balance.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: LOW-STOCK RE-ORDER RADAR                          */}
        {/* ======================================================== */}
        {activeTab === "reorder" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-rose-950/30 border border-rose-800/50 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={18} className="animate-bounce" />
                  Urgent Re-order Purchase Requisition Radar ({lowStockItems.length} SKUs)
                </h3>
                <p className="text-xs text-rose-200/80 mt-0.5">
                  The following school store items have fallen below safety threshold limits and require immediate vendor purchase orders.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={generateReorderPDF}
                  disabled={lowStockItems.length === 0}
                  className={`px-4 py-2 font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all ${
                    lowStockItems.length === 0
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-rose-600 hover:bg-rose-500 text-white cursor-pointer active:scale-95"
                  }`}
                >
                  <Download size={14} />
                  <span>Export Purchase Requisition PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockItems.map(item => {
                const shortfall = Math.max(1, (item.minReorderLevel * 2) - item.balanceQty);
                const estBudget = shortfall * item.unitPrice;
                return (
                  <div key={item.id} className="bg-slate-950/80 border border-rose-800/60 rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden">
                    <div className="w-1.5 h-full bg-rose-500 absolute left-0 top-0"></div>

                    <div className="pl-2">
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono font-bold text-rose-400 uppercase">{item.id}</span>
                        <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded text-[9px] font-black uppercase">
                          DEFICIT ALERT
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white leading-snug mt-1">{item.itemName}</h4>
                      <p className="text-[11px] text-slate-400">{item.category}</p>
                    </div>

                    <div className="pl-2 grid grid-cols-2 gap-2 p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Current Stock</p>
                        <p className="text-base font-black text-rose-400">{item.balanceQty} {item.unit}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold">Min Safety Threshold</p>
                        <p className="text-base font-bold text-slate-300">{item.minReorderLevel} {item.unit}</p>
                      </div>
                    </div>

                    <div className="pl-2 flex justify-between items-center text-xs">
                      <span className="text-slate-400 text-[11px]">Recommended Order:</span>
                      <span className="font-extrabold text-amber-400">+{shortfall} {item.unit} (₹ {estBudget.toLocaleString()})</span>
                    </div>

                    <div className="pl-2 pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                      <div>
                        <p className="text-[10px] text-slate-500">Vendor Supplier:</p>
                        <p className="text-xs font-bold text-slate-200">{item.vendorName}</p>
                      </div>
                      <button
                        onClick={() => handleOpenInwardModal(item)}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-xs"
                      >
                        <Plus size={11} />
                        <span>Order / Inward</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              {lowStockItems.length === 0 && (
                <div className="col-span-full py-16 text-center bg-slate-950/40 rounded-2xl border border-slate-800 space-y-3">
                  <CheckCircle2 size={42} className="text-emerald-400 mx-auto" />
                  <h4 className="text-base font-bold text-white">All School Store Stock Levels Adequate!</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    None of the materials in the school store catalog are currently below their minimum safety thresholds.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: UNIFIED STOCK LEDGER & AUDIT TRAIL                */}
        {/* ======================================================== */}
        {activeTab === "ledger" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-950/50 p-3.5 rounded-2xl border border-slate-800">
              <div>
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <History size={16} className="text-amber-400" />
                  Chronological School Store Material Ledger
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Unified audit timeline of every Inward purchase (+), Staff Dispatch (-), and Material Return (+).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  Total Transactions: {dispatchLogs.length + inwardLogs.length + returnLogs.length}
                </span>
              </div>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Date & Time</th>
                      <th className="p-3.5 text-center">Type</th>
                      <th className="p-3.5">Voucher Reference</th>
                      <th className="p-3.5">Material Description</th>
                      <th className="p-3.5 text-center">Quantity Impact</th>
                      <th className="p-3.5">Party / Location</th>
                      <th className="p-3.5">Store Authority</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {/* Interleaved Ledger Items sorted by date/createdAt */}
                    {[
                      ...inwardLogs.map(inw => ({
                        type: "INWARD" as const,
                        date: inw.date,
                        voucher: inw.inwardNo,
                        desc: inw.itemsReceived.map(i => `${i.itemName} (${i.qty})`).join(", "),
                        qtyImpact: `+${inw.itemsReceived.reduce((a, c) => a + c.qty, 0)}`,
                        party: inw.vendorName,
                        authority: inw.receivedBy,
                        createdAt: inw.createdAt
                      })),
                      ...dispatchLogs.map(dsp => ({
                        type: "DISPATCH" as const,
                        date: dsp.issuedDate,
                        voucher: `#${dsp.voucherNo}`,
                        desc: `${dsp.itemName} (${dsp.category})`,
                        qtyImpact: `-${dsp.qty} ${dsp.unit}`,
                        party: `${dsp.issuedToStaff} (${dsp.allocatedRoom})`,
                        authority: dsp.issuedBy,
                        createdAt: dsp.createdAt
                      })),
                      ...returnLogs.map(ret => ({
                        type: "RETURN" as const,
                        date: ret.returnDate,
                        voucher: `#${ret.returnVoucherNo}`,
                        desc: ret.itemName,
                        qtyImpact: `+${ret.qty} ${ret.unit}`,
                        party: `${ret.returnedBy} (${ret.returnedFromRoom})`,
                        authority: ret.receivedBy,
                        createdAt: ret.createdAt
                      }))
                    ]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              entry.type === "INWARD"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : entry.type === "DISPATCH"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            }`}>
                              {entry.type === "INWARD" ? "📥 INWARD" : entry.type === "DISPATCH" ? "📤 ISSUE" : "🔄 RETURN"}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {entry.voucher}
                          </td>
                          <td className="p-3.5 font-bold text-white min-w-[200px]">
                            {entry.desc}
                          </td>
                          <td className="p-3.5 text-center font-black whitespace-nowrap">
                            <span className={entry.qtyImpact.startsWith("+") ? "text-emerald-400" : "text-amber-400"}>
                              {entry.qtyImpact}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-300 min-w-[160px]">
                            {entry.party}
                          </td>
                          <td className="p-3.5 text-slate-400 text-[11px]">
                            {entry.authority}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: ADD OR EDIT STORE ITEM MASTER                   */}
      {/* ======================================================== */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package size={17} className="text-amber-400" />
                {editItemId ? "Edit Store Material SKU" : "Register New School Store Item"}
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setShowEditModal(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Item / Material Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formItemName}
                  onChange={e => setFormItemName(e.target.value)}
                  placeholder="e.g. A4 Paper Bundles (JK Copier 75 GSM), Whiteboard Markers, USB Mouse"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Category Group</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {STORE_CATEGORIES.filter(c => c !== "All Categories").map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material Type</label>
                  <select
                    value={formItemType}
                    onChange={e => setFormItemType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Consumable">Consumable (Count Only)</option>
                    <option value="Fixed Asset / Equipment">Fixed Asset / Equipment (Trackable)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit of Measure</label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    {UNIT_TYPES.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    {editItemId ? "Total Purchased" : "Initial Inward Qty"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formTotalQty}
                    onChange={e => setFormTotalQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Min Re-Order Alert</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinReorder}
                    onChange={e => setFormMinReorder(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Purchase Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={formUnitPrice}
                    onChange={e => setFormUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    value={formRackLocation}
                    onChange={e => setFormRackLocation(e.target.value)}
                    placeholder="e.g. Rack A-01, Shelf 2, IT Cupboard"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary Vendor Supplier</label>
                  <input
                    type="text"
                    value={formVendorName}
                    onChange={e => setFormVendorName(e.target.value)}
                    placeholder="e.g. Sri Laxmi Paper Mart, TechnoVision"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor Code / GST</label>
                  <input
                    type="text"
                    value={formVendorCode}
                    onChange={e => setFormVendorCode(e.target.value)}
                    placeholder="e.g. VND-PAP-01"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 uppercase font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial / Barcode Tag (Optional)</label>
                  <input
                    type="text"
                    value={formSerial}
                    onChange={e => setFormSerial(e.target.value)}
                    placeholder="e.g. SN-88219401"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Warranty Expiry (Optional)</label>
                  <input
                    type="date"
                    value={formWarranty}
                    onChange={e => setFormWarranty(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks & Usage Notes</label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                  placeholder="e.g. Specifically reserved for Examination Cell and Secondary Staff"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all"
                >
                  {editItemId ? "Save SKU Changes" : "Confirm & Save SKU"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: MATERIAL ISSUE & DISPATCH TO STAFF / ROOM       */}
      {/* ======================================================== */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Send size={17} className="text-amber-400" />
                Issue School Store Material to Faculty / Room
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Select Material SKU to Issue <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={dispSelectedItemId}
                  onChange={e => {
                    setDispSelectedItemId(e.target.value);
                    const selected = storeItems.find(i => i.id === e.target.value);
                    if (selected) {
                      setDispIsReturnable(selected.itemType === "Fixed Asset / Equipment");
                    }
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {storeItems.map(item => (
                    <option key={item.id} value={item.id} disabled={item.balanceQty <= 0}>
                      {item.itemName} — (Balance: {item.balanceQty} {item.unit}) {item.balanceQty <= 0 ? "[OUT OF STOCK]" : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Item Quick Snapshot */}
              {(() => {
                const target = storeItems.find(i => i.id === dispSelectedItemId);
                if (!target) return null;
                return (
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-bold text-white">{target.itemName}</p>
                      <p className="text-[10px] text-slate-400">Location: {target.rackLocation || "Main Store"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Available Balance</p>
                      <p className="text-sm font-black text-emerald-400">{target.balanceQty} {target.unit}</p>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Quantity to Issue <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={dispQty}
                    onChange={e => setDispQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Returnable Asset?
                  </label>
                  <select
                    value={dispIsReturnable ? "yes" : "no"}
                    onChange={e => setDispIsReturnable(e.target.value === "yes")}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="no">No (Consumable item)</option>
                    <option value="yes">Yes (Returnable Equipment)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Teacher / Staff Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={dispStaffName}
                    onChange={e => setDispStaffName(e.target.value)}
                    placeholder="e.g. Smt. K. Anitha, Mr. Ramesh"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Faculty Designation / Role</label>
                  <input
                    type="text"
                    value={dispStaffRole}
                    onChange={e => setDispStaffRole(e.target.value)}
                    placeholder="e.g. Science HOD, Grade 5 Class Teacher"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Destination Classroom / Room / Lab <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={dispRoom}
                  onChange={e => setDispRoom(e.target.value)}
                  placeholder="e.g. Class 10-A, Science Lab 2, Principal Office, Staff Room"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {dispIsReturnable && (
                <div>
                  <label className="block text-[10px] font-bold text-amber-400 uppercase mb-1">
                    Expected Return Date (Returnable Item)
                  </label>
                  <input
                    type="date"
                    value={dispExpectedReturn}
                    onChange={e => setDispExpectedReturn(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-amber-800/80 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purpose / Remarks</label>
                <input
                  type="text"
                  value={dispPurpose}
                  onChange={e => setDispPurpose(e.target.value)}
                  placeholder="e.g. Annual Exams Preparation, Lab Experiment, Unit Test question papers"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Send size={14} />
                  <span>Issue & Generate Voucher PDF</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: GOODS INWARD / SUPPLIER SHIPMENT (GRN)          */}
      {/* ======================================================== */}
      {showInwardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ArrowDownLeft size={17} className="text-emerald-400" />
                Record Vendor Goods Inward Receipt (GRN)
              </h3>
              <button onClick={() => setShowInwardModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmInward} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Store Material SKU Being Replenished <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={inwSelectedItemId}
                  onChange={e => {
                    setInwSelectedItemId(e.target.value);
                    const selected = storeItems.find(i => i.id === e.target.value);
                    if (selected) {
                      setInwVendor(selected.vendorName);
                      setInwVendorCode(selected.vendorCode);
                      setInwUnitPrice(selected.unitPrice);
                    }
                  }}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {storeItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.itemName} — (Current: {item.balanceQty} {item.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Quantity Received <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={inwQty}
                    onChange={e => setInwQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={inwUnitPrice}
                    onChange={e => setInwUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor Bill / Invoice No</label>
                  <input
                    type="text"
                    required
                    value={inwBillNo}
                    onChange={e => setInwBillNo(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bill Date</label>
                  <input
                    type="date"
                    required
                    value={inwBillDate}
                    onChange={e => setInwBillDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor Supplier Name</label>
                  <input
                    type="text"
                    value={inwVendor}
                    onChange={e => setInwVendor(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Payment Settlement Status</label>
                  <select
                    value={inwPaymentStatus}
                    onChange={e => setInwPaymentStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Paid">Paid (Cheque / Direct Bank Transfer)</option>
                    <option value="Pending">Pending (Credit Invoice)</option>
                    <option value="Partial">Partial Advance Paid</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Purchase Value:</span>
                <span className="text-base font-black text-emerald-400">
                  ₹ {(Number(inwQty) * Number(inwUnitPrice)).toLocaleString()}
                </span>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <ArrowDownLeft size={14} />
                  <span>Accept Goods & Update Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: MATERIAL RETURN CHECK-IN                       */}
      {/* ======================================================== */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <RotateCcw size={17} className="text-indigo-400" />
                Material Return & Store Recovery Check-In
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReturn} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Item Being Returned to Store <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={retSelectedItemId}
                  onChange={e => setRetSelectedItemId(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                >
                  {storeItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.itemName} ({item.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Return Quantity <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={retQty}
                    onChange={e => setRetQty(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                    Origin Dispatch Voucher (If Any)
                  </label>
                  <input
                    type="text"
                    value={retDispatchVoucher}
                    onChange={e => setRetDispatchVoucher(e.target.value)}
                    placeholder="e.g. DISPATCH-88103"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Returned By Faculty / Staff</label>
                  <input
                    type="text"
                    required
                    value={retStaff}
                    onChange={e => setRetStaff(e.target.value)}
                    placeholder="e.g. Mr. Ramesh, Smt. K. Anitha"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Returned From Room / Lab</label>
                  <input
                    type="text"
                    required
                    value={retRoom}
                    onChange={e => setRetRoom(e.target.value)}
                    placeholder="e.g. Science Lab 2, Class 10-A"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Physical Condition</label>
                  <select
                    value={retCondition}
                    onChange={e => setRetCondition(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Good (Restocked)">Good (Fully Working & Ready)</option>
                    <option value="Slightly Damaged">Slightly Used / Minor Wear</option>
                    <option value="Damaged (Quarantined)">Damaged / Defective (Needs Repair)</option>
                    <option value="Partially Consumed">Partially Consumed Stationery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Action</label>
                  <select
                    value={retAction}
                    onChange={e => setRetAction(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                  >
                    <option value="Restocked to Store Balance">Restock to Store Balance</option>
                    <option value="Quarantined for Repair">Quarantine for Repair</option>
                    <option value="Scrapped / Written Off">Scrap / Written Off</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Remarks & Inspection Notes</label>
                <textarea
                  rows={2}
                  value={retRemarks}
                  onChange={e => setRetRemarks(e.target.value)}
                  placeholder="e.g. Returned with projector bag and all power leads intact"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  <span>Confirm Return to Store</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 5: PRINTABLE SHELF / BIN LABEL STICKER            */}
      {/* ======================================================== */}
      {showBarcodeModal && activeItemForAction && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Tag size={17} className="text-amber-400" />
                Store Shelf / Bin Label Sticker
              </h3>
              <button onClick={() => setShowBarcodeModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Printable Sticker Tag Preview */}
            <div
              ref={printableLabelRef}
              className="bg-white text-slate-900 p-4 rounded-xl border-2 border-slate-400 shadow-md font-sans text-center space-y-2 select-none"
            >
              <div className="border-b border-slate-300 pb-1.5">
                <p className="text-[11px] font-black tracking-wider text-slate-800 uppercase">
                  BIRLA OPEN MINDS INTL SCHOOL
                </p>
                <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest">
                  CENTRAL STORE INVENTORY BIN TAG
                </p>
              </div>

              <div>
                <p className="text-base font-black text-slate-900 leading-tight">
                  {activeItemForAction.itemName}
                </p>
                <p className="text-[10px] text-slate-600 font-medium">
                  Category: {activeItemForAction.category}
                </p>
              </div>

              {/* Barcode Mock Visual */}
              <div className="py-2 flex flex-col items-center justify-center">
                <div className="h-10 w-48 flex items-center justify-center gap-0.5 bg-white p-1">
                  {Array.from({ length: 34 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-full bg-slate-900 ${
                        i % 3 === 0 ? "w-1" : i % 5 === 0 ? "w-1.5" : "w-0.5"
                      }`}
                    />
                  ))}
                </div>
                <p className="font-mono text-xs font-black tracking-widest text-slate-800 mt-1">
                  *{activeItemForAction.id}*
                </p>
              </div>

              <div className="pt-1.5 border-t border-slate-200 grid grid-cols-2 text-left text-[10px] text-slate-700 font-semibold">
                <div>
                  <span className="text-slate-500">Rack / Bin: </span>
                  <strong className="text-slate-900 font-black">{activeItemForAction.rackLocation || "Main Store"}</strong>
                </div>
                <div className="text-right">
                  <span className="text-slate-500">Min Safety: </span>
                  <strong className="text-slate-900 font-black">{activeItemForAction.minReorderLevel} {activeItemForAction.unit}</strong>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              Ready to print on 4&times;2.5 inch thermal adhesive label or regular paper for shelf bins.
            </p>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBarcodeModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                onClick={handlePrintLabel}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl shadow-md cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Print Shelf Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
