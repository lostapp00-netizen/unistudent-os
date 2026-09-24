/**
 * Read-only audit for the university databases.
 *
 * It never writes anything — it only reports the symptoms of the item-loss bug
 * that the item-level patch migration fixes:
 *   - duplicated drive items / subjects (created when an update failed to match
 *     its target and a second copy was pushed)
 *   - orphaned items (parentId pointing at a row that no longer exists)
 *   - approved pending updates whose target item is no longer in the database
 *
 * Usage:
 *   npx tsx scripts/audit-university-drive.ts
 *
 * Env (falls back to VITE_* used by the app):
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

if (!url || !key) {
  console.error('Missing Supabase credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY or VITE_*).');
  process.exit(1);
}

const supabase = createClient(url, key);

const norm = (value: any) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/\s+/g, ' ');

interface Issue {
  database: string;
  kind: string;
  detail: string;
}

function auditRow(row: any): Issue[] {
  const label = `${row.college_name_ar || row.college_name_en || row.id}${row.cohort_name ? ` / ${row.cohort_name}` : ''}`;
  const issues: Issue[] = [];

  const drive: any[] = Array.isArray(row.drive_files) ? row.drive_files : [];
  const subjects: any[] = Array.isArray(row.subjects) ? row.subjects : [];

  // 1. Duplicated drive items (same name + type + parent)
  const driveKeys = new Map<string, any[]>();
  for (const item of drive) {
    if (!item || !item.name) continue;
    const parentId = item.parentId ?? item.parent_id ?? null;
    const key = `${norm(item.name)}|${item.type || 'file'}|${parentId || 'root'}`;
    if (!driveKeys.has(key)) driveKeys.set(key, []);
    driveKeys.get(key)!.push(item);
  }
  for (const [key, items] of driveKeys) {
    if (items.length > 1) {
      issues.push({
        database: label,
        kind: 'duplicate-drive-item',
        detail: `${items.length}× "${items[0].name}" (${items[0].type}) ids=[${items.map(i => i.id).join(', ')}]`
      });
    }
  }

  // 2. Duplicated subjects (same name + year + semester)
  const subjectKeys = new Map<string, any[]>();
  for (const subject of subjects) {
    if (!subject || !subject.name) continue;
    const key = `${norm(subject.name)}|${subject.yearIndex ?? subject.year_index ?? 1}|${subject.semesterIndex ?? subject.semester_index ?? 1}`;
    if (!subjectKeys.has(key)) subjectKeys.set(key, []);
    subjectKeys.get(key)!.push(subject);
  }
  for (const [, items] of subjectKeys) {
    if (items.length > 1) {
      issues.push({
        database: label,
        kind: 'duplicate-subject',
        detail: `${items.length}× "${items[0].name}" ids=[${items.map(i => i.id).join(', ')}]`
      });
    }
  }

  // 3. Orphaned drive items (parent row missing)
  const ids = new Set(drive.map(i => i?.id).filter(Boolean));
  for (const item of drive) {
    const parentId = item?.parentId ?? item?.parent_id ?? null;
    if (parentId && !ids.has(parentId)) {
      issues.push({
        database: label,
        kind: 'orphan-drive-item',
        detail: `"${item.name}" (${item.id}) references missing parent ${parentId}`
      });
    }
  }

  // 4. Drive items linked to a missing subject
  const subjectIds = new Set(subjects.map(s => s?.id).filter(Boolean));
  for (const item of drive) {
    const subjectId = item?.subjectId ?? item?.subject_id ?? null;
    if (subjectId && !subjectIds.has(subjectId)) {
      issues.push({
        database: label,
        kind: 'missing-subject-link',
        detail: `"${item.name}" (${item.id}) references missing subject ${subjectId}`
      });
    }
  }

  return issues;
}

async function main() {
  console.log('Auditing university databases (read-only)...\n');

  const { data: rows, error } = await supabase
    .from('university_databases')
    .select('id, college_name_ar, college_name_en, cohort_name, drive_files, subjects');
  if (error) {
    console.error('Could not read university_databases:', error.message);
    process.exit(1);
  }

  const issues: Issue[] = [];
  const byId = new Map<string, any>();
  for (const row of rows || []) {
    byId.set(row.id, row);
    issues.push(...auditRow(row));
  }

  // 5. Approved updates whose target item is gone
  const { data: updates, error: updatesError } = await supabase
    .from('university_pending_updates')
    .select('id, university_database_id, type, description, data, status')
    .in('type', ['update_file', 'delete_file', 'update_subject', 'delete_subject'])
    .in('status', ['approved', 'pending'])
    .limit(2000);

  if (updatesError) {
    console.warn('Could not read university_pending_updates:', updatesError.message);
  } else {
    for (const update of updates || []) {
      const row = byId.get(update.university_database_id);
      if (!row) continue;
      const data = update.data || {};
      const templateId = data.universityTemplateId || data.university_template_id;
      if (!templateId) {
        issues.push({
          database: row.college_name_ar || row.id,
          kind: 'update-without-identity',
          detail: `${update.type} (${update.description || update.id}) has no universityTemplateId — it can only be matched by name`
        });
        continue;
      }
      const list = update.type.includes('subject') ? row.subjects || [] : row.drive_files || [];
      if (!list.some((item: any) => item?.id === templateId)) {
        issues.push({
          database: row.college_name_ar || row.id,
          kind: 'update-target-missing',
          detail: `${update.type} (${update.description || update.id}) targets ${templateId}, which no longer exists`
        });
      }
    }
  }

  if (issues.length === 0) {
    console.log(`No problems found across ${rows?.length || 0} database row(s).`);
    return;
  }

  const grouped = new Map<string, Issue[]>();
  for (const issue of issues) {
    if (!grouped.has(issue.kind)) grouped.set(issue.kind, []);
    grouped.get(issue.kind)!.push(issue);
  }

  console.log(`Found ${issues.length} issue(s) across ${rows?.length || 0} database row(s):\n`);
  for (const [kind, list] of grouped) {
    console.log(`── ${kind} (${list.length}) ──`);
    for (const issue of list.slice(0, 50)) {
      console.log(`   [${issue.database}] ${issue.detail}`);
    }
    if (list.length > 50) console.log(`   ... and ${list.length - 50} more`);
    console.log('');
  }
  console.log('Note: this report is read-only. De-duplication and restoration are manual decisions.');
}

main().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
