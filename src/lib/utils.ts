import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { DriveFile } from '../types';
import { normalizeSubjectName } from './academicTranslation';

/** Normalize a drive item name for comparison (handles Arabic variants). */
function normalizeName(value?: string | null): string {
  return normalizeSubjectName(value || '');
}

export function selectAcademicDriveFiles(
  files: Array<DriveFile | Record<string, any>>,
  structure: { specializationStartYear?: number; specializationStartSemester?: number; totalYears?: number; semestersPerYear?: number },
  isSpecialization: boolean,
  createId: () => string = () => crypto.randomUUID(),
  subjectIdMap?: Map<string, string>,
  studentSubjects?: Array<any>
): DriveFile[] {
  if (!files || !Array.isArray(files) || files.length === 0) return [];

  const parseNum = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    const n = Number(val);
    return !isNaN(n) && n > 0 ? n : undefined;
  };

  const startYear = Number(structure.specializationStartYear || 2);
  const startSemester = Number(structure.specializationStartSemester || 1);

  // Subject lookups if student subjects are available
  const subById = new Map<string, any>();
  const subByName = new Map<string, any>();
  if (studentSubjects && Array.isArray(studentSubjects)) {
    studentSubjects.forEach(s => {
      if (!s) return;
      if (s.id) subById.set(s.id, s);
      const norm = (s.name || '').trim().toLowerCase();
      if (norm) subByName.set(norm, s);
    });
  }

  // 1. Initial normalization
  const normalized: DriveFile[] = files.filter(Boolean).map(f => {
    let yearIdx = parseNum(f.yearIndex !== undefined ? f.yearIndex : ('year_index' in f ? f.year_index : undefined));
    let semIdx = parseNum(f.semesterIndex !== undefined ? f.semesterIndex : ('semester_index' in f ? f.semester_index : undefined));
    const subId = f.subjectId || ('subject_id' in f ? f.subject_id : undefined);

    // If yearIndex was not explicitly set on file/folder, infer from its linked subject
    if (yearIdx === undefined && subId && subById.has(subId)) {
      const parentSub = subById.get(subId);
      yearIdx = parseNum(parentSub.yearIndex ?? parentSub.year_index);
      semIdx = parseNum(parentSub.semesterIndex ?? parentSub.semester_index);
    }

    return {
      id: String(f.id || createId()),
      name: f.name || '',
      size: Number(f.size || 0),
      type: f.type || 'file',
      parentId: f.parentId || ('parent_id' in f ? f.parent_id : null) || null,
      createdAt: f.createdAt || ('upload_date' in f ? f.upload_date : '') || new Date().toISOString(),
      url: f.url || '',
      b2FileId: f.b2FileId || ('b2_file_id' in f ? f.b2_file_id : undefined),
      yearIndex: yearIdx,
      semesterIndex: semIdx,
      subjectId: subId
    };
  });

  const byId = new Map(normalized.map(f => [f.id, f]));

  // Build parent -> children map for hierarchy traversal
  const childrenMap = new Map<string, DriveFile[]>();
  normalized.forEach(f => {
    if (f.parentId) {
      const list = childrenMap.get(f.parentId) || [];
      list.push(f);
      childrenMap.set(f.parentId, list);
    }
  });

  // Helper to find inherited year/semester from ancestor folders
  const getInheritedMeta = (f: DriveFile): { yearIndex?: number; semesterIndex?: number; subjectId?: string } => {
    let curr = f;
    const visited = new Set<string>([f.id]);
    while (curr.parentId && !visited.has(curr.parentId)) {
      visited.add(curr.parentId);
      const parent = byId.get(curr.parentId);
      if (!parent) break;
      if (parent.yearIndex !== undefined && parent.yearIndex > 0) {
        return { yearIndex: parent.yearIndex, semesterIndex: parent.semesterIndex, subjectId: parent.subjectId };
      }
      if (parent.subjectId) {
        return { subjectId: parent.subjectId };
      }
      curr = parent;
    }
    return {};
  };

  // Helper to check if any descendant of a folder belongs to specialization
  const hasSpecDescendant = (folderId: string): boolean => {
    const children = childrenMap.get(folderId) || [];
    for (const child of children) {
      if (isSpecializationItem(child, false)) return true;
      if (child.type === 'folder' && hasSpecDescendant(child.id)) return true;
    }
    return false;
  };

  // Determine if a file or folder belongs to the specialization phase
  function isSpecializationItem(f: DriveFile, checkDescendants = true): boolean {
    // 1. If linked to a subject in subjectIdMap
    if (f.subjectId && subjectIdMap && subjectIdMap.has(f.subjectId)) {
      return isSpecialization;
    }

    // 2. If linked to a student subject with known year/term
    if (f.subjectId && subById.has(f.subjectId)) {
      const subj = subById.get(f.subjectId);
      const sY = parseNum(subj.yearIndex ?? subj.year_index) || 1;
      const sSem = parseNum(subj.semesterIndex ?? subj.semester_index) || 1;
      return sY > startYear || (sY === startYear && sSem >= startSemester);
    }

    // 3. If year and semester are explicitly set on the item
    if (f.yearIndex !== undefined && f.yearIndex > 0) {
      const y = f.yearIndex;
      const sem = f.semesterIndex || 1;
      return y > startYear || (y === startYear && sem >= startSemester);
    }

    // 4. Inherit from ancestor folder if available
    const inherited = getInheritedMeta(f);
    if (inherited.yearIndex !== undefined && inherited.yearIndex > 0) {
      const y = inherited.yearIndex;
      const sem = inherited.semesterIndex || 1;
      return y > startYear || (y === startYear && sem >= startSemester);
    }
    if (inherited.subjectId) {
      if (subjectIdMap && subjectIdMap.has(inherited.subjectId)) {
        return isSpecialization;
      }
      if (subById.has(inherited.subjectId)) {
        const subj = subById.get(inherited.subjectId);
        const sY = parseNum(subj.yearIndex ?? subj.year_index) || 1;
        const sSem = parseNum(subj.semesterIndex ?? subj.semester_index) || 1;
        return sY > startYear || (sY === startYear && sSem >= startSemester);
      }
    }

    // 5. For folders: if they contain specialization files/descendants and we are pulling specialization
    if (f.type === 'folder' && checkDescendants && hasSpecDescendant(f.id)) {
      return true;
    }

    // 6. Unassigned / general files belong to general cohort database
    return false;
  }

  const included = new Map<string, DriveFile>();

  // 1. Add matching files
  normalized.forEach(f => {
    if (f.type === 'file') {
      const itemIsSpec = isSpecializationItem(f);
      if (isSpecialization ? itemIsSpec : !itemIsSpec) {
        included.set(f.id, f);
      }
    }
  });

  // 2. Add matching folders or general folders
  normalized.forEach(f => {
    if (f.type === 'folder') {
      const folderIsSpec = isSpecializationItem(f, true);
      if (isSpecialization) {
        if (folderIsSpec) {
          included.set(f.id, f);
        }
      } else {
        if (!folderIsSpec) {
          included.set(f.id, f);
        }
      }
    }
  });

  // 3. Ensure all parent ancestor folders of included items are also included
  for (const item of Array.from(included.values())) {
    let parentId = item.parentId;
    const visited = new Set<string>([item.id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) break;
      included.set(parent.id, parent);
      parentId = parent.parentId;
    }
  }

  // 4. Map IDs to fresh IDs and remap parentId & subjectId
  const idMap = new Map(Array.from(included.keys(), id => [id, createId()]));

  return Array.from(included.values(), f => {
    let parentId = f.parentId;
    if (parentId && !included.has(parentId)) {
      parentId = null;
    }
    
    // Resolve subjectId mapping
    let mappedSubjectId: string | undefined = undefined;
    if (f.subjectId) {
      if (subjectIdMap && subjectIdMap.has(f.subjectId)) {
        mappedSubjectId = subjectIdMap.get(f.subjectId);
      } else if (subById.has(f.subjectId)) {
        const studentSub = subById.get(f.subjectId);
        const normName = (studentSub?.name || '').trim().toLowerCase();
        // Check if mapped by subject name in subjectIdMap
        if (subjectIdMap) {
          for (const [oldId, newId] of subjectIdMap.entries()) {
            const oldSub = subById.get(oldId);
            if (oldSub && (oldSub.name || '').trim().toLowerCase() === normName) {
              mappedSubjectId = newId;
              break;
            }
          }
        }
      }
    }

    return {
      ...f,
      id: idMap.get(f.id) || createId(),
      // Keep a permanent link back to the database row this item came from.
      // Ids are regenerated on every pull, so without this the approval step
      // could only match by name — and a failed name match is what created a
      // duplicate while the original quietly disappeared.
      originId: f.id,
      parentId: parentId ? (idMap.get(parentId) || null) : null,
      yearIndex: f.yearIndex,
      semesterIndex: f.semesterIndex,
      subjectId: mappedSubjectId
    };
  });
}

