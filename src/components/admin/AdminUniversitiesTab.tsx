import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { 
  Building2, 
  GraduationCap, 
  Search, 
  Plus, 
  BookOpen, 
  HardDrive, 
  Calendar, 
  Clock, 
  Check, 
  X, 
  Trash2, 
  Edit2, 
  Sparkles, 
  Users, 
  Folder, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  ArrowLeft,
  ChevronDown,
  Layers,
  Info,
  ShieldCheck,
  Loader2,
  BellRing
} from 'lucide-react';
import { db } from '../../lib/db';
import { UniversityDatabase, UniversityPendingUpdate, Subject, DriveFile, GradeDistributionItem } from '../../types';
import { ConfirmModal } from '../ui/CustomModal';

interface AdminUniversitiesTabProps {
  studentsList: any[];
  onRefreshAllData: () => Promise<void>;
}

export function AdminUniversitiesTab({ studentsList, onRefreshAllData }: AdminUniversitiesTabProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState<UniversityDatabase[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<UniversityPendingUpdate[]>([]);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversityFilter, setSelectedUniversityFilter] = useState('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedDb, setSelectedDb] = useState<UniversityDatabase | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'overview' | 'subjects' | 'drive' | 'updates' | 'students'>('subjects');
  const [dbToDelete, setDbToDelete] = useState<UniversityDatabase | null>(null);

  // Subject Edit / Add in University DB
  const [isEditingSubject, setIsEditingSubject] = useState(false);
  const [editingSubjectData, setEditingSubjectData] = useState<Subject | null>(null);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectData, setNewSubjectData] = useState<Partial<Subject>>({
    name: '',
    code: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: 1,
    semesterIndex: 1,
    distributions: [
      { id: '1', name: 'ميدتيرم', maxMarks: 20, achievedMarks: null, status: 'current' },
      { id: '2', name: 'أعمال سنة', maxMarks: 20, achievedMarks: null, status: 'current' },
      { id: '3', name: 'فاينل', maxMarks: 60, achievedMarks: null, status: 'current' }
    ]
  });

  // Create University DB Form
  const [createForm, setCreateForm] = useState({
    universityNameAr: '',
    universityNameEn: '',
    collegeNameAr: '',
    collegeNameEn: '',
    sourceUserId: ''
  });
  const [creating, setCreating] = useState(false);

  // Load Data
  const loadUniData = async () => {
    try {
      setLoading(true);
      const [dbs, updates] = await Promise.all([
        db.getUniversityDatabases(),
        db.getPendingUpdates()
      ]);
      setDatabases(dbs);
      setPendingUpdates(updates);
      if (selectedDb) {
        const refreshedSelected = dbs.find(d => d.id === selectedDb.id);
        if (refreshedSelected) setSelectedDb(refreshedSelected);
      }
    } catch (e) {
      console.error('Error loading university databases:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUniData();
  }, []);

  // Filter Databases
  const filteredDatabases = databases.filter(dbItem => {
    if (selectedUniversityFilter !== 'all') {
      const matchUni = (dbItem.universityNameAr === selectedUniversityFilter || dbItem.universityNameEn === selectedUniversityFilter);
      if (!matchUni) return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      dbItem.universityNameAr?.toLowerCase().includes(q) ||
      dbItem.universityNameEn?.toLowerCase().includes(q) ||
      dbItem.collegeNameAr?.toLowerCase().includes(q) ||
      dbItem.collegeNameEn?.toLowerCase().includes(q) ||
      dbItem.sourceUserName?.toLowerCase().includes(q) ||
      dbItem.sourceUserEmail?.toLowerCase().includes(q)
    );
  });

  // Get unique university names for filter
  const uniqueUniversities = Array.from(new Set(databases.map(d => d.universityNameAr || d.universityNameEn).filter(Boolean)));

  // Selected Source Student Preview
  const selectedSourceStudent = studentsList.find(s => s.id === createForm.sourceUserId);

  // Create University Database Action
  const handleCreateDatabase = async () => {
    if (!createForm.universityNameAr.trim() && !createForm.universityNameEn.trim()) {
      alert(isAr ? 'يرجى إدخال اسم الجامعة.' : 'Please enter university name.');
      return;
    }
    if (!createForm.collegeNameAr.trim() && !createForm.collegeNameEn.trim()) {
      alert(isAr ? 'يرجى إدخال اسم الكلية.' : 'Please enter college name.');
      return;
    }
    if (!createForm.sourceUserId) {
      alert(isAr ? 'يرجى اختيار الطالب المصدر لسحب البيانات منه.' : 'Please select source student.');
      return;
    }

    try {
      setCreating(true);
      const source = selectedSourceStudent;
      const sourceSubjects: Subject[] = (source?.subjects || []).map((s: any) => ({
        id: uuidv4(),
        code: s.code || `SUB-${Math.floor(100 + Math.random() * 900)}`,
        name: s.name,
        creditHours: Number(s.creditHours || 3),
        totalMarks: Number(s.totalMarks || 100),
        yearIndex: Number(s.yearIndex || 1),
        semesterIndex: Number(s.semesterIndex || 1),
        distributions: (s.distributions || []).map((d: any) => ({
          id: uuidv4(),
          name: d.name,
          maxMarks: Number(d.maxMarks || 0),
          achievedMarks: null,
          status: 'current'
        })),
        status: s.status || 'current',
        includeInGpa: s.includeInGpa !== false
      }));

      const sourceDrive: DriveFile[] = (source?.files || []).map((f: any) => ({
        id: uuidv4(),
        name: f.name,
        size: f.size || 0,
        type: f.type || 'file',
        parentId: f.parentId || null,
        createdAt: f.createdAt || new Date().toISOString(),
        url: f.url,
        b2FileId: f.b2FileId
      }));

      const newDb: UniversityDatabase = {
        id: uuidv4(),
        universityNameAr: createForm.universityNameAr.trim() || createForm.universityNameEn.trim(),
        universityNameEn: createForm.universityNameEn.trim() || createForm.universityNameAr.trim(),
        collegeNameAr: createForm.collegeNameAr.trim() || createForm.collegeNameEn.trim(),
        collegeNameEn: createForm.collegeNameEn.trim() || createForm.collegeNameAr.trim(),
        sourceUserId: source.id,
        sourceUserEmail: source.email || '',
        sourceUserName: source.name || '',
        totalYears: source.totalYears || 4,
        semestersPerYear: source.semestersPerYear || 2,
        subjects: sourceSubjects,
        driveFiles: sourceDrive,
        gradingScale: source.gradingScale || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.createUniversityDatabase(newDb);
      setIsCreateModalOpen(false);
      setCreateForm({
        universityNameAr: '',
        universityNameEn: '',
        collegeNameAr: '',
        collegeNameEn: '',
        sourceUserId: ''
      });
      await loadUniData();
    } catch (e: any) {
      console.error('Error creating university database:', e);
      alert(isAr ? 'حدث خطأ أثناء إنشاء قاعدة البيانات.' : 'Error creating university database.');
    } finally {
      setCreating(false);
    }
  };

  // Delete University Database Action
  const handleDeleteDatabase = async () => {
    if (!dbToDelete) return;
    try {
      await db.deleteUniversityDatabase(dbToDelete.id);
      setDbToDelete(null);
      if (selectedDb?.id === dbToDelete.id) setSelectedDb(null);
      await loadUniData();
    } catch (e) {
      console.error('Error deleting university database:', e);
    }
  };

  // Save Subject Edit in University DB (Template only)
  const handleSaveSubjectEdit = async () => {
    if (!selectedDb || !editingSubjectData) return;
    try {
      const updatedSubjects = selectedDb.subjects.map(s => 
        s.id === editingSubjectData.id ? editingSubjectData : s
      );
      await db.updateUniversityDatabase(selectedDb.id, { subjects: updatedSubjects });
      setSelectedDb({ ...selectedDb, subjects: updatedSubjects });
      setIsEditingSubject(false);
      setEditingSubjectData(null);
      await loadUniData();
    } catch (e) {
      console.error('Error updating subject in university DB:', e);
    }
  };

  // Add Subject into University DB (Template only)
  const handleAddSubjectToDb = async () => {
    if (!selectedDb || !newSubjectData.name?.trim()) return;
    try {
      const createdSubject: Subject = {
        id: uuidv4(),
        code: newSubjectData.code?.trim() || `SUB-${Math.floor(100 + Math.random() * 900)}`,
        name: newSubjectData.name.trim(),
        creditHours: Number(newSubjectData.creditHours || 3),
        totalMarks: Number(newSubjectData.totalMarks || 100),
        yearIndex: Number(newSubjectData.yearIndex || 1),
        semesterIndex: Number(newSubjectData.semesterIndex || 1),
        distributions: (newSubjectData.distributions || []).map((d: any) => ({
          id: d.id || uuidv4(),
          name: d.name,
          maxMarks: Number(d.maxMarks || 0),
          achievedMarks: null,
          status: 'current'
        })),
        status: 'current',
        includeInGpa: true
      };

      const updatedSubjects = [...(selectedDb.subjects || []), createdSubject];
      await db.updateUniversityDatabase(selectedDb.id, { subjects: updatedSubjects });
      setSelectedDb({ ...selectedDb, subjects: updatedSubjects });
      setIsAddingSubject(false);
      setNewSubjectData({
        name: '',
        code: '',
        creditHours: 3,
        totalMarks: 100,
        yearIndex: 1,
        semesterIndex: 1,
        distributions: [
          { id: '1', name: 'ميدتيرم', maxMarks: 20, achievedMarks: null, status: 'current' },
          { id: '2', name: 'أعمال سنة', maxMarks: 20, achievedMarks: null, status: 'current' },
          { id: '3', name: 'فاينل', maxMarks: 60, achievedMarks: null, status: 'current' }
        ]
      });
      await loadUniData();
    } catch (e) {
      console.error('Error adding subject to university DB:', e);
    }
  };

  // Delete Subject from University DB (Template only)
  const handleDeleteSubjectFromDb = async (subjectId: string) => {
    if (!selectedDb) return;
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذه المادة من قالب الجامعة؟ (لن يؤثر على حسابات الطلاب)' : 'Delete this subject from template?')) return;
    try {
      const updatedSubjects = selectedDb.subjects.filter(s => s.id !== subjectId);
      await db.updateUniversityDatabase(selectedDb.id, { subjects: updatedSubjects });
      setSelectedDb({ ...selectedDb, subjects: updatedSubjects });
      await loadUniData();
    } catch (e) {
      console.error('Error deleting subject:', e);
    }
  };

  // Delete Drive File from University DB (Template only)
  const handleDeleteDriveFileFromDb = async (fileId: string) => {
    if (!selectedDb) return;
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الملف من درايف الجامعة؟' : 'Delete file from university template drive?')) return;
    try {
      const updatedFiles = selectedDb.driveFiles.filter(f => f.id !== fileId);
      await db.updateUniversityDatabase(selectedDb.id, { driveFiles: updatedFiles });
      setSelectedDb({ ...selectedDb, driveFiles: updatedFiles });
      await loadUniData();
    } catch (e) {
      console.error('Error deleting file:', e);
    }
  };

  // Approve / Reject Pending Update
  const handleResolvePendingUpdate = async (update: UniversityPendingUpdate, status: 'approved' | 'rejected') => {
    try {
      await db.respondToPendingUpdate(update.id, status, (targetDb) => {
        if (update.type === 'add_subject' && update.data) {
          const newSubj: Subject = {
            id: uuidv4(),
            code: update.data.code || `SUB-${Math.floor(100 + Math.random() * 900)}`,
            name: update.data.name,
            creditHours: Number(update.data.creditHours || 3),
            totalMarks: Number(update.data.totalMarks || 100),
            yearIndex: Number(update.data.yearIndex || 1),
            semesterIndex: Number(update.data.semesterIndex || 1),
            distributions: (update.data.distributions || []).map((d: any) => ({
              id: uuidv4(),
              name: d.name,
              maxMarks: Number(d.maxMarks || 0),
              achievedMarks: null,
              status: 'current'
            })),
            status: 'current',
            includeInGpa: true
          };
          return { ...targetDb, subjects: [...targetDb.subjects, newSubj] };
        } else if (update.type === 'update_subject' && update.data?.id) {
          return {
            ...targetDb,
            subjects: targetDb.subjects.map(s => s.id === update.data.id ? { ...s, ...update.data } : s)
          };
        } else if (update.type === 'delete_subject' && update.data?.id) {
          return {
            ...targetDb,
            subjects: targetDb.subjects.filter(s => s.id !== update.data.id)
          };
        } else if (update.type === 'add_file' && update.data) {
          const newFile: DriveFile = {
            id: uuidv4(),
            name: update.data.name,
            size: update.data.size || 0,
            type: update.data.type || 'file',
            parentId: update.data.parentId || null,
            createdAt: new Date().toISOString(),
            url: update.data.url,
            b2FileId: update.data.b2FileId
          };
          return { ...targetDb, driveFiles: [...targetDb.driveFiles, newFile] };
        } else if (update.type === 'delete_file' && update.data?.id) {
          return {
            ...targetDb,
            driveFiles: targetDb.driveFiles.filter(f => f.id !== update.data.id)
          };
        }
        return targetDb;
      });
      await loadUniData();
    } catch (e) {
      console.error('Error resolving pending update:', e);
    }
  };

  const pendingUpdatesCount = pendingUpdates.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
              {isAr ? 'قواعد بيانات الجامعات والكليات' : 'University & College Databases'}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              {databases.length} {isAr ? 'قاعدة مسجلة' : 'Databases'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isAr 
              ? 'إنشاء وإدارة قوالب المواد والدرايف المستقلة للجامعات ومراجعة التحديثات المقترحة' 
              : 'Create and manage reference academic & drive templates and review student updates'}
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
        >
          <Plus size={18} />
          <span>{isAr ? 'إنشاء قاعدة بيانات لجامعة جديدة' : 'Create University Database'}</span>
        </button>
      </div>

      {/* Pending Updates Review Banner (if any) */}
      {pendingUpdatesCount > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <BellRing size={20} className="text-amber-600 animate-pulse" />
              <h3 className="font-extrabold text-sm sm:text-base">
                {isAr ? `تنبيهات وتحديثات معلقة من الطلاب المصدر (${pendingUpdatesCount})` : `Pending Updates from Source Students (${pendingUpdatesCount})`}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-xl">
              {isAr ? 'يتطلب موافقة الأدمن' : 'Requires Admin Approval'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {pendingUpdates.filter(p => p.status === 'pending').map(update => (
              <div key={update.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 space-y-2 shadow-2xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400">
                      {update.universityName} • {update.collegeName}
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                      {update.description}
                    </h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {isAr ? 'الطالب:' : 'Student:'} {update.sourceUserName} ({update.sourceUserEmail})
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {update.type}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => handleResolvePendingUpdate(update, 'rejected')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    {isAr ? 'رفض' : 'Reject'}
                  </button>
                  <button
                    onClick={() => handleResolvePendingUpdate(update, 'approved')}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{isAr ? 'موافقة واعتماد في القالب' : 'Approve & Merge'}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & University Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث باسم الجامعة، الكلية، أو الطالب المصدر (عربي / EN)...' : 'Search by University, College, or Source Student (AR / EN)...'}
            className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {uniqueUniversities.length > 0 && (
          <select
            value={selectedUniversityFilter}
            onChange={(e) => setSelectedUniversityFilter(e.target.value)}
            className="px-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
          >
            <option value="all">{isAr ? 'جميع الجامعات' : 'All Universities'}</option>
            {uniqueUniversities.map(uni => (
              <option key={uni} value={uni}>{uni}</option>
            ))}
          </select>
        )}
      </div>

      {/* Databases Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <Loader2 size={36} className="animate-spin text-indigo-600" />
          <p className="text-xs font-bold">{isAr ? 'جاري تحميل قواعد بيانات الجامعات...' : 'Loading university databases...'}</p>
        </div>
      ) : filteredDatabases.length === 0 ? (
        <div className="py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 space-y-3">
          <Building2 size={48} className="mx-auto opacity-20" />
          <p className="font-extrabold text-sm text-zinc-700 dark:text-zinc-300">
            {isAr ? 'لا توجد قواعد بيانات جامعات مطابقة للبحث.' : 'No university databases found matching your query.'}
          </p>
          <p className="text-xs text-zinc-400">
            {isAr ? 'انقر على زر "إنشاء قاعدة بيانات لجامعة جديدة" للبدء في سحب قالب من طالب.' : 'Click "Create University Database" to clone from a student.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDatabases.map(dbItem => {
            const enrolledCount = studentsList.filter(
              s => (s.university === dbItem.universityNameAr || s.university === dbItem.universityNameEn) &&
                   (s.college === dbItem.collegeNameAr || s.college === dbItem.collegeNameEn)
            ).length;

            return (
              <div
                key={dbItem.id}
                className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                      <Building2 size={20} />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setSelectedDb(dbItem);
                          setActiveDetailTab('subjects');
                        }}
                        className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer"
                        title={isAr ? 'إدارة المواد والدرايف' : 'Manage Subjects & Drive'}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => setDbToDelete(dbItem)}
                        className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title={isAr ? 'حذف قاعدة البيانات' : 'Delete Database'}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-black text-base text-zinc-900 dark:text-white line-clamp-1">
                      {dbItem.universityNameAr}
                    </h3>
                    {dbItem.universityNameEn && dbItem.universityNameEn !== dbItem.universityNameAr && (
                      <p className="text-[11px] text-zinc-400 font-medium truncate">
                        {dbItem.universityNameEn}
                      </p>
                    )}
                    <p className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 mt-1 line-clamp-1">
                      {dbItem.collegeNameAr} {dbItem.collegeNameEn ? `(${dbItem.collegeNameEn})` : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                      <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                        {dbItem.subjects?.length || 0}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-bold">{isAr ? 'مادة' : 'Subjects'}</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                      <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                        {dbItem.driveFiles?.length || 0}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-bold">{isAr ? 'درايف' : 'Drive'}</span>
                    </div>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                      <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                        {enrolledCount}
                      </span>
                      <span className="text-[9px] text-zinc-400 font-bold">{isAr ? 'طلاب' : 'Students'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
                  <span className="truncate max-w-[160px]" title={dbItem.sourceUserEmail}>
                    {isAr ? 'المصدر:' : 'Source:'} {dbItem.sourceUserName || dbItem.sourceUserEmail}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedDb(dbItem);
                      setActiveDetailTab('subjects');
                    }}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isAr ? 'فتح التفاصيل' : 'Details'}</span>
                    <ArrowIcon size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- CREATE UNIVERSITY DATABASE MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Building2 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white">
                    {isAr ? 'إنشاء وتجهيز قاعدة بيانات لجامعة جديدة' : 'Create University Database Template'}
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {isAr ? 'سحب خطة المواد وتوزيع الدرجات والدرايف من طالب مسجل كقالب مستقل' : 'Clone academic plan, subjects & drive from a registered student'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* University Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'اسم الجامعة (عربي) *' : 'University Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    value={createForm.universityNameAr}
                    onChange={(e) => setCreateForm({ ...createForm, universityNameAr: e.target.value })}
                    placeholder={isAr ? 'مثال: جامعة القاهرة' : 'e.g. Cairo University'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'اسم الجامعة (English)' : 'University Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={createForm.universityNameEn}
                    onChange={(e) => setCreateForm({ ...createForm, universityNameEn: e.target.value })}
                    placeholder="e.g. Cairo University"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* College Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'اسم الكلية (عربي) *' : 'College Name (Arabic) *'}
                  </label>
                  <input
                    type="text"
                    value={createForm.collegeNameAr}
                    onChange={(e) => setCreateForm({ ...createForm, collegeNameAr: e.target.value })}
                    placeholder={isAr ? 'مثال: كلية الحاسبات والذكاء الاصطناعي' : 'e.g. Faculty of Computers'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'اسم الكلية (English)' : 'College Name (English)'}
                  </label>
                  <input
                    type="text"
                    value={createForm.collegeNameEn}
                    onChange={(e) => setCreateForm({ ...createForm, collegeNameEn: e.target.value })}
                    placeholder="e.g. Faculty of Computers and AI"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Source Student Selector */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isAr ? 'اختر الطالب المصدر لسحب البيانات منه *' : 'Select Source Student *'}
                </label>
                <select
                  value={createForm.sourceUserId}
                  onChange={(e) => {
                    const chosenId = e.target.value;
                    const st = studentsList.find(s => s.id === chosenId);
                    setCreateForm({
                      ...createForm,
                      sourceUserId: chosenId,
                      universityNameAr: createForm.universityNameAr || st?.university || '',
                      collegeNameAr: createForm.collegeNameAr || st?.college || ''
                    });
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">{isAr ? '-- اختر طالباً مسجلاً --' : '-- Select a registered student --'}</option>
                  {studentsList.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name || 'بدون اسم'} ({st.email}) — {st.university || 'جامعة غير محددة'} / {st.college || 'كلية غير محددة'} [{st.subjects?.length || 0} مادة]
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview of Cloned Data */}
              {selectedSourceStudent && (
                <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                  <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-300">
                    {isAr ? 'معاينة البيانات التي سيتم سحبها وتضمينها في القالب:' : 'Cloned Data Preview:'}
                  </h4>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="block font-black text-indigo-600">{selectedSourceStudent.subjects?.length || 0}</span>
                      <span className="text-[10px] text-zinc-400 font-bold">{isAr ? 'مادة' : 'Subjects'}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="block font-black text-indigo-600">{selectedSourceStudent.files?.length || 0}</span>
                      <span className="text-[10px] text-zinc-400 font-bold">{isAr ? 'ملف درايف' : 'Files'}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="block font-black text-indigo-600">{selectedSourceStudent.totalYears || 4}</span>
                      <span className="text-[10px] text-zinc-400 font-bold">{isAr ? 'سنوات' : 'Years'}</span>
                    </div>
                    <div className="bg-white dark:bg-zinc-900 p-2 rounded-xl border border-indigo-100 dark:border-indigo-900">
                      <span className="block font-black text-indigo-600">{selectedSourceStudent.semestersPerYear || 2}</span>
                      <span className="text-[10px] text-zinc-400 font-bold">{isAr ? 'فصول/سنة' : 'Sem/Yr'}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateDatabase}
                disabled={creating}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isAr ? 'إنشاء وسحب قاعدة البيانات' : 'Create & Clone Database'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- DETAILED UNIVERSITY DATABASE MANAGEMENT MODAL --- */}
      {selectedDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-4xl max-h-[95vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Top Header */}
            <div className="p-5 sm:p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-zinc-50/50 dark:bg-zinc-800/30">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
                  <Building2 size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-lg sm:text-xl text-zinc-900 dark:text-white">
                      {selectedDb.universityNameAr} ({selectedDb.universityNameEn})
                    </h3>
                  </div>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedDb.collegeNameAr} {selectedDb.collegeNameEn ? `• ${selectedDb.collegeNameEn}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAddingSubject(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <Plus size={15} />
                  <span>{isAr ? 'إضافة مادة للقالب' : 'Add Subject to Template'}</span>
                </button>
                <button onClick={() => setSelectedDb(null)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs Inside Detail Modal */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                onClick={() => setActiveDetailTab('subjects')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  activeDetailTab === 'subjects'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <BookOpen size={16} />
                <span>{isAr ? `المواد الدراسية (${selectedDb.subjects?.length || 0})` : `Subjects (${selectedDb.subjects?.length || 0})`}</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('drive')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  activeDetailTab === 'drive'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <HardDrive size={16} />
                <span>{isAr ? `ملفات الدرايف (${selectedDb.driveFiles?.length || 0})` : `Drive Files (${selectedDb.driveFiles?.length || 0})`}</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('students')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  activeDetailTab === 'students'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <Users size={16} />
                <span>{isAr ? 'الطلاب المسجلون' : 'Enrolled Students'}</span>
              </button>

              <button
                onClick={() => setActiveDetailTab('overview')}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  activeDetailTab === 'overview'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
              >
                <Info size={16} />
                <span>{isAr ? 'بيانات القالب والمصدر' : 'Template Info'}</span>
              </button>
            </div>

            {/* Detail Tab Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
              
              {/* --- TAB 1: SUBJECTS MANAGEMENT --- */}
              {activeDetailTab === 'subjects' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-xs">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300">
                      {isAr 
                        ? '💡 أي تعديل هنا يغير قالب الجامعة فقط ولن يؤثر على حسابات الطلاب الخاصة.' 
                        : '💡 Edits here modify the template database only without affecting students private data.'}
                    </span>
                    <span className="font-black text-indigo-600">
                      {selectedDb.totalYears || 4} {isAr ? 'سنوات' : 'Years'} • {selectedDb.semestersPerYear || 2} {isAr ? 'فصول/سنة' : 'Sem/Yr'}
                    </span>
                  </div>

                  {/* Group subjects by Year and Semester */}
                  {Array.from({ length: selectedDb.totalYears || 4 }, (_, yIdx) => yIdx + 1).map(year => (
                    <div key={year} className="space-y-3">
                      <h4 className="font-black text-sm text-zinc-900 dark:text-white pb-1 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                        <Calendar size={16} className="text-indigo-600" />
                        <span>{isAr ? `السنة الدراسية ${year}` : `Year ${year}`}</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Array.from({ length: selectedDb.semestersPerYear || 2 }, (_, sIdx) => sIdx + 1).map(semester => {
                          const semesterSubjects = (selectedDb.subjects || []).filter(
                            s => s.yearIndex === year && s.semesterIndex === semester
                          );

                          return (
                            <div key={semester} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2.5">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                                  {isAr ? `الفصل الدراسي ${semester}` : `Semester ${semester}`}
                                </span>
                                <span className="text-[10px] font-bold text-zinc-400">
                                  {semesterSubjects.length} {isAr ? 'مواد' : 'subjects'}
                                </span>
                              </div>

                              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                                {semesterSubjects.map(subj => (
                                  <div
                                    key={subj.id}
                                    className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 flex items-start justify-between gap-2 shadow-2xs"
                                  >
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                          {subj.code}
                                        </span>
                                        <h5 className="font-black text-xs text-zinc-900 dark:text-white truncate">
                                          {subj.name}
                                        </h5>
                                      </div>
                                      <div className="flex flex-wrap gap-1 text-[10px] text-zinc-500">
                                        <span>{subj.creditHours} {isAr ? 'ساعات' : 'hrs'}</span>
                                        <span>•</span>
                                        <span>{subj.totalMarks} {isAr ? 'درجة' : 'marks'}</span>
                                      </div>
                                      {/* Distributions summary */}
                                      {subj.distributions && subj.distributions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                          {subj.distributions.map((d, dIdx) => (
                                            <span key={dIdx} className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded">
                                              {d.name}: {d.maxMarks}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingSubjectData(subj);
                                          setIsEditingSubject(true);
                                        }}
                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 rounded-lg cursor-pointer"
                                        title={isAr ? 'تعديل المادة في القالب' : 'Edit Subject'}
                                      >
                                        <Edit2 size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSubjectFromDb(subj.id)}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg cursor-pointer"
                                        title={isAr ? 'حذف المادة من القالب' : 'Delete Subject'}
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  </div>
                                ))}

                                {semesterSubjects.length === 0 && (
                                  <p className="text-[11px] text-zinc-400 py-3 text-center">
                                    {isAr ? 'لا توجد مواد مسجلة لهذا الفصل' : 'No subjects for this semester'}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* --- TAB 2: DRIVE MANAGEMENT --- */}
              {activeDetailTab === 'drive' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 text-xs">
                    <span className="font-bold text-indigo-900 dark:text-indigo-300">
                      {isAr 
                        ? '📁 ملفات ومجلدات الدرايف المرجعية التي سيتم استنساخها للطلاب عند الاسترداد' 
                        : 'Reference drive files & folders that will be imported to students.'}
                    </span>
                    <span className="font-black text-indigo-600">
                      {selectedDb.driveFiles?.length || 0} {isAr ? 'عنصر' : 'Items'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedDb.driveFiles?.map(file => (
                      <div key={file.id} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shadow-2xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {file.type === 'folder' ? (
                            <Folder size={18} className="text-amber-500 shrink-0" />
                          ) : (
                            <FileText size={18} className="text-blue-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-zinc-900 dark:text-white truncate">{file.name}</h5>
                            <span className="text-[10px] text-zinc-400">{file.type === 'folder' ? 'مجلد' : `${(file.size / 1024 / 1024).toFixed(2)} MB`}</span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteDriveFileFromDb(file.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg cursor-pointer shrink-0"
                          title={isAr ? 'حذف من درايف الجامعة' : 'Delete file'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}

                    {(!selectedDb.driveFiles || selectedDb.driveFiles.length === 0) && (
                      <p className="col-span-full py-12 text-center text-xs text-zinc-400">
                        {isAr ? 'لا توجد ملفات درايف في هذا القالب.' : 'No drive files in this template.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* --- TAB 3: ENROLLED STUDENTS --- */}
              {activeDetailTab === 'students' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-xs text-zinc-500">
                    {isAr ? 'الطلاب المسجلون أو الذين استردوا هذه الجامعة:' : 'Students registered under this university & college:'}
                  </h4>

                  <div className="space-y-2">
                    {studentsList.filter(
                      s => (s.university === selectedDb.universityNameAr || s.university === selectedDb.universityNameEn) &&
                           (s.college === selectedDb.collegeNameAr || s.college === selectedDb.collegeNameEn)
                    ).map(student => (
                      <div key={student.id} className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div>
                          <h5 className="font-black text-xs text-zinc-900 dark:text-white">{student.name || 'طالب مسجل'}</h5>
                          <p className="text-[11px] text-zinc-400">{student.email}</p>
                        </div>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-2.5 py-1 rounded-xl">
                          {student.subjects?.length || 0} {isAr ? 'مادة مسجلة' : 'subjects'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* --- TAB 4: TEMPLATE OVERVIEW --- */}
              {activeDetailTab === 'overview' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
                    <div>
                      <span className="text-zinc-400 font-bold block">{isAr ? 'الطالب المصدر' : 'Source Student'}</span>
                      <span className="font-black text-zinc-900 dark:text-white">{selectedDb.sourceUserName} ({selectedDb.sourceUserEmail})</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 font-bold block">{isAr ? 'تاريخ الإنشاء' : 'Created At'}</span>
                      <span className="font-black text-zinc-900 dark:text-white">{new Date(selectedDb.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* --- EDIT SUBJECT MODAL (TEMPLATE) --- */}
      {isEditingSubject && editingSubjectData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              {isAr ? 'تعديل مادة في قالب الجامعة' : 'Edit Subject in Template'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'اسم المادة' : 'Subject Name'}</label>
                <input
                  type="text"
                  value={editingSubjectData.name}
                  onChange={(e) => setEditingSubjectData({ ...editingSubjectData, name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'كود المادة' : 'Subject Code'}</label>
                  <input
                    type="text"
                    value={editingSubjectData.code}
                    onChange={(e) => setEditingSubjectData({ ...editingSubjectData, code: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الساعات المعتمدة' : 'Credit Hours'}</label>
                  <input
                    type="number"
                    value={editingSubjectData.creditHours}
                    onChange={(e) => setEditingSubjectData({ ...editingSubjectData, creditHours: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الدرجة الكلية' : 'Total Marks'}</label>
                <input
                  type="number"
                  value={editingSubjectData.totalMarks}
                  onChange={(e) => setEditingSubjectData({ ...editingSubjectData, totalMarks: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setIsEditingSubject(false)} className="px-4 py-2 text-xs font-bold text-zinc-500">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveSubjectEdit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD SUBJECT MODAL (TEMPLATE) --- */}
      {isAddingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              {isAr ? 'إضافة مادة جديدة لقالب الجامعة' : 'Add New Subject to Template'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'اسم المادة *' : 'Subject Name *'}</label>
                <input
                  type="text"
                  value={newSubjectData.name}
                  onChange={(e) => setNewSubjectData({ ...newSubjectData, name: e.target.value })}
                  placeholder={isAr ? 'مثال: الذكاء الاصطناعي' : 'e.g. Artificial Intelligence'}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'كود المادة' : 'Subject Code'}</label>
                  <input
                    type="text"
                    value={newSubjectData.code}
                    onChange={(e) => setNewSubjectData({ ...newSubjectData, code: e.target.value })}
                    placeholder="e.g. CS301"
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الساعات المعتمدة' : 'Credit Hours'}</label>
                  <input
                    type="number"
                    value={newSubjectData.creditHours}
                    onChange={(e) => setNewSubjectData({ ...newSubjectData, creditHours: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الدرجة الكلية' : 'Total Marks'}</label>
                  <input
                    type="number"
                    value={newSubjectData.totalMarks}
                    onChange={(e) => setNewSubjectData({ ...newSubjectData, totalMarks: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'السنة الدراسية' : 'Year'}</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedDb?.totalYears || 4}
                    value={newSubjectData.yearIndex}
                    onChange={(e) => setNewSubjectData({ ...newSubjectData, yearIndex: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">{isAr ? 'الفصل الدراسي' : 'Semester'}</label>
                  <input
                    type="number"
                    min={1}
                    max={selectedDb?.semestersPerYear || 2}
                    value={newSubjectData.semesterIndex}
                    onChange={(e) => setNewSubjectData({ ...newSubjectData, semesterIndex: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button onClick={() => setIsAddingSubject(false)} className="px-4 py-2 text-xs font-bold text-zinc-500">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleAddSubjectToDb}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold"
              >
                {isAr ? 'إضافة المادة' : 'Add Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {dbToDelete && (
        <ConfirmModal
          isOpen={true}
          title={isAr ? 'حذف قاعدة بيانات الجامعة' : 'Delete University Database'}
          message={isAr 
            ? `هل أنت متأكد من حذف قاعدة بيانات "${dbToDelete.universityNameAr} - ${dbToDelete.collegeNameAr}"؟ (لن يؤثر الحذف على حسابات الطلاب الذين استردوا البيانات سابقاً)` 
            : `Are you sure you want to delete "${dbToDelete.universityNameAr}" template?`}
          onConfirm={handleDeleteDatabase}
          onCancel={() => setDbToDelete(null)}
          isDestructive={true}
          confirmText={isAr ? 'نعم، حذف' : 'Yes, Delete'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      )}

    </div>
  );
}
