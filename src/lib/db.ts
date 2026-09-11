import { supabase } from './supabase';
import { UserSettings, Subject, DriveFile, Note, Task, Appointment, ScheduleItem, Group, FeedbackSuggestion, DatabaseBackup, EmailBackupConfig, UniversityDatabase, UniversityPendingUpdate, GradeRule, GradeDistributionItem } from '../types';
import { normalizeSubjectName } from './academicTranslation';

export async function broadcastUniversityDatabaseUpdate(payload: any): Promise<void> {
  let ephemeralChannel: any = null;
  try {
    // Reuse an already-registered channel with the same topic if one exists
    // (e.g. the App-level receiver). Creating/subscribing a second channel with
    // the same name and leaving it registered makes later `.on('postgres_changes')`
    // calls throw "cannot add callbacks after subscribe()".
    const existing = supabase.getChannels().find(c => c.topic === 'realtime:university_global_sync');
    const ch = existing || (() => { ephemeralChannel = supabase.channel('university_global_sync'); return ephemeralChannel; })();

    if (existing && existing.state === 'joined') {
      await ch.send({ type: 'broadcast', event: 'university_db_updated', payload }).catch(() => {});
      return;
    }

    await new Promise<void>((resolve) => {
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          ch.send({
            type: 'broadcast',
            event: 'university_db_updated',
            payload
          }).then(() => resolve()).catch(() => resolve());
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          resolve();
        }
      });
      setTimeout(resolve, 1500);
    });
  } catch (err) {
    console.warn('Realtime broadcast error:', err);
  } finally {
    if (ephemeralChannel) {
      try { supabase.removeChannel(ephemeralChannel); } catch {}
    }
  }
}

// --- Resilient persistence layer ---
// 1. resilientWrite(): runs a Supabase write and retries once on failure.
// 2. On permanent failure the operation is NOT silently dropped anymore:
//    it is queued in localStorage and replayed by flushPendingWrites() on the
//    next app start (and after any later successful write), so user data can
//    never vanish just because the DB hiccuped at save time.
// 3. A `unistudent-save-error` window event is dispatched with the real error
//    message so the UI can surface it (App.tsx shows a red toast).
interface WriteContext {
  userId: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: any;
  matchId?: string;
  errorMessage?: string;
}

interface PendingWriteOp {
  id: string;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: any;
  matchId?: string;
  ts: number;
}

function describeError(err: any): string {
  if (!err) return 'خطأ غير معروف';
  return (err.message || err.details || err.hint || String(err)).slice(0, 220);
}

// PostgREST names missing columns in schema-cache errors, e.g.:
// "Could not find the 'university_template_id' column of 'subjects' in the schema cache"
function missingColumnFromError(err: any): string | null {
  const msg = err && typeof err.message === 'string' ? err.message : '';
  const m = msg.match(/Could not find the '([^']+)' column/i);
  return m ? m[1] : null;
}

