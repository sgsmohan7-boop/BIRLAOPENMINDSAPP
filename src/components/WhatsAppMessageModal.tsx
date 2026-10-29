import React, { useState } from "react";
import { 
  Send, 
  MessageSquare, 
  Copy, 
  Check, 
  X, 
  Sparkles, 
  School, 
  Phone, 
  Calendar, 
  CheckCircle2, 
  Share2,
  ExternalLink
} from "lucide-react";
import { CounsellingEnquiry, CounsellorAccount } from "../types";

interface WhatsAppMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  enquiry: CounsellingEnquiry | null;
  activeCounsellor?: CounsellorAccount | null;
}

export default function WhatsAppMessageModal({
  isOpen,
  onClose,
  enquiry,
  activeCounsellor
}: WhatsAppMessageModalProps) {
  const [templateType, setTemplateType] = useState<"thankyou" | "confirmed" | "test" | "followup">("thankyou");
  const [copiedText, setCopiedText] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  if (!isOpen || !enquiry) return null;

  const parentName = enquiry.fatherName || enquiry.motherName || "Parent";
  const studentName = enquiry.studentName || "Student";
  const applyingClass = enquiry.applyingForClass || "Grade 1";
  const enquiryNo = enquiry.enquiryNo || enquiry.id || "ENQ-2026";
  const counsellorName = enquiry.counsellorName || activeCounsellor?.name || "Admissions Counsellor";
  const counsellorId = enquiry.counsellorId || activeCounsellor?.id || "";
  const phoneNo = enquiry.whatsappNo || enquiry.contactNo || "";
  const cleanPhone = phoneNo.replace(/[^0-9]/g, "").slice(-10);

  // Generate Message Text based on selected template
  const generateMessage = () => {
    const schoolHeader = `🏫 *BIRLA OPEN MINDS INTERNATIONAL SCHOOL*\n🎓 *ADMISSIONS & PARENT COUNSELLING DEPT.*\n\n`;

    if (templateType === "confirmed") {
      return `${schoolHeader}Dear ${parentName} Sir/Madam,

🎉 *CONGRATULATIONS! ADMISSION CONFIRMED*

We are delighted to inform you that the admission enquiry for *${studentName}* (Applying for *Class ${applyingClass}*) has been successfully registered and approved at **Birla Open Minds International School**!

📌 *OFFICIAL RECORD DETAILS:*
• *Enquiry / Ref No:* ${enquiryNo}
• *Student Name:* ${studentName}
• *Grade Approved:* Class ${applyingClass}
• *Admission Status:* Admission Confirmed ✅
• *Date of Registration:* ${enquiry.date || new Date().toLocaleDateString("en-GB")}

${customNotes ? `📝 *ADDITIONAL REMARKS:* \n${customNotes}\n\n` : ''}📍 *NEXT STEPS FOR ENROLMENT:*
1. Please submit original transfer certificate (TC), birth certificate, and student photos.
2. Complete the school fee installment payment at the accounts desk or official payment link.

📞 *YOUR ASSIGNED COUNSELLOR:*
👤 *Name:* ${counsellorName} ${counsellorId ? `(${counsellorId})` : ''}

Thank you for choosing Birla Open Minds International School for your child's bright future!

Warm regards,
*Admissions Office*
*Birla Open Minds International School*`;
    }

    if (templateType === "test") {
      return `${schoolHeader}Dear ${parentName} Sir/Madam,

Greeting from **Birla Open Minds International School**!

Regarding the admission enquiry for *${studentName}* (Class *${applyingClass}*), an Entrance Assessment / Parent Interaction Session has been scheduled.

📌 *ASSESSMENT DETAILS:*
• *Ref No:* ${enquiryNo}
• *Student Name:* ${studentName}
• *Grade:* Class ${applyingClass}
• *Status:* Entrance Test Required 📝
• *Scheduled Date:* ${enquiry.followUpDate || "To be confirmed"}

${customNotes ? `📝 *SPECIAL INSTRUCTIONS:* \n${customNotes}\n\n` : ''}Please carry the student's previous school report card and geometry/writing kit for the session.

📞 *ASSISTANCE & COORDINATION:*
👤 *Counsellor Name:* ${counsellorName}

Warm regards,
*Admissions Office*
*Birla Open Minds International School*`;
    }

    if (templateType === "followup") {
      return `${schoolHeader}Dear ${parentName} Sir/Madam,

Greetings from **Birla Open Minds International School**!

We hope you are doing well. This is a gentle follow-up regarding your school visit and counselling session for *${studentName}* (Class *${applyingClass}*).

📌 *ENQUIRY REFERENCE:*
• *Ref No:* ${enquiryNo}
• *Student:* ${studentName}
• *Class:* ${applyingClass}
• *Follow-up Date:* ${enquiry.followUpDate || "Today"}

${customNotes ? `📝 *COUNSELLOR NOTES:* \n${customNotes}\n\n` : ''}We would love to welcome ${studentName} to our campus! If you have any further questions regarding curriculum, sports facilities, fee structure, or bus routes, please reach out to us.

📞 *YOUR COUNSELLOR CONTACT:*
👤 *Name:* ${counsellorName} ${counsellorId ? `(${counsellorId})` : ''}

Warm regards,
*Admissions Office*
*Birla Open Minds International School*`;
    }

    // Default "thankyou" Post-Counselling message
    return `${schoolHeader}Dear ${parentName} Sir/Madam,

Thank you for visiting **Birla Open Minds International School** today regarding the admission enquiry for *${studentName}* (Class: *${applyingClass}*).

It was a sincere pleasure interacting with you during our counselling session!

📌 *ENQUIRY SUMMARY:*
• *Enquiry No:* ${enquiryNo}
• *Student Name:* ${studentName}
• *Class Applied:* Class ${applyingClass}
• *Admission Status:* ${enquiry.admissionStatus || "Interested"}
${enquiry.followUpDate ? `• *Next Follow-up Date:* ${enquiry.followUpDate}\n` : ''}
${enquiry.pointsDiscussed ? `📝 *KEY POINTS DISCUSSED:* \n${enquiry.pointsDiscussed}\n\n` : ''}${customNotes ? `💡 *ADDITIONAL NOTES:* \n${customNotes}\n\n` : ''}📞 *YOUR ASSIGNED ADMISSIONS COUNSELLOR:*
👤 *Name:* ${counsellorName} ${counsellorId ? `(${counsellorId})` : ''}

If you have any further queries or require assistance with admissions, please feel free to call or reply on WhatsApp.

Warm regards,
*Admissions Office*
*Birla Open Minds International School*`;
  };

  const messageText = generateMessage();
  const whatsappUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(messageText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl my-auto animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold border border-white/30 text-white shadow-md">
              <Send size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-emerald-100 text-[10px] font-black uppercase tracking-wider">
                  Official Parent Communication
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 text-[10px] font-black">
                  WhatsApp Direct
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight mt-0.5">
                Send Official WhatsApp Message to Parent
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Parent & Student Banner */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-400 flex items-center justify-center font-black text-sm">
              {studentName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-extrabold text-white text-sm">
                Student: {studentName} <span className="text-amber-400 font-bold">(Class {applyingClass})</span>
              </p>
              <p className="text-slate-400 text-[11px]">
                Parent: <strong className="text-slate-200">{parentName}</strong> • Phone: <strong className="text-emerald-400 font-mono">📞 +91 {cleanPhone || phoneNo}</strong>
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-amber-300 font-mono font-bold text-[11px] shrink-0">
            {enquiryNo}
          </span>
        </div>

        {/* Template Selector */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 space-y-2 shrink-0">
          <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
            Select Message Template:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setTemplateType("thankyou")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left border ${
                templateType === "thankyou"
                  ? "bg-emerald-600 border-emerald-500 text-white font-black shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>🌟 Thank You Visit</span>
            </button>

            <button
              type="button"
              onClick={() => setTemplateType("confirmed")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left border ${
                templateType === "confirmed"
                  ? "bg-emerald-600 border-emerald-500 text-white font-black shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>🎉 Confirmed</span>
            </button>

            <button
              type="button"
              onClick={() => setTemplateType("test")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left border ${
                templateType === "test"
                  ? "bg-emerald-600 border-emerald-500 text-white font-black shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>📝 Entrance Assessment</span>
            </button>

            <button
              type="button"
              onClick={() => setTemplateType("followup")}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-left border ${
                templateType === "followup"
                  ? "bg-emerald-600 border-emerald-500 text-white font-black shadow-md"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <span>📅 Follow-Up Reminder</span>
            </button>
          </div>
        </div>

        {/* Custom Remarks Input & Preview */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
          
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-300">
              Custom Counsellor Note / Additional Information (Optional):
            </label>
            <input
              type="text"
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. Discussed 2nd term fee installment discount / Transportation route details"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-300 uppercase tracking-wider">
                Official Message Preview:
              </label>
              <span className="text-[10px] text-emerald-400 font-bold">
                ✓ Formatted with Official Birla Open Minds Branding
              </span>
            </div>
            
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-sans text-slate-200 whitespace-pre-wrap leading-relaxed shadow-inner max-h-72 overflow-y-auto custom-scrollbar border-l-4 border-l-emerald-500">
              {messageText}
            </div>
          </div>

        </div>

        {/* Footer Buttons */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700"
          >
            {copiedText ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            <span>{copiedText ? "Copied Message!" : "Copy Text"}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white rounded-xl text-xs font-black shadow-xl transition-all flex items-center gap-2 cursor-pointer active:scale-95 border border-emerald-400"
            title={`Send official WhatsApp message to ${phoneNo}`}
          >
            <Send size={16} />
            <span>📱 Send via WhatsApp App / Web</span>
            <ExternalLink size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
