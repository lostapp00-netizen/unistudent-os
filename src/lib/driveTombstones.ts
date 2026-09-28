/**
 * "Deleted on purpose" markers for drive items that came from a university
 * database template.
 *
 * When a student deletes a restored folder, the sync must never import it back
 * (that was the "the folder I removed comes back" bug). Every marker therefore
 * remembers WHEN the item was deleted:
 *
 *   - a row that reached the server BEFORE the deletion is a leftover and is
 *     removed;
 *   - a row stored AFTER it was imported on purpose — which is exactly what an
 *     explicit restore does — so it stays, and its marker is dropped.
 *
 * Without that rule an old marker deleted the whole restored drive again on the
 * first refresh, which is how a restore ended up looking complete and then
 * empty.
 *
 * Markers live in localStorage (per device). The legacy format was a plain array
 * of ids without times; it is migrated on first read and stamped "now", so it
 * can still clean up leftovers but can never delete a later restore.
 */

export type TombstoneMap = Record<string, number>;

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function tombstoneKey(userId: string): string {
  return `unistudent_deleted_template_files_${userId}`;
}

export function readDeletedTemplateFileRecords(userId: string): TombstoneMap {
  const store = storage();
  if (!store) return {};
  try {
    const raw = store.getItem(tombstoneKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      // Legacy ids without timestamps: treat them as deleted now, so they still
      // clean up leftovers from before but can never delete a later restore.
      const stamped: TombstoneMap = {};
      const now = Date.now();
      parsed.forEach((id: any) => {
        if (typeof id === 'string' && id) stamped[id] = now;
      });
      store.setItem(tombstoneKey(userId), JSON.stringify(stamped));
      return stamped;
    }

    if (parsed && typeof parsed === 'object') {
      const map: TombstoneMap = {};
      Object.entries(parsed as Record<string, any>).forEach(([id, at]) => {
        if (!id) return;
        const time = Number(at);
        map[id] = Number.isFinite(time) ? time : Date.now();
      });
      return map;
    }
  } catch {}
  return {};
}

export function getDeletedTemplateFileIds(userId: string): Set<string> {
  return new Set(Object.keys(readDeletedTemplateFileRecords(userId)));
}

function writeDeletedTemplateFileRecords(userId: string, records: TombstoneMap): void {
  const store = storage();
  if (!store) return;
  try {
    const entries = Object.entries(records).slice(-5000);
    store.setItem(tombstoneKey(userId), JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function addDeletedTemplateFileId(userId: string, templateId: string): void {
  if (!templateId) return;
  const records = readDeletedTemplateFileRecords(userId);
  records[templateId] = Date.now();
  writeDeletedTemplateFileRecords(userId, records);
}

/**
 * An explicit restore (استرداد) re-downloads the database drive, so everything it
 * imports must stay: the markers of those items are dropped.
 */
export function forgetDeletedTemplateFileIds(userId: string, templateIds: Iterable<string>): void {
  const ids = Array.from(templateIds).filter(Boolean);
  if (ids.length === 0) return;
  const records = readDeletedTemplateFileRecords(userId);
  let changed = false;
  for (const id of ids) {
    if (records[id] !== undefined) {
      delete records[id];
      changed = true;
    }
  }
  if (changed) writeDeletedTemplateFileRecords(userId, records);
}

/**
 * A marker may only remove a row that was stored BEFORE the deletion.
 *
 * A row with no server timestamp is a local/pending one that never reached the
 * server: it is still removed, exactly as before.
 */
export function wasStoredBeforeDeletion(insertedAt: string | undefined, deletedAt: number | undefined): boolean {
  if (deletedAt === undefined) return false;
  if (!insertedAt) return true;
  const storedAt = Date.parse(insertedAt);
  if (!Number.isFinite(storedAt)) return true;
  return storedAt <= deletedAt;
}
