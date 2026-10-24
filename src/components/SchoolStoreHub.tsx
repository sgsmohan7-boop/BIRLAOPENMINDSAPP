import React, { useState, useEffect } from "react";
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
  RefreshCw
} from "lucide-react";

export interface StoreItem {
  id: string;
  itemName: string;
  category: string;
  totalQty: number;
  issuedQty: number;
  balanceQty: number;
  minReorderLevel: number;
  unitPrice: number;
  vendorName: string;
  vendorCode: string;
  invoiceNo?: string;
  purchaseDate: string;
  warrantyExpiry?: string;
  serialNumber?: string;
  remarks?: string;
}

export interface DispatchLog {
  id: string;
  voucherNo: string;
  itemId: string;
  itemName: string;
  category: string;
  qty: number;
  issuedToStaff: string;
  allocatedRoom: string; // e.g., Class 1-A, Science Lab
  purpose: string;
  issuedDate: string;
  issuedBy: string;
}

export interface InwardLog {
  id: string;
  inwardNo: string;
  vendorName: string;
  vendorCode: string;
  billNo: string;
  billAmount: number;
  paymentStatus: "Paid" | "Pending" | "Partial";
  itemsReceived: {
    itemName: string;
    qty: number;
    unitPrice: number;
  }[];
  date: string;
  receivedBy: string;
}

