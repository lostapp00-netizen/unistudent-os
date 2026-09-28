/**
 * Keeping the student signed in across browser restarts.
 *
 * Supabase stores the session (access + refresh token) in localStorage. This app
 * shares that same 5 MB bucket with its own caches, and localStorage rejects
 * EVERY further write once it is full. The write that matters most is the auth
 * session: the refresh token rotates roughly every hour, and when that write
 * fails the browser keeps the OLD (already revoked) token. The next time the
 * student opens the browser the SDK tries to refresh with it, gets
 * "Invalid Refresh Token", and signs them out — which is exactly the
 * "I logged in, closed the browser, and found myself logged out" report.
 *
 * Two safety nets live here:
 *   1. a quota-safe storage adapter: the session write frees space by dropping
 *      caches that are rebuilt from the database, then retries;
 *   2. a copy of the session in IndexedDB (a separate, much larger quota), used
 *      to restore the login when localStorage no longer has it.
 *
 * Attachments of tasks/notes/appointments live ONLY on the device, and so do the
 * queued writes, the "deleted on purpose" markers and the settings — none of
 * those are ever pruned. Only caches that the server can hand back are dropped.
 */

const REBUILDABLE_CACHE_PATTERNS: RegExp[] = [
  /^unistudent_university_databases$/,
  /^unistudent_pending_updates$/,
  /^unistudent_all_suggestions$/,
  /^unistudent_user_suggestions_/,
  /^unistudent_drive_files_/,
  /^unistudent_files_/,
  /^unistudent_subjects_/,
  /^unistudent_groups_/,
  /^unistudent_known_users$/
];

export function isRebuildableCacheKey(key: string): boolean {
  return REBUILDABLE_CACHE_PATTERNS.some(pattern => pattern.test(key));
}

export function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  const name = (error as any).name || '';
  const code = (error as any).code;
  const message = String((error as any).message || '');
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 || code === 1014 ||
    /quota|storage is full|exceeded the quota/i.test(message)
  );
}

interface StorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function baseStorage(): StorageLike | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function localStorageUsage(storage: StorageLike | null = baseStorage()): number {
  if (!storage) return 0;
  let total = 0;
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key) continue;
      total += key.length + (storage.getItem(key)?.length || 0);
    }
  } catch {}
  return total;
}

/**
 * Drop every cache that the database can give back. Returns the bytes freed.
 * `keepKey` (usually the key being written) is never removed.
 */
export function pruneRebuildableCaches(keepKey?: string, storage: StorageLike | null = baseStorage()): number {
  if (!storage) return 0;
  let freed = 0;
  const doomed: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key || key === keepKey) continue;
      if (isRebuildableCacheKey(key)) doomed.push(key);
    }
    for (const key of doomed) {
      const size = key.length + (storage.getItem(key)?.length || 0);
      storage.removeItem(key);
      freed += size;
    }
  } catch {}
  if (freed > 0) {
    console.warn(`[storage] freed ${Math.round(freed / 1024)} KB of rebuildable caches to make room.`);
  }
  return freed;
}

export interface QuotaSafeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Storage adapter for the Supabase auth client: it NEVER throws, so a full
 * localStorage can no longer break the session write (the SDK would otherwise
 * leave a revoked refresh token behind and sign the student out later).
 */
export function createQuotaSafeStorage(storage: StorageLike | null = baseStorage()): QuotaSafeStorage {
  return {
    getItem(key) {
      try {
        return storage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      if (!storage) return;
      try {
        storage.setItem(key, value);
        return;
      } catch (error) {
        if (!isQuotaError(error)) {
          console.warn('[storage] could not persist the session:', error);
          return;
        }
      }
      // The bucket is full: free the rebuildable caches and try the same write again.
      pruneRebuildableCaches(key, storage);
      try {
        storage.setItem(key, value);
      } catch (error) {
        console.error('[storage] the session could not be stored even after freeing space.', error);
      }
    },
    removeItem(key) {
      try {
        storage?.removeItem(key);
      } catch {}
    }
  };
}

let persistProbe: boolean | null = null;

/**
 * Can this browser keep anything after it is closed? Private windows and the
 * in-app browsers of WhatsApp/Telegram/Facebook answer "no" — the student would
 * have to sign in every single time, and nothing in the code can change that.
 */
export function canPersistLocally(): boolean {
  const storage = baseStorage();
  if (!storage) return false;
  if (persistProbe !== null) return persistProbe;
  try {
    const key = 'unistudent_storage_probe';
    storage.setItem(key, '1');
    persistProbe = storage.getItem(key) === '1';
    storage.removeItem(key);
  } catch {
    persistProbe = false;
  }
  return persistProbe;
}

// --- session mirror (IndexedDB) -----------------------------------------------------------
// A second copy of the session in a separate storage area, so a full or evicted
// localStorage does not end the student's login.

const MIRROR_DB = 'unistudent-session';
const MIRROR_STORE = 'auth';
const MIRROR_KEY = 'session';
const MIRROR_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export interface MirroredSession {
  access_token: string;
  refresh_token: string;
  savedAt: number;
}

function openMirrorDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const request = indexedDB.open(MIRROR_DB, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(MIRROR_STORE)) db.createObjectStore(MIRROR_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveSessionMirror(session: { access_token?: string; refresh_token?: string } | null): Promise<void> {
  if (!session?.access_token || !session?.refresh_token) return;
  const db = await openMirrorDb();
  if (!db) return;
  try {
    await new Promise<void>(resolve => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      tx.objectStore(MIRROR_STORE).put(
        { access_token: session.access_token, refresh_token: session.refresh_token, savedAt: Date.now() } as MirroredSession,
        MIRROR_KEY
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
  } finally {
    try { db.close(); } catch {}
  }
}

export async function readSessionMirror(): Promise<MirroredSession | null> {
  const db = await openMirrorDb();
  if (!db) return null;
  try {
    const value = await new Promise<MirroredSession | null>(resolve => {
      const tx = db.transaction(MIRROR_STORE, 'readonly');
      const request = tx.objectStore(MIRROR_STORE).get(MIRROR_KEY);
      request.onsuccess = () => resolve((request.result as MirroredSession) || null);
      request.onerror = () => resolve(null);
    });
    if (!value?.refresh_token) return null;
    if (Date.now() - Number(value.savedAt || 0) > MIRROR_MAX_AGE_MS) {
      await clearSessionMirror();
      return null;
    }
    return value;
  } catch {
    return null;
  } finally {
    try { db.close(); } catch {}
  }
}

export async function clearSessionMirror(): Promise<void> {
  const db = await openMirrorDb();
  if (!db) return;
  try {
    await new Promise<void>(resolve => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      tx.objectStore(MIRROR_STORE).delete(MIRROR_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
  } finally {
    try { db.close(); } catch {}
  }
}
