import firebaseConfig from "../../firebase-applet-config.json";

declare const __BOMIS_BUILD_ID__: string | undefined;

const DATA_CACHE_KEYS = [
  "it_command_counselling",
  "it_command_counselling_forms",
  "sgs_parent_self_entries",
  "parent_self_entries",
  "sgs_deleted_enquiries",
  "sgs_archived_dismissed_entries",
  "sgs_dismissed_parent_entries",
  "it_command_center_data",
  "sgs_counsellor_accounts",
  "sgs_management_accounts",
  "sgs_it_staff_accounts",
  "sgs_deleted_counsellor_accounts",
  "sgs_deleted_management_accounts",
  "sgs_deleted_it_staff_accounts",
  "sgs_last_sync_tickets",
  "sgs_last_sync_history",
  "sgs_last_sync_inventory",
  "sgs_last_sync_rooms",
  "sgs_last_sync_allocations",
  "sgs_last_sync_warranty",
  "sgs_firestore_quota_exhausted",
];

// Manual schema bump for dev + automatic per-build ID in production (vite.config.ts)
const SCHEMA_EPOCH = "v2026_11_16_bomis_01";

export function runCacheEpochGuard(): void {
  if (typeof window === "undefined") return;

  try {
    const buildId =
      typeof __BOMIS_BUILD_ID__ !== "undefined" && __BOMIS_BUILD_ID__
        ? __BOMIS_BUILD_ID__
        : SCHEMA_EPOCH;
    const expectedEpoch = `${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}:${SCHEMA_EPOCH}:${buildId}`;
    const prevEpoch = localStorage.getItem("bomis_cache_epoch");
    const prevProjectId = localStorage.getItem("bomis_last_project_id");
    const projectChanged = Boolean(prevProjectId && prevProjectId !== firebaseConfig.projectId);

    if (prevEpoch !== expectedEpoch || projectChanged) {
      // Preserve unsynced offline work only if project didn't switch; clear all stale mirrored data caches
      const unsyncedRaw = !projectChanged ? localStorage.getItem("sgs_unsynced_enquiry_ids") : null;
      let hasUnsynced = false;
      try {
        hasUnsynced = Boolean(unsyncedRaw && JSON.parse(unsyncedRaw)?.length > 0);
      } catch {
        hasUnsynced = false;
      }

      for (const key of DATA_CACHE_KEYS) {
        if (hasUnsynced && key === "it_command_counselling") continue;
        try {
          localStorage.removeItem(key);
        } catch {}
      }

      // Also clean per-counsellor dismissed parent entry keys
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith("sgs_dismissed_parent_entries_")) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          try {
            localStorage.removeItem(k);
          } catch {}
        });
      } catch {}

      if (projectChanged) {
        try {
          localStorage.removeItem("sgs_unsynced_enquiry_ids");
        } catch {}

        // Purge old Firestore IndexedDB caches when Firebase project switches so old project data cannot linger
        try {
          if ("indexedDB" in window && typeof indexedDB.databases === "function") {
            indexedDB.databases().then((dbs) => {
              dbs.forEach((dbInfo) => {
                if (dbInfo.name && dbInfo.name.startsWith("firestore/")) {
                  try {
                    indexedDB.deleteDatabase(dbInfo.name);
                  } catch {}
                }
              });
            }).catch(() => {});
          }
        } catch {}
      }

      // Clear Service Worker CacheStorage so stale JS/HTML chunks never linger across deploys
      try {
        if ("caches" in window) {
          caches.keys().then((names) => {
            names.forEach((name) => {
              caches.delete(name).catch(() => {});
            });
          }).catch(() => {});
        }
      } catch {}

      try {
        localStorage.setItem("bomis_cache_epoch", expectedEpoch);
        localStorage.setItem("bomis_last_project_id", firebaseConfig.projectId);
      } catch {}
    }
  } catch {}
}
