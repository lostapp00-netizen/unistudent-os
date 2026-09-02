import React, { useState, useEffect, useMemo } from 'react';
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
  BellRing,
  ExternalLink,
  ChevronRight,
  FolderPlus,
  Upload,
  BarChart2,
  Sliders,
  ChevronLeft
} from 'lucide-react';
import { db } from '../../lib/db';
import { UniversityDatabase, UniversityPendingUpdate, Subject, DriveFile, GradeDistributionItem } from '../../types';
import { ConfirmModal } from '../ui/CustomModal';
import { autoTranslateUniversity, autoTranslateCollege } from '../../lib/academicTranslation';

interface AdminUniversitiesTabProps {
  studentsList: any[];
  onRefreshAllData: () => Promise<void>;
}

export function AdminUniversitiesTab({ studentsList, onRefreshAllData }: AdminUniversitiesTabProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState<UniversityDatabase[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<UniversityPendingUpdate[]>([]);
  
  // Navigation / Hierarchical Drilldown state
  // View Levels: 'universities_table' -> 'colleges_list' -> 'college_studio'
  const [selectedUniversityGroup, setSelectedUniversityGroup] = useState<string | null>(null);
  const [selectedCollegeDb, setSelectedCollegeDb] = useState<UniversityDatabase | null>(null);
  
  // Studio Navigation inside a College
  const [selectedYearIndex, setSelectedYearIndex] = useState<number>(1);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState<number>(1);
  const [activeStudioTab, setActiveStudioTab] = useState<'subjects' | 'drive' | 'students' | 'updates'>('subjects');

  // Search & Global Filter
  const [globalSearch, setGlobalSearch] = useState('');

  // --- Modals ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbToDelete, setDbToDelete] = useState<UniversityDatabase | null>(null);

  // Subject Add / Edit Modal State
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [subjectForm, setSubjectForm] = useState<{
    id?: string;
    name: string;
    code: string;
    creditHours: number;
    totalMarks: number;
    yearIndex: number;
    semesterIndex: number;
    distributions: GradeDistributionItem[];
  }>({
    name: '',
    code: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: 1,
    semesterIndex: 1,
    distributions: [
      { id: '1', name: 'أعمال سنة', maxMarks: 20, achievedMarks: null, status: 'current' },
      { id: '2', name: 'ميدتيرم', maxMarks: 20, achievedMarks: null, status: 'current' },
      { id: '3', name: 'فاينل', maxMarks: 60, achievedMarks: null, status: 'current' }
    ]
  });

  // Drive File / Folder Add Modal State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [driveForm, setDriveForm] = useState<{
    name: string;
    type: 'folder' | 'file';
    url: string;
    parentId: string | null;
  }>({
    name: '',
    type: 'folder',
    url: '',
    parentId: null
  });

  // Create University DB Modal State
  const [createForm, setCreateForm] = useState({
    universityNameAr: '',
    universityNameEn: '',
    collegeNameAr: '',
    collegeNameEn: '',
    sourceUserId: '',
    customYears: 4,
    customSemesters: 2
  });
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
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

      // Refresh currently open college DB if open
      if (selectedCollegeDb) {
        const refreshed = dbs.find(d => d.id === selectedCollegeDb.id);
        if (refreshed) setSelectedCollegeDb(refreshed);
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

  // Group databases by unique University Name (Arabic or English)
  const groupedUniversities = useMemo(() => {
    const map: Record<string, {
      key: string;
      nameAr: string;
      nameEn: string;
      colleges: UniversityDatabase[];
      totalSubjects: number;
      totalDriveFiles: number;
    }> = {};

    databases.forEach(dbItem => {
      const key = (dbItem.universityNameAr || dbItem.universityNameEn || 'جامعة أخرى').trim();
      if (!map[key]) {
        map[key] = {
          key,
          nameAr: dbItem.universityNameAr || key,
          nameEn: dbItem.universityNameEn || key,
          colleges: [],
          totalSubjects: 0,
          totalDriveFiles: 0
        };
      }
      map[key].colleges.push(dbItem);
      map[key].totalSubjects += (dbItem.subjects?.length || 0);
      map[key].totalDriveFiles += (dbItem.driveFiles?.length || 0);
    });

    return Object.values(map);
  }, [databases]);

  // Filtered Universities by Global Search
  const filteredUniversities = useMemo(() => {
    if (!globalSearch.trim()) return groupedUniversities;
    const q = globalSearch.toLowerCase().trim();
    return groupedUniversities.filter(u => 
      u.nameAr.toLowerCase().includes(q) ||
      u.nameEn.toLowerCase().includes(q) ||
      u.colleges.some(c => 
        c.collegeNameAr.toLowerCase().includes(q) ||
        c.collegeNameEn.toLowerCase().includes(q) ||
        c.sourceUserName?.toLowerCase().includes(q) ||
        c.sourceUserEmail?.toLowerCase().includes(q)
      )
    );
  }, [groupedUniversities, globalSearch]);

  // Filtered Students for Create Modal
  const filteredStudentsForCreate = useMemo(() => {
    if (!studentSearchQuery.trim()) return studentsList;
    const q = studentSearchQuery.toLowerCase().trim();
    return studentsList.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.university || '').toLowerCase().includes(q) ||
      (s.college || '').toLowerCase().includes(q)
    );
  }, [studentsList, studentSearchQuery]);

  // Handle University Name AR Change -> Auto Translate EN
  const handleUniversityArChange = (text: string) => {
    const translated = autoTranslateUniversity(text);
    setCreateForm(prev => ({
      ...prev,
      universityNameAr: text,
      universityNameEn: translated || prev.universityNameEn
    }));
  };

  // Handle College Name AR Change -> Auto Translate EN
  const handleCollegeArChange = (text: string) => {
    const translated = autoTranslateCollege(text);
    setCreateForm(prev => ({
      ...prev,
      collegeNameAr: text,
      collegeNameEn: translated || prev.collegeNameEn
    }));
  };

  // Handle Student Selection in Create Modal
  const handleSelectStudent = (st: any) => {
    const uniAr = st.university && st.university !== 'غير محدد' && st.university !== 'Not specified' ? st.university : '';
    const colAr = st.college && st.college !== 'غير محدد' && st.college !== 'Not specified' ? st.college : '';
    
    setCreateForm(prev => ({
      ...prev,
      sourceUserId: st.id,
      universityNameAr: prev.universityNameAr || uniAr,
      universityNameEn: prev.universityNameEn || autoTranslateUniversity(uniAr),
      collegeNameAr: prev.collegeNameAr || colAr,
      collegeNameEn: prev.collegeNameEn || autoTranslateCollege(colAr),
      customYears: st.totalYears || 4,
      customSemesters: st.semestersPerYear || 2
    }));
  };

  // Create University DB Action
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
      alert(isAr ? 'يرجى اختيار الطالب المصدر لسحب البيانات منه.' : 'Please select a source student.');
      return;
    }

    try {
      setCreating(true);
      const source = studentsList.find(s => s.id === createForm.sourceUserId);
      const studentSubjs = source?.subjects || source?.raw?.subjects || [];
      const studentFiles = source?.files || source?.raw?.files || [];

      // Clone subjects cleanly without auto SUB-xxx
      const clonedSubjects: Subject[] = studentSubjs.map((s: any) => ({
        id: uuidv4(),
        code: (s.code || '').trim(),
        name: s.name,
        creditHours: Number(s.creditHours || s.credit_hours || 3),
        totalMarks: Number(s.totalMarks || s.total_marks || 100),
        yearIndex: Number(s.yearIndex || s.year_index || 1),
        semesterIndex: Number(s.semesterIndex || s.semester_index || 1),
        distributions: (s.distributions || []).map((d: any) => ({
          id: uuidv4(),
          name: d.name,
          maxMarks: Number(d.maxMarks || d.max_marks || 0),
          achievedMarks: null,
          status: 'current'
        })),
        status: 'current',
        includeInGpa: s.includeInGpa !== false && s.include_in_gpa !== false
      }));

      // Clone drive files
      const clonedDrive: DriveFile[] = studentFiles.map((f: any) => ({
        id: uuidv4(),
        name: f.name,
        size: Number(f.size || 0),
        type: f.type || 'file',
        parentId: f.parentId || f.parent_id || null,
        createdAt: f.createdAt || f.upload_date || new Date().toISOString(),
        url: f.url || '',
        b2FileId: f.b2FileId || f.b2_file_id
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
        totalYears: createForm.customYears || source.totalYears || 4,
        semestersPerYear: createForm.customSemesters || source.semestersPerYear || 2,
        subjects: clonedSubjects,
        driveFiles: clonedDrive,
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
        sourceUserId: '',
        customYears: 4,
        customSemesters: 2
      });
      await loadUniData();
    } catch (e: any) {
      console.error('Error creating university database:', e);
      alert(isAr ? 'حدث خطأ أثناء إنشاء قاعدة البيانات.' : 'Error creating university database.');
    } finally {
      setCreating(false);
    }
  };

  // Delete College Database Action
  const handleDeleteDatabase = async () => {
    if (!dbToDelete) return;
    try {
      await db.deleteUniversityDatabase(dbToDelete.id);
      setDbToDelete(null);
      if (selectedCollegeDb?.id === dbToDelete.id) {
        setSelectedCollegeDb(null);
      }
      await loadUniData();
    } catch (e) {
      console.error('Error deleting university database:', e);
    }
  };

  // Open Subject Modal for Add
  const handleOpenAddSubject = () => {
    setEditingSubject(null);
    setSubjectForm({
      name: '',
      code: '',
      creditHours: 3,
      totalMarks: 100,
      yearIndex: selectedYearIndex,
      semesterIndex: selectedSemesterIndex,
      distributions: [
        { id: uuidv4(), name: 'أعمال سنة', maxMarks: 20, achievedMarks: null, status: 'current' },
        { id: uuidv4(), name: 'ميدتيرم', maxMarks: 20, achievedMarks: null, status: 'current' },
        { id: uuidv4(), name: 'فاينل', maxMarks: 60, achievedMarks: null, status: 'current' }
      ]
    });
    setIsSubjectModalOpen(true);
  };

  // Open Subject Modal for Edit
  const handleOpenEditSubject = (subj: Subject) => {
    setEditingSubject(subj);
    setSubjectForm({
      id: subj.id,
      name: subj.name,
      code: subj.code || '',
      creditHours: subj.creditHours || 3,
      totalMarks: subj.totalMarks || 100,
      yearIndex: subj.yearIndex || selectedYearIndex,
      semesterIndex: subj.semesterIndex || selectedSemesterIndex,
      distributions: (subj.distributions && subj.distributions.length > 0)
        ? subj.distributions.map(d => ({ ...d, id: d.id || uuidv4() }))
        : [
            { id: uuidv4(), name: 'أعمال سنة', maxMarks: 20, achievedMarks: null, status: 'current' },
            { id: uuidv4(), name: 'ميدتيرم', maxMarks: 20, achievedMarks: null, status: 'current' },
            { id: uuidv4(), name: 'فاينل', maxMarks: 60, achievedMarks: null, status: 'current' }
          ]
    });
    setIsSubjectModalOpen(true);
  };

  // Save Subject in College Database
  const handleSaveSubject = async () => {
    if (!selectedCollegeDb || !subjectForm.name.trim()) {
      alert(isAr ? 'يرجى إدخال اسم المادة.' : 'Please enter subject name.');
      return;
    }

    try {
      const subjectPayload: Subject = {
        id: editingSubject ? editingSubject.id : uuidv4(),
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim(),
        creditHours: Number(subjectForm.creditHours || 3),
        totalMarks: Number(subjectForm.totalMarks || 100),
        yearIndex: Number(subjectForm.yearIndex),
        semesterIndex: Number(subjectForm.semesterIndex),
        distributions: subjectForm.distributions.map(d => ({
          id: d.id || uuidv4(),
          name: d.name.trim() || 'بند',
          maxMarks: Number(d.maxMarks || 0),
          achievedMarks: null,
          status: 'current'
        })),
        status: 'current',
        includeInGpa: true
      };

      let updatedSubjects: Subject[];
      if (editingSubject) {
        updatedSubjects = selectedCollegeDb.subjects.map(s => s.id === editingSubject.id ? subjectPayload : s);
      } else {
        updatedSubjects = [...(selectedCollegeDb.subjects || []), subjectPayload];
      }

      await db.updateUniversityDatabase(selectedCollegeDb.id, { subjects: updatedSubjects });
      setSelectedCollegeDb({ ...selectedCollegeDb, subjects: updatedSubjects });
      setIsSubjectModalOpen(false);
      await loadUniData();
    } catch (e) {
      console.error('Error saving subject in college DB:', e);
    }
  };

  // Delete Subject from College Database
  const handleDeleteSubject = async (subjectId: string) => {
    if (!selectedCollegeDb) return;
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذه المادة من قالب الكلية؟' : 'Delete subject from template?')) return;
    try {
      const updatedSubjects = selectedCollegeDb.subjects.filter(s => s.id !== subjectId);
      await db.updateUniversityDatabase(selectedCollegeDb.id, { subjects: updatedSubjects });
      setSelectedCollegeDb({ ...selectedCollegeDb, subjects: updatedSubjects });
      await loadUniData();
    } catch (e) {
      console.error('Error deleting subject:', e);
    }
  };

  // Add Drive Item to College Database
  const handleSaveDriveItem = async () => {
    if (!selectedCollegeDb || !driveForm.name.trim()) {
      alert(isAr ? 'يرجى كتابة اسم الملف أو المجلد.' : 'Please enter file or folder name.');
      return;
    }

    try {
      const newItem: DriveFile = {
        id: uuidv4(),
        name: driveForm.name.trim(),
        type: driveForm.type,
        size: 0,
        parentId: driveForm.parentId,
        createdAt: new Date().toISOString(),
        url: driveForm.url.trim()
      };

      const updatedFiles = [...(selectedCollegeDb.driveFiles || []), newItem];
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setSelectedCollegeDb({ ...selectedCollegeDb, driveFiles: updatedFiles });
      setIsDriveModalOpen(false);
      setDriveForm({ name: '', type: 'folder', url: '', parentId: null });
      await loadUniData();
    } catch (e) {
      console.error('Error saving drive item:', e);
    }
  };

  // Delete Drive Item from College Database
  const handleDeleteDriveItem = async (fileId: string) => {
    if (!selectedCollegeDb) return;
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الملف/المجلد من درايف الكلية؟' : 'Delete file from drive?')) return;
    try {
      const updatedFiles = selectedCollegeDb.driveFiles.filter(f => f.id !== fileId);
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setSelectedCollegeDb({ ...selectedCollegeDb, driveFiles: updatedFiles });
      await loadUniData();
    } catch (e) {
      console.error('Error deleting file:', e);
    }
  };

  // Respond to Pending Update
  const handleResolvePendingUpdate = async (update: UniversityPendingUpdate, status: 'approved' | 'rejected') => {
    try {
      await db.respondToPendingUpdate(update.id, status, (targetDb) => {
        if (update.type === 'add_subject' && update.data) {
          const newSubj: Subject = {
            id: uuidv4(),
            code: (update.data.code || '').trim(),
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
        }
        return targetDb;
      });
      await loadUniData();
    } catch (e) {
      console.error('Error resolving pending update:', e);
    }
  };

  const pendingUpdatesCount = pendingUpdates.filter(p => p.status === 'pending').length;

  // Selected University Data
  const currentUniversityGroup = selectedUniversityGroup 
    ? groupedUniversities.find(u => u.key === selectedUniversityGroup)
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & GLOBAL ACTIONS */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Building2 size={20} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                {isAr ? 'منظومة قواعد بيانات الجامعات والكليات' : 'University & College Hub'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {isAr 
                  ? 'إدارة قوالب الخطط الدراسية، السنين، الترمات، توزيع الدرجات والدرايف المستقل للجامعات' 
                  : 'Manage curriculum plans, grade distributions, and independent drive templates'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
          >
            <Plus size={18} />
            <span>{isAr ? 'إنشاء قاعدة بيانات لجامعة جديدة' : 'Add University Database'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PENDING STUDENT UPDATES BANNER */}
      {/* ========================================================================= */}
      {pendingUpdatesCount > 0 && (
        <div className="p-5 rounded-3xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3 animate-in zoom-in-95">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <BellRing size={20} className="text-amber-600 animate-pulse" />
              <h3 className="font-extrabold text-sm sm:text-base">
                {isAr ? `تحديثات مقترحة معلقة من الطلاب المصدر (${pendingUpdatesCount})` : `Pending Updates from Source Students (${pendingUpdatesCount})`}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2.5 py-1 rounded-xl">
              {isAr ? 'تتطلب مراجعة واعتماد الأدمن' : 'Requires Approval'}
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

      {/* ========================================================================= */}
      {/* 3. HIERARCHICAL VIEW CONTAINER */}
      {/* ========================================================================= */}

      {/* --- LEVEL 1: UNIVERSITIES TABLE --- */}
      {!selectedUniversityGroup && !selectedCollegeDb && (
        <div className="space-y-4">
          
          {/* Global Search */}
          <div className="relative">
            <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder={isAr ? 'بحث سريع عن اسم جامعة، كلية، أو طالب مصدر...' : 'Search universities, colleges, or students...'}
              className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <Loader2 size={36} className="animate-spin text-indigo-600" />
              <p className="text-xs font-bold">{isAr ? 'جاري تحميل الجامعات...' : 'Loading universities...'}</p>
            </div>
          ) : filteredUniversities.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 space-y-3">
              <Building2 size={48} className="mx-auto opacity-20" />
              <p className="font-extrabold text-sm text-zinc-700 dark:text-zinc-300">
                {isAr ? 'لا توجد جامعات مسجلة حالياً.' : 'No universities registered yet.'}
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>{isAr ? 'إنشاء أول قاعدة بيانات جامعة' : 'Create First University DB'}</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-600" />
                  <span>{isAr ? 'جدول الجامعات المسجلة' : 'Universities Directory'}</span>
                </h3>
                <span className="text-xs font-bold text-zinc-400">
                  {filteredUniversities.length} {isAr ? 'جامعة' : 'Universities'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm text-left rtl:text-right">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-400 uppercase text-[11px] font-black border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="py-3.5 px-5">{isAr ? 'الجامعة (عربي / English)' : 'University Name'}</th>
                      <th className="py-3.5 px-5 text-center">{isAr ? 'عدد الكليات' : 'Colleges'}</th>
                      <th className="py-3.5 px-5 text-center">{isAr ? 'إجمالي المواد' : 'Subjects'}</th>
                      <th className="py-3.5 px-5 text-center">{isAr ? 'ملفات الدرايف' : 'Drive Files'}</th>
                      <th className="py-3.5 px-5 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredUniversities.map((group) => (
                      <tr key={group.key} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                              <Building2 size={18} />
                            </div>
                            <div>
                              <p className="font-black text-sm text-zinc-900 dark:text-white">{group.nameAr}</p>
                              {group.nameEn && group.nameEn !== group.nameAr && (
                                <p className="text-[11px] text-zinc-400 font-medium">{group.nameEn}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5 text-center font-bold">
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-black">
                            {group.colleges.length} {isAr ? 'كليات' : 'Colleges'}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-center font-bold text-zinc-700 dark:text-zinc-300">
                          {group.totalSubjects} {isAr ? 'مادة' : 'Subjects'}
                        </td>

                        <td className="py-4 px-5 text-center font-bold text-zinc-700 dark:text-zinc-300">
                          {group.totalDriveFiles} {isAr ? 'ملف' : 'Files'}
                        </td>

                        <td className="py-4 px-5 text-center">
                          <button
                            onClick={() => setSelectedUniversityGroup(group.key)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                          >
                            <span>{isAr ? 'عرض الكليات' : 'View Colleges'}</span>
                            <ArrowIcon size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- LEVEL 2: COLLEGES UNDER SELECTED UNIVERSITY --- */}
      {selectedUniversityGroup && !selectedCollegeDb && currentUniversityGroup && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Breadcrumbs Bar */}
          <div className="flex items-center justify-between bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            <button
              onClick={() => setSelectedUniversityGroup(null)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <BackIcon size={16} />
              <span>{isAr ? 'العودة لقائمة الجامعات' : 'Back to Universities'}</span>
            </button>

            <div className="text-right rtl:text-left">
              <span className="text-xs font-black text-zinc-900 dark:text-white">
                {currentUniversityGroup.nameAr} ({currentUniversityGroup.nameEn})
              </span>
            </div>
          </div>

          {/* Colleges Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentUniversityGroup.colleges.map((collegeDb) => {
              const enrolledCount = studentsList.filter(
                s => (s.university === collegeDb.universityNameAr || s.university === collegeDb.universityNameEn) &&
                     (s.college === collegeDb.collegeNameAr || s.college === collegeDb.collegeNameEn)
              ).length;

              return (
                <div
                  key={collegeDb.id}
                  className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                        <GraduationCap size={20} />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDbToDelete(collegeDb)}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title={isAr ? 'حذف هذه الكلية' : 'Delete College'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-base text-zinc-900 dark:text-white">
                        {collegeDb.collegeNameAr}
                      </h4>
                      {collegeDb.collegeNameEn && collegeDb.collegeNameEn !== collegeDb.collegeNameAr && (
                        <p className="text-[11px] text-zinc-400 font-medium truncate">
                          {collegeDb.collegeNameEn}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-center">
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                        <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                          {collegeDb.totalYears || 4} {isAr ? 'سنوات' : 'Yrs'}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-bold">{collegeDb.semestersPerYear || 2} {isAr ? 'ترم/سنة' : 'Sem/Yr'}</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                        <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                          {collegeDb.subjects?.length || 0}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-bold">{isAr ? 'مادة' : 'Subjects'}</span>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl">
                        <span className="block font-black text-xs text-zinc-800 dark:text-zinc-200">
                          {collegeDb.driveFiles?.length || 0}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-bold">{isAr ? 'درايف' : 'Drive'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400 truncate max-w-[140px]" title={collegeDb.sourceUserEmail}>
                      {collegeDb.sourceUserName || collegeDb.sourceUserEmail}
                    </span>

                    <button
                      onClick={() => {
                        setSelectedCollegeDb(collegeDb);
                        setSelectedYearIndex(1);
                        setSelectedSemesterIndex(1);
                        setActiveStudioTab('subjects');
                      }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>{isAr ? 'إدارة الكلية والمواد' : 'Manage Studio'}</span>
                      <ArrowIcon size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- LEVEL 3: COLLEGE ACADEMIC STUDIO (YEARS, SEMESTERS, SUBJECTS, DISTRIBUTIONS, DRIVE) --- */}
      {selectedCollegeDb && (
        <div className="space-y-5 animate-in fade-in">
          
          {/* Breadcrumb Header */}
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedCollegeDb(null)}
                className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                title={isAr ? 'العودة' : 'Back'}
              >
                <BackIcon size={18} />
              </button>
              <div>
                <span className="text-[11px] font-bold text-zinc-400 block">
                  {selectedCollegeDb.universityNameAr} ({selectedCollegeDb.universityNameEn})
                </span>
                <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white">
                  {selectedCollegeDb.collegeNameAr} {selectedCollegeDb.collegeNameEn ? `• ${selectedCollegeDb.collegeNameEn}` : ''}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1.5 rounded-xl text-xs font-black text-indigo-700 dark:text-indigo-300">
                {selectedCollegeDb.totalYears || 4} {isAr ? 'سنوات دراسية' : 'Years'} • {selectedCollegeDb.semestersPerYear || 2} {isAr ? 'ترم/سنة' : 'Sem/Yr'}
              </div>
              <button
                onClick={handleOpenAddSubject}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>{isAr ? 'إضافة مادة للترم الحالي' : 'Add Subject'}</span>
              </button>
            </div>
          </div>

          {/* Studio Tabs */}
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <button
              onClick={() => setActiveStudioTab('subjects')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeStudioTab === 'subjects'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <BookOpen size={16} />
              <span>{isAr ? `المواد وتوزيع الدرجات (${selectedCollegeDb.subjects?.length || 0})` : `Subjects & Grades (${selectedCollegeDb.subjects?.length || 0})`}</span>
            </button>

            <button
              onClick={() => setActiveStudioTab('drive')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeStudioTab === 'drive'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <HardDrive size={16} />
              <span>{isAr ? `ملفات ومجلدات الدرايف (${selectedCollegeDb.driveFiles?.length || 0})` : `Drive Files (${selectedCollegeDb.driveFiles?.length || 0})`}</span>
            </button>

            <button
              onClick={() => setActiveStudioTab('students')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer ${
                activeStudioTab === 'students'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Users size={16} />
              <span>{isAr ? 'الطلاب المسجلون' : 'Enrolled Students'}</span>
            </button>
          </div>

          {/* STUDIO TAB 1: SUBJECTS & GRADE DISTRIBUTIONS */}
          {activeStudioTab === 'subjects' && (
            <div className="space-y-5">
              
              {/* Year & Semester Switchers */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                {/* Years selector */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-zinc-400 mb-2">
                    {isAr ? 'اختر السنة الدراسية:' : 'Select Academic Year:'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: selectedCollegeDb.totalYears || 4 }, (_, i) => i + 1).map(year => (
                      <button
                        key={year}
                        onClick={() => setSelectedYearIndex(year)}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                          selectedYearIndex === year
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                        }`}
                      >
                        {isAr ? `السنة الدراسية ${year}` : `Year ${year}`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Semesters selector */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <label className="block text-[11px] font-black uppercase text-zinc-400 mb-2">
                    {isAr ? 'اختر الفصل الدراسي (الترم):' : 'Select Semester:'}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: selectedCollegeDb.semestersPerYear || 2 }, (_, i) => i + 1).map(sem => (
                      <button
                        key={sem}
                        onClick={() => setSelectedSemesterIndex(sem)}
                        className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                          selectedSemesterIndex === sem
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                        }`}
                      >
                        {isAr ? `الترم ${sem}` : `Semester ${sem}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Subjects in selected (Year, Semester) */}
              {(() => {
                const currentSemesterSubjects = (selectedCollegeDb.subjects || []).filter(
                  s => s.yearIndex === selectedYearIndex && s.semesterIndex === selectedSemesterIndex
                );

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                        {isAr 
                          ? `مواد (السنة ${selectedYearIndex} • الترم ${selectedSemesterIndex}) - [${currentSemesterSubjects.length} مادة]` 
                          : `Subjects for (Year ${selectedYearIndex} • Semester ${selectedSemesterIndex}) - [${currentSemesterSubjects.length} subjects]`}
                      </h4>

                      <button
                        onClick={handleOpenAddSubject}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>{isAr ? 'إضافة مادة' : 'Add Subject'}</span>
                      </button>
                    </div>

                    {currentSemesterSubjects.length === 0 ? (
                      <div className="py-12 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 space-y-2">
                        <BookOpen size={40} className="mx-auto opacity-20" />
                        <p className="font-bold text-xs">{isAr ? 'لا توجد مواد مسجلة لهذا الفصل الدراسي حتى الآن.' : 'No subjects registered for this semester yet.'}</p>
                        <button
                          onClick={handleOpenAddSubject}
                          className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          {isAr ? '+ إضافة مادة الآن' : '+ Add Subject Now'}
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentSemesterSubjects.map((subj) => (
                          <div
                            key={subj.id}
                            className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all space-y-3"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                {subj.code && (
                                  <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mb-1">
                                    {subj.code}
                                  </span>
                                )}
                                <h5 className="font-black text-sm text-zinc-900 dark:text-white">
                                  {subj.name}
                                </h5>
                                <p className="text-[11px] text-zinc-500 font-bold mt-0.5">
                                  {subj.creditHours} {isAr ? 'ساعات معتمدة' : 'credit hours'} • {subj.totalMarks} {isAr ? 'درجة كلية' : 'total marks'}
                                </p>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleOpenEditSubject(subj)}
                                  className="p-2 rounded-xl text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors cursor-pointer"
                                  title={isAr ? 'تعديل المادة وتوزيع الدرجات' : 'Edit Subject'}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(subj.id)}
                                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                                  title={isAr ? 'حذف المادة' : 'Delete Subject'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {/* Grade Distributions Breakdown */}
                            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1.5">
                              <span className="text-[10px] font-black uppercase text-zinc-400 block">
                                {isAr ? 'تقسيم وتوزيع الدرجات:' : 'Grade Distributions:'}
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {(subj.distributions || []).map((d, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-100 dark:border-indigo-900/40"
                                  >
                                    {d.name}: <span className="font-black">{d.maxMarks}</span> {isAr ? 'درجة' : 'marks'}
                                  </span>
                                ))}
                                {(!subj.distributions || subj.distributions.length === 0) && (
                                  <span className="text-[11px] text-zinc-400 italic">
                                    {isAr ? 'لم يتم تحديد بنود درجات بعد' : 'No distribution items'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STUDIO TAB 2: DRIVE MANAGEMENT */}
          {activeStudioTab === 'drive' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                <div>
                  <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                    {isAr ? 'درايف الكلية والمواد المرجعية' : 'College Reference Drive'}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {isAr ? 'الملفات والمجلدات التي يتم استنساخها لحسابات الطلاب عند استرداد هذه الكلية' : 'Files and folders cloned to students accounts upon restore'}
                  </p>
                </div>

                <button
                  onClick={() => setIsDriveModalOpen(true)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Plus size={15} />
                  <span>{isAr ? 'إضافة ملف / مجلد للدرايف' : 'Add Drive Item'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selectedCollegeDb.driveFiles?.map(file => (
                  <div
                    key={file.id}
                    className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shadow-2xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {file.type === 'folder' ? (
                        <Folder size={20} className="text-amber-500 shrink-0" />
                      ) : (
                        <FileText size={20} className="text-blue-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <h5 className="font-bold text-xs text-zinc-900 dark:text-white truncate">{file.name}</h5>
                        <span className="text-[10px] text-zinc-400 font-medium">
                          {file.type === 'folder' ? (isAr ? 'مجلد' : 'Folder') : `${(file.size / 1024 / 1024).toFixed(2)} MB`}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteDriveItem(file.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-lg cursor-pointer shrink-0"
                      title={isAr ? 'حذف من درايف الكلية' : 'Delete'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}

                {(!selectedCollegeDb.driveFiles || selectedCollegeDb.driveFiles.length === 0) && (
                  <div className="col-span-full py-12 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
                    {isAr ? 'لا توجد ملفات في درايف هذه الكلية بعد.' : 'No files in this college drive yet.'}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STUDIO TAB 3: ENROLLED STUDENTS */}
          {activeStudioTab === 'students' && (
            <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
              <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                {isAr ? 'الطلاب المسجلون تحت هذه الكلية والجامعة:' : 'Enrolled Students under this College & University:'}
              </h4>

              <div className="space-y-2">
                {studentsList.filter(
                  s => (s.university === selectedCollegeDb.universityNameAr || s.university === selectedCollegeDb.universityNameEn) &&
                       (s.college === selectedCollegeDb.collegeNameAr || s.college === selectedCollegeDb.collegeNameEn)
                ).map(st => (
                  <div key={st.id} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-between">
                    <div>
                      <h5 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">{st.name}</h5>
                      <p className="text-[11px] text-zinc-400">{st.email}</p>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      {st.subjects?.length || 0} {isAr ? 'مادة مسجلة' : 'subjects'}
                    </span>
                  </div>
                ))}

                {studentsList.filter(
                  s => (s.university === selectedCollegeDb.universityNameAr || s.university === selectedCollegeDb.universityNameEn) &&
                       (s.college === selectedCollegeDb.collegeNameAr || s.college === selectedCollegeDb.collegeNameEn)
                ).length === 0 && (
                  <p className="text-xs text-zinc-400 py-6 text-center">
                    {isAr ? 'لم يقم أي طالب بالتسجيل أو الاسترداد من هذه الكلية حتى الآن.' : 'No students enrolled under this college yet.'}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODALS & DIALOGS */}
      {/* ========================================================================= */}

      {/* --- CREATE UNIVERSITY DATABASE MODAL --- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 sm:p-7 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                    {isAr ? 'إنشاء وتجهيز قاعدة بيانات لجامعة جديدة' : 'Create University & College Database'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAr ? 'سحب الخطة والمواد والدرايف من طالب كقالب مستقل تماماً' : 'Clone curriculum & drive from a student as an independent template'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Modal Form Body with Ample Padding */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* Step 1: Select Source Student with Interactive Search */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                    {isAr ? '1. اختر الطالب المصدر لسحب البيانات منه *' : '1. Select Source Student *'}
                  </label>
                  {createForm.sourceUserId && (
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      <span>{isAr ? 'تم تحديد الطالب' : 'Student Selected'}</span>
                    </span>
                  )}
                </div>

                {/* Search box inside student selector */}
                <div className="relative">
                  <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder={isAr ? 'ابحث بالاسم، الإيميل، الجامعة، أو الكلية...' : 'Search student by name, email, university...'}
                    className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Students List Box */}
                <div className="max-h-[180px] overflow-y-auto space-y-2 p-1 border border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-800/20">
                  {filteredStudentsForCreate.map(st => {
                    const isSelected = createForm.sourceUserId === st.id;
                    const subjsCount = st.subjects?.length || st.subjectsCount || 0;
                    const filesCount = st.files?.length || st.filesCount || 0;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleSelectStudent(st)}
                        className={`w-full p-3 rounded-xl border text-left rtl:text-right transition-all flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-500 shadow-xs'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-black text-xs text-zinc-900 dark:text-white truncate">{st.name}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{st.email} • {st.university || 'غير محدد'} / {st.college || 'غير محدد'}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {subjsCount} {isAr ? 'مادة' : 'subjects'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {filesCount} {isAr ? 'ملف' : 'files'}
                          </span>
                          {isSelected && <Check size={16} className="text-indigo-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: University Names with Real-time Auto Translation */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                  {isAr ? '2. اسم الجامعة (عربي وإنجليزي)' : '2. University Name (Arabic & English)'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الجامعة (عربي) *' : 'University (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={createForm.universityNameAr}
                      onChange={(e) => handleUniversityArChange(e.target.value)}
                      placeholder={isAr ? 'مثال: جامعة القاهرة' : 'e.g. Cairo University'}
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الجامعة (English - تلقائي)' : 'University (English - Auto)'}
                    </label>
                    <input
                      type="text"
                      value={createForm.universityNameEn}
                      onChange={(e) => setCreateForm({ ...createForm, universityNameEn: e.target.value })}
                      placeholder="e.g. Cairo University"
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: College Names with Real-time Auto Translation */}
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                  {isAr ? '3. اسم الكلية (عربي وإنجليزي)' : '3. College Name (Arabic & English)'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الكلية (عربي) *' : 'College (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={createForm.collegeNameAr}
                      onChange={(e) => handleCollegeArChange(e.target.value)}
                      placeholder={isAr ? 'مثال: كلية الحاسبات والذكاء الاصطناعي' : 'e.g. Faculty of Computers'}
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الكلية (English - تلقائي)' : 'College (English - Auto)'}
                    </label>
                    <input
                      type="text"
                      value={createForm.collegeNameEn}
                      onChange={(e) => setCreateForm({ ...createForm, collegeNameEn: e.target.value })}
                      placeholder="e.g. Faculty of Computers and AI"
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 4: Total Study Years & Semesters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                    {isAr ? 'عدد السنوات الدراسية للكلية' : 'Total Study Years'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={createForm.customYears}
                    onChange={(e) => setCreateForm({ ...createForm, customYears: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                    {isAr ? 'عدد الفصول (الترمات) في كل سنة' : 'Semesters Per Year'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={createForm.customSemesters}
                    onChange={(e) => setCreateForm({ ...createForm, customSemesters: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCreateDatabase}
                disabled={creating}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isAr ? 'إنشاء وسحب قاعدة البيانات' : 'Create & Clone Database'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- ADD / EDIT SUBJECT MODAL (WITH DYNAMIC GRADE DISTRIBUTIONS) --- */}
      {isSubjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-xl max-h-[90vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white">
                {editingSubject 
                  ? (isAr ? 'تعديل المادة وتوزيع الدرجات في القالب' : 'Edit Subject in Template')
                  : (isAr ? 'إضافة مادة جديدة وتحديد توزيع درجاتها' : 'Add Subject to Template')}
              </h3>
              <button onClick={() => setIsSubjectModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-5 overflow-y-auto flex-1">
              
              {/* Subject Name */}
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'اسم المادة الدراسية *' : 'Subject Name *'}
                </label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder={isAr ? 'مثال: هياكل البيانات والخوارزميات' : 'e.g. Data Structures'}
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Subject Code & Credit Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'كود المادة (تكتبه بنفسك، لا يتم توليده تلقائياً)' : 'Subject Code'}
                  </label>
                  <input
                    type="text"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    placeholder={isAr ? 'مثال: CS211' : 'e.g. CS211'}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'الساعات المعتمدة' : 'Credit Hours'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={subjectForm.creditHours}
                    onChange={(e) => setSubjectForm({ ...subjectForm, creditHours: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Total Marks, Year, Semester */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'الدرجة الكلية' : 'Total Marks'}
                  </label>
                  <input
                    type="number"
                    value={subjectForm.totalMarks}
                    onChange={(e) => setSubjectForm({ ...subjectForm, totalMarks: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'السنة الدراسية' : 'Year'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedCollegeDb?.totalYears || 4}
                    value={subjectForm.yearIndex}
                    onChange={(e) => setSubjectForm({ ...subjectForm, yearIndex: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'الترم' : 'Semester'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedCollegeDb?.semestersPerYear || 2}
                    value={subjectForm.semesterIndex}
                    onChange={(e) => setSubjectForm({ ...subjectForm, semesterIndex: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Dynamic Grade Distributions Manager */}
              <div className="space-y-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                    {isAr ? 'توزيع وتقسيم الدرجات (بند / درجة)' : 'Grade Distributions Breakdown'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSubjectForm({
                        ...subjectForm,
                        distributions: [
                          ...subjectForm.distributions,
                          { id: uuidv4(), name: '', maxMarks: 10, achievedMarks: null, status: 'current' }
                        ]
                      });
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>{isAr ? 'إضافة بند درجة' : 'Add Item'}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {subjectForm.distributions.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const updated = [...subjectForm.distributions];
                          updated[idx].name = e.target.value;
                          setSubjectForm({ ...subjectForm, distributions: updated });
                        }}
                        placeholder={isAr ? 'اسم البند (مثال: ميدتيرم، عملي، فاينل)' : 'Item name'}
                        className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                      />
                      <input
                        type="number"
                        value={item.maxMarks}
                        onChange={(e) => {
                          const updated = [...subjectForm.distributions];
                          updated[idx].maxMarks = Number(e.target.value);
                          setSubjectForm({ ...subjectForm, distributions: updated });
                        }}
                        placeholder="20"
                        className="w-20 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectForm({
                            ...subjectForm,
                            distributions: subjectForm.distributions.filter((_, i) => i !== idx)
                          });
                        }}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="px-5 py-2.5 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveSubject}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                {isAr ? 'حفظ المادة في القالب' : 'Save Subject'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- ADD DRIVE ITEM MODAL --- */}
      {isDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              {isAr ? 'إضافة ملف أو مجلد في درايف الكلية' : 'Add Drive Item'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'النوع' : 'Type'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDriveForm({ ...driveForm, type: 'folder' })}
                    className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 ${
                      driveForm.type === 'folder'
                        ? 'bg-amber-50 dark:bg-amber-950 border-amber-500 text-amber-700 dark:text-amber-300'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <Folder size={16} />
                    <span>{isAr ? 'مجلد' : 'Folder'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDriveForm({ ...driveForm, type: 'file' })}
                    className={`py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-2 ${
                      driveForm.type === 'file'
                        ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300'
                        : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <FileText size={16} />
                    <span>{isAr ? 'ملف مرجعي' : 'File'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'اسم الملف أو المجلد *' : 'Name *'}
                </label>
                <input
                  type="text"
                  value={driveForm.name}
                  onChange={(e) => setDriveForm({ ...driveForm, name: e.target.value })}
                  placeholder={isAr ? 'مثال: محاضرات الترم الأول' : 'e.g. Lecture Slides'}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {driveForm.type === 'file' && (
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'رابط الملف (اختياري)' : 'File URL'}
                  </label>
                  <input
                    type="text"
                    value={driveForm.url}
                    onChange={(e) => setDriveForm({ ...driveForm, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsDriveModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveDriveItem}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إضافة' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE MODAL --- */}
      {dbToDelete && (
        <ConfirmModal
          isOpen={true}
          title={isAr ? 'حذف قاعدة بيانات الكلية' : 'Delete College Database'}
          message={isAr 
            ? `هل أنت متأكد من حذف قاعدة بيانات "${dbToDelete.universityNameAr} - ${dbToDelete.collegeNameAr}" من القوالب؟ (لن يؤثر ذلك على حسابات الطلاب)` 
            : `Delete "${dbToDelete.collegeNameAr}" template?`}
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