function getPendingWrites(userId: string): PendingWriteOp[] {
  try {
    const raw = localStorage.getItem(`unistudent_pending_writes_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setPendingWrites(userId: string, ops: PendingWriteOp[]): void {
  try {
    localStorage.setItem(`unistudent_pending_writes_${userId}`, JSON.stringify(ops.slice(-2000)));
  } catch {}
}

function recordFailedWrite(ctx: WriteContext): void {
  if (!ctx.userId) return;
  const ops = getPendingWrites(ctx.userId);
  ops.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    table: ctx.table,
    op: ctx.op,
    payload: ctx.payload,
    matchId: ctx.matchId,
    ts: Date.now()
  });
  setPendingWrites(ctx.userId, ops);
  try {
    window.dispatchEvent(new CustomEvent('unistudent-save-error', {
      detail: { table: ctx.table, message: ctx.errorMessage || 'تعذر الحفظ في قاعدة البيانات', pendingCount: ops.length }
    }));
  } catch {}
}

let flushInFlight = false;

export async function flushPendingWrites(userId: string): Promise<void> {
  if (!userId || flushInFlight) return;
  const ops = getPendingWrites(userId);
  if (ops.length === 0) return;

  flushInFlight = true;
  try {
    const remaining: PendingWriteOp[] = [];
    for (const op of ops) {
      try {
        let error: any = null;
        if (op.op === 'insert') {
          let payload = op.payload;
          let res = await supabase.from(op.table).insert([payload]);
          for (let i = 0; i < 4 && res.error; i++) {
            // Missing column (schema-cache/migration lag): drop and retry.
            const missing = missingColumnFromError(res.error);
            if (payload && missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
              console.warn(`Flush ${op.table}: dropping missing column '${missing}' and retrying.`);
              delete payload[missing];
              res = await supabase.from(op.table).insert([payload]);
              continue;
            }
            // NOT NULL violation (legacy live schema requires a column the
            // payload omitted, e.g. schedule_items.title): fill a placeholder.
            const notNull = res.error && typeof res.error.message === 'string'
              ? (res.error.message.match(/null value in column "(\w+)"/i)?.[1] || null)
              : null;
            if (payload && notNull && !Object.prototype.hasOwnProperty.call(payload, notNull)) {
              console.warn(`Flush ${op.table}: filling required column '${notNull}' and retrying.`);
              payload[notNull] = 'item';
              res = await supabase.from(op.table).insert([payload]);
              continue;
            }
            break;
          }
          error = res.error;
          // Already applied on a previous pass — treat as success.
          if (error && (error as any).code === '23505') error = null;
        } else if (op.op === 'update') {
          const res = await supabase.from(op.table).update(op.payload).eq('id', op.matchId).eq('user_id', userId);
          error = res.error;
        } else if (op.op === 'delete') {
          const res = await supabase.from(op.table).delete().eq('id', op.matchId).eq('user_id', userId);
          error = res.error;
        }
        if (error) {
          console.warn(`Pending write retry failed (${op.table}/${op.op}):`, error);
          remaining.push(op);
        }
      } catch (e) {
        console.warn(`Pending write retry threw (${op.table}/${op.op}):`, e);
        remaining.push(op);
      }
    }
    setPendingWrites(userId, remaining);
    const flushed = ops.length - remaining.length;
    if (flushed > 0) {
      try {
        window.dispatchEvent(new CustomEvent('unistudent-save-success', {
          detail: { flushed, stillPending: remaining.length }
        }));
      } catch {}
    }
  } finally {
    flushInFlight = false;
  }
}

async function resilientWrite(label: string, run: () => PromiseLike<{ error: any }>, ctx?: Omit<WriteContext, 'errorMessage'>): Promise<void> {
  let res: { error: any };
  try {
    res = await run();
  } catch (e) {
    res = { error: e };
  }
  if (!res.error) {
    if (ctx) void flushPendingWrites(ctx.userId).catch(() => {});
    return;
  }
  console.warn(`Write failed (${label}), retrying once...`, res.error);
  try {
    res = await run();
  } catch (e) {
    res = { error: e };
  }
  if (res.error) {
    console.error(`Write failed permanently (${label}):`, res.error);
    if (ctx) {
      recordFailedWrite({ ...ctx, errorMessage: describeError(res.error) });
    }
  } else if (ctx) {
    void flushPendingWrites(ctx.userId).catch(() => {});
  }
}

// Generic read helper: Supabase is authoritative and refreshes the per-user
// cache; the cache is only used when Supabase itself failed to respond
// (offline), mirroring the getSubjects() pattern.
function cacheRead<T>(key: string, fetchFn: () => PromiseLike<T[] | null>): Promise<T[]> {
  return (async () => {
    let rows: T[] | null = null;
    try {
      rows = await fetchFn();
    } catch (e) {
      console.warn(`Supabase read failed (${key}), checking cache:`, e);
    }
    if (rows !== null) {
      try { localStorage.setItem(key, JSON.stringify(rows)); } catch {}
      return rows;
    }
    try {
      const cached = localStorage.getItem(key);
      if (cached) return JSON.parse(cached) as T[];
    } catch {}
    return [];
  })();
}

export const db = {
  // --- Settings ---
  async getSettings(userId: string): Promise<UserSettings | null> {
    let remoteData: any = null;
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('user_id', userId).maybeSingle();
      if (error && error.code !== 'PGRST116') console.warn('Notice fetching settings from Supabase:', error);
      if (data) remoteData = data;
    } catch (e) {
      console.warn('Network / fetch exception in getSettings:', e);
    }

    let localData: any = null;
    try {
      const saved = localStorage.getItem(`unistudent_settings_${userId}`);
      if (saved) {
        localData = JSON.parse(saved);
      }
    } catch {}

    if (remoteData) {
      return mapSettingsFromDB(remoteData);
    }

    if (localData) {
      return mapSettingsFromDB({ user_id: userId, ...localData });
    }

    return null;
  },
  async upsertSettings(userId: string, settings: Partial<UserSettings>) {
    const payload: any = { user_id: userId };
    if (settings.name !== undefined) payload.name = settings.name;
    if (settings.university !== undefined) payload.university = settings.university;
    if (settings.college !== undefined) payload.college = settings.college;
    if (settings.enrollmentDate !== undefined) payload.enrollment_date = settings.enrollmentDate;
    if (settings.totalYears !== undefined) payload.total_years = settings.totalYears;
    if (settings.semestersPerYear !== undefined) payload.semesters_per_year = settings.semestersPerYear;
    if (settings.theme !== undefined) payload.theme = settings.theme;
    if (settings.language !== undefined) payload.language = settings.language;
    if (settings.gradingScale !== undefined) payload.grading_scale = settings.gradingScale;
    if (settings.semesters !== undefined) payload.semesters = settings.semesters;

    if (settings.email !== undefined && settings.email !== null) {
      payload.email = settings.email;
      try {
        localStorage.setItem(`unistudent_user_email_${userId}`, settings.email);
      } catch {}
    } else {
      // A partial upsert (e.g. only universityDatabaseId) must never create or
      // update a settings row WITHOUT an email — that produced the
      // "student without email" entries in the admin panel. Registration is
      // always email-based, so the cached auth email is safe to reuse here.
      try {
        const cachedEmail = localStorage.getItem(`unistudent_user_email_${userId}`);
        if (cachedEmail) payload.email = cachedEmail;
      } catch {}
    }
    
    if (settings.initialCumulativeGpa !== undefined) payload.initial_cumulative_gpa = settings.initialCumulativeGpa;
    if (settings.initialCompletedCreditHours !== undefined) payload.initial_completed_credit_hours = settings.initialCompletedCreditHours;
    if (settings.setupMode !== undefined) payload.setup_mode = settings.setupMode;
    if (settings.warningGradeLetter !== undefined) payload.warning_grade_letter = settings.warningGradeLetter;
    if (settings.warningGpaPoints !== undefined) payload.warning_gpa_points = settings.warningGpaPoints;
    if ('universityDatabaseId' in settings) payload.university_database_id = settings.universityDatabaseId || null;
    if ('deletedSubjectNames' in settings) payload.deleted_subject_names = settings.deletedSubjectNames || [];
    if ('enableGraduationScale' in settings) payload.enable_graduation_scale = settings.enableGraduationScale;
    if ('graduationGradingScale' in settings) payload.graduation_grading_scale = settings.graduationGradingScale;
    if ('specialization' in settings) payload.specialization = settings.specialization ? settings.specialization.trim() : null;
    if ('specializationStartYear' in settings) payload.specialization_start_year = (settings.specializationStartYear != null && (settings.specializationStartYear as unknown as string) !== '' && Number(settings.specializationStartYear) > 0) ? Number(settings.specializationStartYear) : null;
    if ('specializationStartSemester' in settings) payload.specialization_start_semester = (settings.specializationStartSemester != null && (settings.specializationStartSemester as unknown as string) !== '' && Number(settings.specializationStartSemester) > 0) ? Number(settings.specializationStartSemester) : null;
    if ('specializationDatabaseId' in settings) payload.specialization_database_id = settings.specializationDatabaseId || null;

    try {
      const existingRaw = localStorage.getItem(`unistudent_settings_${userId}`);
      const existingObj = existingRaw ? JSON.parse(existingRaw) : {};
      localStorage.setItem(`unistudent_settings_${userId}`, JSON.stringify({
        ...existingObj,
        ...settings,
        universityDatabaseId: 'universityDatabaseId' in settings ? (settings.universityDatabaseId || null) : existingObj.universityDatabaseId,
        deletedSubjectNames: 'deletedSubjectNames' in settings ? (settings.deletedSubjectNames || []) : (existingObj.deletedSubjectNames || []),
        enableGraduationScale: 'enableGraduationScale' in settings ? settings.enableGraduationScale : existingObj.enableGraduationScale,
        graduationGradingScale: 'graduationGradingScale' in settings ? settings.graduationGradingScale : existingObj.graduationGradingScale,
        specialization: 'specialization' in settings ? settings.specialization : existingObj.specialization,
        specializationStartYear: 'specializationStartYear' in settings ? settings.specializationStartYear : existingObj.specializationStartYear,
        specializationStartSemester: 'specializationStartSemester' in settings ? settings.specializationStartSemester : existingObj.specializationStartSemester,
        specializationDatabaseId: 'specializationDatabaseId' in settings ? settings.specializationDatabaseId : existingObj.specializationDatabaseId
      }));

      // Embed student specialization metadata inside grading_scale JSONB as a dual-layer backup
      let scale = settings.gradingScale !== undefined 
        ? [...settings.gradingScale] 
        : (payload.grading_scale ? [...payload.grading_scale] : (existingObj.gradingScale ? [...existingObj.gradingScale] : []));
      scale = scale.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))));
      
      const curSpec = 'specialization' in settings ? settings.specialization : existingObj.specialization;
      const curStartYr = 'specializationStartYear' in settings ? settings.specializationStartYear : existingObj.specializationStartYear;
      const curStartSem = 'specializationStartSemester' in settings ? settings.specializationStartSemester : existingObj.specializationStartSemester;
      const curSpecDbId = 'specializationDatabaseId' in settings ? settings.specializationDatabaseId : existingObj.specializationDatabaseId;

      if (curSpec || curStartYr || curStartSem || curSpecDbId) {
        scale.push({
          id: '__student_spec_meta__',
          specialization: curSpec || null,
          specializationStartYear: curStartYr || null,
          specializationStartSemester: curStartSem || null,
          specializationDatabaseId: curSpecDbId || null
        } as any);
      }

      const curDeleted = 'deletedSubjectNames' in settings ? settings.deletedSubjectNames : existingObj.deletedSubjectNames;
      if (Array.isArray(curDeleted) && curDeleted.length > 0) {
        scale.push({
          id: '__student_deleted_subjects__',
          names: curDeleted
        } as any);
      }

      payload.grading_scale = scale;
    } catch {}

    let { error } = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      // If error is due to missing columns in Supabase, retry without new columns but keep in localStorage
      if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
        delete payload.initial_cumulative_gpa;
        delete payload.initial_completed_credit_hours;
        delete payload.setup_mode;
        delete payload.warning_grade_letter;
        delete payload.warning_gpa_points;
        delete payload.email;
        delete payload.university_database_id;
        delete payload.deleted_subject_names;
        delete payload.enable_graduation_scale;
        delete payload.graduation_grading_scale;
        delete payload.specialization;
        delete payload.specialization_start_year;
        delete payload.specialization_start_semester;
        delete payload.specialization_database_id;
        const retryRes = await supabase.from('settings').upsert(payload, { onConflict: 'user_id' });
        error = retryRes.error;
      }
      
      if (error) {
        const updateRes = await supabase.from('settings').update(payload).eq('user_id', userId);
        if (updateRes.error) {
          try {
            await supabase.from('settings').insert(payload);
          } catch {}
        }
      }
    }
  },

  // --- Subjects ---
  async getSubjects(userId: string): Promise<Subject[]> {
    let dbSubjects: Subject[] = [];
    let fetchedFromSupabase = false;
    try {
      // A restored academic database stays linked to its original owner.  This is
      // intentionally a live read, rather than a one-time copy, so an approved
      // update to the source database is visible to every student who restored it.
      // The RPC also returns the current user's own subjects when there is no link.
      const { data: sharedData, error: sharedError } = await supabase
        .rpc('get_visible_subjects_for_current_user');

      // Keep the previous query as a backwards-compatible fallback while older
      // installations are waiting for the database migration to be applied.
      const { data, error } = sharedError
        ? await supabase.from('subjects').select('*').eq('user_id', userId)
        : { data: sharedData, error: null };

      if (error) console.error('Error fetching subjects:', error);
      if (!error && data) {
        dbSubjects = data.map(mapSubjectFromDB);
        fetchedFromSupabase = true;
      } else if (error) {
        console.error('Error fetching subjects from Supabase:', error);
      }
    } catch (e) {
      console.warn('Supabase fetch subjects failed, checking cache:', e);
    }

    try {
      const cacheKey = `unistudent_subjects_${userId}`;
      if (fetchedFromSupabase) {
        // Supabase is authoritative. Keep local cache in sync:
        localStorage.setItem(cacheKey, JSON.stringify(dbSubjects));
        return dbSubjects;
      }

      // Only fall back to local storage if Supabase failed to respond (offline)
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}

    return dbSubjects;
  },
  async addSubject(userId: string, subject: Subject) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...list.filter(s => s.id !== subject.id), subject]));
    } catch {}

    try {
      const payload: any = mapSubjectToDB(userId, subject);
      let error: any = null;
      // Insert, dropping any column the live schema doesn't have yet
      // (schema-cache/migration lag) so the row is never lost entirely.
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabase.from('subjects').insert([payload]);
        error = res.error;
        if (!error) break;
        const missing = missingColumnFromError(error);
        if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
          console.warn(`subjects insert: dropping missing column '${missing}' and retrying.`);
          delete payload[missing];
          continue;
        }
        break;
      }
      if (error) {
        console.error('Error adding subject:', error);
        recordFailedWrite({
          userId, table: 'subjects', op: 'insert', payload,
          errorMessage: describeError(error)
        });
      } else {
        void flushPendingWrites(userId).catch(() => {});
      }
    } catch (err) {
      console.warn('Supabase addSubject fallback:', err);
      recordFailedWrite({
        userId, table: 'subjects', op: 'insert', payload: mapSubjectToDB(userId, subject),
        errorMessage: describeError(err)
      });
    }
  },
  async updateSubject(userId: string, id: string, subject: Partial<Subject>) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.map(s => s.id === id ? { ...s, ...subject } : s)));
    } catch {}

    try {
      const payload: any = {};
      if (subject.code !== undefined) payload.code = subject.code;
      if (subject.name !== undefined) payload.name = subject.name;
      if (subject.creditHours !== undefined) payload.credit_hours = subject.creditHours;
      if (subject.totalMarks !== undefined) payload.total_marks = subject.totalMarks;
      if (subject.yearIndex !== undefined) payload.year_index = subject.yearIndex;
      if (subject.semesterIndex !== undefined) payload.semester_index = subject.semesterIndex;
      if (subject.status !== undefined) payload.status = subject.status;
      if (subject.distributions !== undefined) payload.distributions = subject.distributions;
      if (subject.finalGradeLetter !== undefined) payload.final_grade_letter = subject.finalGradeLetter;
      if (subject.universityTemplateId !== undefined) payload.university_template_id = subject.universityTemplateId;
      if (subject.includeInGpa !== undefined) payload.include_in_gpa = subject.includeInGpa;

      let error: any = null;
      // Update, dropping any column the live schema doesn't have yet.
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabase.from('subjects').update(payload).eq('id', id).eq('user_id', userId);
        error = res.error;
        if (!error) break;
        const missing = missingColumnFromError(error);
        if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
          console.warn(`subjects update: dropping missing column '${missing}' and retrying.`);
          delete payload[missing];
          continue;
        }
        break;
      }
      if (error) {
        console.error('Error updating subject:', error);
        recordFailedWrite({
          userId, table: 'subjects', op: 'update', payload, matchId: id,
          errorMessage: describeError(error)
        });
      } else {
        void flushPendingWrites(userId).catch(() => {});
      }
    } catch (e) {
      console.warn('Supabase updateSubject error:', e);
      recordFailedWrite({
        userId, table: 'subjects', op: 'update',
        payload: mapSubjectToDB(userId, subject as Subject), matchId: id,
        errorMessage: describeError(e)
      });
    }
  },
  async deleteSubject(userId: string, id: string) {
    try {
      const key = `unistudent_subjects_${userId}`;
      const list: Subject[] = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(list.filter(s => s.id !== id)));
    } catch {}

    try {
      await resilientWrite('deleteSubject', () => supabase.from('subjects').delete().eq('id', id).eq('user_id', userId));
    } catch (e) {
      console.error('Error deleting subject:', e);
    }
  },
  async clearAllSubjects(userId: string) {
    try {
      localStorage.removeItem(`unistudent_subjects_${userId}`);
    } catch {}
    try {
      await supabase.from('subjects').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('Error clearing subjects in Supabase:', e);
    }
  },
  async clearAllDriveFiles(userId: string) {
    try {
      localStorage.removeItem(`unistudent_files_${userId}`);
    } catch {}
    try {
      await supabase.from('drive_files').delete().eq('user_id', userId);
    } catch (e) {
      console.warn('Error clearing drive files in Supabase:', e);
    }
  },

  // --- Tasks ---
  async getTasks(userId: string) {
    const rows = await cacheRead<any>(`unistudent_tasks_${userId}`, async () => {
      const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId);
      if (error) { console.error('Error fetching tasks:', error); return null; }
      return (data || []).map(mapTaskFromDB);
    });
    const extras = getEntityExtras(userId, 'tasks');
    return rows.map(task => {
      const extra = extras[task.id] || {};
      return {
        ...task,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : task.attachments,
        linkedNoteIds: (extra.linkedNoteIds && extra.linkedNoteIds.length > 0) ? extra.linkedNoteIds : task.linkedNoteIds,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : task.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : task.linkedSubjectIds,
      };
    });
  },
  async addTask(userId: string, task: Task) {
    saveEntityExtra(userId, 'tasks', task.id, {
      attachments: task.attachments || [],
      linkedNoteIds: task.linkedNoteIds || [],
      linkedFileIds: task.linkedFileIds || [],
      linkedSubjectIds: task.linkedSubjectIds || [],
    });
    await resilientWrite('addTask', () => supabase.from('tasks').insert([mapTaskToDB(userId, task)]), {
      userId, table: 'tasks', op: 'insert', payload: mapTaskToDB(userId, task)
    });
  },
  async updateTask(userId: string, id: string, task: Partial<Task>) {
    saveEntityExtra(userId, 'tasks', id, {
      ...(task.attachments !== undefined ? { attachments: task.attachments } : {}),
      ...(task.linkedNoteIds !== undefined ? { linkedNoteIds: task.linkedNoteIds } : {}),
      ...(task.linkedFileIds !== undefined ? { linkedFileIds: task.linkedFileIds } : {}),
      ...(task.linkedSubjectIds !== undefined ? { linkedSubjectIds: task.linkedSubjectIds } : {}),
    });
    const payload = mapTaskToDB(userId, task as Task);
    delete (payload as any).user_id;
    await resilientWrite('updateTask', () => supabase.from('tasks').update(payload).eq('id', id).eq('user_id', userId), {
      userId, table: 'tasks', op: 'update', payload, matchId: id
    });
  },
  async deleteTask(userId: string, id: string) {
    removeEntityExtra(userId, 'tasks', id);
    await resilientWrite('deleteTask', () => supabase.from('tasks').delete().eq('id', id).eq('user_id', userId), {
      userId, table: 'tasks', op: 'delete', matchId: id
    });
  },

  // --- Notes ---
  async getNotes(userId: string) {
    const rows = await cacheRead<any>(`unistudent_notes_${userId}`, async () => {
      const { data, error } = await supabase.from('notes').select('*').eq('user_id', userId);
      if (error) { console.error('Error fetching notes:', error); return null; }
      return (data || []).map(mapNoteFromDB);
    });
    const extras = getEntityExtras(userId, 'notes');
    return rows.map(note => {
      const extra = extras[note.id] || {};
      return {
        ...note,
        priority: extra.priority || note.priority,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : note.attachments,
        linkedTaskIds: (extra.linkedTaskIds && extra.linkedTaskIds.length > 0) ? extra.linkedTaskIds : note.linkedTaskIds,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : note.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : note.linkedSubjectIds,
      };
    });
  },
  async addNote(userId: string, note: Note) {
    saveEntityExtra(userId, 'notes', note.id, {
      priority: note.priority,
      attachments: note.attachments || [],
      linkedTaskIds: note.linkedTaskIds || [],
      linkedFileIds: note.linkedFileIds || [],
      linkedSubjectIds: note.linkedSubjectIds || [],
    });
    await resilientWrite('addNote', () => supabase.from('notes').insert([mapNoteToDB(userId, note)]), {
      userId, table: 'notes', op: 'insert', payload: mapNoteToDB(userId, note)
    });
  },
  async updateNote(userId: string, id: string, note: Partial<Note>) {
    saveEntityExtra(userId, 'notes', id, {
      ...(note.priority !== undefined ? { priority: note.priority } : {}),
      ...(note.attachments !== undefined ? { attachments: note.attachments } : {}),
      ...(note.linkedTaskIds !== undefined ? { linkedTaskIds: note.linkedTaskIds } : {}),
      ...(note.linkedFileIds !== undefined ? { linkedFileIds: note.linkedFileIds } : {}),
      ...(note.linkedSubjectIds !== undefined ? { linkedSubjectIds: note.linkedSubjectIds } : {}),
    });
    const payload = mapNoteToDB(userId, note as Note);
    delete (payload as any).user_id;
    await resilientWrite('updateNote', () => supabase.from('notes').update(payload).eq('id', id).eq('user_id', userId), {
      userId, table: 'notes', op: 'update', payload, matchId: id
    });
  },
  async deleteNote(userId: string, id: string) {
    removeEntityExtra(userId, 'notes', id);
    await resilientWrite('deleteNote', () => supabase.from('notes').delete().eq('id', id).eq('user_id', userId), {
      userId, table: 'notes', op: 'delete', matchId: id
    });
  },

  // --- Appointments ---
  async getAppointments(userId: string) {
    const rows = await cacheRead<any>(`unistudent_appointments_${userId}`, async () => {
      const { data, error } = await supabase.from('appointments').select('*').eq('user_id', userId);
      if (error) { console.error('Error fetching appointments:', error); return null; }
      return (data || []).map(mapAppointmentFromDB);
    });
    const extras = getEntityExtras(userId, 'appointments');
    return rows.map(appt => {
      const extra = extras[appt.id] || {};
      return {
        ...appt,
        priority: extra.priority || appt.priority,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : appt.attachments,
        linkedFileIds: (extra.linkedFileIds && extra.linkedFileIds.length > 0) ? extra.linkedFileIds : appt.linkedFileIds,
        linkedSubjectIds: (extra.linkedSubjectIds && extra.linkedSubjectIds.length > 0) ? extra.linkedSubjectIds : appt.linkedSubjectIds,
      };
    });
  },
  async addAppointment(userId: string, appointment: Appointment) {
    saveEntityExtra(userId, 'appointments', appointment.id, {
      priority: appointment.priority,
      attachments: appointment.attachments || [],
      linkedFileIds: appointment.linkedFileIds || [],
      linkedSubjectIds: appointment.linkedSubjectIds || [],
    });
    await resilientWrite('addAppointment', () => supabase.from('appointments').insert([mapAppointmentToDB(userId, appointment)]), {
      userId, table: 'appointments', op: 'insert', payload: mapAppointmentToDB(userId, appointment)
    });
  },
  async updateAppointment(userId: string, id: string, appointment: Partial<Appointment>) {
    saveEntityExtra(userId, 'appointments', id, {
      ...(appointment.priority !== undefined ? { priority: appointment.priority } : {}),
      ...(appointment.attachments !== undefined ? { attachments: appointment.attachments } : {}),
      ...(appointment.linkedFileIds !== undefined ? { linkedFileIds: appointment.linkedFileIds } : {}),
      ...(appointment.linkedSubjectIds !== undefined ? { linkedSubjectIds: appointment.linkedSubjectIds } : {}),
    });
    const payload = mapAppointmentToDB(userId, appointment as Appointment);
    delete (payload as any).user_id;
    await resilientWrite('updateAppointment', () => supabase.from('appointments').update(payload).eq('id', id).eq('user_id', userId), {
      userId, table: 'appointments', op: 'update', payload, matchId: id
    });
  },
  async deleteAppointment(userId: string, id: string) {
    removeEntityExtra(userId, 'appointments', id);
    await resilientWrite('deleteAppointment', () => supabase.from('appointments').delete().eq('id', id).eq('user_id', userId), {
      userId, table: 'appointments', op: 'delete', matchId: id
    });
  },

  // --- Schedule Items ---
  async getScheduleItems(userId: string) {
    const rows = await cacheRead<any>(`unistudent_schedule_items_${userId}`, async () => {
      const { data, error } = await supabase.from('schedule_items').select('*').eq('user_id', userId);
      if (error) { console.error('Error fetching schedule_items:', error); return null; }
      return (data || []).map(mapScheduleItemFromDB);
    });
    const extras = getEntityExtras(userId, 'schedule_items');
    return rows.map(item => {
      const extra = extras[item.id] || {};
      return {
        ...item,
        priority: extra.priority || item.priority,
        groupId: extra.groupId !== undefined ? extra.groupId : item.groupId,
        attachments: (extra.attachments && extra.attachments.length > 0) ? extra.attachments : item.attachments,
      };
    });
  },
  async addScheduleItem(userId: string, item: ScheduleItem) {
    saveEntityExtra(userId, 'schedule_items', item.id, {
      priority: item.priority,
      groupId: item.groupId,
      attachments: item.attachments || [],
    });
    const payload = mapScheduleItemToDB(userId, item);
    // Insert, dropping any column the live schema doesn't have yet
    // (schema-cache/migration lag) so the item is never lost entirely.
    let error: any = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await supabase.from('schedule_items').insert([payload]);
      error = res.error;
      if (!error) break;
      const missing = missingColumnFromError(error);
      if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
        console.warn(`schedule_items insert: dropping missing column '${missing}' and retrying.`);
        delete payload[missing];
        continue;
      }
      break;
    }
    if (error) {
      console.error('Error adding schedule_item:', error);
      recordFailedWrite({
        userId, table: 'schedule_items', op: 'insert', payload,
        errorMessage: describeError(error)
      });
    } else {
      void flushPendingWrites(userId).catch(() => {});
    }
  },
  async updateScheduleItem(userId: string, id: string, item: Partial<ScheduleItem>) {
    saveEntityExtra(userId, 'schedule_items', id, {
      ...(item.priority !== undefined ? { priority: item.priority } : {}),
      ...(item.groupId !== undefined ? { groupId: item.groupId } : {}),
      ...(item.attachments !== undefined ? { attachments: item.attachments } : {}),
    });
    const payload = mapScheduleItemToDB(userId, item as ScheduleItem);
    delete (payload as any).user_id;

    let error: any = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await supabase.from('schedule_items').update(payload).eq('id', id).eq('user_id', userId);
      error = res.error;
      if (!error) break;
      const missing = missingColumnFromError(error);
      if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
        console.warn(`schedule_items update: dropping missing column '${missing}' and retrying.`);
        delete payload[missing];
        continue;
      }
      break;
    }
    if (error) {
      console.error('Error updating schedule_item:', error);
      recordFailedWrite({
        userId, table: 'schedule_items', op: 'update', payload, matchId: id,
        errorMessage: describeError(error)
      });
    } else {
      void flushPendingWrites(userId).catch(() => {});
    }
  },
  async deleteScheduleItem(userId: string, id: string) {
    removeEntityExtra(userId, 'schedule_items', id);
    await resilientWrite('deleteScheduleItem', () => supabase.from('schedule_items').delete().eq('id', id).eq('user_id', userId), {
      userId, table: 'schedule_items', op: 'delete', matchId: id
    });
  },

  // --- Groups ---
  async getGroups(userId: string) {
    const { data, error } = await supabase.from('groups').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching groups:', error);
    return data || [];
  },
  async addGroup(userId: string, group: Group) {
    const { error } = await supabase.from('groups').insert([{ ...group, user_id: userId }]);
    if (error) {
      console.error('Error adding group:', error);
      throw error;
    }
  },
  async updateGroup(userId: string, id: string, group: Partial<Group>) {
    const { error } = await supabase.from('groups').update(group).eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  },
  async deleteGroup(userId: string, id: string) {
    const { error } = await supabase.from('groups').delete().eq('id', id).eq('user_id', userId);
    if (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  },

  // --- Drive Files ---
  async getDriveFiles(userId: string) {
    const { data, error } = await supabase.from('drive_files').select('*').eq('user_id', userId);
    if (error) console.error('Error fetching drive_files:', error);
    return (data || []).map(mapDriveFileFromDB);
  },
  async addDriveFile(userId: string, file: DriveFile & { b2FileId?: string }) {
    const baseRow: any = {
      id: file.id,
      user_id: userId,
      name: file.name,
      size: file.size,
      type: file.type,
      url: file.url || '',
      upload_date: file.createdAt,
      b2_file_id: file.b2FileId,
      parent_id: file.parentId || null
    };
    const phaseRow = {
      ...baseRow,
      year_index: file.yearIndex ?? null,
      semester_index: file.semesterIndex ?? null
    };

    // Primary insert includes the phase columns. If the database schema predates
    // the 202609060004 migration (columns missing), PostgREST rejects the whole
    // insert — retry once without them so uploads never silently vanish.
    let res = await supabase.from('drive_files').insert([phaseRow]);
    if (res.error && (res.error as any).code === 'PGRST204') {
      console.warn('drive_files phase columns missing (apply migration 202609060004). Retrying without them.');
      res = await supabase.from('drive_files').insert([baseRow]);
    }
    if (res.error) {
      console.error('Error adding drive_file:', res.error);
      recordFailedWrite({
        userId, table: 'drive_files', op: 'insert', payload: baseRow,
        errorMessage: describeError(res.error)
      });
    } else {
      void flushPendingWrites(userId).catch(() => {});
    }
  },
  async updateDriveFile(userId: string, id: string, file: Partial<DriveFile>) {
    const payload: any = {};
    if (file.name !== undefined) payload.name = file.name;
    if (file.parentId !== undefined) payload.parent_id = file.parentId;
    if (file.url !== undefined) payload.url = file.url;
    if (file.yearIndex !== undefined) payload.year_index = file.yearIndex;
    if (file.semesterIndex !== undefined) payload.semester_index = file.semesterIndex;

    await resilientWrite('updateDriveFile', () =>
      supabase.from('drive_files').update(payload).eq('id', id).eq('user_id', userId),
      { userId, table: 'drive_files', op: 'update', payload, matchId: id }
    );
  },
  async deleteDriveFile(userId: string, id: string) {
    await resilientWrite('deleteDriveFile', () =>
      supabase.from('drive_files').delete().eq('id', id).eq('user_id', userId),
      { userId, table: 'drive_files', op: 'delete', matchId: id }
    );
  },

  // --- Feedback & Suggestions ---
  async addFeedback(feedback: FeedbackSuggestion) {
    try {
      // 1. Sanitize attachments for localStorage to avoid 5MB quota exhaustion
      const sanitizedAttachments = (feedback.attachments || []).map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        type: a.type,
        url: a.url?.startsWith('data:') && a.url.length > 50000 ? '' : a.url,
        b2FileId: (a as any).b2FileId || (a as any).b2_file_id
      }));
      const cachedFeedback = { ...feedback, attachments: sanitizedAttachments };

      const allKey = 'unistudent_all_suggestions';
      const existingAll: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const updatedAll = [cachedFeedback, ...existingAll.filter(f => f.id !== feedback.id)];
      localStorage.setItem(allKey, JSON.stringify(updatedAll.slice(0, 100)));

      const userKey = `unistudent_user_suggestions_${feedback.userId}`;
      const existingUser: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(userKey) || '[]');
      localStorage.setItem(userKey, JSON.stringify([cachedFeedback, ...existingUser.filter(f => f.id !== feedback.id)].slice(0, 50)));
    } catch (e) {
      console.warn('LocalStorage error in addFeedback:', e);
    }

    try {
      const payload = {
        id: feedback.id,
        user_id: feedback.userId,
        user_email: feedback.userEmail,
        user_name: feedback.userName || '',
        type: feedback.type,
        title: feedback.title,
        content: feedback.content,
        attachments: (feedback.attachments || []).map(a => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
          url: a.url?.startsWith('data:') && a.url.length > 200000 ? '' : a.url,
          b2FileId: (a as any).b2FileId || (a as any).b2_file_id
        })),
        created_at: feedback.createdAt,
        status: feedback.status,
        admin_notes: feedback.adminNotes || ''
      };
      await supabase.from('suggestions').insert([payload]);
    } catch (err) {
      console.warn('Supabase suggestions insert note:', err);
    }
  },

  async getUserFeedbacks(userId: string): Promise<FeedbackSuggestion[]> {
    try {
      const { data, error } = await supabase.from('suggestions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email || '',
          userName: row.user_name || '',
          type: row.type || 'suggestion',
          title: row.title || '',
          content: row.content || '',
          attachments: (row.attachments || []).map((a: any) => ({
            id: a.id || a.name,
            name: a.name,
            size: a.size || 0,
            type: a.type || '',
            url: a.url || '',
            b2FileId: a.b2FileId || a.b2_file_id
          })),
          createdAt: row.created_at || new Date().toISOString(),
          status: row.status || 'new',
          adminNotes: row.admin_notes || ''
        }));
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem(`unistudent_user_suggestions_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  },

  async getAllFeedbacks(): Promise<FeedbackSuggestion[]> {
    try {
      const { data, error } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          userId: row.user_id,
          userEmail: row.user_email || '',
          userName: row.user_name || '',
          type: row.type || 'suggestion',
          title: row.title || '',
          content: row.content || '',
          attachments: (row.attachments || []).map((a: any) => ({
            id: a.id || a.name,
            name: a.name,
            size: a.size || 0,
            type: a.type || '',
            url: a.url || '',
            b2FileId: a.b2FileId || a.b2_file_id
          })),
          createdAt: row.created_at || new Date().toISOString(),
          status: row.status || 'new',
          adminNotes: row.admin_notes || ''
        }));
      }
    } catch (e) {}

    try {
      const cached = localStorage.getItem('unistudent_all_suggestions');
      if (cached) return JSON.parse(cached);
    } catch {}

    return [];
  },

  async updateFeedback(id: string, updates: Partial<FeedbackSuggestion>) {
    try {
      const allKey = 'unistudent_all_suggestions';
      const list: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const updated = list.map(item => item.id === id ? { ...item, ...updates } : item);
      localStorage.setItem(allKey, JSON.stringify(updated));

      // Also update user cache if exists
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_user_suggestions_')) {
          try {
            const uList: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(key) || '[]');
            if (uList.some(f => f.id === id)) {
              localStorage.setItem(key, JSON.stringify(uList.map(item => item.id === id ? { ...item, ...updates } : item)));
            }
          } catch {}
        }
      }
    } catch {}

    try {
      const payload: any = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.content !== undefined) payload.content = updates.content;
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.status !== undefined) payload.status = updates.status;
      if (updates.attachments !== undefined) {
        payload.attachments = (updates.attachments || []).map(a => ({
          id: a.id,
          name: a.name,
          size: a.size,
          type: a.type,
          url: a.url?.startsWith('data:') && a.url.length > 200000 ? '' : a.url,
          b2FileId: (a as any).b2FileId || (a as any).b2_file_id
        }));
      }
      if (updates.adminNotes !== undefined) payload.admin_notes = updates.adminNotes;
      await supabase.from('suggestions').update(payload).eq('id', id);
    } catch (e) {
      console.warn('Supabase update feedback note:', e);
    }
  },

  async deleteFeedback(id: string) {
    try {
      // Find feedback to extract all attachment B2 keys before deleting
      const allKey = 'unistudent_all_suggestions';
      const list: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(allKey) || '[]');
      const targetLocal = list.find(f => f.id === id);

      let attachmentsToDelete: any[] = targetLocal?.attachments || [];
      if ((targetLocal as any)?.attachment_url) {
        attachmentsToDelete.push({ url: (targetLocal as any).attachment_url });
      }

      // Also check supabase if online
      try {
        const { data } = await supabase.from('suggestions').select('attachments, attachment_url').eq('id', id).single();
        if (data) {
          if (Array.isArray(data.attachments)) {
            attachmentsToDelete.push(...data.attachments);
          }
          if (data.attachment_url) {
            attachmentsToDelete.push({ url: data.attachment_url });
          }
        }
      } catch {}

      if (attachmentsToDelete.length > 0) {
        import('./backblaze').then(({ deleteMultipleFromB2, extractB2KeyFromUrl }) => {
          const keys = attachmentsToDelete
            .map(a => a.b2FileId || (a as any).b2_file_id || extractB2KeyFromUrl(a.url))
            .filter(Boolean);
          if (keys.length > 0) {
            deleteMultipleFromB2(keys).catch(console.error);
          }
        }).catch(console.error);
      }

      localStorage.setItem(allKey, JSON.stringify(list.filter(f => f.id !== id)));

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_user_suggestions_')) {
          try {
            const uList: FeedbackSuggestion[] = JSON.parse(localStorage.getItem(key) || '[]');
            localStorage.setItem(key, JSON.stringify(uList.filter(f => f.id !== id)));
          } catch {}
        }
      }
    } catch {}

    try {
      await supabase.from('suggestions').delete().eq('id', id);
    } catch (e) {}
  },

  // --- University Databases ---
  async getUniversityDatabases(): Promise<UniversityDatabase[]> {
    try {
      const { data, error } = await supabase.from('university_databases').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const mapped = data.map(d => mapUniversityDatabaseFromDB(d));
        try {
          localStorage.setItem('unistudent_university_databases', JSON.stringify(mapped));
        } catch {}
        return mapped;
      }
    } catch (e) {
      console.warn('Supabase getUniversityDatabases warning:', e);
    }
    try {
      const local = localStorage.getItem('unistudent_university_databases');
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  async getUniversityDatabase(id: string): Promise<UniversityDatabase | null> {
    try {
      const { data, error } = await supabase
        .from('university_databases')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (!error && data) {
        const mapped = mapUniversityDatabaseFromDB(data);
        try {
          const current = await this.getUniversityDatabases();
          const updated = [mapped, ...current.filter(u => u.id !== id)];
          localStorage.setItem('unistudent_university_databases', JSON.stringify(updated));
        } catch {}
        return mapped;
      }
    } catch (e) {
      console.warn('Direct fetch getUniversityDatabase failed, falling back:', e);
    }
    const list = await this.getUniversityDatabases();
    return list.find(u => u.id === id) || null;
  },

  async createUniversityDatabase(dbData: UniversityDatabase): Promise<void> {
    // 1. Local storage cache
    try {
      const current = await this.getUniversityDatabases();
      const updated = [dbData, ...current.filter(u => u.id !== dbData.id)];
      localStorage.setItem('unistudent_university_databases', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage error in createUniversityDatabase:', e);
    }

    // 2. Supabase insert/upsert
    try {
      let gradingScalePayload = dbData.gradingScale ? [...dbData.gradingScale] : [];
      gradingScalePayload = gradingScalePayload.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))));
      if (dbData.isSpecialization) {
        gradingScalePayload.push({
          id: '__spec_meta__',
          isSpecialization: true,
          parentDatabaseId: dbData.parentDatabaseId,
          specializationNameAr: dbData.specializationNameAr,
          specializationNameEn: dbData.specializationNameEn,
          specializationStartYear: dbData.specializationStartYear,
          specializationStartSemester: dbData.specializationStartSemester,
          availableYears: dbData.availableYears,
        } as any);
      } else {
        gradingScalePayload.push({
          id: '__college_meta__',
          isSpecialization: false,
          availableYears: dbData.availableYears,
          specializationStartYear: dbData.specializationStartYear,
          specializationStartSemester: dbData.specializationStartSemester,
        } as any);
      }

      const payload: any = {
        id: dbData.id,
        university_name_ar: dbData.universityNameAr,
        university_name_en: dbData.universityNameEn,
        college_name_ar: dbData.collegeNameAr,
        college_name_en: dbData.collegeNameEn,
        source_user_id: dbData.sourceUserId,
        source_user_email: dbData.sourceUserEmail || '',
        source_user_name: dbData.sourceUserName || '',
        total_years: dbData.totalYears,
        semesters_per_year: dbData.semestersPerYear,
        available_years: dbData.availableYears || [1],
        specialization_start_year: dbData.specializationStartYear || 2,
        specialization_start_semester: dbData.specializationStartSemester || 1,
        subjects: dbData.subjects,
        drive_files: dbData.driveFiles,
        grading_scale: gradingScalePayload,
        is_visible: dbData.isVisible !== false,
        created_at: dbData.createdAt,
        updated_at: dbData.updatedAt
      };

      if (dbData.isSpecialization) {
        payload.is_specialization = true;
        payload.parent_database_id = dbData.parentDatabaseId || null;
        payload.specialization_name_ar = dbData.specializationNameAr || null;
        payload.specialization_name_en = dbData.specializationNameEn || null;
        payload.specialization_start_year = dbData.specializationStartYear || 2;
        payload.specialization_start_semester = dbData.specializationStartSemester || 1;
      }

      const { error } = await supabase.from('university_databases').upsert(payload);
      if (error) {
        if (error.message && (error.message.includes('column') || error.message.includes('does not exist'))) {
          delete payload.is_specialization;
          delete payload.parent_database_id;
          delete payload.specialization_name_ar;
          delete payload.specialization_name_en;
          delete payload.specialization_start_year;
          delete payload.specialization_start_semester;
          delete payload.available_years;
          const { error: retryErr } = await supabase.from('university_databases').upsert(payload);
          if (retryErr) console.warn('Supabase createUniversityDatabase fallback error:', retryErr);
        } else {
          console.warn('Supabase createUniversityDatabase error:', error);
        }
      }
    } catch (e) {
      console.warn('Supabase createUniversityDatabase failed:', e);
    }
  },

  async updateUniversityDatabase(id: string, partialData: Partial<UniversityDatabase>): Promise<void> {
    const updatedAt = new Date().toISOString();
    let cachedDatabases: UniversityDatabase[] = [];

    // 1. Local-first: immediately update localStorage cache
    try {
      cachedDatabases = await this.getUniversityDatabases();
      const targetIndex = cachedDatabases.findIndex(d => d.id === id);
      if (targetIndex >= 0) {
        cachedDatabases[targetIndex] = {
          ...cachedDatabases[targetIndex],
          ...partialData,
          updatedAt
        };
        localStorage.setItem('unistudent_university_databases', JSON.stringify(cachedDatabases));
      }
    } catch (localErr) {
      console.warn('LocalStorage updateUniversityDatabase warning:', localErr);
    }

    // 2. Persist to Supabase
    try {
      const existing = cachedDatabases.find(database => database.id === id) || ({} as any);
      const full = { ...existing, ...partialData };

      const isSpec = full.isSpecialization !== undefined ? full.isSpecialization : existing.isSpecialization;
      let scale = full.gradingScale !== undefined ? [...full.gradingScale] : [...(existing.gradingScale || [])];
      scale = scale.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))));

      if (isSpec) {
        scale.push({
          id: '__spec_meta__',
          isSpecialization: true,
          parentDatabaseId: full.parentDatabaseId !== undefined ? full.parentDatabaseId : existing.parentDatabaseId,
          specializationNameAr: full.specializationNameAr !== undefined ? full.specializationNameAr : existing.specializationNameAr,
          specializationNameEn: full.specializationNameEn !== undefined ? full.specializationNameEn : existing.specializationNameEn,
          specializationStartYear: full.specializationStartYear !== undefined ? full.specializationStartYear : existing.specializationStartYear,
          specializationStartSemester: full.specializationStartSemester !== undefined ? full.specializationStartSemester : existing.specializationStartSemester,
          availableYears: full.availableYears !== undefined ? full.availableYears : existing.availableYears,
        } as any);
      } else {
        scale.push({
          id: '__college_meta__',
          isSpecialization: false,
          availableYears: full.availableYears !== undefined ? full.availableYears : existing.availableYears,
          specializationStartYear: full.specializationStartYear !== undefined ? full.specializationStartYear : existing.specializationStartYear,
          specializationStartSemester: full.specializationStartSemester !== undefined ? full.specializationStartSemester : existing.specializationStartSemester,
        } as any);
      }

      const payload: any = {
        id,
        university_name_ar: full.universityNameAr || existing.universityNameAr || '',
        university_name_en: full.universityNameEn || existing.universityNameEn || null,
        college_name_ar: full.collegeNameAr || existing.collegeNameAr || '',
        college_name_en: full.collegeNameEn || existing.collegeNameEn || null,
        source_user_id: full.sourceUserId || existing.sourceUserId || null,
        source_user_name: full.sourceUserName || existing.sourceUserName || '',
        source_user_email: full.sourceUserEmail || existing.sourceUserEmail || '',
        total_years: Number(full.totalYears || existing.totalYears || 4),
        semesters_per_year: Number(full.semestersPerYear || existing.semestersPerYear || 2),
        subjects: full.subjects !== undefined ? full.subjects : (existing.subjects || []),
        drive_files: full.driveFiles !== undefined ? full.driveFiles : (existing.driveFiles || []),
        grading_scale: scale,
        is_visible: full.isVisible !== false,
        available_years: full.availableYears || existing.availableYears || [1],
        specialization_start_year: Number(full.specializationStartYear || existing.specializationStartYear || 2),
        specialization_start_semester: Number(full.specializationStartSemester || existing.specializationStartSemester || 1),
        updated_at: updatedAt
      };

      if (isSpec) {
        payload.is_specialization = true;
        payload.parent_database_id = full.parentDatabaseId || existing.parentDatabaseId || null;
        payload.specialization_name_ar = full.specializationNameAr || existing.specializationNameAr || null;
        payload.specialization_name_en = full.specializationNameEn || existing.specializationNameEn || null;
      }

      // Try update first
      let updateRes = await supabase
        .from('university_databases')
        .update(payload)
        .eq('id', id);

      if (updateRes.error && updateRes.error.message && (updateRes.error.message.includes('column') || updateRes.error.message.includes('does not exist'))) {
        delete payload.is_specialization;
        delete payload.parent_database_id;
        delete payload.specialization_name_ar;
        delete payload.specialization_name_en;
        delete payload.specialization_start_year;
        delete payload.specialization_start_semester;
        delete payload.available_years;
        updateRes = await supabase
          .from('university_databases')
          .update(payload)
          .eq('id', id);
      }

      // If update had issues or row didn't exist yet, try upsert
      if (updateRes.error) {
        const upsertRes = await supabase
          .from('university_databases')
          .upsert(payload, { onConflict: 'id' });
        if (upsertRes.error) {
          console.warn('Supabase updateUniversityDatabase fallback error:', upsertRes.error);
        }
      }
    } catch (e) {
      console.warn('Supabase updateUniversityDatabase warning:', e);
    }

    // 3. Robust broadcast to all active student clients
    await broadcastUniversityDatabaseUpdate({ id, timestamp: Date.now() });
  },

  async deleteUniversityDatabase(id: string): Promise<void> {
    try {
      const current = await this.getUniversityDatabases();
      const targetDb = current.find(u => u.id === id);
      const remaining = current.filter(u => u.id !== id && u.parentDatabaseId !== id);
      const toDelete = current.filter(u => u.id === id || u.parentDatabaseId === id);
      localStorage.setItem('unistudent_university_databases', JSON.stringify(remaining));

      for (const item of toDelete) {
        await supabase.from('university_databases').delete().eq('id', item.id);
      }

      // Cascade cleanup for affected students:
      if (targetDb) {
        if (targetDb.isSpecialization) {
          // Specialization Deleted: detach explicitly-linked students and remove
          // only the specialization's template-derived items. Name matching is
          // NEVER used — students who merely typed the spec name stay untouched.
          try {
            const { data: affectedSettings } = await supabase
              .from('settings')
              .select('user_id')
              .eq('specialization_database_id', targetDb.id);

            const affectedUserIds = (affectedSettings || []).map(s => s.user_id);

            const templateSubjIds = new Set((targetDb.subjects || []).map(s => s.id));
            const templateFileIds = new Set((targetDb.driveFiles || []).map(f => f.id));

            for (const uId of affectedUserIds) {
              const { data: userSubjs } = await supabase
                .from('subjects')
                .select('id, university_template_id')
                .eq('user_id', uId);

              for (const s of (userSubjs || [])) {
                if (s.university_template_id && templateSubjIds.has(s.university_template_id)) {
                  await supabase.from('subjects').delete().eq('id', s.id);
                }
              }

              const { data: userFiles } = await supabase
                .from('drive_files')
                .select('id, university_template_id')
                .eq('user_id', uId);

              for (const f of (userFiles || [])) {
                if (f.university_template_id && templateFileIds.has(f.university_template_id)) {
                  await supabase.from('drive_files').delete().eq('id', f.id);
                }
              }

              await supabase.from('settings').update({
                specialization: null,
                specialization_database_id: null
              }).eq('user_id', uId);
            }
          } catch (specErr) {
            console.warn('Error cascading specialization deletion to students:', specErr);
          }

          // Broadcast to active student sessions
          await broadcastUniversityDatabaseUpdate({
            action: 'deleted',
            type: 'specialization',
            id: targetDb.id,
            parentCollegeId: targetDb.parentDatabaseId
          });
        } else {
          // General College Deleted: detach explicitly-linked students (and
          // students linked to its child specializations) and remove ONLY the
          // template-derived curriculum/files imported from the deleted
          // databases. The student's own data is never touched, and names are
          // never reset — matching by name is not used at all.
          const childSpecs = current.filter(u => u.parentDatabaseId === targetDb.id);
          const allTargetIds = [targetDb.id, ...childSpecs.map(c => c.id)];

          try {
            const { data: affectedSettings } = await supabase
              .from('settings')
              .select('user_id')
              .in('university_database_id', allTargetIds);

            const affectedUserIds = (affectedSettings || []).map(s => s.user_id);

            // Also include students linked to any of the child specializations
            try {
              const { data: specLinked } = await supabase
                .from('settings')
                .select('user_id')
                .in('specialization_database_id', allTargetIds);
              (specLinked || []).forEach(b => {
                if (!affectedUserIds.includes(b.user_id)) affectedUserIds.push(b.user_id);
              });
            } catch {}

            const templateSubjIds = new Set<string>();
            const templateFileIds = new Set<string>();
            for (const dbItem of [targetDb, ...childSpecs]) {
              (dbItem.subjects || []).forEach(s => { if (s.id) templateSubjIds.add(s.id); });
              (dbItem.driveFiles || []).forEach(f => { if (f.id) templateFileIds.add(f.id); });
            }

            for (const uId of affectedUserIds) {
              const { data: userSubjs } = await supabase
                .from('subjects')
                .select('id, university_template_id')
                .eq('user_id', uId);

              for (const s of (userSubjs || [])) {
                if (s.university_template_id && templateSubjIds.has(s.university_template_id)) {
                  await supabase.from('subjects').delete().eq('id', s.id);
                }
              }

              const { data: userFiles } = await supabase
                .from('drive_files')
                .select('id, university_template_id')
                .eq('user_id', uId);

              for (const f of (userFiles || [])) {
                if (f.university_template_id && templateFileIds.has(f.university_template_id)) {
                  await supabase.from('drive_files').delete().eq('id', f.id);
                }
              }

              await supabase.from('settings').update({
                university_database_id: null,
                specialization: null,
                specialization_database_id: null
              }).eq('user_id', uId);
            }
          } catch (colErr) {
            console.warn('Error cascading college deletion to students:', colErr);
          }

          // Broadcast to active student sessions
          await broadcastUniversityDatabaseUpdate({
            action: 'deleted',
            type: 'college',
            id: targetDb.id,
            collegeNameAr: targetDb.collegeNameAr,
            childSpecIds: childSpecs.map(c => c.id)
          });
        }
      }
    } catch (e) {
      console.warn('Supabase deleteUniversityDatabase failed:', e);
    }
  },

  async getSpecializationsForCollege(parentCollegeDbId: string): Promise<UniversityDatabase[]> {
    const all = await this.getUniversityDatabases();
    return all.filter(d => d.isSpecialization && d.parentDatabaseId === parentCollegeDbId);
  },

  async getRegisteredCollegesWithSpecializations(): Promise<{
    college: UniversityDatabase;
    specializations: UniversityDatabase[];
  }[]> {
    const all = await this.getUniversityDatabases();
    const colleges = all.filter(d => !d.isSpecialization);
    const specializations = all.filter(d => d.isSpecialization);
    return colleges.map(college => ({
      college,
      specializations: specializations.filter(s => s.parentDatabaseId === college.id)
    }));
  },

  async getStudentsWithSpecialization(
    collegeName: string, 
    specializationName?: string,
    sourceUserId?: string,
    existingStudentsList?: any[],
    collegeDbId?: string
  ): Promise<Array<{
    userId: string;
    name: string;
    email: string;
    university: string;
    college: string;
    specialization?: string;
    specializationStartYear?: number;
    specializationStartSemester?: number;
    subjectsCount: number;
    subjects: Subject[];
    matchesSpecPreference: boolean;
    isCollegeSource?: boolean;
  }>> {
    const norm = (str?: string) => normalizeSubjectName(str);
    const targetCol = norm(collegeName);

    const settingsMap = new Map<string, any>();

    // Seed from existingStudentsList if passed
    if (existingStudentsList && Array.isArray(existingStudentsList)) {
      for (const st of existingStudentsList) {
        const uid = st.id || st.userId;
        if (uid) {
          settingsMap.set(uid, {
            user_id: uid,
            name: st.name,
            email: st.email,
            university: st.university,
            college: st.college,
            specialization: st.specialization,
            specializationStartYear: st.specializationStartYear || st.specialization_start_year,
            specializationStartSemester: st.specializationStartSemester || st.specialization_start_semester,
            universityDatabaseId: st.universityDatabaseId || st.university_database_id || '',
            specializationDatabaseId: st.specializationDatabaseId || st.specialization_database_id || '',
            subjects: st.subjects || st.raw?.subjects || []
          });
        }
      }
    }

    try {
      const { data: dbSettings } = await supabase.from('settings').select('*');
      if (dbSettings) {
        dbSettings.forEach(s => {
          if (s.user_id) {
            const existing = settingsMap.get(s.user_id) || {};
            const specMeta = Array.isArray(s.grading_scale)
              ? s.grading_scale.find((g: any) => g && g.id === '__student_spec_meta__')
              : null;
            settingsMap.set(s.user_id, {
              ...existing,
              ...s,
              name: s.name || existing.name || '',
              email: s.email || existing.email || '',
              university: s.university || existing.university || '',
              college: s.college || existing.college || '',
              specialization: s.specialization || existing.specialization || specMeta?.specialization || '',
              specializationStartYear: s.specialization_start_year || existing.specializationStartYear || specMeta?.specializationStartYear || 2,
              specializationStartSemester: s.specialization_start_semester || existing.specializationStartSemester || specMeta?.specializationStartSemester || 1,
              specializationDatabaseId: s.specialization_database_id || existing.specializationDatabaseId || specMeta?.specializationDatabaseId || '',
              universityDatabaseId: s.university_database_id || existing.universityDatabaseId || '',
              subjects: (existing.subjects && existing.subjects.length > 0) ? existing.subjects : []
            });
          }
        });
      }
    } catch {}

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('unistudent_settings_')) {
        const uid = key.replace('unistudent_settings_', '');
        try {
          const st = JSON.parse(localStorage.getItem(key) || '{}');
          if (st) {
            const existing = settingsMap.get(uid) || {};
            settingsMap.set(uid, {
              ...existing,
              ...st,
              user_id: uid,
              specialization: st.specialization || existing.specialization || '',
              specializationStartYear: st.specializationStartYear || existing.specializationStartYear || 2,
              specializationStartSemester: st.specializationStartSemester || existing.specializationStartSemester || 1,
              specializationDatabaseId: st.specializationDatabaseId || existing.specializationDatabaseId || ''
            });
          }
        } catch {}
      }
    }

    const matchingStudents: any[] = [];
    for (const [uid, s] of settingsMap.entries()) {
      const isSourceUser = Boolean(sourceUserId && uid === sourceUserId);
      const studentCol = norm(s.college);
      const studentUniDbId = String(s.universityDatabaseId || s.university_database_id || '');

      // Explicit-ID linking ONLY when the database id is known: a student who
      // merely typed the college name (no restore / no pull) must never appear
      // as linked. Name matching remains only as a legacy fallback.
      const isColMatch = isSourceUser || (collegeDbId
        ? studentUniDbId === collegeDbId
        : (!targetCol || (studentCol && (studentCol === targetCol || studentCol.includes(targetCol) || targetCol.includes(studentCol)))));
      if (!isColMatch) continue;

      const studentSpec = s.specialization || '';
      const normSpec = norm(studentSpec);
      const targetSpec = specializationName ? norm(specializationName) : '';

      const matchesSpec = isSourceUser || !targetSpec || (normSpec && (normSpec === targetSpec || normSpec.includes(targetSpec) || targetSpec.includes(normSpec)));

      let studentSubjects: Subject[] = Array.isArray(s.subjects) && s.subjects.length > 0 ? s.subjects : [];
      if (studentSubjects.length === 0) {
        try {
          studentSubjects = await this.getSubjects(uid);
        } catch {}
      }

      const savedEmail = localStorage.getItem(`unistudent_user_email_${uid}`) || '';
      const email = s.email || savedEmail || '';

      const stuStartYr = Number(s.specializationStartYear || s.specialization_start_year || 2);
      const stuStartSem = Number(s.specializationStartSemester || s.specialization_start_semester || 1);
      const specSubjectsCount = (studentSubjects || []).filter(sub => {
        const y = Number(sub.yearIndex || 1);
        const sem = Number(sub.semesterIndex || 1);
        return y > stuStartYr || (y === stuStartYr && sem >= stuStartSem);
      }).length;

      const stuCurrentSem = (s.semesters || []).find((sem: any) => sem && sem.isCurrent);

      matchingStudents.push({
        userId: uid,
        name: s.name || 'طالب',
        email,
        university: s.university || '',
        college: s.college || '',
        specialization: studentSpec,
        specializationStartYear: stuStartYr,
        specializationStartSemester: stuStartSem,
        currentYear: Number(stuCurrentSem?.yearIndex || 1),
        currentSemester: Number(stuCurrentSem?.semesterIndex || 1),
        subjectsCount: studentSubjects.length,
        specSubjectsCount,
        subjects: studentSubjects,
        matchesSpecPreference: Boolean(matchesSpec),
        isCollegeSource: isSourceUser
      });
    }

    return matchingStudents.sort((a, b) => {
      if (a.isCollegeSource && !b.isCollegeSource) return -1;
      if (!a.isCollegeSource && b.isCollegeSource) return 1;
      if (a.matchesSpecPreference && !b.matchesSpecPreference) return -1;
      if (!a.matchesSpecPreference && b.matchesSpecPreference) return 1;
      return b.subjectsCount - a.subjectsCount;
    });
  },

  async createSpecializationDatabase(params: {
    parentCollegeDbId: string;
    specializationNameAr: string;
    specializationNameEn?: string;
    specializationStartYear: number;
    specializationStartSemester: number;
    sourceUserId: string;
    sourceUserEmail?: string;
    sourceUserName?: string;
    availableYears?: number[];
    subjects?: Subject[];
    driveFiles?: DriveFile[];
  }): Promise<UniversityDatabase> {
    const parentDb = await this.getUniversityDatabase(params.parentCollegeDbId);
    if (!parentDb) {
      throw new Error('لم يتم العثور على قاعدة بيانات الكلية التابعة.');
    }

    let rawSubjects = params.subjects;
    if (!rawSubjects || rawSubjects.length === 0) {
      try {
        rawSubjects = await this.getSubjects(params.sourceUserId);
      } catch {
        rawSubjects = [];
      }
    }

    let rawFiles = params.driveFiles;
    if (!rawFiles || rawFiles.length === 0) {
      try {
        rawFiles = await this.getDriveFiles(params.sourceUserId);
      } catch {
        rawFiles = [];
      }
    }

    // Smart Slicing: Only subjects from specializationStartYear & specializationStartSemester onward
    const filteredSubjects = (rawSubjects || []).filter(s => {
      const y = Number(s.yearIndex || 1);
      const sem = Number(s.semesterIndex || 1);
      return y > params.specializationStartYear ||
             (y === params.specializationStartYear && sem >= params.specializationStartSemester);
    });

    const filteredFiles = rawFiles || [];

    const specId = crypto.randomUUID();
    const defaultSpecYears: number[] = [];
    for (let yr = params.specializationStartYear; yr <= Number(parentDb.totalYears || 4); yr++) {
      defaultSpecYears.push(yr);
    }
    const availableYears = params.availableYears && params.availableYears.length > 0
      ? params.availableYears
      : (defaultSpecYears.length > 0 ? defaultSpecYears : [params.specializationStartYear]);

    const specDb: UniversityDatabase = {
      id: specId,
      universityNameAr: parentDb.universityNameAr,
      universityNameEn: parentDb.universityNameEn,
      collegeNameAr: `${parentDb.collegeNameAr} - ${params.specializationNameAr}`,
      collegeNameEn: parentDb.collegeNameEn ? `${parentDb.collegeNameEn} - ${params.specializationNameEn || params.specializationNameAr}` : '',
      sourceUserId: params.sourceUserId,
      sourceUserEmail: params.sourceUserEmail || '',
      sourceUserName: params.sourceUserName || '',
      totalYears: parentDb.totalYears,
      semestersPerYear: parentDb.semestersPerYear,
      availableYears,
      subjects: filteredSubjects,
      driveFiles: filteredFiles,
      gradingScale: parentDb.gradingScale || [],
      isVisible: true,
      isSpecialization: true,
      parentDatabaseId: parentDb.id,
      specializationNameAr: params.specializationNameAr,
      specializationNameEn: params.specializationNameEn || '',
      specializationStartYear: params.specializationStartYear,
      specializationStartSemester: params.specializationStartSemester,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.createUniversityDatabase(specDb);
    return specDb;
  },

  async deleteSpecializationDatabase(id: string): Promise<void> {
    await this.deleteUniversityDatabase(id);
  },

  // --- Pending Updates for University Databases ---
  async getPendingUpdates(universityDbId?: string): Promise<UniversityPendingUpdate[]> {
    let localList: UniversityPendingUpdate[] = [];
    try {
      const local = localStorage.getItem('unistudent_pending_updates');
      localList = local ? JSON.parse(local) : [];
    } catch {}

    try {
      let query = supabase.from('university_pending_updates').select('*').order('created_at', { ascending: true });
      if (universityDbId) {
        query = query.eq('university_database_id', universityDbId);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const remoteList = data.map(d => mapPendingUpdateFromDB(d));
        // Merge remote and local: if local is already approved/rejected, preserve resolved status
        const mergedMap = new Map<string, UniversityPendingUpdate>();
        remoteList.forEach(r => mergedMap.set(r.id, r));
        localList.forEach(l => {
          const existing = mergedMap.get(l.id);
          if (existing) {
            // If locally resolved, keep resolved status
            if (l.status !== 'pending' && existing.status === 'pending') {
              mergedMap.set(l.id, { ...existing, status: l.status, resolvedAt: l.resolvedAt });
            }
          } else {
            mergedMap.set(l.id, l);
          }
        });
        const merged = Array.from(mergedMap.values());
        merged.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        try {
          localStorage.setItem('unistudent_pending_updates', JSON.stringify(merged.slice(0, 100)));
        } catch {}
        return universityDbId ? merged.filter(p => p.universityDatabaseId === universityDbId) : merged;
      }
    } catch (e) {
      console.warn('Supabase getPendingUpdates warning:', e);
    }

    localList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return universityDbId ? localList.filter(p => p.universityDatabaseId === universityDbId) : localList;
  },

  async getUniversityPendingUpdates(universityDbId?: string): Promise<UniversityPendingUpdate[]> {
    return this.getPendingUpdates(universityDbId);
  },

  async updateUniversityName(oldName: string, newNameAr: string, newNameEn: string): Promise<void> {
    const current = await this.getUniversityDatabases();
    const toUpdate = current.filter(u => (u.universityNameAr && u.universityNameAr.trim() === oldName.trim()) || (u.universityNameEn && u.universityNameEn.trim() === oldName.trim()));
    for (const item of toUpdate) {
      await this.updateUniversityDatabase(item.id, {
        universityNameAr: newNameAr,
        universityNameEn: newNameEn
      });
    }
  },

  async deleteUniversity(uniName: string): Promise<void> {
    const current = await this.getUniversityDatabases();
    const toDelete = current.filter(u => (u.universityNameAr && u.universityNameAr.trim() === uniName.trim()) || (u.universityNameEn && u.universityNameEn.trim() === uniName.trim()));
    for (const item of toDelete) {
      await this.deleteUniversityDatabase(item.id);
    }

    // Detach explicitly-linked students and remove ONLY template-derived
    // items imported from the deleted databases — never the student's own data.
    try {
      const deletedIds = toDelete.map(d => d.id);
      if (deletedIds.length === 0) return;

      const templateSubjIds = new Set<string>();
      const templateFileIds = new Set<string>();
      for (const dbItem of toDelete) {
        (dbItem.subjects || []).forEach(s => { if (s.id) templateSubjIds.add(s.id); });
        (dbItem.driveFiles || []).forEach(f => { if (f.id) templateFileIds.add(f.id); });
      }

      const { data: affectedSettings } = await supabase
        .from('settings')
        .select('user_id')
        .or(`university_database_id.in.(${deletedIds.join(',')}),specialization_database_id.in.(${deletedIds.join(',')})`);

      for (const row of (affectedSettings || [])) {
        const { data: userSubjs } = await supabase
          .from('subjects')
          .select('id, university_template_id')
          .eq('user_id', row.user_id);
        for (const s of (userSubjs || [])) {
          if (s.university_template_id && templateSubjIds.has(s.university_template_id)) {
            await supabase.from('subjects').delete().eq('id', s.id);
          }
        }

        const { data: userFiles } = await supabase
          .from('drive_files')
          .select('id, university_template_id')
          .eq('user_id', row.user_id);
        for (const f of (userFiles || [])) {
          if (f.university_template_id && templateFileIds.has(f.university_template_id)) {
            await supabase.from('drive_files').delete().eq('id', f.id);
          }
        }

        await supabase.from('settings').update({
          university_database_id: null,
          specialization: null,
          specialization_database_id: null
        }).eq('user_id', row.user_id);
      }
    } catch (uniErr) {
      console.warn('Error cascading university deletion to students:', uniErr);
    }

    await broadcastUniversityDatabaseUpdate({
      action: 'deleted',
      type: 'university',
      uniKey: uniName.trim()
    });
  },

  async recordPendingUpdate(update: UniversityPendingUpdate): Promise<void> {
    try {
      // Check if target database already contains this subject (for add_subject)
      if (update.type === 'add_subject' && update.data?.name && update.universityDatabaseId) {
        const udb = await this.getUniversityDatabase(update.universityDatabaseId);
        if (udb && Array.isArray(udb.subjects)) {
          const normName = normalizeSubjectName(update.data.name);
          const y = Number(update.data.yearIndex || 1);
          const sem = Number(update.data.semesterIndex || 1);
          const alreadyExists = udb.subjects.some(s => 
            (update.data.id && s.id === update.data.id) ||
            (normalizeSubjectName(s.name) === normName && Number(s.yearIndex || 1) === y && Number(s.semesterIndex || 1) === sem)
          );
          if (alreadyExists) {
            return;
          }
        }
      }

      const current = await this.getPendingUpdates();
      const isDuplicate = current.some(p => 
        p.universityDatabaseId === update.universityDatabaseId &&
        p.type === update.type &&
        (p.status === 'pending' || (p.status === 'approved' && update.type === 'add_subject')) &&
        ((p.data?.id && p.data?.id === update.data?.id) || 
         (p.data?.name && p.data?.name === update.data?.name && p.data?.yearIndex === update.data?.yearIndex && p.data?.semesterIndex === update.data?.semesterIndex))
      );
      if (isDuplicate) {
        return;
      }
      const updated = [update, ...current.filter(u => u.id !== update.id)];
      localStorage.setItem('unistudent_pending_updates', JSON.stringify(updated.slice(0, 100)));
    } catch {}

    try {
      const { data: existing } = await supabase
        .from('university_pending_updates')
        .select('id, data, status')
        .eq('university_database_id', update.universityDatabaseId)
        .eq('type', update.type);

      if (existing && existing.length > 0) {
        const hasDup = existing.some(e => {
          if (e.status !== 'pending' && !(e.status === 'approved' && update.type === 'add_subject')) return false;
          const d = e.data;
          return (d?.id && d?.id === update.data?.id) ||
                 (d?.name && d?.name === update.data?.name && d?.yearIndex === update.data?.yearIndex && d?.semesterIndex === update.data?.semesterIndex);
        });
        if (hasDup) {
          return;
        }
      }

      const payload = {
        id: update.id,
        university_database_id: update.universityDatabaseId,
        source_user_id: update.sourceUserId,
        source_user_email: update.sourceUserEmail || '',
        source_user_name: update.sourceUserName || '',
        type: update.type,
        description: update.description,
        data: update.data,
        status: update.status,
        created_at: update.createdAt
      };
      await supabase.from('university_pending_updates').upsert(payload);
    } catch (e) {
      console.warn('Supabase recordPendingUpdate error:', e);
    }
  },

  async respondToPendingUpdate(id: string, status: 'approved' | 'rejected', applyAction?: (db: UniversityDatabase) => UniversityDatabase): Promise<void> {
    const pendingList = await this.getPendingUpdates();
    const target = pendingList.find(p => p.id === id);
    if (!target) return;

    const resolvedAt = new Date().toISOString();

    // 1. Immediately update status in local memory and persist to localStorage
    target.status = status;
    target.resolvedAt = resolvedAt;
    try {
      localStorage.setItem('unistudent_pending_updates', JSON.stringify(pendingList));
    } catch {}

    // 2. Immediately persist status to Supabase with fallback
    try {
      let { error } = await supabase
        .from('university_pending_updates')
        .update({ status, resolved_at: resolvedAt })
        .eq('id', id);

      if (error && (error.message?.includes('resolved_at') || error.message?.includes('column') || error.code === '42703')) {
        const fallbackRes = await supabase
          .from('university_pending_updates')
          .update({ status })
          .eq('id', id);
        if (fallbackRes.error) {
          console.warn('Supabase update status fallback warning:', fallbackRes.error);
        }
      }
    } catch (e) {
      console.warn('Supabase update pending update exception:', e);
    }

    // 3. If approved, apply database updates and sync changes safely
    if (status === 'approved' && applyAction && target.universityDatabaseId) {
      try {
        let udb = await this.getUniversityDatabase(target.universityDatabaseId);
        if (!udb) {
          const all = await this.getUniversityDatabases();
          udb = all.find(d => d.id === target.universityDatabaseId) || null;
        }
        if (udb) {
          udb.subjects = udb.subjects || [];
          udb.driveFiles = udb.driveFiles || [];
          const updatedDb = applyAction(udb);
          await this.updateUniversityDatabase(udb.id, updatedDb);
          await this.syncUniversityDatabaseChangesToStudents(udb.id, {
            type: (target.type as any) || 'full_sync',
            subject: target.data,
            updatedDb
          });
        }
      } catch (applyErr) {
        console.warn('Error applying approved pending update side-effects:', applyErr);
      }
    }
  },

  // --- Standalone Universities Registry ---
  getRegisteredUniversities(): { key: string; nameAr: string; nameEn: string; isVisible?: boolean; createdAt: string }[] {
    try {
      const saved = localStorage.getItem('unistudent_registered_universities');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  },

  registerUniversity(nameAr: string, nameEn?: string, isVisible: boolean = true): void {
    try {
      const current = this.getRegisteredUniversities();
      const trimmedAr = (nameAr || '').trim();
      const trimmedEn = (nameEn || '').trim() || trimmedAr;
      const key = trimmedAr || trimmedEn;
      if (!key) return;
      if (!current.some(u => u.key === key || u.nameAr === trimmedAr || u.nameEn === trimmedEn)) {
        current.push({
          key,
          nameAr: trimmedAr,
          nameEn: trimmedEn,
          isVisible: isVisible !== false,
          createdAt: new Date().toISOString()
        });
        localStorage.setItem('unistudent_registered_universities', JSON.stringify(current));
      }
    } catch {}

    try {
      const trimmedAr = (nameAr || '').trim();
      const trimmedEn = (nameEn || '').trim() || trimmedAr;
      const key = trimmedAr || trimmedEn;
      supabase.from('registered_universities').upsert({
        key,
        name_ar: trimmedAr,
        name_en: trimmedEn,
        is_visible: isVisible !== false
      }).then();
    } catch {}
  },

  deleteRegisteredUniversity(key: string): void {
    try {
      const current = this.getRegisteredUniversities();
      const filtered = current.filter(u => u.key !== key && u.nameAr !== key && u.nameEn !== key);
      localStorage.setItem('unistudent_registered_universities', JSON.stringify(filtered));
    } catch {}

    try {
      supabase.from('registered_universities').delete().eq('key', key).then();
    } catch {}
  },

  updateRegisteredUniversity(oldKey: string, nameAr: string, nameEn: string, isVisible?: boolean): void {
    try {
      const current = this.getRegisteredUniversities();
      const updated = current.map(u => {
        if (u.key === oldKey || u.nameAr === oldKey || u.nameEn === oldKey) {
          return {
            ...u,
            key: nameAr.trim() || nameEn.trim(),
            nameAr: nameAr.trim(),
            nameEn: nameEn.trim(),
            isVisible: isVisible !== undefined ? isVisible : (u.isVisible !== false)
          };
        }
        return u;
      });
      localStorage.setItem('unistudent_registered_universities', JSON.stringify(updated));
    } catch {}

    try {
      const payload: any = {
        name_ar: nameAr.trim(),
        name_en: nameEn.trim()
      };
      if (isVisible !== undefined) payload.is_visible = isVisible;
      supabase.from('registered_universities').update(payload).eq('key', oldKey).then();
    } catch {}
  },

  async toggleRegisteredUniversityVisibility(key: string, isVisible: boolean): Promise<void> {
    try {
      const current = this.getRegisteredUniversities();
      const updated = current.map(u => {
        if (u.key === key || u.nameAr === key || u.nameEn === key) {
          return { ...u, isVisible };
        }
        return u;
      });
      localStorage.setItem('unistudent_registered_universities', JSON.stringify(updated));
    } catch {}

    try {
      await supabase.from('registered_universities').update({ is_visible: isVisible }).eq('key', key);
    } catch {}
  },

  async toggleCollegeDatabaseVisibility(id: string, isVisible: boolean): Promise<void> {
    await this.updateUniversityDatabase(id, { isVisible });
  },

  // --- Student Database Changes Synchronization ---
  async syncUniversityDatabaseChangesToStudents(
    universityDbId: string,
    action: {
      type: 'add_subject' | 'update_subject' | 'delete_subject' | 'add_file' | 'update_file' | 'delete_file' | 'update_grading_scale' | 'full_sync';
      subject?: any;
      subjectId?: string;
      gradingScale?: GradeRule[];
      updatedDb?: UniversityDatabase;
    }
  ): Promise<void> {
    try {
      const udb = action.updatedDb || (await this.getUniversityDatabase(universityDbId));
      if (!udb) return;

      // Try server-side PostgreSQL function if available in Supabase
      try {
        await supabase.rpc('sync_approved_university_database_to_students', {
          p_university_database_id: universityDbId
        });
      } catch {}

      const isSpec = Boolean(udb.isSpecialization);
      const norm = (str?: string) => normalizeSubjectName(str);

      // Phase filter: a subject may only be pushed through the DB that owns its phase.
      const pushStartYear = Number(udb.specializationStartYear || 2);
      const pushStartSem = Number(udb.specializationStartSemester || 1);
      const isSubjectInPhase = (sub: any) => {
        const y = Number(sub?.yearIndex || 1);
        const sm = Number(sub?.semesterIndex || 1);
        const inSpecPhase = y > pushStartYear || (y === pushStartYear && sm >= pushStartSem);
        return isSpec ? inSpecPhase : !inSpecPhase;
      };

      // Find all students in Supabase settings or localStorage
      const studentUserIds: string[] = [];
      const checkStudentSubscription = (s: any) => {
        // Explicit-ID linking ONLY — students who never restored/pulled the
        // database (typed the name manually) must never receive its updates.
        if (isSpec) {
          return (
            s.specialization_database_id === universityDbId ||
            s.specializationDatabaseId === universityDbId
          );
        } else {
          // General college DB: explicit ID link ONLY — no name-based matching.
          return (
            s.university_database_id === universityDbId ||
            s.universityDatabaseId === universityDbId
          );
        }
      };

      try {
        const { data: dbSettings } = await supabase.from('settings').select('*');
        if (dbSettings) {
          dbSettings.forEach(s => {
            if (checkStudentSubscription(s)) {
              if (s.user_id && !studentUserIds.includes(s.user_id)) {
                // Isolate source student: never target source student for reverse sync
                if (udb.sourceUserId && s.user_id === udb.sourceUserId) return;
                studentUserIds.push(s.user_id);
              }
            }
          });
        }
      } catch {}

      // Also check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_settings_')) {
          const uid = key.replace('unistudent_settings_', '');
          if (udb.sourceUserId && uid === udb.sourceUserId) continue;
          try {
            const st = JSON.parse(localStorage.getItem(key) || '{}');
            if (checkStudentSubscription(st)) {
              if (!studentUserIds.includes(uid)) studentUserIds.push(uid);
            }
          } catch {}
        }
      }

      // 1. Direct Subject Synchronization for Enrolled Students
      if (action.type === 'add_subject' && action.subject) {
        for (const uid of studentUserIds) {
          try {
            if (!isSubjectInPhase(action.subject)) continue;
            const studentSubjects = await this.getSubjects(uid);
            const normNewName = norm(action.subject.name);
            const exists = studentSubjects.some(s => 
              s.id === action.subject.id || 
              (s.code && action.subject.code && s.code.trim().toLowerCase() === action.subject.code.trim().toLowerCase()) ||
              (norm(s.name) === normNewName && Number(s.yearIndex || 1) === Number(action.subject.yearIndex || 1) && Number(s.semesterIndex || 1) === Number(action.subject.semesterIndex || 1))
            );
            if (!exists) {
              await this.addSubject(uid, {
                ...action.subject,
                id: (action.subject.id && !studentSubjects.some(s => s.id === action.subject.id)) ? action.subject.id : crypto.randomUUID(),
                status: 'current'
              });
            }
          } catch (err) {
            console.warn(`Error adding synced subject to student ${uid}:`, err);
          }
        }
      } else if (action.type === 'update_subject' && action.subject) {
        for (const uid of studentUserIds) {
          try {
            if (!isSubjectInPhase(action.subject)) continue;
            const studentSubjects = await this.getSubjects(uid);
            const normTargetName = norm(action.subject.name || action.subject.previous?.name);
            const match = studentSubjects.find(s => 
              s.id === action.subject.id || 
              (s.code && action.subject.code && s.code.trim().toLowerCase() === action.subject.code.trim().toLowerCase()) ||
              (norm(s.name) === normTargetName && Number(s.yearIndex || 1) === Number(action.subject.yearIndex || 1) && Number(s.semesterIndex || 1) === Number(action.subject.semesterIndex || 1))
            );
            if (match) {
              await this.updateSubject(uid, match.id, {
                code: action.subject.code !== undefined ? action.subject.code : match.code,
                name: action.subject.name !== undefined ? action.subject.name : match.name,
                creditHours: action.subject.creditHours || action.subject.credit_hours || match.creditHours,
                totalMarks: action.subject.totalMarks || action.subject.total_marks || match.totalMarks,
                yearIndex: action.subject.yearIndex || action.subject.year_index || match.yearIndex,
                semesterIndex: action.subject.semesterIndex || action.subject.semester_index || match.semesterIndex,
                distributions: action.subject.distributions || match.distributions
              });
            }
          } catch (err) {
            console.warn(`Error updating synced subject for student ${uid}:`, err);
          }
        }
      } else if (action.type === 'delete_subject' && action.subject) {
        for (const uid of studentUserIds) {
          try {
            if (!isSubjectInPhase(action.subject)) continue;
            const studentSubjects = await this.getSubjects(uid);
            const normTargetName = norm(action.subject.name);
            const match = studentSubjects.find(s => 
              s.id === action.subject.id || 
              (s.code && action.subject.code && s.code.trim().toLowerCase() === action.subject.code.trim().toLowerCase()) ||
              (norm(s.name) === normTargetName)
            );
            if (match) {
              await this.deleteSubject(uid, match.id);
            }
          } catch (err) {
            console.warn(`Error deleting synced subject for student ${uid}:`, err);
          }
        }
      }

      // 2. If grading scale was updated, apply to students' settings
      if (action.type === 'update_grading_scale' && action.gradingScale) {
        for (const uid of studentUserIds) {
          await this.upsertSettings(uid, { gradingScale: action.gradingScale }).catch(() => {});
        }
      }

      // 2. Notify students of approved changes (In-App notifications)
      const specLabel = udb.specializationNameAr ? `تخصص ${udb.specializationNameAr}` : 'التخصص';
      const notifTitle = isSpec
        ? (action.type === 'add_subject'
          ? `مادة تخصص جديدة: ${action.subject?.name || ''}`
          : action.type === 'update_subject'
          ? `تحديث في مادة التخصص: ${action.subject?.name || ''}`
          : action.type === 'delete_subject'
          ? `حذف مادة تخصص: ${action.subject?.name || ''}`
          : action.type === 'add_file'
          ? `ملف جديد في درايف ${specLabel}: ${action.subject?.name || ''}`
          : action.type === 'update_file'
          ? `تحديث ملف في درايف ${specLabel}: ${action.subject?.name || ''}`
          : action.type === 'delete_file'
          ? `حذف ملف من درايف ${specLabel}: ${action.subject?.name || ''}`
          : action.type === 'update_grading_scale'
          ? `تحديث لائحة التقديرات المعتمدة لـ ${specLabel}`
          : `تحديث معتمد في الخطة الدراسية لـ ${specLabel}`)
        : (action.type === 'add_subject'
          ? `مادة جديدة مضافة للخطة: ${action.subject?.name || ''}`
          : action.type === 'update_subject'
          ? `تحديث في بيانات مادة: ${action.subject?.name || ''}`
          : action.type === 'delete_subject'
          ? `حذف مادة من الخطة: ${action.subject?.name || ''}`
          : action.type === 'add_file'
          ? `ملف جديد في درايف الكلية: ${action.subject?.name || ''}`
          : action.type === 'update_file'
          ? `تحديث ملف في درايف الكلية: ${action.subject?.name || ''}`
          : action.type === 'delete_file'
          ? `حذف ملف من درايف الكلية: ${action.subject?.name || ''}`
          : action.type === 'update_grading_scale'
          ? 'تحديث لائحة التقديرات المعتمدة لكليتك'
          : 'تحديث معتمد في الخطة الدراسية لقاعدة بيانات كليتك');

      const notifMessage = isSpec
        ? (action.type === 'add_subject'
          ? `تم اعتماد إضافة مادة التخصص "${action.subject?.name || ''}" لخطة ${specLabel} من قِبل الإدارة.`
          : action.type === 'delete_subject'
          ? `تم اعتماد حذف مادة التخصص "${action.subject?.name || ''}" من خطة ${specLabel} من قِبل الإدارة.`
          : action.type === 'add_file' || action.type === 'update_file' || action.type === 'delete_file'
          ? `تم تحديث ملفات ومجلدات درايف ${specLabel} المرجعية من قِبل الإدارة.`
          : `تم اعتماد وتحديث الخطة الدراسية لـ ${specLabel}. سيتم تطبيق التغييرات تلقائياً في حسابك.`)
        : (action.type === 'add_subject'
          ? `تم اعتماد إضافة مادة "${action.subject?.name || ''}" للخطة الدراسية من قِبل الإدارة.`
          : action.type === 'delete_subject'
          ? `تم اعتماد حذف مادة "${action.subject?.name || ''}" من الخطة الدراسية من قِبل الإدارة.`
          : action.type === 'add_file' || action.type === 'update_file' || action.type === 'delete_file'
          ? `تم تحديث ملفات ومجلدات الدرايف المرجعية لكليتك من قِبل الإدارة.`
          : 'تم اعتماد وتحديث الخطة الدراسية لكليتك. سيتم تطبيق التغييرات تلقائياً في حسابك.');

      for (const uid of studentUserIds) {
        await this.sendStudentNotification(uid, {
          title: notifTitle,
          message: notifMessage,
          type: 'update'
        }).catch(() => {});
      }

      // 3. Broadcast real-time sync event so each active student's client syncs their own subjects cleanly
      await broadcastUniversityDatabaseUpdate({ 
        id: universityDbId, 
        universityNameAr: udb.universityNameAr,
        universityNameEn: udb.universityNameEn,
        collegeNameAr: udb.collegeNameAr,
        collegeNameEn: udb.collegeNameEn,
        isSpecialization: isSpec,
        parentDatabaseId: udb.parentDatabaseId,
        specializationNameAr: udb.specializationNameAr,
        timestamp: Date.now() 
      });
    } catch (e) {
      console.warn('Error in syncUniversityDatabaseChangesToStudents:', e);
    }
  },

  // --- Student Notifications ---
  async sendStudentNotification(studentId: string, notification: {
    id?: string;
    title: string;
    message: string;
    type?: 'info' | 'update' | 'source_alert';
    date?: string;
  }): Promise<void> {
    const notifId = notification.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotif = {
      id: notifId,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      date: notification.date || new Date().toISOString(),
      dismissed: false
    };

    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = existing.filter((n: any) => n.id !== notifId);
      localStorage.setItem(key, JSON.stringify([newNotif, ...filtered].slice(0, 50)));
    } catch {}
  },

  getStudentNotifications(studentId: string): Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    date: string;
    dismissed: boolean;
  }> {
    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) {
        return saved.filter((n: any) => !n.dismissed);
      }
    } catch {}
    return [];
  },

  dismissStudentNotification(studentId: string, notificationId: string): void {
    try {
      const key = `unistudent_student_notifications_${studentId}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      if (Array.isArray(saved)) {
        const updated = saved.map((n: any) => n.id === notificationId ? { ...n, dismissed: true } : n);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch {}
  },

  async notifyEnrolledStudentsOfDbUpdate(_universityDatabaseId: string, _message: string): Promise<void> {
    // Disabled as requested: no update notifications sent to students
    return;
  },

  // --- Admin All Platform Data ---
  async getAdminAllData() {
    let rawSettings: any[] = [];
    let rawSubjects: any[] = [];
    let rawTasks: any[] = [];
    let rawNotes: any[] = [];
    let rawAppointments: any[] = [];
    let rawSchedule: any[] = [];
    let rawGroups: any[] = [];
    let rawFiles: any[] = [];
    let feedbacks: any[] = [];

    // 1. Try Direct Supabase Query
    try {
      const [
        settingsRes,
        subjectsRes,
        tasksRes,
        notesRes,
        appointmentsRes,
        scheduleRes,
        groupsRes,
        filesRes,
        fbList
      ] = await Promise.all([
        supabase.from('settings').select('*'),
        supabase.from('subjects').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('notes').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('schedule_items').select('*'),
        supabase.from('groups').select('*'),
        supabase.from('drive_files').select('*'),
        this.getAllFeedbacks()
      ]);

      if (settingsRes.data && settingsRes.data.length > 0) rawSettings = settingsRes.data;
      if (subjectsRes.data && subjectsRes.data.length > 0) rawSubjects = subjectsRes.data;
      if (tasksRes.data && tasksRes.data.length > 0) rawTasks = tasksRes.data;
      if (notesRes.data && notesRes.data.length > 0) rawNotes = notesRes.data;
      if (appointmentsRes.data && appointmentsRes.data.length > 0) rawAppointments = appointmentsRes.data;
      if (scheduleRes.data && scheduleRes.data.length > 0) rawSchedule = scheduleRes.data;
      if (groupsRes.data && groupsRes.data.length > 0) rawGroups = groupsRes.data;
      if (filesRes.data && filesRes.data.length > 0) rawFiles = filesRes.data;
      if (fbList && fbList.length > 0) feedbacks = fbList;
    } catch (e) {
      console.warn('Direct Supabase query warning:', e);
    }

    // 2. If RLS filtered out rows or returned empty, query through Edge Function (which has service_role permissions)
    if (rawSettings.length === 0 || rawSubjects.length === 0) {
      try {
        const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('send-database-backup', {
          body: { targetEmail: 'admin@gmail.com' }
        });

        if (!edgeErr && edgeData?.backup?.data) {
          const bData = edgeData.backup.data;
          if (bData.settings && bData.settings.length > 0) rawSettings = bData.settings;
          if (bData.subjects && bData.subjects.length > 0) rawSubjects = bData.subjects;
          if (bData.tasks && bData.tasks.length > 0) rawTasks = bData.tasks;
          if (bData.notes && bData.notes.length > 0) rawNotes = bData.notes;
          if (bData.appointments && bData.appointments.length > 0) rawAppointments = bData.appointments;
          if (bData.schedule_items && bData.schedule_items.length > 0) rawSchedule = bData.schedule_items;
          if (bData.groups && bData.groups.length > 0) rawGroups = bData.groups;
          if (bData.drive_files && bData.drive_files.length > 0) rawFiles = bData.drive_files;
          if (bData.suggestions && bData.suggestions.length > 0) feedbacks = bData.suggestions;

          if (bData.auth_users && Array.isArray(bData.auth_users)) {
            bData.auth_users.forEach((au: any) => {
              if (au.id) {
                const existing = rawSettings.find(s => s.user_id === au.id);
                if (existing) {
                  if (!existing.email || existing.email === '') existing.email = au.email;
                } else {
                  rawSettings.push({
                    user_id: au.id,
                    name: au.email ? au.email.split('@')[0] : 'طالب مسجل',
                    email: au.email || '',
                    university: '',
                    college: '',
                    grading_scale: [],
                    semesters: []
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('Edge function service_role fetch fallback error:', err);
      }
    }

    // 3. Email enrichment: any student/settings row without an email gets its
    // REAL email from auth.users (via the service-role edge function).
    // Registration always requires an email, so a "no email" student in the
    // admin panel is always a display gap — never a real ghost account.
    const needsEmailEnrichment =
      rawSettings.some(s => !s.email) ||
      (rawSettings.length === 0 && (rawSubjects.length > 0 || rawFiles.length > 0));
    if (needsEmailEnrichment) {
      try {
        const { data: emailEdgeData, error: emailEdgeErr } = await supabase.functions.invoke('send-database-backup', {
          body: { targetEmail: 'admin@gmail.com' }
        });
        const authUsers = emailEdgeData?.backup?.data?.auth_users;
        if (!emailEdgeErr && Array.isArray(authUsers)) {
          authUsers.forEach((au: any) => {
            if (!au.id) return;
            const existing = rawSettings.find(s => s.user_id === au.id);
            if (existing) {
              if (!existing.email || existing.email === '') existing.email = au.email || existing.email;
              if ((!existing.name || existing.name === '') && au.email) existing.name = au.email.split('@')[0];
            } else {
              rawSettings.push({
                user_id: au.id,
                name: au.email ? au.email.split('@')[0] : 'طالب مسجل',
                email: au.email || '',
                university: '',
                college: '',
                grading_scale: [],
                semesters: []
              });
            }
          });
        }
      } catch (err) {
        console.warn('Email enrichment via edge function failed:', err);
      }
    }

    // Decode student specialization metadata from grading_scale if present
    rawSettings.forEach(s => {
      const specMeta = Array.isArray(s.grading_scale)
        ? s.grading_scale.find((g: any) => g && g.id === '__student_spec_meta__')
        : null;
      if (specMeta) {
        if (!s.specialization && specMeta.specialization) s.specialization = specMeta.specialization;
        if (!s.specialization_start_year && specMeta.specializationStartYear) s.specialization_start_year = specMeta.specializationStartYear;
        if (!s.specialization_start_semester && specMeta.specializationStartSemester) s.specialization_start_semester = specMeta.specializationStartSemester;
        if (!s.specialization_database_id && specMeta.specializationDatabaseId) s.specialization_database_id = specMeta.specializationDatabaseId;
      }
    });

    // Collect all distinct user IDs
    const userIds = new Set<string>();
    rawSettings.forEach(s => s.user_id && userIds.add(s.user_id));
    rawSubjects.forEach(s => s.user_id && userIds.add(s.user_id));
    rawTasks.forEach(t => t.user_id && userIds.add(t.user_id));
    rawNotes.forEach(n => n.user_id && userIds.add(n.user_id));
    rawAppointments.forEach(a => a.user_id && userIds.add(a.user_id));
    rawSchedule.forEach(sc => sc.user_id && userIds.add(sc.user_id));
    rawFiles.forEach(f => f.user_id && userIds.add(f.user_id));
    feedbacks.forEach(fb => fb.userId && userIds.add(fb.userId));

    // Also scan localStorage for any cached student profiles and users
    try {
      const knownUsersRaw = localStorage.getItem('unistudent_known_users');
      if (knownUsersRaw) {
        const knownUsers = JSON.parse(knownUsersRaw);
        if (Array.isArray(knownUsers)) {
          knownUsers.forEach((u: any) => {
            if (u.id) {
              userIds.add(u.id);
              const existing = rawSettings.find(s => s.user_id === u.id);
              if (!existing) {
                rawSettings.push({
                  user_id: u.id,
                  name: u.name || 'طالب مسجل',
                  email: u.email || '',
                  university: u.university || '',
                  college: u.college || '',
                  specialization: u.specialization || '',
                  specialization_start_year: u.specializationStartYear || 2,
                  specialization_start_semester: u.specializationStartSemester || 1,
                  specialization_database_id: u.specializationDatabaseId || '',
                  grading_scale: u.gradingScale || [],
                  semesters: u.semesters || []
                });
              } else {
                if (!existing.specialization && u.specialization) existing.specialization = u.specialization;
                if (!existing.specialization_start_year && u.specializationStartYear) existing.specialization_start_year = u.specializationStartYear;
                if (!existing.specialization_start_semester && u.specializationStartSemester) existing.specialization_start_semester = u.specializationStartSemester;
                if (!existing.specialization_database_id && u.specializationDatabaseId) existing.specialization_database_id = u.specializationDatabaseId;
              }
            }
          });
        }
      }

      // Check all localStorage keys for cached unistudent_settings_* and unistudent_user_email_*
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('unistudent_settings_')) {
          const uid = key.replace('unistudent_settings_', '');
          if (uid) {
            userIds.add(uid);
            const savedEmail = localStorage.getItem(`unistudent_user_email_${uid}`) || '';
            const existing = rawSettings.find(s => s.user_id === uid);
            try {
              const st = JSON.parse(localStorage.getItem(key) || '{}');
              if (!existing) {
                rawSettings.push({
                  user_id: uid,
                  name: st.name || 'طالب مسجل',
                  email: savedEmail || st.email || '',
                  university: st.university || '',
                  college: st.college || '',
                  specialization: st.specialization || '',
                  specialization_start_year: st.specializationStartYear || 2,
                  specialization_start_semester: st.specializationStartSemester || 1,
                  specialization_database_id: st.specializationDatabaseId || '',
                  grading_scale: st.gradingScale || [],
                  semesters: st.semesters || []
                });
              } else {
                if (!existing.email && (savedEmail || st.email)) existing.email = savedEmail || st.email;
                if (!existing.specialization && st.specialization) existing.specialization = st.specialization;
                if (!existing.specialization_start_year && st.specializationStartYear) existing.specialization_start_year = st.specializationStartYear;
                if (!existing.specialization_start_semester && st.specializationStartSemester) existing.specialization_start_semester = st.specializationStartSemester;
                if (!existing.specialization_database_id && st.specializationDatabaseId) existing.specialization_database_id = st.specializationDatabaseId;
              }
            } catch {}
          }
        } else if (key && key.startsWith('unistudent_user_email_')) {
          const uid = key.replace('unistudent_user_email_', '');
          const emailVal = localStorage.getItem(key) || '';
          if (uid && emailVal) {
            userIds.add(uid);
            const existing = rawSettings.find(s => s.user_id === uid);
            if (existing && !existing.email) {
              existing.email = emailVal;
            }
          }
        }
      }
    } catch (e) {
      console.warn('LocalStorage admin sync fallback warning:', e);
    }

    // Also check current active user
    try {
      const currentSession = await supabase.auth.getSession().catch(() => null);
      const curUser = currentSession?.data?.session?.user;
      if (curUser?.id) {
        userIds.add(curUser.id);
        const existing = rawSettings.find(s => s.user_id === curUser.id);
        if (existing) {
          if (!existing.email && curUser.email) existing.email = curUser.email;
        } else {
          rawSettings.push({
            user_id: curUser.id,
            name: curUser.email ? curUser.email.split('@')[0] : 'طالب مسجل',
            email: curUser.email || '',
            university: '',
            college: '',
            grading_scale: [],
            semesters: []
          });
        }
      }
    } catch {}

    // 3. For all user IDs, merge cached subjects & files if missing from Supabase response
    userIds.forEach(uid => {
      try {
        const cachedSubjs = localStorage.getItem(`unistudent_subjects_${uid}`);
        if (cachedSubjs) {
          const parsed = JSON.parse(cachedSubjs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(s => {
              if (!rawSubjects.some(rs => rs.id === s.id)) {
                rawSubjects.push({
                  id: s.id,
                  user_id: uid,
                  code: s.code || '',
                  name: s.name || '',
                  credit_hours: s.creditHours || 3,
                  total_marks: s.totalMarks || 100,
                  year_index: s.yearIndex || 1,
                  semester_index: s.semesterIndex || 1,
                  status: s.status || 'current',
                  distributions: s.distributions || [],
                  final_grade_letter: s.finalGradeLetter,
                  include_in_gpa: s.includeInGpa !== false
                });
              }
            });
          }
        }
      } catch {}

      try {
        const cachedFiles = localStorage.getItem(`unistudent_drive_files_${uid}`);
        if (cachedFiles) {
          const parsed = JSON.parse(cachedFiles);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach(f => {
              if (!rawFiles.some(rf => rf.id === f.id)) {
                rawFiles.push({
                  id: f.id,
                  user_id: uid,
                  name: f.name || '',
                  size: f.size || 0,
                  type: f.type || 'file',
                  url: f.url || '',
                  upload_date: f.createdAt || new Date().toISOString(),
                  parent_id: f.parentId || null,
                  b2_file_id: f.b2FileId
                });
              }
            });
          }
        }
      } catch {}
    });

    return {
      userIds: Array.from(userIds),
      rawSettings,
      rawSubjects,
      rawTasks,
      rawNotes,
      rawAppointments,
      rawSchedule,
      rawGroups,
      rawFiles,
      feedbacks
    };
  },

  // --- Full Database Backup & Restore ---
  async exportFullDatabaseBackup(): Promise<DatabaseBackup> {
    const data = await this.getAdminAllData();
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: 'production',
      data: {
        settings: data.rawSettings,
        subjects: data.rawSubjects,
        tasks: data.rawTasks,
        notes: data.rawNotes,
        appointments: data.rawAppointments,
        schedule_items: data.rawSchedule,
        groups: data.rawGroups,
        drive_files: data.rawFiles,
        suggestions: data.feedbacks
      },
      summary: {
        totalStudents: data.userIds.length,
        totalSubjects: data.rawSubjects.length,
        totalTasks: data.rawTasks.length,
        totalNotes: data.rawNotes.length,
        totalFiles: data.rawFiles.length,
        totalSuggestions: data.feedbacks.length
      }
    };
  },

  async restoreDatabaseFromBackup(backup: DatabaseBackup, mode: 'overwrite' | 'merge' = 'merge'): Promise<{ success: boolean; message: string; details: any }> {
    if (!backup?.data) {
      throw new Error('Invalid backup file format.');
    }

    const { settings = [], subjects = [], tasks = [], notes = [], appointments = [], schedule_items = [], groups = [], drive_files = [], suggestions = [] } = backup.data;
    const errors: string[] = [];

    /*
     * A student restoring another student's academic database must not receive a
     * detached snapshot.  The old implementation restored rows with the source
     * user's id, while every student screen queries by the current user's id.
     * That made the restored data invisible and prevented later approved changes
     * from reaching the restoring student.
     *
     * For a single-owner backup restored by a student, store a subscription to
     * that source instead. `get_visible_subjects_for_current_user` then supplies
     * the source's current approved subjects on every refresh. Admin imports keep
     * their existing full-database behaviour.
     */
    const sourceOwnerIds = new Set<string>();
    [settings, subjects].forEach(rows => {
      rows.forEach((row: any) => {
        if (row?.user_id) sourceOwnerIds.add(row.user_id);
      });
    });

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const restoringUserId = sessionData.session?.user?.id;
      const isAdminRestore = sessionStorage.getItem('unistudent_admin_auth') === 'true';
      const sourceUserId = sourceOwnerIds.size === 1 ? Array.from(sourceOwnerIds)[0] : null;

      if (restoringUserId && sourceUserId && sourceUserId !== restoringUserId && !isAdminRestore) {
        const { error: linkError } = await supabase
          .from('database_restore_links')
          .upsert(
            { subscriber_id: restoringUserId, source_owner_id: sourceUserId },
            { onConflict: 'subscriber_id' }
          );

        if (linkError) throw linkError;

        // A stale local cache must never mask a newly linked live database.
        try {
          localStorage.removeItem(`unistudent_subjects_${restoringUserId}`);
        } catch {}

        return {
          success: true,
          message: 'تم ربط النسخة المستعادة بالمصدر المعتمد. ستظهر أي مواد أو تحديثات معتمدة تلقائياً.',
          details: {
            linkedToSource: true,
            sourceUserId,
            restoredCount: { subjects: subjects.length }
          }
        };
      }
    } catch (err: any) {
      errors.push(`Shared database link: ${err.message || String(err)}`);
    }

    // 1. Settings
    if (settings.length > 0) {
      try {
        await supabase.from('settings').upsert(settings, { onConflict: 'user_id' });
      } catch (err: any) {
        errors.push(`Settings: ${err.message}`);
      }
    }

    // 2. Subjects
    if (subjects.length > 0) {
      try {
        await supabase.from('subjects').upsert(subjects, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Subjects: ${err.message}`);
      }
    }

    // 3. Tasks
    if (tasks.length > 0) {
      try {
        await supabase.from('tasks').upsert(tasks, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Tasks: ${err.message}`);
      }
    }

    // 4. Notes
    if (notes.length > 0) {
      try {
        await supabase.from('notes').upsert(notes, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Notes: ${err.message}`);
      }
    }

    // 5. Appointments
    if (appointments.length > 0) {
      try {
        await supabase.from('appointments').upsert(appointments, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Appointments: ${err.message}`);
      }
    }

    // 6. Schedule Items
    if (schedule_items.length > 0) {
      try {
        await supabase.from('schedule_items').upsert(schedule_items, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Schedule: ${err.message}`);
      }
    }

    // 7. Groups
    if (groups.length > 0) {
      try {
        await supabase.from('groups').upsert(groups, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Groups: ${err.message}`);
      }
    }

    // 8. Drive Files
    if (drive_files.length > 0) {
      try {
        await supabase.from('drive_files').upsert(drive_files, { onConflict: 'id' });
      } catch (err: any) {
        errors.push(`Drive files: ${err.message}`);
      }
    }

    // 9. Suggestions
    if (suggestions.length > 0) {
      try {
        await supabase.from('suggestions').upsert(suggestions, { onConflict: 'id' });
        localStorage.setItem('unistudent_all_suggestions', JSON.stringify(suggestions));
      } catch (err: any) {
        errors.push(`Suggestions: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      message: errors.length === 0 ? 'تمت استعادة كافة بيانات قاعدة البيانات بنجاح!' : `تمت الاستعادة مع بعض التنبيهات: ${errors.join(', ')}`,
      details: {
        restoredCount: {
          settings: settings.length,
          subjects: subjects.length,
          tasks: tasks.length,
          notes: notes.length,
          appointments: appointments.length,
          schedule: schedule_items.length,
          files: drive_files.length,
          suggestions: suggestions.length
        },
        errors
      }
    };
  },

  // --- Email Backup Configuration ---
  getEmailBackupConfig(): EmailBackupConfig {
    try {
      const saved = localStorage.getItem('unistudent_email_backup_config');
      if (saved) return JSON.parse(saved);
    } catch {}

    return {
      enabled: false,
      targetEmail: '',
      senderEmail: '',
      appPassword: '',
      frequency: 'thursday',
      startDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      status: 'paused'
    };
  },

  saveEmailBackupConfig(config: EmailBackupConfig) {
    try {
      localStorage.setItem('unistudent_email_backup_config', JSON.stringify(config));
    } catch (e) {
      console.error('Error saving email backup config:', e);
    }
  }
};

