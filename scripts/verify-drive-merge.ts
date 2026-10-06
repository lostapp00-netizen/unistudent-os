/**
 * Behaviour checks for the drive merge (the "big folder appears twice" bug).
 *
 * A university database is a tree of folders and files. Pulling it must be
 * idempotent: pulling it again — or syncing after a pull where a parent could
 * not be resolved — must never add a second copy of a folder with the same
 * files inside. Items are matched by identity (universityTemplateId/originId)
 * first, and a copy left at the root is re-attached instead of duplicated.
 *
 * Run:
 *   npx tsx scripts/verify-drive-merge.ts
 */
import {
  selectAcademicDriveFiles,
  matchesDriveItem,
  reconcileTemplateDriveFiles,
  reattachOrphans,
  staleTemplateItemIds
} from '../src/lib/utils';
import type { DriveFile } from '../src/types';

let failures = 0;
function check(label: string, condition: boolean, extra?: any) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`, extra !== undefined ? JSON.stringify(extra) : '');
  }
}

function item(overrides: Partial<DriveFile> & { id: string; name: string }): DriveFile {
  return {
    size: 0,
    type: 'file',
    parentId: null,
    createdAt: '2026-01-01',
    ...overrides
  } as DriveFile;
}

/** The approved database: a big folder holding a sub-folder holding a file. */
const template: DriveFile[] = [
  item({ id: 'tpl-root', name: 'الترم الأول', type: 'folder' }),
  item({ id: 'tpl-sub', name: 'المحاضرات', type: 'folder', parentId: 'tpl-root' }),
  item({ id: 'tpl-file', name: 'محاضرة 1.pdf', parentId: 'tpl-sub', url: 'https://x/1', size: 10 })
];

const structure = { specializationStartYear: 2, specializationStartSemester: 1, totalYears: 4, semestersPerYear: 2 };

/**
 * A miniature of the store's import merge (useAppStore.importFromUniversityDatabase):
 * resolve the parent first, reuse the existing item when identity matches, and
 * only create a new row when nothing matches.
 */
function mergeTemplateIntoDrive(localDrive: DriveFile[], templateFiles: DriveFile[]) {
  const byId = new Map(templateFiles.map(f => [f.id, f]));
  const idMap = new Map<string, string>();
  const processed = new Set<string>();
  const added: DriveFile[] = [];

  const cloneFile = (file: DriveFile): void => {
    if (processed.has(file.id)) return;
    if (file.parentId) {
      const parent = byId.get(file.parentId);
      if (parent) cloneFile(parent);
    }
    processed.add(file.id);
    const newParentId = file.parentId ? (idMap.get(file.parentId) || null) : null;

    const templateTwin = localDrive.find(f => f.universityTemplateId === file.id);
    if (templateTwin) {
      idMap.set(file.id, templateTwin.id);
      return;
    }

    const twin = localDrive.find(f => matchesDriveItem(f, file, newParentId));
    if (twin) {
      idMap.set(file.id, twin.id);
      if (newParentId && !twin.parentId) twin.parentId = newParentId;
      return;
    }

    const newId = `new-${file.id}-${added.length}`;
    idMap.set(file.id, newId);
    const cloned = { ...file, id: newId, universityTemplateId: file.id, parentId: newParentId } as DriveFile;
    added.push(cloned);
    localDrive.push(cloned);
  };

  for (const file of templateFiles) cloneFile(file);
  return { added, idMap };
}

console.log('\n1) Pulling the database marks every item with its source identity');
{
  let seq = 0;
  const pulled = selectAcademicDriveFiles(template, structure, false, () => `L${++seq}`);
  check('every item was pulled', pulled.length === 3, pulled.map(f => f.name));
  check('every item keeps its source row id', pulled.every(f => Boolean(f.originId)), pulled.map(f => f.originId));
  check(
    'originId points back at the database row',
    pulled.map(f => f.originId).sort().join(',') === 'tpl-file,tpl-root,tpl-sub',
    pulled.map(f => f.originId)
  );
  const root = pulled.find(f => f.originId === 'tpl-root')!;
  const sub = pulled.find(f => f.originId === 'tpl-sub')!;
  const file = pulled.find(f => f.originId === 'tpl-file')!;
  check('the parent chain is remapped, not lost', sub.parentId === root.id, { sub: sub.parentId, root: root.id });
  check('the file sits inside the sub-folder', file.parentId === sub.id);
}

console.log('\n2) Pulling the same database twice adds nothing');
{
  let seq = 0;
  const pulled = selectAcademicDriveFiles(template, structure, false, () => `L${++seq}`);
  const localDrive: DriveFile[] = pulled.map(f => ({ ...f, universityTemplateId: f.originId as string }));
  const { added } = mergeTemplateIntoDrive(localDrive, template);
  check('no new item was created', added.length === 0, added.map(f => f.name));
  check('the drive still holds exactly three items', localDrive.length === 3, localDrive.length);
  const sub = localDrive.find(f => f.originId === 'tpl-sub')!;
  const file = localDrive.find(f => f.originId === 'tpl-file')!;
  check('the big folder is still single', localDrive.filter(f => f.name === 'الترم الأول').length === 1);
  check('the sub-folder did not move', sub.parentId === localDrive.find(f => f.originId === 'tpl-root')!.id);
  check('the file is still inside the sub-folder', file.parentId === sub.id);
}

console.log('\n3) A copy left at the root is re-attached, not duplicated');
{
  // What an earlier pull left behind: the sub-folder and its file could not be
  // resolved, so they sit at the root instead of inside "الترم الأول".
  const localDrive: DriveFile[] = [
    item({ id: 'L0', name: 'الترم الأول', type: 'folder', universityTemplateId: 'tpl-root' }),
    item({ id: 'L1', name: 'المحاضرات', type: 'folder', parentId: null, originId: 'tpl-sub' }),
    item({ id: 'L2', name: 'محاضرة 1.pdf', parentId: null, originId: 'tpl-file', url: 'https://x/1', size: 10 })
  ];

  const { added } = mergeTemplateIntoDrive(localDrive, template);
  check('no duplicate folder was created', localDrive.filter(f => f.type === 'folder' && f.name === 'المحاضرات').length === 1, localDrive.length);
  check('no new item at all', added.length === 0, added.map(f => f.name));
  check('the stranded folder was moved under its real parent', localDrive.find(f => f.id === 'L1')!.parentId === 'L0');
  check('the stranded file was moved into its folder', localDrive.find(f => f.id === 'L2')!.parentId === 'L1');
}

console.log('\n4) Identity beats a guessed parent, and personal items never merge');
{
  check('same template id always matches', matchesDriveItem(item({ id: 'x', name: 'أي اسم', universityTemplateId: 'tpl-sub' }), template[1], 'anything'));
  check('originId matches too', matchesDriveItem(item({ id: 'x', name: 'أي اسم', originId: 'tpl-sub' } as any), template[1], null));

  const personalRoot = item({ id: 'p1', name: 'المحاضرات', type: 'folder', parentId: null });
  check(
    'a personal folder with the same name is not merged',
    matchesDriveItem(personalRoot, template[1], 'L0') === false
  );

  const templateCopy = item({ id: 'p2', name: 'المحاضرات', type: 'folder', parentId: null, originId: 'tpl-sub' } as any);
  check(
    'a template copy at the root matches its template folder',
    matchesDriveItem(templateCopy, template[1], 'L0') === true
  );

  const elsewhere = item({ id: 'p3', name: 'المحاضرات', type: 'folder', parentId: 'other' });
  check('same name in a different known place is a different item', matchesDriveItem(elsewhere, template[1], 'L0') === false);

  const wrongType = item({ id: 'p4', name: 'المحاضرات', type: 'file' });
  check('a file never matches a folder', matchesDriveItem(wrongType, template[1], null) === false);

  const otherName = item({ id: 'p5', name: 'السكاشن', type: 'folder', parentId: null, originId: 'tpl-sub' } as any);
  check('identity wins even after a rename', matchesDriveItem(otherName, template[1], 'L0') === true);
}

console.log('\n5) The heal step collapses a duplication that already happened');
{
  const localDrive: DriveFile[] = [
    item({ id: 'D-root', name: 'الترم الأول', type: 'folder', universityTemplateId: 'tpl-root', createdAt: '2026-01-01' }),
    item({ id: 'D-sub', name: 'المحاضرات', type: 'folder', parentId: 'D-root', universityTemplateId: 'tpl-sub', createdAt: '2026-01-02' }),
    item({ id: 'D-file', name: 'محاضرة 1.pdf', parentId: 'D-sub', universityTemplateId: 'tpl-file', url: 'https://x/1', size: 10, createdAt: '2026-01-03' }),
    // leftover of the broken pull: same folder, same content, sitting at the root
    item({ id: 'D-sub-copy', name: 'المحاضرات', type: 'folder', parentId: null, universityTemplateId: 'tpl-sub', createdAt: '2026-02-01' }),
    // the student's own file lived inside the leftover copy
    item({ id: 'D-note', name: 'ملاحظة شخصية.txt', parentId: 'D-sub-copy', createdAt: '2026-02-02' })
  ];

  const healed = reconcileTemplateDriveFiles(localDrive, template);
  check('the leftover copy was removed', healed.removedIds.includes('D-sub-copy'), healed.removedIds);
  check('the original folder survived', healed.files.some(f => f.id === 'D-sub'));
  check('nothing else was removed', healed.removedIds.length === 1, healed.removedIds);
  check('the drive shrank by exactly the duplicate', healed.files.length === localDrive.length - 1, healed.files.length);
  check('the student file was not deleted', healed.files.some(f => f.id === 'D-note'));
  const noteMove = healed.moved.find(m => m.id === 'D-note');
  check('the student file moved into the surviving folder', noteMove?.parentId === 'D-sub', noteMove);
  check('the surviving folder stayed where it was', healed.moved.every(m => m.id !== 'D-sub') && healed.moved.every(m => m.id !== 'D-root'));
  check('the real file was left alone', healed.moved.every(m => m.id !== 'D-file'));
}

console.log('\n6) Personal items are never touched by the heal');
{
  const personalOnly: DriveFile[] = [
    item({ id: 'me-1', name: 'ملفاتي', type: 'folder', parentId: null }),
    item({ id: 'me-2', name: 'مشروع.pdf', parentId: 'me-1' })
  ];
  const healed = reconcileTemplateDriveFiles(personalOnly, template);
  check('nothing removed', healed.removedIds.length === 0, healed.removedIds);
  check('nothing moved', healed.moved.length === 0, healed.moved);
  check('the drive is untouched', healed.files.length === 2);
}

console.log('\n7) Orphans are re-attached instead of vanishing');
{
  const localFiles: DriveFile[] = [
    item({ id: 'kept', name: 'مجلد', type: 'folder', parentId: null }),
    item({ id: 'orphan', name: 'ملف.pdf', parentId: 'gone' })
  ];
  const known: DriveFile[] = [
    ...localFiles,
    item({ id: 'gone', name: 'مجلد محذوف', type: 'folder', parentId: 'kept' })
  ];
  const healed = reattachOrphans(localFiles, known);
  const move = healed.moved.find(m => m.id === 'orphan');
  check('the orphan follows the nearest surviving ancestor', move?.parentId === 'kept', move);
  check('the untouched folder is not reported as moved', healed.moved.every(m => m.id !== 'kept'));

  const topLevel: DriveFile[] = [
    item({ id: 'orphan2', name: 'ملف.pdf', parentId: 'gone-too' })
  ];
  const lifted = reattachOrphans(topLevel, [...topLevel, item({ id: 'gone-too', name: 'قديم', type: 'folder', parentId: null })]);
  check('with no surviving ancestor it is lifted to the root', lifted.files[0].parentId === null, lifted.files[0]);
}

console.log('\n8) Items the database no longer has are reported, personal ones are not');
{
  const localFiles: DriveFile[] = [
    item({ id: 's1', name: 'قديم.pdf', universityTemplateId: 'tpl-gone' }),
    item({ id: 's2', name: 'محاضرة 1.pdf', universityTemplateId: 'tpl-file' }),
    item({ id: 's3', name: 'ملفي.pdf', originId: 'tpl-gone-2' } as any),
    item({ id: 's4', name: 'ملاحظتي.txt' })
  ];
  const doomed = staleTemplateItemIds(localFiles, ['tpl-file']);
  check('stale template copies are reported', doomed.includes('s1') && doomed.includes('s3'), doomed);
  check('live template copies are kept', !doomed.includes('s2'));
  check('personal items are never reported', !doomed.includes('s4'));
}

console.log('\n9) A deep chain is pulled once and stays single');
{
  let seq = 0;
  const deepTemplate: DriveFile[] = [
    item({ id: 'd1', name: 'السنة الأولى', type: 'folder' }),
    item({ id: 'd2', name: 'الترم الأول', type: 'folder', parentId: 'd1' }),
    item({ id: 'd3', name: 'المحاضرات', type: 'folder', parentId: 'd2' }),
    item({ id: 'd4', name: 'سكاشن', type: 'folder', parentId: 'd2' }),
    item({ id: 'd5', name: 'م1.pdf', parentId: 'd3', url: 'https://x/a' }),
    item({ id: 'd6', name: 'م2.pdf', parentId: 'd3', url: 'https://x/b' })
  ];
  const pulled = selectAcademicDriveFiles(deepTemplate, structure, false, () => `L${++seq}`);
  const localDrive: DriveFile[] = pulled.map(f => ({ ...f, universityTemplateId: f.originId as string }));
  const firstCount = localDrive.length;
  mergeTemplateIntoDrive(localDrive, deepTemplate);
  mergeTemplateIntoDrive(localDrive, deepTemplate);
  check('two extra merges add nothing', localDrive.length === firstCount, { before: firstCount, after: localDrive.length });
  const d3 = localDrive.find(f => f.originId === 'd3')!;
  const d2 = localDrive.find(f => f.originId === 'd2')!;
  check('every folder appears exactly once', localDrive.filter(f => f.type === 'folder').length === 4, localDrive.filter(f => f.type === 'folder').map(f => f.name));
  check('the deepest folder kept its parent', d3.parentId === d2.id);
  check('both files stayed inside it', localDrive.filter(f => f.parentId === d3.id).length === 2);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
