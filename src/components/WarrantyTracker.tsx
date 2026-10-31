import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Search, Save, Calendar, ShieldCheck, Mail, ShieldAlert, BadgeInfo, FileSpreadsheet, Eye, Printer, X, Info, FileText, Download } from "lucide-react";
import { WarrantyContract, InventoryItem } from "../types";

interface WarrantyTrackerProps {
  warranty: WarrantyContract[];
  inventory: InventoryItem[];
  updateWarranty: (war: WarrantyContract[]) => void;
}

export default function WarrantyTracker({ warranty, inventory, updateWarranty }: WarrantyTrackerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "soon" | "expired">("all");
  const [printModalType, setPrintModalType] = useState<"register" | "single" | null>(null);
  const [selectedContract, setSelectedContract] = useState<WarrantyContract | null>(null);

  const now = new Date();
  const todayAnchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Days calculations
  const getDaysLeft = (expDateStr: string) => {
    if (!expDateStr || typeof expDateStr !== "string" || expDateStr === "No Warranty") return -99999;
    try {
      // Input DD-MM-YYYY or YYYY-MM-DD
      const delimiter = expDateStr.includes("/") ? "/" : "-";
      const parts = expDateStr.split(delimiter);
      if (parts.length !== 3) return 365;
      let expDate: Date;
      if (parts[0].length === 4) {
        expDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
      } else {
        expDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      if (isNaN(expDate.getTime())) return 365;
      const diffTime = expDate.getTime() - todayAnchor.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 365;
    }
  };

  const handleDeleteContract = (id: string) => {
    if (confirm("Remove this warranty contract entry from tracking master?")) {
      const filtered = warranty.filter(w => w.id !== id);
      updateWarranty(filtered);
    }
  };

  // Filter list with tabs search parameters
  const filteredContracts = warranty.filter((w) => {
    // Expiry category matches
    const daysLeft = getDaysLeft(w.expiryDate);
    const isExpired = w.isNoWarranty || daysLeft < 0;
    const isExpiringSoon = !w.isNoWarranty && daysLeft >= 0 && daysLeft <= 30;

    let filterMatch = true;
    if (activeFilter === "soon") filterMatch = isExpiringSoon;
    else if (activeFilter === "expired") filterMatch = isExpired;

    if (!filterMatch) return false;

    if (!searchTerm.trim()) return true;
    const s = searchTerm.toLowerCase();
    return (
      w.itemName.toLowerCase().includes(s) ||
      w.vendor.toLowerCase().includes(s) ||
      w.type.toLowerCase().includes(s)
    );
  });

  // Export warranties spreadsheet
  const handleExportWarranties = () => {
    let output = "Hardware Item Name,Contract Type,Vendor Supplier,Expiry Date,Days Left,Status\n";
    warranty.forEach(w => {
      const dLeft = getDaysLeft(w.expiryDate);
      const status = w.isNoWarranty ? "No Warranty" : dLeft < 0 ? "Expired" : dLeft <= 30 ? "Expiring Soon" : "Active";
      const daysText = w.isNoWarranty ? "N/A" : dLeft;
      output += `"${w.itemName}","${w.type}","${w.vendor}","${w.expiryDate}",${daysText},"${status}"\n`;
    });

    const blob = new Blob([output], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `BIRLA_WARRANTIES_AMC_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="warranty-tab" className="flex flex-col h-full bg-[#f8fafc] text-slate-800 p-8 overflow-y-auto w-full custom-scrollbar">
      
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">🔰 WARRANTY & AMC TRACKER (SECURE)</h2>
          <p className="text-xs text-slate-500 font-medium">Automatic contract exipry trackers, vendor support profiles, and alert triggers</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-2.5">
          <button
            onClick={handleExportWarranties}
            className="px-4 py-2.5 bg-[#38A169] hover:bg-emerald-600 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer animate-pulse"
          >
            <FileSpreadsheet size={15} />
            EXPORT REGISTER (.CSV)
          </button>
          <button
            onClick={() => setPrintModalType("register")}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg tracking-wide shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer size={15} />
            PRINT ACTIVE REGISTER (PDF)
          </button>
        </div>
      </div>

      <div className="my-8 w-full">

        {/* Right Dynamic Live Tracker desk table */}
        <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
          
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
            
            {/* View selectors filter tabs split button */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter("all")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeFilter === "all" ? "bg-slate-950 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Contracts
              </button>
              <button
                onClick={() => setActiveFilter("soon")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeFilter === "soon" ? "bg-slate-950 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Expiring Soon (30 Days Left)
              </button>
              <button
                onClick={() => setActiveFilter("expired")}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  activeFilter === "expired" ? "bg-slate-950 text-white shadow" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Expired Ledger
              </button>
            </div>

            {/* Quick Live Search text box input */}
            <div className="relative w-full sm:w-60">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 pointer-events-none">
                <Search size={14} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search Item / Supplier..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

          </div>

          {/* Item Lists Cards feed */}
          <div className="p-4 space-y-4 overflow-y-auto max-h-[500px] custom-scrollbar">
            {filteredContracts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-1.5">
                <BadgeInfo size={40} className="stroke-slate-300 animate-pulse" />
                <p className="text-xs font-semibold">No monitored active contracts fit criteria parameters.</p>
              </div>
            ) : (
              filteredContracts.map((w) => {
                const daysLeft = getDaysLeft(w.expiryDate);
                const isExpired = w.isNoWarranty || daysLeft < 0;
                const isSoon = !w.isNoWarranty && daysLeft >= 0 && daysLeft <= 30;

                const bgClass = w.isNoWarranty 
                  ? "bg-slate-50/75 dark:bg-slate-900/40 opacity-75" 
                  : isExpired ? "bg-rose-50/50" : isSoon ? "bg-amber-50/50" : "bg-white";
                const borderClass = w.isNoWarranty
                  ? "border-slate-200"
                  : isExpired ? "border-rose-200/50" : isSoon ? "border-amber-200/50" : "border-slate-200/80";

                return (
                  <div 
                    key={w.id} 
                    className={`p-5 rounded-xl border ${borderClass} ${bgClass} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition-shadow`}
                  >
                    <div className="space-y-1 select-text col-span-12 max-w-lg">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-[#D53F8C]">
                          📦 {w.itemName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">
                          Cover ID: {w.id}
                        </span>
                        {w.isAutoFromInventory && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider bg-orange-100 text-orange-850 rounded uppercase">
                            🔗 Sync Managed
                          </span>
                        )}
                        {w.isNoWarranty && (
                          <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wider bg-slate-200 text-slate-700 rounded uppercase">
                            🛡️ No Shield
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        📝 Type: {w.type}  |  📞 Vendor Supplier: {w.vendor}
                      </h4>

                      <div className="text-[11px] text-slate-400 font-medium">
                        Cover Registered: {w.registeredOn}
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1.5 self-center min-w-[150px]">
                      <div className="text-xs font-bold text-slate-500 font-sans">
                        Expiry Limit: <span className="text-slate-900 font-mono font-bold">{w.expiryDate}</span>
                      </div>

                      {w.isNoWarranty ? (
                        <div className="text-xs font-extrabold text-slate-500 flex items-center gap-1">
                          <ShieldAlert size={14} className="text-slate-400" />
                          UNPROTECTED
                        </div>
                      ) : isExpired ? (
                        <div className="text-xs font-extrabold text-rose-600 flex items-center gap-1">
                          <ShieldAlert size={14} />
                          🚨 CONTRACT EXPIRED
                        </div>
                      ) : isSoon ? (
                        <div className="text-xs font-extrabold text-[#DD6B20] flex items-center gap-1">
                          <ShieldAlert size={14} className="animate-bounce" />
                          ⚠️ EXPIRING IN {daysLeft} DAYS
                        </div>
                      ) : (
                        <div className="text-xs font-extrabold text-emerald-600 flex items-center gap-1">
                          <ShieldCheck size={14} />
                          ✅ ACTIVE ({daysLeft} Days Left)
                        </div>
                      )}

                      <div className="flex flex-col items-end gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedContract(w);
                            setPrintModalType("single");
                          }}
                          className="px-2.5 py-1 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-750 font-black rounded flex items-center gap-1 transition-all cursor-pointer border border-indigo-200 uppercase tracking-wider"
                        >
                          <Eye size={11} />
                          <span>View & Print Document (PDF)</span>
                        </button>

                        {w.isAutoFromInventory ? (
                          <span className="text-[10px] font-bold text-slate-400 italic">
                            Manage in Stock Tab
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDeleteContract(w.id)}
                            className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            Delete tracking
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

      </div>

      {/* EXECUTIVE FULL-SCREEN MODAL LAYOUT */}
      {printModalType && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs flex items-start justify-center overflow-y-auto p-4 md:p-8 z-[1000] animate-fade-in text-slate-900 select-text">
          <div className="bg-white border border-slate-400 shadow-2xl rounded-2xl w-full max-w-5xl overflow-hidden flex flex-col shrink-0 my-4">
            
            {/* Modal Tool Bar Panel */}
            <div className="p-4 bg-slate-100 border-b border-slate-200 flex justify-between items-center text-slate-700 select-none no-print">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {printModalType === "register"
                    ? "IT Warranty & AMC Contracts Registered Tally PDF Builder"
                    : `Hardware Warranty Cover Cert: COV-${selectedContract?.id}`}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all uppercase tracking-wider font-sans"
                >
                  <Printer size={14} />
                  <span>PRINT / SAVE AS PDF 📥</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPrintModalType(null);
                    setSelectedContract(null);
                  }}
                  className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg bg-white hover:bg-slate-100 transition-all cursor-pointer border border-slate-200"
                  title="Close Preview Window"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Print Instructions Bar */}
            <div className="p-3 bg-indigo-50 border-b border-indigo-150 text-indigo-900 text-[10.5px] leading-relaxed flex items-center gap-1.5 select-none font-sans font-medium no-print">
              <Info size={14} className="shrink-0 text-indigo-600" />
              <span>
                <strong>System Print Guide:</strong> When the browser dialog loads, select <strong>"Save as PDF"</strong> to download a clean offline file, or select your physical office printer. Visual frames and control buttons are stripped out automatically on print-out!
              </span>
            </div>

            {/* Print canvas A4 emulation box */}
            <div className="p-4 sm:p-8 md:p-12 bg-slate-100 max-w-full overflow-x-auto print-document-canvas custom-scrollbar flex justify-center">
              
              {/* Actual printable sheet paper wrapper (Screen Preview copy) */}
              <div 
                id="print-warranty-preview"
                className="w-[210mm] min-h-[297mm] bg-white p-8 sm:p-12 md:p-16 border border-slate-300 shadow-lg text-slate-900 relative font-sans text-xs select-text"
              >
                
                {/* Decorative High-End Corporate Top Margin line */}
                <div className={`w-full h-1.5 ${printModalType === "register" ? "bg-indigo-700" : "bg-[#D53F8C]"} rounded-sm mb-6`}></div>

                {/* Corporate Header Section */}
                <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-1">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight font-sans leading-none uppercase">
                      BIRLA OPEN MINDS INTERNATIONAL SCHOOL
                    </h1>
                    <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest font-mono">
                      {printModalType === "register" ? "IT INFRASTRUCTURE DIVISION" : "HARDWARE COMPLIANCE & WARRANTY"}
                    </p>
                    <p className="text-[10px] text-slate-450 font-medium">
                      Sahara Rd, behind Kamineni Hospitals, Sri Ram Hills Colony, L. B. Nagar, Mansoorabad, Hyderabad, Telangana 500068
                    </p>
                  </div>
                  <div className="text-left sm:text-right text-[10px] space-y-0.5 shrink-0 border-l sm:border-l-0 sm:border-r-0 border-slate-200 pl-3 sm:pl-0 font-mono text-slate-500">
                    <div><strong>OFFICE:</strong> IT Asset Custodian Desk</div>
                    <div><strong>EMAIL:</strong> birlaithelpdesk@gmail.com</div>
                    <div><strong>PRINT DATE:</strong> {new Date().toLocaleString("en-GB")}</div>
                  </div>
                </div>

                {/* Document Body */}
                {printModalType === "single" && selectedContract ? (
                  <div className="space-y-6">
                    
                    {/* Centered Document Title */}
                    <div className="text-center space-y-1 my-4">
                      <h2 className="text-md font-black tracking-widest uppercase text-slate-900 font-sans border-y py-2 border-slate-200">
                        OFFICIAL HARDWARE WARRANTY & COVERAGE CERTIFICATE
                      </h2>
                      <p className="text-[9px] text-slate-450 font-mono tracking-wider">
                        CERTIFICATE REFERENCE: BI-WNT-COV-{selectedContract.id}
                      </p>
                    </div>

                    {/* Status Overview Card */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex justify-between items-center">
                      <div>
                        <p className="text-[8.5px] font-extrabold text-slate-450 uppercase tracking-wider">COVERED HARDWARE ITEM</p>
                        <h3 className="text-sm font-bold text-slate-900 mt-1">
                          📦 {selectedContract.itemName}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-[8.5px] font-extrabold text-slate-450 uppercase tracking-wider">CONTRACT STATUS</p>
                        <span className={`inline-block mt-1 px-3 py-1 font-mono font-black text-[10.5px] rounded border ${
                          selectedContract.isNoWarranty
                            ? "bg-slate-100 text-slate-700 border-slate-300"
                            : getDaysLeft(selectedContract.expiryDate) < 0
                            ? "bg-red-50 text-red-700 border-red-200"
                            : getDaysLeft(selectedContract.expiryDate) <= 30
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {selectedContract.isNoWarranty
                            ? "UNPROTECTED STANDARD"
                            : getDaysLeft(selectedContract.expiryDate) < 0
                            ? "EXPIRED COVERAGE"
                            : getDaysLeft(selectedContract.expiryDate) <= 30
                            ? "EXPIRING SOON"
                            : "ACTIVE WARRANTY"}
                        </span>
                      </div>
                    </div>

                    {/* Specifications Grid */}
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                        📋 COVERAGE PARAMETERS & SERVICE SLAS
                      </h4>
                      <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-4 bg-white">
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">COVER / COV ID:</span>
                            <span className="text-xs font-mono font-black select-all text-slate-900">{selectedContract.id}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">CONTRACT TYPE / CLASS:</span>
                            <span className="text-xs font-bold text-slate-800">{selectedContract.type}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">VENDOR / SUPPORT PARTNER:</span>
                            <span className="text-xs font-bold text-slate-800">{selectedContract.vendor}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">DATE REGISTERED:</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{selectedContract.registeredOn}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">DATE OF EXPIRY / MILESTONE:</span>
                            <span className="text-xs font-bold text-slate-800 font-mono">{selectedContract.expiryDate}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold uppercase block">MATURITY DAYS REMAINING:</span>
                            <span className="text-xs font-mono font-bold text-slate-850">
                              {selectedContract.isNoWarranty 
                                ? "N/A" 
                                : `${getDaysLeft(selectedContract.expiryDate)} Remaining Days`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Standard Terms section */}
                    <div className="space-y-3 pt-2">
                      <h4 className="text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                        ⚖️ TERMS OF MAINTENANCE & TECHNICAL DEFENSE
                      </h4>
                      <div className="space-y-2 text-slate-600 outline-none leading-relaxed text-[10.5px]">
                        <p>
                          <strong>Section 1 (Maintenance Coverage SLA):</strong> The Vendor Supplier covenants with the School Governance Body to deliver comprehensive repair, hardware configuration diagnostic services, and rapid material substitutions under standard warranty classes, in direct compliance with primary institutional procurement contracts.
                        </p>
                        <p>
                          <strong>Section 2 (Safe Stewardship):</strong> This system ledger record certifies that the assigned school hardware properties are covered. Liquid damage, physical accidents due to negligence, unauthorized structural tampering, or serial removals nullify coverage and require immediate asset scrap action.
                        </p>
                      </div>
                    </div>

                    {/* Approver Sign-off Row */}
                    <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 print-no-break">
                      <div className="text-center space-y-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">IT Assets Custodian & Auditor</p>
                        <div className="h-10 border-b border-dashed border-slate-305 w-48 mx-auto mt-4"></div>
                        <p className="text-[9px] text-slate-400 font-medium">Certified Hardware Auditor Sign-off</p>
                      </div>
                      
                      <div className="text-center space-y-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">🏫 Verification & Approval by Principal</p>
                        <div className="h-10 border-b border-dashed border-slate-305 w-48 mx-auto mt-4"></div>
                        <p className="text-[9px] text-slate-400 font-medium leading-none">School Principal & Institution Head</p>
                        <p className="text-[8px] text-slate-400 font-medium leading-none uppercase tracking-wide">Birla Open Minds International School Board</p>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="space-y-6">
                    
                    {/* Centered Document Title */}
                    <div className="text-center space-y-1 my-4">
                      <h2 className="text-md font-black tracking-widest uppercase text-slate-900 font-sans border-y py-2 border-slate-200">
                        IT REGISTER: WARRANTY & AMC CONTRACTS AUDIT LEDGER
                      </h2>
                      <p className="text-[9px] text-slate-450 font-mono tracking-wider">
                        SYSTEM HORIZON FILTER: {activeFilter === "all" ? "ALL ACTIVE LEDGERS" : activeFilter === "soon" ? "EXPIRING IN 30 DAYS" : "EXPIRED CONTRACTS"}
                      </p>
                    </div>

                    {/* Information criteria summary */}
                    <div className="border border-slate-230 bg-slate-50 rounded-lg p-4 grid grid-cols-3 text-center gap-2">
                      <div>
                        <span className="text-[8.5px] uppercase font-extrabold text-slate-400">Total Filtered Records</span>
                        <p className="text-sm font-black font-mono text-slate-800 mt-1">{filteredContracts.length} Columns</p>
                      </div>
                      <div>
                        <span className="text-[8.5px] uppercase font-extrabold text-amber-600">Soon Expiry (&lt;30 days)</span>
                        <p className="text-sm font-black font-mono text-amber-700 mt-1">
                          {filteredContracts.filter(w => !w.isNoWarranty && getDaysLeft(w.expiryDate) >= 0 && getDaysLeft(w.expiryDate) <= 30).length} Items
                        </p>
                      </div>
                      <div>
                        <span className="text-[8.5px] uppercase font-extrabold text-rose-500">Expired Status</span>
                        <p className="text-sm font-black font-mono text-rose-700 mt-1">
                          {filteredContracts.filter(w => !w.isNoWarranty && getDaysLeft(w.expiryDate) < 0).length} Items
                        </p>
                      </div>
                    </div>

                    {/* Tabular Output */}
                    <table className="w-full text-[10.5px] border-collapse border border-slate-300">
                      <thead>
                        <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 uppercase tracking-wider text-[8.5px] font-black">
                          <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                          <th className="p-2 border-r border-slate-300 text-left w-24">Cover ID</th>
                          <th className="p-2 border-r border-slate-300 text-left">Hardware Item Name</th>
                          <th className="p-2 border-r border-slate-300 text-left w-28">Contract Class</th>
                          <th className="p-2 border-r border-slate-300 text-left w-24">Vendor Partner</th>
                          <th className="p-2 border-r border-slate-300 text-center w-20">Expiry Date</th>
                          <th className="p-2 text-center w-24">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContracts.map((w, idx) => {
                          const daysLeft = getDaysLeft(w.expiryDate);
                          const isExpired = w.isNoWarranty || daysLeft < 0;
                          const isSoon = !w.isNoWarranty && daysLeft >= 0 && daysLeft <= 30;

                          return (
                            <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors print-no-break">
                              <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                              <td className="p-2 border-r border-slate-200 text-left font-mono font-bold select-all">{w.id}</td>
                              <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-900">{w.itemName}</td>
                              <td className="p-2 border-r border-slate-200 text-left">{w.type}</td>
                              <td className="p-2 border-r border-slate-200 text-left">{w.vendor}</td>
                              <td className="p-2 border-r border-slate-200 text-center font-mono">{w.expiryDate}</td>
                              <td className="p-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 text-[8.5px] font-extrabold font-mono rounded ${
                                  w.isNoWarranty 
                                    ? "bg-slate-150 text-slate-600" 
                                    : isExpired 
                                    ? "bg-red-50 text-red-700" 
                                    : isSoon 
                                    ? "bg-amber-50 text-amber-700" 
                                    : "bg-emerald-50 text-emerald-800"
                                }`}>
                                  {w.isNoWarranty 
                                    ? "NONE" 
                                    : isExpired 
                                    ? "EXPIRED" 
                                    : isSoon 
                                    ? `${daysLeft}d LEFT` 
                                    : "ACTIVE"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Approver Sign-off Row */}
                    <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 print-no-break">
                      <div className="text-center space-y-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">IT Assets Custodian & Auditor</p>
                        <div className="h-10 border-b border-dashed border-slate-305 w-48 mx-auto mt-4"></div>
                        <p className="text-[9px] text-slate-400 font-medium">Certified Hardware Auditor Sign-off</p>
                      </div>
                      
                      <div className="text-center space-y-3">
                        <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">🏫 Verification & Approval by Principal</p>
                        <div className="h-10 border-b border-dashed border-slate-305 w-48 mx-auto mt-4"></div>
                        <p className="text-[9px] text-slate-400 font-medium leading-none">School Principal & Institution Head</p>
                        <p className="text-[8px] text-slate-400 font-medium leading-none uppercase tracking-wide">Birla Open Minds International School Board</p>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      )}

      {/* React Portal to inject printable Warranty Certificate/Register directly under body for seamless native print flow */}
      {printModalType && createPortal(
        <div 
          id="print-warranty-root"
          className="bg-white p-12 text-slate-900 font-sans text-xs relative select-text"
        >
          {/* Decorative High-End Corporate Top Margin line */}
          <div className={`w-full h-1.5 ${printModalType === "register" ? "bg-indigo-700" : "bg-[#D53F8C]"} rounded-sm mb-6`}></div>

          {/* Corporate Header Section */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-black text-slate-900 tracking-tight font-sans leading-none uppercase">
                BIRLA OPEN MINDS INTERNATIONAL SCHOOL
              </h1>
              <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-widest font-mono">
                {printModalType === "register" ? "IT INFRASTRUCTURE DIVISION" : "HARDWARE COMPLIANCE & WARRANTY"}
              </p>
              <p className="text-[10px] text-slate-450 font-medium">
                Sahara Rd, behind Kamineni Hospitals, Sri Ram Hills Colony, L. B. Nagar, Mansoorabad, Hyderabad, Telangana 500068
              </p>
            </div>
            <div className="text-left sm:text-right text-[10px] space-y-0.5 shrink-0 border-l sm:border-l-0 sm:border-r-0 border-slate-200 pl-3 sm:pl-0 font-mono text-slate-500">
              <div><strong>OFFICE:</strong> IT Asset Custodian Desk</div>
              <div><strong>EMAIL:</strong> birlaithelpdesk@gmail.com</div>
              <div><strong>PRINT DATE:</strong> {new Date().toLocaleString("en-GB")}</div>
            </div>
          </div>

          {/* Document Body */}
          {printModalType === "single" && selectedContract ? (
            <div className="space-y-6">
              
              {/* Centered Document Title */}
              <div className="text-center space-y-1 my-4">
                <h2 className="text-md font-black tracking-widest uppercase text-slate-900 font-sans border-y py-2 border-slate-200">
                  OFFICIAL HARDWARE WARRANTY & COVERAGE CERTIFICATE
                </h2>
                <p className="text-[9px] text-slate-450 font-mono tracking-wider">
                  CERTIFICATE REFERENCE: BI-WNT-COV-{selectedContract.id}
                </p>
              </div>

              {/* Status Overview Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex justify-between items-center">
                <div>
                  <p className="text-[8.5px] font-extrabold text-slate-455 uppercase tracking-wider">COVERED HARDWARE ITEM</p>
                  <h3 className="text-sm font-bold text-slate-900 mt-1">
                    📦 {selectedContract.itemName}
                  </h3>
                </div>
                <div className="text-right">
                  <p className="text-[8.5px] font-extrabold text-slate-455 uppercase tracking-wider">CONTRACT STATUS</p>
                  <span className={`inline-block mt-1 px-3 py-1 font-mono font-black text-[10.5px] rounded border ${
                    selectedContract.isNoWarranty
                      ? "bg-slate-100 text-slate-700 border-slate-300"
                      : getDaysLeft(selectedContract.expiryDate) < 0
                      ? "bg-red-50 text-red-700 border-red-200"
                      : getDaysLeft(selectedContract.expiryDate) <= 30
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}>
                    {selectedContract.isNoWarranty
                      ? "UNPROTECTED STANDARD"
                      : getDaysLeft(selectedContract.expiryDate) < 0
                      ? "EXPIRED COVERAGE"
                      : getDaysLeft(selectedContract.expiryDate) <= 30
                      ? "EXPIRING SOON"
                      : "ACTIVE WARRANTY"}
                  </span>
                </div>
              </div>

              {/* Specifications Grid */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">
                  📋 COVERAGE PARAMETERS & SERVICE SLAS
                </h4>
                <div className="grid grid-cols-2 gap-4 border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">COVER / COV ID:</span>
                      <span className="text-xs font-mono font-black select-all text-slate-900">{selectedContract.id}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">CONTRACT TYPE / CLASS:</span>
                      <span className="text-xs font-bold text-slate-800">{selectedContract.type}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">VENDOR / SUPPORT PARTNER:</span>
                      <span className="text-xs font-bold text-slate-800">{selectedContract.vendor}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">DATE REGISTERED:</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{selectedContract.registeredOn}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">DATE OF EXPIRY / MILESTONE:</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">{selectedContract.expiryDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase block">MATURITY DAYS REMAINING:</span>
                      <span className="text-xs font-mono font-bold text-slate-850">
                        {selectedContract.isNoWarranty 
                          ? "N/A" 
                          : `${getDaysLeft(selectedContract.expiryDate)} Remaining Days`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Standard Terms section */}
              <div className="space-y-3 pt-2">
                <h4 className="text-[10px] font-extrabold text-slate-455 uppercase tracking-wider">
                  ⚖️ TERMS OF MAINTENANCE & TECHNICAL DEFENSE
                </h4>
                <div className="space-y-2 text-slate-605 outline-none leading-relaxed text-[10.5px]">
                  <p>
                    <strong>Section 1 (Maintenance Coverage SLA):</strong> The Vendor Supplier covenants with the School Governance Body to deliver comprehensive repair, hardware configuration diagnostic services, and rapid material substitutions under standard warranty classes, in direct compliance with primary institutional procurement contracts.
                  </p>
                  <p>
                    <strong>Section 2 (Safe Stewardship):</strong> This system ledger record certifies that the assigned school hardware properties are covered. Liquid damage, physical accidents due to negligence, unauthorized structural tampering, or serial removals nullify coverage and require immediate asset scrap action.
                  </p>
                </div>
              </div>

              {/* Approver Sign-off Row */}
              <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 print-no-break">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">IT Assets Custodian & Auditor</p>
                  <div className="h-10 border-b border-dashed border-slate-350 w-48 mx-auto mt-4"></div>
                  <p className="text-[9px] text-slate-400 font-medium">Certified Hardware Auditor Sign-off</p>
                </div>
                
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">🏫 Verification & Approval by Principal</p>
                  <div className="h-10 border-b border-dashed border-slate-350 w-48 mx-auto mt-4"></div>
                  <p className="text-[9px] text-slate-400 font-medium leading-none">School Principal & Institution Head</p>
                  <p className="text-[8px] text-slate-400 font-medium leading-none uppercase tracking-wide">Birla Open Minds International School Board</p>
                </div>
              </div>

            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Centered Document Title */}
              <div className="text-center space-y-1 my-4">
                <h2 className="text-md font-black tracking-widest uppercase text-slate-900 font-sans border-y py-2 border-slate-200">
                  IT REGISTER: WARRANTY & AMC CONTRACTS AUDIT LEDGER
                </h2>
                <p className="text-[9px] text-slate-455 font-mono tracking-wider">
                  SYSTEM HORIZON FILTER: {activeFilter === "all" ? "ALL ACTIVE LEDGERS" : activeFilter === "soon" ? "EXPIRING IN 30 DAYS" : "EXPIRED CONTRACTS"}
                </p>
              </div>

              {/* Information criteria summary */}
              <div className="border border-slate-300 bg-slate-50 rounded-lg p-4 grid grid-cols-3 text-center gap-2">
                <div>
                  <span className="text-[8.5px] uppercase font-extrabold text-slate-400">Total Filtered Records</span>
                  <p className="text-sm font-black font-mono text-slate-800 mt-1">{filteredContracts.length} Columns</p>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase font-extrabold text-amber-600">Soon Expiry (&lt;30 days)</span>
                  <p className="text-sm font-black font-mono text-amber-700 mt-1">
                    {filteredContracts.filter(w => !w.isNoWarranty && getDaysLeft(w.expiryDate) >= 0 && getDaysLeft(w.expiryDate) <= 30).length} Items
                  </p>
                </div>
                <div>
                  <span className="text-[8.5px] uppercase font-extrabold text-rose-500">Expired Status</span>
                  <p className="text-sm font-black font-mono text-rose-700 mt-1">
                    {filteredContracts.filter(w => !w.isNoWarranty && getDaysLeft(w.expiryDate) < 0).length} Items
                  </p>
                </div>
              </div>

              {/* Tabular Output */}
              <table className="w-full text-[10.5px] border-collapse border border-slate-305">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 uppercase tracking-wider text-[8.5px] font-black">
                    <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                    <th className="p-2 border-r border-slate-300 text-left w-24">Cover ID</th>
                    <th className="p-2 border-r border-slate-300 text-left">Hardware Item Name</th>
                    <th className="p-2 border-r border-slate-300 text-left w-28">Contract Class</th>
                    <th className="p-2 border-r border-slate-300 text-left w-24">Vendor Partner</th>
                    <th className="p-2 border-r border-slate-300 text-center w-20">Expiry Date</th>
                    <th className="p-2 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredContracts.map((w, idx) => {
                    const daysLeft = getDaysLeft(w.expiryDate);
                    const isExpired = w.isNoWarranty || daysLeft < 0;
                    const isSoon = !w.isNoWarranty && daysLeft >= 0 && daysLeft <= 30;

                    return (
                      <tr key={w.id} className="border-b border-slate-200 hover:bg-slate-50 transition-colors print-no-break">
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-200 text-left font-mono font-bold select-all">{w.id}</td>
                        <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-900">{w.itemName}</td>
                        <td className="p-2 border-r border-slate-200 text-left">{w.type}</td>
                        <td className="p-2 border-r border-slate-200 text-left">{w.vendor}</td>
                        <td className="p-2 border-r border-slate-200 text-center font-mono">{w.expiryDate}</td>
                        <td className="p-2 text-center">
                          <span className={`inline-block px-1.5 py-0.5 text-[8.5px] font-extrabold font-mono rounded ${
                            w.isNoWarranty 
                              ? "bg-slate-150 text-slate-600" 
                              : isExpired 
                              ? "bg-red-50 text-red-700" 
                              : isSoon 
                              ? "bg-amber-50 text-amber-700" 
                              : "bg-emerald-50 text-emerald-800"
                          }`}>
                            {w.isNoWarranty 
                              ? "NONE" 
                              : isExpired 
                              ? "EXPIRED" 
                              : isSoon 
                              ? `${daysLeft}d LEFT` 
                              : "ACTIVE"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Approver Sign-off Row */}
              <div className="mt-16 pt-8 border-t border-slate-200 grid grid-cols-2 gap-12 print-no-break">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">IT Assets Custodian & Auditor</p>
                  <div className="h-10 border-b border-dashed border-slate-350 w-48 mx-auto mt-4"></div>
                  <p className="text-[9px] text-slate-400 font-medium">Certified Hardware Auditor Sign-off</p>
                </div>
                
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">🏫 Verification & Approval by Principal</p>
                  <div className="h-10 border-b border-dashed border-slate-350 w-48 mx-auto mt-4"></div>
                  <p className="text-[9px] text-slate-400 font-medium leading-none">School Principal & Institution Head</p>
                  <p className="text-[8px] text-slate-400 font-medium leading-none uppercase tracking-wide">Birla Open Minds International School Board</p>
                </div>
              </div>

            </div>
          )}

        </div>,
        document.body
      )}

    </div>
  );
}