export function matchesDriveItem(file: DriveFile, template: DriveFile, parentId: string | null): boolean {
  if (file.universityTemplateId && file.universityTemplateId === template.id) return true;
  if ((file as any).originId && (file as any).originId === template.id) return true;
  if (file.id === template.id) return true;
  if (file.type !== template.type) return false;

  const isNameMatch = normalizeName(file.name) === normalizeName(template.name);
  const isUrlMatch = Boolean((file.b2FileId && template.b2FileId && file.b2FileId === template.b2FileId) ||
    (file.url && template.url && file.url === template.url));

  // Folders are identified by name; files may also match on identical content.
  const contentMatch = file.type === 'folder' ? isNameMatch : (isNameMatch || isUrlMatch);
  if (!contentMatch) return false;

  const fileParent = file.parentId || null;
  const targetParent = parentId || null;
  if (fileParent === targetParent) return true;

  // A null parent means "not resolved", not "sits at the root". Treating it as
  // a different place is what cloned a whole folder tree a second time: the same
  // shared folder chain exists in the college and specialization templates under
  // different ids, and one of the two copies was left parentless.
  // Only items that came from a template are matched this way — a personal
  // folder that happens to share a name with a template folder stays where it is.
  const fileIsTemplateDerived = Boolean(file.universityTemplateId || (file as any).originId);
  if (!fileIsTemplateDerived) return false;
  if (template.parentId && (fileParent === null || targetParent === null)) return true;

  return false;
}

