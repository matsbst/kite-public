/**
 * Dexie-based database for Kite News
 * Manages read stories and other client-side data in IndexedDB
 *
 * Migration Strategy:
 * - Legacy stories from localStorage are stored with "legacy:title" IDs
 * - New stories use "batchId:categoryId:clusterNumber" format
 * - When a legacy story is marked as read again with full metadata,
 *   it's automatically migrated to the new format
 *
 * IndexedDB Storage Limits:
 * - Chrome/Edge: Up to 80% of disk space (but at least 1GB)
 * - Firefox: Up to 50% of disk space (but at least 10MB)
 * - Safari: Up to 1GB
 * - Can easily handle millions of read story entries
 */
import { browser } from "$app/environment";
import Dexie, { type Table } from "dexie";

// Interface for read story entries
export interface ReadStoryEntry {
  id: string; // Unique story identifier: "batchId:categoryId:clusterNumber" or "legacy:title_cleaned"
  title: string; // Story title for reference
  clusterNumber?: number; // Original cluster number
  timestamp: number; // When the story was read
  batchId?: string; // Which batch the story belongs to
  categoryId?: string; // Which category the story belongs to
}

class KiteNewsDB extends Dexie {
  // Declare tables
  readStories!: Table<ReadStoryEntry>;

  constructor() {
    super("KiteNewsDB");

    // Define schema - Version 1
    this.version(1).stores({
      // Primary key is 'id', other fields are indexed for querying
      // Compound index [batchId+categoryId+clusterNumber] for efficient batch queries
      readStories:
        "id, timestamp, [batchId+categoryId+clusterNumber], [batchId+categoryId]",
    });
  }
}

// Check if IndexedDB is available
let indexedDBAvailable = false;

// Synchronous check for IndexedDB availability
function checkIndexedDBSync(): boolean {
  if (!browser) return false;

  try {
    // Check if indexedDB exists
    if (typeof indexedDB !== "undefined" && indexedDB !== null) {
      return true;
    }
  } catch (error) {
    console.warn("[Dexie] IndexedDB check failed:", error);
  }
  return false;
}

// Initial sync check
indexedDBAvailable = checkIndexedDBSync();

// Create database instance
const db = new KiteNewsDB();

// Open the database and log status
if (browser && indexedDBAvailable) {
  db.open()
    .then(() => {
      console.log("[Dexie] Database opened successfully");
    })
    .catch((error) => {
      console.error("[Dexie] Failed to open database:", error);
      indexedDBAvailable = false;
    });
}

/**
 * Generate a unique story identifier
 * Uses the same pattern as storyId.ts for consistency
 */
