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
  ChevronLeft,
  Eye,
  Download,
  FolderInput,
  CornerDownRight,
  RotateCcw,
  Send,
  UserCheck,
  Move,
  Award,
  Save
} from 'lucide-react';
import { db } from '../../lib/db';
import { UniversityDatabase, UniversityPendingUpdate, Subject, DriveFile, GradeDistributionItem, GradeRule } from '../../types';
import { ConfirmModal } from '../ui/CustomModal';
import { autoTranslateUniversity, autoTranslateCollege } from '../../lib/academicTranslation';
import { previewFile, downloadFile } from '../../lib/backblaze';

interface AdminUniversitiesTabProps {
  studentsList: any[];
  onRefreshAllData: () => Promise<void>;
  subTab?: 'universities' | 'updates';
  onSubTabChange?: (tab: 'universities' | 'updates') => void;
}

export function AdminUniversitiesTab({
  studentsList,
  onRefreshAllData,
  subTab = 'universities',
  onSubTabChange
}: AdminUniversitiesTabProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;
  const BackIcon = isAr ? ArrowRight : ArrowLeft;

  const [loading, setLoading] = useState(true);
  const [databases, setDatabases] = useState<UniversityDatabase[]>([]);
  const [pendingUpdates, setPendingUpdates] = useState<UniversityPendingUpdate[]>([]);
  
  // Reset View Listener when clicking Universities in Sidebar
  useEffect(() => {
    const handleResetView = () => {
      setSelectedUniversityKey(null);
      setSelectedCollegeId(null);
      try {
        sessionStorage.removeItem('unistudent_admin_selected_uni_key');
        sessionStorage.removeItem('unistudent_admin_selected_college_id');
      } catch {}
    };
    window.addEventListener('reset-universities-view', handleResetView);
    return () => window.removeEventListener('reset-universities-view', handleResetView);
  }, []);

  // Edit / Delete University State
  const [editingUni, setEditingUni] = useState<{ oldKey: string; nameAr: string; nameEn: string } | null>(null);
  const [isEditUniModalOpen, setIsEditUniModalOpen] = useState(false);
  const [uniToDelete, setUniToDelete] = useState<{ key: string; nameAr: string; nameEn: string; collegeCount: number } | null>(null);

  // College Grading Scale State
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRule | null>(null);
  const [gradeForm, setGradeForm] = useState<GradeRule>({
    id: '',
    letter: 'A',
    nameAr: 'ممتاز',
    nameEn: 'Excellent',
    minPercentage: 85,
    maxPercentage: 100,
    maxOperator: '<=',
    points: 4.0
  });

  // Grouped Pending Updates State
  const [expandedGroupKeys, setExpandedGroupKeys] = useState<Record<string, boolean>>({});

  // Navigation State with Session Storage Persistence
  const [selectedUniversityKey, setSelectedUniversityKey] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('unistudent_admin_selected_uni_key') || null;
    } catch {
      return null;
    }
  });

  const [selectedCollegeId, setSelectedCollegeId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('unistudent_admin_selected_college_id') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (selectedUniversityKey) {
        sessionStorage.setItem('unistudent_admin_selected_uni_key', selectedUniversityKey);
      } else {
        sessionStorage.removeItem('unistudent_admin_selected_uni_key');
      }
    } catch {}
  }, [selectedUniversityKey]);

  useEffect(() => {
    try {
      if (selectedCollegeId) {
        sessionStorage.setItem('unistudent_admin_selected_college_id', selectedCollegeId);
      } else {
        sessionStorage.removeItem('unistudent_admin_selected_college_id');
      }
    } catch {}
  }, [selectedCollegeId]);

  // Active College Object
  const selectedCollegeDb = useMemo(() => {
    if (!selectedCollegeId) return null;
    return databases.find(d => d.id === selectedCollegeId) || null;
  }, [databases, selectedCollegeId]);
  
  // Studio Navigation inside a College
  const [selectedYearIndex, setSelectedYearIndex] = useState<number>(1);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState<number>(1);
  const [activeStudioTab, setActiveStudioTab] = useState<'subjects' | 'drive' | 'students' | 'updates' | 'grading'>('subjects');

  // Search & Global Filter
  const [globalSearch, setGlobalSearch] = useState('');
  const [updatesFilter, setUpdatesFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbToDelete, setDbToDelete] = useState<UniversityDatabase | null>(null);

  // College Academic Structure Modal State
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structureForm, setStructureForm] = useState({ totalYears: 4, semestersPerYear: 2 });

  // Switch Source Student Modal State
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [notifySourceStudent, setNotifySourceStudent] = useState(false);

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

  // Drive File / Folder Management State
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const [currentDriveFolderId, setCurrentDriveFolderId] = useState<string | null>(null);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
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

  // Move Drive Item Modal State
  const [movingFile, setMovingFile] = useState<DriveFile | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<string | null>(null);

  // --- Step 1: Create University Modal State ---
  const [isCreateUniModalOpen, setIsCreateUniModalOpen] = useState(false);
  const [createUniForm, setCreateUniForm] = useState({
    nameAr: '',
    nameEn: '',
    sourceUserId: ''
  });
  const [uniStudentSearchQuery, setUniStudentSearchQuery] = useState('');
  const [creatingUni, setCreatingUni] = useState(false);

  // --- Step 2: Create College in University Modal State ---
  const [isCreateCollegeModalOpen, setIsCreateCollegeModalOpen] = useState(false);
  const [createCollegeForm, setCreateCollegeForm] = useState({
    collegeNameAr: '',
    collegeNameEn: '',
    sourceUserId: '',
    customYears: 4,
    customSemesters: 2
  });
  const [collegeStudentSearchQuery, setCollegeStudentSearchQuery] = useState('');
  const [showAllStudentsForCollege, setShowAllStudentsForCollege] = useState(false);
  const [creatingCollege, setCreatingCollege] = useState(false);

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
    } catch (e) {
      console.error('Error loading university databases:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUniData();
  }, []);

  useEffect(() => {
    const handleOpenModal = () => setIsCreateUniModalOpen(true);
    window.addEventListener('open-create-uni-modal', handleOpenModal);
    return () => window.removeEventListener('open-create-uni-modal', handleOpenModal);
  }, []);

  // Group databases by unique University Name (combining registered standalone universities)
  const groupedUniversities = useMemo(() => {
    const map: Record<string, {
      key: string;
      nameAr: string;
      nameEn: string;
      colleges: UniversityDatabase[];
      totalStudents: number;
      totalSubjects: number;
      totalDriveFiles: number;
      pendingUpdatesCount: number;
    }> = {};

    // 1. Include registered standalone universities
    const registered = db.getRegisteredUniversities();
    registered.forEach(r => {
      const key = (r.nameAr || r.nameEn || r.key).trim();
      if (!map[key]) {
        map[key] = {
          key,
          nameAr: r.nameAr || key,
          nameEn: r.nameEn || key,
          colleges: [],
          totalStudents: 0,
          totalSubjects: 0,
          totalDriveFiles: 0,
          pendingUpdatesCount: 0
        };
      }
    });

    // 2. Group databases
    databases.forEach(dbItem => {
      const key = (dbItem.universityNameAr || dbItem.universityNameEn || 'جامعة أخرى').trim();
      if (!map[key]) {
        map[key] = {
          key,
          nameAr: dbItem.universityNameAr || key,
          nameEn: dbItem.universityNameEn || key,
          colleges: [],
          totalStudents: 0,
          totalSubjects: 0,
          totalDriveFiles: 0,
          pendingUpdatesCount: 0
        };
      }
      map[key].colleges.push(dbItem);
      map[key].totalSubjects += (dbItem.subjects?.length || 0);
      map[key].totalDriveFiles += (dbItem.driveFiles?.length || 0);

      // Enrolled students in this college
      const enrolled = studentsList.filter(
        s => (s.university === dbItem.universityNameAr || s.university === dbItem.universityNameEn) &&
             (s.college === dbItem.collegeNameAr || s.college === dbItem.collegeNameEn)
      ).length;
      map[key].totalStudents += enrolled;

      // Pending updates in this college
      const colUpdates = pendingUpdates.filter(
        p => p.universityDatabaseId === dbItem.id && p.status === 'pending'
      ).length;
      map[key].pendingUpdatesCount += colUpdates;
    });

    return Object.values(map);
  }, [databases, studentsList, pendingUpdates]);

  // Active University Group (with resilient fallback if all colleges are deleted)
  const currentUniversityGroup = useMemo(() => {
    if (!selectedUniversityKey) return null;
    const found = groupedUniversities.find(u => u.key === selectedUniversityKey);
    if (found) return found;
    return {
      key: selectedUniversityKey,
      nameAr: selectedUniversityKey,
      nameEn: selectedUniversityKey,
      colleges: [],
      totalStudents: 0,
      totalSubjects: 0,
      totalDriveFiles: 0,
      pendingUpdatesCount: 0
    };
  }, [groupedUniversities, selectedUniversityKey]);

  // Filtered Universities for Search
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

  // University Matcher helper (Arabic, English, aliases and abbreviations like BNU, CU, ASU, etc.)
  const matchesUniversity = (studentUni: string | undefined, targetUniAr: string, targetUniEn: string): boolean => {
    if (!studentUni) return false;
    const s = studentUni.trim().toLowerCase();
    const ar = (targetUniAr || '').trim().toLowerCase();
    const en = (targetUniEn || '').trim().toLowerCase();
    if (s === 'غير محدد' || s === 'not specified' || s === '') return false;

    if (s === ar || s === en) return true;
    if (ar && (s.includes(ar) || ar.includes(s))) return true;
    if (en && (s.includes(en) || en.includes(s))) return true;

    const clean = (str: string) => str.replace(/^(جامعة|جامعه)\s+/, '').replace(/\s+(university|univ)$/i, '').replace(/^university\s+of\s+/i, '').trim();
    const cleanS = clean(s);
    const cleanAr = clean(ar);
    const cleanEn = clean(en);

    if (cleanS && (cleanS === cleanAr || cleanS === cleanEn || cleanAr.includes(cleanS) || cleanS.includes(cleanAr) || cleanEn.includes(cleanS) || cleanS.includes(cleanEn))) {
      return true;
    }

    const uniAbbreviations: Record<string, string[]> = {
      'بنها': ['bnu', 'bu', 'benha', 'banha'],
      'القاهرة': ['cu', 'cairo'],
      'عين شمس': ['asu', 'ain shams', 'ain-shams'],
      'الإسكندرية': ['au', 'alex', 'alexandria'],
      'المنصورة': ['mu', 'mansoura'],
      'حلوان': ['hu', 'helwan'],
      'المنوفية': ['mu', 'menofia', 'menoufia'],
      'الزقازيق': ['zu', 'zagazig'],
      'أسيوط': ['au', 'assiut', 'asyut'],
      'طنطا': ['tu', 'tanta'],
      'كفر الشيخ': ['ksu', 'kafr el-sheikh', 'kafr el sheikh'],
      'قناة السويس': ['scu', 'suez canal'],
      'بورسعيد': ['psu', 'port said'],
      'دمياط': ['du', 'damietta'],
      'سوهاج': ['su', 'sohag'],
      'جنوب الوادي': ['svu', 'south valley'],
      'بني سويف': ['bsu', 'beni-suef', 'beni suef'],
      'الفيوم': ['fu', 'fayoum', 'fayum'],
      'الأزهر': ['azhar', 'al-azhar', 'alazhar']
    };

    for (const [keyWord, aliases] of Object.entries(uniAbbreviations)) {
      const isTargetThisUni = ar.includes(keyWord) || aliases.some(a => en.includes(a));
      if (isTargetThisUni) {
        if (s.includes(keyWord) || aliases.some(a => s === a || s.includes(a))) {
          return true;
        }
      }
    }

    return false;
  };

  // Filtered Students for Create University Modal
  const filteredStudentsForCreateUni = useMemo(() => {
    if (!uniStudentSearchQuery.trim()) return studentsList;
    const q = uniStudentSearchQuery.toLowerCase().trim();
    return studentsList.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.university || '').toLowerCase().includes(q) ||
      (s.college || '').toLowerCase().includes(q)
    );
  }, [studentsList, uniStudentSearchQuery]);

  // Filtered Students for Create College Modal
  const filteredStudentsForCreateCollege = useMemo(() => {
    let list = studentsList;
    if (!showAllStudentsForCollege && currentUniversityGroup) {
      list = list.filter(st => matchesUniversity(st.university, currentUniversityGroup.nameAr, currentUniversityGroup.nameEn));
    }
    if (!collegeStudentSearchQuery.trim()) return list;
    const q = collegeStudentSearchQuery.toLowerCase().trim();
    return list.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.university || '').toLowerCase().includes(q) ||
      (s.college || '').toLowerCase().includes(q)
    );
  }, [studentsList, showAllStudentsForCollege, currentUniversityGroup, collegeStudentSearchQuery]);

  // Filtered Students for Switch Source Modal
  const filterStudentsByQuery = (query: string) => {
    if (!query.trim()) return studentsList;
    const q = query.toLowerCase().trim();
    return studentsList.filter(s => 
      (s.name || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.university || '').toLowerCase().includes(q) ||
      (s.college || '').toLowerCase().includes(q)
    );
  };
  const filteredStudentsForSource = useMemo(() => filterStudentsByQuery(sourceSearchQuery), [studentsList, sourceSearchQuery]);

  // Handle Student Selection in Create University Modal (Pulls ONLY University name)
  const handleSelectStudentForUni = (st: any) => {
    const uniAr = st.university && st.university !== 'غير محدد' && st.university !== 'Not specified' ? st.university : '';
    setCreateUniForm({
      sourceUserId: st.id,
      nameAr: uniAr,
      nameEn: autoTranslateUniversity(uniAr)
    });
  };

  // Handle Create University Action
  const handleCreateUniversity = async () => {
    const nameAr = createUniForm.nameAr.trim();
    const nameEn = createUniForm.nameEn.trim() || autoTranslateUniversity(nameAr);
    if (!nameAr && !nameEn) {
      alert(isAr ? 'يرجى إدخال اسم الجامعة أو اختيار طالب.' : 'Please enter university name or pick a student.');
      return;
    }

    try {
      setCreatingUni(true);
      db.registerUniversity(nameAr, nameEn);
      setIsCreateUniModalOpen(false);
      const createdKey = nameAr || nameEn;
      setCreateUniForm({ nameAr: '', nameEn: '', sourceUserId: '' });
      await loadUniData();
      // Directly select this university to open its Colleges page
      setSelectedUniversityKey(createdKey);
      setSelectedCollegeId(null);
    } catch (e) {
      console.error('Error creating university:', e);
    } finally {
      setCreatingUni(false);
    }
  };

  // Handle Student Selection in Create College Modal (Pulls College name, study years & semesters)
  const handleSelectStudentForCollege = (st: any) => {
    const colAr = st.college && st.college !== 'غير محدد' && st.college !== 'Not specified' ? st.college : '';
    setCreateCollegeForm({
      sourceUserId: st.id,
      collegeNameAr: colAr,
      collegeNameEn: autoTranslateCollege(colAr),
      customYears: st.totalYears || 4,
      customSemesters: st.semestersPerYear || 2
    });
  };

  // Handle Create College in University Action
  const handleCreateCollege = async () => {
    if (!currentUniversityGroup) return;
    if (!createCollegeForm.collegeNameAr.trim() && !createCollegeForm.collegeNameEn.trim()) {
      alert(isAr ? 'يرجى إدخال اسم الكلية.' : 'Please enter college name.');
      return;
    }
    if (!createCollegeForm.sourceUserId) {
      alert(isAr ? 'يرجى اختيار الطالب المصدر لسحب بيانات الكلية منه.' : 'Please select a source student.');
      return;
    }

    try {
      setCreatingCollege(true);
      const source = studentsList.find(s => s.id === createCollegeForm.sourceUserId);
      const studentSubjs = source?.subjects || source?.raw?.subjects || [];
      const studentFiles = source?.files || source?.raw?.files || [];

      // Clone subjects cleanly with exact yearIndex and semesterIndex
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
        universityNameAr: currentUniversityGroup.nameAr,
        universityNameEn: currentUniversityGroup.nameEn,
        collegeNameAr: createCollegeForm.collegeNameAr.trim() || createCollegeForm.collegeNameEn.trim(),
        collegeNameEn: createCollegeForm.collegeNameEn.trim() || createCollegeForm.collegeNameAr.trim(),
        sourceUserId: source ? source.id : createCollegeForm.sourceUserId,
        sourceUserEmail: source?.email || '',
        sourceUserName: source?.name || '',
        totalYears: createCollegeForm.customYears || source?.totalYears || 4,
        semestersPerYear: createCollegeForm.customSemesters || source?.semestersPerYear || 2,
        subjects: clonedSubjects,
        driveFiles: clonedDrive,
        gradingScale: (source?.gradingScale && source.gradingScale.length > 0) ? source.gradingScale : (source?.raw?.settings?.grading_scale || []),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.createUniversityDatabase(newDb);

      setIsCreateCollegeModalOpen(false);
      setCreateCollegeForm({
        collegeNameAr: '',
        collegeNameEn: '',
        sourceUserId: '',
        customYears: 4,
        customSemesters: 2
      });
      await loadUniData();
    } catch (e) {
      console.error('Error creating college:', e);
    } finally {
      setCreatingCollege(false);
    }
  };

  // Delete College Database Action
  const handleDeleteDatabase = async () => {
    if (!dbToDelete) return;
    try {
      await db.deleteUniversityDatabase(dbToDelete.id);
      setDbToDelete(null);
      if (selectedCollegeId === dbToDelete.id) {
        setSelectedCollegeId(null);
      }
      await loadUniData();
    } catch (e) {
      console.error('Error deleting university database:', e);
    }
  };

  // Update College Structure (Years & Semesters)
  const handleSaveStructure = async () => {
    if (!selectedCollegeDb) return;
    try {
      await db.updateUniversityDatabase(selectedCollegeDb.id, {
        totalYears: structureForm.totalYears,
        semestersPerYear: structureForm.semestersPerYear
      });
      setIsStructureModalOpen(false);
      await loadUniData();
    } catch (e) {
      console.error('Error updating structure:', e);
    }
  };

  // Switch Source Student Action (Clean Wipe & Overwrite: No Merging)
  const handleSwitchSourceStudent = async (newStudent: any) => {
    if (!selectedCollegeDb) return;
    try {
      const studentSubjs = newStudent?.subjects || newStudent?.raw?.subjects || [];
      const studentFiles = newStudent?.files || newStudent?.raw?.files || [];
      const studentGrading = (newStudent?.gradingScale && newStudent.gradingScale.length > 0)
        ? newStudent.gradingScale
        : (newStudent?.raw?.settings?.grading_scale || selectedCollegeDb.gradingScale || []);

      // Clone subjects cleanly with fresh template IDs
      const clonedSubjects: Subject[] = studentSubjs.map((s: any) => ({
        id: s.id || uuidv4(),
        code: (s.code || '').trim(),
        name: s.name,
        creditHours: Number(s.creditHours || s.credit_hours || 3),
        totalMarks: Number(s.totalMarks || s.total_marks || 100),
        yearIndex: Number(s.yearIndex || s.year_index || 1),
        semesterIndex: Number(s.semesterIndex || s.semester_index || 1),
        distributions: (s.distributions || []).map((d: any) => ({
          id: d.id || uuidv4(),
          name: d.name,
          maxMarks: Number(d.maxMarks || d.max_marks || 0),
          achievedMarks: null,
          status: 'current' as const
        })),
        status: 'current' as const,
        includeInGpa: s.includeInGpa !== false && s.include_in_gpa !== false
      }));

      // Clone drive files cleanly
      const clonedDrive: DriveFile[] = studentFiles.map((f: any) => ({
        id: f.id || uuidv4(),
        name: f.name,
        size: Number(f.size || 0),
        type: f.type || 'file',
        parentId: f.parentId || f.parent_id || null,
        createdAt: f.createdAt || f.upload_date || new Date().toISOString(),
        url: f.url || '',
        b2FileId: f.b2FileId || f.b2_file_id
      }));

      const cleanOverwriteData: Partial<UniversityDatabase> = {
        sourceUserId: newStudent.id,
        sourceUserName: newStudent.name || '',
        sourceUserEmail: newStudent.email || '',
        totalYears: newStudent.totalYears || selectedCollegeDb.totalYears || 4,
        semestersPerYear: newStudent.semestersPerYear || selectedCollegeDb.semestersPerYear || 2,
        subjects: clonedSubjects,
        driveFiles: clonedDrive,
        gradingScale: studentGrading
      };

      // 1. Immediate local state update for instant UI feedback
      setDatabases(prev => prev.map(dbItem => {
        if (dbItem.id === selectedCollegeDb.id) {
          return {
            ...dbItem,
            ...cleanOverwriteData
          };
        }
        return dbItem;
      }));

      // 2. Persist to DB (Completely overwrites old subjects & drive & grading)
      await db.updateUniversityDatabase(selectedCollegeDb.id, cleanOverwriteData);

      if (notifySourceStudent) {
        await db.sendStudentNotification(newStudent.id, {
          title: isAr ? 'تم اختيار حسابك كقالب مصدر لقاعدة بيانات الكلية' : 'Assigned as Source Student',
          message: isAr 
            ? `مرحباً ${newStudent.name}، تم اختيار حسابك من قبل الإدارة كقالب مرجعي معتمد لكلية ${selectedCollegeDb.collegeNameAr}.` 
            : `Your account is now the reference template for ${selectedCollegeDb.collegeNameEn}.`,
          type: 'source_alert'
        });
      }

      setIsSourceModalOpen(false);
      await loadUniData();
    } catch (e) {
      console.error('Error switching source student:', e);
    }
  };

  // Save / Edit University Name Across All Colleges
  const handleSaveEditUni = async () => {
    if (!editingUni) return;
    const newNameAr = editingUni.nameAr.trim();
    const newNameEn = editingUni.nameEn.trim() || newNameAr;
    if (!newNameAr) return;

    try {
      await db.updateUniversityName(editingUni.oldKey, newNameAr, newNameEn);
      setDatabases(prev => prev.map(dbItem => {
        if ((dbItem.universityNameAr && dbItem.universityNameAr.trim() === editingUni.oldKey.trim()) || 
            (dbItem.universityNameEn && dbItem.universityNameEn.trim() === editingUni.oldKey.trim())) {
          return {
            ...dbItem,
            universityNameAr: newNameAr,
            universityNameEn: newNameEn
          };
        }
        return dbItem;
      }));
      if (selectedUniversityKey === editingUni.oldKey) {
        setSelectedUniversityKey(newNameAr);
      }
      setIsEditUniModalOpen(false);
      setEditingUni(null);
      await loadUniData();
    } catch (e) {
      console.error('Error updating university name:', e);
    }
  };

  // Delete University & All Its Colleges
  const handleConfirmDeleteUni = async () => {
    if (!uniToDelete) return;
    try {
      await db.deleteUniversity(uniToDelete.key);
      setDatabases(prev => prev.filter(d => 
        (d.universityNameAr && d.universityNameAr.trim() !== uniToDelete.key.trim()) &&
        (d.universityNameEn && d.universityNameEn.trim() !== uniToDelete.key.trim())
      ));
      if (selectedUniversityKey === uniToDelete.key) {
        setSelectedUniversityKey(null);
        setSelectedCollegeId(null);
      }
      setUniToDelete(null);
      await loadUniData();
    } catch (e) {
      console.error('Error deleting university:', e);
    }
  };

  // College Grading Scale Handlers
  const handleSaveGradingScale = async (newScale: GradeRule[]) => {
    if (!selectedCollegeDb) return;
    try {
      setDatabases(prev => prev.map(dbItem => {
        if (dbItem.id === selectedCollegeDb.id) {
          return { ...dbItem, gradingScale: newScale };
        }
        return dbItem;
      }));
      await db.updateUniversityDatabase(selectedCollegeDb.id, { gradingScale: newScale });
      // Sync grading scale to all students who restored this database
      await db.syncUniversityDatabaseChangesToStudents(selectedCollegeDb.id, {
        type: 'update_grading_scale',
        gradingScale: newScale
      });
    } catch (e) {
      console.error('Error updating grading scale:', e);
    }
  };

  const handleOpenAddGrade = () => {
    setEditingGrade(null);
    setGradeForm({
      id: uuidv4(),
      letter: 'A',
      nameAr: 'ممتاز',
      nameEn: 'Excellent',
      minPercentage: 85,
      maxPercentage: 100,
      maxOperator: '<=',
      points: 4.0
    });
    setIsGradeModalOpen(true);
  };

  const handleOpenEditGrade = (grade: GradeRule) => {
    setEditingGrade(grade);
    setGradeForm({ ...grade });
    setIsGradeModalOpen(true);
  };

  const handleSaveGradeForm = async () => {
    if (!selectedCollegeDb) return;
    const currentScale = selectedCollegeDb.gradingScale || [];
    let updatedScale: GradeRule[];
    if (editingGrade) {
      updatedScale = currentScale.map(g => g.id === editingGrade.id ? gradeForm : g);
    } else {
      updatedScale = [...currentScale, { ...gradeForm, id: gradeForm.id || uuidv4() }];
    }
    await handleSaveGradingScale(updatedScale);
    setIsGradeModalOpen(false);
  };

  const handleDeleteGrade = async (gradeId: string) => {
    if (!selectedCollegeDb) return;
    const currentScale = selectedCollegeDb.gradingScale || [];
    const updatedScale = currentScale.filter(g => g.id !== gradeId);
    await handleSaveGradingScale(updatedScale);
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
      const sanitizedDistributions = subjectForm.distributions
        .filter(d => (d.name || '').trim() !== '' || Number(d.maxMarks) > 0)
        .map(d => ({
          id: d.id || uuidv4(),
          name: (d.name || 'بند').trim(),
          maxMarks: Number(d.maxMarks || 0),
          achievedMarks: null,
          status: 'current' as const
        }));

      const subjectPayload: Subject = {
        id: editingSubject ? editingSubject.id : uuidv4(),
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim(),
        creditHours: Number(subjectForm.creditHours || 3),
        totalMarks: Number(subjectForm.totalMarks || 100),
        yearIndex: Number(subjectForm.yearIndex),
        semesterIndex: Number(subjectForm.semesterIndex),
        distributions: sanitizedDistributions.length > 0 ? sanitizedDistributions : [
          { id: uuidv4(), name: 'درجة المادة', maxMarks: Number(subjectForm.totalMarks || 100), achievedMarks: null, status: 'current' }
        ],
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
      
      // Real-time synchronization to all enrolled/restored students
      await db.syncUniversityDatabaseChangesToStudents(selectedCollegeDb.id, {
        type: editingSubject ? 'update_subject' : 'add_subject',
        subject: subjectPayload
      });

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
      const targetSubj = selectedCollegeDb.subjects.find(s => s.id === subjectId);
      const updatedSubjects = selectedCollegeDb.subjects.filter(s => s.id !== subjectId);
      await db.updateUniversityDatabase(selectedCollegeDb.id, { subjects: updatedSubjects });
      
      // Real-time synchronization to all enrolled/restored students
      await db.syncUniversityDatabaseChangesToStudents(selectedCollegeDb.id, {
        type: 'delete_subject',
        subjectId,
        subject: targetSubj
      });

      await loadUniData();
    } catch (e) {
      console.error('Error deleting subject:', e);
    }
  };

  // Save Drive Item (File / Folder)
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
        parentId: currentDriveFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: driveForm.url.trim()
      };

      const updatedFiles = [...(selectedCollegeDb.driveFiles || []), newItem];
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setIsDriveModalOpen(false);
      setDriveForm({ name: '', type: 'folder', url: '', parentId: null });
      await loadUniData();
    } catch (e) {
      console.error('Error saving drive item:', e);
    }
  };

  // Move Drive Item into Folder
  const handleConfirmMoveFile = async () => {
    if (!selectedCollegeDb || !movingFile) return;
    try {
      const updatedFiles = selectedCollegeDb.driveFiles.map(f => 
        f.id === movingFile.id ? { ...f, parentId: targetMoveFolderId } : f
      );
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setMovingFile(null);
      setTargetMoveFolderId(null);
      await loadUniData();
    } catch (e) {
      console.error('Error moving drive file:', e);
    }
  };

  // Delete Drive Item
  const handleDeleteDriveItem = async (fileId: string) => {
    if (!selectedCollegeDb) return;
    if (!confirm(isAr ? 'هل أنت متأكد من حذف هذا الملف/المجلد من درايف الكلية؟' : 'Delete file from drive?')) return;
    try {
      const updatedFiles = selectedCollegeDb.driveFiles.filter(f => f.id !== fileId && f.parentId !== fileId);
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      await loadUniData();
    } catch (e) {
      console.error('Error deleting file:', e);
    }
  };

  // Preview Drive File in Browser
  const handlePreviewDriveFile = async (file: DriveFile) => {
    if (file.type === 'folder') {
      setCurrentDriveFolderId(file.id);
      return;
    }

    try {
      await previewFile(file);
    } catch (err) {
      console.error('Error previewing file:', err);
      if (file.url) {
        window.open(file.url, '_blank');
      } else {
        alert(isAr ? 'لا يوجد رابط متاح لمعاينة هذا الملف.' : 'No preview URL available for this file.');
      }
    }
  };

  // Download Drive File
  const handleDownloadDriveFile = async (e: React.MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    try {
      setDownloadingFileId(file.id);
      await downloadFile(file);
    } catch (err) {
      console.error('Error downloading file:', err);
      if (file.url) {
        window.open(file.url, '_blank');
      } else {
        alert(isAr ? 'فشل تنزيل الملف.' : 'Failed to download file.');
      }
    } finally {
      setDownloadingFileId(null);
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Respond to Pending Update (with Reversible status and resilient ID & Distribution matching)
  const handleResolvePendingUpdate = async (update: UniversityPendingUpdate, status: 'approved' | 'rejected' | 'pending') => {
    try {
      if (status === 'pending') {
        await db.recordPendingUpdate({ ...update, status: 'pending', resolvedAt: undefined });
      } else {
        await db.respondToPendingUpdate(update.id, status, (targetDb) => {
          if (update.type === 'add_subject' && update.data) {
            const subjectId = update.data.id || uuidv4();
            const newSubj: Subject = {
              id: subjectId,
              code: (update.data.code || '').trim(),
              name: update.data.name,
              creditHours: Number(update.data.creditHours || update.data.credit_hours || 3),
              totalMarks: Number(update.data.totalMarks || update.data.total_marks || 100),
              yearIndex: Number(update.data.yearIndex || update.data.year_index || 1),
              semesterIndex: Number(update.data.semesterIndex || update.data.semester_index || 1),
              distributions: (update.data.distributions || []).map((d: any) => ({
                id: d.id || uuidv4(),
                name: d.name,
                maxMarks: Number(d.maxMarks || d.max_marks || 0),
                achievedMarks: null,
                status: 'current' as const
              })),
              status: 'current',
              includeInGpa: update.data.includeInGpa !== false
            };
            const filtered = targetDb.subjects.filter(s => s.id !== subjectId && !(s.name === newSubj.name && s.yearIndex === newSubj.yearIndex && s.semesterIndex === newSubj.semesterIndex));
            return { ...targetDb, subjects: [...filtered, newSubj] };
          } else if (update.type === 'update_subject' && update.data) {
            const upd = update.data;
            const updatedDistributions = upd.distributions
              ? upd.distributions.map((d: any) => ({
                  id: d.id || uuidv4(),
                  name: d.name,
                  maxMarks: Number(d.maxMarks || d.max_marks || 0),
                  achievedMarks: null,
                  status: 'current' as const
                }))
              : undefined;

            return {
              ...targetDb,
              subjects: targetDb.subjects.map(s => {
                const isMatch = s.id === upd.id || (upd.name && s.name === upd.name && s.yearIndex === upd.yearIndex && s.semesterIndex === upd.semesterIndex);
                if (!isMatch) return s;
                return {
                  ...s,
                  ...upd,
                  distributions: updatedDistributions !== undefined ? updatedDistributions : s.distributions
                };
              })
            };
          } else if (update.type === 'delete_subject' && update.data) {
            const upd = update.data;
            return {
              ...targetDb,
              subjects: targetDb.subjects.filter(s => s.id !== upd.id && s.name !== upd.name)
            };
          }
          return targetDb;
        });
      }
      await loadUniData();
    } catch (e) {
      console.error('Error resolving pending update:', e);
    }
  };

  // Grouped Bulk Resolution (Approve / Reject all in group)
  const handleResolveGroup = async (groupUpdates: UniversityPendingUpdate[], status: 'approved' | 'rejected') => {
    for (const u of groupUpdates) {
      if (u.status === 'pending') {
        await handleResolvePendingUpdate(u, status);
      }
    }
  };

  // Total Pending Updates Count
  const totalPendingUpdates = pendingUpdates.filter(p => p.status === 'pending').length;

  // Filtered Updates for the dedicated Updates Page
  const filteredUpdatesList = useMemo(() => {
    let list = pendingUpdates;
    if (updatesFilter !== 'all') {
      list = list.filter(u => u.status === updatesFilter);
    }
    return list;
  }, [pendingUpdates, updatesFilter]);

  // Current drive files in the active folder
  const currentDriveFiles = useMemo(() => {
    if (!selectedCollegeDb) return [];
    return (selectedCollegeDb.driveFiles || []).filter(f => f.parentId === currentDriveFolderId);
  }, [selectedCollegeDb, currentDriveFolderId]);

  // Current folder breadcrumbs
  const currentFolderObject = useMemo(() => {
    if (!selectedCollegeDb || !currentDriveFolderId) return null;
    return (selectedCollegeDb.driveFiles || []).find(f => f.id === currentDriveFolderId) || null;
  }, [selectedCollegeDb, currentDriveFolderId]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* ========================================================================= */}
      {/* DEDICATED DATABASE UPDATES PAGE (When subTab === 'updates') */}
      {/* ========================================================================= */}
      {subTab === 'updates' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
                <BellRing size={24} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                  {isAr ? 'تحديثات ومقترحات قواعد البيانات' : 'Database Updates & Approvals'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {isAr 
                    ? 'مراجعة واعتماد التعديلات المقترحة من الطلاب المصدر لكل جامعة وكلية لتحديث القوالب' 
                    : 'Review and approve proposed modifications from source students to update master templates'}
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60 flex-wrap">
              <button
                onClick={() => setUpdatesFilter('pending')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  updatesFilter === 'pending'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {isAr ? `معلقة (${totalPendingUpdates})` : `Pending (${totalPendingUpdates})`}
              </button>
              <button
                onClick={() => setUpdatesFilter('approved')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  updatesFilter === 'approved'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {isAr ? 'تمت الموافقة' : 'Approved'}
              </button>
              <button
                onClick={() => setUpdatesFilter('rejected')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  updatesFilter === 'rejected'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {isAr ? 'مرفوضة' : 'Rejected'}
              </button>
              <button
                onClick={() => setUpdatesFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  updatesFilter === 'all'
                    ? 'bg-zinc-800 dark:bg-zinc-700 text-white shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
            </div>
          </div>

          {/* Grouped Updates by Student & College */}
          <div className="space-y-4">
            {(() => {
              const groupsMap: Record<string, {
                key: string;
                studentId: string;
                studentName: string;
                studentEmail: string;
                collegeDb?: UniversityDatabase;
                collegeId: string;
                updates: UniversityPendingUpdate[];
              }> = {};

              filteredUpdatesList.forEach(update => {
                const key = `${update.sourceUserId}_${update.universityDatabaseId}`;
                if (!groupsMap[key]) {
                  const targetDb = databases.find(d => d.id === update.universityDatabaseId);
                  groupsMap[key] = {
                    key,
                    studentId: update.sourceUserId,
                    studentName: update.sourceUserName || (isAr ? 'طالب مسجل' : 'Registered Student'),
                    studentEmail: update.sourceUserEmail || '',
                    collegeDb: targetDb,
                    collegeId: update.universityDatabaseId,
                    updates: []
                  };
                }
                groupsMap[key].updates.push(update);
              });

              const groupedList = Object.values(groupsMap);

              return groupedList.map(group => {
                const pendingInGroup = group.updates.filter(u => u.status === 'pending');
                const isExpanded = expandedGroupKeys[group.key] !== false; // expanded by default

                return (
                  <div 
                    key={group.key} 
                    className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Group Header Card */}
                    <div className="p-5 sm:p-6 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {group.studentName ? group.studentName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base text-zinc-900 dark:text-white">{group.studentName}</h4>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                              {group.collegeDb ? `${group.collegeDb.universityNameAr} • ${group.collegeDb.collegeNameAr}` : group.collegeId}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                              {group.updates.length} {isAr ? 'تعديل' : 'updates'}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 font-medium">{group.studentEmail}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {pendingInGroup.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleResolveGroup(group.updates, 'approved')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                              title={isAr ? 'الموافقة على جميع تعديلات هذا الطالب' : 'Approve all updates for this student'}
                            >
                              <CheckCircle2 size={14} />
                              <span>{isAr ? `موافقة على الكل (${pendingInGroup.length})` : `Approve All (${pendingInGroup.length})`}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolveGroup(group.updates, 'rejected')}
                              className="px-3 py-2 text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title={isAr ? 'رفض جميع تعديلات هذا الطالب' : 'Reject all updates for this student'}
                            >
                              {isAr ? 'رفض الكل' : 'Reject All'}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setExpandedGroupKeys(prev => ({ ...prev, [group.key]: !isExpanded }))}
                          className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                          title={isExpanded ? (isAr ? 'طي' : 'Collapse') : (isAr ? 'عرض التفاصيل' : 'Expand')}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Group Items List (Oldest to Newest) */}
                    {isExpanded && (
                      <div className="p-4 sm:p-6 divide-y divide-zinc-100 dark:divide-zinc-800/80 space-y-3">
                        {group.updates.map((update, idx) => (
                          <div key={update.id} className="pt-3 first:pt-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-black">
                                  {idx + 1}
                                </span>
                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                                  update.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'
                                    : (update.status === 'approved'
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200')
                                }`}>
                                  {update.status === 'pending' ? (isAr ? 'قيد المراجعة' : 'Pending') : (update.status === 'approved' ? (isAr ? 'تمت الموافقة' : 'Approved') : (isAr ? 'مرفوض' : 'Rejected'))}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {new Date(update.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })} • {new Date(update.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                                </span>
                              </div>
                              <h5 className="font-bold text-sm text-zinc-900 dark:text-white">
                                {update.description || (isAr ? 'تعديل مقترح' : 'Proposed Update')}
                              </h5>
                              {update.data && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {update.data.yearIndex !== undefined && (
                                    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-black">
                                      📅 {isAr ? `سنة ${update.data.yearIndex}` : `Year ${update.data.yearIndex}`}
                                    </span>
                                  )}
                                  {update.data.semesterIndex !== undefined && (
                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                                      📖 {isAr ? `ترم ${update.data.semesterIndex}` : `Term ${update.data.semesterIndex}`}
                                    </span>
                                  )}
                                  {update.data.creditHours !== undefined && (
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                      ⏳ {update.data.creditHours} {isAr ? 'ساعات' : 'hrs'}
                                    </span>
                                  )}
                                  {update.data.totalMarks !== undefined && (
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                      💯 {update.data.totalMarks} {isAr ? 'درجة' : 'marks'}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {update.status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleResolvePendingUpdate(update, 'rejected')}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 transition-colors cursor-pointer"
                                  >
                                    {isAr ? 'رفض' : 'Reject'}
                                  </button>
                                  <button
                                    onClick={() => handleResolvePendingUpdate(update, 'approved')}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                                  >
                                    <Check size={13} />
                                    <span>{isAr ? 'موافقة' : 'Approve'}</span>
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleResolvePendingUpdate(update, 'pending')}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                                  title={isAr ? 'تراجع عن القرار' : 'Reverse Decision'}
                                >
                                  <RotateCcw size={12} />
                                  <span>{isAr ? 'تراجع' : 'Reverse'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              });
            })()}

            {filteredUpdatesList.length === 0 && (
              <div className="py-16 text-center text-zinc-400 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800 p-8 space-y-2">
                <CheckCircle2 size={48} className="mx-auto opacity-20 text-emerald-500" />
                <p className="font-extrabold text-sm text-zinc-700 dark:text-zinc-300">
                  {isAr ? 'لا توجد تحديثات في هذا القسم حالياً.' : 'No updates found in this section.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UNIVERSITIES & COLLEGES DIRECTORY (When subTab === 'universities') */}
      {/* ========================================================================= */}
      {subTab === 'universities' && (
        <>
          {/* LEVEL 1: UNIVERSITIES TABLE */}
          {!selectedUniversityKey && !selectedCollegeId && (
            <div className="space-y-6">
              
              {/* Header Card */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                      <Building2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                        {isAr ? 'دليل وقواعد بيانات الجامعات' : 'Universities Directory'}
                      </h2>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        {isAr 
                          ? 'إدارة الخطط الدراسية، السنين، الترمات، توزيع الدرجات والدرايف المستقل للجامعات' 
                          : 'Manage curriculum plans, grade distributions, and independent drive templates'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      setCreateUniForm({ nameAr: '', nameEn: '', sourceUserId: '' });
                      setUniStudentSearchQuery('');
                      setIsCreateUniModalOpen(true);
                    }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
                  >
                    <Plus size={18} />
                    <span>{isAr ? 'إضافة جامعة جديدة' : 'Add University'}</span>
                  </button>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder={isAr ? 'بحث سريع عن اسم جامعة، كلية، أو طالب مصدر...' : 'Search universities, colleges, or students...'}
                  className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>

              {/* Table Container Styled Like AcademicSubjects Table */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <Building2 size={18} className="text-indigo-600" />
                    <span>{isAr ? 'جدول الجامعات المسجلة' : 'Universities List'}</span>
                  </h3>
                  <span className="text-xs font-bold text-zinc-400">
                    {filteredUniversities.length} {isAr ? 'جامعة' : 'Universities'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left rtl:text-right whitespace-nowrap">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase text-[11px] font-black border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-4 px-6">{isAr ? 'اسم الجامعة' : 'University Name'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'عدد الكليات' : 'Colleges'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'الطلاب المسجلين' : 'Enrolled Students'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'إجمالي المواد' : 'Subjects'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'ملفات الدرايف' : 'Drive Files'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {filteredUniversities.map((group) => (
                        <tr key={group.key} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center font-bold shrink-0">
                                <Building2 size={20} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-sm text-zinc-900 dark:text-white">{group.nameAr}</p>
                                  {group.pendingUpdatesCount > 0 && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" title={isAr ? 'يوجد تحديثات معلقة' : 'Pending updates'} />
                                  )}
                                </div>
                                {group.nameEn && group.nameEn !== group.nameAr && (
                                  <p className="text-[11px] text-zinc-400 font-medium">{group.nameEn}</p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 text-center font-bold">
                            <span className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-black">
                              {group.colleges.length} {isAr ? 'كليات' : 'Colleges'}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center font-bold text-zinc-700 dark:text-zinc-300">
                            {group.totalStudents} {isAr ? 'طالب' : 'Students'}
                          </td>

                          <td className="py-4 px-6 text-center font-bold text-zinc-700 dark:text-zinc-300">
                            {group.totalSubjects} {isAr ? 'مادة' : 'Subjects'}
                          </td>

                          <td className="py-4 px-6 text-center font-bold text-zinc-700 dark:text-zinc-300">
                            {group.totalDriveFiles} {isAr ? 'ملف' : 'Files'}
                          </td>

                          <td className="py-4 px-6 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setSelectedUniversityKey(group.key)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                              >
                                <span>{isAr ? 'عرض الكليات' : 'View Colleges'}</span>
                                <ArrowIcon size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingUni({
                                    oldKey: group.key,
                                    nameAr: group.nameAr,
                                    nameEn: group.nameEn || group.nameAr
                                  });
                                  setIsEditUniModalOpen(true);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl transition-colors cursor-pointer border border-blue-200 dark:border-blue-800/60"
                                title={isAr ? 'تعديل اسم الجامعة' : 'Edit University'}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  setUniToDelete({
                                    key: group.key,
                                    nameAr: group.nameAr,
                                    nameEn: group.nameEn || group.nameAr,
                                    collegeCount: group.colleges.length
                                  });
                                }}
                                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/40"
                                title={isAr ? 'حذف الجامعة وكافة كلياتها' : 'Delete University'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredUniversities.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-zinc-400">
                            {isAr ? 'لا توجد جامعات مطابقة للبحث.' : 'No universities match the search.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 2: UNIVERSITY OVERVIEW & COLLEGES TABLE */}
          {selectedUniversityKey && !selectedCollegeId && currentUniversityGroup && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Breadcrumbs Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedUniversityKey(null)}
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    <BackIcon size={16} />
                    <span>{isAr ? 'العودة لقائمة الجامعات' : 'Back to Universities'}</span>
                  </button>

                  <span className="text-zinc-400">/</span>

                  <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                    {currentUniversityGroup.nameAr} ({currentUniversityGroup.nameEn})
                  </span>
                </div>

                <button
                  onClick={() => {
                    setCreateCollegeForm({
                      collegeNameAr: '',
                      collegeNameEn: '',
                      sourceUserId: '',
                      customYears: 4,
                      customSemesters: 2
                    });
                    setShowAllStudentsForCollege(false);
                    setCollegeStudentSearchQuery('');
                    setIsCreateCollegeModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-indigo-500/25 transition-all cursor-pointer shrink-0"
                >
                  <Plus size={16} />
                  <span>{isAr ? 'إضافة كلية للجامعة' : 'Add College to University'}</span>
                </button>
              </div>

              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-xs font-bold text-zinc-400 block">{isAr ? 'إجمالي الكليات' : 'Colleges'}</span>
                  <span className="text-2xl font-black text-zinc-900 dark:text-white mt-1 block">{currentUniversityGroup.colleges.length}</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-xs font-bold text-zinc-400 block">{isAr ? 'الطلاب المسجلين' : 'Students'}</span>
                  <span className="text-2xl font-black text-zinc-900 dark:text-white mt-1 block">{currentUniversityGroup.totalStudents}</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-xs font-bold text-zinc-400 block">{isAr ? 'إجمالي المواد' : 'Subjects'}</span>
                  <span className="text-2xl font-black text-zinc-900 dark:text-white mt-1 block">{currentUniversityGroup.totalSubjects}</span>
                </div>
                <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                  <span className="text-xs font-bold text-zinc-400 block">{isAr ? 'ملفات الدرايف' : 'Drive Files'}</span>
                  <span className="text-2xl font-black text-zinc-900 dark:text-white mt-1 block">{currentUniversityGroup.totalDriveFiles}</span>
                </div>
              </div>

              {/* Colleges Table (Separating Years and Semesters columns cleanly) */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <GraduationCap size={18} className="text-blue-600" />
                    <span>{isAr ? `كليات ${currentUniversityGroup.nameAr}` : `Colleges of ${currentUniversityGroup.nameEn}`}</span>
                  </h3>
                  <span className="text-xs font-bold text-zinc-400">
                    {currentUniversityGroup.colleges.length} {isAr ? 'كلية' : 'Colleges'}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left rtl:text-right whitespace-nowrap">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase text-[11px] font-black border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-4 px-6">{isAr ? 'اسم الكلية' : 'College Name'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'السنوات الدراسية' : 'Study Years'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'فصول السنة (الترمات)' : 'Semesters/Year'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'المواد المسجلة' : 'Subjects'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'ملفات الدرايف' : 'Drive Files'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'الطالب المصدر' : 'Source Student'}</th>
                        <th className="py-4 px-6 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                      {currentUniversityGroup.colleges.map((collegeDb) => {
                        const colUpdates = pendingUpdates.filter(p => p.universityDatabaseId === collegeDb.id && p.status === 'pending').length;

                        return (
                          <tr key={collegeDb.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold shrink-0">
                                  <GraduationCap size={18} />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-sm text-zinc-900 dark:text-white">{collegeDb.collegeNameAr}</p>
                                    {colUpdates > 0 && (
                                      <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                                        {colUpdates} {isAr ? 'تحديث' : 'updates'}
                                      </span>
                                    )}
                                  </div>
                                  {collegeDb.collegeNameEn && collegeDb.collegeNameEn !== collegeDb.collegeNameAr && (
                                    <p className="text-[11px] text-zinc-400 font-medium">{collegeDb.collegeNameEn}</p>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-6 text-center font-bold">
                              <span className="px-3 py-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs">
                                {collegeDb.totalYears || 4} {isAr ? 'سنوات' : 'Years'}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-center font-bold">
                              <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs">
                                {collegeDb.semestersPerYear || 2} {isAr ? 'ترم / سنة' : 'Semesters/Yr'}
                              </span>
                            </td>

                            <td className="py-4 px-6 text-center font-bold text-zinc-700 dark:text-zinc-300">
                              {collegeDb.subjects?.length || 0} {isAr ? 'مادة' : 'Subjects'}
                            </td>

                            <td className="py-4 px-6 text-center font-bold text-zinc-700 dark:text-zinc-300">
                              {collegeDb.driveFiles?.length || 0} {isAr ? 'ملف' : 'Files'}
                            </td>

                            <td className="py-4 px-6 text-center text-xs text-zinc-500">
                              <span className="font-bold block text-zinc-800 dark:text-zinc-200">{collegeDb.sourceUserName || 'طالب مسجل'}</span>
                              <span className="text-[10px] text-zinc-400">{collegeDb.sourceUserEmail}</span>
                            </td>

                            <td className="py-4 px-6 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedCollegeId(collegeDb.id);
                                    setSelectedYearIndex(1);
                                    setSelectedSemesterIndex(1);
                                    setActiveStudioTab('subjects');
                                  }}
                                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>{isAr ? 'إدارة الكلية' : 'Manage'}</span>
                                  <ArrowIcon size={13} />
                                </button>
                                <button
                                  onClick={() => setDbToDelete(collegeDb)}
                                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded-xl transition-colors cursor-pointer"
                                  title={isAr ? 'حذف هذه الكلية' : 'Delete College'}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {currentUniversityGroup.colleges.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-zinc-400">
                            <GraduationCap size={44} className="mx-auto opacity-20 mb-2 text-blue-500" />
                            <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                              {isAr ? 'لا توجد كليات مسجلة لهذه الجامعة حالياً.' : 'No colleges registered for this university currently.'}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setCreateCollegeForm({
                                  collegeNameAr: '',
                                  collegeNameEn: '',
                                  sourceUserId: '',
                                  customYears: 4,
                                  customSemesters: 2
                                });
                                setShowAllStudentsForCollege(false);
                                setCollegeStudentSearchQuery('');
                                setIsCreateCollegeModalOpen(true);
                              }}
                              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                            >
                              <Plus size={15} />
                              <span>{isAr ? 'إضافة أول كلية للجامعة الآن' : 'Add First College Now'}</span>
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* LEVEL 3: COLLEGE ACADEMIC STUDIO */}
          {selectedCollegeDb && (
            <div className="space-y-6 animate-in fade-in">
              
              {/* Breadcrumb Header Bar */}
              <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedCollegeId(null)}
                    className="p-2.5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 transition-colors cursor-pointer"
                    title={isAr ? 'العودة لكليات الجامعة' : 'Back'}
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
                  <button
                    onClick={() => {
                      setStructureForm({
                        totalYears: selectedCollegeDb.totalYears || 4,
                        semestersPerYear: selectedCollegeDb.semestersPerYear || 2
                      });
                      setIsStructureModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Sliders size={14} />
                    <span>{selectedCollegeDb.totalYears || 4} {isAr ? 'سنوات' : 'Yrs'} • {selectedCollegeDb.semestersPerYear || 2} {isAr ? 'فصول/سنة' : 'Sem/Yr'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSourceSearchQuery('');
                      setIsSourceModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <UserCheck size={14} />
                    <span>{isAr ? 'تغيير الطالب المصدر' : 'Switch Source'}</span>
                  </button>
                </div>
              </div>

              {/* Source Student Notice Banner */}
              <div className="bg-blue-50/60 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-200/80 dark:border-blue-800/40 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                  <UserCheck size={18} className="text-blue-600 shrink-0" />
                  <span>
                    {isAr ? 'الطالب المصدر المعتمد لقالب هذه الكلية:' : 'Source Student:'} <strong>{selectedCollegeDb.sourceUserName || 'طالب مسجل'}</strong> ({selectedCollegeDb.sourceUserEmail})
                  </span>
                </div>
              </div>

              {/* Studio Tabs */}
              <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2 overflow-x-auto">
                <button
                  onClick={() => setActiveStudioTab('subjects')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                    activeStudioTab === 'subjects'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <BookOpen size={16} />
                  <span>{isAr ? 'المواد وتوزيع الدرجات' : 'Subjects & Grades'}</span>
                </button>

                <button
                  onClick={() => setActiveStudioTab('drive')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                    activeStudioTab === 'drive'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <HardDrive size={16} />
                  <span>{isAr ? 'ملفات ومجلدات الدرايف' : 'Drive Files'}</span>
                </button>

                <button
                  onClick={() => setActiveStudioTab('grading')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                    activeStudioTab === 'grading'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Award size={16} />
                  <span>{isAr ? 'جدول التقديرات' : 'Grading Scale'}</span>
                </button>

                <button
                  onClick={() => setActiveStudioTab('students')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                    activeStudioTab === 'students'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
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
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                            }`}
                          >
                            {isAr ? `الترم ${sem}` : `Semester ${sem}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Subjects List in Active (Year, Semester) */}
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

              {/* STUDIO TAB 2: FULL DRIVE FILE MANAGER WITH REAL PREVIEW & DOWNLOAD */}
              {activeStudioTab === 'drive' && (
                <div className="space-y-4">
                  {/* Drive Actions & Breadcrumbs */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentDriveFolderId(null)}
                        className={`text-xs font-bold hover:underline cursor-pointer ${
                          !currentDriveFolderId ? 'text-indigo-600 font-black' : 'text-zinc-500'
                        }`}
                      >
                        {isAr ? 'الدرايف الرئيسي' : 'Root Drive'}
                      </button>

                      {currentFolderObject && (
                        <>
                          <span className="text-zinc-400">/</span>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                            {currentFolderObject.name}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDriveForm({ name: '', type: 'folder', url: '', parentId: currentDriveFolderId });
                          setIsDriveModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <FolderPlus size={15} />
                        <span>{isAr ? 'مجلد جديد' : 'New Folder'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setDriveForm({ name: '', type: 'file', url: '', parentId: currentDriveFolderId });
                          setIsDriveModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <Plus size={15} />
                        <span>{isAr ? 'إضافة ملف مرجعي' : 'Add File'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Drive Files List (Styled matching Student Drive) */}
                  <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    {currentDriveFiles.length === 0 ? (
                      <div className="py-16 text-center text-zinc-400 flex flex-col items-center">
                        <Folder size={48} className="mb-2 opacity-25 text-zinc-500" />
                        <p className="font-bold text-sm text-zinc-500">{isAr ? 'هذا المجلد فارغ حالياً' : 'Folder is empty'}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{isAr ? 'يمكنك إضافة ملفات أو مجلدات فرعية.' : 'Add files or subfolders.'}</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {currentDriveFiles.map(file => (
                          <li 
                            key={file.id} 
                            className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            onClick={() => handlePreviewDriveFile(file)}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`p-3 rounded-2xl ${
                                file.type === 'folder' 
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40' 
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60'
                              }`}>
                                {file.type === 'folder' ? <Folder size={22} /> : <FileText size={22} />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                  {file.name}
                                </p>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                  {file.type === 'folder' ? (isAr ? 'مجلد درايف' : 'Folder') : `${formatSize(file.size)} • ${file.createdAt}`}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {/* Move Button */}
                              <button
                                onClick={() => {
                                  setMovingFile(file);
                                  setTargetMoveFolderId(null);
                                }}
                                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-700/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                                title={isAr ? 'نقل إلى مجلد' : 'Move'}
                              >
                                <Move size={15} />
                              </button>

                              {/* Preview in Browser */}
                              {file.type === 'file' && (
                                <button
                                  onClick={() => handlePreviewDriveFile(file)}
                                  className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                                  title={isAr ? 'معاينة في المتصفح' : 'Preview'}
                                >
                                  <Eye size={15} />
                                </button>
                              )}

                              {/* Download Button */}
                              {file.type === 'file' && (
                                <button
                                  onClick={(e) => handleDownloadDriveFile(e, file)}
                                  disabled={downloadingFileId === file.id}
                                  className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-all rounded-xl shadow-2xs cursor-pointer"
                                  title={isAr ? 'تنزيل الملف' : 'Download'}
                                >
                                  {downloadingFileId === file.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                </button>
                              )}

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteDriveItem(file.id)}
                                className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* STUDIO TAB 3: ENROLLED STUDENTS */}
              {activeStudioTab === 'students' && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
                  <h4 className="font-black text-sm text-zinc-900 dark:text-white">
                    {isAr ? 'الطلاب المسجلون تحت هذه الكلية والجامعة:' : 'Enrolled Students:'}
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

              {/* STUDIO TAB: COLLEGE GRADING SCALE */}
              {activeStudioTab === 'grading' && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <div>
                      <h4 className="font-black text-base text-zinc-900 dark:text-white flex items-center gap-2">
                        <Award size={18} className="text-blue-600" />
                        <span>{isAr ? `جدول تقديرات ${selectedCollegeDb.collegeNameAr}` : `Grading Scale for ${selectedCollegeDb.collegeNameEn}`}</span>
                      </h4>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {isAr 
                          ? 'هذا الجدول مسحوب ومطابق لحساب الطالب المصدر. يمكنك التعديل عليه لإضافة أو حذف أو تعديل أي تقدير، ويتم اعتماده لكافة الطلاب.' 
                          : 'This grading scale is synced with source student. You can edit, add, or delete grade rules.'}
                      </p>
                    </div>

                    <button
                      onClick={handleOpenAddGrade}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <Plus size={14} />
                      <span>{isAr ? 'إضافة تقدير جديد' : 'Add Grade Rule'}</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm text-left rtl:text-right whitespace-nowrap">
                      <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500 uppercase text-[11px] font-black border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="py-3 px-4">{isAr ? 'الرمز' : 'Letter'}</th>
                          <th className="py-3 px-4">{isAr ? 'الاسم بالعربي' : 'Name (AR)'}</th>
                          <th className="py-3 px-4">{isAr ? 'الاسم بالإنجليزي' : 'Name (EN)'}</th>
                          <th className="py-3 px-4 text-center">{isAr ? 'النسبة الدنيا (%)' : 'Min (%)'}</th>
                          <th className="py-3 px-4 text-center">{isAr ? 'الحد الأقصى والنوع' : 'Upper Bound & Operator'}</th>
                          <th className="py-3 px-4 text-center">{isAr ? 'نقاط المعدل (GPA)' : 'GPA Points'}</th>
                          <th className="py-3 px-4 text-center">{isAr ? 'الإجراءات' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {(selectedCollegeDb.gradingScale || []).map((grade) => {
                          const isInclusive = grade.maxOperator ? grade.maxOperator === '<=' : grade.maxPercentage >= 100;
                          return (
                            <tr key={grade.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                              <td className="py-3 px-4 font-black text-zinc-900 dark:text-white">{grade.letter}</td>
                              <td className="py-3 px-4 font-bold text-zinc-800 dark:text-zinc-200">{grade.nameAr}</td>
                              <td className="py-3 px-4 text-zinc-500">{grade.nameEn}</td>
                              <td className="py-3 px-4 text-center font-bold text-zinc-700 dark:text-zinc-300">{grade.minPercentage}%</td>
                              <td className="py-3 px-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold ${
                                  isInclusive 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' 
                                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                }`}>
                                  <span>{isInclusive ? 'إلى (≤)' : 'إلى أقل من (<)'}</span>
                                  <span className="font-black">{grade.maxPercentage}%</span>
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-black text-blue-600 dark:text-blue-400">
                                {grade.points !== undefined ? Number(grade.points).toFixed(2) : '-'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleOpenEditGrade(grade)}
                                    className="p-1.5 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 rounded-xl transition-all cursor-pointer"
                                    title={isAr ? 'تعديل' : 'Edit'}
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteGrade(grade.id)}
                                    className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 rounded-xl transition-all cursor-pointer"
                                    title={isAr ? 'حذف' : 'Delete'}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {(!selectedCollegeDb.gradingScale || selectedCollegeDb.gradingScale.length === 0) && (
                          <tr>
                            <td colSpan={7} className="py-12 text-center text-zinc-400">
                              <p className="font-bold text-xs">{isAr ? 'لا يوجد جدول تقديرات مخصص لهذه الكلية حتى الآن.' : 'No custom grading scale for this college yet.'}</p>
                              <button
                                onClick={handleOpenAddGrade}
                                className="mt-2 px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Plus size={13} />
                                <span>{isAr ? 'إضافة تقدير الآن' : 'Add Grade Now'}</span>
                              </button>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* --- MODAL 1: CREATE UNIVERSITY ONLY --- */}
      {isCreateUniModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="p-6 sm:p-7 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                    {isAr ? 'إضافة وتسجيل جامعة جديدة' : 'Add & Register University'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAr ? 'اختر طالباً لسحب اسم الجامعة تلقائياً أو أدخل اسم الجامعة مباشرة' : 'Pick a student to auto-pull university name or type it manually'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateUniModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* Option A: Quick pick from student */}
              <div className="space-y-3">
                <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                  {isAr ? '1. اختيار سريع من الطلاب المسجلين (اختياري لسحب اسم الجامعة):' : '1. Quick pick from registered students (optional):'}
                </label>

                <div className="relative">
                  <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    value={uniStudentSearchQuery}
                    onChange={(e) => setUniStudentSearchQuery(e.target.value)}
                    placeholder={isAr ? 'ابحث عن طالب أو جامعة...' : 'Search student or university...'}
                    className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="max-h-[220px] overflow-y-auto p-1 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredStudentsForCreateUni.map(st => {
                      const isSelected = createUniForm.sourceUserId === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudentForUni(st)}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 shadow-2xs'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-xs text-zinc-900 dark:text-white truncate">
                              {st.name}
                            </h4>
                            <p className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
                              🏛️ {st.university && st.university !== 'غير محدد' ? st.university : (isAr ? 'غير محدد' : 'Not specified')}
                            </p>
                          </div>
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all shrink-0 ${
                              isSelected
                                ? 'bg-indigo-600 text-white'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                          >
                            {isSelected ? (isAr ? 'محدد ✓' : 'Selected ✓') : (isAr ? 'سحب الجامعة' : 'Select')}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Option B: University Names */}
              <div className="space-y-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                  {isAr ? '2. اسم الجامعة المطلوب تسجيلها:' : '2. University Name to Register:'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الجامعة (عربي) *' : 'University Name (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={createUniForm.nameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateUniForm(prev => ({
                          ...prev,
                          nameAr: val,
                          nameEn: autoTranslateUniversity(val) || prev.nameEn
                        }));
                      }}
                      placeholder={isAr ? 'مثال: جامعة بنها' : 'e.g. Benha University'}
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الجامعة (English - تلقائي)' : 'University Name (English - Auto)'}
                    </label>
                    <input
                      type="text"
                      value={createUniForm.nameEn}
                      onChange={(e) => setCreateUniForm(prev => ({ ...prev, nameEn: e.target.value }))}
                      placeholder="e.g. Benha University"
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

            </div>

            <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateUniModalOpen(false)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCreateUniversity}
                disabled={creatingUni || (!createUniForm.nameAr.trim() && !createUniForm.nameEn.trim())}
                className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-indigo-500/25 transition-all cursor-pointer"
              >
                {creatingUni ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
                <span>{isAr ? 'تسجيل وإنشاء الجامعة' : 'Register & Create University'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL 2: CREATE COLLEGE IN SELECTED UNIVERSITY --- */}
      {isCreateCollegeModalOpen && currentUniversityGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-2xl max-h-[92vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="p-6 sm:p-7 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                    {isAr ? `إضافة كلية لـ ${currentUniversityGroup.nameAr}` : `Add College to ${currentUniversityGroup.nameEn}`}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAr ? 'سحب الخطة والمواد والدرايف ولائحة التقديرات من طالب وربطها بهذه الجامعة' : 'Clone curriculum, drive & grading scale from student to this university'}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsCreateCollegeModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              
              {/* Step 1: Select Source Student with Filter & University Matcher */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                    {isAr ? '1. اختر الطالب المصدر لسحب الكلية منه *' : '1. Select Source Student *'}
                  </label>

                  {/* Toggle: Show all students or only this university */}
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl">
                    <input
                      type="checkbox"
                      checked={showAllStudentsForCollege}
                      onChange={(e) => setShowAllStudentsForCollege(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>{isAr ? 'إظهار جميع الطلاب من كافة الجامعات' : 'Show all students from all universities'}</span>
                  </label>
                </div>

                {!showAllStudentsForCollege && (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-2xl flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-300">
                    <span>🏛️ {isAr ? `يتم الآن عرض طلاب (${currentUniversityGroup.nameAr}) فقط` : `Showing only students of (${currentUniversityGroup.nameEn})`}</span>
                    <span className="px-2 py-0.5 bg-blue-600 text-white rounded-lg text-[11px]">
                      {filteredStudentsForCreateCollege.length} {isAr ? 'طالب' : 'students'}
                    </span>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                  <input
                    type="text"
                    value={collegeStudentSearchQuery}
                    onChange={(e) => setCollegeStudentSearchQuery(e.target.value)}
                    placeholder={isAr ? 'ابحث بالاسم، الكلية، أو البريد...' : 'Search student by name, college, email...'}
                    className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="max-h-[260px] overflow-y-auto p-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredStudentsForCreateCollege.map(st => {
                      const isSelected = createCollegeForm.sourceUserId === st.id;
                      const subjsCount = st.subjects?.length || st.subjectsCount || 0;
                      const filesCount = st.files?.length || st.filesCount || 0;

                      return (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudentForCollege(st)}
                          className={`p-3.5 sm:p-4 rounded-3xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800/60 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                              {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <h4 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                                  {st.name}
                                </h4>
                                {isSelected && (
                                  <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white">
                                    {isAr ? 'تم الاختيار' : 'Selected'}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {st.email}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                  🎓 {st.college && st.college !== 'غير محدد' ? st.college : (isAr ? 'غير محدد' : 'No col')}
                                </span>
                                {showAllStudentsForCollege && (
                                  <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                    🏛️ {st.university || ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold">
                              <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                                {subjsCount} {isAr ? 'مادة' : 'subjs'}
                              </span>
                              <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                {filesCount} {isAr ? 'ملف' : 'files'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all ${
                                isSelected
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
                              }`}
                            >
                              {isSelected ? (isAr ? 'محدد ✓' : 'Selected ✓') : (isAr ? 'اختيار' : 'Select')}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredStudentsForCreateCollege.length === 0 && (
                      <div className="col-span-full py-8 text-center text-zinc-400">
                        <p className="text-xs font-bold">
                          {isAr ? 'لا يوجد طلاب مطابقين في هذه الجامعة حالياً.' : 'No matching students in this university.'}
                        </p>
                        {!showAllStudentsForCollege && (
                          <button
                            type="button"
                            onClick={() => setShowAllStudentsForCollege(true)}
                            className="mt-2 text-xs text-blue-600 font-bold underline cursor-pointer"
                          >
                            {isAr ? 'اضغط هنا للبحث في جميع طلاب الجامعات الأخرى' : 'Click here to search all students across all universities'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2: College Names with Real-time Auto Translation */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                  {isAr ? '2. اسم الكلية (عربي وإنجليزي)' : '2. College Name (Arabic & English)'}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'اسم الكلية (عربي) *' : 'College (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      value={createCollegeForm.collegeNameAr}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCreateCollegeForm(prev => ({
                          ...prev,
                          collegeNameAr: val,
                          collegeNameEn: autoTranslateCollege(val) || prev.collegeNameEn
                        }));
                      }}
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
                      value={createCollegeForm.collegeNameEn}
                      onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, collegeNameEn: e.target.value }))}
                      placeholder="e.g. Faculty of Computers and AI"
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Total Study Years & Semesters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                    {isAr ? 'عدد السنوات الدراسية للكلية' : 'Total Study Years'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={createCollegeForm.customYears}
                    onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, customYears: Number(e.target.value) }))}
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
                    value={createCollegeForm.customSemesters}
                    onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, customSemesters: Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

            </div>

            <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <button
                type="button"
                onClick={() => setIsCreateCollegeModalOpen(false)}
                className="px-5 py-2.5 text-xs sm:text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleCreateCollege}
                disabled={creatingCollege || (!createCollegeForm.collegeNameAr.trim() && !createCollegeForm.collegeNameEn.trim()) || !createCollegeForm.sourceUserId}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                {creatingCollege ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isAr ? 'سحب وإنشاء الكلية للجامعة' : 'Clone & Create College'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- EDIT COLLEGE ACADEMIC STRUCTURE MODAL --- */}
      {isStructureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              {isAr ? 'تعديل الهيكل الأكاديمي (السنوات والفصول)' : 'Edit Academic Structure'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'عدد السنوات الدراسية للكلية' : 'Total Study Years'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={structureForm.totalYears}
                  onChange={(e) => setStructureForm({ ...structureForm, totalYears: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  {isAr ? 'عدد الفصول (الترمات) في كل سنة' : 'Semesters Per Year'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={structureForm.semestersPerYear}
                  onChange={(e) => setStructureForm({ ...structureForm, semestersPerYear: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsStructureModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveStructure}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SWITCH SOURCE STUDENT MODAL (Rich Card Grid Layout) --- */}
      {isSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-4xl max-h-[88vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-zinc-900 dark:text-white">
                    {isAr ? 'تغيير الطالب المصدر المعتمد لقالب الكلية' : 'Switch Source Student'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAr 
                      ? `اختر طالباً ليكون هو المرجع المعتمد لكلية ${selectedCollegeDb?.collegeNameAr || ''}` 
                      : `Select a student to become the reference template for ${selectedCollegeDb?.collegeNameEn || ''}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsSourceModalOpen(false)} className="p-2 text-zinc-400 hover:text-zinc-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 sm:p-5 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 rtl:left-auto rtl:right-4 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                <input
                  type="text"
                  value={sourceSearchQuery}
                  onChange={(e) => setSourceSearchQuery(e.target.value)}
                  placeholder={isAr ? 'ابحث باسم الطالب، البريد الإلكتروني، الجامعة، أو الكلية...' : 'Search student by name, email, university, or college...'}
                  className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Rich Student Cards Grid */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredStudentsForSource.map(st => {
                  const isSelected = selectedCollegeDb?.sourceUserId === st.id;
                  const subjsCount = st.subjects?.length || st.subjectsCount || 0;
                  const filesCount = st.files?.length || st.filesCount || 0;

                  return (
                    <div
                      key={st.id}
                      className={`p-4 sm:p-5 rounded-3xl border transition-all flex flex-col justify-between gap-4 ${
                        isSelected
                          ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 dark:hover:border-blue-800/60 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {st.name ? st.name.charAt(0).toUpperCase() : 'S'}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white truncate">
                              {st.name}
                            </h4>
                            {isSelected && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white">
                                {isAr ? 'المصدر الحالي' : 'Current'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5 font-medium">
                            {st.email}
                          </p>

                          <div className="flex flex-wrap gap-1.5 mt-2">
                            <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-bold">
                              🏛️ {st.university && st.university !== 'غير محدد' ? st.university : (isAr ? 'غير محدد' : 'No uni')}
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-bold">
                              🎓 {st.college && st.college !== 'غير محدد' ? st.college : (isAr ? 'غير محدد' : 'No col')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                          <span className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                            📚 {subjsCount} {isAr ? 'مواد' : 'subjs'}
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold">
                            📁 {filesCount} {isAr ? 'ملفات' : 'files'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSwitchSourceStudent(st)}
                          className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-blue-500/20'
                              : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-blue-600 dark:hover:bg-blue-600 dark:hover:text-white'
                          }`}
                        >
                          {isSelected ? <Check size={14} /> : <UserCheck size={14} />}
                          <span>{isSelected ? (isAr ? 'المصدر الحالي للقالب' : 'Current Source') : (isAr ? 'تعيين كطالب مصدر' : 'Set as Source')}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredStudentsForSource.length === 0 && (
                <div className="py-12 text-center text-zinc-400">
                  {isAr ? 'لم يتم العثور على أي طلاب مطابقين للبحث.' : 'No students match your search.'}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="notifySourceCheck"
                  checked={notifySourceStudent}
                  onChange={(e) => setNotifySourceStudent(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="notifySourceCheck" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  {isAr ? 'إرسال إشعار فوري وتنبيه داخل الموقع للطالب المختار' : 'Send in-app notification to student'}
                </label>
              </div>

              <button
                type="button"
                onClick={() => setIsSourceModalOpen(false)}
                className="px-5 py-2 text-xs sm:text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer self-end sm:self-auto"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- ADD / EDIT SUBJECT MODAL --- */}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'كود المادة (تكتبه بنفسك)' : 'Subject Code'}
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

      {/* --- MOVE DRIVE ITEM MODAL --- */}
      {movingFile && selectedCollegeDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white">
              {isAr ? `نقل "${movingFile.name}" إلى:` : `Move "${movingFile.name}" to:`}
            </h3>

            <div className="space-y-2 max-h-[220px] overflow-y-auto">
              <button
                type="button"
                onClick={() => setTargetMoveFolderId(null)}
                className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                  targetMoveFolderId === null
                    ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                <HardDrive size={16} />
                <span>{isAr ? 'الدرايف الرئيسي (بدون مجلد)' : 'Root Directory'}</span>
              </button>

              {selectedCollegeDb.driveFiles?.filter(f => f.type === 'folder' && f.id !== movingFile.id).map(folder => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setTargetMoveFolderId(folder.id)}
                  className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${
                    targetMoveFolderId === folder.id
                      ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  <Folder size={16} className="text-amber-500" />
                  <span>{folder.name}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setMovingFile(null)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmMoveFile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'نقل العنصر' : 'Move Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE COLLEGE MODAL --- */}
      {dbToDelete && (
        <ConfirmModal
          isOpen={true}
          title={isAr ? 'حذف قاعدة بيانات الكلية' : 'Delete College Database'}
          message={isAr 
            ? `هل أنت متأكد من حذف قاعدة بيانات "${dbToDelete.universityNameAr} - ${dbToDelete.collegeNameAr}" من القوالب؟ (لن يؤثر ذلك على حسابات الطلاب)` 
            : `Delete "${dbToDelete.collegeNameAr}" template?`}
          onConfirm={handleDeleteDatabase}
          onCancel={() => setDbToDelete(null)}
          variant="danger"
          confirmText={isAr ? 'نعم، حذف' : 'Yes, Delete'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      )}

      {/* --- EDIT UNIVERSITY MODAL --- */}
      {isEditUniModalOpen && editingUni && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <Edit2 size={16} className="text-blue-600" />
              <span>{isAr ? 'تعديل اسم الجامعة' : 'Edit University Name'}</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isAr ? 'اسم الجامعة (عربي)' : 'University Name (Arabic)'} *
                </label>
                <input
                  type="text"
                  value={editingUni.nameAr}
                  onChange={(e) => setEditingUni({ ...editingUni, nameAr: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isAr ? 'اسم الجامعة (English)' : 'University Name (English)'}
                </label>
                <input
                  type="text"
                  value={editingUni.nameEn}
                  onChange={(e) => setEditingUni({ ...editingUni, nameEn: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsEditUniModalOpen(false);
                  setEditingUni(null);
                }}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveEditUni}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'حفظ التعديل' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE UNIVERSITY MODAL --- */}
      {uniToDelete && (
        <ConfirmModal
          isOpen={!!uniToDelete}
          title={isAr ? 'تأكيد حذف الجامعة وكافة كلياتها' : 'Delete University & Colleges'}
          message={isAr 
            ? `هل أنت متأكد تماماً من حذف جامعة "${uniToDelete.nameAr}" وجميع كلياتها (${uniToDelete.collegeCount} كلية) وقواعد بياناتها نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.`
            : `Are you sure you want to permanently delete "${uniToDelete.nameEn}" and all its (${uniToDelete.collegeCount}) colleges? This action cannot be undone.`
          }
          confirmText={isAr ? 'نعم، احذف الجامعة وكلياتها' : 'Yes, Delete University'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
          variant="danger"
          onConfirm={handleConfirmDeleteUni}
          onCancel={() => setUniToDelete(null)}
        />
      )}

      {/* --- ADD / EDIT GRADE RULE MODAL --- */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <h3 className="font-black text-base text-zinc-900 dark:text-white flex items-center gap-2">
              <Award size={18} className="text-blue-600" />
              <span>{editingGrade ? (isAr ? 'تعديل قاعدة التقدير' : 'Edit Grade Rule') : (isAr ? 'إضافة تقدير جديد للكلية' : 'Add New Grade Rule')}</span>
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'الرمز (مثل A+)' : 'Letter'} *
                  </label>
                  <input
                    type="text"
                    value={gradeForm.letter}
                    onChange={(e) => setGradeForm({ ...gradeForm, letter: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'الاسم (عربي)' : 'Name (AR)'}
                  </label>
                  <input
                    type="text"
                    value={gradeForm.nameAr}
                    onChange={(e) => setGradeForm({ ...gradeForm, nameAr: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'الاسم (EN)' : 'Name (EN)'}
                  </label>
                  <input
                    type="text"
                    value={gradeForm.nameEn}
                    onChange={(e) => setGradeForm({ ...gradeForm, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'النسبة الدنيا (%)' : 'Min Percentage (%)'}
                  </label>
                  <input
                    type="number"
                    value={gradeForm.minPercentage}
                    onChange={(e) => setGradeForm({ ...gradeForm, minPercentage: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    {isAr ? 'نقاط المعدل (GPA)' : 'GPA Points'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={gradeForm.points}
                    onChange={(e) => setGradeForm({ ...gradeForm, points: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isAr ? 'نوع الحد الأقصى والنسبة القصوى' : 'Upper Bound Operator & Max %'}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    value={gradeForm.maxOperator || (gradeForm.maxPercentage >= 100 ? '<=' : '<')}
                    onChange={(e) => setGradeForm({ ...gradeForm, maxOperator: e.target.value as '<' | '<=' })}
                    className="w-1/2 text-xs px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 font-bold text-blue-600 dark:text-blue-400 outline-none"
                  >
                    <option value="<=">{isAr ? 'إلى (≤) شامل' : 'To (<=) Inclusive'}</option>
                    <option value="<">{isAr ? 'إلى أقل من (<)' : 'To less than (<)'}</option>
                  </select>
                  <input
                    type="number"
                    value={gradeForm.maxPercentage}
                    onChange={(e) => setGradeForm({ ...gradeForm, maxPercentage: Number(e.target.value) })}
                    className="w-1/2 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsGradeModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-zinc-500"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveGradeForm}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'حفظ التقدير' : 'Save Grade'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