export type DriveReconcileResult = {
  /** The healed drive: duplicates merged away, misplaced copies re-attached. */
  files: DriveFile[];
  /** Existing rows whose parent changed — apply with db.updateDriveFile. */
  moved: Array<{ id: string; parentId: string | null }>;
  /** Duplicate rows that were merged into a twin — apply with db.deleteDriveFile. */
  removedIds: string[];
};

/**
 * Heal the drive after a database restore/sync.
 *
 * Everything pulled from a university database carries `universityTemplateId`,
 * so a template-derived item can always be traced back to its template entry —
 * and from there to the local copy of its template parent. That is used twice:
 *
 *  1. a copy that was left at the root because its parent could not be resolved
 *     (or whose parent no longer exists) is re-attached where the template says
 *     it belongs, instead of living on as a second "big folder" with the same
 *     files inside;
 *  2. copies that ended up as siblings with the same name, type and content are
 *     collapsed into one, and anything that was inside the removed copy is
 *     re-parented onto the survivor, so nothing is orphaned.
 *
 * Personal items (no template link) are never deleted — they are only
 * re-parented when the folder they lived in was merged away.
 */
export function reconcileTemplateDriveFiles(
  localFiles: DriveFile[],
  templateFiles: DriveFile[]
): DriveReconcileResult {
  const files = (localFiles || []).filter(Boolean) as DriveFile[];
  const templates = (templateFiles || []).filter(Boolean) as DriveFile[];
  if (files.length === 0 || templates.length === 0) return { files, moved: [], removedIds: [] };

  const templateById = new Map(templates.map(t => [t.id, t]));
  const byId = new Map(files.map(f => [f.id, f]));

  // The local copy of each template item: the anchor this whole heal hangs on.
  const localByTemplateId = new Map<string, DriveFile>();
  for (const f of files) {
    const templateId = f.universityTemplateId || (f as any).originId;
    if (templateId && !localByTemplateId.has(templateId)) localByTemplateId.set(templateId, f);
  }

  const parentOverride = new Map<string, string | null>();
  const moved: Array<{ id: string; parentId: string | null }> = [];
  const removedIds: string[] = [];
  const keptByKey = new Map<string, DriveFile>();

  const isTemplateDerived = (f: DriveFile) => Boolean(f.universityTemplateId || (f as any).originId);

  // Parent-first walk so a folder is decided before its children, and so the
  // children of a merged-away copy can be re-attached to the survivor.
  const childrenOf = new Map<string, DriveFile[]>();
  const roots: DriveFile[] = [];
  for (const f of files) {
    const parentId = f.parentId && byId.has(f.parentId) ? f.parentId : null;
    if (!parentId) {
      roots.push(f);
      continue;
    }
    const siblings = childrenOf.get(parentId) || [];
    siblings.push(f);
    childrenOf.set(parentId, siblings);
  }

  /** Where the item currently lives (root when its parent is missing/gone). */
  const parentOf = (f: DriveFile): string | null => {
    if (parentOverride.has(f.id)) return parentOverride.get(f.id) as string | null;
    const current = f.parentId || null;
    return current && byId.has(current) ? current : null;
  };

  // Oldest first, so the copy that survives a merge is the original one — the
  // one the student's own items were placed in.
  const byAge = (a: DriveFile, b: DriveFile) =>
    String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
  roots.sort(byAge);
  childrenOf.forEach(siblings => siblings.sort(byAge));

  const visited = new Set<string>();
  const queue: DriveFile[] = [...roots];

  /** Merge a leftover copy into the copy that survived. */
  const mergeCopy = (file: DriveFile, survivor: DriveFile) => {
    removedIds.push(file.id);
    // Anything living in the removed copy — including items re-attached to it
    // above — moves onto the copy that survived.
    for (const candidate of files) {
      if (candidate.id === file.id || candidate.id === survivor.id) continue;
      const resolved = parentOverride.has(candidate.id)
        ? parentOverride.get(candidate.id)
        : (candidate.parentId || null);
      if (resolved === file.id) parentOverride.set(candidate.id, survivor.id);
    }
  };

  while (queue.length > 0) {
    const file = queue.shift() as DriveFile;
    if (visited.has(file.id)) continue;
    visited.add(file.id);
    (childrenOf.get(file.id) || []).forEach(child => queue.push(child));

    let parentId = parentOf(file);
    let survivor: DriveFile | undefined;

    // 1. A copy sitting at the root while the template says where it belongs is
    //    the leftover of an earlier pull whose parent could not be resolved.
    const templateId = file.universityTemplateId || (file as any).originId;
    const template = templateId ? templateById.get(templateId) : undefined;
    const isStrandedCopy = isTemplateDerived(file) && parentId === null && Boolean(template?.parentId);
    if (isStrandedCopy) {
      const localTemplateParent = localByTemplateId.get((template as DriveFile).parentId as string);
      if (localTemplateParent && localTemplateParent.id !== file.id) {
        parentId = localTemplateParent.id;
      } else if (!localTemplateParent) {
        // The template parent is not part of the linked databases at all, so the
        // right place cannot be recomputed. When exactly one placed copy of this
        // item exists elsewhere, this root copy is the leftover of the broken
        // pull and is merged into it instead of standing next to it as a second
        // big folder holding the same files.
        const placedTwins = files.filter(other =>
          other.id !== file.id &&
          isTemplateDerived(other) &&
          other.type === file.type &&
          normalizeName(other.name) === normalizeName(file.name) &&
          parentOf(other) !== null &&
          (file.type === 'folder' ||
            (!(file.b2FileId || file.url)) ||
            other.b2FileId === file.b2FileId ||
            (Boolean(file.url) && other.url === file.url))
        );
        if (placedTwins.length === 1) survivor = placedTwins[0];
      }
    }

    // 2. Same name, type and content in the same place is one item, not two.
    if (!survivor && isTemplateDerived(file)) {
      const key = [
        normalizeName(file.name),
        file.type,
        parentId || 'root',
        file.type === 'folder' ? '' : (file.b2FileId || file.url || '')
      ].join('|');
      survivor = keptByKey.get(key);
      if (!survivor) keptByKey.set(key, file);
    }

    if (survivor) {
      mergeCopy(file, survivor);
      continue;
    }

    if (parentId !== (file.parentId || null)) {
      parentOverride.set(file.id, parentId);
      moved.push({ id: file.id, parentId });
    }
  }

  const removedSet = new Set(removedIds);
  return { files: files.filter(f => !removedSet.has(f.id)), moved, removedIds };
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Time formatting (نظام ١٢ ساعة)
// ---------------------------------------------------------------------------
// Times are stored everywhere as 24-hour "HH:mm" strings so sorting and the
// database stay unchanged; only the display and the inputs use 12-hour form.

export type Meridiem = 'am' | 'pm';

export function parseTimeToParts(value?: string | null): { hour12: number; minute: number; meridiem: Meridiem } | null {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour24 = Math.min(23, Math.max(0, Number(match[1])));
  const minute = Math.min(59, Math.max(0, Number(match[2])));
  const meridiem: Meridiem = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, meridiem };
}

