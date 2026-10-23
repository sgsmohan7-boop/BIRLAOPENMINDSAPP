const fs = require('fs');

const file = 'src/components/Dashboard.tsx';
const originalLines = fs.readFileSync(file, 'utf8').split('\n');

// Phase 1: Rebuild the file by removing ALL occurrences of renderExecutivePrintContent
let renderStart = -1;
let renderEnd = -1;
const linesWithoutHelper = [];

for (let i = 0; i < originalLines.length; i++) {
  if (originalLines[i].includes('const renderExecutivePrintContent = () => (')) {
    renderStart = i;
    // scan forward to find `  </>\n);`
    for (let j = i; j < originalLines.length; j++) {
      if (originalLines[j].trim() === ');' && originalLines[j-1].includes('</>')) {
        renderEnd = j;
        i = j; // skip these lines
        break;
      }
    }
  } else {
    linesWithoutHelper.push(originalLines[i]);
  }
}

// Check where the imports are in linesWithoutHelper
const importLine = linesWithoutHelper.findIndex(l => l.startsWith('import React'));

// Check where export default function Dashboard is
const exportLine = linesWithoutHelper.findIndex(l => l.startsWith('export default function Dashboard'));

// Check where priorityMap is
const priorityLine = linesWithoutHelper.findIndex(l => l.includes('const priorityMap = {'));

const helperCode = `  const renderExecutivePrintContent = () => (
    <>
      {/* Print Sheet Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-4 border-slate-900 pb-6 gap-4 text-left">
        <div className="flex items-center gap-4">
          {!logoError ? (
            <img 
              src="/src/assets/images/it_pwa_icon_1779779538581.png" 
              alt="Santinos Logo" 
              className="w-16 h-16 rounded-full border border-slate-300 object-contain bg-white shrink-0 font-sans" 
            />
          ) : (
            <div className="w-16 h-16 rounded-xl border-4 border-slate-900 bg-orange-500 flex flex-col items-center justify-center shrink-0 p-1 font-sans">
              <span className="font-sans font-black text-white text-2xl">SGS</span>
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 font-sans uppercase m-0 leading-none">SANTINOS GLOBAL SCHOOL</h1>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-[#F97316] m-0 mt-2 font-sans">IT DEPT — DIGITAL SERVICE DESK LOGBOOK</p>
          </div>
        </div>
        
        <div className="text-left sm:text-right text-slate-900">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500 block m-0 font-sans">REPORT COMPILED AT:</span>
          <span className="text-sm font-black font-mono block text-slate-950 m-0">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</span>
          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 mt-2 inline-block font-sans">SYSTEM VERIFIED: ACTIVE</span>
        </div>
      </div>

      {/* Scope Metadata Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-5 rounded-xl text-xs text-slate-800 text-left">
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">DATE INTERVAL:</span>
          <strong className="text-slate-900 font-mono text-xs">{reportFromDate} to {reportToDate}</strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">REPORTING MODE:</span>
          <strong className="text-slate-900 text-xs sm:text-xs uppercase font-sans">
            {reportMode === "date" ? "Global System Audit" : "Building/Room Spatial Audit"}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">STATUS FILTER SCOPE:</span>
          <strong className="text-slate-900 text-xs uppercase font-sans">
            {reportStatusFilter === "All" ? "ALL NETWORK LOCATIONS" : reportStatusFilter}
          </strong>
        </div>
        <div>
          <span className="block text-[9px] font-extrabold uppercase text-slate-500 tracking-wider font-sans">TICKETS INCLUSION:</span>
          <strong className="text-slate-900 text-xs uppercase font-sans">{matchedReportTickets.length} LOGS IN VIEW</strong>
        </div>
      </div>

      {/* Main Datatable */}
      <div className="overflow-hidden border border-slate-300 rounded-xl">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#1e293b] text-white">
            <tr>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">ID / Timestamp</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">Issue Description / Remarks</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8]">Location / Requester</th>
              <th className="py-3 px-1.5 font-bold text-[10px] uppercase font-sans tracking-widest text-[#94a3b8] text-right">Priority / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {matchedReportTickets.map((t, idx) => (
              <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="py-2.5 px-1.5 font-mono text-[10px] text-slate-900">
                  <span className="font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-slate-900"></span>
                    {t.id.split('-')[1] || t.id}
                  </span>
                  <br />
                  <span className="text-slate-500 tracking-tight ml-3">{t.createdAt}</span>
                </td>
                <td className="py-2.5 px-1.5 align-top">
                  <div className="text-xs font-bold text-slate-900 font-sans whitespace-normal max-w-sm line-clamp-2">{t.issue}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 whitespace-normal max-w-sm">
                    {t.remarks ? t.remarks : "No resolution remarks."}
                  </div>
                </td>
                <td className="py-2.5 px-1.5 font-sans">
                  <div className="text-xs font-bold text-slate-900">
                    {t.building === "New Building School" ? "NB" : "OB"}: {t.linkedRoom}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">{t.staffName} ({t.mobile})</div>
                </td>
                <td className="py-2.5 px-1.5 text-right font-black uppercase text-[10px]">
                  <span className={\`inline-block px-1.5 py-0.5 rounded font-sans \${
                    t.priority === "high" ? "text-red-700 bg-red-50" : t.priority === "medium" ? "text-amber-700 bg-amber-50" : "text-blue-700 bg-blue-50"
                  }\`}>
                    {t.priority}
                  </span>
                </td>
                <td className="py-2.5 px-1.5 text-right font-black uppercase text-[10px]">
                  <span className={\`inline-block px-1.5 py-0.5 rounded font-sans \${
                    t.status === "open" ? "text-amber-700 bg-amber-50" : t.status === "pending" ? "text-orange-700 bg-orange-50" : "text-emerald-700 bg-emerald-50"
                  }\`}>
                    {t.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PDF Signatures section */}
      <div className="grid grid-cols-2 gap-12 pt-16">
        <div className="text-center">
          <div className="border-t border-slate-900 pt-2 text-slate-900">
            <span className="text-xs font-extrabold uppercase tracking-wider block font-sans">IT SERVICE DESK MANAGER</span>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 m-0">Santinos Global Campus Authority</p>
          </div>
        </div>
        <div className="text-center">
          <div className="border-t border-slate-900 pt-2 text-slate-900">
            <span className="text-xs font-extrabold uppercase tracking-wider block font-sans">AUTHORIZED SYSTEM AUDITOR</span>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 m-0">SGS IT Technical Committee</p>
          </div>
        </div>
      </div>
    </>
  );`;

