import { CounsellingEnquiry } from "../types";

export const ADMISSION_SOURCES = [
  "Newspaper / Print Ad",
  "Social Media / Ads",
  "Friend / Relative",
  "School Bus / Hoarding",
  "Google / Online Search",
  "Direct Walk-in",
  "Flyer / Brochure",
  "Other"
];

export const ADMISSION_STATUS_LIST = [
  "Interested",
  "Application Taken",
  "Entrance Test Required",
  "Admission Confirmed",
  "Follow-up Required",
  "Not Interested"
];

/**
 * Universal isolated printing helper for the official Birla Open Minds Admission Form.
 * Runs in an isolated hidden iframe so no sidebar, navbar, or portal shell ever leaks into print.
 * Section 4 (Counselling Notes & AI Audio audit transcript) is strictly omitted for official parent records.
 */
export function printOfficialAdmissionForm(enquiry: CounsellingEnquiry | null | undefined): void {
  if (!enquiry) {
    window.print();
    return;
  }

  const enq = enquiry;
  const sources = ADMISSION_SOURCES;
  const statuses = ADMISSION_STATUS_LIST;

  const printHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Admission Form - ${enq.enquiryNo || "Enquiry"} - ${enq.studentName || "Student"}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000000;
      background: #ffffff;
    }
    .form-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .header h2 {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin: 0 0 2px 0;
    }
    .header h3 {
      font-size: 11px;
      font-weight: 700;
      color: #333333;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header h1 {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 0;
      letter-spacing: 0.5px;
    }
    .section-box {
      border: 1px solid #000000;
      margin-bottom: 7px;
      page-break-inside: avoid;
    }
    .section-title {
      background: #e2e8f0;
      font-weight: 900;
      padding: 3.5px 7px;
      text-transform: uppercase;
      border-bottom: 1px solid #000000;
      font-size: 10.5px;
      letter-spacing: 0.5px;
    }
    .section-content {
      padding: 5px 8px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 14px;
      row-gap: 3.5px;
    }
    .col-span-2 {
      grid-column: span 2;
    }
    .label {
      font-weight: 700;
    }
    .checkboxes-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 3px;
    }
    .box-check {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10.5px;
    }
    .square-box {
      display: inline-block;
      width: 11px;
      height: 11px;
      border: 1px solid #000000;
      text-align: center;
      line-height: 10px;
      font-size: 10px;
      font-weight: bold;
    }
    .signatures-row {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed #666666;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
    }
  </style>