// --- Local Extra Caching Helpers ---
function getEntityExtras(userId: string, entityType: string): Record<string, any> {
  try {
    const raw = localStorage.getItem(`unistudent_${entityType}_extras_${userId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEntityExtra(userId: string, entityType: string, entityId: string, extras: any) {
  try {
    const all = getEntityExtras(userId, entityType);
    all[entityId] = { ...(all[entityId] || {}), ...extras };
    localStorage.setItem(`unistudent_${entityType}_extras_${userId}`, JSON.stringify(all));
  } catch (e) {
    console.error(`Error caching ${entityType} extras:`, e);
  }
}

function removeEntityExtra(userId: string, entityType: string, entityId: string) {
  try {
    const all = getEntityExtras(userId, entityType);
    delete all[entityId];
    localStorage.setItem(`unistudent_${entityType}_extras_${userId}`, JSON.stringify(all));
  } catch (e) {
    console.error(`Error removing ${entityType} extras:`, e);
  }
}

// --- Mapping Helpers ---
function mapSettingsFromDB(row: any): UserSettings {
  let localExtra: any = {};
  if (row.user_id) {
    try {
      const saved = localStorage.getItem(`unistudent_settings_${row.user_id}`);
      if (saved) localExtra = JSON.parse(saved);
    } catch {}
  }

  const specMeta = Array.isArray(row.grading_scale)
    ? row.grading_scale.find((g: any) => g && g.id === '__student_spec_meta__')
    : null;

  const resolvedDbId = (row.university_database_id && row.university_database_id !== 'null')
    ? row.university_database_id
    : (localExtra.universityDatabaseId || undefined);

  const cleanGradingScale = Array.isArray(row.grading_scale)
    ? row.grading_scale.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))))
    : (localExtra.gradingScale || []);

  const resolvedSpecialization = row.specialization != null 
    ? row.specialization 
    : (specMeta?.specialization || localExtra.specialization || undefined);

  const resolvedStartYear = (row.specialization_start_year != null && row.specialization_start_year !== '' && Number(row.specialization_start_year) > 0)
    ? Number(row.specialization_start_year)
    : (specMeta?.specializationStartYear ? Number(specMeta.specializationStartYear) : ((localExtra.specializationStartYear != null && localExtra.specializationStartYear !== '' && Number(localExtra.specializationStartYear) > 0) ? Number(localExtra.specializationStartYear) : undefined));

  const resolvedStartSemester = (row.specialization_start_semester != null && row.specialization_start_semester !== '' && Number(row.specialization_start_semester) > 0)
    ? Number(row.specialization_start_semester)
    : (specMeta?.specializationStartSemester ? Number(specMeta.specializationStartSemester) : ((localExtra.specializationStartSemester != null && localExtra.specializationStartSemester !== '' && Number(localExtra.specializationStartSemester) > 0) ? Number(localExtra.specializationStartSemester) : undefined));

  const resolvedSpecDbId = row.specialization_database_id != null 
    ? row.specialization_database_id 
    : (specMeta?.specializationDatabaseId || localExtra.specializationDatabaseId || undefined);

  const deletedMeta = Array.isArray(row.grading_scale)
    ? row.grading_scale.find((g: any) => g && g.id === '__student_deleted_subjects__')
    : null;

  // Resolve University: If row has 'غير محدد' or is empty, but localExtra has a real university name, prefer localExtra
  const resolvedUniversity = (row.university && row.university !== 'غير محدد' && row.university !== 'Not specified')
    ? row.university
    : (localExtra.university || row.university || '');

  // Resolve College: If row has 'غير محدد' or is empty, but localExtra has a real college name, prefer localExtra
  const resolvedCollege = (row.college && row.college !== 'غير محدد' && row.college !== 'Not specified')
    ? row.college
    : (localExtra.college || row.college || '');

  // Resolve Name: Prefer non-empty row.name or localExtra.name
  const resolvedName = (row.name && row.name.trim()) 
    ? row.name 
    : (localExtra.name || '');

  return {
    name: resolvedName,
    university: resolvedUniversity,
    college: resolvedCollege,
    enrollmentDate: row.enrollment_date || localExtra.enrollmentDate || '',
    totalYears: row.total_years || localExtra.totalYears || 4,
    semestersPerYear: row.semesters_per_year || localExtra.semestersPerYear || 2,
    theme: row.theme || localExtra.theme || 'light',
    language: row.language || localExtra.language || 'en',
    gradingScale: cleanGradingScale,
    semesters: row.semesters || localExtra.semesters || [],
    initialCumulativeGpa: row.initial_cumulative_gpa !== undefined ? row.initial_cumulative_gpa : (localExtra.initialCumulativeGpa ?? null),
    initialCompletedCreditHours: row.initial_completed_credit_hours !== undefined ? row.initial_completed_credit_hours : (localExtra.initialCompletedCreditHours ?? null),
    setupMode: row.setup_mode || localExtra.setupMode || 'initial_gpa',
    warningGradeLetter: row.warning_grade_letter !== undefined ? row.warning_grade_letter : (localExtra.warningGradeLetter ?? 'C'),
    warningGpaPoints: row.warning_gpa_points !== undefined ? Number(row.warning_gpa_points) : (localExtra.warningGpaPoints !== undefined ? Number(localExtra.warningGpaPoints) : 2.0),
    enableGraduationScale: row.enable_graduation_scale !== undefined ? row.enable_graduation_scale : (localExtra.enableGraduationScale ?? false),
    graduationGradingScale: row.graduation_grading_scale || localExtra.graduationGradingScale || [],
    universityDatabaseId: resolvedDbId,
    deletedSubjectNames: (Array.isArray(row.deleted_subject_names) && row.deleted_subject_names.length > 0)
      ? row.deleted_subject_names
      : (deletedMeta?.names || localExtra.deletedSubjectNames || []),
    specialization: resolvedSpecialization,
    specializationStartYear: resolvedStartYear,
    specializationStartSemester: resolvedStartSemester,
    specializationDatabaseId: resolvedSpecDbId
  };
}

function mapSubjectFromDB(row: any): Subject {
  const y = row.year_index !== undefined && row.year_index !== null ? row.year_index : (row.yearIndex !== undefined ? row.yearIndex : 1);
  const sem = row.semester_index !== undefined && row.semester_index !== null ? row.semester_index : (row.semesterIndex !== undefined ? row.semesterIndex : 1);
  return {
    id: row.id,
    code: row.code || '',
    name: row.name,
    creditHours: Number(row.credit_hours !== undefined ? row.credit_hours : (row.creditHours !== undefined ? row.creditHours : 3)),
    totalMarks: Number(row.total_marks !== undefined ? row.total_marks : (row.totalMarks !== undefined ? row.totalMarks : 100)),
    yearIndex: Number(y || 1),
    semesterIndex: Number(sem || 1),
    status: row.status || 'current',
    distributions: (row.distributions || []).map((d: any) => ({ ...d, status: d.status || 'current' })),
    finalGradeLetter: row.final_grade_letter || row.finalGradeLetter,
    includeInGpa: row.include_in_gpa !== false && row.includeInGpa !== false
  };
}

function mapSubjectToDB(userId: string, subject: Subject) {
  const y = subject.yearIndex !== undefined ? subject.yearIndex : ((subject as any).year_index !== undefined ? (subject as any).year_index : 1);
  const sem = subject.semesterIndex !== undefined ? subject.semesterIndex : ((subject as any).semester_index !== undefined ? (subject as any).semester_index : 1);
  return {
    id: subject.id,
    user_id: userId,
    code: subject.code || '',
    name: subject.name,
    credit_hours: Number(subject.creditHours || (subject as any).credit_hours || 3),
    total_marks: Number(subject.totalMarks || (subject as any).total_marks || 100),
    year_index: Number(y || 1),
    semester_index: Number(sem || 1),
    status: subject.status || 'current',
    distributions: subject.distributions || [],
    final_grade_letter: subject.finalGradeLetter,
    include_in_gpa: subject.includeInGpa !== false && (subject as any).include_in_gpa !== false
  };
}

function mapAppointmentFromDB(row: any): Appointment {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: row.date,
    time: row.time,
    location: row.location,
    doctorName: row.doctor_name,
    notes: row.notes,
    groupId: row.group_id,
    priority: row.priority || 'medium',
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    attachments: row.attachments || []
  };
}

function mapAppointmentToDB(userId: string, appt: Appointment) {
  const payload: any = {};
  if (appt.id !== undefined) payload.id = appt.id;
  payload.user_id = userId;
  if (appt.title !== undefined) payload.title = appt.title;
  if (appt.type !== undefined) payload.type = appt.type;
  if (appt.date !== undefined) payload.date = appt.date;
  if (appt.time !== undefined) payload.time = appt.time;
  if (appt.location !== undefined) payload.location = appt.location;
  if (appt.doctorName !== undefined) payload.doctor_name = appt.doctorName;
  if (appt.notes !== undefined) payload.notes = appt.notes;
  if (appt.groupId !== undefined) payload.group_id = appt.groupId === '' ? null : appt.groupId;
  // if (appt.priority !== undefined) payload.priority = appt.priority;
  // if (appt.linkedFileIds !== undefined) payload.linked_file_ids = appt.linkedFileIds;
  // if (appt.linkedSubjectIds !== undefined) payload.linked_subject_ids = appt.linkedSubjectIds;
  // if (appt.attachments !== undefined) payload.attachments = appt.attachments;
  return payload;
}

function mapScheduleItemFromDB(row: any): ScheduleItem {
  return {
    id: row.id,
    subjectId: row.subject_id,
    dayOfWeek: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    type: row.type,
    instructor: row.instructor,
    // The UI edits/renders the doctor name as `doctorName`; the DB column is
    // `instructor`. Keep both in sync so the name survives refreshes.
    doctorName: row.instructor || undefined,
    groupId: row.group_id,
    priority: row.priority || 'medium',
    attachments: row.attachments || []
  };
}

function mapScheduleItemToDB(userId: string, item: ScheduleItem) {
  const payload: any = {};
  if (item.id !== undefined) payload.id = item.id;
  payload.user_id = userId;
  if (item.subjectId !== undefined) payload.subject_id = item.subjectId;
  if (item.dayOfWeek !== undefined) payload.day = item.dayOfWeek;
  if (item.startTime !== undefined) payload.start_time = item.startTime;
  if (item.endTime !== undefined) payload.end_time = item.endTime;
  if (item.location !== undefined) payload.location = item.location;
  if (item.type !== undefined) payload.type = item.type;
  // Legacy live schema has a NOT NULL `title` column that the UI never
  // displays — supply a sensible value from the type. On fresh schemas
  // (created by the SQL migration, without title) the strip-and-retry logic
  // drops this key automatically.
  payload.title = (item as any).title || item.type || 'item';
  if (item.doctorName !== undefined || item.instructor !== undefined) {
    payload.instructor = item.doctorName ?? item.instructor;
  }
  // if (item.groupId !== undefined) payload.group_id = item.groupId === '' ? null : item.groupId;
  // if (item.priority !== undefined) payload.priority = item.priority;
  // if (item.attachments !== undefined) payload.attachments = item.attachments;
  return payload;
}

function mapTaskFromDB(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    isCompleted: row.completed,
    priority: row.priority || 'medium',
    type: row.type || 'task',
    linkedNoteIds: row.linked_note_ids || [],
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    groupId: row.group_id,
    attachments: row.attachments || []
  };
}

function mapTaskToDB(userId: string, task: Task) {
  const payload: any = {};
  if (task.id !== undefined) payload.id = task.id;
  payload.user_id = userId;
  if (task.title !== undefined) payload.title = task.title;
  if (task.description !== undefined) payload.description = task.description;
  if (task.date !== undefined) payload.date = task.date;
  if (task.isCompleted !== undefined) payload.completed = task.isCompleted;
  if (task.priority !== undefined) payload.priority = task.priority;
  // if (task.type !== undefined) payload.type = task.type;
  // if (task.linkedNoteIds !== undefined) payload.linked_note_ids = task.linkedNoteIds;
  // if (task.linkedFileIds !== undefined) payload.linked_file_ids = task.linkedFileIds;
  // if (task.linkedSubjectIds !== undefined) payload.linked_subject_ids = task.linkedSubjectIds;
  if (task.groupId !== undefined) payload.group_id = task.groupId === '' ? null : task.groupId;
  // if (task.attachments !== undefined) payload.attachments = task.attachments;
  return payload;
}

function mapNoteFromDB(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    priority: row.priority || 'medium',
    linkedTaskIds: row.linked_task_ids || [],
    linkedFileIds: row.linked_file_ids || [],
    linkedSubjectIds: row.linked_subject_ids || [],
    groupId: row.group_id,
    attachments: row.attachments || []
  };
}

function mapNoteToDB(userId: string, note: Note) {
  const payload: any = {};
  if (note.id !== undefined) payload.id = note.id;
  payload.user_id = userId;
  if (note.title !== undefined) payload.title = note.title;
  if (note.content !== undefined) payload.content = note.content;
  if (note.date !== undefined) payload.date = note.date;
  // if (note.priority !== undefined) payload.priority = note.priority;
  // if (note.linkedTaskIds !== undefined) payload.linked_task_ids = note.linkedTaskIds;
  // if (note.linkedFileIds !== undefined) payload.linked_file_ids = note.linkedFileIds;
  // if (note.linkedSubjectIds !== undefined) payload.linked_subject_ids = note.linkedSubjectIds;
  if (note.groupId !== undefined) payload.group_id = note.groupId === '' ? null : note.groupId;
  // if (note.attachments !== undefined) payload.attachments = note.attachments;
  return payload;
}

function mapDriveFileFromDB(row: any): DriveFile {
  return {
    id: row.id,
    name: row.name,
    size: row.size,
    type: row.type,
    url: row.url,
    createdAt: row.upload_date,
    parentId: row.parent_id,
    b2FileId: row.b2_file_id,
    yearIndex: row.year_index ?? undefined,
    semesterIndex: row.semester_index ?? undefined
  };
}

function mapUniversityDatabaseFromDB(row: any): UniversityDatabase {
  const specMeta = Array.isArray(row.grading_scale)
    ? row.grading_scale.find((g: any) => g && g.id === '__spec_meta__')
    : null;
  const collegeMeta = Array.isArray(row.grading_scale)
    ? row.grading_scale.find((g: any) => g && g.id === '__college_meta__')
    : null;

  const isSpecialization = Boolean(
    row.is_specialization !== undefined
      ? row.is_specialization
      : (specMeta?.isSpecialization || row.isSpecialization)
  );

  const parentDatabaseId = row.parent_database_id || specMeta?.parentDatabaseId || row.parentDatabaseId || undefined;
  const specializationNameAr = row.specialization_name_ar || specMeta?.specializationNameAr || row.specializationNameAr || undefined;
  const specializationNameEn = row.specialization_name_en || specMeta?.specializationNameEn || row.specializationNameEn || undefined;

  const rawSpecStartYr = row.specialization_start_year ?? specMeta?.specializationStartYear ?? collegeMeta?.specializationStartYear ?? row.specializationStartYear;
  const specializationStartYear = rawSpecStartYr !== undefined && rawSpecStartYr !== null && !isNaN(Number(rawSpecStartYr)) ? Number(rawSpecStartYr) : 2;

  const rawSpecStartSem = row.specialization_start_semester ?? specMeta?.specializationStartSemester ?? collegeMeta?.specializationStartSemester ?? row.specializationStartSemester;
  const specializationStartSemester = rawSpecStartSem !== undefined && rawSpecStartSem !== null && !isNaN(Number(rawSpecStartSem)) ? Number(rawSpecStartSem) : 1;

  const cleanGradingScale = Array.isArray(row.grading_scale)
    ? row.grading_scale.filter((g: any) => g && !String(g.id || '').startsWith('__') && (typeof g.points === 'number' || !isNaN(Number(g.points))))
    : [];

  const rawAvailableYears = row.available_years ?? specMeta?.availableYears ?? collegeMeta?.availableYears ?? row.availableYears;
  const availableYears = Array.isArray(rawAvailableYears)
    ? rawAvailableYears
    : [1];

  return {
    id: row.id,
    universityNameAr: row.university_name_ar || '',
    universityNameEn: row.university_name_en || '',
    collegeNameAr: row.college_name_ar || '',
    collegeNameEn: row.college_name_en || '',
    sourceUserId: row.source_user_id,
    sourceUserEmail: row.source_user_email || '',
    sourceUserName: row.source_user_name || '',
    totalYears: row.total_years || 4,
    semestersPerYear: row.semesters_per_year || 2,
    availableYears,
    isVisible: row.is_visible !== false && row.isVisible !== false,
    isSpecialization,
    parentDatabaseId,
    specializationNameAr,
    specializationNameEn,
    specializationStartYear,
    specializationStartSemester,
    subjects: (row.subjects || []).map((s: any) => ({
      id: s.id,
      code: s.code || '',
      name: s.name || '',
      creditHours: Number(s.creditHours || s.credit_hours || 3),
      totalMarks: Number(s.totalMarks || s.total_marks || 100),
      yearIndex: Number(s.yearIndex || s.year_index || 1),
      semesterIndex: Number(s.semesterIndex || s.semester_index || 1),
      distributions: s.distributions || [],
      status: s.status || 'current',
      includeInGpa: s.includeInGpa !== false
    })),
    driveFiles: (row.drive_files || []).map((f: any) => ({
      id: f.id,
      name: f.name || '',
      size: Number(f.size || 0),
      type: f.type || 'file',
      parentId: f.parentId || f.parent_id || null,
      createdAt: f.createdAt || f.upload_date || new Date().toISOString(),
      url: f.url || '',
      b2FileId: f.b2FileId || f.b2_file_id
    })),
    gradingScale: cleanGradingScale,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

function mapPendingUpdateFromDB(row: any): UniversityPendingUpdate {
  return {
    id: row.id,
    universityDatabaseId: row.university_database_id,
    universityName: row.university_name,
    collegeName: row.college_name,
    isSpecialization: row.is_specialization || false,
    specializationName: row.specialization_name,
    sourceUserId: row.source_user_id,
    sourceUserEmail: row.source_user_email || '',
    sourceUserName: row.source_user_name || '',
    type: row.type,
    description: row.description || '',
    data: row.data || {},
    status: row.status || 'pending',
    createdAt: row.created_at || new Date().toISOString(),
    resolvedAt: row.resolved_at
  };
}
