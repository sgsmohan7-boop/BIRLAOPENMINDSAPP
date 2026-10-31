import React, { useState, useMemo } from "react";
import { 
  GraduationCap, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Users, 
  CheckCircle, 
  Clock, 
  Phone, 
  FileText, 
  Headphones, 
  Sparkles,
  LayoutGrid,
  List,
  UserCheck,
  Plus,
  Printer
} from "lucide-react";
import { CounsellingEnquiry, CounsellorAccount } from "../types";
import { printOfficialAdmissionForm } from "../utils/printAdmissionForm";

interface ManagementAdmissionDeskProps {
  enquiries: CounsellingEnquiry[];
  onSaveEnquiry?: (enquiry: CounsellingEnquiry) => void;
  onDeleteEnquiry?: (id: string) => void;
  userRole?: string;
  userEmail?: string;
  counsellorAccounts?: CounsellorAccount[];
}

interface GradeMasterConfig {
  id: string;
  name: string;
  category: "Pre-Primary" | "Primary" | "Middle" | "Secondary" | "Senior Secondary";
  targetSeats: number;
  matchingKeys: string[];
}

const GRADE_CONFIGS: GradeMasterConfig[] = [
  { id: "pg", name: "Playgroup", category: "Pre-Primary", targetSeats: 30, matchingKeys: ["playgroup", "play group", "pg"] },
  { id: "nursery", name: "Nursery", category: "Pre-Primary", targetSeats: 30, matchingKeys: ["nursery", "nur"] },
  { id: "pp1", name: "PP1 (LKG)", category: "Pre-Primary", targetSeats: 30, matchingKeys: ["pp1", "lkg", "pp1 (lkg)", "pre primary 1"] },
  { id: "pp2", name: "PP2 (UKG)", category: "Pre-Primary", targetSeats: 30, matchingKeys: ["pp2", "ukg", "pp2 (ukg)", "pre primary 2"] },
  
  { id: "g1", name: "Grade 1", category: "Primary", targetSeats: 30, matchingKeys: ["grade 1", "class 1", "1st", "class 1 (grade 1)"] },
  { id: "g2", name: "Grade 2", category: "Primary", targetSeats: 30, matchingKeys: ["grade 2", "class 2", "2nd"] },
  { id: "g3", name: "Grade 3", category: "Primary", targetSeats: 30, matchingKeys: ["grade 3", "class 3", "3rd"] },
  { id: "g4", name: "Grade 4", category: "Primary", targetSeats: 30, matchingKeys: ["grade 4", "class 4", "4th"] },
  { id: "g5", name: "Grade 5", category: "Primary", targetSeats: 30, matchingKeys: ["grade 5", "class 5", "5th"] },
  
  { id: "g6", name: "Grade 6", category: "Middle", targetSeats: 30, matchingKeys: ["grade 6", "class 6", "6th"] },
  { id: "g7", name: "Grade 7", category: "Middle", targetSeats: 30, matchingKeys: ["grade 7", "class 7", "7th"] },
  { id: "g8", name: "Grade 8", category: "Middle", targetSeats: 30, matchingKeys: ["grade 8", "class 8", "8th"] },
  
  { id: "g9", name: "Grade 9", category: "Secondary", targetSeats: 30, matchingKeys: ["grade 9", "class 9", "9th"] },
  { id: "g10", name: "Grade 10", category: "Secondary", targetSeats: 30, matchingKeys: ["grade 10", "class 10", "10th"] },
  
  { id: "g11", name: "Grade 11", category: "Senior Secondary", targetSeats: 30, matchingKeys: ["grade 11", "class 11", "11th"] },
  { id: "g12", name: "Grade 12", category: "Senior Secondary", targetSeats: 30, matchingKeys: ["grade 12", "class 12", "12th"] },
];