export default function SchoolStoreHub() {
  const [activeTab, setActiveTab] = useState<"inventory" | "dispatch" | "inward" | "ledger" | "reorder">("inventory");

  // Initial Demo Data for School Store
  const [storeItems, setStoreItems] = useState<StoreItem[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_items");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "STORE-101",
        itemName: "A4 Paper Bundles (JK Copier 75 GSM)",
        category: "Stationery & Exam Supplies",
        totalQty: 100,
        issuedQty: 65,
        balanceQty: 35,
        minReorderLevel: 15,
        unitPrice: 280,
        vendorName: "Sri Laxmi Paper Mart",
        vendorCode: "VND-PAP-01",
        invoiceNo: "INV-2026-881",
        purchaseDate: "10-01-2026",
        remarks: "Main exam paper stock"
      },
      {
        id: "STORE-102",
        itemName: "Optical USB Mouse (Logitech B100)",
        category: "Computer Lab & IT Spares",
        totalQty: 30,
        issuedQty: 27,
        balanceQty: 3, // ⚠️ LOW STOCK
        minReorderLevel: 5,
        unitPrice: 350,
        vendorName: "TechnoVision Systems",
        vendorCode: "VND-TECH-04",
        invoiceNo: "INV-2026-902",
        purchaseDate: "15-01-2026",
        serialNumber: "LOG-M-2026-001 TO 030",
        remarks: "Computer Lab 1 & 2 mice"
      },
      {
        id: "STORE-103",
        itemName: "Epson Black Printer Ink Cartridge 003",
        category: "Printers & Ink Cartridges",
        totalQty: 10,
        issuedQty: 9,
        balanceQty: 1, // ⚠️ LOW STOCK
        minReorderLevel: 2,
        unitPrice: 650,
        vendorName: "Sri Laxmi Paper Mart",
        vendorCode: "VND-PAP-01",
        invoiceNo: "INV-2026-910",
        purchaseDate: "02-02-2026",
        remarks: "Admin & Principal room printers"
      },
      {
        id: "STORE-104",
        itemName: "Whiteboard Dry Erase Markers (Pack of 10)",
        category: "Stationery & Exam Supplies",
        totalQty: 50,
        issuedQty: 20,
        balanceQty: 30,
        minReorderLevel: 10,
        unitPrice: 220,
        vendorName: "Balaji Stationery Wholesalers",
        vendorCode: "VND-BAL-02",
        purchaseDate: "12-02-2026"
      },
      {
        id: "STORE-105",
        itemName: "Grade 1-5 Academic Student Handbooks",
        category: "Textbooks & Workbooks",
        totalQty: 250,
        issuedQty: 210,
        balanceQty: 40,
        minReorderLevel: 20,
        unitPrice: 180,
        vendorName: "Birla Publications Hub",
        vendorCode: "VND-PUB-09",
        purchaseDate: "05-01-2026"
      },
      {
        id: "STORE-106",
        itemName: "Epson Smart Class Projector EB-E01",
        category: "Smart Class & Fixed Assets",
        totalQty: 5,
        issuedQty: 4,
        balanceQty: 1,
        minReorderLevel: 1,
        unitPrice: 38500,
        vendorName: "TechnoVision Systems",
        vendorCode: "VND-TECH-04",
        invoiceNo: "INV-PROJ-2026",
        purchaseDate: "01-01-2026",
        warrantyExpiry: "01-01-2028",
        serialNumber: "EP-PROJ-882193",
        remarks: "Class 10-A, 10-B, Lab, AV Room"
      }
    ];
  });

  const [dispatchLogs, setDispatchLogs] = useState<DispatchLog[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_dispatches");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "LOG-1",
        voucherNo: "DISPATCH-88102",
        itemId: "STORE-101",
        itemName: "A4 Paper Bundles (JK Copier 75 GSM)",
        category: "Stationery & Exam Supplies",
        qty: 5,
        issuedToStaff: "Smt. K. Anitha (Academic Coordinator)",
        allocatedRoom: "Exam Cell / Printing Dept",
        purpose: "Unit Test 2 Question Paper Printing",
        issuedDate: "20-02-2026 10:30 AM",
        issuedBy: "Store Manager"
      },
      {
        id: "LOG-2",
        voucherNo: "DISPATCH-88103",
        itemId: "STORE-102",
        itemName: "Optical USB Mouse (Logitech B100)",
        category: "Computer Lab & IT Spares",
        qty: 2,
        issuedToStaff: "Mr. Ramesh V. (Computer Teacher)",
        allocatedRoom: "Computer Lab 1 (System #12, #14)",
        purpose: "Defective mouse replacement",
        issuedDate: "22-02-2026 02:15 PM",
        issuedBy: "Store Manager"
      }
    ];
  });

  const [inwardLogs, setInwardLogs] = useState<InwardLog[]>(() => {
    try {
      const saved = localStorage.getItem("bims_school_store_inwards");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "INW-1",
        inwardNo: "INWARD-2026-01",
        vendorName: "Sri Laxmi Paper Mart",
        vendorCode: "VND-PAP-01",
        billNo: "INV-2026-881",
        billAmount: 28000,
        paymentStatus: "Paid",
        itemsReceived: [
          { itemName: "A4 Paper Bundles (JK Copier 75 GSM)", qty: 100, unitPrice: 280 }
        ],
        date: "10-01-2026",
        receivedBy: "Store Manager"
      },
      {
        id: "INW-2",
        inwardNo: "INWARD-2026-02",
        vendorName: "TechnoVision Systems",
        vendorCode: "VND-TECH-04",
        billNo: "INV-2026-902",
        billAmount: 10500,
        paymentStatus: "Pending",
        itemsReceived: [
          { itemName: "Optical USB Mouse (Logitech B100)", qty: 30, unitPrice: 350 }
        ],
        date: "15-01-2026",
        receivedBy: "Store Manager"
      }
    ];
  });

  // Save changes to LocalStorage
  useEffect(() => {
    localStorage.setItem("bims_school_store_items", JSON.stringify(storeItems));
  }, [storeItems]);

  useEffect(() => {
    localStorage.setItem("bims_school_store_dispatches", JSON.stringify(dispatchLogs));
  }, [dispatchLogs]);

  useEffect(() => {
    localStorage.setItem("bims_school_store_inwards", JSON.stringify(inwardLogs));
  }, [inwardLogs]);

  // UI state for search and modals
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showInwardModal, setShowInwardModal] = useState(false);

  // Form states for Add Item
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Stationery & Exam Supplies");
  const [newItemQty, setNewItemQty] = useState(10);
  const [newItemMinReorder, setNewItemMinReorder] = useState(5);
  const [newItemUnitPrice, setNewItemUnitPrice] = useState(100);
  const [newItemVendor, setNewItemVendor] = useState("");
  const [newItemVendorCode, setNewItemVendorCode] = useState("");
  const [newItemInvoiceNo, setNewItemInvoiceNo] = useState("");
  const [newItemSerial, setNewItemSerial] = useState("");
  const [newItemWarranty, setNewItemWarranty] = useState("");
  const [newItemRemarks, setNewItemRemarks] = useState("");

  // Form states for Dispatch
  const [dispatchItemId, setDispatchItemId] = useState("");
  const [dispatchStaff, setDispatchStaff] = useState("");
  const [dispatchRoom, setDispatchRoom] = useState("");
  const [dispatchQty, setDispatchQty] = useState(1);
  const [dispatchPurpose, setDispatchPurpose] = useState("");

  // Categories list
  const categoriesList = [
    "All",
    "Stationery & Exam Supplies",
    "Computer Lab & IT Spares",
    "Printers & Ink Cartridges",
    "Textbooks & Workbooks",
    "Uniforms & Accessories",
    "Smart Class & Fixed Assets",
    "Housekeeping & Hygiene Supplies",
    "Sports & Physical Edu Equipment"
  ];

  // Derived low stock items
  const lowStockItems = storeItems.filter(item => item.balanceQty <= item.minReorderLevel);

  // Filtered store items
  const filteredStoreItems = storeItems.filter(item => {
    const matchesSearch =
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  // Total valuations
  const totalStoreValue = storeItems.reduce((acc, item) => acc + item.balanceQty * item.unitPrice, 0);
  const totalDispatchedCount = dispatchLogs.reduce((acc, log) => acc + log.qty, 0);

  // Handler: Add New Store Item / Inward Purchase
  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || newItemQty <= 0) {
      alert("Please provide a valid item name and purchase quantity!");
      return;
    }

    const newId = `STORE-${100 + storeItems.length + 1}`;
    const vCode = newItemVendorCode.trim()
      ? newItemVendorCode.trim().toUpperCase()
      : `VND-${(newItemVendor || "GEN").replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;

    const dateToday = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");

    const itemObj: StoreItem = {
      id: newId,
      itemName: newItemName.trim(),
      category: newItemCategory,
      totalQty: Number(newItemQty),
      issuedQty: 0,
      balanceQty: Number(newItemQty),
      minReorderLevel: Number(newItemMinReorder),
      unitPrice: Number(newItemUnitPrice),
      vendorName: newItemVendor.trim() || "General Supplier",
      vendorCode: vCode,
      invoiceNo: newItemInvoiceNo.trim() || undefined,
      purchaseDate: dateToday,
      warrantyExpiry: newItemWarranty.trim() || undefined,
      serialNumber: newItemSerial.trim() || undefined,
      remarks: newItemRemarks.trim() || undefined
    };

    setStoreItems([itemObj, ...storeItems]);

    // Record Inward Log
    const newInwardLog: InwardLog = {
      id: `INW-${inwardLogs.length + 1}`,
      inwardNo: `INWARD-2026-${String(inwardLogs.length + 1).padStart(2, "0")}`,
      vendorName: itemObj.vendorName,
      vendorCode: itemObj.vendorCode,
      billNo: newItemInvoiceNo.trim() || `BILL-${Date.now().toString().slice(-6)}`,
      billAmount: Number(newItemQty) * Number(newItemUnitPrice),
      paymentStatus: "Paid",
      itemsReceived: [
        { itemName: itemObj.itemName, qty: Number(newItemQty), unitPrice: Number(newItemUnitPrice) }
      ],
      date: dateToday,
      receivedBy: "Store Manager"
    };

    setInwardLogs([newInwardLog, ...inwardLogs]);

    // Reset Form
    setShowAddModal(false);
    setNewItemName("");
    setNewItemQty(10);
    setNewItemUnitPrice(100);
    setNewItemVendor("");
    setNewItemVendorCode("");
    setNewItemInvoiceNo("");
    setNewItemSerial("");
    setNewItemWarranty("");
    setNewItemRemarks("");
  };

  // Handler: Issue / Dispatch Material to Staff or Room
  const handleConfirmDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchItemId) {
      alert("Please select an item to issue!");
      return;
    }
    if (!dispatchStaff.trim() || !dispatchRoom.trim()) {
      alert("Please specify the receiving Teacher/Staff and Room or Class!");
      return;
    }

    const targetIndex = storeItems.findIndex(i => i.id === dispatchItemId);
    if (targetIndex === -1) return;

    const item = storeItems[targetIndex];
    if (dispatchQty > item.balanceQty) {
      alert(`Cannot issue ${dispatchQty} units! Only ${item.balanceQty} units available in store balance.`);
      return;
    }

    // Update Store Balances
    const updatedItems = [...storeItems];
    const newIssued = item.issuedQty + Number(dispatchQty);
    const newBal = item.totalQty - newIssued;

    updatedItems[targetIndex] = {
      ...item,
      issuedQty: newIssued,
      balanceQty: newBal
    };

    setStoreItems(updatedItems);

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    const voucherNo = `DISPATCH-${Date.now().toString().slice(-6)}`;

    // Create Dispatch Log
    const newLog: DispatchLog = {
      id: `LOG-${dispatchLogs.length + 1}`,
      voucherNo,
      itemId: item.id,
      itemName: item.itemName,
      category: item.category,
      qty: Number(dispatchQty),
      issuedToStaff: dispatchStaff.trim(),
      allocatedRoom: dispatchRoom.trim(),
      purpose: dispatchPurpose.trim() || "School Staff Allocation",
      issuedDate: nowStr,
      issuedBy: "Store Manager"
    };

    setDispatchLogs([newLog, ...dispatchLogs]);

    // Generate Instant Voucher PDF
    generateDispatchVoucherPDF(newLog, item.unitPrice);

    // Reset modal
    setShowDispatchModal(false);
    setDispatchItemId("");
    setDispatchStaff("");
    setDispatchRoom("");
    setDispatchQty(1);
    setDispatchPurpose("");
  };

  // PDF Generator: Material Dispatch Voucher
  const generateDispatchVoucherPDF = (log: DispatchLog, unitPrice: number) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Title Banner
      doc.setFillColor(221, 107, 32); // Brand Orange (#DD6B20)
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("SCHOOL STORE MATERIAL ISSUE & DISPATCH VOUCHER", 14, 21);

      doc.setFont("helvetica", "bold");
      doc.text(`VOUCHER NO: #${log.voucherNo}`, 135, 14);
      doc.setFont("helvetica", "normal");
      doc.text(`Issued Date: ${log.issuedDate}`, 135, 21);

      // Section 1: Details
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RECIPIENT & ALLOCATION DETAILS", 14, 48);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text([
        `Issued To Staff / Teacher: ${log.issuedToStaff}`,
        `Allocated Room / Class: ${log.allocatedRoom}`,
        `Purpose / Remarks: ${log.purpose}`,
        `Issuing Store Authority: ${log.issuedBy}`
      ], 14, 55);

      // Section 2: Material Table
      const tableColumn = ["S.No", "Item Code", "Material Name", "Category Group", "Qty Issued", "Unit Price", "Valuation"];
      const subtotal = log.qty * unitPrice;
      const tableRows = [
        ["1", log.itemId, log.itemName, log.category, `${log.qty} Units`, `INR ${unitPrice.toLocaleString()}`, `INR ${subtotal.toLocaleString()}`]
      ];

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 75,
        theme: "striped",
        headStyles: { fillColor: [221, 107, 32], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 120;
      const sigY = Math.min(250, finalY + 35);

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);

      doc.line(14, sigY, 75, sigY);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("RECEIVER TEACHER / STAFF SIGNATURE", 14, sigY + 5);

      doc.line(135, sigY, 195, sigY);
      doc.text("STORE IN-CHARGE SIGNATURE", 135, sigY + 5);

      doc.save(`School_Store_Dispatch_${log.voucherNo}.pdf`);
    } catch (err: any) {
      alert(`PDF Generation error: ${err.message}`);
    }
  };

  // PDF Generator: Re-Order Alert Purchase Requisition
  const generateReorderPDF = () => {
    if (lowStockItems.length === 0) {
      alert("No store items are currently at or below minimum safety stock levels!");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(185, 28, 28); // Red
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("URGENT SCHOOL STORE RE-ORDER & PURCHASE REQUISITION", 14, 21);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 135, 14);

      const tableColumn = ["S.No", "Store ID", "Material Name", "Category", "Current Stock", "Min Re-order Level", "Vendor Supplier"];
      const tableRows = lowStockItems.map((item, idx) => [
        (idx + 1).toString(),
        item.id,
        item.itemName,
        item.category,
        `${item.balanceQty} Units`,
        `${item.minReorderLevel} Units`,
        `${item.vendorName} (${item.vendorCode})`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: "striped",
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [40, 40, 40] }
      });

      doc.save(`School_Store_Low_Stock_Reorder_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(`PDF export error: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-900 text-slate-100 overflow-hidden font-sans">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-slate-800 p-5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400 shrink-0">
              <Store size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-black text-white tracking-wide uppercase">
                  School Store & Material Issue Hub
                </h1>
                <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-[10px] font-black text-amber-300 uppercase tracking-wider">
                  Store Master
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized School Material Distribution, Stock Inward Slips, Teacher Dispatches & Low-Stock Radars
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowDispatchModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Send size={15} />
              <span>⚡ Issue Item to Teacher/Room</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Plus size={15} />
              <span>New Stock Purchase</span>
            </button>
          </div>
        </div>

        {/* Quick KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Store Items</p>
              <p className="text-lg font-black text-white mt-0.5">{storeItems.length}</p>
            </div>
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Package size={18} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Inventory Valuation</p>
              <p className="text-lg font-black text-emerald-400 mt-0.5">₹ {totalStoreValue.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp size={18} />
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Dispatches</p>
              <p className="text-lg font-black text-amber-400 mt-0.5">{dispatchLogs.length} Vouchers</p>
            </div>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Send size={18} />
            </div>
          </div>

          <div className={`p-3 rounded-xl border flex items-center justify-between ${
            lowStockItems.length > 0
              ? "bg-rose-950/40 border-rose-800 text-rose-300"
              : "bg-slate-950/60 border-slate-800 text-slate-300"
          }`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider">Low Stock Warnings</p>
              <p className="text-lg font-black mt-0.5 text-rose-400">{lowStockItems.length} Items</p>
            </div>
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
              <AlertTriangle size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="bg-slate-950/80 border-b border-slate-800 px-5 py-2 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <button
          onClick={() => setActiveTab("inventory")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "inventory"
              ? "bg-amber-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <Package size={15} />
          <span>School Store Stock Register ({storeItems.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("dispatch")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "dispatch"
              ? "bg-amber-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <Send size={15} />
          <span>Material Issue & Dispatches ({dispatchLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("inward")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "inward"
              ? "bg-amber-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <FileText size={15} />
          <span>Vendor Stock Inward Receipts</span>
        </button>

        <button
          onClick={() => setActiveTab("reorder")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer relative ${
            activeTab === "reorder"
              ? "bg-rose-600 text-white shadow-md"
              : "text-slate-400 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <AlertTriangle size={15} />
          <span>Low-Stock Re-Order Radar</span>
          {lowStockItems.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping absolute top-1.5 right-1.5"></span>
          )}
        </button>
      </div>

      {/* Main Tab Content View */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
        {/* TAB 1: SCHOOL STORE STOCK REGISTER */}
        {activeTab === "inventory" && (
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
              <div className="relative w-full sm:w-80">
                <Search size={15} className="absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search store items, vendors, IDs..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto custom-scrollbar">
                <Filter size={14} className="text-slate-500 shrink-0" />
                <div className="flex gap-1">
                  {categoriesList.slice(0, 5).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-amber-500/20 border border-amber-500/40 text-amber-300"
                          : "bg-slate-900 text-slate-400 hover:bg-slate-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Store Table */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Store ID</th>
                      <th className="p-3.5">Material / Item Details</th>
                      <th className="p-3.5">Category</th>
                      <th className="p-3.5 text-center">Purchased</th>
                      <th className="p-3.5 text-center">Dispatched</th>
                      <th className="p-3.5 text-center">Current Balance</th>
                      <th className="p-3.5">Vendor Supplier</th>
                      <th className="p-3.5 text-right">Unit Cost</th>
                      <th className="p-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredStoreItems.map(item => {
                      const isLow = item.balanceQty <= item.minReorderLevel;
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-amber-400">{item.id}</td>
                          <td className="p-3.5">
                            <p className="font-bold text-white text-xs">{item.itemName}</p>
                            {item.serialNumber && (
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                S/N: {item.serialNumber}
                              </p>
                            )}
                          </td>
                          <td className="p-3.5">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-300">{item.totalQty}</td>
                          <td className="p-3.5 text-center font-bold text-amber-400">{item.issuedQty}</td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              isLow
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}>
                              {item.balanceQty} {isLow && "⚠️ LOW"}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <p className="font-bold text-slate-200">{item.vendorName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.vendorCode}</p>
                          </td>
                          <td className="p-3.5 text-right font-bold text-emerald-400">
                            ₹ {item.unitPrice.toLocaleString()}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => {
                                setDispatchItemId(item.id);
                                setShowDispatchModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] rounded-lg transition-all shadow-xs cursor-pointer flex items-center gap-1 mx-auto"
                            >
                              <Send size={12} />
                              <span>Issue</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MATERIAL DISPATCH HISTORY */}
        {activeTab === "dispatch" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Send size={16} className="text-amber-400" />
                Material Dispatch Voucher History
              </h3>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 border-b border-slate-800 uppercase font-black text-slate-400 text-[10px] tracking-wider">
                    <tr>
                      <th className="p-3.5">Voucher No</th>
                      <th className="p-3.5">Material Name</th>
                      <th className="p-3.5 text-center">Issued Qty</th>
                      <th className="p-3.5">Assigned Teacher / Staff</th>
                      <th className="p-3.5">Room / Class Dept</th>
                      <th className="p-3.5">Issued Date & Time</th>
                      <th className="p-3.5 text-center">Receipt Voucher PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {dispatchLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-amber-400">#{log.voucherNo}</td>
                        <td className="p-3.5">
                          <p className="font-bold text-white text-xs">{log.itemName}</p>
                          <p className="text-[10px] text-slate-400">{log.category}</p>
                        </td>
                        <td className="p-3.5 text-center font-bold text-amber-400">{log.qty} Units</td>
                        <td className="p-3.5 font-bold text-slate-200">{log.issuedToStaff}</td>
                        <td className="p-3.5 font-bold text-emerald-400">{log.allocatedRoom}</td>
                        <td className="p-3.5 text-slate-400 font-mono text-[11px]">{log.issuedDate}</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => generateDispatchVoucherPDF(log, 200)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-white rounded-lg transition-all cursor-pointer"
                            title="Download PDF Voucher"
                          >
                            <Download size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STOCK INWARD RECEIPTS */}
        {activeTab === "inward" && (
          <div className="space-y-4">
            <div className="flex justify-between items-center bg-slate-950/40 p-3 rounded-2xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText size={16} className="text-amber-400" />
                Vendor Goods Inward Purchase Receipts
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inwardLogs.map(inward => (
                <div key={inward.id} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-2.5">
                    <div>
                      <p className="font-mono text-xs font-bold text-amber-400">#{inward.inwardNo}</p>
                      <p className="text-sm font-bold text-white">{inward.vendorName}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-lg text-[10px] font-black uppercase">
                      {inward.paymentStatus}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <p>Bill / Invoice No: <strong className="text-white">{inward.billNo}</strong></p>
                    <p>Inward Date: <strong className="text-white">{inward.date}</strong></p>
                    <div className="p-2 bg-slate-900 rounded-xl space-y-1">
                      {inward.itemsReceived.map((item, i) => (
                        <div key={i} className="flex justify-between text-[11px]">
                          <span>{item.itemName}</span>
                          <span className="font-bold text-amber-400">{item.qty} units @ ₹{item.unitPrice}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                    <p className="text-xs font-bold text-emerald-400">Total Bill Amount: ₹ {inward.billAmount.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: LOW-STOCK RE-ORDER RADAR */}
        {activeTab === "reorder" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-rose-950/30 border border-rose-800/50 p-4 rounded-2xl">
              <div>
                <h3 className="text-sm font-black text-rose-300 uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle size={18} className="animate-bounce" />
                  Urgent Re-order Purchase Requisition Radar
                </h3>
                <p className="text-xs text-rose-200/80 mt-0.5">
                  The following items have fallen below safety threshold limits and require immediate vendor purchase orders.
                </p>
              </div>

              <button
                onClick={generateReorderPDF}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
              >
                <Download size={14} />
                <span>Export Purchase Requisition PDF</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lowStockItems.map(item => (
                <div key={item.id} className="bg-slate-950/80 border border-rose-800/60 rounded-2xl p-4 space-y-3 shadow-lg relative overflow-hidden">
                  <div className="w-1.5 h-full bg-rose-500 absolute left-0 top-0"></div>

                  <div className="pl-2">
                    <span className="text-[10px] font-mono font-bold text-rose-400 uppercase">{item.id}</span>
                    <h4 className="text-sm font-bold text-white leading-snug">{item.itemName}</h4>
                    <p className="text-[11px] text-slate-400">{item.category}</p>
                  </div>

                  <div className="pl-2 grid grid-cols-2 gap-2 p-2.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Current Stock</p>
                      <p className="text-base font-black text-rose-400">{item.balanceQty} Units</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Min Safety Threshold</p>
                      <p className="text-base font-bold text-slate-300">{item.minReorderLevel} Units</p>
                    </div>
                  </div>

                  <div className="pl-2 pt-1 border-t border-slate-800 text-xs space-y-0.5">
                    <p className="text-slate-400 text-[11px]">Vendor: <strong className="text-slate-200">{item.vendorName}</strong> ({item.vendorCode})</p>
                  </div>
                </div>
              ))}

              {lowStockItems.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-950/40 rounded-2xl border border-slate-800 space-y-2">
                  <CheckCircle2 size={36} className="text-emerald-400 mx-auto" />
                  <p className="text-sm font-bold text-white">All School Store Stock Levels Adequate!</p>
                  <p className="text-xs text-slate-400">No materials currently require urgent re-ordering.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: NEW STOCK PURCHASE / INWARD */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Plus size={16} className="text-amber-400" />
                Add New School Store Material Purchase
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddNewItem} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Material / Item Name</label>
                <input
                  type="text"
                  required
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="e.g. A4 Paper Bundles, Whiteboard Markers, Mouses"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Store Category Group</label>
                  <select
                    value={newItemCategory}
                    onChange={e => setNewItemCategory(e.target.value)}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {categoriesList.filter(c => c !== "All").map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purchased Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemQty}
                    onChange={e => setNewItemQty(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newItemUnitPrice}
                    onChange={e => setNewItemUnitPrice(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Min Re-order Warning Level</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemMinReorder}
                    onChange={e => setNewItemMinReorder(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendor Supplier Name</label>
                  <input
                    type="text"
                    required
                    value={newItemVendor}
                    onChange={e => setNewItemVendor(e.target.value)}
                    placeholder="e.g. Sri Laxmi Paper Mart"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Invoice / Bill Number</label>
                  <input
                    type="text"
                    value={newItemInvoiceNo}
                    onChange={e => setNewItemInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-2026-881"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Serial Numbers / Asset IDs (Optional)</label>
                <input
                  type="text"
                  value={newItemSerial}
                  onChange={e => setNewItemSerial(e.target.value)}
                  placeholder="e.g. SN-99812 to SN-99830"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md"
                >
                  Save Store Inward Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DISPATCH / ISSUE MATERIAL TO TEACHER OR ROOM */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 text-slate-100 font-sans">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Send size={16} className="text-amber-400" />
                ⚡ Quick Issue Item to Staff / Room
              </h3>
              <button onClick={() => setShowDispatchModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDispatch} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Select Store Material Item</label>
                <select
                  required
                  value={dispatchItemId}
                  onChange={e => setDispatchItemId(e.target.value)}
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Choose Item from Store --</option>
                  {storeItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.itemName} (Balance: {item.balanceQty} units)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Receiving Teacher / Staff Name</label>
                <input
                  type="text"
                  required
                  value={dispatchStaff}
                  onChange={e => setDispatchStaff(e.target.value)}
                  placeholder="e.g. Smt. K. Anitha, Mr. Ramesh (Physics)"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Class Room / Department</label>
                  <input
                    type="text"
                    required
                    value={dispatchRoom}
                    onChange={e => setDispatchRoom(e.target.value)}
                    placeholder="e.g. Class 1-A, Science Lab, Staff Room"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Dispatch Quantity</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={dispatchQty}
                    onChange={e => setDispatchQty(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purpose / Notes</label>
                <input
                  type="text"
                  value={dispatchPurpose}
                  onChange={e => setDispatchPurpose(e.target.value)}
                  placeholder="e.g. For Unit Test Exam Papers, Computer Lab replacement"
                  className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-500/20 rounded-xl text-[11px] text-amber-300">
                📄 Submitting will automatically decrement store stock balance and generate a printable <strong>Material Issue Voucher PDF</strong>.
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDispatchModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-1.5"
                >
                  <Send size={14} />
                  <span>Confirm Dispatch & Print Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