/** Convert a 12-hour selection back to the stored 24-hour "HH:mm" string. */
export function to24HourTime(hour12: number, minute: number, meridiem: Meridiem): string {
  const safeHour = Math.min(12, Math.max(1, Math.round(hour12)));
  const safeMinute = Math.min(59, Math.max(0, Math.round(minute)));
  let hour24 = safeHour % 12;
  if (meridiem === 'pm') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(safeMinute).padStart(2, '0')}`;
}

/** Render a stored "HH:mm" value as 12-hour text, e.g. "8:30 ص" or "8:30 AM". */
export function formatTime12(value?: string | null, locale: 'ar' | 'en' = 'en'): string {
  const parts = parseTimeToParts(value);
  if (!parts) return value || '';
  const label = locale === 'ar' ? (parts.meridiem === 'am' ? 'ص' : 'م') : (parts.meridiem === 'am' ? 'AM' : 'PM');
  return `${parts.hour12}:${String(parts.minute).padStart(2, '0')} ${label}`;
}

/** "08:00 - 10:00" rendered in 12-hour form. */
export function formatTimeRange12(start?: string | null, end?: string | null, locale: 'ar' | 'en' = 'en'): string {
  return `${formatTime12(start, locale)} - ${formatTime12(end, locale)}`;
}

// ---------------------------------------------------------------------------
// Cohorts (الدفعات الدراسية) helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a name for group-key comparisons (college / university names).
 * Trim, lowercase, collapse whitespace, strip Arabic tatweel and diacritics.
 */
export function normalizeGroupName(value?: string | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Stable group key identifying one college (inside one university) across all
 * its cohort database rows. Display-grouping only — data linking stays id-based.
 */
export function collegeGroupKey(
  universityNameAr?: string | null,
  universityNameEn?: string | null,
  collegeNameAr?: string | null,
  collegeNameEn?: string | null
): string {
  const uni = normalizeGroupName(universityNameAr) || normalizeGroupName(universityNameEn) || 'unknown-university';
  const col = normalizeGroupName(collegeNameAr) || normalizeGroupName(collegeNameEn) || 'unknown-college';
  return `${uni}::${col}`;
}

/** Current academic year range — the academic year starts in August. */
export function currentAcademicYearRange(): { start: number; end: number } {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return { start, end: start + 1 };
}

/** Auto cohort name for a given academic year range, e.g. 'دفعة 2026 - 2027'. */
export function autoCohortName(start?: number, end?: number): string {
  const range = start && end ? { start, end } : currentAcademicYearRange();
  return `دفعة ${range.start} - ${range.end}`;
}

/** Cohort display label with the academic year, e.g. 'دفعة 2026 - 2027 • سنة دراسية 2026 - 2027'. */
export function cohortLabel(
  cohort: { cohortName?: string; academicYearStart?: number; academicYearEnd?: number } | null | undefined,
  isAr: boolean = true
): string {
  const name = cohort?.cohortName?.trim() || (isAr ? 'الدفعة الحالية' : 'Current Cohort');
  if (cohort?.academicYearStart && cohort?.academicYearEnd) {
    return isAr
      ? `${name} • سنة دراسية ${cohort.academicYearStart} - ${cohort.academicYearEnd}`
      : `${name} • Academic year ${cohort.academicYearStart} - ${cohort.academicYearEnd}`;
  }
  return name;
}

/** Number of general/foundation subjects (before the specialization milestone). */
export function foundationSubjectsCount(db: {
  subjects?: Array<{ yearIndex?: number; semesterIndex?: number }>;
  specializationStartYear?: number;
  specializationStartSemester?: number;
}): number {
  const startYear = Number(db.specializationStartYear || 2);
  const startSem = Number(db.specializationStartSemester || 1);
  return (db.subjects || []).filter(s => {
    const y = Number(s.yearIndex || 1);
    const sem = Number(s.semesterIndex || 1);
    return y < startYear || (y === startYear && sem < startSem);
  }).length;
}

/**
 * Safely format date and time without throwing Invalid option: timeStyle errors
 */
export function formatDateTime(dateInput: string | number | Date | null | undefined, isAr: boolean = true): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString(isAr ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    try {
      return new Date(dateInput as any).toLocaleDateString();
    } catch {
      return String(dateInput);
    }
  }
}

/**
 * Helper to get Arabic/English academic evaluation (تقدير عام) based on CGPA
 */
export function getAcademicEvaluation(cgpa: number, isAr: boolean = true): string {
  if (cgpa >= 3.65) return isAr ? 'امتياز مع مرتبة الشرف' : 'Excellent with Honors';
  if (cgpa >= 3.5) return isAr ? 'امتياز' : 'Excellent';
  if (cgpa >= 3.0) return isAr ? 'جيد جداً' : 'Very Good';
  if (cgpa >= 2.5) return isAr ? 'جيد' : 'Good';
  if (cgpa >= 2.0) return isAr ? 'مقبول' : 'Pass';
  if (cgpa > 0) return isAr ? 'ضعيف (إنذار)' : 'Weak / Warning';
  return isAr ? 'غير محدد' : 'N/A';
}

