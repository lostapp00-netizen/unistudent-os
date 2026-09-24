/**
 * Behaviour checks for item-level university-database patching.
 *
 * They pin down the exact bug that made items disappear: an approved student
 * edit must update the SAME database row (matched by identity), must never
 * remove anything implicitly, and must never leave a duplicate behind.
 *
 * Run:
 *   npx esbuild scripts/verify-university-item-patch.ts --bundle --platform=node --format=esm --outfile=scripts/_verify.mjs --define:import.meta.env="{\"VITE_SUPABASE_URL\":\"http://localhost:54321\",\"VITE_SUPABASE_ANON_KEY\":\"test-key\"}" --log-level=error && node scripts/_verify.mjs
 */
import {
  applyPendingUpdateToDatabaseDetailed,
  upsertItemsById,
  removeItemsById,
  removeDriveItemsById
} from '../src/lib/db';
import type { UniversityDatabase, DriveFile, UniversityPendingUpdate } from '../src/types';

let failures = 0;
function check(label: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

const baseDrive: DriveFile[] = [
  { id: 'row-folder', name: 'المحاضرات', size: 0, type: 'folder', parentId: null, createdAt: '2026-01-01' },
  { id: 'row-file', name: 'ملف قديم.pdf', size: 10, type: 'file', parentId: 'row-folder', createdAt: '2026-01-01', url: 'https://x/1' },
  { id: 'row-file-2', name: 'ملف تاني.pdf', size: 20, type: 'file', parentId: 'row-folder', createdAt: '2026-01-01', url: 'https://x/2' }
];

const baseDb = {
  id: 'db-1',
  universityNameAr: 'جامعة',
  universityNameEn: 'Uni',
  collegeNameAr: 'كلية',
  collegeNameEn: 'College',
  totalYears: 4,
  semestersPerYear: 2,
  availableYears: [1, 2],
  isVisible: true,
  isSpecialization: false,
  subjects: [
    { id: 'sub-1', code: 'CS101', name: 'برمجة', creditHours: 3, totalMarks: 100, yearIndex: 1, semesterIndex: 1, distributions: [], status: 'current', includeInGpa: true },
    { id: 'sub-2', code: 'CS102', name: 'رياضيات', creditHours: 3, totalMarks: 100, yearIndex: 1, semesterIndex: 1, distributions: [], status: 'current', includeInGpa: true }
  ],
  driveFiles: baseDrive.map(f => ({ ...f })),
  gradingScale: [{ id: 'g1', minScore: 90, points: 4, grade: 'A' }],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
} as unknown as UniversityDatabase;

const renameUpdate = {
  id: 'u1',
  type: 'update_file',
  universityDatabaseId: 'db-1',
  data: {
    id: 'local-file-uuid',
    universityTemplateId: 'row-file',
    name: 'ملف جديد.pdf',
    type: 'file',
    url: 'https://x/1',
    parentId: 'local-folder-uuid',
    parentName: 'المحاضرات',
    yearIndex: 3,
    semesterIndex: 2,
    previous: { id: 'local-file-uuid', name: 'ملف قديم.pdf', parentId: 'local-folder-uuid', yearIndex: 1, semesterIndex: 1 }
  },
  status: 'pending'
} as unknown as UniversityPendingUpdate;

console.log('\n1) Rename from a student (no explicit move)');
const renamed = applyPendingUpdateToDatabaseDetailed(baseDb, renameUpdate);
const renamedItem = renamed.db.driveFiles.find(f => f.id === 'row-file');
check('target item keeps its row id', Boolean(renamedItem));
check('name was updated', renamedItem?.name === 'ملف جديد.pdf', renamedItem?.name);
check('placement did not follow the student (folder)', renamedItem?.parentId === 'row-folder', renamedItem?.parentId);
check('placement did not follow the student (year)', renamedItem?.yearIndex === undefined || renamedItem?.yearIndex === 1, renamedItem?.yearIndex);
check('no duplicate was created', renamed.db.driveFiles.length === baseDrive.length, renamed.db.driveFiles.length);
check('nothing was removed', renamed.removedDriveFileIds.length === 0, renamed.removedDriveFileIds);
check('other items untouched', renamed.db.driveFiles.some(f => f.id === 'row-file-2'));
check('no warnings', renamed.warnings.length === 0, renamed.warnings);

console.log('\n2) Rename from a student WITH an explicit move');
const moved = applyPendingUpdateToDatabaseDetailed(baseDb, {
  ...renameUpdate,
  data: { ...renameUpdate.data, parentId: null, changedFields: ['name', 'parentId'] }
} as unknown as UniversityPendingUpdate);
const movedItem = moved.db.driveFiles.find(f => f.id === 'row-file');
check('explicit move is honoured', movedItem?.parentId === null, movedItem?.parentId);
check('still the same row id', movedItem?.id === 'row-file');

console.log('\n3a) Unmatched edit of a database-derived item must not fabricate a duplicate');
const unmatched = applyPendingUpdateToDatabaseDetailed(baseDb, {
  ...renameUpdate,
  data: {
    id: 'ghost',
    universityTemplateId: 'row-that-no-longer-exists',
    name: 'ملف اتغير اسمه.pdf',
    type: 'file',
    previous: { id: 'ghost', name: 'ملف مش موجود.pdf' }
  }
} as unknown as UniversityPendingUpdate);
check('no new item pushed', unmatched.db.driveFiles.length === baseDrive.length, unmatched.db.driveFiles.length);
check('a warning was reported', unmatched.warnings.length > 0, unmatched.warnings);

console.log('\n3b) The student\'s own upload is still added (with a note)');
const ownUpload = applyPendingUpdateToDatabaseDetailed(baseDb, {
  ...renameUpdate,
  data: {
    id: 'own-upload-uuid',
    name: 'ملف خاص بالطالب.pdf',
    type: 'file',
    parentId: 'row-folder',
    parentName: 'المحاضرات',
    previous: { id: 'own-upload-uuid', name: 'ملف خاص بالطالب.pdf' }
  }
} as unknown as UniversityPendingUpdate);
check('student upload added', ownUpload.db.driveFiles.length === baseDrive.length + 1, ownUpload.db.driveFiles.length);
check('a note was reported', ownUpload.warnings.length > 0, ownUpload.warnings);

console.log('\n4) Delete removes exactly one item and reports it');
const deleted = applyPendingUpdateToDatabaseDetailed(baseDb, {
  id: 'u2',
  type: 'delete_file',
  universityDatabaseId: 'db-1',
  data: {
    id: 'local-file-uuid',
    universityTemplateId: 'row-file',
    name: 'ملف قديم.pdf',
    type: 'file',
    parentId: 'row-folder',
    parentName: 'المحاضرات'
  },
  status: 'pending'
} as unknown as UniversityPendingUpdate);
check('exactly one item removed', deleted.removedDriveFileIds.length === 1, deleted.removedDriveFileIds);
check('the right item was removed', deleted.removedDriveFileIds[0] === 'row-file', deleted.removedDriveFileIds);
check('siblings survive', deleted.db.driveFiles.length === baseDrive.length - 1, deleted.db.driveFiles.length);

console.log('\n5) Deleting a folder cascades and is reported');
const folderDeleted = applyPendingUpdateToDatabaseDetailed(baseDb, {
  id: 'u3',
  type: 'delete_file',
  universityDatabaseId: 'db-1',
  data: { universityTemplateId: 'row-folder', name: 'المحاضرات', type: 'folder', parentId: null },
  status: 'pending'
} as unknown as UniversityPendingUpdate);
check('folder + children removed', folderDeleted.removedDriveFileIds.length === 3, folderDeleted.removedDriveFileIds);
check('database is empty', folderDeleted.db.driveFiles.length === 0, folderDeleted.db.driveFiles.length);

console.log('\n6) Subject edit keeps placement unless the student moved it');
const subjectEdit = applyPendingUpdateToDatabaseDetailed(baseDb, {
  id: 'u4',
  type: 'update_subject',
  universityDatabaseId: 'db-1',
  data: {
    id: 'local-sub-uuid',
    universityTemplateId: 'sub-1',
    name: 'برمجة متقدمة',
    code: 'CS101',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: 4,
    semesterIndex: 1,
    previous: { id: 'local-sub-uuid', name: 'برمجة', yearIndex: 1, semesterIndex: 1 }
  },
  status: 'pending'
} as unknown as UniversityPendingUpdate);
const editedSubject = subjectEdit.db.subjects.find(s => s.id === 'sub-1');
check('subject name updated', editedSubject?.name === 'برمجة متقدمة', editedSubject?.name);
check('subject year kept', Number(editedSubject?.yearIndex) === 1, editedSubject?.yearIndex);
check('no duplicate subject', subjectEdit.db.subjects.length === 2, subjectEdit.db.subjects.length);
check('nothing removed', subjectEdit.removedSubjectIds.length === 0, subjectEdit.removedSubjectIds);

console.log('\n7) Stale snapshot write cannot drop items');
const staleSnapshot = [baseDrive[0], { ...baseDrive[1], name: 'اسم محدث.pdf' }]; // missing row-file-2
const afterUpsert = upsertItemsById(baseDrive as any, staleSnapshot as any);
check('upsert keeps the item missing from the snapshot', afterUpsert.length === 3, afterUpsert.length);
check('upsert applied the rename', afterUpsert.find(f => f.id === 'row-file')?.name === 'اسم محدث.pdf');
const afterExplicitRemove = removeItemsById(afterUpsert as any, ['row-file-2']);
check('explicit removal still works', afterExplicitRemove.length === 2, afterExplicitRemove.length);
const cascade = removeDriveItemsById(baseDrive as any, ['row-folder']);
check('folder removal cascades', cascade.length === 0, cascade.length);
check('removing nothing changes nothing', removeDriveItemsById(baseDrive as any, []).length === 3);

console.log('\n8) Grading scale merge keeps rules that are missing from the payload');
const scaleEdit = applyPendingUpdateToDatabaseDetailed(baseDb, {
  id: 'u5',
  type: 'update_grading_scale',
  universityDatabaseId: 'db-1',
  data: { gradingScale: [{ id: 'g2', minScore: 80, points: 3, grade: 'B' }] },
  status: 'pending'
} as unknown as UniversityPendingUpdate);
check('existing rule preserved', scaleEdit.db.gradingScale.some((g: any) => g.id === 'g1'), scaleEdit.db.gradingScale);
check('new rule added', scaleEdit.db.gradingScale.some((g: any) => g.id === 'g2'));
check('a warning explains the merge', scaleEdit.warnings.length > 0, scaleEdit.warnings);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