export default function ManagementAdmissionDesk({
  enquiries = [],
  onSaveEnquiry,
  onDeleteEnquiry,
  userRole,
  userEmail,
  counsellorAccounts = []
}: ManagementAdmissionDeskProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryTab, setCategoryTab] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [counsellorFilter, setCounsellorFilter] = useState<string>("ALL");
  const [expandedGradeId, setExpandedGradeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Normalized matching helper
  const isGradeMatch = (applyingClass: string = "", grade: GradeMasterConfig): boolean => {
    const clean = applyingClass.toLowerCase().trim();
    if (!clean) return false;
    return grade.matchingKeys.some(key => clean.includes(key) || clean === key);
  };

  // Filtered enquiries based on search, status & counsellor
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(enq => {
      const matchSearch = 
        !searchTerm.trim() ||
        enq.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        enq.enquiryNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (enq.fatherName && enq.fatherName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (enq.contactNo && enq.contactNo.includes(searchTerm));

      const matchStatus = statusFilter === "ALL" || enq.admissionStatus === statusFilter;
      const matchCounsellor = counsellorFilter === "ALL" || enq.counsellorName === counsellorFilter;

      return matchSearch && matchStatus && matchCounsellor;
    });
  }, [enquiries, searchTerm, statusFilter, counsellorFilter]);

  // Map enquiries to Grade cards
  const gradeCardsData = useMemo(() => {
    return GRADE_CONFIGS.map(grade => {
      const matched = filteredEnquiries.filter(enq => isGradeMatch(enq.applyingForClass, grade));
      
      const totalCount = matched.length;
      const appliedCount = matched.filter(e => e.admissionStatus === "Application Taken" || e.admissionStatus === "Interested" || e.admissionStatus === "Follow-up Required").length;
      const admittedCount = matched.filter(e => e.admissionStatus === "Admission Confirmed").length;
      
      const confirmedPercent = totalCount > 0 ? Math.round((admittedCount / totalCount) * 100) : 0;
      const capacityPercent = Math.round((admittedCount / grade.targetSeats) * 100);

      return {
        ...grade,
        candidates: matched,
        totalCount,
        appliedCount,
        admittedCount,
        confirmedPercent,
        capacityPercent
      };
    });
  }, [filteredEnquiries]);

  // Unmatched candidates that don't fit standard grades
  const unmatchedCandidates = useMemo(() => {
    return filteredEnquiries.filter(enq => !GRADE_CONFIGS.some(g => isGradeMatch(enq.applyingForClass, g)));
  }, [filteredEnquiries]);

  // Category Filtered Grade Cards
  const displayedGradeCards = useMemo(() => {
    if (categoryTab === "ALL") return gradeCardsData;
    return gradeCardsData.filter(g => g.category === categoryTab);
  }, [gradeCardsData, categoryTab]);

  const uniqueCounsellors = useMemo(() => {
    const set = new Set(enquiries.map(e => e.counsellorName).filter(Boolean));
    return Array.from(set);
  }, [enquiries]);

  const toggleExpandGrade = (id: string) => {
    setExpandedGradeId(prev => prev === id ? null : id);
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER & VIEW MODE BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <GraduationCap size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Admissions Master Data Desk
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Class-wise seat capacity, enquiry breakdown, and candidate admissions pipeline.
                </p>
              </div>
            </div>
          </div>

          {/* View Mode & Overall Stats */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <LayoutGrid size={14} />
                <span>Class Cards Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                <List size={14} />
                <span>Full List View</span>
              </button>
            </div>
          </div>
        </div>

        {/* CATEGORY TABS & FILTER BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
            <button
              onClick={() => setCategoryTab("ALL")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "ALL"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              All Grades (16)
            </button>
            <button
              onClick={() => setCategoryTab("Pre-Primary")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "Pre-Primary"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100"
              }`}
            >
              Pre-Primary (4)
            </button>
            <button
              onClick={() => setCategoryTab("Primary")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "Primary"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100"
              }`}
            >
              Primary (5)
            </button>
            <button
              onClick={() => setCategoryTab("Middle")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "Middle"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100"
              }`}
            >
              Middle (3)
            </button>
            <button
              onClick={() => setCategoryTab("Secondary")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "Secondary"
                  ? "bg-purple-600 text-white shadow-xs"
                  : "bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 hover:bg-purple-100"
              }`}
            >
              Secondary (2)
            </button>
            <button
              onClick={() => setCategoryTab("Senior Secondary")}
              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer whitespace-nowrap ${
                categoryTab === "Senior Secondary"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              Senior Secondary (2)
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search candidate name or enquiry no..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="Interested">Interested</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Application Taken">Application Taken</option>
              <option value="Admission Confirmed">Admission Confirmed</option>
            </select>
          </div>

        </div>
      </div>

      {/* VIEW MODE 1: CARDS GRID VIEW (EXACT USER MATCH) */}
      {viewMode === "cards" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {displayedGradeCards.map((grade) => {
              const isExpanded = expandedGradeId === grade.id;

              return (
                <div
                  key={grade.id}
                  className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between ${
                    isExpanded 
                      ? "border-indigo-500 ring-2 ring-indigo-500/20" 
                      : "border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <div className="space-y-3">
                    
                    {/* TOP BADGES ROW */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
                        {grade.category}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
                        {grade.confirmedPercent}% Confirmed
                      </span>
                    </div>

                    {/* GRADE TITLE */}
                    <h4 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                      {grade.name}
                    </h4>

                    {/* METRICS PANEL BOX */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <div className="grid grid-cols-3 text-center gap-1">
                        
                        {/* TOTAL */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                            TOTAL
                          </div>
                          <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                            {grade.totalCount}
                          </div>
                        </div>

                        {/* APPLIED */}
                        <div>
                          <div className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-wider">
                            APPLIED
                          </div>
                          <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                            {grade.appliedCount}
                          </div>
                        </div>

                        {/* ADMITTED */}
                        <div>
                          <div className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">
                            ADMITTED
                          </div>
                          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {grade.admittedCount}
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* CAPACITY PROGRESS ROW */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>Target: {grade.admittedCount}/{grade.targetSeats} seats</span>
                        <span className="font-bold">{grade.capacityPercent}% capacity</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, grade.capacityPercent)}%` }}
                        />
                      </div>
                    </div>

                  </div>

                  {/* EXPAND DROPDOWN BUTTON (IF CANDIDATES EXIST) */}
                  {grade.totalCount > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => toggleExpandGrade(grade.id)}
                        className="w-full text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center justify-between py-1 px-1 rounded-lg cursor-pointer transition-colors group"
                      >
                        <span>View {grade.totalCount} candidate(s)</span>
                        {isExpanded ? (
                          <ChevronUp size={14} className="text-indigo-500" />
                        ) : (
                          <ChevronDown size={14} className="text-indigo-500 group-hover:translate-y-0.5 transition-transform" />
                        )}
                      </button>

                      {/* EXPANDED CANDIDATES DRAWER */}
                      {isExpanded && (
                        <div className="mt-2 space-y-2 max-h-60 overflow-y-auto custom-scrollbar pt-2 border-t border-slate-200/60 dark:border-slate-800">
                          {grade.candidates.map((cand) => (
                            <div
                              key={cand.id}
                              className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white">
                                <span>{cand.studentName}</span>
                                <span className="font-mono text-[10px] text-slate-400">{cand.enquiryNo}</span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                <span>Parent: {cand.fatherName || cand.motherName || "—"}</span>
                                <span className="font-mono">{cand.contactNo}</span>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/40 dark:border-slate-700/40">
                                <span className={`px-2 py-0.2 rounded text-[9px] font-bold ${
                                  cand.admissionStatus === "Admission Confirmed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" :
                                  cand.admissionStatus === "Application Taken" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                                  cand.admissionStatus === "Follow-up Required" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                                  "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200"
                                }`}>
                                  {cand.admissionStatus}
                                </span>

                                <div className="flex items-center gap-1">
                                  {cand.audioRecording && (
                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                      🎙️ Audio
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => printOfficialAdmissionForm(cand)}
                                    className="p-1 text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-700 rounded transition cursor-pointer"
                                    title="Print Official Admission Form"
                                  >
                                    <Printer size={12} />
                                  </button>
                                  {onDeleteEnquiry && (
                                    <button
                                      type="button"
                                      onClick={() => onDeleteEnquiry(cand.id)}
                                      className="p-1 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                                      title="Delete enquiry"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* UNMATCHED CANDIDATES SECTION (IF ANY EXIST) */}
          {unmatchedCandidates.length > 0 && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                <span>Other Uncategorized Grade Enquiries ({unmatchedCandidates.length})</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-normal">Custom grade names entered by counsellor</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {unmatchedCandidates.map(cand => (
                  <div key={cand.id} className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-200 dark:border-amber-800/80 text-xs space-y-1">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>{cand.studentName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded">{cand.applyingForClass}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Contact: {cand.contactNo} | Counsellor: {cand.counsellorName}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW MODE 2: FULL TABLE LIST VIEW */}
      {viewMode === "table" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Enquiry No & Student</th>
                <th className="py-3 px-4">Class Enrolled</th>
                <th className="py-3 px-4">Parent / Contact</th>
                <th className="py-3 px-4">Assigned Counsellor</th>
                <th className="py-3 px-4 text-center">Admission Status</th>
                <th className="py-3 px-4 text-center">Voice Audit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredEnquiries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No admission enquiries recorded yet.
                  </td>
                </tr>
              ) : (
                filteredEnquiries.map((enq) => (
                  <tr key={enq.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{enq.studentName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{enq.enquiryNo}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                      {enq.applyingForClass}
                    </td>
                    <td className="py-3.5 px-4">
                      <div>{enq.fatherName || enq.motherName || "Parent"}</div>
                      <div className="font-mono text-[10px] text-slate-400">{enq.contactNo}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700 dark:text-slate-300">
                      {enq.counsellorName}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        enq.admissionStatus === "Admission Confirmed" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300" :
                        enq.admissionStatus === "Application Taken" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" :
                        enq.admissionStatus === "Follow-up Required" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" :
                        "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                      }`}>
                        {enq.admissionStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {enq.audioRecording ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200">
                          🎙️ Recorded ({enq.audioRecording.durationFormatted || "Audited"})
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">No audio</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => printOfficialAdmissionForm(enq)}
                          className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                          title="Print Official Admission Form"
                        >
                          <Printer size={13} />
                        </button>
                        {onDeleteEnquiry && (
                          <button
                            type="button"
                            onClick={() => onDeleteEnquiry(enq.id)}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300 rounded-lg text-[11px] font-bold transition cursor-pointer"
                            title="Delete enquiry"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
