import { CounsellingEnquiry, ParentSelfEntry } from "../types";
import { normalizeCounsellorIdentity, normalizeEnquiryCounsellor } from "./counsellorNormalizer";

export function normalizeStudentName(name?: string | null): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function extractCoreStudentName(name?: string | null): string {
  return normalizeStudentName(name)
    .replace(/(?:\s+(?:xi|xii|11th|12th))?(?:\s+(?:mpc|bipc|mec|cec|hec|cbse|icse))+\s*$/i, "")
    .trim();
}

export function normalizePhone10(phone?: string | null): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

const PLACEHOLDER_PHONES = new Set(["", "9876543210", "0000000000", "1234567890"]);

export function isSameStudentRecord(
  a: {
    studentName?: string;
    contactNo?: string;
    whatsappNo?: string;
    fatherMobile?: string;
    motherMobile?: string;
    sourceParentEntryId?: string;
  } | null | undefined,
  b: {
    studentName?: string;
    contactNo?: string;
    whatsappNo?: string;
    fatherMobile?: string;
    motherMobile?: string;
    sourceParentEntryId?: string;
  } | null | undefined
): boolean {
  if (!a || !b) return false;

  const n1 = normalizeStudentName(a.studentName);
  const n2 = normalizeStudentName(b.studentName);
  const c1 = extractCoreStudentName(a.studentName);
  const c2 = extractCoreStudentName(b.studentName);

  // If either record is unnamed, fall back to exact sourceParentEntryId match only
  if (!n1 || !n2) {
    return Boolean(a.sourceParentEntryId && b.sourceParentEntryId && a.sourceParentEntryId === b.sourceParentEntryId);
  }

  const nameMatches =
    n1 === n2 ||
    (c1.length >= 4 && c1 === c2) ||
    (n1.length >= 5 && n2.startsWith(n1 + " ")) ||
    (n2.length >= 5 && n1.startsWith(n2 + " "));

  if (!nameMatches) return false;

  const phonesA = [a.contactNo, a.whatsappNo, a.fatherMobile, a.motherMobile]
    .map(normalizePhone10)
    .filter((p) => p.length >= 7 && !PLACEHOLDER_PHONES.has(p));
  const phonesB = [b.contactNo, b.whatsappNo, b.fatherMobile, b.motherMobile]
    .map(normalizePhone10)
    .filter((p) => p.length >= 7 && !PLACEHOLDER_PHONES.has(p));

  if (phonesA.length > 0 && phonesB.length > 0) {
    return phonesA.some((p) => phonesB.includes(p));
  }

  return true;
}

export function formatCanonicalEnquiryNo(num: number, year: number = new Date().getFullYear()): string {
  const padded = num < 100 ? String(num).padStart(2, "0") : String(num);
  return `ENQ-${year}-${padded}`;
}

export function extractEnquirySerialNum(enquiryNo?: string | null): number | null {
  if (!enquiryNo) return null;
  const clean = String(enquiryNo).trim().toUpperCase();
  const match = clean.match(/ENQ-\d{4}-0*(\d+)/i) || clean.match(/ENQ-.*-0*(\d+)/i);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (isNaN(num) || num <= 0 || num >= 50000) return null;
  return num;
}

export function computeDeterministicFollowUpDMY(rawDate?: string | null): string {
  const fallback = "18-11-2026";
  if (!rawDate) return fallback;
  const trimmed = String(rawDate).trim().split(" ")[0];
  let d: Date | null = null;

  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split("-").map(Number);
    d = new Date(Date.UTC(yyyy, mm - 1, dd));
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [yyyy, mm, dd] = trimmed.split("-").map(Number);
    d = new Date(Date.UTC(yyyy, mm - 1, dd));
  }

  if (!d || isNaN(d.getTime())) return fallback;
  d.setUTCDate(d.getUTCDate() + 7);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function computeDeterministicTimestamp(entry: Partial<ParentSelfEntry>): number {
  const candidates = [entry.completedAt, entry.claimedAt, entry.submittedAt];
  for (const raw of candidates) {
    if (!raw) continue;
    const ms = new Date(raw).getTime();
    if (!isNaN(ms) && ms > 0) return ms;
  }
  return 0;
}

