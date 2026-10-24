



import React, { useState } from "react";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Search, Plus, Calendar, Shield, Save, FileSpreadsheet, Eye, Trash2, Sliders, ChevronDown, X, Printer, Info, FileText, AlertTriangle, Download } from "lucide-react";
import { InventoryItem } from "../types";

interface InventoryMasterProps {
  inventory: InventoryItem[];
  updateInventory: (inv: InventoryItem[]) => void;
}

export default function InventoryMaster({ inventory, updateInventory }: InventoryMasterProps) {
  const [searchTerm, setSearchTerm] = useState("");
  
  // Date range filter states
  const [stockRangePreset, setStockRangePreset] = useState<"all" | "day" | "week" | "month" | "year" | "custom">("all");
  const [stockFromDate, setStockFromDate] = useState("");
  const [stockToDate, setStockToDate] = useState("");
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [assetType, setAssetType] = useState<"Consumable (Count Only)" | "Fixed Asset (Need Serials)">("Consumable (Count Only)");
  const [category, setCategory] = useState("Consumables (Mouse/Keyboard)");
  const [totalQty, setTotalQty] = useState<number>(0);
  const [usedQty, setUsedQty] = useState<number>(0);
  const [serials, setSerials] = useState("");
  const [vendor, setVendor] = useState("");
  const [vendorCode, setVendorCode] = useState("");
  const [paymentCycle, setPaymentCycle] = useState<"Monthly" | "Bi-Monthly (2 Months)" | "Quarterly (3 Months)" | "Half-Yearly (6 Months)" | "Yearly">("Half-Yearly (6 Months)");
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-GB").replace(/\//g, "-")); // DD-MM-YYYY format
  const [warranty, setWarranty] = useState("");
  const [remarks, setRemarks] = useState("");
  const [reorderLevel, setReorderLevel] = useState<number>(5);

  const [activeAuditLogs, setActiveAuditLogs] = useState<InventoryItem | null>(null);
  
  // Quick Dispatch / Stock Outward State
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [dispatchItemId, setDispatchItemId] = useState("");
  const [dispatchStaffName, setDispatchStaffName] = useState("");
  const [dispatchRoom, setDispatchRoom] = useState("");
  const [dispatchQty, setDispatchQty] = useState<number>(1);
  const [dispatchNotes, setDispatchNotes] = useState("");

  // Vendor Ledger state
  const [showVendorLedger, setShowVendorLedger] = useState(false);
  const [selectedVendorCodeForReport, setSelectedVendorCodeForReport] = useState("");
  const [vendorFromDate, setVendorFromDate] = useState("");
  const [vendorToDate, setVendorToDate] = useState("");
  const [vendorLedgerTab, setVendorLedgerTab] = useState<"table" | "preview">("table");
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string>("");
  const [previewMode, setPreviewMode] = useState<"paper" | "iframe">("paper");

  const categories = [
    "Consumables (Mouse/Keyboard)",
    "Spares (RAM/SSD)",
    "Network (Switches/Cables)",
    "Printers & Inks",
    "Major Assets",
    "Stationery & Academic Supplies",
    "Textbooks & Workbooks",
    "Uniforms & Badges",
    "Housekeeping & Hygiene",
    "Sports & Co-Curricular"
  ];

  // Reactively compile a fresh PDF blob URL whenever dates, vendor or inventory updates
  React.useEffect(() => {
    if (!showVendorLedger) {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl("");
      }
      return;
    }
    
    const activeCode = (selectedVendorCodeForReport || "").trim().toUpperCase();
    const record = vendorRecordsList.find(r => r.code === activeCode) || 
                   (vendorRecordsList.length > 0 ? vendorRecordsList[0] : null);
                   
    if (!record) {
      setPdfBlobUrl("");
      return;
    }

    try {
      const { items: filteredItems, totalQuantity, totalBillAmount } = getFilteredVendorData(record);
      const doc = generateVendorPDFInstance(record, filteredItems, totalQuantity, totalBillAmount);
      const blob = doc.output("blob");
      const blobUrl = URL.createObjectURL(blob);
      
      setPdfBlobUrl(blobUrl);
      
      return () => {
        URL.revokeObjectURL(blobUrl);
      };
    } catch (err) {
      // console.error("Failed to compile real-time PDF preview:", err);
    }
  }, [showVendorLedger, selectedVendorCodeForReport, vendorFromDate, vendorToDate, inventory]);

  // Helper code to parse "DD-MM-YYYY" or related formats
  const parseDateString = (dateStr: string): Date | null => {
    if (!dateStr || typeof dateStr !== "string") return null;
    const cleanStr = dateStr.replace(/,/g, "").trim();
    const datePart = cleanStr.split(" ")[0];
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

  // Check if stock purchase date matches preselected range preset
  const isInventoryInSelectedRange = (item: InventoryItem): boolean => {
    if (stockRangePreset === "all") return true;

    const d = parseDateString(item.date);
    if (!d) return false;
    const testTime = d.getTime();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (stockRangePreset === "day") {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return testTime >= today.getTime() && testTime < tomorrow.getTime();
    }

    if (stockRangePreset === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return testTime >= weekAgo.getTime();
    }

    if (stockRangePreset === "month") {
      const monthAgo = new Date(today);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return testTime >= monthAgo.getTime();
    }

    if (stockRangePreset === "year") {
      const yearAgo = new Date(today);
      yearAgo.setDate(yearAgo.getDate() - 365);
      return testTime >= yearAgo.getTime();
    }

    if (stockRangePreset === "custom") {
      if (!stockFromDate || !stockToDate) return true;
      const start = new Date(stockFromDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(stockToDate);
      end.setHours(23, 59, 59, 999);
      return testTime >= start.getTime() && testTime <= end.getTime();
    }

    return true;
  };

  // Search filter
  const filteredItems = inventory.filter((item) => {
    // Range filter check first
    if (!isInventoryInSelectedRange(item)) return false;

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();

    return (
      (item.itemName || "").toLowerCase().includes(s) ||
      (item.category || "").toLowerCase().includes(s) ||
      (item.vendor || "").toLowerCase().includes(s) ||
      (item.vendorCode || "").toLowerCase().includes(s) ||
      (item.id || "").toLowerCase().includes(s)
    );
  });

  const handleEditSetup = (item: InventoryItem) => {
    setEditingId(item.id);
    setItemName(item.itemName || "");
    setAssetType(item.assetType || "Consumable (Count Only)");
    setCategory(item.category || "Consumables (Mouse/Keyboard)");
    setTotalQty(item.totalQty || 0);
    setUsedQty(item.usedQty || 0);
    setSerials(!item.serials || item.serials === "N/A" ? "" : item.serials);
    setVendor(item.vendor || "");
    setVendorCode(item.vendorCode || "");
    setPaymentCycle(item.paymentCycle || "Half-Yearly (6 Months)");
    setUnitPrice(item.unitPrice || 0);
    setDate(item.date || "");
    setWarranty(item.warranty || "");
    setReorderLevel(item.reorderLevel ?? 5);
    setRemarks(""); // Clear remarks to force a change log comment reason
  };

  const resetForm = () => {
    setEditingId(null);
    setItemName("");
    setAssetType("Consumable (Count Only)");
    setCategory("Consumables (Mouse/Keyboard)");
    setTotalQty(0);
    setUsedQty(0);
    setSerials("");
    setVendor("");
    setVendorCode("");
    setPaymentCycle("Half-Yearly (6 Months)");
    setUnitPrice(0);
    setDate(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
    setWarranty("");
    setRemarks("");
    setReorderLevel(5);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || totalQty < 0) {
      alert("Invalid Item Name or Quantity!");
      return;
    }

    if (usedQty > totalQty) {
      alert("Used quantity/assigned cannot exceed total purchased inventory!");
      return;
    }

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    const categoryText = category;
    const warrantyText = warranty || "No Warranty";
    const commentsReason = remarks.slice(0, 100).trim() || "No custom remarks";

    // Build serials content
    let finalSerials = serials.trim();
    if (assetType !== "Fixed Asset (Need Serials)" || !finalSerials) {
      finalSerials = "N/A";
    }

    let updatedInventory = [...inventory];

    // Generate fallback code if empty
    const generatedVendorCode = vendorCode.trim() 
      ? vendorCode.trim().toUpperCase() 
      : `VND-${vendor.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase()}`;

    if (editingId) {
      // 🚨 HIGH SECURITY EDIT LOGIC
      const idx = inventory.findIndex(i => i.id === editingId);
      if (idx !== -1) {
        const itemObj = inventory[idx];
        const tDiff = totalQty - itemObj.totalQty;
        const uDiff = usedQty - itemObj.usedQty;

        let logEntries: string[] = [];
        if (tDiff > 0) logEntries.push(`📈 Increased Total Stock by ${tDiff}`);
        else if (tDiff < 0) logEntries.push(`⚠️ REDUCED TOTAL STOCK BY ${Math.abs(tDiff)}`);
        
        if (uDiff > 0) logEntries.push(`➖ Used ${uDiff} units`);
        else if (uDiff < 0) logEntries.push(`🔙 Restored ${Math.abs(uDiff)} units to pool`);

        const actionText = logEntries.length > 0 ? logEntries.join(" | ") : "📝 Updated item parameters";
        const newLogLine = `• [${nowStr}] ${actionText}. Reason: ${commentsReason}`;

        updatedInventory[idx] = {
          ...itemObj,
          category,
          totalQty,
          usedQty,
          balanceQty: totalQty - usedQty,
          serials: finalSerials,
          vendor,
          vendorCode: generatedVendorCode,
          paymentCycle,
          unitPrice,
          date,
          warranty,
          reorderLevel: reorderLevel || 5,
          logs: `${newLogLine}\n${itemObj.logs}`
        };
      }
    } else {
      // Create new Item
      // Relax deduplication to support same itemName across different dates/vendors
      const duplicate = inventory.find(i => 
        (i.itemName || "").toLowerCase().trim() === (itemName || "").toLowerCase().trim() &&
        (i.vendor || "").toLowerCase().trim() === (vendor || "").toLowerCase().trim() &&
        (i.date || "").toLowerCase().trim() === (date || "").toLowerCase().trim() &&
        i.assetType === assetType
      );
      if (duplicate) {
        alert(`An identical entry for "${itemName}" from vendor "${vendor}" and date "${date}" already exists in the master! Please edit the existing entry directly to safe-modify quantities.`);
        return;
      }

      const id = `INV-${Date.now().toString().slice(-6)}`;
      const logLine = `• [${nowStr}] 📦 Created Master Entry. Added ${totalQty} units, (${warrantyText}). Vendor: ${vendor || "N/A"} (${generatedVendorCode})`;
      
      const newItem: InventoryItem = {
        id,
        itemName: itemName.trim(),
        assetType,
        category,
        totalQty,
        usedQty,
        balanceQty: totalQty - usedQty,
        serials: finalSerials,
        vendor: vendor.trim() || "N/A",
        vendorCode: generatedVendorCode,
        paymentCycle,
        unitPrice,
        date,
        warranty: warranty.trim() || "No Warranty",
        remarks: commentsReason,
        reorderLevel: reorderLevel || 5,
        logs: logLine
      };

      updatedInventory = [newItem, ...updatedInventory];
    }

    updateInventory(updatedInventory);
    resetForm();
  };

  // Delete inventory item fully
  const handleDeleteItem = (id: string, name: string) => {
    if (confirm(`Are you absolutely sure you want to permanently delete '${name}'? This action is irreversible.`)) {
      const filtered = inventory.filter(i => i.id !== id);
      updateInventory(filtered);
    }
  };

  // Export current list to simple text file
  const handleExportTextLogs = () => {
    let output = "=== IT COMMAND PRO - INVENTORY STOCK SHEET ===\n";
    output += `Generated Date: ${new Date().toLocaleDateString()} (2026 UTC)\n`;
    output += "-----------------------------------------------\n\n";

    inventory.forEach((item, idx) => {
      output += `${idx + 1}. ID: ${item.id}\n`;
      output += `   Item Name: ${item.itemName}\n`;
      output += `   Category : ${item.category}\n`;
      output += `   Type     : ${item.assetType}\n`;
      output += `   Total Qty: ${item.totalQty} | Assigned: ${item.usedQty} | Avaialable Bal: ${item.balanceQty}\n`;
      output += `   Vendor   : ${item.vendor} (${item.date})\n`;
      output += `   Warranty : ${item.warranty}\n`;
      output += `   Serials  : ${item.serials}\n`;
      output += item.logs ? `   Audit Log History:\n${item.logs.split("\n").map(l => "     " + l).join("\n")}\n` : "";
      output += "-----------------------------------------------\n\n";
    });

    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BI_STOCK_REPORT_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Stock details to CSV (Excel compatible) with UTF-8 special character safety
  const handleExportStockCSV = () => {
    if (filteredItems.length === 0) {
      alert("No stock items match the current query parameters to generate CSV!");
      return;
    }

    let output = "\uFEFF"; // Force UTF-8 BOM so Excel opens special characters and symbols safely
    output += "S.No,Stock ID,Item Name,Category,Asset Type,Total Purchased Qty,Used Qty,Available Balance Qty,Vendor Supplier,Date Registered,Warranty Details,Serial Numbers,Remarks\n";
    
    filteredItems.forEach((item, idx) => {
      const escapedName = (item.itemName || "").replace(/"/g, '""');
      const escapedCategory = (item.category || "").replace(/"/g, '""');
      const escapedVendor = (item.vendor || "").replace(/"/g, '""');
      const escapedWarranty = (item.warranty || "").replace(/"/g, '""');
      const escapedSerials = (item.serials || "").replace(/"/g, '""');
      const escapedRemarks = (item.remarks || "").replace(/"/g, '""');

      output += `${idx + 1},"${item.id}","${escapedName}","${escapedCategory}","${item.assetType || ""}",${item.totalQty || 0},${item.usedQty || 0},${item.balanceQty || 0},"${escapedVendor}","${item.date || ""}","${escapedWarranty}","${escapedSerials}","${escapedRemarks}"\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BI_STOCK_SHEET_${stockRangePreset.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- LOW STOCK ALERT COMPUTATION ---
  const lowStockItems = inventory.filter((item) => {
    const bal = item.balanceQty ?? (item.totalQty - item.usedQty);
    const threshold = item.reorderLevel ?? 5;
    return bal <= threshold;
  });

  // --- ⚡ QUICK DISPATCH / ISSUE ITEM HANDLER ---
  const handleConfirmDispatch = () => {
    if (!dispatchItemId) {
      alert("Please select a valid store item to issue!");
      return;
    }
    if (!dispatchStaffName.trim()) {
      alert("Please enter the Teacher or Staff Name receiving the material!");
      return;
    }
    if (!dispatchRoom.trim()) {
      alert("Please enter the Class Room or Department (e.g., Class 1-A, Science Lab)!");
      return;
    }
    if (dispatchQty <= 0) {
      alert("Please enter a valid issue quantity!");
      return;
    }

    const idx = inventory.findIndex((i) => i.id === dispatchItemId);
    if (idx === -1) {
      alert("Selected item not found in inventory!");
      return;
    }

    const itemObj = inventory[idx];
    const currentBal = itemObj.balanceQty ?? (itemObj.totalQty - itemObj.usedQty);

    if (dispatchQty > currentBal) {
      alert(`Insufficient stock! Available balance is only ${currentBal} units.`);
      return;
    }

    const nowStr = new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    }).replace(/\//g, "-");

    const newUsed = itemObj.usedQty + dispatchQty;
    const newBal = itemObj.totalQty - newUsed;
    const voucherNo = `DISPATCH-${Date.now().toString().slice(-6)}`;
    const logLine = `• [${nowStr}] ⚡ DISPATCHED ${dispatchQty} unit(s) to ${dispatchStaffName.trim()} (${dispatchRoom.trim()}). Voucher: #${voucherNo}. Notes: ${dispatchNotes.trim() || "Regular issue"}`;

    const updatedItem: InventoryItem = {
      ...itemObj,
      usedQty: newUsed,
      balanceQty: newBal,
      logs: `${logLine}\n${itemObj.logs || ""}`
    };

    const updatedInv = [...inventory];
    updatedInv[idx] = updatedItem;
    updateInventory(updatedInv);

    // Generate Instant PDF Voucher Slip
    generateDispatchSlipPDF({
      voucherNo,
      itemName: itemObj.itemName,
      category: itemObj.category,
      qty: dispatchQty,
      recipient: dispatchStaffName.trim(),
      room: dispatchRoom.trim(),
      notes: dispatchNotes.trim() || "Approved Issue",
      dateStr: nowStr,
      unitPrice: itemObj.unitPrice
    });

    // Reset dispatch state
    setShowDispatchModal(false);
    setDispatchItemId("");
    setDispatchStaffName("");
    setDispatchRoom("");
    setDispatchQty(1);
    setDispatchNotes("");
  };

  // --- 📄 GENERATE DISPATCH SLIP PDF ---
  const generateDispatchSlipPDF = (data: {
    voucherNo: string;
    itemName: string;
    category: string;
    qty: number;
    recipient: string;
    room: string;
    notes: string;
    dateStr: string;
    unitPrice?: number;
  }) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      // Corporate Header Banner
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("OFFICIAL MATERIAL DISPATCH & ISSUE VOUCHER", 14, 21);

      doc.setFont("helvetica", "bold");
      doc.text(`VOUCHER NO: #${data.voucherNo}`, 135, 14);
      doc.setFont("helvetica", "normal");
      doc.text(`Issue Date: ${data.dateStr}`, 135, 21);

      // Section 1: Details
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("RECIPIENT & LOCATION INFORMATION", 14, 48);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text([
        `Recipient Staff / Teacher: ${data.recipient}`,
        `Assigned Location / Room: ${data.room}`,
        `Issue Purpose / Purpose Notes: ${data.notes}`
      ], 14, 55);

      // Section 2: Table
      const tableColumn = ["S.No", "Voucher ID", "Material / Item Name", "Category Group", "Issued Qty", "Unit Cost (INR)", "Total Value (INR)"];
      const unitVal = data.unitPrice || 0;
      const totalVal = data.qty * unitVal;

      const tableRows = [
        ["1", `#${data.voucherNo}`, data.itemName, data.category, `${data.qty} Units`, `INR ${unitVal.toLocaleString()}`, `INR ${totalVal.toLocaleString()}`]
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

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);

      doc.line(14, sigY, 75, sigY);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("RECEIVER / TEACHER SIGNATURE", 14, sigY + 5);

      doc.line(135, sigY, 195, sigY);
      doc.text("STORE KEEPER / ISSUING DESK SIGNATURE", 135, sigY + 5);

      doc.save(`Material_Dispatch_${data.voucherNo}.pdf`);
    } catch (err: any) {
      alert(`Error generating Dispatch PDF: ${err.message}`);
    }
  };

  // --- 📄 GENERATE INWARD GOODS VOUCHER PDF ---
  const generateInwardVoucherPDF = (item: InventoryItem) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("OFFICIAL GOODS RECEIVED VOUCHER (INWARD STOCK)", 14, 21);

      doc.setFont("helvetica", "bold");
      doc.text(`INWARD ID: #${item.id}`, 135, 14);
      doc.setFont("helvetica", "normal");
      doc.text(`Received Date: ${item.date}`, 135, 21);

      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("VENDOR SUPPLIER DETAILS", 14, 48);

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "normal");
      doc.text([
        `Vendor Supplier Name: ${item.vendor}`,
        `Vendor Code: ${item.vendorCode || "N/A"}`,
        `Payment Release Cycle: ${item.paymentCycle || "Half-Yearly (6 Months)"}`,
        `Warranty Details: ${item.warranty || "No Warranty"}`
      ], 14, 55);

      const unitVal = item.unitPrice || 0;
      const totalVal = item.totalQty * unitVal;

      const tableColumn = ["S.No", "Stock ID", "Material / Item Name", "Category", "Purchased Qty", "Unit Cost (INR)", "Batch Valuation (INR)"];
      const tableRows = [
        ["1", item.id, item.itemName, item.category, `${item.totalQty} Units`, `INR ${unitVal.toLocaleString()}`, `INR ${totalVal.toLocaleString()}`]
      ];

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 80,
        theme: "striped",
        headStyles: { fillColor: [49, 130, 206], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 130;
      const sigY = Math.min(250, finalY + 35);

      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);

      doc.line(14, sigY, 75, sigY);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("STORE KEEPER SIGNATURE", 14, sigY + 5);

      doc.line(135, sigY, 195, sigY);
      doc.text("ACCOUNTS / PURCHASE SIGNATURE", 135, sigY + 5);

      doc.save(`Inward_Stock_Voucher_${item.id}.pdf`);
    } catch (err: any) {
      alert(`Error generating Inward PDF: ${err.message}`);
    }
  };

  // --- 📋 EXPORT LOW STOCK RE-ORDER LIST PDF ---
  const handleExportLowStockList = () => {
    if (lowStockItems.length === 0) {
      alert("All store items are currently above safety stock thresholds!");
      return;
    }

    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      doc.setFillColor(185, 28, 28);
      doc.rect(0, 0, 210, 36, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 14, 14);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("URGENT RE-ORDER PURCHASE REQUISITION LIST", 14, 21);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 135, 14);

      const tableColumn = ["S.No", "Stock ID", "Item Name", "Category", "Current Balance", "Min Safety Level", "Vendor Supplier"];
      const tableRows = lowStockItems.map((item, idx) => [
        (idx + 1).toString(),
        item.id,
        item.itemName,
        item.category,
        `${item.balanceQty} Units`,
        `${item.reorderLevel || 5} Units`,
        `${item.vendor} (${item.vendorCode || "N/A"})`
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        theme: "striped",
        headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 8.5, textColor: [40, 40, 40] }
      });

      doc.save(`Low_Stock_Reorder_List_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err: any) {
      alert(`Error generating Low Stock PDF: ${err.message}`);
    }
  };

  const handlePrintStockReportNow = () => {
    window.print();
  };

  // PDF variables
  const pdfTotalPurchased = filteredItems.reduce((sum, item) => sum + item.totalQty, 0);
  const pdfTotalUsed = filteredItems.reduce((sum, item) => sum + item.usedQty, 0);
  const pdfTotalBalance = filteredItems.reduce((sum, item) => sum + item.balanceQty, 0);

  // --- DYNAMIC VENDOR LEDGER DATA & SCHEDULERS ---
  interface VendorAggregate {
    name: string;
    code: string;
    paymentCycle: string;
    items: InventoryItem[];
    totalQuantity: number;
    totalBillAmount: number;
    lastSettleDate: string; // DD-MM-YYYY format in localStorage
  }

  const vendorsMap: Record<string, VendorAggregate> = {};

  (inventory || []).forEach((item) => {
    if (!item) return;
    const vendorName = (item.vendor || "N/A").trim();
    const rawCode = item.vendorCode || `VND-${vendorName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "GEN"}`;
    const code = rawCode.toUpperCase();
    const cycle = item.paymentCycle || "Half-Yearly (6 Months)";
    
    if (!vendorsMap[code]) {
      let savedSettleDate = localStorage.getItem(`settle-date-${code}`);
      if (!savedSettleDate) {
        savedSettleDate = item.date || "10-01-2026";
        localStorage.setItem(`settle-date-${code}`, savedSettleDate);
      }

      vendorsMap[code] = {
        name: vendorName,
        code,
        paymentCycle: cycle,
        items: [],
        totalQuantity: 0,
        totalBillAmount: 0,
        lastSettleDate: savedSettleDate
      };
    }
    vendorsMap[code].items.push(item);
    vendorsMap[code].totalQuantity += (item.totalQty || 0);
    vendorsMap[code].totalBillAmount += (item.totalQty || 0) * (item.unitPrice || 0);
  });

  const vendorRecordsList = Object.values(vendorsMap);

  const handleRecordSettlement = (vCode: string) => {
    const todayStr = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    localStorage.setItem(`settle-date-${vCode.toUpperCase()}`, todayStr);
    
    // Add audit logs to related inventory items
    const updatedInv = (inventory || []).map(item => {
      if (!item) return item;
      const vendorName = (item.vendor || "N/A").trim();
      const rawCode = item.vendorCode || `VND-${vendorName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "GEN"}`;
      if (rawCode.toUpperCase() === vCode.toUpperCase()) {
        const nowStr = new Date().toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }).replace(/\//g, "-");
        const newLogLine = `• [${nowStr}] 💰 Recorded payment settlement release. Outstanding bills for this batch have been reconciled and balanced internally.`;
        return {
          ...item,
          logs: `${newLogLine}\n${item.logs || ""}`
        };
      }
      return item;
    });

    updateInventory(updatedInv);
    alert(`💰 Payment settlement recorded successfully for vendor code ${vCode}! Audited transaction lines appended to all related batch pools.`);
  };

  const calculatePaymentStatus = (lastSettleStr: string, cycle: string) => {
    if (!lastSettleStr || typeof lastSettleStr !== "string") {
      return { 
        nextDateStr: "N/A", 
        daysRemaining: 1, 
        badgeColor: "bg-slate-100 text-slate-700", 
        label: "No valid transaction history setup" 
      };
    }
    const cleanStr = lastSettleStr.trim();
    const delimiter = cleanStr.includes("/") ? "/" : cleanStr.includes("-") ? "-" : ".";
    const parts = cleanStr.split(delimiter);
    if (parts.length !== 3) {
      return { 
        nextDateStr: "N/A", 
        daysRemaining: 1, 
        badgeColor: "bg-slate-100 text-slate-700", 
        label: "No valid transaction history setup" 
      };
    }
    
    let day = parseInt(parts[0], 10);
    let month = parseInt(parts[1], 10) - 1;
    let year = parseInt(parts[2], 10);

    if (parts[0].length === 4) {
      // YYYY-MM-DD
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    }

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return { 
        nextDateStr: "N/A", 
        daysRemaining: 1, 
        badgeColor: "bg-slate-100 text-slate-700", 
        label: "No valid transaction history setup" 
      };
    }
    
    const lastDate = new Date(year, month, day);
    if (isNaN(lastDate.getTime())) {
      return { 
        nextDateStr: "N/A", 
        daysRemaining: 1, 
        badgeColor: "bg-slate-100 text-slate-700", 
        label: "No valid transaction history setup" 
      };
    }
    const nextDate = new Date(lastDate);
    
    if (cycle === "Monthly") {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (cycle === "Bi-Monthly (2 Months)") {
      nextDate.setMonth(nextDate.getMonth() + 2);
    } else if (cycle === "Quarterly (3 Months)") {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (cycle === "Half-Yearly (6 Months)") {
      nextDate.setMonth(nextDate.getMonth() + 6);
    } else if (cycle === "Yearly") {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 6); // default to half-yearly
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    nextDate.setHours(0, 0, 0, 0);
    
    const diffTime = nextDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nextDateStr = nextDate.toLocaleDateString("en-GB").replace(/\//g, "-");
    
    if (daysRemaining < 0) {
      return {
        nextDateStr,
        daysRemaining,
        badgeColor: "bg-rose-100 text-[#C53030] border border-rose-250 font-bold",
        label: `🚨 PAYMENT OVERDUE BY ${Math.abs(daysRemaining)} DAYS`
      };
    } else if (daysRemaining <= 15) {
      return {
        nextDateStr,
        daysRemaining,
        badgeColor: "bg-yellow-105 text-[#B7791F] border border-yellow-250 font-bold animate-pulse",
        label: `⚠️ DUE IN ${daysRemaining} DAYS`
      };
    } else {
      return {
        nextDateStr,
        daysRemaining,
        badgeColor: "bg-emerald-50 text-[#1A202C] border border-emerald-250 hover:bg-emerald-100 font-bold",
        label: `✅ SECURED (DUE IN ${daysRemaining} DAYS)`
      };
    }
  };

  const getFilteredVendorData = (record: VendorAggregate) => {
    const filtered = record.items.filter(item => {
      if (!vendorFromDate && !vendorToDate) return true;
      const d = parseDateString(item.date);
      if (!d) return false;
      const testTime = d.getTime();
      
      if (vendorFromDate) {
        const start = new Date(vendorFromDate);
        start.setHours(0, 0, 0, 0);
        if (testTime < start.getTime()) return false;
      }
      if (vendorToDate) {
        const end = new Date(vendorToDate);
        end.setHours(23, 59, 59, 999);
        if (testTime > end.getTime()) return false;
      }
      return true;
    });

    const totalQuantity = filtered.reduce((sum, item) => sum + item.totalQty, 0);
    const totalBillAmount = filtered.reduce((sum, item) => sum + item.totalQty * (item.unitPrice || 0), 0);

    return {
      items: filtered,
      totalQuantity,
      totalBillAmount
    };
  };

  const generateVendorPDFInstance = (record: VendorAggregate, itemsToUse: InventoryItem[], totalQuantity: number, totalBillAmount: number) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    // Cover branding background accent
    doc.setFillColor(30, 41, 59); // Slate-800 color (#1E293B)
    doc.rect(0, 0, 210, 40, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("BIRLA OPEN MINDS INTERNATIONAL SCHOOL", 15, 15);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("OFFICIAL HARDWARE VENDOR LEDGER & TRANSACTION RECORD", 15, 22);
    
    // Right side document header inside the banner
    doc.setFont("helvetica", "bold");
    doc.text(`VENDOR CODE: ${record.code}`, 135, 15);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 135, 22);

    // Metadata Cards setup (using text labels)
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("VENDOR ACCOUNT DETAILS", 15, 52);

    const statusInfo = calculatePaymentStatus(record.lastSettleDate, record.paymentCycle);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text([
      `Vendor Name: ${record.name}`,
      `Payment Release Cycle: ${record.paymentCycle}`,
      `Last Settlement Release Date: ${record.lastSettleDate}`,
      `Next Scheduled Release: ${statusInfo.nextDateStr}`
    ], 15, 58);

    // Financials Summary Area
    doc.setFont("helvetica", "bold");
    doc.text("FINANCIAL OVERVIEW", 120, 52);
    doc.setFont("helvetica", "normal");
    
    const dateRangeStr = (vendorFromDate || vendorToDate)
      ? `Filtered Range: ${vendorFromDate || "Start"} to ${vendorToDate || "End"}`
      : "Filtered Range: All Time";

    doc.text([
      `Total Supplied Assorted Batches: ${itemsToUse.length}`,
      `Cumulative Ledger Valuation: INR ${totalBillAmount.toLocaleString()}/-`,
      `Settlement Health Status: ${statusInfo.label.replace(/[^A-Za-z0-9\s():]/g, "")}`,
      dateRangeStr
    ], 120, 58);

    // Separation Line
    doc.setDrawColor(226, 232, 240); // slate-200 border
    doc.setLineWidth(0.5);
    doc.line(15, 80, 195, 80);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("ITEMIZED BATCH TRANSACTIONS SHEET", 15, 88);

    // AutoTable Columns & Rows
    const tableColumn = ["S.No", "Stock ID", "Material Name & Category", "Receiving Date", "Quantity", "Unit Price", "Subtotal"];
    const tableRows = (itemsToUse || []).map((item, index) => {
      const subtotal = (item.totalQty || 0) * (item.unitPrice || 0);
      return [
        (index + 1).toString(),
        item.id || "",
        `${item.itemName || "Item"}\n(${item.category || "General"})`,
        item.date || "N/A",
        `${item.totalQty || 0} Units`,
        `INR ${item.unitPrice ? item.unitPrice.toLocaleString() : "0"}`,
        `INR ${subtotal.toLocaleString()}`
      ];
    });

    // Generate Table using autotable plugin
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 94,
      theme: "striped",
      headStyles: {
        fillColor: [249, 115, 22], // Santinos Brand Orange (#F97316)
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: "bold"
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [50, 50, 50]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 18 },
        2: { cellWidth: 48 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 20, halign: "center" },
        5: { cellWidth: 26, halign: "right" },
        6: { cellWidth: 30, halign: "right" }
      },
      foot: [
        ["", "", "Grand Cumulative Outstanding Balance Pool", "", `${totalQuantity} Units`, "", `INR ${totalBillAmount.toLocaleString()}`]
      ],
      footStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: "bold"
      }
    });

    // Signature lines
    // Get the end Y coordinate from table to determine signature position
    const finalY = (doc as any).lastAutoTable.finalY || 180;
    const sigY = Math.min(265, finalY + 25);

    doc.setDrawColor(148, 163, 184); // slate-400
    doc.setLineWidth(0.3);
    
    // Line left
    doc.line(15, sigY, 75, sigY);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("BI ACCOUNTS SIGNATURE", 15, sigY + 5);

    // Line right
    doc.line(135, sigY, 195, sigY);
    doc.text("DELIVERING SUPPLIER INK SIGNATURE", 135, sigY + 5);

    return doc;
  };

  const downloadVendorPDFReport = (record: VendorAggregate) => {
    try {
      const { items: filteredItems, totalQuantity, totalBillAmount } = getFilteredVendorData(record);
      const doc = generateVendorPDFInstance(record, filteredItems, totalQuantity, totalBillAmount);
      // Save document
      doc.save(`BI_Vendor_${record.code}_Report.pdf`);
    } catch (err: any) {
      // console.error(err);
      alert(`Error compiling PDF output: ${err.message}`);
    }
  };

  const downloadVendorCSVReport = (record: VendorAggregate) => {
    try {
      const { items: filteredItems, totalQuantity, totalBillAmount } = getFilteredVendorData(record);
      const headers = [
        "S.No",
        "Stock ID",
        "Material Name",
        "Category",
        "Receiving Date",
        "Batch Qty",
        "Unit Price (INR)",
        "Subtotal Value (INR)",
        "Warranty Status",
        "Vendor Code",
        "Vendor Name",
        "Settlement Plan",
        "Last Settlement Date"
      ];

      const rows = filteredItems.map((item, index) => {
        const subtotal = item.totalQty * (item.unitPrice || 0);
        return [
          index + 1,
          item.id,
          `"${(item.itemName || "").replace(/"/g, '""')}"`,
          `"${(item.category || "").replace(/"/g, '""')}"`,
          item.date,
          item.totalQty,
          item.unitPrice || 0,
          subtotal,
          `"${(item.warranty || "").replace(/"/g, '""')}"`,
          record.code,
          `"${(record.name || "").replace(/"/g, '""')}"`,
          record.paymentCycle,
          record.lastSettleDate
        ];
      });

      // Grand total line
      const totalRow = [
        "TOTAL",
        "",
        "Cumulative Ledger Portfolio Balance",
        "",
        "",
        totalQuantity,
        "",
        totalBillAmount,
        "",
        "",
        "",
        "",
        ""
      ];

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
        + [headers.join(","), ...rows.map(e => e.join(",")), totalRow.join(",")].join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `BI_Vendor_Ledger_${record.code}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      // console.error(err);
      alert(`Error exporting Excel CSV: ${err.message}`);
    }
  };



        const renderInventoryPrintContent = () => (
          <>
                          
                          {/* Header Content Segment */}
                          <div>
                            
                            {/* Visual corporate strip */}
                            <div className="w-full h-1.5 bg-indigo-650 rounded-sm mb-6"></div>
          
                            <div className="flex justify-between items-start border-b border-slate-300 pb-5">
                              <div>
                                <h1 className="text-xl font-black tracking-tight text-slate-950">Birla Open Minds International School</h1>
                                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-none mt-1">SECURE IT INVENTORY LEDGER</p>
                                
                                <div className="text-[9.5px] text-slate-450 font-bold font-mono mt-3 space-y-0.5 leading-tight">
                                  <p>📍 Birla Open Minds International School Campus Hub, India</p>
                                  <p>📧 support@birla-it.global.corp</p>
                                  <p>🔐 System Audit Identifier: #7e59c941-stock-mstr</p>
                                </div>
                              </div>
          
                              <div className="text-right">
                                <span className="text-[10px] font-extrabold px-3 py-1 bg-indigo-50 text-indigo-900 border border-indigo-200 uppercase rounded-sm font-sans tracking-wider inline-block">
                                  OFFICIAL STOCK AUDIT SHEET
                                </span>
                                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase font-sans">Date Generated</p>
                                <p className="text-xs font-bold font-mono text-slate-800 leading-tight">
                                  {new Date().toLocaleString("en-GB")} (UTC)
                                </p>
                              </div>
                            </div>
          
                            {/* Range and parameters description */}
                            <div className="mt-5 bg-slate-50 p-4 border border-slate-200 rounded-lg text-[10px] leading-relaxed grid grid-cols-2 gap-y-1.5 gap-x-4">
                              <div className="col-span-2 text-[9px] font-extrabold uppercase tracking-widest text-[#2D3748] pb-1 border-b border-slate-200 mb-1">
                                📋 AUDIT CRITERIA & STOCK PARAMETERS
                              </div>
                              <div>
                                <strong className="text-slate-450 uppercase text-[8.5px] font-extrabold">Report Class:</strong>
                                <p className="text-slate-850 font-bold">
                                  Hardware Register Balance Audit
                                </p>
                              </div>
                              <div>
                                <strong className="text-slate-450 uppercase text-[8.5px] font-extrabold">Active Preset Filter:</strong>
                                <p className="text-slate-850 font-bold font-mono uppercase">
                                  {stockRangePreset} ({stockFromDate || "All time"} to {stockToDate || "Now"})
                                </p>
                              </div>
                              <div>
                                <strong className="text-slate-450 uppercase text-[8.5px] font-extrabold">Total Distinct Batches:</strong>
                                <p className="text-slate-850 font-bold font-mono">
                                  {filteredItems.length} matches shown
                                </p>
                              </div>
                              <div>
                                <strong className="text-slate-450 uppercase text-[8.5px] font-extrabold">Search Query:</strong>
                                <p className="text-slate-850 font-bold font-mono">
                                  {searchTerm ? `"${searchTerm}"` : "None"}
                                </p>
                              </div>
                            </div>
          
                            {/* Inline Stats cards in PDF */}
                            <div className="grid grid-cols-3 gap-3 bg-indigo-50/50 p-3.5 border border-indigo-150 rounded-lg text-center mt-4 text-[10px]">
                              <div className="py-1 border-r border-slate-200">
                                <p className="text-[8.5px] text-slate-500 font-extrabold uppercase tracking-widest leading-none">Total Purchased</p>
                                <p className="text-base font-black font-mono text-slate-800 mt-1">{pdfTotalPurchased} Units</p>
                              </div>
                              <div className="py-1 border-r border-slate-200">
                                <p className="text-[8.5px] text-blue-700 font-extrabold uppercase tracking-widest leading-none font-sans">Used / Assigned</p>
                                <p className="text-base font-black font-mono text-blue-800 mt-1">
                                  {pdfTotalUsed} Units
                                </p>
                              </div>
                              <div className="py-1 font-bold">
                                <p className="text-[8.5px] text-emerald-700 font-extrabold uppercase tracking-widest leading-none">Available Balance</p>
                                <p className="text-base font-black font-mono text-emerald-800 mt-1">
                                  {pdfTotalBalance} Units
                                </p>
                              </div>
                            </div>
          
                            {/* Print Table list */}
                            <div className="mt-5 border border-slate-350 rounded overflow-hidden">
                              <table className="w-full text-[9px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-600 font-extrabold uppercase text-left leading-tight">
                                    <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                                    <th className="p-2 border-r border-slate-300 w-24">Item ID</th>
                                    <th className="p-2 border-r border-slate-300 w-36">Item Brand/Name</th>
                                    <th className="p-2 border-r border-slate-300 w-36">Category Group</th>
                                    <th className="p-2 border-r border-slate-300 text-center w-20">Total Pch.</th>
                                    <th className="p-2 border-r border-slate-300 text-center w-18">Used Qty</th>
                                    <th className="p-2 border-r border-slate-300 text-center w-18 bg-emerald-50 text-emerald-950 font-bold">Balance</th>
                                    <th className="p-2 border-r border-slate-300 w-36">Vendor Supplier</th>
                                    <th className="p-2 font-bold w-20 text-center">Pch. Date</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 leading-normal text-slate-800 font-medium">
                                  {filteredItems.length === 0 ? (
                                    <tr>
                                      <td colSpan={9} className="p-6 text-center text-slate-400 font-bold bg-slate-50/50">
                                        No stock records fit matching search parameters inside database.
                                      </td>
                                    </tr>
                                  ) : (
                                    filteredItems.map((item, i) => (
                                      <tr key={item.id} className="print-no-break">
                                        <td className="p-2 border-r border-slate-300 text-center font-bold bg-slate-50">{i + 1}</td>
                                        <td className="p-2 border-r border-slate-300 font-mono text-[8px] text-slate-500 font-bold">{item.id}</td>
                                        <td className="p-2 border-r border-slate-300 font-bold text-slate-900">{item.itemName}</td>
                                        <td className="p-2 border-r border-slate-300 text-slate-500 font-semibold">{item.category}</td>
                                        <td className="p-2 border-r border-slate-300 font-mono text-center font-bold">{item.totalQty}</td>
                                        <td className="p-2 border-r border-slate-300 font-mono text-center text-slate-500">{item.usedQty}</td>
                                        <td className="p-2 border-r border-slate-300 font-mono text-center font-black bg-emerald-50/40 text-emerald-800">{item.balanceQty}</td>
                                        <td className="p-2 border-r border-slate-300 font-bold text-[#3182CE]">{item.vendor}</td>
                                        <td className="p-2 font-mono text-center text-slate-500 text-[8.5px]">{item.date}</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
          
                          </div>
          
                          {/* Footer Signatures Lane Segment */}
                          <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 print-no-break">
                            <div className="text-left space-y-10">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450">Verified & Approved By:</p>
                              <div className="w-48 border-b border-slate-400"></div>
                              <div className="text-[9.5px] leading-tight text-slate-600 font-bold font-sans">
                                <p className="text-slate-900 text-[10px] font-black">IT Administrator Signature</p>
                                <p className="mt-0.5">BI GLOBAL Core Systems Desk</p>
                                <p className="text-[8px] font-mono text-slate-400 mt-1">Date: ________________________</p>
                              </div>
                            </div>
          
                            <div className="text-right space-y-10 flex flex-col items-end">
                              <div className="w-full text-right">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-450 mr-0">Reconciled Counter Signature:</p>
                              </div>
                              <div className="w-48 border-b border-slate-400"></div>
                              <div className="text-[9.5px] leading-tight text-slate-600 font-bold font-sans">
                                <p className="text-slate-900 text-[10px] font-black">Principal / Branch Executive</p>
                                <p className="mt-0.5">Birla Open Minds International School Hub</p>
                                <p className="text-[8px] font-mono text-slate-400 mt-1">Date: ________________________</p>
                              </div>
                            </div>
                          </div>
          
          </>
        );


  return (
    <div id="inventory-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Styles for direct clean printing to PDF */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
            background: white !important;
            color: black !important;
          }
          #print-inventory-root, #print-inventory-root *,
          #print-vendor-ledger-root, #print-vendor-ledger-root * {
            visibility: visible;
          }
          #print-inventory-root, #print-vendor-ledger-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 0px !important;
            margin: 0px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200 gap-4 no-print">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans flex items-center gap-2">
            <span>📦</span> INVENTORY & GENERAL STORE MASTER
          </h2>
          <p className="text-xs text-slate-500 font-medium font-sans">Corporate school stock accounts, teacher material issue desk & real-time inventory controls</p>
        </div>
        <div className="mt-4 md:mt-0 flex flex-wrap gap-2.5">
          <button
            onClick={() => {
              if (inventory.length > 0) {
                setDispatchItemId(inventory[0].id);
              }
              setShowDispatchModal(true);
            }}
            className="px-3.5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans border border-orange-500"
          >
            <span>⚡</span>
            QUICK ISSUE MATERIAL
          </button>

          {lowStockItems.length > 0 && (
            <button
              onClick={handleExportLowStockList}
              className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans animate-pulse"
            >
              <AlertTriangle size={15} />
              LOW STOCK RE-ORDER LIST ({lowStockItems.length})
            </button>
          )}

          <button
            onClick={handleExportTextLogs}
            className="px-3.5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans"
          >
            <FileText size={15} />
            DOWNLOAD AUDIT FILE
          </button>
          
          <button
            onClick={handleExportStockCSV}
            className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans"
          >
            <FileSpreadsheet size={15} />
            EXPORT TO EXCEL (.CSV)
          </button>

          <button
            onClick={() => {
              setShowVendorLedger(true);
              setSelectedVendorCodeForReport("");
            }}
            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans border-2 border-amber-600/20"
          >
            <Sliders size={15} />
            🏢 VENDOR LEDGER & PAYMENTS
          </button>
          
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 cursor-pointer transition-colors font-sans"
          >
            <Printer size={15} />
            GENERATE Stock PDF Report
          </button>
        </div>
      </div>

      {/* Low Stock Top Banner Alert */}
      {lowStockItems.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-r from-rose-500 to-amber-600 rounded-2xl text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4 no-print animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <AlertTriangle size={22} className="text-white" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm uppercase tracking-wide">
                ⚠️ RE-ORDER ALERT: {lowStockItems.length} ITEM(S) BELOW SAFETY STOCK LEVEL!
              </h4>
              <p className="text-xs text-white/90 font-medium">
                The following store items are running low on balance stock and require vendor purchase re-orders:
                {" "}<strong className="underline">{lowStockItems.map(i => i.itemName).slice(0, 4).join(", ")}{lowStockItems.length > 4 ? "..." : ""}</strong>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportLowStockList}
              className="px-4 py-2 bg-white text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
            >
              📋 Download Vendor Re-Order PDF
            </button>
          </div>
        </div>
      )}

      <div className="my-8 flex flex-col lg:flex-row gap-8 items-start no-print">
        
        {/* Left Form frame */}
        <form onSubmit={handleSave} className="w-full lg:w-96 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 shrink-0">
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-3 border-slate-100">
              {editingId ? "Update Stock Balance" : "Add/Register New Stock"}
            </h3>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Item Brand/Name</label>
            <input
              type="text"
              required
              disabled={!!editingId} // Under security rules: lock core item names for data consistency!
              value={itemName || ""}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="E.g. Dell Monitor, HP Mouse"
              className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 disabled:opacity-75 disabled:cursor-not-allowed focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Asset Model Type</label>
              <select
                disabled={!!editingId}
                value={assetType || "Consumable (Count Only)"}
                onChange={(e) => setAssetType(e.target.value as any)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                <option value="Consumable (Count Only)">Consumable</option>
                <option value="Fixed Asset (Need Serials)">Fixed Asset</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Category Group</label>
              <select
                value={category || "Consumables (Mouse/Keyboard)"}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full py-2.5 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Total Purchased Qty</label>
              <input
                type="number"
                min="0"
                required
                value={totalQty ?? 0}
                onChange={(e) => setTotalQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Used / Assigned Qty</label>
              <input
                type="number"
                min="0"
                value={usedQty ?? 0}
                onChange={(e) => setUsedQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">
              Safety Re-Order Alert Level ⚠️
            </label>
            <input
              type="number"
              min="1"
              value={reorderLevel ?? 5}
              onChange={(e) => setReorderLevel(Math.max(1, parseInt(e.target.value) || 1))}
              placeholder="Min balance before alert (e.g. 5)"
              className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-amber-50/50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
            />
            <p className="text-[10px] text-slate-400 mt-0.5 font-sans">System alerts admin when stock balance drops to or below this count.</p>
          </div>

          {assetType === "Fixed Asset (Need Serials)" && (
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Serial Numbers</label>
              <textarea
                value={serials || ""}
                onChange={(e) => setSerials(e.target.value)}
                placeholder="DL-01, DL-02, DL-03..."
                rows={2}
                className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase text-slate-500 tracking-wider mb-1 font-sans">Vendor Supplier</label>
              <input
                type="text"
                required
                value={vendor || ""}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="E.g. Manikanta, HP"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-805 focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase text-slate-500 tracking-wider mb-1 font-sans">Vendor Code 🔑</label>
              <input
                type="text"
                value={vendorCode || ""}
                onChange={(e) => setVendorCode(e.target.value)}
                placeholder="E.g. VND-MANI"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase text-slate-500 tracking-wider mb-1 font-sans">Unit Price (₹)</label>
              <input
                type="number"
                min="0"
                value={unitPrice || ""}
                onChange={(e) => setUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[10.5px] font-extrabold uppercase text-slate-500 tracking-wider mb-1 font-sans">Payment Cycle</label>
              <select
                value={paymentCycle || "Half-Yearly (6 Months)"}
                onChange={(e) => setPaymentCycle(e.target.value as any)}
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans"
              >
                <option value="Monthly">Monthly</option>
                <option value="Bi-Monthly (2 Months)">Bi-Monthly (2 Months)</option>
                <option value="Quarterly (3 Months)">Quarterly</option>
                <option value="Half-Yearly (6 Months)">Half-Yearly (6 Months)</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Purchase Date</label>
              <input
                type="text"
                value={date || ""}
                onChange={(e) => setDate(e.target.value)}
                placeholder="DD-MM-YYYY"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">Warranty Details</label>
              <input
                type="text"
                value={warranty || ""}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="E.g. 1 Year Brand, AMC"
                className="w-full py-2 px-3 border border-slate-200 rounded-lg text-xs bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase text-slate-500 tracking-wider mb-1">
              Remarks (Reason for change log)
            </label>
            <input
              type="text"
              required={!!editingId} // Reason/Remarks is STRICTLY mandatory under editing rules!
              value={remarks || ""}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={editingId ? "Mandatory audit reason!" : "E.g. Initial purchase batch"}
              className="w-full py-2 px-3 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-[#DD6B20] hover:bg-[#C05621] text-white rounded-lg text-xs font-bold tracking-wider flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <Save size={15} />
              {editingId ? "SAVE DELETIONS" : "SAVE NEW STOCK"}
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

        {/* Right Inventory list table */}
        <div className="flex-1 w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="font-bold text-slate-900 text-sm tracking-wide">📦 LIVE HARDWARE BINS STOCK STATUS</h3>
            
            {/* Live Search bar */}
            <div className="relative w-full sm:w-72">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm || ""}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Item, category or vendor..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs text-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Date range presets */}
          <div className="bg-slate-50/30 border-b border-slate-200 p-4 space-y-3 shrink-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#4A5568] flex items-center gap-1 font-sans">
                <Calendar size={13} className="text-[#DD6B20]" /> Date Range Filters:
              </span>
              
              <div className="flex flex-wrap gap-1.5">
                {(["all", "day", "week", "month", "year", "custom"] as const).map((preset) => {
                  const labels = {
                    all: "All Time",
                    day: "Added Today",
                    week: "Added This Week",
                    month: "This Month",
                    year: "This Year",
                    custom: "Custom Date"
                  };
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStockRangePreset(preset)}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg tracking-wide uppercase transition-all duration-150 ${
                        stockRangePreset === preset
                          ? "bg-slate-800 text-white shadow-sm"
                          : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
                      }`}
                    >
                      {labels[preset]}
                    </button>
                  );
                })}
              </div>
            </div>

            {stockRangePreset === "custom" && (
              <div className="flex flex-wrap items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl animate-in slide-in-from-top-1.5 duration-150">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">From Date:</span>
                  <input
                    type="date"
                    value={stockFromDate || ""}
                    onChange={(e) => setStockFromDate(e.target.value)}
                    className="text-xs font-semibold py-1.5 px-2.5 border border-slate-250 rounded-lg text-slate-700 bg-slate-50 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">To Date:</span>
                  <input
                    type="date"
                    value={stockToDate || ""}
                    onChange={(e) => setStockToDate(e.target.value)}
                    className="text-xs font-semibold py-1.5 px-2.5 border border-slate-250 rounded-lg text-slate-700 bg-slate-50 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Grid Headers */}
          <div className="grid grid-cols-12 gap-2.5 px-6 py-3 border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <div className="col-span-4">Item Details</div>
            <div className="col-span-2 text-center border-l border-slate-200">Totals</div>
            <div className="col-span-2 text-center border-l border-slate-200">Available/Used</div>
            <div className="col-span-2 border-l border-slate-200 pl-3">Warranty & Supplier</div>
            <div className="col-span-2 text-right">Actions Operations</div>
          </div>

          {/* Grid Content */}
          <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-1.5 bg-slate-50/10">
                <Sliders size={40} className="stroke-slate-300 animate-pulse" />
                <p className="text-xs font-semibold">No stock item entries fit selected parameters.</p>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isLowStock = item.category !== "Major Assets" && item.balanceQty < 5;
                const rowStyle = isLowStock 
                  ? "bg-amber-50/50 border-l-2 border-l-[#DD6B20]" 
                  : "hover:bg-slate-50/40 bg-white";

                return (
                  <div 
                    key={item.id}
                    className={`grid grid-cols-12 gap-2.5 px-6 py-4 items-center ${rowStyle} transition-colors`}
                  >
                    {/* Details Column */}
                    <div className="col-span-4 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 leading-snug">{item.itemName || "Unnamed"}</span>
                        {isLowStock && (
                          <span className="text-[9px] font-extrabold bg-amber-100 text-[#DD6B20] px-1.5 py-0.5 rounded uppercase leading-none">
                            🔴 LOW STOCK
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium font-mono select-all">
                        ID: {item.id} | {item.category || "General"} | {String(item.assetType || "Asset").split(" ")[0]}
                      </div>
                      {item.remarks && (
                        <div className="text-[10px] text-[#DD6B20] font-sans truncate" title={item.remarks}>
                          📝 {item.remarks}
                        </div>
                      )}
                    </div>

                    {/* Total Purchased Column */}
                    <div className="col-span-2 text-center text-xs font-bold text-slate-750 font-mono">
                      {item.totalQty} Units
                    </div>

                    {/* Available / Used */}
                    <div className="col-span-2 text-center space-y-0.5 font-mono">
                      <div className={`text-sm font-extrabold ${isLowStock ? "text-[#E53E3E]" : "text-[#38A169]"}`}>
                        Bal: {item.balanceQty}
                      </div>
                      <div className="text-[9px] font-semibold text-slate-400">
                        Used: {item.usedQty}
                      </div>
                    </div>

                    {/* Warranty Column */}
                    <div className="col-span-2 space-y-1 pl-3">
                      <div className="text-[11px] font-bold text-slate-700 truncate font-sans">{item.warranty}</div>
                      <div className="text-[10px] font-bold text-[#1E3A8A] truncate" title={item.vendor}>
                        👤 Supp: {item.vendor}
                      </div>
                      
                      {item.vendorCode && (
                        <div className="text-[9px] font-bold font-mono text-amber-700 bg-amber-50 rounded px-1 py-0.5 border border-amber-150 inline-block">
                          🔑 {item.vendorCode}
                        </div>
                      )}

                      {item.unitPrice ? (
                        <div className="text-[9.5px] text-slate-500 font-mono font-semibold">
                          ₹{item.unitPrice.toLocaleString()} / unit
                        </div>
                      ) : null}

                      <div className="text-[9px] text-slate-400 font-mono">Dt: {item.date}</div>
                    </div>

                    {/* Actions Column */}
                    <div className="col-span-2 flex flex-wrap items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setDispatchItemId(item.id);
                          setShowDispatchModal(true);
                        }}
                        className="px-2 py-1 text-[9.5px] bg-orange-500 hover:bg-orange-600 text-white rounded font-bold transition-all cursor-pointer flex items-center gap-0.5 shadow-xs"
                        title="Quick Issue Material to Staff / Class"
                      >
                        ⚡ ISSUE
                      </button>
                      <button
                        onClick={() => generateInwardVoucherPDF(item)}
                        className="px-2 py-1 text-[9.5px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded font-bold transition-all cursor-pointer flex items-center gap-0.5"
                        title="Download Goods Received Voucher PDF"
                      >
                        📄 INWARD
                      </button>
                      <button
                        onClick={() => handleEditSetup(item)}
                        className="px-2 py-1 text-[9.5px] bg-slate-100 hover:bg-[#1E293B] hover:text-white rounded font-bold transition-all cursor-pointer border"
                      >
                        EDIT
                      </button>
                      <button
                        onClick={() => setActiveAuditLogs(item)}
                        className="px-2 py-1 text-[9.5px] bg-[#3182CE] hover:bg-blue-600 text-white rounded font-bold transition-all cursor-pointer flex items-center gap-0.5 shadow-xs"
                      >
                        LOGS 👁️
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id, item.itemName)}
                        className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-150 cursor-pointer transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* Audit Log popup viewer overlay */}
      {activeAuditLogs && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 select-text">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-[#1E293B] text-white">
              <div>
                <h3 className="font-bold text-base">📜 Audit Trail History Logs</h3>
                <p className="text-[10px] text-slate-400 font-mono">Hardware item: {activeAuditLogs.itemName} ({activeAuditLogs.id})</p>
              </div>
              <button 
                onClick={() => setActiveAuditLogs(null)}
                className="hover:bg-slate-700 p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-[#0F172A] text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-96 leading-relaxed border border-slate-800 space-y-2 custom-scrollbar">
                {(activeAuditLogs?.logs || "").split("\n").map((line, idx) => (
                  <div key={idx} className="hover:bg-slate-800/40 py-1.5 px-2 rounded transition-colors border-b border-slate-800/30">
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([activeAuditLogs.logs || ""], { type: "text/plain;charset=utf-8" });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(blob);
                  link.download = `BI_AUDIT_LOG_${activeAuditLogs.id}.txt`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow transition-colors"
              >
                📥 Download Active Logs
              </button>
              <button
                type="button"
                onClick={() => setActiveAuditLogs(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-150 bg-white cursor-pointer transition-colors"
              >
                Close Audit Desk
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN INTERACTIVE PDF PRINT AND REPORT REVIEW OVERLAY */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 md:p-8 z-[1000] no-print animate-fade-in text-slate-900 select-text">
          <div className="bg-white border border-slate-400 shadow-2xl rounded-2xl w-full max-w-5xl overflow-hidden flex flex-col shrink-0">
            
            {/* Modal Tool Bar Panel */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-slate-700 select-none">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-650" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  BIRLA OPEN MINDS INTERNATIONAL SCHOOL IT Stock Audit PDF Builder
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintStockReportNow}
                  className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all uppercase"
                >
                  <Printer size={13} />
                  <span>PRINT PDF REPORT NOW</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 rounded bg-white hover:bg-slate-100 transition-all cursor-pointer border"
                  title="Close Preview Window"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Print Instructions Bar */}
            <div className="p-3 bg-indigo-50 border-b border-indigo-100 text-indigo-900 text-[10.5px] leading-relaxed flex items-center gap-1.5 select-none">
              <Info size={14} className="shrink-0 text-indigo-600" />
              <span>
                <strong>System Print Guide:</strong> This will format all filtered stocks into a ready-to-sign PDF report. Please choose <strong>"Save as PDF"</strong> inside your browser printer options.
              </span>
            </div>

            {/* PRINT CANVAS */}
            <div className="p-8 md:p-12 bg-slate-100 max-w-full overflow-x-auto print-document-canvas custom-scrollbar flex justify-center">
              
              <div 
                id="print-inventory-preview"
                className="w-[8.27in] min-h-[11.69in] bg-white border border-slate-350 p-[0.75in] text-slate-900 shadow-xl relative flex flex-col justify-between"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {renderInventoryPrintContent()}
              </div>
            </div>

            {/* Print controls bottom bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 select-none">
              <button
                type="button"
                onClick={handlePrintStockReportNow}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow transition-colors"
              >
                🖨️ Open Native Browser Printer Panel
              </button>
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-5 py-2.5 border border-slate-300 text-slate-600 hover:bg-slate-100 bg-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
              >
                Close Report Review
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* --- VENDOR LEDGER & PAYMENT SCHEDULES MODAL --- */}
      {showVendorLedger && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 md:p-8 no-print select-text text-slate-900">
          <div className="bg-white rounded-2xl w-full max-w-7xl h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-[#1E293B] text-white flex justify-between items-center shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏢</span>
                  <h3 className="font-bold text-base tracking-wide uppercase font-sans">BIRLA OPEN MINDS INTERNATIONAL SCHOOL - Vendor Ledger & Payment Schedules</h3>
                </div>
                <p className="text-[11px] text-slate-300 font-sans tracking-wide mt-1">
                  Prevent vendor name mismatches by locking unique codes. Track periodic settlement schedules (Monthly, 6 Months, Yearly) and material transactions.
                </p>
              </div>
              <button 
                onClick={() => setShowVendorLedger(false)}
                className="hover:bg-slate-700 p-2 rounded-xl text-slate-300 hover:text-white cursor-pointer transition-colors border border-transparent hover:border-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Split Client Body */}
            <div className="flex flex-1 overflow-hidden min-h-0 bg-slate-50/50">
              
              {/* LEFT PANEL: Vendor Codes & Statistics Panel */}
              <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
                
                {/* Search Box */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-150 space-y-3 shrink-0">
                  <div className="space-y-1">
                    <label className="block text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                      🔑 Enter Vendor Code or Search Name:
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                        <Search size={14} />
                      </span>
                      <input
                        type="text"
                        placeholder="E.g. VND-MANI, HP, Dell..."
                        value={selectedVendorCodeForReport || ""}
                        onChange={(e) => setSelectedVendorCodeForReport(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 border border-slate-250 rounded-lg text-xs font-mono uppercase focus:ring-2 focus:ring-amber-500 bg-white text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Calendar Date pickers */}
                  <div className="bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/60 space-y-2">
                    <span className="block text-[10px] uppercase font-black text-amber-800 tracking-wider">
                      📅 Choose Calendar (Custom Range):
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-500 font-extrabold block">From (X Date):</span>
                        <input
                          type="date"
                          value={vendorFromDate || ""}
                          onChange={(e) => setVendorFromDate(e.target.value)}
                          className="w-full text-xs font-sans p-1.5 border border-slate-200 bg-white text-slate-800 rounded-md"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[9px] text-slate-500 font-extrabold block">To (Y Date):</span>
                        <input
                          type="date"
                          value={vendorToDate || ""}
                          onChange={(e) => setVendorToDate(e.target.value)}
                          className="w-full text-xs font-sans p-1.5 border border-slate-200 bg-white text-slate-800 rounded-md"
                        />
                      </div>
                    </div>
                    {(vendorFromDate || vendorToDate) && (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorFromDate("");
                          setVendorToDate("");
                        }}
                        className="text-[9.5px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors px-1 cursor-pointer"
                      >
                        <X size={10} /> Clear Calendar Filters
                      </button>
                    )}
                  </div>

                  <p className="text-[9.5px] text-[#DD6B20] font-sans font-medium">
                    Type or click the vendor's EXACT code key to filter out typos instantly!
                  </p>
                </div>

                {/* Vendor Cards List scrollable */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-150 p-2.5 custom-scrollbar space-y-1.5">
                  {vendorRecordsList
                    .filter(rec => {
                      if (!selectedVendorCodeForReport || !selectedVendorCodeForReport.trim()) return true;
                      const q = selectedVendorCodeForReport.toLowerCase();
                      return (
                        rec.code.toLowerCase().includes(q) ||
                        rec.name.toLowerCase().includes(q)
                      );
                    })
                    .map((rec) => {
                      const status = calculatePaymentStatus(rec.lastSettleDate, rec.paymentCycle);
                      const isSelected = selectedVendorCodeForReport.toUpperCase() === rec.code;
                      
                      return (
                        <div
                          key={rec.code}
                          onClick={() => setSelectedVendorCodeForReport(rec.code)}
                          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-amber-50/75 border-amber-300 ring-2 ring-amber-500/10 shadow-sm"
                              : "bg-white hover:bg-slate-50 border-slate-200"
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1">
                            <div className="min-w-0">
                              <p className="text-[9.5px] font-bold font-mono text-amber-800 bg-amber-100/50 rounded px-1.5 py-0.5 inline-block uppercase mb-1">
                                🔑 {rec.code}
                              </p>
                              <h4 className="text-xs font-black text-slate-900 truncate font-sans">{rec.name}</h4>
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase shrink-0 font-mono ${status.badgeColor}`}>
                              {rec.paymentCycle}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-[10px] grid grid-cols-2 gap-x-2 gap-y-0.5 text-slate-500 font-medium font-sans">
                            <p>📦 Batches: <strong className="text-slate-800">{rec.items.length}</strong></p>
                            <p>📈 Vol: <strong className="text-slate-800 font-mono">{rec.totalQuantity}</strong></p>
                            <p className="col-span-2 text-slate-900 font-bold mt-1">Total Supplies: ₹{rec.totalBillAmount.toLocaleString()}</p>
                          </div>

                          <div className="mt-2.5 pt-2 border-t border-dashed border-slate-150 flex items-center justify-between">
                            <span className={`text-[8.5px] px-1.5 py-0.5 rounded uppercase font-bold leading-tight ${status.badgeColor}`}>
                              {status.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  
                  {vendorRecordsList.length === 0 && (
                    <div className="p-8 text-center text-slate-400 font-semibold text-xs">
                      No vendor suppliers found in current inventory databases.
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT PANEL: Detailed Vendor report, billing sheet, settlement calculator */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white">
                {(() => {
                  const activeCode = (selectedVendorCodeForReport || "").trim().toUpperCase();
                  // Default to first vendor record if search is cleared, or find the clicked one
                  const record = vendorRecordsList.find(r => r.code === activeCode) || 
                                 (vendorRecordsList.length > 0 ? vendorRecordsList[0] : null);

                  if (!record) {
                    return (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 bg-slate-50/20">
                        <Sliders size={45} className="mb-2 stroke-slate-350" />
                        <p className="font-semibold text-xs text-center text-slate-500">
                          Please select or enter a valid Vendor Code to inspect transaction details!
                        </p>
                      </div>
                    );
                  }

                  const statusInfo = calculatePaymentStatus(record.lastSettleDate, record.paymentCycle);

                  return (() => {
                    const { items: filteredItems, totalQuantity: filteredQty, totalBillAmount: filteredAmount } = getFilteredVendorData(record);
                    return (
                      <div className="flex-1 flex flex-col min-h-0">
                        
                        {/* Detailed Vendor Title header */}
                        <div className="p-6 border-b border-slate-200 bg-slate-50/60 shrink-0">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9.5px] font-bold font-mono text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200 uppercase">
                                  %BI_STAMP_TOKEN_KEY% ACTIVE SUPPLIER ID: {record.code}
                                </span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-900 border border-indigo-200 font-bold px-2 py-0.5 rounded font-sans uppercase">
                                  🔄 {record.paymentCycle} Settlement Plan
                                </span>
                              </div>
                              <h3 className="text-lg font-black text-slate-900 mt-2 font-sans">
                                {record.name}
                              </h3>
                              <p className="text-xs text-slate-500 font-medium font-sans">
                                Primary School Hardware Vendor & Maintenance Contractor
                              </p>
                              
                              {/* Dynamic Vendor Reports and Downloads tray */}
                              <div className="flex flex-wrap gap-2 mt-3.5 no-print">
                                <span className="text-[10px] font-black uppercase text-slate-400 block w-full mb-0.5">
                                  📥 REGISTERED LEDGER DOWNLOAD DESK:
                                </span>
                                <button
                                  type="button"
                                  onClick={() => downloadVendorPDFReport(record)}
                                  className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs border border-rose-700"
                                >
                                  <Download size={13} />
                                  <span>Download PDF Report</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadVendorCSVReport(record)}
                                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs border border-emerald-705"
                                >
                                  <FileSpreadsheet size={13} />
                                  <span>Export Excel (CSV)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVendorLedgerTab("preview")}
                                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs border border-indigo-700 font-sans"
                                >
                                  <Eye size={13} />
                                  <span>View PDF Report</span>
                                </button>
                              </div>
                            </div>

                            {/* Financial Sum Cards */}
                            <div className="flex gap-3">
                              <div className="bg-slate-900 text-white p-3.5 rounded-xl text-center min-w-[120px] border border-slate-800">
                                <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-wider">Supplied Batches</p>
                                <p className="text-sm font-black font-mono mt-0.5">{filteredItems.length}</p>
                              </div>
                              <div className="bg-amber-600 text-white p-3.5 rounded-xl text-center min-w-[160px] border border-amber-700 shadow-sm">
                                <p className="text-[8.5px] text-amber-100 font-bold uppercase tracking-wider">Cumulative Ledger Value</p>
                                <p className="text-base font-black font-mono mt-0.5">₹{filteredAmount.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Mode Tab Selector */}
                        <div className="flex border-b border-slate-200 px-6 bg-slate-50 shrink-0 gap-6">
                          <button
                            type="button"
                            onClick={() => setVendorLedgerTab("table")}
                            className={`py-3 text-xs font-black uppercase tracking-wider relative cursor-pointer border-b-2 transition-all ${
                              vendorLedgerTab === "table" 
                                ? "border-amber-500 text-amber-800 font-extrabold" 
                                : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            📋 Transaction Table ({filteredItems.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setVendorLedgerTab("preview")}
                            className={`py-3 text-xs font-black uppercase tracking-wider relative cursor-pointer border-b-2 transition-all ${
                              vendorLedgerTab === "preview" 
                                ? "border-amber-500 text-amber-800 font-extrabold" 
                                : "border-transparent text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            📄 Live PDF Report Viewer
                          </button>
                        </div>

                        {vendorLedgerTab === "preview" ? (
                          <div className="flex-1 bg-slate-100 p-5 flex flex-col min-h-0">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row gap-3 justify-between items-center mb-3 text-slate-800">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-black text-slate-700">📄 PREVIEW LAYOUT:</span>
                                <div className="inline-flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMode("paper")}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                                      previewMode === "paper"
                                        ? "bg-white text-slate-900 shadow-xs"
                                        : "text-slate-500 hover:text-slate-800"
                                    }`}
                                  >
                                    ✨ Interactive Paper
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPreviewMode("iframe")}
                                    className={`px-3 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                                      previewMode === "iframe"
                                        ? "bg-white text-slate-900 shadow-xs"
                                        : "text-slate-500 hover:text-slate-800"
                                    }`}
                                  >
                                    ⚙️ PDF Iframe (File)
                                  </button>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => downloadVendorPDFReport(record)}
                                className="px-4 py-1.5 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow transition-all"
                              >
                                <Download size={13} />
                                <span>Save PDF Copy</span>
                              </button>
                            </div>

                            {previewMode === "paper" ? (
                              <div className="flex-1 overflow-y-auto bg-slate-200 p-4 md:p-6 rounded-xl border border-slate-300 flex justify-center custom-scrollbar">
                                <div className="bg-white text-slate-800 p-8 shadow-md border border-slate-350 w-full max-w-3xl min-h-[900px] flex flex-col justify-between font-sans text-left">
                                  <div>
                                    {/* Header block */}
                                    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-5 text-slate-900">
                                      <div>
                                        <h1 className="text-xl font-black tracking-tight uppercase">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</h1>
                                        <p className="text-[8.5px] font-black uppercase tracking-widest text-[#F97316] mt-0.5">
                                          OFFICIAL HARDWARE SUPPLIER TRANSACTION STATUS & BALANCE LEDGER
                                        </p>
                                        {(vendorFromDate || vendorToDate) && (
                                          <p className="text-[8px] font-bold text-slate-500 mt-1 uppercase">
                                            📅 FILTERS: {vendorFromDate || "Start"} to {vendorToDate || "End"}
                                          </p>
                                        )}
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-black font-mono block">CODE: {record.code}</span>
                                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                          Cycle: {record.paymentCycle}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Profile Meta Cards */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mb-5">
                                      <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider mb-1">Supplier Profile</span>
                                        <h4 className="font-extrabold text-slate-950 leading-tight">{record.name}</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 font-sans">Primary School IT Hardware & Maintenance Vendor</p>
                                      </div>
                                      
                                      <div className="bg-slate-50/50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2 text-slate-700">
                                        <div>
                                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">Last Settle Date</span>
                                          <span className="font-mono text-[11px] font-bold">🗓️ {record.lastSettleDate}</span>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">Outstanding Due Date</span>
                                          <span className="font-mono text-[11px] font-bold">🗓️ {statusInfo.nextDateStr}</span>
                                        </div>
                                        <div className="col-span-2 pt-1.5 border-t border-dashed border-slate-200">
                                          <span className="text-[8px] font-black uppercase text-slate-400 block tracking-wider">Settlement Health</span>
                                          <span className="text-[10px] font-bold text-slate-900">{statusInfo.label}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Finance Summaries */}
                                    <div className="grid grid-cols-3 gap-3 text-center mb-5 font-sans">
                                      <div className="border border-slate-200 p-2 bg-slate-50/30 rounded-lg">
                                        <span className="text-[8px] font-black text-slate-405 uppercase tracking-widest block">Supplies Batches</span>
                                        <strong className="text-base font-black font-mono text-slate-900">{filteredItems.length}</strong>
                                      </div>
                                      <div className="border border-slate-200 p-2 bg-slate-50/30 rounded-lg">
                                        <span className="text-[8px] font-black text-slate-405 uppercase tracking-widest block">Quantity Supplied</span>
                                        <strong className="text-base font-black font-mono text-slate-900">{filteredQty} units</strong>
                                      </div>
                                      <div className="border border-amber-200 p-2 bg-amber-50/45 rounded-lg">
                                        <span className="text-[8px] font-black text-amber-800 uppercase tracking-widest block">Cumulative Value</span>
                                        <strong className="text-base font-black font-mono text-amber-950">₹{filteredAmount.toLocaleString()}</strong>
                                      </div>
                                    </div>

                                    {/* Itemized Table */}
                                    <div className="border border-slate-200 rounded-lg overflow-hidden my-3">
                                      <table className="w-full text-left text-[10px] border-collapse bg-white">
                                        <thead>
                                          <tr className="bg-slate-900 text-white font-extrabold uppercase text-[8px] tracking-wider">
                                            <th className="p-2.5 text-center w-8 border-r border-slate-800">#</th>
                                            <th className="p-2.5 w-16 border-r border-slate-800">Stock ID</th>
                                            <th className="p-2.5 border-r border-slate-800">Material Name Detail</th>
                                            <th className="p-2.5 text-center w-12 border-r border-slate-800">Qty</th>
                                            <th className="p-2.5 text-right w-20 border-r border-slate-800">Unit Cost</th>
                                            <th className="p-2.5 text-right">Subtotal</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-150 text-slate-700 font-medium">
                                          {filteredItems.map((item, index) => {
                                            const subtotal = (item.totalQty || 0) * (item.unitPrice || 0);
                                            return (
                                              <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="p-2 text-center text-slate-450 font-bold border-r border-slate-150">{index + 1}</td>
                                                <td className="p-2 font-mono text-[8.5px] text-slate-500 border-r border-slate-150">{item.id}</td>
                                                <td className="p-2 border-r border-slate-150">
                                                  <span className="font-extrabold text-slate-900 block leading-tight">{item.itemName || "Unnamed"}</span>
                                                  <span className="text-[7.5px] text-slate-400 font-mono uppercase">{item.category || "General"}</span>
                                                </td>
                                                <td className="p-2 text-center font-mono border-r border-slate-150">{item.totalQty || 0}</td>
                                                <td className="p-2 text-right font-mono border-r border-slate-150">₹{(item.unitPrice || 0).toLocaleString()}</td>
                                                <td className="p-2 text-right font-mono font-bold text-slate-900">₹{subtotal.toLocaleString()}</td>
                                              </tr>
                                            );
                                          })}
                                          {filteredItems.length === 0 && (
                                            <tr>
                                              <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                                No transactions logged within requested selection.
                                              </td>
                                            </tr>
                                          )}
                                          <tr className="bg-slate-50 text-slate-950 font-black border-t-2 border-slate-900">
                                            <td colSpan={3} className="p-3 text-left">Grand Cumulative Ledger Value</td>
                                            <td className="p-3 text-center font-mono">{filteredQty} Units</td>
                                            <td className="p-3"></td>
                                            <td className="p-3 text-right font-mono text-slate-950">₹{filteredAmount.toLocaleString()}</td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  {/* Signatures Row */}
                                  <div className="border-t border-slate-200 pt-5 mt-6">
                                    <div className="grid grid-cols-2 gap-8 text-center text-[8.5px] text-slate-500">
                                      <div className="space-y-3">
                                        <div className="border-t border-dashed border-slate-300 pt-1 font-bold uppercase tracking-widest text-indigo-700">
                                          BI Campus Accountant Desk
                                        </div>
                                      </div>
                                      <div className="space-y-3">
                                        <div className="border-t border-dashed border-slate-300 pt-1 font-bold uppercase tracking-widest text-[#F97316]">
                                          Delivering Supplier Representative
                                        </div>
                                      </div>
                                    </div>
                                    <p className="text-center text-[7.5px] text-slate-400 mt-5 font-semibold tracking-wide uppercase">
                                      Compiled electronically. Real-time ledger record system authenticated.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex-1 bg-slate-800 rounded-xl overflow-hidden shadow-inner border border-slate-700 relative min-h-[350px]">
                                {pdfBlobUrl ? (
                                  <iframe
                                    src={`${pdfBlobUrl}#toolbar=1`}
                                    className="w-full h-full border-0 absolute inset-0 bg-slate-800"
                                    title="Vendor Ledger Live PDF Preview"
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber-500 border-t-transparent" />
                                    <p className="text-xs font-semibold text-slate-300">Compiling official PDF report document...</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Payment Scheduler & Settle Logger Row */}
                            <div className="p-5 border-b border-slate-150 bg-amber-50/30 grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 items-center">
                              <div className="space-y-0.5">
                                <span className="block text-[9px] font-extrabold uppercase text-slate-450 tracking-wider">Last Payment Date</span>
                                <strong className="text-slate-800 text-sm font-mono block">🗓️ {record.lastSettleDate}</strong>
                                <p className="text-[9px] text-slate-400 font-semibold font-sans">Reconciled via Secure Ledger Audit Desk</p>
                              </div>

                              <div className="space-y-0.5">
                                <span className="block text-[9px] font-extrabold uppercase text-slate-450 tracking-wider">Next Settlement Release</span>
                                <strong className="text-slate-800 text-sm font-mono block">🗓️ {statusInfo.nextDateStr}</strong>
                                <div className="mt-1 inline-block">
                                  <span className={`text-[9.5px] px-2 py-0.5 rounded font-extrabold font-mono uppercase ${statusInfo.badgeColor}`}>
                                    {statusInfo.label}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-stretch md:items-end justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRecordSettlement(record.code)}
                                  className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                                >
                                  ✅ Record Payments Release (Settle)
                                </button>
                                <p className="text-[9px] text-slate-400 text-center md:text-right mt-1 font-medium font-sans">
                                  Appends audit lines to related items & resets cycle days.
                                </p>
                              </div>
                            </div>

                            {/* Grid of Supplied Material list */}
                            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-4">
                              <h4 className="text-[11px] uppercase font-extrabold text-slate-400 tracking-wider">
                                📦 Itemized Supplied Materials & Asset Batches
                              </h4>
                              
                              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9.5px]">
                                      <th className="p-3 w-12 text-center">S.No</th>
                                      <th className="p-3 w-20">Stock ID</th>
                                      <th className="p-3">Material Name & Category</th>
                                      <th className="p-3 text-center">Batch Qty</th>
                                      <th className="p-3 text-right">Unit Price</th>
                                      <th className="p-3 text-right bg-amber-50/30 text-amber-950 font-black">Subtotal Value</th>
                                      <th className="p-3 text-center">Receiving Date</th>
                                      <th className="p-3">Warranty status</th>
                                    </tr>
                                  </thead>
                                   <tbody className="divide-y divide-slate-150 font-medium text-slate-800">
                                    {filteredItems.map((item, index) => {
                                      const subtotal = (item.totalQty || 0) * (item.unitPrice || 0);
                                      return (
                                        <tr key={item.id} className="hover:bg-slate-50/20">
                                          <td className="p-3 font-semibold text-slate-400 text-center">{index + 1}</td>
                                          <td className="p-3 font-mono text-[9.5px] font-bold text-slate-500">{item.id}</td>
                                          <td className="p-3">
                                            <span className="font-bold text-slate-900 block leading-tight">{item.itemName || "Unnamed"}</span>
                                            <span className="text-[9px] text-slate-400 font-mono uppercase">{item.category || "General"}</span>
                                          </td>
                                          <td className="p-3 text-center font-mono font-bold text-slate-700">{item.totalQty || 0} units</td>
                                          <td className="p-3 text-right font-mono font-semibold text-slate-500">
                                            ₹{(item.unitPrice || 0).toLocaleString()}
                                          </td>
                                          <td className="p-3 text-right font-mono font-black bg-amber-50/10 text-amber-900">
                                            ₹{subtotal.toLocaleString()}
                                          </td>
                                          <td className="p-3 font-mono text-center text-slate-500">{item.date || "-"}</td>
                                          <td className="p-3">
                                            <span className="text-[10px] font-semibold text-indigo-700 font-sans">
                                              🛡️ {item.warranty || "N/A"}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                    {filteredItems.length === 0 && (
                                      <tr>
                                        <td colSpan={8} className="p-8 text-center text-slate-400 font-semibold text-xs">
                                          No transactions recorded within selected calendar date range.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>

                              {/* Quick Payment Rules Info Card */}
                              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3">
                                <span className="text-lg">💡</span>
                                <div className="text-[10.5px] leading-relaxed text-slate-500 font-medium">
                                  <strong className="text-slate-900 uppercase font-extrabold block mb-1">
                                    Payment Settlement Guidelines (SOP):
                                  </strong>
                                  We follow a rigid hardware delivery timeline where vendors provide immediate hardware deliveries on-demand when academic terms require them. Payments are pooled into structured cycles (e.g. Monthly or 6-Month Half-Yearly) to optimize cash outflows. Reconciling payment transactions will instantly format related master stocks, logging audit trails for school branch accountant reviews.
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        
                      </div>
                    );
                  })()
                })()}
              </div>

            </div>

            {/* Modal Footer Control actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0 gap-3">
              <button
                type="button"
                onClick={() => {
                  // Direct print command on active report!
                  window.print();
                }}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 bg-white text-xs font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <Printer size={13} />
                <span>Print Invoice Summary</span>
              </button>
              <button
                type="button"
                onClick={() => setShowVendorLedger(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Close Ledger Desk
              </button>
            </div>

          </div>
        </div>
      )}

      {/* React Portal to inject printable Vendor Ledger directly under body for seamless native print flow */}
      {showVendorLedger && (() => {
        const activeCode = (selectedVendorCodeForReport || "").trim().toUpperCase();
        const record = vendorRecordsList.find(r => r.code === activeCode) || 
                       (vendorRecordsList.length > 0 ? vendorRecordsList[0] : null);
        
        if (!record) return null;

        const { items: filteredItems, totalQuantity: filteredQty, totalBillAmount: filteredAmount } = getFilteredVendorData(record);
        
        return createPortal(
          <div id="print-vendor-ledger-root" className="hidden print:block bg-white text-slate-800 p-12 leading-relaxed font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
              {/* Header block */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6">
                <div>
                  <h1 className="text-3xl font-black tracking-tight text-slate-900">BIRLA OPEN MINDS INTERNATIONAL SCHOOL</h1>
                  <p className="text-xs uppercase tracking-widest text-[#F97316] font-bold mt-1">
                    OFFICIAL HARDWARE SUPPLIER TRANSACTION STATUS & BALANCE LEDGER
                  </p>
                  {(vendorFromDate || vendorToDate) && (
                    <p className="text-[10px] font-bold text-slate-500 mt-2">
                      📅 FILTERED TRANSACTION RANGE: {vendorFromDate || "Start"} to {vendorToDate || "End"}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-extrabold text-slate-900 block font-mono">VENDOR CODE: {record.code}</span>
                  <span className="inline-block mt-2 text-xs font-black bg-slate-900 text-white px-3 py-1 rounded">
                    SETTLEMENT CYCLE: {record.paymentCycle}
                  </span>
                </div>
              </div>

              {/* Meta status summary */}
              <div className="grid grid-cols-2 gap-6 my-6">
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">Supplier Profile</span>
                  <h4 className="text-base font-black text-slate-900 leading-tight">{record.name}</h4>
                  <p className="text-xs font-medium text-slate-500">Official Campus IT & Hardware Contractor</p>
                </div>
                
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-455 tracking-wider block">Last Settle Date</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">🗓️ {record.lastSettleDate}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-455 tracking-wider block">Outstanding Due Date</span>
                    <span className="text-sm font-bold text-slate-800 font-mono">🗓️ {calculatePaymentStatus(record.lastSettleDate, record.paymentCycle).nextDateStr}</span>
                  </div>
                  <div className="col-span-2 pt-1 border-t border-dashed border-slate-200">
                    <span className="text-[9px] font-black uppercase text-slate-455 tracking-wider block">Status Health</span>
                    <span className="text-xs font-bold text-slate-900">
                      {calculatePaymentStatus(record.lastSettleDate, record.paymentCycle).label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial summaries */}
              <div className="grid grid-cols-3 gap-4 my-6 text-center">
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Supplies Batches</span>
                  <span className="block text-lg font-black text-slate-900 font-mono">{filteredItems.length}</span>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <span className="text-[9px] font-bold text-slate-500 uppercase">Quantity Supplied</span>
                  <span className="block text-lg font-black text-slate-900 font-mono">{filteredQty} items</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl">
                  <span className="text-[9px] font-black text-amber-800 uppercase">Cumulative Value</span>
                  <span className="block text-lg font-black text-amber-950 font-mono">₹{filteredAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Detailed table of transactions */}
              <div className="space-y-3">
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-slate-400 border-b border-slate-200 pb-2">
                  Itemized Material Receipts Detail Sheet
                </h3>
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-700 font-bold uppercase">
                      <th className="py-2.5 px-2 w-10 text-center">S.No</th>
                      <th className="py-2.5 px-2 w-20">Stock ID</th>
                      <th className="py-2.5 px-2">Material / Asset Item Detail</th>
                      <th className="py-2.5 px-2 text-center">Qty</th>
                      <th className="py-2.5 px-2 text-right">Unit Cost</th>
                      <th className="py-2.5 px-2 text-right">Subtotal</th>
                      <th className="py-2.5 px-2 text-center">Receipt Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                    {filteredItems.map((item, idx) => {
                      const subtotal = (item.totalQty || 0) * (item.unitPrice || 0);
                      return (
                        <tr key={item.id}>
                          <td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-2 font-mono text-slate-650">{item.id}</td>
                          <td className="py-2 px-2">
                            <span className="font-bold text-slate-900 block">{item.itemName || "Unnamed"}</span>
                            <span className="text-[9px] text-slate-400 uppercase">{item.category || "General"}</span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{item.totalQty || 0} Units</td>
                          <td className="py-2 px-2 text-right font-mono">₹{(item.unitPrice || 0).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">₹{subtotal.toLocaleString()}</td>
                          <td className="py-2 px-2 text-center font-mono text-slate-500">{item.date || "-"}</td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400 font-semibold">
                          No transactions recorded within selected calendar range.
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2 border-slate-900 font-extrabold text-slate-950 bg-slate-50">
                      <td colSpan={3} className="py-3 px-2 text-left">Grand Cumulative Outstanding Portfolios</td>
                      <td className="py-3 px-2 text-center font-mono">{filteredQty} Units</td>
                      <td className="py-3 px-2"></td>
                      <td className="py-3 px-2 text-right font-mono font-bold">₹{filteredAmount.toLocaleString()}</td>
                      <td className="py-3 px-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Official Signatures */}
              <div className="grid grid-cols-2 gap-12 pt-20">
                <div className="text-center">
                  <div className="border-t border-slate-400 pt-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      BI Branch Accountant signature
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-400 pt-3">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Supplier Representative signature
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="text-center pt-8 border-t border-slate-100 text-[9px] text-slate-400 font-semibold font-sans tracking-wide">
                Document compiled electronically. Official internal audit trail logs registered on-site in Birla Open Minds International School Database Master Pools.
              </div>
            </div>
          </div>,
          document.body
        );
      })()}

      {/* Portalled Print Output direct to document body to bypass iframe constraints and parent modal styling overlays on print */}
      {showPrintModal && createPortal(
        <div 
          id="print-inventory-root"
          className="hidden print:block bg-white p-[0.75in] text-slate-900 relative"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {renderInventoryPrintContent()}
        </div>,
        document.body
      )}

      {/* ⚡ QUICK ISSUE / MATERIAL DISPATCH MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[1100] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 select-text">
            <div className="p-5 bg-gradient-to-r from-orange-600 to-amber-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚡</span>
                <div>
                  <h3 className="font-extrabold text-base tracking-wide uppercase">Quick Issue Material to Staff / Room</h3>
                  <p className="text-[10.5px] text-orange-100 font-medium">Issue store inventory directly & generate signed PDF dispatch slip</p>
                </div>
              </div>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="hover:bg-white/20 p-1.5 rounded-lg text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-slate-800 text-xs">
              <div>
                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                  📦 Select Inventory Item to Issue
                </label>
                <select
                  value={dispatchItemId}
                  onChange={(e) => setDispatchItemId(e.target.value)}
                  className="w-full py-2.5 px-3 border border-slate-250 rounded-xl text-xs bg-slate-50 text-slate-900 font-semibold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                >
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.itemName} ({i.category}) — Avail Bal: {i.balanceQty ?? (i.totalQty - i.usedQty)} Units
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                    👤 Teacher / Recipient Staff Name
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchStaffName}
                    onChange={(e) => setDispatchStaffName(e.target.value)}
                    placeholder="E.g. Sravan Kumar (Science)"
                    className="w-full py-2 px-3 border border-slate-250 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                    🏫 Class Room / Dept / Location
                  </label>
                  <input
                    type="text"
                    required
                    value={dispatchRoom}
                    onChange={(e) => setDispatchRoom(e.target.value)}
                    placeholder="E.g. Class 1-A, Science Lab"
                    className="w-full py-2 px-3 border border-slate-250 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                    🔢 Quantity to Issue
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={dispatchQty}
                    onChange={(e) => setDispatchQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full py-2 px-3 border border-slate-250 rounded-xl text-xs bg-slate-50 text-slate-900 font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                    📝 Purpose / Remarks
                  </label>
                  <input
                    type="text"
                    value={dispatchNotes}
                    onChange={(e) => setDispatchNotes(e.target.value)}
                    placeholder="E.g. Daily teaching supply"
                    className="w-full py-2 px-3 border border-slate-250 rounded-xl text-xs bg-slate-50 text-slate-900 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {dispatchItemId && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-[11px] text-orange-950 leading-relaxed font-sans">
                  💡 <strong>Stock Deduct Note:</strong> On clicking confirm, <strong>{dispatchQty} unit(s)</strong> will be decremented from available store stock and a signed PDF Dispatch Voucher Slip will be generated.
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-600 hover:bg-slate-100 bg-white text-xs font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDispatch}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow cursor-pointer transition-colors flex items-center gap-1.5"
              >
                <span>⚡</span>
                Confirm Issue & Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
