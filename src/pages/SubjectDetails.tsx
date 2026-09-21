import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { 
  ChevronRight, 
  ArrowLeft, 
  ArrowRight, 
  Trophy, 
  PieChart, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckSquare, 
  StickyNote, 
  ChevronLeft,
  Folder,
  FolderPlus,
  FileText,
  Upload,
  Download,
  Eye,
  Loader2,
  HardDrive,
  X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calculateSubjectGrade } from '../lib/academic';
import { GradeDistributionItem, DriveFile } from '../types';
import { DistributionItemCard } from '../components/academic/DistributionItemCard';
import { DistributionDefinitionRow } from '../components/academic/DistributionDefinitionRow';
import { ConfirmModal } from '../components/ui/CustomModal';

export function SubjectDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { subjects, tasks, notes, files, settings, updateSubject, deleteSubject, addFile, updateFile, deleteFile } = useAppStore();
  
  const subject = subjects.find(s => s.id === id);
  
  const [newDistName, setNewDistName] = useState('');
  const [newDistMarks, setNewDistMarks] = useState<number | ''>('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  // Subject Drive Explorer State
  const [currentDriveFolderId, setCurrentDriveFolderId] = useState<string | null>(null);
  const [isCreateFolderModalOpen, setIsCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [driveFileToDelete, setDriveFileToDelete] = useState<DriveFile | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState<{
    name: string;
    code: string;
    creditHours: number | '';
    totalMarks: number | '';
    yearIndex: number;
    semesterIndex: number;
  }>({
    name: '',
    code: '',
    creditHours: 3,
    totalMarks: 100,
    yearIndex: 1,
    semesterIndex: 1
  });

  if (!subject) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-zinc-700">المادة غير موجودة</h2>
        <button onClick={() => navigate('/academic')} className="mt-4 text-indigo-600 underline">العودة للجدول</button>
      </div>
    );
  }

  const distributedMarks = subject.distributions.reduce((acc, curr) => acc + curr.maxMarks, 0);
  const remainingMarks = subject.totalMarks - distributedMarks;
  
  const gradeInfo = calculateSubjectGrade(subject, settings.gradingScale);

  const handleAddDistribution = () => {
    if (!newDistName.trim()) {
      alert(isRtl ? 'يرجى إدخال اسم بند التقييم.' : 'Please enter item name.');
      return;
    }
    if (newDistMarks === '' || isNaN(Number(newDistMarks)) || Number(newDistMarks) <= 0) {
      alert(isRtl ? 'يرجى إدخال درجة صحيحة للبند (أكبر من 0).' : 'Please enter valid marks.');
      return;
    }
    if (Number(newDistMarks) > remainingMarks) {
      alert(isRtl ? `الدرجات المتبقية المتاحة هي ${remainingMarks} فقط.` : `Only ${remainingMarks} marks available.`);
      return;
    }

    const newItem: GradeDistributionItem = {
      id: uuidv4(),
      name: newDistName.trim(),
      maxMarks: Number(newDistMarks),
      achievedMarks: null,
      status: 'current'
    };

    updateSubject(subject.id, {
      distributions: [...subject.distributions, newItem]
    });
    
    setNewDistName('');
    setNewDistMarks('');
  };

  const handleRemoveDistribution = (distId: string) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.filter(d => d.id !== distId)
    });
  };

  const handleUpdateDistributionDef = (distId: string, name: string, maxMarks: number) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.map(d => 
        d.id === distId ? { ...d, name, maxMarks } : d
      )
    });
  };

  const handleUpdateAchieved = (distId: string, updates: Partial<GradeDistributionItem>) => {
    updateSubject(subject.id, {
      distributions: subject.distributions.map(d => 
        d.id === distId ? { ...d, ...updates } : d
      )
    });
  };

  const isRtl = settings.language === 'ar';
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  
  const isFinished = subject.status === 'finished';

  const toggleStatus = (newStatus: 'current' | 'finished') => {
    updateSubject(subject.id, { status: newStatus });
  };

  const handleOpenEditSubject = () => {
    setEditForm({
      name: subject.name,
      code: subject.code,
      creditHours: subject.creditHours,
      totalMarks: subject.totalMarks,
      yearIndex: subject.yearIndex,
      semesterIndex: subject.semesterIndex
    });
    setShowEditModal(true);
  };

  const handleSaveEditSubject = () => {
    if (!editForm.name.trim() || !editForm.code.trim()) {
      alert(isRtl ? 'يرجى إدخال اسم المادة وكود المادة.' : 'Please enter subject name and code.');
      return;
    }
    if (editForm.creditHours === '' || isNaN(Number(editForm.creditHours)) || Number(editForm.creditHours) <= 0) {
      alert(isRtl ? 'يرجى إدخال عدد الساعات المعتمدة بشكل صحيح (أكبر من 0).' : 'Please enter valid credit hours.');
      return;
    }
    if (editForm.totalMarks === '' || isNaN(Number(editForm.totalMarks)) || Number(editForm.totalMarks) <= 0) {
      alert(isRtl ? 'يرجى إدخال الدرجة الكلية للمادة بشكل صحيح (أكبر من 0).' : 'Please enter valid total marks.');
      return;
    }
    updateSubject(subject.id, {
      name: editForm.name.trim(),
      code: editForm.code.trim(),
      creditHours: Number(editForm.creditHours),
      totalMarks: Number(editForm.totalMarks),
      yearIndex: Number(editForm.yearIndex),
      semesterIndex: Number(editForm.semesterIndex)
    });
    setShowEditModal(false);
  };

  // Subject Drive Explorer logic
  const subjectDriveFiles = files.filter(f => f.subjectId === subject.id);
  const currentDriveFolder = currentDriveFolderId ? files.find(f => f.id === currentDriveFolderId) : null;

  const getSubjectBreadcrumbs = (id: string | null): DriveFile[] => {
    const crumbs: DriveFile[] = [];
    let curr = id ? files.find(f => f.id === id) : null;
    while (curr) {
      crumbs.unshift(curr);
      curr = curr.parentId ? files.find(f => f.id === curr!.parentId) : null;
    }
    return crumbs;
  };
  const driveBreadcrumbs = getSubjectBreadcrumbs(currentDriveFolderId);

  const displayedDriveItems = currentDriveFolderId === null
    ? subjectDriveFiles.filter(f => f.parentId === null || !subjectDriveFiles.some(parent => parent.id === f.parentId))
    : files.filter(f => f.parentId === currentDriveFolderId);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDriveItemClick = (file: DriveFile) => {
    if (file.type === 'folder') {
      setCurrentDriveFolderId(file.id);
    } else if (file.url) {
      window.open(file.url, '_blank');
    }
  };

  const handleDownloadDriveFile = async (e: React.MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    if (file.type === 'folder' || !file.url) return;
    setDownloadingFileId(file.id);
    try {
      const res = await fetch(file.url);
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed, opening directly:', err);
      window.open(file.url, '_blank');
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleCreateSubjectFolder = () => {
    if (!newFolderName.trim()) return;
    addFile({
      id: uuidv4(),
      name: newFolderName.trim(),
      size: 0,
      type: 'folder',
      parentId: currentDriveFolderId,
      createdAt: new Date().toISOString().split('T')[0],
      yearIndex: subject.yearIndex,
      semesterIndex: subject.semesterIndex,
      subjectId: subject.id
    });
    setNewFolderName('');
    setIsCreateFolderModalOpen(false);
  };

  const handleUploadSubjectFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    setUploadFileSelected(picked);
    if (picked && !uploadFileName.trim()) {
      setUploadFileName(picked.name);
    }
    e.target.value = '';
  };

  const handleUploadSubjectFile = async () => {
    if (!uploadFileSelected) return;
    const uploadedFile = uploadFileSelected;
    const fileId = uuidv4();
    const b2Path = `${fileId}_${uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const displayName = uploadFileName.trim() || uploadedFile.name;
    setIsUploading(true);
    try {
      const { uploadToB2 } = await import('../lib/backblaze');
      const publicUrl = await uploadToB2(uploadedFile, b2Path);
      addFile({
        id: fileId,
        name: displayName,
        size: uploadedFile.size,
        type: 'file',
        parentId: currentDriveFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: publicUrl,
        b2FileId: b2Path,
        yearIndex: subject.yearIndex,
        semesterIndex: subject.semesterIndex,
        subjectId: subject.id
      });
      setIsUploadModalOpen(false);
    } catch (err) {
      console.warn('B2 fallback to base64:', err);
      const reader = new FileReader();
      reader.onload = () => {
        addFile({
          id: fileId,
          name: displayName,
          size: uploadedFile.size,
          type: 'file',
          parentId: currentDriveFolderId,
          createdAt: new Date().toISOString().split('T')[0],
          url: reader.result as string,
          yearIndex: subject.yearIndex,
          semesterIndex: subject.semesterIndex,
          subjectId: subject.id
        });
      };
      reader.readAsDataURL(uploadedFile);
      setIsUploadModalOpen(false);
    } finally {
      setIsUploading(false);
      setUploadFileSelected(null);
      setUploadFileName('');
    }
  };

  return (
    <div className="flex flex-col min-h-full gap-6 pb-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <button 
            onClick={() => navigate('/academic')}
            className="p-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 mt-0.5 sm:mt-0"
          >
            <BackIcon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-100 break-words leading-snug">
              {subject.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-zinc-500 text-xs sm:text-sm mt-1.5 font-medium">
              <span className="bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-900/50">
                {subject.code}
              </span>
              <span>الساعات: <strong className="text-zinc-700 dark:text-zinc-300">{subject.creditHours}</strong></span>
              <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
              <span>الدرجة الكلية: <strong className="text-zinc-700 dark:text-zinc-300">{subject.totalMarks}</strong></span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl">
            <button 
              onClick={() => updateSubject(subject.id, { includeInGpa: subject.includeInGpa === false ? true : false })}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${subject.includeInGpa !== false ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? (subject.includeInGpa !== false ? 'متضمن في المعدل' : 'مستبعد من المعدل') : (subject.includeInGpa !== false ? 'Included in GPA' : 'Excluded from GPA')}
            </button>
            <div className="w-px bg-zinc-200 dark:bg-zinc-700 mx-0.5 my-1.5"></div>
            <button 
              onClick={() => toggleStatus('current')}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${!isFinished ? 'bg-white dark:bg-zinc-900 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? 'حالي' : 'Current'}
            </button>
            <button 
              onClick={() => toggleStatus('finished')}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${isFinished ? 'bg-emerald-500 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
            >
              {isRtl ? 'نهائي' : 'Final'}
            </button>
          </div>

          <button
            onClick={handleOpenEditSubject}
            className="p-2 sm:p-2.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-bold"
            title={isRtl ? 'تعديل بيانات المادة' : 'Edit Subject'}
          >
            <Edit2 size={16} />
            <span className="inline">{isRtl ? 'تعديل' : 'Edit'}</span>
          </button>

          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 sm:p-2.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl transition-all shadow-xs flex items-center gap-1.5 text-xs sm:text-sm font-bold cursor-pointer"
            title={isRtl ? 'حذف المادة' : 'Delete Subject'}
          >
            <Trash2 size={16} />
            <span className="inline">{isRtl ? 'حذف' : 'Delete'}</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Grade Distribution Manager */}
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <PieChart className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold">{t('distributions')}</h2>
            </div>
            
            <div className="mb-6 flex flex-col sm:flex-row gap-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
              <div className="flex-1 min-w-0">
                <input 
                  type="text" 
                  disabled={isFinished}
                  placeholder={isRtl ? 'اسم بند التقييم (مثلاً: ميدترم، أعمال سنة)...' : 'Distribution name (e.g. Midterm)...'}
                  value={newDistName}
                  onChange={e => setNewDistName(e.target.value)}
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 sm:w-32 sm:flex-none">
                  <input 
                    type="number" 
                    min="1"
                    disabled={isFinished}
                    placeholder={isRtl ? 'الدرجة' : 'Marks'}
                    value={newDistMarks}
                    onChange={e => setNewDistMarks(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 text-center font-bold"
                  />
                </div>
                <button 
                  onClick={handleAddDistribution}
                  disabled={remainingMarks === 0 || isFinished || !newDistName.trim() || !newDistMarks}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl transition-colors font-bold text-sm flex-shrink-0 shadow-sm"
                  title={isRtl ? 'إضافة بند التقييم' : 'Add Distribution'}
                >
                  <Plus className="w-5 h-5" />
                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {subject.distributions.map(dist => (
                <DistributionDefinitionRow
                  key={dist.id}
                  distribution={dist}
                  isSubjectFinished={isFinished}
                  remainingMarks={remainingMarks}
                  onUpdate={handleUpdateDistributionDef}
                  onDelete={handleRemoveDistribution}
                  isRtl={isRtl}
                />
              ))}
              {subject.distributions.length === 0 && (
                <div className="text-center py-4 text-zinc-400 text-sm">لم يتم إضافة بنود لتوزيع الدرجات.</div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-sm font-medium">
              <span className="text-zinc-500">{t('remaining_marks')}:</span>
              <span className={`text-lg font-black ${remainingMarks > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                {remainingMarks}
              </span>
            </div>
          </div>
        </div>

        {/* Achievements / Marks Entry */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-xl font-bold">{t('achievements')}</h2>
              </div>
              
              <div className="space-y-4">
                {subject.distributions.map(dist => (
                  <DistributionItemCard
                    key={dist.id}
                    distribution={dist}
                    isSubjectFinished={isFinished}
                    onUpdate={handleUpdateAchieved}
                    isRtl={isRtl}
                  />
                ))}
                {subject.distributions.length === 0 && (
                  <div className="text-center py-4 text-zinc-500 text-sm">
                    {isRtl ? 'يجب إضافة توزيع درجات أولاً.' : 'Add grade distributions first.'}
                  </div>
                )}
              </div>
              
              <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-center">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">{t('current_grade')}</p>
                  {gradeInfo ? (
                    <div>
                      <div className="text-4xl font-black text-amber-500">{gradeInfo.letter}</div>
                      <div className="text-sm text-zinc-500 mt-1">{gradeInfo.totalAchieved} / {subject.totalMarks} ({gradeInfo.percentage.toFixed(1)}%)</div>
                    </div>
                  ) : (
                    <div className="text-2xl font-bold text-zinc-400">--</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

  
        <div className="md:col-span-12 mt-4 space-y-6">
          {/* Linked Tasks and Notes */}
          <div>
            <h2 className="text-xl font-bold mb-4">{settings.language === 'ar' ? 'المهام والملاحظات المربوطة' : 'Linked Tasks & Notes'}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tasks */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><CheckSquare className="text-indigo-500" /> {t('tasks')}</h3>
                <div className="space-y-3">
                  {tasks.filter(t => t.linkedSubjectIds?.includes(subject.id)).map(task => (
                    <div key={task.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <div className="flex justify-between items-start">
                        <h4 className={`font-medium ${task.isCompleted ? 'line-through text-zinc-500' : ''}`}>{task.title}</h4>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${task.priority === 'high' ? 'bg-rose-100 text-rose-700' : task.priority === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.date && <p className="text-xs text-zinc-500 mt-1">{task.date}</p>}
                    </div>
                  ))}
                  {tasks.filter(t => t.linkedSubjectIds?.includes(subject.id)).length === 0 && (
                    <p className="text-sm text-zinc-500 italic">{settings.language === 'ar' ? 'لا توجد مهام' : 'No tasks'}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><StickyNote className="text-amber-500" /> {t('notes')}</h3>
                <div className="space-y-3">
                  {notes.filter(n => n.linkedSubjectIds?.includes(subject.id)).map(note => (
                    <div key={note.id} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      <h4 className="font-medium">{note.title}</h4>
                      <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{note.content}</p>
                    </div>
                  ))}
                  {notes.filter(n => n.linkedSubjectIds?.includes(subject.id)).length === 0 && (
                    <p className="text-sm text-zinc-500 italic">{settings.language === 'ar' ? 'لا توجد ملاحظات' : 'No notes'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Subject Drive Section (Hierarchical Folder & File Explorer) */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-sm border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {isRtl ? 'درايف المادة (المجلدات والملفات)' : 'Subject Drive (Folders & Files)'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isRtl 
                      ? `استعراض وتصفح كافة الملازم والمجلدات التابعة لمادة (${subject.name})` 
                      : `Browse and manage all files & folders for (${subject.name})`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setNewFolderName(''); setIsCreateFolderModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200/60 dark:border-blue-800/40 transition-all cursor-pointer shadow-2xs"
                >
                  <FolderPlus size={14} />
                  <span>{isRtl ? 'مجلد جديد' : 'New Folder'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setUploadFileSelected(null); setUploadFileName(''); setIsUploadModalOpen(true); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all cursor-pointer shadow-sm"
                >
                  <Upload size={14} />
                  <span>{isRtl ? 'رفع ملف' : 'Upload File'}</span>
                </button>
              </div>
            </div>

            {/* Breadcrumb Path inside Subject */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 text-xs font-bold text-zinc-500 hide-scrollbar">
              <button
                type="button"
                onClick={() => setCurrentDriveFolderId(null)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                  currentDriveFolderId === null
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <HardDrive size={13} />
                <span>{isRtl ? 'المجلد الرئيسي للمادة' : 'Subject Root'}</span>
              </button>

              {driveBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === driveBreadcrumbs.length - 1;
                return (
                  <React.Fragment key={crumb.id}>
                    <ChevronRight size={13} className={`text-zinc-400 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
                    <button
                      type="button"
                      onClick={() => setCurrentDriveFolderId(crumb.id)}
                      className={`px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer shrink-0 truncate max-w-[160px] ${
                        isLast
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      {crumb.name}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Folder / File Grid / List */}
            {displayedDriveItems.length === 0 ? (
              <div className="py-14 text-center text-zinc-400 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6 space-y-2">
                <Folder size={44} className="mx-auto opacity-20 text-blue-500" />
                <p className="font-bold text-sm text-zinc-700 dark:text-zinc-300">
                  {isRtl ? 'لا توجد ملفات أو مجلدات في هذا المجلد حالياً.' : 'No files or folders in this folder yet.'}
                </p>
                <p className="text-xs text-zinc-400">
                  {isRtl ? 'يمكنك رفع ملازم، ملخصات، أو إنشاء مجلدات فرعية للمادة.' : 'Upload summaries, books, or create subfolders for this subject.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {displayedDriveItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleDriveItemClick(item)}
                    className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400/60 dark:hover:border-blue-500/40 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        item.type === 'folder'
                          ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60'
                          : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
                      }`}>
                        {item.type === 'folder' ? <Folder size={20} /> : <FileText size={20} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          {item.type === 'folder' 
                            ? (isRtl ? 'مجلد' : 'Folder') 
                            : formatSize(item.size)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-200/60 dark:border-zinc-700/50" onClick={e => e.stopPropagation()}>
                      {item.type === 'file' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDriveItemClick(item)}
                            className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 rounded-lg transition-colors cursor-pointer"
                            title={isRtl ? 'معاينة في المتصفح' : 'Preview'}
                          >
                            <Eye size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDownloadDriveFile(e, item)}
                            disabled={downloadingFileId === item.id}
                            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer"
                            title={isRtl ? 'تنزيل' : 'Download'}
                          >
                            {downloadingFileId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setDriveFileToDelete(item)}
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer"
                        title={isRtl ? 'حذف' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Subject Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
            <h2 className="text-2xl font-bold mb-6">
              {isRtl ? 'تعديل بيانات المادة' : 'Edit Subject Details'}
            </h2>
            <div className="overflow-y-auto pr-2 space-y-4 flex-1 hide-scrollbar">
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_name')}</label>
                <input 
                  type="text" 
                  value={editForm.name} 
                  onChange={e => setEditForm({...editForm, name: e.target.value})} 
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('subject_code')}</label>
                <input 
                  type="text" 
                  value={editForm.code} 
                  onChange={e => setEditForm({...editForm, code: e.target.value})} 
                  className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('year')}</label>
                  <select 
                    value={editForm.yearIndex} 
                    onChange={e => setEditForm({...editForm, yearIndex: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: settings.totalYears }).map((_, i) => (
                      <option key={i} value={i + 1}>{t('year')} {i + 1}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('semester')}</label>
                  <select 
                    value={editForm.semesterIndex} 
                    onChange={e => setEditForm({...editForm, semesterIndex: Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {Array.from({ length: settings.semestersPerYear }).map((_, i) => (
                      <option key={i} value={i + 1}>{t('semester')} {i + 1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('credit_hours')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={editForm.creditHours === '' ? '' : editForm.creditHours} 
                    onChange={e => setEditForm({...editForm, creditHours: e.target.value === '' ? '' : Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('total_marks')}</label>
                  <input 
                    type="number" 
                    min="1" 
                    value={editForm.totalMarks === '' ? '' : editForm.totalMarks} 
                    onChange={e => setEditForm({...editForm, totalMarks: e.target.value === '' ? '' : Number(e.target.value)})} 
                    className="w-full border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-2 bg-transparent outline-none focus:ring-2 focus:ring-indigo-500" 
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setShowEditModal(false)} 
                className="flex-1 px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleSaveEditSubject} 
                className="flex-1 px-4 py-2 rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium"
              >
                {isRtl ? 'حفظ التعديلات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Subject Folder Modal */}
      {isCreateFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <FolderPlus className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate">
                  {isRtl ? `إنشاء مجلد داخل (${subject.name})` : `New Folder in (${subject.name})`}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                  {isRtl ? 'اسم المجلد' : 'Folder name'}
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={isRtl ? 'مثلاً: محاضرات، شيتات، ملازم...' : 'e.g. Lectures, Summaries...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                {isRtl
                  ? `سيتم ربط هذا المجلد ومحتوياته تلقائياً بمادة ${subject.name} وتظهر في الدرايف وبصفحة المادة.`
                  : `This folder will be automatically linked to ${subject.name}.`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setIsCreateFolderModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateSubjectFolder}
                disabled={!newFolderName.trim()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FolderPlus size={14} />
                <span>{isRtl ? 'إنشاء' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File to Subject Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate">
                  {isRtl ? `رفع ملف لمادة (${subject.name})` : `Upload File to (${subject.name})`}
                </h3>
              </div>
              <button
                onClick={() => { setIsUploadModalOpen(false); setUploadFileSelected(null); }}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <input
                ref={uploadInputRef}
                type="file"
                className="hidden"
                onChange={handleUploadSubjectFilePicked}
              />
              <div className="flex items-center gap-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-2">
                <div className="flex-1 min-w-0 text-xs px-1">
                  {uploadFileSelected ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                      <FileText size={13} className="shrink-0" />
                      <span className="truncate">
                        {uploadFileSelected.name} • {(uploadFileSelected.size / 1024).toFixed(0)} KB
                      </span>
                    </span>
                  ) : (
                    <span className="text-zinc-400 font-bold">
                      {isRtl ? 'لم يتم اختيار أي ملف' : 'No file chosen'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="shrink-0 px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  {isRtl ? 'اختيار ملف' : 'Choose file'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                  {isRtl ? 'اسم الملف' : 'File name'}
                </label>
                <input
                  type="text"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder={isRtl ? 'اكتب اسم الملف...' : 'File name...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => { setIsUploadModalOpen(false); setUploadFileSelected(null); }}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleUploadSubjectFile}
                disabled={!uploadFileSelected || isUploading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{isUploading ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : (isRtl ? 'رفع الملف' : 'Upload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Drive File / Folder in Subject Modal */}
      <ConfirmModal
        isOpen={!!driveFileToDelete}
        title={driveFileToDelete?.type === 'folder' ? (isRtl ? 'حذف المجلد' : 'Delete Folder') : (isRtl ? 'حذف الملف' : 'Delete File')}
        message={driveFileToDelete?.type === 'folder' 
          ? (isRtl ? `هل أنت متأكد من حذف المجلد "${driveFileToDelete?.name}" وجميع محتوياته؟` : `Delete folder "${driveFileToDelete?.name}"?`) 
          : (isRtl ? `هل أنت متأكد من حذف الملف "${driveFileToDelete?.name}" نهائياً؟` : `Permanently delete file "${driveFileToDelete?.name}"?`)}
        confirmText={isRtl ? 'نعم، احذف' : 'Yes, Delete'}
        cancelText={isRtl ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (driveFileToDelete) {
            deleteFile(driveFileToDelete.id);
            if (currentDriveFolderId === driveFileToDelete.id) {
              setCurrentDriveFolderId(null);
            }
            setDriveFileToDelete(null);
          }
        }}
        onCancel={() => setDriveFileToDelete(null)}
      />

      {/* In-app confirmation modal for deleting subject */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={isRtl ? 'حذف المادة الدراسية' : 'Delete Subject'}
        message={isRtl ? `هل أنت متأكد من حذف مادة (${subject?.name})؟ سيتم حذف كافة التقييمات والدرجات المرتبطة بها والعودة لقائمة المواد.` : `Are you sure you want to delete (${subject?.name})? All marks will be removed.`}
        confirmText={isRtl ? 'نعم، احذف المادة' : 'Yes, Delete'}
        cancelText={isRtl ? 'تراجع' : 'Cancel'}
        variant="danger"
        onConfirm={() => {
          if (subject) {
            deleteSubject(subject.id);
            setIsDeleteModalOpen(false);
            navigate('/academic/subjects');
          }
        }}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