function generateStoryId(
  title: string,
  clusterNumber?: number,
  batchId?: string,
  categoryId?: string,
): string {
  if (clusterNumber !== undefined && batchId && categoryId) {
    return `${batchId}:${categoryId}:${clusterNumber}`;
  }
  // Fallback: create hash-like ID from title + batchId + categoryId for stories without cluster numbers
  if (batchId && categoryId) {
    return `${batchId}:${categoryId}:title:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  // Ultimate fallback for migration/legacy data
  return `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
}

/**
 * Database operations wrapper
 */
export const kiteDB = {
  /**
   * Check if IndexedDB is available
   */
  isAvailable(): boolean {
    return indexedDBAvailable;
  },

  /**
   * Migrate from localStorage to IndexedDB
   */
  async migrateFromLocalStorage(): Promise<boolean> {
    if (!browser || !indexedDBAvailable) return false;

    try {
      // Check if migration already done
      const migrationDone = localStorage.getItem("dexie_migration_complete");
      if (migrationDone === "true") {
        console.log("[Dexie] Migration already completed");
        return true;
      }

      // Get existing data from localStorage
      const readStoriesJson = localStorage.getItem("readStories");
      if (readStoriesJson) {
        const oldReadStories = JSON.parse(readStoriesJson);
        const entries: ReadStoryEntry[] = Object.entries(oldReadStories)
          .filter(([_, read]) => read === true)
          .map(([title, _]) => ({
            id: `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`, // Convert to legacy format
            title,
            timestamp: Date.now(), // We don't have original timestamp, use current
          }));

        if (entries.length > 0) {
          console.log(
            `[Dexie] Migrating ${entries.length} read stories from localStorage to IndexedDB`,
          );

          // Ensure DB is open
          if (!db.isOpen()) {
            await db.open();
          }

          // Add all entries to IndexedDB
          await db.readStories.bulkAdd(entries);

          // Mark migration as complete
          localStorage.setItem("dexie_migration_complete", "true");

          // Remove old data from localStorage to free space
          localStorage.removeItem("readStories");

          console.log("[Dexie] Migration completed successfully");
        } else {
          // Mark migration as complete even if no data
          localStorage.setItem("dexie_migration_complete", "true");
        }
      } else {
        // No old data to migrate
        localStorage.setItem("dexie_migration_complete", "true");
      }

      return true;
    } catch (error) {
      console.error("[Dexie] Migration failed:", error);
      return false;
    }
  },

  /**
   * Get all read stories as a Set of story IDs for optimal performance
   */
  async getReadStoryIds(): Promise<Set<string>> {
    if (!browser || !indexedDBAvailable) {
      // Fallback to localStorage if IndexedDB not available - convert old format
      try {
        const saved = localStorage.getItem("readStories");
        if (saved) {
          const oldFormat = JSON.parse(saved);
          // Convert old title-based format to legacy IDs
          const storyIds = Object.keys(oldFormat)
            .filter((title) => oldFormat[title])
            .map(
              (title) =>
                `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`,
            );
          return new Set(storyIds);
        }
        return new Set();
      } catch {
        return new Set();
      }
    }

    try {
      // Ensure DB is open
      if (!db.isOpen()) {
        await db.open();
      }

      const entries = await db.readStories.toArray();
      const storyIds = entries.map((entry) => entry.id).filter(Boolean);
      return new Set(storyIds);
    } catch (error) {
      console.error("[Dexie] Failed to get read stories:", error);
      return new Set();
    }
  },

  /**
   * Check if a specific story is read
   */
  async isStoryRead(
    title: string,
    clusterNumber?: number,
    batchId?: string,
    categoryId?: string,
  ): Promise<boolean> {
    const readStories = await this.getReadStoryIds();

    // Check with full ID first
    const storyId = generateStoryId(title, clusterNumber, batchId, categoryId);
    if (readStories.has(storyId)) {
      return true;
    }

    // Fallback: check for legacy migrated stories by title
    const legacyId = `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
    return readStories.has(legacyId);
  },

  /**
   * Unmark a story as read (remove from database)
   */
  async unmarkStoryAsRead(
    title: string,
    clusterNumber?: number,
    batchId?: string,
    categoryId?: string,
  ): Promise<boolean> {
    if (!browser || !indexedDBAvailable) {
      // Fallback to localStorage if IndexedDB not available
      try {
        const saved = localStorage.getItem("readStories") || "{}";
        const readStories = JSON.parse(saved);
        delete readStories[title]; // Remove from localStorage
        localStorage.setItem("readStories", JSON.stringify(readStories));
        return true;
      } catch {
        return false;
      }
    }

    try {
      // Ensure DB is open
      if (!db.isOpen()) {
        await db.open();
      }

      // Generate the story ID
      const storyId = generateStoryId(
        title,
        clusterNumber,
        batchId,
        categoryId,
      );

      // Also check for legacy ID in case it exists
      const legacyId = `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;

      // Delete both possible IDs
      await db.transaction("rw", db.readStories, async () => {
        await db.readStories.delete(storyId);
        await db.readStories.delete(legacyId);
      });

      return true;
    } catch (error) {
      console.error("[Dexie] Failed to unmark story as read:", error);
      return false;
    }
  },

  /**
   * Mark a story as read
   */
  async markStoryAsRead(
    title: string,
    clusterNumber?: number,
    batchId?: string,
    categoryId?: string,
  ): Promise<boolean> {
    if (!browser || !indexedDBAvailable) {
      // Fallback to localStorage if IndexedDB not available
      try {
        const saved = localStorage.getItem("readStories") || "{}";
        const readStories = JSON.parse(saved);
        readStories[title] = true; // Use title as key for localStorage compatibility

        // For localStorage fallback, we still need some limit to avoid quota issues
        // But we can be more generous - 2000 entries should be fine
        const entries = Object.entries(readStories);
        if (entries.length > 2000) {
          const trimmed = Object.fromEntries(entries.slice(-1000));
          localStorage.setItem("readStories", JSON.stringify(trimmed));
        } else {
          localStorage.setItem("readStories", JSON.stringify(readStories));
        }
        return true;
      } catch {
        return false;
      }
    }

    try {
      // Ensure DB is open
      if (!db.isOpen()) {
        await db.open();
      }

      // Generate unique ID using the same function for consistency
      const storyId = generateStoryId(
        title,
        clusterNumber,
        batchId,
        categoryId,
      );

      // Check if already exists with current ID
      const existing = await db.readStories.get(storyId);
      if (!existing) {
        // Check if there's a legacy entry for this title and remove it
        const legacyId = `legacy:${title.slice(0, 50).replace(/[^a-zA-Z0-9]/g, "_")}`;
        const legacyEntry = await db.readStories.get(legacyId);

        if (legacyEntry) {
          // Migrate: delete old legacy entry and create new one with proper ID
          await db.transaction("rw", db.readStories, async () => {
            await db.readStories.delete(legacyId);
            await db.readStories.add({
              id: storyId,
              title,
              clusterNumber,
              timestamp: legacyEntry.timestamp, // Preserve original read time
              batchId,
              categoryId,
            });
          });
        } else {
          // New story, just add it
          await db.readStories.add({
            id: storyId,
            title,
            clusterNumber,
            timestamp: Date.now(),
            batchId,
            categoryId,
          });
        }
      }

      // No cleanup needed - IndexedDB can handle millions of entries
      // Typical limit is 50% of available disk space

      return true;
    } catch (error) {
      console.error("[Dexie] Failed to mark story as read:", error);
      return false;
    }
  },

  /**
   * Bulk update read stories
   */
  async bulkUpdateReadStories(
    readStories: Record<string, boolean>,
  ): Promise<boolean> {
    if (!browser || !indexedDBAvailable) {
      // Fallback to localStorage
      try {
        // For localStorage fallback, apply reasonable limit to avoid quota issues
        const entries = Object.entries(readStories);
        if (entries.length > 2000) {
          const trimmed = Object.fromEntries(entries.slice(-1000));
          localStorage.setItem("readStories", JSON.stringify(trimmed));
        } else {
          localStorage.setItem("readStories", JSON.stringify(readStories));
        }
        return true;
      } catch {
        return false;
      }
    }

    try {
      // Ensure DB is open
      if (!db.isOpen()) {
        await db.open();
      }

      // Clear existing and add new
      await db.transaction("rw", db.readStories, async () => {
        await db.readStories.clear();

        const entries: ReadStoryEntry[] = Object.entries(readStories)
          .filter(([_, read]) => read === true)
          .map(([title, _]) => ({
            id: title, // Use title as fallback ID for bulk migration
            title,
            timestamp: Date.now(),
          }));

        if (entries.length > 0) {
          await db.readStories.bulkAdd(entries);
        }
      });

      return true;
    } catch (error) {
      console.error("[Dexie] Failed to bulk update read stories:", error);
      return false;
    }
  },

  /**
   * Clear all read stories
   */
  async clearReadStories(): Promise<boolean> {
    if (!browser || !indexedDBAvailable) {
      localStorage.removeItem("readStories");
      return true;
    }

    try {
      await db.readStories.clear();
      return true;
    } catch (error) {
      console.error("[Dexie] Failed to clear read stories:", error);
      return false;
    }
  },

  /**
   * Get count of read stories
   */
  async getReadStoriesCount(): Promise<number> {
    if (!browser || !indexedDBAvailable) {
      try {
        const saved = localStorage.getItem("readStories");
        if (saved) {
          const readStories = JSON.parse(saved);
          return Object.values(readStories).filter(Boolean).length;
        }
      } catch {}
      return 0;
    }

    try {
      return await db.readStories.count();
    } catch (error) {
      console.error("[Dexie] Failed to get read stories count:", error);
      return 0;
    }
  },

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    count: number;
    estimatedSize?: number;
  } | null> {
    if (!browser || !indexedDBAvailable) return null;

    try {
      const count = await db.readStories.count();

      // Try to estimate storage if API is available
      let estimatedSize: number | undefined;
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        estimatedSize = estimate.usage;
      }

      return { count, estimatedSize };
    } catch (error) {
      console.error("[Dexie] Failed to get storage stats:", error);
      return null;
    }
  },
};

// Export the database instance for direct access if needed
export { db };

// Debug helpers for console
if (browser && typeof window !== "undefined") {
  // @ts-ignore
  window.kiteDB = kiteDB;

  // @ts-ignore
  window.debugKiteDB = async () => {
    try {
      console.log("[Dexie Debug] Database state:", db.isOpen());
      const count = await db.readStories.count();
      console.log("[Dexie Debug] Total read stories:", count);
      const stories = await db.readStories.limit(10).toArray();
      console.log("[Dexie Debug] Sample stories:", stories);

      // Check storage quota
      if ("storage" in navigator && "estimate" in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        console.log("[Dexie Debug] Storage estimate:", {
          quota: estimate.quota
            ? `${(estimate.quota / 1024 / 1024).toFixed(1)}MB`
            : "Unknown",
          usage: estimate.usage
            ? `${(estimate.usage / 1024 / 1024).toFixed(1)}MB`
            : "Unknown",
          usagePercentage:
            estimate.quota && estimate.usage
              ? `${((estimate.usage / estimate.quota) * 100).toFixed(1)}%`
              : "Unknown",
        });
      }

      return { count, stories };
    } catch (error) {
      console.error("[Dexie Debug] Error:", error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  };
}