function formatDeterministicDMYFromMs(ms: number, fallbackDate: string): string {
  if (ms > 0) {
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}-${mm}-${yyyy}`;
    }
  }
  return fallbackDate || "11-11-2026";
}

function isGarbageTestRecord(item: Partial<CounsellingEnquiry> | null | undefined): boolean {
  if (!item) return true;
  const id = String(item.id || "").trim();
  if (/^(TEST_DELETE_CHECK|TEST_DEBUG_|TEST_ENQ_1)/i.test(id)) return true;
  if (!item.studentName || !String(item.studentName).trim()) return true;
  return false;
}

/**
 * Deterministic, collision-safe cloud merger used identically across App.tsx and CounsellingPortal.tsx.
 * Guarantees two different laptops viewing the same Firestore data always compute the exact same list & counts:
 * - Zero dropped students on ENQ-2026-XX collisions (e.g. ENQ-2026-124 EESHWITHA vs Name 1)
 * - Zero duplicate synthetic rows when parent entry is already saved under another ENQ number (e.g. Vanshika G -> XI MPC)
 * - Zero non-deterministic timestamps or follow-up dates (never calls Date.now() or current clock)
 */
export function synthesizeAndMergeEnquiries(
  forms: CounsellingEnquiry[],
  parentEntries: ParentSelfEntry[],
  deletedIds: string[]
): CounsellingEnquiry[] {
  const deletedSet = new Set(
    (Array.isArray(deletedIds) ? deletedIds : [])
      .filter(Boolean)
      .map((x) => String(x).trim().toLowerCase())
  );

  const isDeleted = (e?: { id?: string; enquiryNo?: string; sourceParentEntryId?: string } | null): boolean => {
    if (!e) return true;
    const eId = (e.id || "").trim().toLowerCase();
    const eNo = (e.enquiryNo || "").trim().toLowerCase();
    const eSrc = (e.sourceParentEntryId || "").trim().toLowerCase();
    return Boolean(
      (eId && deletedSet.has(eId)) ||
      (eNo && deletedSet.has(eNo)) ||
      (eSrc && deletedSet.has(eSrc))
    );
  };

  // 1. Normalize & place all active forms without dropping colliding distinct students
  const merged: CounsellingEnquiry[] = [];
  const usedIds = new Set<string>();

  for (const rawForm of Array.isArray(forms) ? forms : []) {
    if (isGarbageTestRecord(rawForm) || isDeleted(rawForm)) continue;

    const preferredFormId =
      rawForm.id && rawForm.id.includes("__")
        ? rawForm.id
        : rawForm.enquiryNo || rawForm.id;
    const { normalized } = normalizeEnquiryCounsellor({
      ...rawForm,
      id: preferredFormId,
      enquiryNo: rawForm.enquiryNo || rawForm.id
    });

    const canonicalId = (normalized.id || normalized.enquiryNo || "").trim();
    if (!canonicalId) continue;

    const lowerId = canonicalId.toLowerCase();
    if (!usedIds.has(lowerId)) {
      usedIds.add(lowerId);
      merged.push({ ...normalized, id: canonicalId });
    } else {
      const existingIdx = merged.findIndex((m) => m.id.toLowerCase() === lowerId);
      const existing = existingIdx >= 0 ? merged[existingIdx] : null;
      if (existing && isSameStudentRecord(existing, normalized)) {
        // Same student & same ENQ: keep newer timestamp
        const tNew = Number(normalized.updatedAtTimestamp || 0);
        const tOld = Number(existing.updatedAtTimestamp || 0);
        if (tNew > tOld) {
          merged[existingIdx] = { ...existing, ...normalized, id: canonicalId };
        }
      } else {
        // Different student colliding on the exact same ENQ number: preserve BOTH cleanly
        let suffix = 2;
        let altId = `${canonicalId}__${suffix}`;
        while (usedIds.has(altId.toLowerCase())) {
          suffix++;
          altId = `${canonicalId}__${suffix}`;
        }
        usedIds.add(altId.toLowerCase());
        merged.push({ ...normalized, id: altId });
      }
    }
  }

  // Build parent-entry matching helper against saved forms
  const formMatchesParentEntry = (form: CounsellingEnquiry, entry: ParentSelfEntry): boolean => {
    if (form.sourceParentEntryId && entry.id && form.sourceParentEntryId === entry.id) {
      return isSameStudentRecord(form, entry);
    }
    if (entry.completedEnquiryNo && form.enquiryNo) {
      const enqA = entry.completedEnquiryNo.trim().toLowerCase();
      const enqB = form.enquiryNo.trim().toLowerCase();
      if (enqA === enqB && isSameStudentRecord(form, entry)) {
        return true;
      }
    }
    return isSameStudentRecord(form, entry);
  };

  // Sort parent entries deterministically by submittedAt so synthesis order never varies across devices
  const sortedParents = [...(Array.isArray(parentEntries) ? parentEntries : [])].sort((a, b) => {
    const ta = computeDeterministicTimestamp(a);
    const tb = computeDeterministicTimestamp(b);
    if (ta !== tb) return ta - tb;
    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });

  // 2. Deterministically synthesize any completed or claimed parent_self_entries missing from forms
  for (const entry of sortedParents) {
    if (!entry || entry.status === "dismissed") continue;
    const isEligible = entry.status === "completed" || entry.status === "claimed" || Boolean(entry.claimedBy);
    if (!isEligible) continue;

    if (
      deletedSet.has(String(entry.id || "").trim().toLowerCase()) ||
      (entry.completedEnquiryNo && deletedSet.has(entry.completedEnquiryNo.trim().toLowerCase()))
    ) {
      continue;
    }

    // Never synthesize if already represented in forms (or already synthesized identically)
    const alreadyInMerged = merged.some((m) => formMatchesParentEntry(m, entry));
    if (alreadyInMerged) continue;

    const rawDate =
      entry.entryDate ||
      (entry.formattedDate ? entry.formattedDate.split(" ")[0] : "") ||
      entry.dateKey ||
      "11-11-2026";

    const isOnline = entry.enquiryType === "online";
    const tokenPad =
      typeof entry.dailyTokenNo === "number" && entry.dailyTokenNo > 0
        ? entry.dailyTokenNo < 100
          ? String(entry.dailyTokenNo).padStart(2, "0")
          : String(entry.dailyTokenNo)
        : entry.id;

    const displayEnqNo = (
      entry.completedEnquiryNo ||
      entry.onlineRefNo ||
      (isOnline ? `ONL-2026-${entry.id}` : `ENQ-2026-${tokenPad}`)
    ).trim();

    // Ensure unique internal id even if another student already owns `displayEnqNo`
    let docId = displayEnqNo;
    if (usedIds.has(docId.toLowerCase())) {
      docId = `${displayEnqNo}__${entry.id}`;
      let guard = 2;
      while (usedIds.has(docId.toLowerCase())) {
        docId = `${displayEnqNo}__${entry.id}_${guard++}`;
      }
    }
    usedIds.add(docId.toLowerCase());

    const counsellorNorm = normalizeCounsellorIdentity(
      entry.completedByName || entry.completedBy || entry.claimedByName || entry.claimedBy
    );
    const detTs = computeDeterministicTimestamp(entry);

    merged.push({
      id: docId,
      enquiryNo: displayEnqNo,
      enquiryType: isOnline ? "online" : "walkin",
      onlineRefNo: isOnline ? entry.onlineRefNo || displayEnqNo : undefined,
      sourceParentEntryId: entry.id,
      date: rawDate,
      studentName: entry.studentName || "Walk-in Parent",
      applyingForClass: entry.applyingForClass || "Grade 1",
      academicYear: entry.academicYear || "2026-2027",
      dateOfBirth: entry.dateOfBirth || "",
      gender: entry.gender || "Male",
      fatherName: entry.fatherName || "",
      motherName: entry.motherName || "",
      contactNo: entry.contactNo || "",
      whatsappNo: entry.whatsappNo || entry.contactNo || "",
      previousSchool: entry.previousSchool || "",
      previousClass: entry.previousClass || "",
      residentialAddress: entry.residentialAddress || "",
      heardAboutSchool: Array.isArray(entry.heardAboutSchool) ? entry.heardAboutSchool : ["Google / Online Search"],
      reasonForChoosing: entry.reasonForChoosing || "Campus Reception Walk-in Visit",
      preferredContact: entry.preferredContact || "Call",
      bestTimeToContact: "Morning 10 AM",
      academicPerformance: "",
      studentInterests: "",
      strengths: "",
      areasNeedingSupport: "",
      transportRequired: Boolean(entry.transportRequired),
      hostelRequired: false,
      specialLearningSupport: Boolean(entry.specialLearningSupport),
      specialLearningDetails: "",
      pointsDiscussed: "Reception Kiosk Registration & Walk-in Counselling",
      counsellorObservations:
        entry.status === "completed"
          ? "Admissions counselling meeting completed"
          : "Walk-in parent registered via kiosk",
      explainedSchoolFacilities: true,
      explainedAcademicProgramme: true,
      explainedFeeStructure: true,
      explainedTransportDetails: true,
      explainedSchoolRules: true,
      explainedActivitiesSports: true,
      admissionStatus: "Follow-up Required",
      followUpDate: computeDeterministicFollowUpDMY(rawDate),
      counsellorId: counsellorNorm.id,
      counsellorName: entry.completedByName || entry.claimedByName || counsellorNorm.name,
      parentSignatureRecorded: true,
      walkInTokenNo: entry.dailyTokenNo || undefined,
      createdAt: entry.submittedAt || entry.claimedAt || rawDate,
      updatedAt: formatDeterministicDMYFromMs(detTs, rawDate),
      updatedAtTimestamp: detTs
    });
  }

  // Consistent canonical descending sort (newest timestamp / enquiry serial first)
  return merged.sort((a, b) => {
    const ta = Number(a.updatedAtTimestamp || 0);
    const tb = Number(b.updatedAtTimestamp || 0);
    if (tb !== ta) return tb - ta;
    const na = extractEnquirySerialNum(a.enquiryNo) || 0;
    const nb = extractEnquirySerialNum(b.enquiryNo) || 0;
    if (nb !== na) return nb - na;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}