let finalLines = [];

if (importLine > 0) {
    // If there were lines before import React, remove them. They are garbage.
    const cleanLines = linesWithoutHelper.slice(importLine);
    const newPriority = cleanLines.findIndex(l => l.includes('const priorityMap = {'));
    
    finalLines = [
        ...cleanLines.slice(0, newPriority),
        ...helperCode.split('\n'),
        ...cleanLines.slice(newPriority)
    ];
} else {
    // Imports are at 0, just insert before priority
    const cleanLines = linesWithoutHelper;
    const newPriority = cleanLines.findIndex(l => l.includes('const priorityMap = {'));
    
    finalLines = [
        ...cleanLines.slice(0, newPriority),
        ...helperCode.split('\n'),
        ...cleanLines.slice(newPriority)
    ];
}

// Let's also check for dangling `}` or anything by using check balance
let balance = 0;
let excessLines = [];
let closingCount = 0;
for (let i = 0; i < finalLines.length; i++) {
  const line = finalLines[i];
  for (let j = 0; j < line.length; j++) {
    if (line[j] === '{') balance++;
    if (line[j] === '}') {
        balance--;
    }
  }
}
if (balance < 0) {
   console.log('Balance is negative', balance);
} else if (balance > 0) {
   console.log('Balance is positive', balance);
   // we have unclosed {
   for (let k = 0; k < balance; k++) finalLines.push('}');
}

fs.writeFileSync(file, finalLines.join('\n'));
console.log('Successfully repaired Dashboard structural layout.');
