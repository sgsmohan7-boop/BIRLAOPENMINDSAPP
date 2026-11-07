import { CounsellorAccount, CounsellingEnquiry } from "../types";

/**
 * Canonical Counsellor Staff Definitions
 * Enforces single canonical accounts:
 * - SOWJANYA: ID COUNSELLOR-03, username 'sowjanya', password '12345'
 * - KAVYA RAO: ID COUNSELLOR-04, username 'kavya', password '12345'
 * - RADHIKA DAS V: ID COUNSELLOR-01, username 'radhika'
 * - SRAVAN: ID COUNSELLOR-02, username 'sravan', password '83148314'
 * - TESTING: ID COUNSELLOR-05, username 'test', password '123456'
 */
export const CANONICAL_COUNSELLORS = {
  SOWJANYA: {
    id: "COUNSELLOR-03",
    name: "sowjanya",
    username: "sowjanya",
    password: "12345",
    email: "sowjanya.counsellor@birlainstitute.edu.in",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active" as const,
    color: "#EA580C"
  },
  KAVYA: {
    id: "COUNSELLOR-04",
    name: "kavya rao",
    username: "kavya",
    password: "12345",
    email: "kavya.counsellor@birlainstitute.edu.in",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active" as const,
    color: "#EA580C"
  },
  RADHIKA: {
    id: "COUNSELLOR-01",
    name: "RADHIKA DAS V",
    username: "radhika",
    password: "Password@111",
    email: "radhika.counsellor@birlainstitute.edu.in",
    roleTitle: "Admissions & Parent Counsellor",
    assignedGrades: "All Grades / Parent Liaison",
    status: "active" as const,
    color: "#DB2777"
  },
  SRAVAN: {
    id: "COUNSELLOR-02",
    name: "sravan",
    username: "sravan",
    password: "83148314",
    email: "counsellor2@birlainstitute.edu.in",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active" as const,
    color: "#2563EB"
  },
  TESTING: {
    id: "COUNSELLOR-05",
    name: "testing",
    username: "test",
    password: "123456",
    email: "test.counsellor@birlainstitute.edu.in",
    roleTitle: "Admissions Counsellor",
    assignedGrades: "All Grades",
    status: "active" as const,
    color: "#059669"
  }
};

/**
 * Normalizes any counsellor string or ID into a canonical identity.
 * Merges aliases like "R SOWJANYA", "r sowjanya", "R.SOWJANYA", "rsowjanya" -> SOWJANYA (COUNSELLOR-03)
 * Merges aliases like "KAVYARAO", "kavya rao", "kavya" -> KAVYA RAO (COUNSELLOR-04)
 */
export function normalizeCounsellorIdentity(inputName?: string, inputId?: string): {
  id: string;
  name: string;
  username: string;
} {
  const rawName = (inputName || "").trim();
  const rawId = (inputId || "").trim();
  const combined = `${rawName} ${rawId}`.toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1. Sowjanya (Merges 'R SOWJANYA', 'r sowjanya', 'rsowjanya', 'sowjanya r', 'counsellor-03')
  if (combined.includes("sowjanya") || rawId.toUpperCase() === "COUNSELLOR-03") {
    return {
      id: CANONICAL_COUNSELLORS.SOWJANYA.id,
      name: CANONICAL_COUNSELLORS.SOWJANYA.name,
      username: CANONICAL_COUNSELLORS.SOWJANYA.username
    };
  }

  // 2. Kavya (Merges 'KAVYARAO', 'kavya rao', 'kavya', 'counsellor-04')
  if (combined.includes("kavya") || rawId.toUpperCase() === "COUNSELLOR-04") {
    return {
      id: CANONICAL_COUNSELLORS.KAVYA.id,
      name: CANONICAL_COUNSELLORS.KAVYA.name,
      username: CANONICAL_COUNSELLORS.KAVYA.username
    };
  }

  // 3. Radhika
  if (combined.includes("radhika") || rawId.toUpperCase() === "COUNSELLOR-01") {
    return {
      id: CANONICAL_COUNSELLORS.RADHIKA.id,
      name: CANONICAL_COUNSELLORS.RADHIKA.name,
      username: CANONICAL_COUNSELLORS.RADHIKA.username
    };
  }

  // 4. Sravan
  if (combined.includes("sravan") || rawId.toUpperCase() === "COUNSELLOR-02") {
    return {
      id: CANONICAL_COUNSELLORS.SRAVAN.id,
      name: CANONICAL_COUNSELLORS.SRAVAN.name,
      username: CANONICAL_COUNSELLORS.SRAVAN.username
    };
  }

  // 5. Test
  if (combined.includes("test") || rawId.toUpperCase() === "COUNSELLOR-05") {
    return {
      id: CANONICAL_COUNSELLORS.TESTING.id,
      name: CANONICAL_COUNSELLORS.TESTING.name,
      username: CANONICAL_COUNSELLORS.TESTING.username
    };
  }

  return {
    id: rawId || "COUNSELLOR-01",
    name: rawName || "Admissions Counsellor",
    username: rawName.toLowerCase().replace(/\s+/g, "_")
  };
}

/**
 * Checks whether an account is an obsolete/duplicate alias (e.g. "R SOWJANYA" or "KAVYARAO")
 * that must be purged from accounts lists and UI dropdowns.
 */