</head>
<body>
  <div class="form-container">
    <div class="header">
      <h2>BIRLA OPENMINDS INTERNATIONAL SCHOOL</h2>
      <h3>LB Nagar Branch</h3>
      <h1>NEW ADMISSION – PARENT COUNSELLING FORM</h1>
    </div>

    <!-- 1. STUDENT & PARENT DETAILS -->
    <div class="section-box">
      <div class="section-title">1. STUDENT & PARENT DETAILS</div>
      <div class="section-content grid-2">
        <div><span class="label">Date:</span> ${enq.date || "—"}</div>
        <div><span class="label">Enquiry No.:</span> <strong>${enq.enquiryNo || "—"}</strong></div>
        <div><span class="label">Student Name:</span> <strong>${enq.studentName || "—"}</strong></div>
        <div><span class="label">Applying for Class:</span> <strong>${enq.applyingForClass || "—"}</strong></div>
        <div><span class="label">Date of Birth:</span> ${enq.dateOfBirth || "—"}</div>
        <div><span class="label">Gender:</span> [ ${enq.gender === "Male" ? "✓" : "&nbsp;&nbsp;"} ] Male &nbsp;&nbsp; [ ${enq.gender === "Female" ? "✓" : "&nbsp;&nbsp;"} ] Female</div>
        <div><span class="label">Father's Name:</span> ${enq.fatherName || "—"}</div>
        <div><span class="label">Mother's Name:</span> ${enq.motherName || "—"}</div>
        <div><span class="label">Contact No.:</span> ${enq.contactNo || "—"}</div>
        <div><span class="label">WhatsApp No.:</span> ${enq.whatsappNo || "—"}</div>
        <div><span class="label">Previous School:</span> ${enq.previousSchool || "—"}</div>
        <div><span class="label">Previous Class:</span> ${enq.previousClass || "—"}</div>
        <div class="col-span-2"><span class="label">Residential Address:</span> ${enq.residentialAddress || "—"}</div>
      </div>
    </div>

    <!-- 2. PARENT ENQUIRY -->
    <div class="section-box">
      <div class="section-title">2. PARENT ENQUIRY</div>
      <div class="section-content">
        <div>
          <span class="label">How did you hear about our school?</span>
          <div class="checkboxes-wrap">
            ${sources.map(s => `
              <span class="box-check">
                <span class="square-box">${(enq.heardAboutSchool || []).includes(s) ? "✓" : "&nbsp;"}</span> ${s}
              </span>
            `).join("")}
          </div>
        </div>
        <div style="margin-top: 4px;"><span class="label">Reason for choosing our school:</span> ${enq.reasonForChoosing || "—"}</div>
        <div class="grid-2" style="margin-top: 4px;">
          <div><span class="label">Preferred Contact:</span> [ ${enq.preferredContact === "Call" ? "✓" : "&nbsp;&nbsp;"} ] Call &nbsp;&nbsp; [ ${enq.preferredContact === "WhatsApp" ? "✓" : "&nbsp;&nbsp;"} ] WhatsApp</div>
          <div><span class="label">Best time to contact:</span> ${enq.bestTimeToContact || "—"}</div>
        </div>
      </div>
    </div>

    <!-- 3. STUDENT INFORMATION & PARENT EXPECTATIONS -->
    <div class="section-box">
      <div class="section-title">3. STUDENT INFORMATION & PARENT EXPECTATIONS</div>
      <div class="section-content grid-2">
        <div><span class="label">Academic Performance:</span> ${enq.academicPerformance || "—"}</div>
        <div><span class="label">Student Interests/Talents:</span> ${enq.studentInterests || "—"}</div>
        <div><span class="label">Strengths:</span> ${enq.strengths || "—"}</div>
        <div><span class="label">Areas needing support:</span> ${enq.areasNeedingSupport || "—"}</div>
        <div><span class="label">Transport Required:</span> [ ${enq.transportRequired === true ? "✓" : "&nbsp;&nbsp;"} ] Yes &nbsp;&nbsp; [ ${enq.transportRequired === false ? "✓" : "&nbsp;&nbsp;"} ] No</div>
        <div>
          <span class="label">Special Learning Support:</span> [ ${enq.specialLearningSupport === true ? "✓" : "&nbsp;&nbsp;"} ] Yes &nbsp;&nbsp; [ ${enq.specialLearningSupport === false ? "✓" : "&nbsp;&nbsp;"} ] No
          ${enq.specialLearningSupport ? ` (${enq.specialLearningDetails || ""})` : ""}
        </div>
      </div>
    </div>

    <!-- 4. INFORMATION EXPLAINED (Official parent sheet - conversation coaching notes strictly excluded) -->
    <div class="section-box">
      <div class="section-title">4. INFORMATION EXPLAINED</div>
      <div class="section-content grid-2">
        <div>School Facilities: [ ${enq.explainedSchoolFacilities ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
        <div>Academic Programme: [ ${enq.explainedAcademicProgramme ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
        <div>Fee Structure: [ ${enq.explainedFeeStructure ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
        <div>Transport Details: [ ${enq.explainedTransportDetails ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
        <div>School Rules / Policies: [ ${enq.explainedSchoolRules ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
        <div>Activities / Sports: [ ${enq.explainedActivitiesSports ? "✓" : "&nbsp;&nbsp;"} ] Explained</div>
      </div>
    </div>

    <!-- 5. ADMISSION STATUS & SIGNATURES -->
    <div class="section-box">
      <div class="section-title">5. ADMISSION STATUS & SIGNATURES</div>
      <div class="section-content">
        <div class="checkboxes-wrap">
          ${statuses.map(st => `
            <span class="box-check">
              <span class="square-box">${enq.admissionStatus === st ? "✓" : "&nbsp;"}</span> ${st}
            </span>
          `).join("")}
        </div>

        <div class="grid-2" style="margin-top: 6px;">
          <div><span class="label">Follow-up Date:</span> ${enq.followUpDate || "—"}</div>
          <div><span class="label">Counsellor:</span> ${enq.counsellorName || "—"} ${enq.counsellorId ? `(${enq.counsellorId})` : ""}</div>
        </div>

        <div class="signatures-row">
          <div>
            <span class="label">Parent Signature:</span> __________________________
            ${enq.parentSignatureRecorded ? `<span style="margin-left: 8px; font-size: 9px; color: #065f46;">[Verified by Counsellor]</span>` : ""}
          </div>
          <div>
            <span class="label">Counsellor Signature:</span> __________________________
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  try {
    let printFrame = document.getElementById("admission-print-iframe") as HTMLIFrameElement;
    if (!printFrame) {
      printFrame = document.createElement("iframe");
      printFrame.id = "admission-print-iframe";
      printFrame.style.position = "fixed";
      printFrame.style.right = "0";
      printFrame.style.bottom = "0";
      printFrame.style.width = "0";
      printFrame.style.height = "0";
      printFrame.style.border = "0";
      printFrame.style.visibility = "hidden";
      document.body.appendChild(printFrame);
    }

    const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
    if (frameDoc) {
      frameDoc.open();
      frameDoc.write(printHtml);
      frameDoc.close();

      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (e) {
          window.print();
        }
      }, 350);
      return;
    }
  } catch (e) {
    // Fallback to native print if iframe is unsupported
  }

  window.print();
}
