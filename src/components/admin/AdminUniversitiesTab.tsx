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
  User,
  Compass,
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
  Save,
  EyeOff,
  Pencil
} from 'lucide-react';
import { db, broadcastUniversityDatabaseUpdate } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { UniversityDatabase, UniversityPendingUpdate, Subject, DriveFile, GradeDistributionItem, GradeRule } from '../../types';
import { ConfirmModal } from '../ui/CustomModal';
import { autoTranslateUniversity, autoTranslateCollege, normalizeSubjectName } from '../../lib/academicTranslation';
import { previewFile, downloadFile, uploadFile } from '../../lib/backblaze';

interface AdminUniversitiesTabProps {
  studentsList: any[];
  onRefreshAllData: () => Promise<void>;
  subTab?: 'universities' | 'updates';
  onSubTabChange?: (tab: 'universities' | 'updates') => void;
  onPendingCountChange?: (count: number) => void;
}

export function AdminUniversitiesTab({
  studentsList,
  onRefreshAllData,
  subTab = 'universities',
  onSubTabChange,
  onPendingCountChange
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
  const [savingEditUni, setSavingEditUni] = useState(false);
  const [deletingUni, setDeletingUni] = useState(false);

  // College Grading Scale State
  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<GradeRule | null>(null);
  const [gradeForm, setGradeForm] = useState<GradeRule | any>({
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

  // College Specializations
  const collegeSpecializations = useMemo(() => {
    if (!selectedCollegeDb) return [];
    return databases.filter(d => d.isSpecialization && d.parentDatabaseId === selectedCollegeDb.id);
  }, [databases, selectedCollegeDb]);

  // Dynamically slice visible years: Foundation only for College, Spec years only for Specialization
  const visibleYearsForSelectedCollege = useMemo(() => {
    if (!selectedCollegeDb) return [1];
    const totalYears = Number(selectedCollegeDb.totalYears || 4);
    const specStartYr = Number(selectedCollegeDb.specializationStartYear || 2);
    const specStartSem = Number(selectedCollegeDb.specializationStartSemester || 1);

    if (selectedCollegeDb.isSpecialization) {
      // Specialization: from specStartYr to totalYears
      const years: number[] = [];
      for (let y = Math.max(1, specStartYr); y <= totalYears; y++) {
        years.push(y);
      }
      return years.length > 0 ? years : [specStartYr];
    } else {
      // General College (Foundation): from Year 1 up to maxFoundationYear
      const maxFoundationYear = Math.max(1, specStartSem === 1 ? specStartYr - 1 : specStartYr);
      const limit = Math.min(totalYears, maxFoundationYear);
      const years: number[] = [];
      for (let y = 1; y <= limit; y++) {
        years.push(y);
      }
      return years.length > 0 ? years : [1];
    }
  }, [selectedCollegeDb]);
  
  // Studio Navigation inside a College
  const [selectedYearIndex, setSelectedYearIndex] = useState<number>(1);
  const [selectedSemesterIndex, setSelectedSemesterIndex] = useState<number>(1);
  const [activeStudioTab, setActiveStudioTab] = useState<'subjects' | 'specializations' | 'drive' | 'students' | 'updates' | 'grading'>('subjects');

  // Keep selectedYearIndex within visible years bounds
  useEffect(() => {
    if (visibleYearsForSelectedCollege.length > 0 && !visibleYearsForSelectedCollege.includes(selectedYearIndex)) {
      setSelectedYearIndex(visibleYearsForSelectedCollege[0]);
    }
  }, [visibleYearsForSelectedCollege, selectedYearIndex]);

  // Specializations Management State
  const [isCreateSpecModalOpen, setIsCreateSpecModalOpen] = useState(false);
  const [creatingSpec, setCreatingSpec] = useState(false);
  const [specForm, setSpecForm] = useState<{
    specializationNameAr: string;
    specializationNameEn: string;
    specializationStartYear: number;
    specializationStartSemester: number;
    sourceUserId: string;
    sourceUserName: string;
    sourceUserEmail: string;
  }>({
    specializationNameAr: '',
    specializationNameEn: '',
    specializationStartYear: 2,
    specializationStartSemester: 1,
    sourceUserId: '',
    sourceUserName: '',
    sourceUserEmail: ''
  });
  const [specStudentsList, setSpecStudentsList] = useState<any[]>([]);
  const [loadingSpecStudents, setLoadingSpecStudents] = useState(false);
  const [specStudentSearch, setSpecStudentSearch] = useState('');
  const [selectedStudentForSpec, setSelectedStudentForSpec] = useState<any | null>(null);

  // Search & Global Filter
  const [globalSearch, setGlobalSearch] = useState('');
  const [updatesFilter, setUpdatesFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [updatesCategoryFilter, setUpdatesCategoryFilter] = useState<'all' | 'colleges' | 'specializations'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [dbToDelete, setDbToDelete] = useState<UniversityDatabase | null>(null);
  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [driveItemToDelete, setDriveItemToDelete] = useState<DriveFile | null>(null);

  // College Academic Structure Modal State
  const [isStructureModalOpen, setIsStructureModalOpen] = useState(false);
  const [structureForm, setStructureForm] = useState<{ 
    totalYears: number | ''; 
    semestersPerYear: number | '';
    specializationStartYear: number;
    specializationStartSemester: number;
    availableYears: number[];
  }>({ 
    totalYears: 4, 
    semestersPerYear: 2,
    specializationStartYear: 2,
    specializationStartSemester: 1,
    availableYears: [1]
  });

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
    creditHours: number | '';
    totalMarks: number | '';
    yearIndex: number | '';
    semesterIndex: number | '';
    distributions: (GradeDistributionItem | { id: string; name: string; maxMarks: number | ''; achievedMarks: number | null; status: 'current' })[];
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
    yearIndex: string;
    semesterIndex: string;
  }>({
    name: '',
    type: 'folder',
    url: '',
    parentId: null,
    yearIndex: '1',
    semesterIndex: '1'
  });
  const [driveFileToUpload, setDriveFileToUpload] = useState<File | null>(null);
  const [isUploadingDriveFile, setIsUploadingDriveFile] = useState(false);
  // When set, the drive modal renders in EDIT mode: name / year / semester of
  // an existing item (file or folder) — no upload, no type change.
  const [editingDriveItem, setEditingDriveItem] = useState<DriveFile | null>(null);

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
  const [createCollegeForm, setCreateCollegeForm] = useState<{
    collegeNameAr: string;
    collegeNameEn: string;
    sourceUserId: string;
    customYears: number | '';
    customSemesters: number | '';
    specializationStartYear: number;
    specializationStartSemester: number;
    availableYears: number[];
  }>({
    collegeNameAr: '',
    collegeNameEn: '',
    sourceUserId: '',
    customYears: 4,
    customSemesters: 2,
    specializationStartYear: 2,
    specializationStartSemester: 1,
    availableYears: [1]
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
      const pendingCount = updates.filter(u => u.status === 'pending').length;
      onPendingCountChange?.(pendingCount);
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
      isVisible: boolean;
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
          isVisible: r.isVisible !== false,
          colleges: [],
          totalStudents: 0,
          totalSubjects: 0,
          totalDriveFiles: 0,
          pendingUpdatesCount: 0
        };
      } else {
        if (r.isVisible !== undefined) {
          map[key].isVisible = r.isVisible !== false;
        }
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
          isVisible: dbItem.isVisible !== false,
          colleges: [],
          totalStudents: 0,
          totalSubjects: 0,
          totalDriveFiles: 0,
          pendingUpdatesCount: 0
        };
      }
      if (!dbItem.isSpecialization) {
        map[key].colleges.push(dbItem);
      }
      map[key].totalSubjects += (dbItem.subjects?.length || 0);
      map[key].totalDriveFiles += (dbItem.driveFiles?.length || 0);

      // Enrolled students in this college — explicit-ID linking ONLY.
      // Students who merely typed the college name are never counted.
      const childSpecIds = databases.filter(d => d.isSpecialization && d.parentDatabaseId === dbItem.id).map(d => d.id);
      const enrolled = studentsList.filter(
        s => dbItem.isSpecialization
          ? s.specializationDatabaseId === dbItem.id
          : (s.universityDatabaseId === dbItem.id || childSpecIds.includes(s.specializationDatabaseId))
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
      isVisible: true,
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
    const specStartYear = st.specializationStartYear || st.specialization_start_year || st.raw?.settings?.specialization_start_year || 2;
    const specStartSem = st.specializationStartSemester || st.specialization_start_semester || st.raw?.settings?.specialization_start_semester || 1;
    setCreateCollegeForm({
      sourceUserId: st.id,
      collegeNameAr: colAr,
      collegeNameEn: autoTranslateCollege(colAr),
      customYears: st.totalYears || 4,
      customSemesters: st.semestersPerYear || 2,
      specializationStartYear: Number(specStartYear || 2),
      specializationStartSemester: Number(specStartSem || 1),
      availableYears: [1]
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

      const startYear = Number(createCollegeForm.specializationStartYear || 2);
      const startSem = Number(createCollegeForm.specializationStartSemester || 1);

      // Smart Foundation Slicing: Only clone general foundation subjects prior to specialization milestone
      const foundationSubjs = studentSubjs.filter((s: any) => {
        const y = Number(s.yearIndex || s.year_index || 1);
        const sem = Number(s.semesterIndex || s.semester_index || 1);
        return y < startYear || (y === startYear && sem < startSem);
      });

      // Clone foundation subjects cleanly with exact yearIndex and semesterIndex
      const clonedSubjects: Subject[] = foundationSubjs.map((s: any) => ({
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

      // Clone drive files — two-pass id remap so the folder tree stays intact:
      // every item gets a fresh id AND its parentId is remapped to the fresh
      // id of its source parent. Keeping the student's original parentIds used
      // to orphan every child (empty folders at the admin, flattened files
      // at the pulling student).
      const clonedDriveIdMap = new Map<string, string>();
      studentFiles.forEach((f: any) => {
        if (f && f.id) clonedDriveIdMap.set(String(f.id), uuidv4());
      });
      const clonedDrive: DriveFile[] = studentFiles.map((f: any) => ({
        id: clonedDriveIdMap.get(String(f.id)) || uuidv4(),
        name: f.name,
        size: Number(f.size || 0),
        type: f.type || 'file',
        parentId: f.parentId ? (clonedDriveIdMap.get(String(f.parentId)) || null) : null,
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
        totalYears: Number(createCollegeForm.customYears) || source?.totalYears || 4,
        semestersPerYear: Number(createCollegeForm.customSemesters) || source?.semestersPerYear || 2,
        specializationStartYear: startYear,
        specializationStartSemester: startSem,
        availableYears: createCollegeForm.availableYears && createCollegeForm.availableYears.length > 0 ? createCollegeForm.availableYears : [1],
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
        customSemesters: 2,
        specializationStartYear: 2,
        specializationStartSemester: 1,
        availableYears: [1]
      });
      await loadUniData();
    } catch (e) {
      console.error('Error creating college:', e);
    } finally {
      setCreatingCollege(false);
    }
  };

  // --- Specializations Handlers ---
  const handleOpenCreateSpecModal = async () => {
    if (!selectedCollegeDb) return;
    setSpecForm({
      specializationNameAr: '',
      specializationNameEn: '',
      specializationStartYear: selectedCollegeDb.specializationStartYear || 2,
      specializationStartSemester: selectedCollegeDb.specializationStartSemester || 1,
      sourceUserId: '',
      sourceUserName: '',
      sourceUserEmail: ''
    });
    setSelectedStudentForSpec(null);
    setSpecStudentSearch('');
    setIsCreateSpecModalOpen(true);
    setLoadingSpecStudents(true);
    try {
      const candidates = await db.getStudentsWithSpecialization(
        selectedCollegeDb.collegeNameAr,
        undefined,
        selectedCollegeDb.sourceUserId,
        studentsList,
        selectedCollegeDb.id
      );
      setSpecStudentsList(candidates);
    } catch (e) {
      console.error('Error fetching candidate students for specialization:', e);
      setSpecStudentsList([]);
    } finally {
      setLoadingSpecStudents(false);
    }
  };

  const handleSelectStudentForSpec = (student: any) => {
    setSelectedStudentForSpec(student);
    setSpecForm(prev => ({
      ...prev,
      sourceUserId: student.userId,
      sourceUserName: student.name,
      sourceUserEmail: student.email,
      specializationStartYear: student.specializationStartYear || prev.specializationStartYear || 2,
      specializationStartSemester: student.specializationStartSemester || prev.specializationStartSemester || 1,
      specializationNameAr: student.specialization ? student.specialization : prev.specializationNameAr
    }));
  };

  const handleCreateSpecialization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCollegeDb || !specForm.specializationNameAr.trim() || !specForm.sourceUserId) return;
    setCreatingSpec(true);
    try {
      await db.createSpecializationDatabase({
        parentCollegeDbId: selectedCollegeDb.id,
        specializationNameAr: specForm.specializationNameAr.trim(),
        specializationNameEn: specForm.specializationNameEn.trim() || specForm.specializationNameAr.trim(),
        specializationStartYear: Number(specForm.specializationStartYear || 2),
        specializationStartSemester: Number(specForm.specializationStartSemester || 1),
        sourceUserId: specForm.sourceUserId,
        sourceUserName: specForm.sourceUserName,
        sourceUserEmail: specForm.sourceUserEmail,
        subjects: selectedStudentForSpec?.subjects || []
      });
      await loadUniData();
      await onRefreshAllData();
      setIsCreateSpecModalOpen(false);
    } catch (e) {
      console.error('Error creating specialization:', e);
      alert(isAr ? 'حدث خطأ أثناء إنشاء التخصص' : 'Error creating specialization');
    } finally {
      setCreatingSpec(false);
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
      await onRefreshAllData();
    } catch (e) {
      console.error('Error deleting university database:', e);
    }
  };

  // Update College Structure (Years, Semesters, Specialization Timing & Available Years)
  const handleSaveStructure = async () => {
    if (!selectedCollegeDb) return;
    try {
      const updatedFields = {
        totalYears: Number(structureForm.totalYears || 4),
        semestersPerYear: Number(structureForm.semestersPerYear || 2),
        specializationStartYear: Number(structureForm.specializationStartYear || 2),
        specializationStartSemester: Number(structureForm.specializationStartSemester || 1),
        availableYears: structureForm.availableYears && structureForm.availableYears.length > 0 ? structureForm.availableYears : [1]
      };
      await db.updateUniversityDatabase(selectedCollegeDb.id, updatedFields);
      setDatabases(prev => prev.map(d => d.id === selectedCollegeDb.id ? { ...d, ...updatedFields } : d));
      setIsStructureModalOpen(false);
      await loadUniData();
    } catch (e: any) {
      console.error('Error updating structure:', e);
      alert(isAr ? ('حدث خطأ أثناء حفظ الهيكل: ' + (e?.message || 'يرجى المحاولة لاحقاً')) : ('Failed to update structure: ' + (e?.message || 'Please try again')));
    }
  };

  // Switch Source Student Action (Clean Wipe & Overwrite with Foundation Slicing)
  const handleSwitchSourceStudent = async (newStudent: any) => {
    if (!selectedCollegeDb) return;
    try {
      const studentSubjs = newStudent?.subjects || newStudent?.raw?.subjects || [];
      const studentFiles = newStudent?.files || newStudent?.raw?.files || [];
      const studentGrading = (newStudent?.gradingScale && newStudent.gradingScale.length > 0)
        ? newStudent.gradingScale
        : (newStudent?.raw?.settings?.grading_scale || selectedCollegeDb.gradingScale || []);

      const startYear = Number(selectedCollegeDb.specializationStartYear || 2);
      const startSem = Number(selectedCollegeDb.specializationStartSemester || 1);

      // Smart Foundation Slicing for General College: Only clone subjects prior to specialization
      const foundationSubjs = studentSubjs.filter((s: any) => {
        const y = Number(s.yearIndex || s.year_index || 1);
        const sem = Number(s.semesterIndex || s.semester_index || 1);
        return y < startYear || (y === startYear && sem < startSem);
      });

      // Clone subjects cleanly with fresh template IDs
      const clonedSubjects: Subject[] = foundationSubjs.map((s: any) => ({
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
    const newNameEn = editingUni.nameEn.trim() || autoTranslateUniversity(newNameAr);
    if (!newNameAr && !newNameEn) return;

    try {
      setSavingEditUni(true);
      db.updateRegisteredUniversity(editingUni.oldKey, newNameAr, newNameEn);
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
        setSelectedUniversityKey(newNameAr || newNameEn);
      }
      setIsEditUniModalOpen(false);
      setEditingUni(null);
      await loadUniData();
    } catch (e) {
      console.error('Error updating university name:', e);
      alert(isAr ? 'حدث خطأ أثناء تعديل اسم الجامعة.' : 'Error updating university name.');
    } finally {
      setSavingEditUni(false);
    }
  };

  // Delete University & All Its Colleges
  const handleConfirmDeleteUni = async () => {
    if (!uniToDelete) return;
    try {
      setDeletingUni(true);
      db.deleteRegisteredUniversity(uniToDelete.key);
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
      alert(isAr ? 'حدث خطأ أثناء حذف الجامعة.' : 'Error deleting university.');
    } finally {
      setDeletingUni(false);
    }
  };

  // Toggle University Visibility (for students)
  const handleToggleUniversityVisibility = async (uniKey: string, newVisibility: boolean) => {
    try {
      await db.toggleRegisteredUniversityVisibility(uniKey, newVisibility);

      // Also update visibility for all colleges under this university
      const toUpdate = databases.filter(d => 
        d.universityNameAr === uniKey || d.universityNameEn === uniKey ||
        d.universityNameAr?.trim() === uniKey.trim() || d.universityNameEn?.trim() === uniKey.trim()
      );

      for (const col of toUpdate) {
        await db.toggleCollegeDatabaseVisibility(col.id, newVisibility);
      }

      setDatabases(prev => prev.map(d => {
        if (d.universityNameAr === uniKey || d.universityNameEn === uniKey ||
            d.universityNameAr?.trim() === uniKey.trim() || d.universityNameEn?.trim() === uniKey.trim()) {
          return { ...d, isVisible: newVisibility };
        }
        return d;
      }));

      await loadUniData();
    } catch (e) {
      console.error('Error toggling university visibility:', e);
    }
  };

  // Toggle Single College Visibility (for students)
  const handleToggleCollegeVisibility = async (collegeId: string, newVisibility: boolean) => {
    try {
      await db.toggleCollegeDatabaseVisibility(collegeId, newVisibility);
      setDatabases(prev => prev.map(d => d.id === collegeId ? { ...d, isVisible: newVisibility } : d));
      await loadUniData();
    } catch (e) {
      console.error('Error toggling college visibility:', e);
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
    const cleanGrade: GradeRule = {
      ...gradeForm,
      minPercentage: Number(gradeForm.minPercentage || 0),
      maxPercentage: Number(gradeForm.maxPercentage || 100),
      points: Number(gradeForm.points || 0)
    };
    if (editingGrade) {
      updatedScale = currentScale.map(g => g.id === editingGrade.id ? cleanGrade : g);
    } else {
      updatedScale = [...currentScale, { ...cleanGrade, id: cleanGrade.id || uuidv4() }];
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

  // Delete Subject from College Database (Trigger In-App Modal)
  const handleConfirmDeleteSubject = async () => {
    if (!selectedCollegeDb || !subjectToDelete) return;
    try {
      const subjectId = subjectToDelete.id;
      const targetSubj = selectedCollegeDb.subjects.find(s => s.id === subjectId);
      const updatedSubjects = selectedCollegeDb.subjects.filter(s => s.id !== subjectId);
      await db.updateUniversityDatabase(selectedCollegeDb.id, { subjects: updatedSubjects });
      
      // Real-time synchronization to all enrolled/restored students
      await db.syncUniversityDatabaseChangesToStudents(selectedCollegeDb.id, {
        type: 'delete_subject',
        subjectId,
        subject: targetSubj
      });

      setSubjectToDelete(null);
      await loadUniData();
    } catch (e) {
      console.error('Error deleting subject:', e);
    }
  };

  // Opens the drive modal pre-filled with the parent folder's year/semester —
  // anything created inside a folder inherits its academic phase by default.
  const openDriveModalFor = (type: 'folder' | 'file') => {
    setEditingDriveItem(null);
    setDriveForm({
      name: '',
      type,
      url: '',
      parentId: currentDriveFolderId,
      yearIndex: String(Number(currentFolderObject?.yearIndex) || 1),
      semesterIndex: String(Number(currentFolderObject?.semesterIndex) || 1)
    });
    setIsDriveModalOpen(true);
  };

  const openDriveEditModal = (file: DriveFile) => {
    setEditingDriveItem(file);
    setDriveFileToUpload(null);
    setDriveForm({
      name: file.name,
      type: file.type,
      url: file.url || '',
      parentId: file.parentId,
      yearIndex: String(Number(file.yearIndex) || 1),
      semesterIndex: String(Number(file.semesterIndex) || 1)
    });
    setIsDriveModalOpen(true);
  };

  const handleUpdateDriveItem = async () => {
    if (!selectedCollegeDb || !editingDriveItem) return;
    if (!driveForm.name.trim()) {
      alert(isAr ? 'يرجى كتابة الاسم.' : 'Please enter a name.');
      return;
    }
    try {
      const updatedFiles = (selectedCollegeDb.driveFiles || []).map(f =>
        f.id === editingDriveItem.id
          ? {
              ...f,
              name: driveForm.name.trim(),
              yearIndex: Number(driveForm.yearIndex) || 1,
              semesterIndex: Number(driveForm.semesterIndex) || 1
            }
          : f
      );
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setIsDriveModalOpen(false);
      setEditingDriveItem(null);
      setDriveForm({ name: '', type: 'folder', url: '', parentId: null, yearIndex: '1', semesterIndex: '1' });
      await loadUniData();
    } catch (e) {
      console.error('Error updating drive item:', e);
    }
  };

  const handleSaveDriveItem = async () => {
    if (!selectedCollegeDb) return;

    // Folder Branch
    if (driveForm.type === 'folder') {
      if (!driveForm.name.trim()) {
        alert(isAr ? 'يرجى كتابة اسم المجلد.' : 'Please enter folder name.');
        return;
      }
      try {
        const newFolder: DriveFile = {
          id: uuidv4(),
          name: driveForm.name.trim(),
          type: 'folder',
          size: 0,
          parentId: currentDriveFolderId,
          createdAt: new Date().toISOString().split('T')[0],
          url: '',
          yearIndex: Number(driveForm.yearIndex) || 1,
          semesterIndex: Number(driveForm.semesterIndex) || 1
        };
        const updatedFiles = [...(selectedCollegeDb.driveFiles || []), newFolder];
        await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
        setIsDriveModalOpen(false);
        setDriveForm({ name: '', type: 'folder', url: '', parentId: null, yearIndex: '1', semesterIndex: '1' });
        setDriveFileToUpload(null);
        await loadUniData();
      } catch (e) {
        console.error('Error creating folder:', e);
      }
      return;
    }

    // Real File Branch (device upload only — external URLs removed)
    if (!driveFileToUpload) {
      alert(isAr ? 'يرجى اختيار ملف من جهازك لرفعه.' : 'Please select a file to upload.');
      return;
    }

    const fileName = driveForm.name.trim() || driveFileToUpload?.name || 'مستند';
    const fileId = uuidv4();

    try {
      setIsUploadingDriveFile(true);
      let publicUrl = '';
      let b2Path: string | undefined = undefined;
      const fileSize = driveFileToUpload ? driveFileToUpload.size : 0;

      if (driveFileToUpload) {
        try {
          const cleanFileName = driveFileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const b2Key = `college_drive/${selectedCollegeDb.id}/${fileId}_${cleanFileName}`;
          const res = await uploadFile(driveFileToUpload, b2Key);
          publicUrl = res.publicUrl;
          b2Path = res.b2Path;
        } catch (b2Err) {
          console.warn('B2 upload fallback to base64 data URL:', b2Err);
          const base64Url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(driveFileToUpload);
          });
          publicUrl = base64Url;
        }
      }

      const newFile: DriveFile = {
        id: fileId,
        name: fileName,
        type: 'file',
        size: fileSize,
        parentId: currentDriveFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: publicUrl,
        b2FileId: b2Path,
        yearIndex: Number(driveForm.yearIndex) || 1,
        semesterIndex: Number(driveForm.semesterIndex) || 1
      };

      const updatedFiles = [...(selectedCollegeDb.driveFiles || []), newFile];
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });
      setIsDriveModalOpen(false);
      setDriveForm({ name: '', type: 'folder', url: '', parentId: null, yearIndex: '1', semesterIndex: '1' });
      setDriveFileToUpload(null);
      await loadUniData();
    } catch (e) {
      console.error('Error saving drive file:', e);
      alert(isAr ? 'حدث خطأ أثناء رفع وحفظ الملف.' : 'Error uploading and saving file.');
    } finally {
      setIsUploadingDriveFile(false);
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

  // Delete Drive Item (Trigger In-App Modal) — removes the whole subtree and
  // hard-deletes the files' B2 objects (the admin database owns them).
  const handleConfirmDeleteDriveItem = async () => {
    if (!selectedCollegeDb || !driveItemToDelete) return;
    try {
      const allFiles = selectedCollegeDb.driveFiles || [];
      const collectDescendants = (rootId: string): DriveFile[] => {
        const out: DriveFile[] = [];
        const walk = (pid: string) => {
          allFiles.filter(f => f.parentId === pid).forEach(f => {
            out.push(f);
            if (f.type === 'folder') walk(f.id);
          });
        };
        walk(rootId);
        return out;
      };
      const doomed = [driveItemToDelete, ...collectDescendants(driveItemToDelete.id)];
      const doomedIds = new Set(doomed.map(f => f.id));

      const updatedFiles = allFiles.filter(f => !doomedIds.has(f.id));
      await db.updateUniversityDatabase(selectedCollegeDb.id, { driveFiles: updatedFiles });

      // Server-side (Edge Function) hard delete with client-side fallback.
      import('../../lib/backblaze').then(({ deleteMultipleFromB2 }) => {
        const b2Keys = doomed
          .filter(f => f.type === 'file')
          .map(f => f.b2FileId || f.url || '')
          .filter(Boolean);
        if (b2Keys.length > 0) deleteMultipleFromB2(b2Keys).catch(console.error);
      }).catch(console.error);

      setDriveItemToDelete(null);
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
    // Optimistic immediate update of badge counter
    setPendingUpdates(prev => {
      const next = prev.map(p => p.id === update.id ? { ...p, status } : p);
      const remainingCount = next.filter(p => p.status === 'pending').length;
      onPendingCountChange?.(remainingCount);
      return next;
    });

    try {
      if (status === 'pending') {
        await db.recordPendingUpdate({ ...update, status: 'pending', resolvedAt: undefined });
      } else {
        await db.respondToPendingUpdate(update.id, status, (targetDb) => {
          if (update.type === 'add_subject' && update.data) {
            const subjectId = update.data.id || uuidv4();
            const subjectName = (update.data.name || '').trim();
            const newSubj: Subject = {
              id: subjectId,
              code: (update.data.code || '').trim(),
              name: subjectName,
              creditHours: Number(update.data.creditHours || update.data.credit_hours || 3),
              totalMarks: Number(update.data.totalMarks || update.data.total_marks || 100),
              yearIndex: Number(update.data.yearIndex || update.data.year_index || 1),
              semesterIndex: Number(update.data.semesterIndex || update.data.semester_index || 1),
              distributions: (update.data.distributions || []).map((d: any) => ({
                id: d.id || uuidv4(),
                name: (d.name || '').trim(),
                maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : (d.max_marks !== undefined ? d.max_marks : 0)),
                achievedMarks: null,
                status: 'current' as const
              })),
              status: 'current',
              includeInGpa: update.data.includeInGpa !== false && update.data.include_in_gpa !== false
            };
            const normNew = normalizeSubjectName(newSubj.name);
            const filtered = (targetDb.subjects || []).filter(s => 
              s.id !== subjectId && 
              !(normalizeSubjectName(s.name) === normNew && s.yearIndex === newSubj.yearIndex && s.semesterIndex === newSubj.semesterIndex)
            );
            return { ...targetDb, subjects: [...filtered, newSubj] };
          } else if (update.type === 'update_subject' && update.data) {
            const { previous: _previous, ...upd } = update.data;
            const updatedDistributions = upd.distributions
              ? upd.distributions.map((d: any) => ({
                  id: d.id || uuidv4(),
                  name: (d.name || '').trim(),
                  maxMarks: Number(d.maxMarks !== undefined ? d.maxMarks : (d.max_marks !== undefined ? d.max_marks : 0)),
                  achievedMarks: null,
                  status: 'current' as const
                }))
              : undefined;

            const normUpd = normalizeSubjectName(upd.name || '');
            return {
              ...targetDb,
              subjects: (targetDb.subjects || []).map(s => {
                const isMatch = s.id === upd.id || (normUpd && normalizeSubjectName(s.name) === normUpd && s.yearIndex === upd.yearIndex && s.semesterIndex === upd.semesterIndex);
                if (!isMatch) return s;
                return {
                  ...s,
                  ...upd,
                  name: (upd.name || s.name || '').trim(),
                  distributions: updatedDistributions !== undefined ? updatedDistributions : s.distributions
                };
              })
            };
          } else if (update.type === 'delete_subject' && update.data) {
            const upd = update.data;
            const normUpd = normalizeSubjectName(upd.name || '');
            return {
              ...targetDb,
              subjects: (targetDb.subjects || []).filter(s => s.id !== upd.id && normalizeSubjectName(s.name) !== normUpd)
            };
          } else if (update.type === 'add_file' && update.data) {
            const file = update.data;
            const newFile: DriveFile = {
              id: file.id || uuidv4(),
              name: file.name,
              size: Number(file.size || 0),
              type: file.type || 'file',
              parentId: file.parentId || null,
              createdAt: file.createdAt || new Date().toISOString(),
              url: file.url || '',
              b2FileId: file.b2FileId || file.b2_file_id,
              yearIndex: file.yearIndex !== undefined ? Number(file.yearIndex) : undefined,
              semesterIndex: file.semesterIndex !== undefined ? Number(file.semesterIndex) : undefined
            };
            // Parent resolution: try the original parentId first, then fall
            // back to the source folder NAME (ids differ between the student's
            // drive and the cloned database), else surface at the root.
            let resolvedParentId: string | null = newFile.parentId || null;
            if (resolvedParentId && !(targetDb.driveFiles || []).some(f => f.id === resolvedParentId && f.type === 'folder')) {
              const parentByName = file.parentName
                ? (targetDb.driveFiles || []).find(f => f.type === 'folder' && f.name === file.parentName)
                : undefined;
              resolvedParentId = parentByName ? parentByName.id : null;
            }
            newFile.parentId = resolvedParentId;
            const filteredFiles = (targetDb.driveFiles || []).filter(f => f.id !== newFile.id && f.name !== newFile.name);
            return {
              ...targetDb,
              driveFiles: [...filteredFiles, newFile]
            };
          } else if (update.type === 'update_file' && update.data) {
            const { previous: _previous, ...updatedFile } = update.data;
            return {
              ...targetDb,
              driveFiles: (targetDb.driveFiles || []).map(file =>
                file.id === updatedFile.id
                  ? {
                      ...file,
                      ...updatedFile,
                      parentId: updatedFile.parentId !== undefined ? updatedFile.parentId : file.parentId
                    }
                  : file
              )
            };
          } else if (update.type === 'delete_file' && update.data) {
            const targetId = update.data.id;
            const targetName = update.data.name;
            return {
              ...targetDb,
              driveFiles: (targetDb.driveFiles || []).filter(f => f.id !== targetId && f.name !== targetName)
            };
          }
          return targetDb;
        });
      }
      if (status === 'approved' && update.universityDatabaseId) {
        setDatabases(prev => prev.map(d => {
          if (d.id === update.universityDatabaseId) {
            if (update.type === 'add_subject' && update.data) {
              const subjectId = update.data.id || uuidv4();
              const newSubj: Subject = {
                id: subjectId,
                code: (update.data.code || '').trim(),
                name: (update.data.name || '').trim(),
                creditHours: Number(update.data.creditHours || update.data.credit_hours || 3),
                totalMarks: Number(update.data.totalMarks || update.data.total_marks || 100),
                yearIndex: Number(update.data.yearIndex || update.data.year_index || 1),
                semesterIndex: Number(update.data.semesterIndex || update.data.semester_index || 1),
                distributions: update.data.distributions || [],
                status: 'current',
                includeInGpa: update.data.includeInGpa !== false && update.data.include_in_gpa !== false
              };
              const filtered = (d.subjects || []).filter(s => s.id !== subjectId && s.name !== newSubj.name);
              return { ...d, subjects: [...filtered, newSubj] };
            } else if (update.type === 'update_subject' && update.data) {
              const upd = update.data;
              return {
                ...d,
                subjects: (d.subjects || []).map(s => (s.id === upd.id || s.name === upd.name) ? { ...s, ...upd } : s)
              };
            } else if (update.type === 'delete_subject' && update.data) {
              return {
                ...d,
                subjects: (d.subjects || []).filter(s => s.id !== update.data.id && s.name !== update.data.name)
              };
            }
          }
          return d;
        }));
      }
      if (update.universityDatabaseId) {
        await broadcastUniversityDatabaseUpdate({ id: update.universityDatabaseId, timestamp: Date.now() });
      }
      await loadUniData();
      await onRefreshAllData();
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
    if (updatesCategoryFilter === 'colleges') {
      list = list.filter(u => {
        const targetDb = databases.find(d => d.id === u.universityDatabaseId);
        return !targetDb || !targetDb.isSpecialization;
      });
    } else if (updatesCategoryFilter === 'specializations') {
      list = list.filter(u => {
        const targetDb = databases.find(d => d.id === u.universityDatabaseId);
        return targetDb && targetDb.isSpecialization;
      });
    }
    return list;
  }, [pendingUpdates, updatesFilter, updatesCategoryFilter, databases]);

  // Counts by category
  const updatesCategoryCounts = useMemo(() => {
    let baseList = pendingUpdates;
    if (updatesFilter !== 'all') {
      baseList = baseList.filter(u => u.status === updatesFilter);
    }
    let collegesCount = 0;
    let specCount = 0;
    baseList.forEach(u => {
      const targetDb = databases.find(d => d.id === u.universityDatabaseId);
      if (targetDb?.isSpecialization) {
        specCount++;
      } else {
        collegesCount++;
      }
    });
    return { all: baseList.length, colleges: collegesCount, specializations: specCount };
  }, [pendingUpdates, updatesFilter, databases]);

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

  // Students explicitly linked to this college (or one of its child
  // specializations) — name-matching is never used.
  const enrolledCollegeStudents = useMemo(() => {
    if (!selectedCollegeDb) return [];
    const childSpecIds = databases
      .filter(d => d.isSpecialization && d.parentDatabaseId === selectedCollegeDb.id)
      .map(d => d.id);
    return studentsList.filter(st =>
      st.universityDatabaseId === selectedCollegeDb.id ||
      childSpecIds.includes(st.specializationDatabaseId)
    );
  }, [selectedCollegeDb, databases, studentsList]);

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
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 flex-wrap">
              {/* Category Filter (Colleges vs Specializations) */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-700/60">
                <button
                  type="button"
                  onClick={() => setUpdatesCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    updatesCategoryFilter === 'all'
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  {isAr ? `الكل (${updatesCategoryCounts.all})` : `All (${updatesCategoryCounts.all})`}
                </button>
                <button
                  type="button"
                  onClick={() => setUpdatesCategoryFilter('colleges')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    updatesCategoryFilter === 'colleges'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Building2 size={13} />
                  <span>{isAr ? `كليات عامة (${updatesCategoryCounts.colleges})` : `Colleges (${updatesCategoryCounts.colleges})`}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUpdatesCategoryFilter('specializations')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    updatesCategoryFilter === 'specializations'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Sparkles size={13} />
                  <span>{isAr ? `تخصصات (${updatesCategoryCounts.specializations})` : `Specs (${updatesCategoryCounts.specializations})`}</span>
                </button>
              </div>

              {/* Status Filter (Pending, Approved, Rejected, All) */}
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
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
                          {group.studentName ? group.studentName.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-black text-base text-zinc-900 dark:text-white">{group.studentName}</h4>
                            {group.collegeDb?.isSpecialization ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 flex items-center gap-1">
                                <Sparkles size={11} />
                                <span>{group.collegeDb.universityNameAr} • {group.collegeDb.collegeNameAr} (تخصص: {group.collegeDb.specializationNameAr || ''})</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                                {group.collegeDb ? `${group.collegeDb.universityNameAr} • ${group.collegeDb.collegeNameAr}` : group.collegeId}
                              </span>
                            )}
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
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                                      <Calendar size={11} />
                                      <span>{isAr ? `سنة ${update.data.yearIndex}` : `Year ${update.data.yearIndex}`}</span>
                                    </span>
                                  )}
                                  {update.data.semesterIndex !== undefined && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                                      <BookOpen size={11} />
                                      <span>{isAr ? `ترم ${update.data.semesterIndex}` : `Term ${update.data.semesterIndex}`}</span>
                                    </span>
                                  )}
                                  {update.data.creditHours !== undefined && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                      <Clock size={11} />
                                      <span>{update.data.creditHours} {isAr ? 'ساعات' : 'hrs'}</span>
                                    </span>
                                  )}
                                  {update.data.totalMarks !== undefined && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                      <Award size={11} />
                                      <span>{update.data.totalMarks} {isAr ? 'درجة' : 'marks'}</span>
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
                    <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
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
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer shrink-0"
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
                  className="w-full pl-11 rtl:pl-4 rtl:pr-11 pr-4 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                />
              </div>

              {/* Table Container Styled Like AcademicSubjects Table */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <h3 className="font-black text-sm sm:text-base text-zinc-900 dark:text-white flex items-center gap-2">
                    <Building2 size={18} className="text-blue-600" />
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
                              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold shrink-0">
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
                                type="button"
                                onClick={() => handleToggleUniversityVisibility(group.key, !group.isVisible)}
                                className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                  group.isVisible !== false
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                                }`}
                                title={
                                  group.isVisible !== false 
                                    ? (isAr ? 'الجامعة مرئية للطلاب (اضغط للإخفاء)' : 'Visible to students (Click to hide)')
                                    : (isAr ? 'الجامعة مخفية عن الطلاب (اضغط للإظهار)' : 'Hidden from students (Click to show)')
                                }
                              >
                                {group.isVisible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                                <span>{group.isVisible !== false ? (isAr ? 'مرئي' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}</span>
                              </button>
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
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-black text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <BackIcon size={16} />
                    <span>{isAr ? 'العودة لقائمة الجامعات' : 'Back to Universities'}</span>
                  </button>

                  <span className="text-zinc-400">/</span>

                  <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">
                    {currentUniversityGroup.nameAr} ({currentUniversityGroup.nameEn})
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleUniversityVisibility(currentUniversityGroup.key, !currentUniversityGroup.isVisible)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                      currentUniversityGroup.isVisible !== false
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                    }`}
                    title={isAr ? 'تغيير ظهور الجامعة للطلاب' : 'Toggle University Visibility'}
                  >
                    {currentUniversityGroup.isVisible !== false ? <Eye size={15} /> : <EyeOff size={15} />}
                    <span>
                      {currentUniversityGroup.isVisible !== false 
                        ? (isAr ? 'الجامعة مرئية للطلاب' : 'University Visible') 
                        : (isAr ? 'الجامعة مخفية عن الطلاب' : 'University Hidden')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setCreateCollegeForm({
                        collegeNameAr: '',
                        collegeNameEn: '',
                        sourceUserId: '',
                        customYears: 4,
                        customSemesters: 2,
                        specializationStartYear: 2,
                        specializationStartSemester: 1,
                        availableYears: [1]
                      });
                      setShowAllStudentsForCollege(false);
                      setCollegeStudentSearchQuery('');
                      setIsCreateCollegeModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-blue-500/25 transition-all cursor-pointer shrink-0"
                  >
                    <Plus size={16} />
                    <span>{isAr ? 'إضافة كلية للجامعة' : 'Add College to University'}</span>
                  </button>
                </div>
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
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-black text-sm text-zinc-900 dark:text-white">{collegeDb.collegeNameAr}</p>
                                    {colUpdates > 0 && (
                                      <span className="px-2 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                                        {colUpdates} {isAr ? 'تحديث' : 'updates'}
                                      </span>
                                    )}
                                    {(() => {
                                      const specsCount = databases.filter(d => d.isSpecialization && d.parentDatabaseId === collegeDb.id).length;
                                      if (specsCount === 0) return null;
                                      return (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                          <Sparkles size={10} />
                                          <span>{specsCount} {isAr ? 'تخصص' : 'specs'}</span>
                                        </span>
                                      );
                                    })()}
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
                                  type="button"
                                  onClick={() => handleToggleCollegeVisibility(collegeDb.id, !(collegeDb.isVisible !== false))}
                                  className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                    collegeDb.isVisible !== false
                                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                                  }`}
                                  title={
                                    collegeDb.isVisible !== false 
                                      ? (isAr ? 'الكلية مرئية للطلاب (اضغط للإخفاء)' : 'Visible to students (Click to hide)')
                                      : (isAr ? 'الكلية مخفية عن الطلاب (اضغط للإظهار)' : 'Hidden from students (Click to show)')
                                  }
                                >
                                  {collegeDb.isVisible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                                  <span>{collegeDb.isVisible !== false ? (isAr ? 'مرئي' : 'Visible') : (isAr ? 'مخفي' : 'Hidden')}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedCollegeId(collegeDb.id);
                                    setSelectedYearIndex(1);
                                    setSelectedSemesterIndex(1);
                                    setActiveStudioTab('subjects');
                                  }}
                                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
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
                                  customSemesters: 2,
                                  specializationStartYear: 2,
                                  specializationStartSemester: 1,
                                  availableYears: [1]
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
                    type="button"
                    onClick={() => handleToggleCollegeVisibility(selectedCollegeDb.id, !(selectedCollegeDb.isVisible !== false))}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      selectedCollegeDb.isVisible !== false
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
                    }`}
                    title={isAr ? 'تغيير ظهور الكلية للطلاب' : 'Toggle College Visibility'}
                  >
                    {selectedCollegeDb.isVisible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                    <span>
                      {selectedCollegeDb.isVisible !== false 
                        ? (isAr ? 'الكلية مرئية للطلاب' : 'College Visible') 
                        : (isAr ? 'الكلية مخفية عن الطلاب' : 'College Hidden')}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setStructureForm({
                        totalYears: selectedCollegeDb.totalYears || 4,
                        semestersPerYear: selectedCollegeDb.semestersPerYear || 2,
                        specializationStartYear: selectedCollegeDb.specializationStartYear || 2,
                        specializationStartSemester: selectedCollegeDb.specializationStartSemester || 1,
                        availableYears: selectedCollegeDb.availableYears && selectedCollegeDb.availableYears.length > 0 ? selectedCollegeDb.availableYears : [1]
                      });
                      setIsStructureModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <Sliders size={14} />
                    <span>{selectedCollegeDb.totalYears || 4} {isAr ? 'سنوات' : 'Yrs'} • {selectedCollegeDb.semestersPerYear || 2} {isAr ? 'فصول/سنة' : 'Sem/Yr'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStructureForm({
                        totalYears: selectedCollegeDb.totalYears || 4,
                        semestersPerYear: selectedCollegeDb.semestersPerYear || 2,
                        specializationStartYear: selectedCollegeDb.specializationStartYear || 2,
                        specializationStartSemester: selectedCollegeDb.specializationStartSemester || 1,
                        availableYears: selectedCollegeDb.availableYears && selectedCollegeDb.availableYears.length > 0 ? selectedCollegeDb.availableYears : [1]
                      });
                      setIsStructureModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    <span>{isAr ? 'السنين المتاحة:' : 'Available:'}</span>
                    <span className="underline font-black">
                      {(selectedCollegeDb.availableYears && selectedCollegeDb.availableYears.length > 0 ? selectedCollegeDb.availableYears : [1]).map(y => isAr ? `سنة ${y}` : `Y${y}`).join('، ')}
                    </span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">({isAr ? 'يتم التحديث سنوياً' : 'Updated annually'})</span>
                  </button>

                  {!selectedCollegeDb.isSpecialization && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 rounded-xl text-xs font-bold">
                      <Compass size={13} />
                      <span>{isAr ? `تخصص يبدأ: سنة ${selectedCollegeDb.specializationStartYear || 2} ترم ${selectedCollegeDb.specializationStartSemester || 1}` : `Spec starts: Y${selectedCollegeDb.specializationStartYear || 2} T${selectedCollegeDb.specializationStartSemester || 1}`}</span>
                    </span>
                  )}

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

              {/* Specialization Notice Banner (if active database is a specialization) */}
              {selectedCollegeDb.isSpecialization && (
                <div className="bg-blue-50/70 dark:bg-blue-950/40 p-4 rounded-2xl border border-blue-200 dark:border-blue-800/40 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-blue-900 dark:text-blue-200">
                    <Sparkles size={18} className="text-blue-600 shrink-0" />
                    <span>
                      {isAr ? 'قاعدة بيانات تخصص فرعي:' : 'Specialization Database:'} <strong>{selectedCollegeDb.specializationNameAr || selectedCollegeDb.collegeNameAr}</strong> ({isAr ? `يبدأ من سنة ${selectedCollegeDb.specializationStartYear || 1} - ترم ${selectedCollegeDb.specializationStartSemester || 1}` : `Starts Year ${selectedCollegeDb.specializationStartYear || 1} - Semester ${selectedCollegeDb.specializationStartSemester || 1}`})
                    </span>
                  </div>
                  {selectedCollegeDb.parentDatabaseId && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollegeId(selectedCollegeDb.parentDatabaseId!);
                        setActiveStudioTab('specializations');
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
                    >
                      <BackIcon size={13} />
                      <span>{isAr ? 'العودة للكلية الأم' : 'Back to College'}</span>
                    </button>
                  )}
                </div>
              )}

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

                {!selectedCollegeDb.isSpecialization && (
                  <button
                    onClick={() => setActiveStudioTab('specializations')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                      activeStudioTab === 'specializations'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Sparkles size={16} />
                    <span>{isAr ? 'تخصصات الكلية' : 'Specializations'}</span>
                    {collegeSpecializations.length > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        activeStudioTab === 'specializations' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                      }`}>
                        {collegeSpecializations.length}
                      </span>
                    )}
                  </button>
                )}

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
                        {visibleYearsForSelectedCollege.map(year => (
                          <button
                            key={year}
                            onClick={() => setSelectedYearIndex(year)}
                            className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                              selectedYearIndex === year
                                ? 'bg-blue-600 text-white shadow-sm'
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
                            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer"
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
                              className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold cursor-pointer"
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
                                      className="p-2 rounded-xl text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors cursor-pointer"
                                      title={isAr ? 'تعديل المادة وتوزيع الدرجات' : 'Edit Subject'}
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                    <button
                                      onClick={() => setSubjectToDelete(subj)}
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
                                        className="px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold border border-blue-100 dark:border-blue-900/40"
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

              {/* STUDIO TAB: COLLEGE SPECIALIZATIONS */}
              {activeStudioTab === 'specializations' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  {/* Header & Add Button */}
                  <div className="bg-white dark:bg-zinc-900 p-6 sm:p-7 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                        <Sparkles size={24} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">
                            {isAr ? 'تخصصات الكلية' : 'College Specializations'}
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                            {collegeSpecializations.length} {isAr ? 'تخصص' : 'specializations'}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {isAr
                            ? `إدارة التخصصات المتفرعة من ${selectedCollegeDb.collegeNameAr} وسحب المناهج من الطلاب المعتمدين بدءاً من سنة التخصص فصاعداً.`
                            : `Manage specializations branched from ${selectedCollegeDb.collegeNameEn || selectedCollegeDb.collegeNameAr} and clone curricula starting from specialization year.`}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleOpenCreateSpecModal}
                      className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 text-white font-black text-xs sm:text-sm rounded-2xl shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-[1.02]"
                    >
                      <Plus size={18} />
                      <span>{isAr ? 'إضافة تخصص جديد للكلية' : 'Add Specialization'}</span>
                    </button>
                  </div>

                  {/* Specializations Cards Grid */}
                  {collegeSpecializations.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {collegeSpecializations.map(spec => (
                        <div
                          key={spec.id}
                          className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-xs hover:border-blue-300 dark:hover:border-blue-800 transition-all flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-black text-base text-zinc-900 dark:text-white flex items-center gap-1.5">
                                  <Sparkles size={16} className="text-blue-600 shrink-0" />
                                  <span>{spec.specializationNameAr || spec.collegeNameAr}</span>
                                </h4>
                                {spec.specializationNameEn && (
                                  <p className="text-xs text-zinc-400 font-medium mt-0.5" dir="ltr">
                                    {spec.specializationNameEn}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => setDbToDelete(spec)}
                                className="p-2 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                                title={isAr ? 'حذف هذا التخصص' : 'Delete Specialization'}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>

                            {/* Milestone Badge */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                              <Clock size={13} />
                              <span>
                                {isAr 
                                  ? `بداية التخصص: سنة ${spec.specializationStartYear || 1} - ترم ${spec.specializationStartSemester || 1}` 
                                  : `Starts: Year ${spec.specializationStartYear || 1} - Term ${spec.specializationStartSemester || 1}`}
                              </span>
                            </div>

                            {/* Counts */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                                <BookOpen size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <div>
                                  <span className="block font-black text-sm text-zinc-900 dark:text-white leading-none">
                                    {spec.subjects?.length || 0}
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-400">
                                    {isAr ? 'مواد التخصص' : 'Subjects'}
                                  </span>
                                </div>
                              </div>

                              <div className="bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                                <HardDrive size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                                <div>
                                  <span className="block font-black text-sm text-zinc-900 dark:text-white leading-none">
                                    {spec.driveFiles?.length || 0}
                                  </span>
                                  <span className="text-[10px] font-bold text-zinc-400">
                                    {isAr ? 'ملفات الدرايف' : 'Drive Files'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Source Student */}
                            <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-2xl border border-zinc-100 dark:border-zinc-800/80">
                              <span className="font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 truncate">
                                <User size={13} className="text-zinc-500 shrink-0" />
                                <span>{spec.sourceUserName || (isAr ? 'طالب مسجل' : 'Student')}</span>
                              </span>
                              <span className="text-[11px] text-zinc-400 truncate block">
                                {spec.sourceUserEmail || (isAr ? 'بدون بريد' : 'No email')}
                              </span>
                            </div>
                          </div>

                          {/* Manage Specialization Curriculum Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCollegeId(spec.id);
                              setSelectedYearIndex(spec.specializationStartYear || 1);
                              setSelectedSemesterIndex(spec.specializationStartSemester || 1);
                              setActiveStudioTab('subjects');
                            }}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>{isAr ? 'إدارة منهج ومواد التخصص' : 'Manage Curriculum'}</span>
                            <ArrowIcon size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-12 text-center space-y-4">
                      <div className="w-16 h-16 rounded-3xl bg-blue-100 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto shadow-sm">
                        <Sparkles size={32} />
                      </div>
                      <div className="max-w-md mx-auto space-y-1">
                        <h4 className="text-lg font-black text-zinc-900 dark:text-white">
                          {isAr ? 'لا توجد تخصصات مضافة لهذه الكلية حتى الآن' : 'No specializations added for this college yet'}
                        </h4>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {isAr
                            ? 'يمكنك إضافة تخصصات أكاديمية متفرعة (مثل: هندسة الحاسبات، ميكاترونكس، عمارة) وسحب مناهجها وملفاتها بذكاء من الطلاب المسجلين بدءاً من سنة التخصص فصاعداً.'
                            : 'Add academic specializations and clone their curricula cleanly from enrolled students.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenCreateSpecModal}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-2xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                      >
                        <Plus size={16} />
                        <span>{isAr ? 'إضافة أول تخصص للكلية' : 'Add First Specialization'}</span>
                      </button>
                    </div>
                  )}
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
                          !currentDriveFolderId ? 'text-blue-600 font-black' : 'text-zinc-500'
                        }`}
                      >
                        {isAr ? 'الدرايف الرئيسي' : 'Root Drive'}
                      </button>

                      {currentFolderObject && (
                        <>
                          <span className="text-zinc-400">/</span>
                          <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                            {currentFolderObject.name}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openDriveModalFor('folder')}
                        className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        <FolderPlus size={15} />
                        <span>{isAr ? 'مجلد جديد' : 'New Folder'}</span>
                      </button>

                      <button
                        onClick={() => openDriveModalFor('file')}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-xs cursor-pointer"
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
                            className="group p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                            onClick={() => handlePreviewDriveFile(file)}
                          >
                            {/* Name block: wraps up to 3 lines — the card grows
                                with the name, nothing hides behind the buttons
                                (identical to the student drive layout). */}
                            <div className="flex items-start gap-3.5">
                              <div className={`p-3 rounded-2xl shrink-0 ${
                                file.type === 'folder'
                                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60'
                              }`}>
                                {file.type === 'folder' ? <Folder size={22} /> : <FileText size={22} />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-sm text-zinc-900 dark:text-white whitespace-normal break-words line-clamp-3 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                  {file.name}
                                </p>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                  {file.type === 'folder' ? (isAr ? 'مجلد درايف' : 'Folder') : `${formatSize(file.size)} • ${file.createdAt}`}
                                </p>
                              </div>
                            </div>

                            {/* Actions: 2x2 grid BELOW the name — full-width buttons */}
                            <div className="grid grid-cols-2 gap-1.5 mt-3" onClick={(e) => e.stopPropagation()}>
                              {/* Move Button */}
                              <button
                                onClick={() => {
                                  setMovingFile(file);
                                  setTargetMoveFolderId(null);
                                }}
                                className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-700/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                                title={isAr ? 'نقل إلى مجلد' : 'Move'}
                              >
                                <Move size={15} className="mx-auto" />
                              </button>

                              {/* Preview in Browser */}
                              {file.type === 'file' && (
                                <button
                                  onClick={() => handlePreviewDriveFile(file)}
                                  className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                                  title={isAr ? 'معاينة في المتصفح' : 'Preview'}
                                >
                                  <Eye size={15} className="mx-auto" />
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
                                  {downloadingFileId === file.id ? <Loader2 size={15} className="animate-spin mx-auto" /> : <Download size={15} className="mx-auto" />}
                                </button>
                              )}

                              {/* Edit Button (name / year / semester) */}
                              <button
                                onClick={() => openDriveEditModal(file)}
                                className="p-2 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                                title={isAr ? 'تعديل الاسم أو السنة أو الفصل' : 'Edit name, year or semester'}
                              >
                                <Pencil size={15} className="mx-auto" />
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => setDriveItemToDelete(file)}
                                className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                                title={isAr ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={15} className="mx-auto" />
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
                    {enrolledCollegeStudents.map(st => (
                      <div key={st.id} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/80 flex items-center justify-between">
                        <div>
                          <h5 className="font-black text-xs sm:text-sm text-zinc-900 dark:text-white">{st.name}</h5>
                          <p className="text-[11px] text-zinc-400">{st.email}</p>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                          {st.subjects?.length || 0} {isAr ? 'مادة مسجلة' : 'subjects'}
                        </span>
                      </div>
                    ))}

                    {enrolledCollegeStudents.length === 0 && (
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
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
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
                    className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-blue-300 shadow-2xs'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-xs text-zinc-900 dark:text-white truncate">
                              {st.name}
                            </h4>
                            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate mt-0.5 flex items-center gap-1">
                              <Building2 size={12} className="shrink-0" />
                              <span>{st.university && st.university !== 'غير محدد' ? st.university : (isAr ? 'غير محدد' : 'Not specified')}</span>
                            </p>
                          </div>
                          <button
                            type="button"
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-black transition-all shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
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
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
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
                    <span className="flex items-center gap-1.5">
                      <Building2 size={13} className="shrink-0" />
                      <span>{isAr ? `يتم الآن عرض طلاب (${currentUniversityGroup.nameAr}) فقط` : `Showing only students of (${currentUniversityGroup.nameEn})`}</span>
                    </span>
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
                    className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-bold">
                                  <GraduationCap size={11} className="shrink-0" />
                                  <span>{st.college && st.college !== 'غير محدد' ? st.college : (isAr ? 'غير محدد' : 'No col')}</span>
                                </span>
                                {showAllStudentsForCollege && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                                    <Building2 size={11} className="shrink-0" />
                                    <span>{st.university || ''}</span>
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
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={createCollegeForm.customYears === '' ? '' : createCollegeForm.customYears}
                    onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, customYears: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={createCollegeForm.customSemesters === '' ? '' : createCollegeForm.customSemesters}
                    onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, customSemesters: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Step 4: Specialization Milestone Timing */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                    {isAr ? '4. نقطة بداية التخصص الأكاديمي بالكلية' : '4. Specialization Milestone (Year & Term)'}
                  </label>
                  <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg">
                    {isAr ? 'سحب المنهج العام التأسيسي' : 'General Foundation Slice'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'يبدأ التخصص في السنة:' : 'Specialization Starts Year:'}
                    </label>
                    <select
                      value={createCollegeForm.specializationStartYear}
                      onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, specializationStartYear: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {Array.from({ length: Number(createCollegeForm.customYears) || 4 }, (_, i) => i + 1).map(y => (
                        <option key={y} value={y}>{isAr ? `السنة الدراسية ${y}` : `Year ${y}`}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      {isAr ? 'يبدأ التخصص في الترم:' : 'Specialization Starts Term:'}
                    </label>
                    <select
                      value={createCollegeForm.specializationStartSemester}
                      onChange={(e) => setCreateCollegeForm(prev => ({ ...prev, specializationStartSemester: Number(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {Array.from({ length: Number(createCollegeForm.customSemesters) || 2 }, (_, i) => i + 1).map(s => (
                        <option key={s} value={s}>{isAr ? `الفصل ${s} (الترم ${s})` : `Term ${s}`}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/40 flex items-start gap-2">
                  <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {isAr 
                      ? `سيتم سحب مواد السنوات العامة فقط السابقة لسنة ${createCollegeForm.specializationStartYear} ترم ${createCollegeForm.specializationStartSemester}. مواد التخصص اللاحقة ستُسحب في قواعد بيانات تخصصات منفصلة ولن تظهر للطالب العام إلا عند اختياره تخصصاً.` 
                      : `Only common foundation courses prior to Year ${createCollegeForm.specializationStartYear} Term ${createCollegeForm.specializationStartSemester} will be pulled.`}
                  </span>
                </p>
              </div>

              {/* Step 5: Available Years with Annual Update Note */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                    {isAr ? '5. السنين المتاحة في قاعدة البيانات حالياً' : '5. Currently Available Years in Database'}
                  </label>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                    ({isAr ? 'يتم التحديث سنوياً' : 'Updated annually'})
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Number(createCollegeForm.customYears) || 4 }, (_, i) => i + 1).map(yr => {
                    const isChecked = (createCollegeForm.availableYears || []).includes(yr);
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          const curr = createCollegeForm.availableYears || [];
                          const next = isChecked ? curr.filter(y => y !== yr) : [...curr, yr].sort((a, b) => a - b);
                          setCreateCollegeForm(prev => ({
                            ...prev,
                            availableYears: next.length > 0 ? next : [yr]
                          }));
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isChecked 
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                        }`}
                      >
                        <span>{isAr ? `السنة ${yr}` : `Year ${yr}`}</span>
                        {isChecked && <Check size={13} />}
                      </button>
                    );
                  })}
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
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
              >
                {creatingCollege ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>{isAr ? 'سحب وإنشاء الكلية للجامعة' : 'Clone & Create College'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* --- MODAL: CREATE SPECIALIZATION IN COLLEGE --- */}
      {isCreateSpecModalOpen && selectedCollegeDb && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-3xl max-h-[92vh] shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            
            {/* Header */}
            <div className="p-6 sm:p-7 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                    {isAr ? `إضافة تخصص جديد لـ ${selectedCollegeDb.collegeNameAr}` : `Add Specialization to ${selectedCollegeDb.collegeNameEn || selectedCollegeDb.collegeNameAr}`}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {isAr ? 'سحب وتخصيص المناهج والمواد من طالب مسجل بدءاً من سنة وبداية التخصص' : 'Clone specialization curriculum starting from designated year and term'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCreateSpecModalOpen(false)} 
                className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleCreateSpecialization} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
                
                {/* 1. Specialization Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                      {isAr ? 'اسم التخصص بالعربية *' : 'Specialization Name (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={specForm.specializationNameAr}
                      onChange={(e) => setSpecForm(prev => ({ ...prev, specializationNameAr: e.target.value }))}
                      onBlur={(e) => {
                        if (!specForm.specializationNameEn && e.target.value) {
                          const translated = autoTranslateCollege(e.target.value);
                          if (translated) {
                            setSpecForm(prev => ({ ...prev, specializationNameEn: translated }));
                          }
                        }
                      }}
                      placeholder={isAr ? 'مثال: هندسة الحاسبات والنظم' : 'e.g. Computer and Systems Engineering'}
                      className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black text-zinc-700 dark:text-zinc-300 mb-1.5">
                      {isAr ? 'اسم التخصص بالإنجليزية' : 'Specialization Name (English)'}
                    </label>
                    <input
                      type="text"
                      value={specForm.specializationNameEn}
                      onChange={(e) => setSpecForm(prev => ({ ...prev, specializationNameEn: e.target.value }))}
                      placeholder={isAr ? 'مثال: Computer Engineering' : 'e.g. Computer Engineering'}
                      className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* 2. Specialization Milestone Starting Point */}
                <div className="space-y-2">
                  <label className="block text-xs font-black text-zinc-900 dark:text-white">
                    {isAr ? 'نقطة بداية التخصص (السنة والترم) *' : 'Specialization Starting Point (Year & Term) *'}
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="block text-[11px] font-bold text-zinc-500 mb-1">
                        {isAr ? 'بداية من السنة:' : 'Starting Year:'}
                      </span>
                      <select
                        value={specForm.specializationStartYear}
                        onChange={(e) => setSpecForm(prev => ({ ...prev, specializationStartYear: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Array.from({ length: selectedCollegeDb.totalYears || 5 }, (_, i) => i + 1).map(y => (
                          <option key={y} value={y}>
                            {isAr ? `السنة الدراسية ${y}` : `Year ${y}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="block text-[11px] font-bold text-zinc-500 mb-1">
                        {isAr ? 'بداية من الترم:' : 'Starting Term:'}
                      </span>
                      <select
                        value={specForm.specializationStartSemester}
                        onChange={(e) => setSpecForm(prev => ({ ...prev, specializationStartSemester: Number(e.target.value) }))}
                        className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Array.from({ length: selectedCollegeDb.semestersPerYear || 2 }, (_, i) => i + 1).map(s => (
                          <option key={s} value={s}>
                            {isAr ? `الترم ${s}` : `Term ${s}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30 flex items-start gap-1.5">
                    <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      {isAr 
                        ? `المواد السابقة لسنة ${specForm.specializationStartYear} ترم ${specForm.specializationStartSemester} تُعتبر سنوات إعدادية عامة وستُدار من الكلية الرئيسية مباشرة بدون تكرار.` 
                        : `Earlier terms remain common foundation years managed by the main college.`}
                    </span>
                  </p>
                </div>

                {/* 3. Source Student Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white block">
                      {isAr ? 'اختر الطالب المراد سحب منهج التخصص منه *' : 'Select Source Student for Specialization *'}
                    </label>
                    <span className="text-xs text-zinc-400">
                      {specStudentsList.length} {isAr ? 'طالب مسجل بالكلية' : 'students in college'}
                    </span>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                    <input
                      type="text"
                      value={specStudentSearch}
                      onChange={(e) => setSpecStudentSearch(e.target.value)}
                      placeholder={isAr ? 'ابحث بالاسم، البريد، أو التخصص...' : 'Search student by name, email, or specialization...'}
                      className="w-full pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {loadingSpecStudents ? (
                    <div className="p-8 text-center text-zinc-400 flex items-center justify-center gap-2">
                      <Loader2 size={18} className="animate-spin text-blue-600" />
                      <span className="text-xs font-bold">{isAr ? 'جاري فحص طلاب الكلية...' : 'Loading candidate students...'}</span>
                    </div>
                  ) : specStudentsList.length === 0 ? (
                    <div className="p-6 text-center bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400 font-bold">
                      {isAr ? 'لم يتم العثور على طلاب مسجلين بهذه الكلية لسحب التخصص منهم' : 'No students found in this college'}
                    </div>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                      {specStudentsList
                        .filter(st => {
                          if (!specStudentSearch.trim()) return true;
                          const q = specStudentSearch.toLowerCase();
                          return (
                            (st.name || '').toLowerCase().includes(q) ||
                            (st.email || '').toLowerCase().includes(q) ||
                            (st.specialization || '').toLowerCase().includes(q)
                          );
                        })
                        .map(st => {
                          const isSelected = specForm.sourceUserId === st.userId;
                          return (
                            <div
                              key={st.userId}
                              onClick={() => handleSelectStudentForSpec(st)}
                              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-xs ring-2 ring-blue-500/20'
                                  : 'bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/60 hover:border-blue-300 dark:hover:border-blue-800'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                                }`}>
                                  {isSelected ? <Check size={18} /> : (st.name?.slice(0, 1) || 'S')}
                                </div>

                                <div className="min-w-0 flex-1 space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-black text-sm text-zinc-900 dark:text-white">
                                      {st.name}
                                    </span>
                                    {st.specialization ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-black border border-blue-200 dark:border-blue-800">
                                        <Compass size={11} />
                                        <span>{st.specialization}</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-[10px] font-medium">
                                        <span>{isAr ? 'بدون تخصص مسجل' : 'No Major'}</span>
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 break-all leading-relaxed">
                                    {st.email}
                                  </p>
                                  <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold">
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                      {st.university || (isAr ? 'جامعة غير محددة' : 'No university')}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                      {st.college || (isAr ? 'كلية غير محددة' : 'No college')}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60">
                                      {isAr
                                        ? `الترم الحالي: سنة ${st.currentYear || 1} - فصل ${st.currentSemester || 1}`
                                        : `Now: Y${st.currentYear || 1}-S${st.currentSemester || 1}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right shrink-0 space-y-1">
                                  <span className="block px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 text-[11px] font-black">
                                    {typeof st.specSubjectsCount === 'number' ? st.specSubjectsCount : (st.subjects || []).filter((x: Subject) => (x.yearIndex || 1) > Number(st.specializationStartYear || 2) || ((x.yearIndex || 1) === Number(st.specializationStartYear || 2) && (x.semesterIndex || 1) >= Number(st.specializationStartSemester || 1))).length} {isAr ? 'مادة تخصص' : 'spec subjs'}
                                  </span>
                                  <span className="block px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                                    {st.subjectsCount || st.subjects?.length || 0} {isAr ? 'إجمالي' : 'total'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* 4. Smart Slicing Live Preview */}
                {selectedStudentForSpec && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-blue-50 dark:from-blue-950/30 dark:to-blue-950/30 border border-blue-200 dark:border-blue-800/50 space-y-2 animate-in fade-in">
                    <div className="flex items-center gap-2 text-xs font-black text-blue-900 dark:text-blue-200">
                      <Sparkles size={16} className="text-blue-600 animate-pulse" />
                      <span>{isAr ? 'معاينة السحب الذكي لمنهج التخصص:' : 'Smart Slicing Live Preview:'}</span>
                    </div>

                    {(() => {
                      const startYr = Number(specForm.specializationStartYear || 1);
                      const startSm = Number(specForm.specializationStartSemester || 1);
                      const subjs = selectedStudentForSpec.subjects || [];
                      const slicedSubjs = subjs.filter((s: Subject) => 
                        (s.yearIndex || 1) > startYr || ((s.yearIndex || 1) === startYr && (s.semesterIndex || 1) >= startSm)
                      );
                      const foundationCount = subjs.length - slicedSubjs.length;

                      return (
                        <div className="text-xs space-y-1.5 pt-0.5">
                          <p className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                            <span>
                              {isAr 
                                ? `سيتم استخراج وتخصيص (${slicedSubjs.length}) مادة تبدأ من سنة ${startYr} ترم ${startSm} حتى التخرج.` 
                                : `Will extract (${slicedSubjs.length}) subjects starting from Year ${startYr} Term ${startSm}.`}
                            </span>
                          </p>
                          <p className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                            <Info size={14} className="shrink-0" />
                            <span>
                              {isAr 
                                ? `السنوات التمهيدية السابقة (${foundationCount} مادة) لن تتكرر وستبقى موحدة من قاعدة الكلية الرئيسية.` 
                                : `Earlier foundation subjects (${foundationCount}) will not be duplicated.`}
                            </span>
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}

              </div>

              {/* Modal Footer */}
              <div className="p-5 sm:p-6 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateSpecModalOpen(false)}
                  className="px-5 py-2.5 text-xs sm:text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-2xl cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creatingSpec || !specForm.specializationNameAr.trim() || !specForm.sourceUserId}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-600 hover:from-blue-700 hover:to-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-blue-500/25 transition-all cursor-pointer"
                >
                  {creatingSpec ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  <span>{isAr ? 'إنشاء وسحب التخصص الأكاديمي' : 'Create Specialization'}</span>
                </button>
              </div>
            </form>

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
                  value={structureForm.totalYears === '' ? '' : structureForm.totalYears}
                  onChange={(e) => setStructureForm({ ...structureForm, totalYears: e.target.value === '' ? '' : Number(e.target.value) })}
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
                  value={structureForm.semestersPerYear === '' ? '' : structureForm.semestersPerYear}
                  onChange={(e) => setStructureForm({ ...structureForm, semestersPerYear: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold"
                />
              </div>

              {/* Specialization Timing */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                    {isAr ? 'سنة بداية التخصص:' : 'Spec Start Year:'}
                  </label>
                  <select
                    value={structureForm.specializationStartYear}
                    onChange={(e) => setStructureForm({ ...structureForm, specializationStartYear: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold cursor-pointer"
                  >
                    {Array.from({ length: Number(structureForm.totalYears) || 4 }, (_, i) => i + 1).map(y => (
                      <option key={y} value={y}>{isAr ? `السنة ${y}` : `Year ${y}`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                    {isAr ? 'ترم بداية التخصص:' : 'Spec Start Term:'}
                  </label>
                  <select
                    value={structureForm.specializationStartSemester}
                    onChange={(e) => setStructureForm({ ...structureForm, specializationStartSemester: Number(e.target.value) })}
                    className="w-full px-4 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold cursor-pointer"
                  >
                    {Array.from({ length: Number(structureForm.semestersPerYear) || 2 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>{isAr ? `الترم ${s}` : `Term ${s}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Available Years Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    {isAr ? 'السنين المتاحة في قاعدة البيانات:' : 'Available Years in DB:'}
                  </label>
                  <span className="text-[11px] font-bold text-amber-600">
                    ({isAr ? 'يتم التحديث سنوياً' : 'Updated annually'})
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: Number(structureForm.totalYears) || 4 }, (_, i) => i + 1).map(yr => {
                    const isChecked = (structureForm.availableYears || []).includes(yr);
                    return (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => {
                          const current = structureForm.availableYears || [];
                          const next = isChecked ? current.filter(y => y !== yr) : [...current, yr].sort((a, b) => a - b);
                          setStructureForm({ ...structureForm, availableYears: next.length > 0 ? next : [yr] });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isChecked 
                            ? 'bg-amber-500 text-white border-amber-500 shadow-xs' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-amber-400'
                        }`}
                      >
                        <span>{isAr ? `السنة ${yr}` : `Year ${yr}`}</span>
                        {isChecked && <Check size={13} />}
                      </button>
                    );
                  })}
                </div>
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
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
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
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
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
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-bold">
                              <Building2 size={12} className="shrink-0" />
                              <span>{st.university && st.university !== 'غير محدد' ? st.university : (isAr ? 'غير محدد' : 'No uni')}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] font-bold">
                              <GraduationCap size={12} className="shrink-0" />
                              <span>{st.college && st.college !== 'غير محدد' ? st.college : (isAr ? 'غير محدد' : 'No col')}</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                            <BookOpen size={12} className="shrink-0" />
                            <span>{subjsCount} {isAr ? 'مواد' : 'subjs'}</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-bold">
                            <Folder size={12} className="shrink-0" />
                            <span>{filesCount} {isAr ? 'ملفات' : 'files'}</span>
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
                  className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={subjectForm.creditHours === '' ? '' : subjectForm.creditHours}
                    onChange={(e) => setSubjectForm({ ...subjectForm, creditHours: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    value={subjectForm.totalMarks === '' ? '' : subjectForm.totalMarks}
                    onChange={(e) => setSubjectForm({ ...subjectForm, totalMarks: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'السنة الدراسية' : 'Year'}
                  </label>
                  <select
                    value={subjectForm.yearIndex}
                    onChange={(e) => setSubjectForm({ ...subjectForm, yearIndex: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {visibleYearsForSelectedCollege.map(yr => (
                      <option key={yr} value={yr}>{isAr ? `السنة ${yr}` : `Year ${yr}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'الترم' : 'Semester'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedCollegeDb?.semestersPerYear || 2}
                    value={subjectForm.semesterIndex === '' ? '' : subjectForm.semesterIndex}
                    onChange={(e) => setSubjectForm({ ...subjectForm, semesterIndex: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
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
                        className="flex-1 min-w-0 px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold"
                      />
                      <input
                        type="number"
                        value={item.maxMarks === '' ? '' : item.maxMarks}
                        onChange={(e) => {
                          const updated = [...subjectForm.distributions];
                          updated[idx].maxMarks = e.target.value === '' ? ('' as any) : Number(e.target.value);
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
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md shadow-blue-500/20 cursor-pointer"
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
            <h3 className="font-black text-base text-zinc-900 dark:text-white flex items-center gap-2">
              {editingDriveItem ? <Pencil size={17} className="text-amber-500 shrink-0" /> : null}
              {editingDriveItem
                ? (isAr ? `تعديل: ${editingDriveItem.name}` : `Edit: ${editingDriveItem.name}`)
                : (isAr ? 'إضافة ملف أو مجلد في درايف الكلية' : 'Add Drive Item')}
            </h3>

            <div className="space-y-3">
              {!editingDriveItem && (
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
              )}

              {!editingDriveItem && (driveForm.type === 'file' ? (
                <div className="space-y-3">
                  {/* File Upload Dropzone */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                      {isAr ? 'اختر ملفاً حقيقياً لرفعه (PDF, Docs, Slides, صور...)' : 'Select Real File to Upload'} *
                    </label>
                    <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 rounded-2xl p-4 text-center bg-zinc-50/60 dark:bg-zinc-800/40 transition-all">
                      <input
                        type="file"
                        id="admin-drive-file-picker"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setDriveFileToUpload(file);
                            if (!driveForm.name.trim()) {
                              setDriveForm(prev => ({ ...prev, name: file.name }));
                            }
                          }
                        }}
                        className="hidden"
                      />
                      
                      {driveFileToUpload ? (
                        <div className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-blue-200 dark:border-blue-800">
                          <div className="flex items-center gap-2.5 min-w-0 text-left rtl:text-right">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                                {driveFileToUpload.name}
                              </p>
                              <p className="text-[10px] text-zinc-400 font-mono">
                                {formatSize(driveFileToUpload.size)}
                              </p>
                            </div>
                          </div>
                          
                          <label
                            htmlFor="admin-drive-file-picker"
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg cursor-pointer shrink-0"
                          >
                            {isAr ? 'تغيير' : 'Change'}
                          </label>
                        </div>
                      ) : (
                        <label
                          htmlFor="admin-drive-file-picker"
                          className="flex flex-col items-center justify-center gap-2 cursor-pointer py-3"
                        >
                          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                            <Upload size={20} />
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                              {isAr ? 'اضغط هنا لاختيار ملف من جهازك' : 'Click here to choose file from device'}
                            </p>
                            <p className="text-[11px] text-zinc-400">
                              {isAr ? 'يتم الرفع إلى سحابة Backblaze B2 مباشرة' : 'Uploads directly to Backblaze B2'}
                            </p>
                          </div>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                      {isAr ? 'اسم الملف المعروض للطلاب' : 'Displayed File Name'}
                    </label>
                    <input
                      type="text"
                      value={driveForm.name}
                      onChange={(e) => setDriveForm({ ...driveForm, name: e.target.value })}
                      placeholder={isAr ? 'اسم الملف أو المستند' : 'File Name'}
                      className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                /* Folder Creation Form */
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'اسم المجلد *' : 'Folder Name *'}
                  </label>
                  <input
                    type="text"
                    value={driveForm.name}
                    onChange={(e) => setDriveForm({ ...driveForm, name: e.target.value })}
                    placeholder={isAr ? 'مثال: محاضرات الترم الأول' : 'e.g. Lecture Slides'}
                    className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              {/* Academic phase (year / semester) — defaults to the parent
                  folder's phase, editable for every item */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'السنة الدراسية' : 'Year'}
                  </label>
                  <select
                    value={driveForm.yearIndex}
                    onChange={(e) => setDriveForm({ ...driveForm, yearIndex: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {Array.from({ length: Number(selectedCollegeDb?.totalYears) || 4 }, (_, i) => i + 1).map(y => (
                      <option key={y} value={y}>{isAr ? `السنة ${y}` : `Year ${y}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
                    {isAr ? 'الفصل الدراسي' : 'Semester'}
                  </label>
                  <select
                    value={driveForm.semesterIndex}
                    onChange={(e) => setDriveForm({ ...driveForm, semesterIndex: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {Array.from({ length: Number(selectedCollegeDb?.semestersPerYear) || 2 }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>{isAr ? `الفصل ${s}` : `Semester ${s}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setIsDriveModalOpen(false);
                  setEditingDriveItem(null);
                  setDriveFileToUpload(null);
                }}
                disabled={isUploadingDriveFile}
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              {editingDriveItem ? (
                <button
                  type="button"
                  onClick={handleUpdateDriveItem}
                  disabled={!driveForm.name.trim()}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <Pencil size={14} />
                  <span>{isAr ? 'حفظ التعديلات' : 'Save Changes'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSaveDriveItem}
                  disabled={isUploadingDriveFile || (driveForm.type === 'folder' && !driveForm.name.trim()) || (driveForm.type === 'file' && !driveFileToUpload)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 shadow-md shadow-blue-500/20"
                >
                  {isUploadingDriveFile ? <Loader2 size={14} className="animate-spin" /> : (driveForm.type === 'file' ? <Upload size={14} /> : <Plus size={14} />)}
                  <span>
                    {isUploadingDriveFile
                      ? (isAr ? 'جاري الرفع إلى B2...' : 'Uploading...')
                      : (driveForm.type === 'file' ? (isAr ? 'رفع وحفظ الملف' : 'Upload File') : (isAr ? 'إنشاء المجلد' : 'Create Folder'))}
                  </span>
                </button>
              )}
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
                    ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300'
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
                      ? 'bg-blue-50 dark:bg-blue-950 border-blue-500 text-blue-700 dark:text-blue-300'
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
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isAr ? 'نقل العنصر' : 'Move Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE COLLEGE / SPECIALIZATION MODAL --- */}
      {dbToDelete && (
        <ConfirmModal
          isOpen={true}
          title={
            dbToDelete.isSpecialization
              ? (isAr ? 'حذف قاعدة بيانات التخصص' : 'Delete Specialization Database')
              : (isAr ? 'حذف قاعدة بيانات الكلية' : 'Delete College Database')
          }
          message={
            dbToDelete.isSpecialization
              ? (isAr 
                  ? `هل أنت متأكد من حذف تخصص "${dbToDelete.specializationNameAr || dbToDelete.collegeNameAr}"؟ سيتم إلغاء ربطه وحذف كافة مواده وملفاته نهائياً من عند جميع الطلاب المستردين له فوراً.`
                  : `Delete specialization "${dbToDelete.specializationNameAr || dbToDelete.collegeNameAr}"? All specialization subjects and files will be removed from all subscribed students immediately.`)
              : (isAr 
                  ? `هل أنت متأكد من حذف كلية "${dbToDelete.collegeNameAr}" وجميع تخصصاتها؟ سيتم إلغاء ربطها وحذف موادها وملفاتها نهائياً من عند جميع الطلاب المستردين لها فوراً.` 
                  : `Delete college "${dbToDelete.collegeNameAr}" and all its specializations? All curriculum data will be removed from all subscribed students immediately.`)
          }
          onConfirm={handleDeleteDatabase}
          onCancel={() => setDbToDelete(null)}
          variant="danger"
          confirmText={isAr ? 'نعم، حذف' : 'Yes, Delete'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
        />
      )}

      {/* --- CONFIRM DELETE UNIVERSITY MODAL --- */}
      {uniToDelete && (
        <ConfirmModal
          isOpen={!!uniToDelete}
          title={isAr ? 'تأكيد حذف الجامعة وكافة كلياتها' : 'Delete University & Colleges'}
          message={isAr 
            ? `هل أنت متأكد تماماً من حذف جامعة "${uniToDelete.nameAr}" وجميع كلياتها (${uniToDelete.collegeCount} كلية) وقواعد بياناتها نهائياً؟ سيتم إلغاء ربطها وحذف موادها وملفاتها نهائياً من عند جميع الطلاب المستردين لها فوراً.`
            : `Are you sure you want to permanently delete "${uniToDelete.nameEn}" and all its (${uniToDelete.collegeCount}) colleges? All curriculum data will be removed from all subscribed students immediately.`
          }
          confirmText={isAr ? 'نعم، احذف الجامعة وكلياتها' : 'Yes, Delete University'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
          variant="danger"
          onConfirm={handleConfirmDeleteUni}
          onCancel={() => setUniToDelete(null)}
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
                    value={gradeForm.minPercentage === '' ? '' : gradeForm.minPercentage}
                    onChange={(e) => setGradeForm({ ...gradeForm, minPercentage: e.target.value === '' ? '' : Number(e.target.value) })}
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
                    value={gradeForm.points === '' ? '' : gradeForm.points}
                    onChange={(e) => setGradeForm({ ...gradeForm, points: e.target.value === '' ? '' : Number(e.target.value) })}
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
                    value={gradeForm.maxPercentage === '' ? '' : gradeForm.maxPercentage}
                    onChange={(e) => setGradeForm({ ...gradeForm, maxPercentage: e.target.value === '' ? '' : Number(e.target.value) })}
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

      {/* --- EDIT UNIVERSITY MODAL --- */}
      {isEditUniModalOpen && editingUni && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold shrink-0">
                <Edit2 size={18} />
              </div>
              <div>
                <h3 className="font-black text-base text-zinc-900 dark:text-white">
                  {isAr ? 'تعديل اسم الجامعة' : 'Edit University Name'}
                </h3>
                <p className="text-xs text-zinc-400">
                  {isAr ? 'تعديل الاسم بالعربي والإنجليزي وتحديث كافة كلياتها المرتبطة' : 'Update Arabic and English name across all colleges'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  {isAr ? 'اسم الجامعة (عربي) *' : 'University Name (Arabic) *'}
                </label>
                <input
                  type="text"
                  value={editingUni.nameAr}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditingUni({
                      ...editingUni,
                      nameAr: val,
                      nameEn: autoTranslateUniversity(val) || editingUni.nameEn
                    });
                  }}
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                  className="w-full px-4 py-2.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-xs sm:text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
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
                className="px-4 py-2 text-xs font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveEditUni}
                disabled={savingEditUni || (!editingUni.nameAr.trim() && !editingUni.nameEn.trim())}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {savingEditUni ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                <span>{isAr ? 'حفظ التعديل' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- DELETE UNIVERSITY CONFIRMATION MODAL --- */}
      {uniToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-md p-6 sm:p-7 space-y-4 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 mx-auto flex items-center justify-center shadow-md shadow-rose-500/10">
              <Trash2 size={26} />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-lg text-zinc-900 dark:text-white">
                {isAr ? 'تأكيد حذف الجامعة' : 'Confirm Delete University'}
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {isAr 
                  ? `هل أنت متأكد من حذف جامعة (${uniToDelete.nameAr})؟ سيتم أيضاً حذف كافة الكليات التابعة لها (${uniToDelete.collegeCount} كليات) وجميع موادها وقواعد بياناتها نهائياً!`
                  : `Are you sure you want to delete (${uniToDelete.nameEn || uniToDelete.nameAr}) and all its (${uniToDelete.collegeCount}) colleges permanently?`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUniToDelete(null)}
                className="px-5 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
              >
                {isAr ? 'تراجع وإلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteUni}
                disabled={deletingUni}
                className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-lg shadow-rose-500/25 cursor-pointer flex items-center gap-1.5"
              >
                {deletingUni ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                <span>{isAr ? 'نعم، احذف الجامعة وكلياتها' : 'Yes, Delete All'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRM DELETE SUBJECT IN COLLEGE TEMPLATE MODAL --- */}
      <ConfirmModal
        isOpen={!!subjectToDelete}
        title={isAr ? 'حذف المادة من قالب الكلية' : 'Delete Subject from Template'}
        message={isAr 
          ? `هل أنت متأكد من حذف مادة (${subjectToDelete?.name}) من الخطة الدراسية لقالب الكلية؟ سيتم مزامنة هذا الحذف تلقائياً للطلاب المستردين.`
          : `Are you sure you want to delete (${subjectToDelete?.name}) from this college template?`}
        confirmText={isAr ? 'نعم، احذف المادة' : 'Yes, Delete Subject'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDeleteSubject}
        onCancel={() => setSubjectToDelete(null)}
      />

      {/* --- CONFIRM DELETE DRIVE ITEM MODAL --- */}
      <ConfirmModal
        isOpen={!!driveItemToDelete}
        title={isAr ? (driveItemToDelete?.type === 'folder' ? 'حذف المجلد من الدرايف' : 'حذف الملف من الدرايف') : 'Delete Drive Item'}
        message={isAr 
          ? `هل أنت متأكد من حذف (${driveItemToDelete?.name}) من درايف الكلية؟ سيتم إزالته أيضاً من درايف الطلاب المستردين للقاعدة.`
          : `Are you sure you want to delete (${driveItemToDelete?.name})?`}
        confirmText={isAr ? 'نعم، احذف' : 'Yes, Delete'}
        cancelText={isAr ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDeleteDriveItem}
        onCancel={() => setDriveItemToDelete(null)}
      />

    </div>
  );
}