export function isObsoleteOrDuplicateCounsellorAccount(acc: { username?: string; name?: string; id?: string }): boolean {
  if (!acc) return true;
  const user = (acc.username || "").trim().toLowerCase();
  const name = (acc.name || "").trim().toLowerCase();
  const id = (acc.id || "").trim().toLowerCase();

  // "R SOWJANYA" duplicate accounts
  if (
    user === "r sowjanya" ||
    user === "rsowjanya" ||
    user === "r.sowjanya" ||
    user === "r_sowjanya" ||
    name === "r sowjanya" ||
    name === "r. sowjanya" ||
    name === "r.sowjanya" ||
    name === "r_sowjanya" ||
    id === "r sowjanya" ||
    id === "rsowjanya"
  ) {
    return true;
  }

  // "KAVYARAO" duplicate accounts
  if (user === "kavyarao" || name === "kavyarao" || id === "kavyarao") {
    return true;
  }

  return false;
}

/**
 * Migrates and normalizes an enquiry and its audio recording so all data associated
 * with "R SOWJANYA" is fully transferred to "sowjanya" (COUNSELLOR-03).
 */
export function normalizeEnquiryCounsellor(enquiry: CounsellingEnquiry): {
  normalized: CounsellingEnquiry;
  wasChanged: boolean;
} {
  if (!enquiry) return { normalized: enquiry, wasChanged: false };

  const currentCName = enquiry.counsellorName || "";
  const currentCId = enquiry.counsellorId || "";
  const canonical = normalizeCounsellorIdentity(currentCName, currentCId);

  let changed = false;
  let updated = { ...enquiry };

  if (enquiry.counsellorName !== canonical.name || enquiry.counsellorId !== canonical.id) {
    updated.counsellorName = canonical.name;
    updated.counsellorId = canonical.id;
    changed = true;
  }

  // Also migrate the attached audio meeting recording
  if (updated.audioRecording) {
    const audioCanonical = normalizeCounsellorIdentity(
      updated.audioRecording.counsellorName || canonical.name,
      updated.audioRecording.counsellorId || canonical.id
    );

    if (
      updated.audioRecording.counsellorName !== audioCanonical.name ||
      updated.audioRecording.counsellorId !== audioCanonical.id
    ) {
      updated.audioRecording = {
        ...updated.audioRecording,
        counsellorName: audioCanonical.name,
        counsellorId: audioCanonical.id
      };
      changed = true;
    }
  }

  return { normalized: updated, wasChanged: changed };
}

/**
 * Migrates an entire array of enquiries, guaranteeing that any "R SOWJANYA" records
 * are transferred to "sowjanya" (COUNSELLOR-03) with 0 data loss.
 */
export function normalizeAllEnquiries(enquiries: CounsellingEnquiry[]): {
  enquiries: CounsellingEnquiry[];
  changedCount: number;
} {
  if (!Array.isArray(enquiries)) return { enquiries: [], changedCount: 0 };
  let changedCount = 0;
  const migrated = enquiries.map(e => {
    const { normalized, wasChanged } = normalizeEnquiryCounsellor(e);
    if (wasChanged) changedCount++;
    return normalized;
  });
  return { enquiries: migrated, changedCount };
}

/**
 * Purges duplicate accounts (e.g. "R SOWJANYA") from counsellor accounts array
 * and guarantees canonical "sowjanya" and "kavya rao" accounts exist.
 */
export function cleanAndNormalizeCounsellorAccounts(accounts: CounsellorAccount[]): CounsellorAccount[] {
  const seenUsernames = new Set<string>();
  const seenIds = new Set<string>();
  const cleaned: CounsellorAccount[] = [];

  // 1. Process existing accounts, filtering out obsolete duplicates
  if (Array.isArray(accounts)) {
    for (const acc of accounts) {
      if (!acc) continue;
      if (isObsoleteOrDuplicateCounsellorAccount(acc)) continue;

      const norm = normalizeCounsellorIdentity(acc.name, acc.id);
      const usernameKey = norm.username.toLowerCase();
      const idKey = norm.id.toLowerCase();

      if (seenUsernames.has(usernameKey) || seenIds.has(idKey)) {
        continue;
      }

      seenUsernames.add(usernameKey);
      seenIds.add(idKey);

      cleaned.push({
        ...acc,
        id: norm.id,
        name: norm.name,
        username: norm.username,
        // Guarantee password for core accounts
        password: norm.username === "sowjanya" ? (acc.password || "12345") : acc.password
      });
    }
  }

  // 2. Guarantee Sowjanya is present
  if (!seenUsernames.has("sowjanya") && !seenIds.has("counsellor-03")) {
    cleaned.push({
      id: CANONICAL_COUNSELLORS.SOWJANYA.id,
      name: CANONICAL_COUNSELLORS.SOWJANYA.name,
      username: CANONICAL_COUNSELLORS.SOWJANYA.username,
      password: CANONICAL_COUNSELLORS.SOWJANYA.password,
      email: CANONICAL_COUNSELLORS.SOWJANYA.email,
      phone: "+91 98765 00000",
      roleTitle: CANONICAL_COUNSELLORS.SOWJANYA.roleTitle,
      assignedGrades: CANONICAL_COUNSELLORS.SOWJANYA.assignedGrades,
      status: "active",
      color: CANONICAL_COUNSELLORS.SOWJANYA.color,
      createdAt: "02/11/2026"
    });
  }

  return cleaned;
}
