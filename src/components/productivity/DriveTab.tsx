import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FolderPlus, 
  Upload, 
  FileText, 
  Folder, 
  FolderOpen,
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Download, 
  Move, 
  FolderInput, 
  ExternalLink,
  Eye,
  Home,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DriveFile } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmModal, PromptModal } from '../ui/CustomModal';

// Recursive Tree Node for Destination Folders
function FolderTreeItem({
  folder,
  level,
  allAvailableFolders,
  selectedId,
  onSelect,
  expandedIds,
  onToggleExpand,
  isAr
}: {
  folder: DriveFile;
  level: number;
  allAvailableFolders: DriveFile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  isAr: boolean;
}) {
  const children = allAvailableFolders.filter(f => f.parentId === folder.id);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(folder.id);
  const isSelected = selectedId === folder.id;

  const ChevronIcon = isExpanded 
    ? ChevronDown 
    : (isAr ? ChevronLeft : ChevronRight);

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
          isSelected
            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
            : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
        }`}
        style={{
          marginInlineStart: `${level * 16}px`
        }}
        onClick={() => onSelect(folder.id)}
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Expand/Collapse Arrow Button */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(folder.id);
              }}
              className="p-1 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              title={isExpanded ? (isAr ? 'طي المجلدات' : 'Collapse') : (isAr ? 'فتح المجلدات الفرعية' : 'Expand')}
            >
              <ChevronIcon size={14} />
            </button>
          ) : (
            <span className="w-6 shrink-0" />
          )}

          {isExpanded ? (
            <FolderOpen size={16} className="text-blue-500 shrink-0" />
          ) : (
            <Folder size={16} className="text-blue-500 shrink-0" />
          )}

          <span className="text-xs truncate font-medium">{folder.name}</span>
          {hasChildren && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 font-bold">
              {children.length}
            </span>
          )}
        </div>

        {isSelected && <Check size={16} className="text-blue-600 shrink-0 mr-1 rtl:mr-0 rtl:ml-1" />}
      </div>

      {/* Render subfolders if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-1 relative border-s-2 border-blue-200/60 dark:border-blue-900/40 ms-4 ps-1">
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              allAvailableFolders={allAvailableFolders}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              isAr={isAr}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DriveTab() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const files = useAppStore(state => state.files);
  const settings = useAppStore(state => state.settings);
  const addFile = useAppStore(state => state.addFile);
  const updateFile = useAppStore(state => state.updateFile);
  const deleteFile = useAppStore(state => state.deleteFile);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [fileToMove, setFileToMove] = useState<DriveFile | null>(null);
  const [selectedDestinationFolderId, setSelectedDestinationFolderId] = useState<string | null>(null);
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());

  const currentFolder = currentFolderId ? files.find(f => f.id === currentFolderId) : null;
  const currentFiles = files.filter(f => f.parentId === currentFolderId);

  // Breadcrumbs
  const getBreadcrumbs = (id: string | null): DriveFile[] => {
    const crumbs: DriveFile[] = [];
    let curr = id ? files.find(f => f.id === id) : null;
    while (curr) {
      crumbs.unshift(curr);
      curr = curr.parentId ? files.find(f => f.id === curr!.parentId) : null;
    }
    return crumbs;
  };
  const breadcrumbs = getBreadcrumbs(currentFolderId);

  // Recursive descendants
  const getAllDescendantIds = (folderId: string, allFiles: DriveFile[]): string[] => {
    const children = allFiles.filter(f => f.parentId === folderId);
    let ids = children.map(c => c.id);
    children.filter(c => c.type === 'folder').forEach(c => {
      ids = [...ids, ...getAllDescendantIds(c.id, allFiles)];
    });
    return ids;
  };

  const handleCreateFolder = (folderName: string) => {
    if (!folderName.trim()) return;
    addFile({
      id: uuidv4(),
      name: folderName.trim(),
      size: 0,
      type: 'folder',
      parentId: currentFolderId,
      createdAt: new Date().toISOString().split('T')[0],
    });
    setIsFolderModalOpen(false);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ name: '', yearIndex: '1', semesterIndex: '1' });
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // Current year/semester marked in Settings (Semesters Manager)
  const currentSemesterInfo = (settings.semesters || []).find(s => s.isCurrent);
  const totalYears = Number(settings.totalYears) || 4;
  const semestersPerYear = Number(settings.semestersPerYear) || 2;

  const openUploadModal = () => {
    setUploadFileSelected(null);
    setUploadForm({
      name: '',
      yearIndex: String(currentSemesterInfo?.yearIndex || 1),
      semesterIndex: String(currentSemesterInfo?.semesterIndex || 1)
    });
    setIsUploadModalOpen(true);
  };

  const handleUploadFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] || null;
    setUploadFileSelected(picked);
    if (picked && !uploadForm.name.trim()) {
      setUploadForm(prev => ({ ...prev, name: picked.name }));
    }
    e.target.value = '';
  };

  const confirmUpload = async () => {
    if (!uploadFileSelected) return;

    const uploadedFile = uploadFileSelected;
    const fileId = uuidv4();
    const b2Path = `${fileId}_${uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const displayName = uploadForm.name.trim() || uploadedFile.name;
    const yearIdx = Number(uploadForm.yearIndex) || 1;
    const semIdx = Number(uploadForm.semesterIndex) || 1;

    setIsUploading(true);
    try {
      const { uploadToB2 } = await import('../../lib/backblaze');
      const publicUrl = await uploadToB2(uploadedFile, b2Path);

      addFile({
        id: fileId,
        name: displayName,
        size: uploadedFile.size,
        type: 'file',
        parentId: currentFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: publicUrl,
        b2FileId: b2Path,
        yearIndex: yearIdx,
        semesterIndex: semIdx
      });
      setIsUploadModalOpen(false);
    } catch (err: any) {
      console.warn('B2 upload fallback to persistent base64 URL:', err);
      // Persistent base64 data URL fallback
      const reader = new FileReader();
      reader.onload = () => {
        const base64Url = reader.result as string;
        addFile({
          id: fileId,
          name: displayName,
          size: uploadedFile.size,
          type: 'file',
          parentId: currentFolderId,
          createdAt: new Date().toISOString().split('T')[0],
          url: base64Url,
          yearIndex: yearIdx,
          semesterIndex: semIdx
        });
      };
      reader.readAsDataURL(uploadedFile);
      setIsUploadModalOpen(false);
    } finally {
      setIsUploading(false);
      setUploadFileSelected(null);
    }
  };

  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const file = fileToDelete;

    if (file.type === 'folder') {
      const descendantIds = getAllDescendantIds(file.id, files);
      const allTargetIds = [file.id, ...descendantIds];
      const descendantFiles = files.filter(f => allTargetIds.includes(f.id) && f.type === 'file');
      
      try {
        const { deleteMultipleFromB2, extractB2KeyFromUrl } = await import('../../lib/backblaze');
        const b2Keys = descendantFiles.map(f => f.b2FileId || extractB2KeyFromUrl(f.url)).filter(Boolean);
        if (b2Keys.length > 0) {
          await deleteMultipleFromB2(b2Keys);
        }
      } catch (err) {
        console.error('Error batch deleting folder files from B2:', err);
      }

      allTargetIds.forEach(id => deleteFile(id));
    } else {
      const b2Key = file.b2FileId || (file.url ? (await import('../../lib/backblaze')).extractB2KeyFromUrl(file.url) : null);
      if (b2Key) {
        try {
          const { deleteFromB2 } = await import('../../lib/backblaze');
          await deleteFromB2(b2Key);
        } catch (err) {
          console.error('Error deleting single file from B2:', err);
        }
      }
      deleteFile(file.id);
    }
    setFileToDelete(null);
  };

  const handleConfirmMove = () => {
    if (!fileToMove) return;
    updateFile(fileToMove.id, { parentId: selectedDestinationFolderId });
    setFileToMove(null);
    setSelectedDestinationFolderId(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleItemClick = async (file: DriveFile) => {
    if (file.type === 'folder') {
      setCurrentFolderId(file.id);
    } else {
      try {
        const { previewFile } = await import('../../lib/backblaze');
        await previewFile(file);
      } catch (err) {
        console.error('Error previewing file:', err);
        if (file.url) {
          window.open(file.url, '_blank');
        } else {
          alert(isAr ? 'لا يوجد رابط متاح لاستعراض هذا الملف.' : 'No preview URL available for this file.');
        }
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    try {
      setDownloadingFileId(file.id);
      const { downloadFile } = await import('../../lib/backblaze');
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

  // Available move destinations (excluding the item itself and any descendant folders)
  const invalidFolderIds = fileToMove 
    ? new Set([fileToMove.id, ...(fileToMove.type === 'folder' ? getAllDescendantIds(fileToMove.id, files) : [])])
    : new Set<string>();

  const availableFolders = files.filter(f => f.type === 'folder' && !invalidFolderIds.has(f.id));
  const rootFolders = availableFolders.filter(f => !f.parentId);

  const toggleFolderExpand = (folderId: string) => {
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const openMoveModal = (file: DriveFile) => {
    setFileToMove(file);
    setSelectedDestinationFolderId(file.parentId);
    // Expand the current destination folder's parents by default
    const ancestors = new Set<string>();
    let curr = file.parentId ? files.find(f => f.id === file.parentId) : null;
    while (curr) {
      ancestors.add(curr.id);
      curr = curr.parentId ? files.find(f => f.id === curr!.parentId) : null;
    }
    setExpandedFolderIds(ancestors);
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Breadcrumbs Navigation */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentFolderId(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              currentFolderId === null
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-2xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Home size={14} />
            <span>{isAr ? 'الدرايف الرئيسي' : 'Root Drive'}</span>
          </button>

          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.id}>
              <span className="text-zinc-300 dark:text-zinc-700">/</span>
              <button
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  idx === breadcrumbs.length - 1
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <FolderPlus size={16} className="text-blue-600 dark:text-blue-400" />
            <span>{isAr ? 'إنشاء مجلد' : 'Create Folder'}</span>
          </button>

          <button
            onClick={openUploadModal}
            disabled={isUploading}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 ${
              isUploading ? 'bg-zinc-400 cursor-not-allowed text-white' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 cursor-pointer text-white shadow-md shadow-blue-500/25'
            } px-4 py-2.5 rounded-2xl text-xs font-bold transition-all`}>
            {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            <span>{isUploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'رفع ملف' : 'Upload File')}</span>
          </button>
        </div>
      </div>

      {/* Files & Folders List */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {currentFiles.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 flex flex-col items-center">
            <Folder size={56} className="mb-3 opacity-25 text-zinc-500" />
            <p className="font-bold text-sm text-zinc-500 dark:text-zinc-400">{isAr ? 'هذا المجلد فارغ حالياً' : 'This folder is empty'}</p>
            <p className="text-xs text-zinc-400 mt-1">{isAr ? 'يمكنك رفع ملفات أو إنشاء مجلدات فرعية.' : 'Upload files or create subfolders.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
            {currentFiles.map(file => (
              <li 
                key={file.id} 
                className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" 
                onClick={() => handleItemClick(file)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-3 rounded-2xl ${
                    file.type === 'folder' 
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/40' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60'
                  }`}>
                    {file.type === 'folder' ? <Folder size={22} /> : <FileText size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {file.name}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {file.createdAt} {file.type === 'file' && `• ${formatSize(file.size)}`}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* Transfer / Move Button */}
                  <button
                    onClick={() => openMoveModal(file)}
                    className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 dark:hover:text-blue-400 border border-zinc-200 dark:border-zinc-700/60 rounded-xl transition-all shadow-2xs cursor-pointer"
                    title={isAr ? 'نقل إلى مجلد آخر' : 'Move to another folder'}
                  >
                    <Move size={15} />
                  </button>

                  {/* Preview / View in Browser */}
                  {file.type === 'file' && (
                    <button
                      onClick={() => handleItemClick(file)}
                      className="p-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all rounded-xl shadow-2xs cursor-pointer"
                      title={isAr ? 'معاينة في المتصفح' : 'Preview'}
                    >
                      <Eye size={15} />
                    </button>
                  )}

                  {/* Download Button */}
                  {file.type === 'file' && (
                    <button
                      onClick={(e) => handleDownload(e, file)}
                      disabled={downloadingFileId === file.id}
                      className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-50 transition-all rounded-xl shadow-2xs cursor-pointer"
                      title={isAr ? 'تنزيل الملف' : 'Download'}
                    >
                      {downloadingFileId === file.id ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => setFileToDelete(file)}
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

      {/* Hierarchical Move / Transfer Modal with Expandable Folder Tree */}
      {fileToMove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-lg w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2 min-w-0">
                <FolderInput className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white truncate">
                  {isAr ? 'نقل العنصر:' : 'Move Item:'} <span className="text-blue-600">{fileToMove.name}</span>
                </h3>
              </div>
              <button 
                onClick={() => setFileToMove(null)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-500 block">
                  {isAr ? 'اختر مجلد الوجهة (اضغط على السهم لفتح المجلدات الفرعية):' : 'Select Destination (click arrow to expand subfolders):'}
                </label>
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {/* Root Destination Option */}
                <div
                  onClick={() => setSelectedDestinationFolderId(null)}
                  className={`p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedDestinationFolderId === null
                      ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-6 shrink-0" />
                    <Home size={16} className="text-blue-600" />
                    <span>{isAr ? 'الدرايف الرئيسي (المستوى الأول)' : 'Root Drive (Top Level)'}</span>
                  </div>
                  {selectedDestinationFolderId === null && <Check size={16} className="text-blue-600 shrink-0" />}
                </div>

                {/* Recursive Expandable Subfolders Tree */}
                {rootFolders.map(f => (
                  <FolderTreeItem
                    key={f.id}
                    folder={f}
                    level={0}
                    allAvailableFolders={availableFolders}
                    selectedId={selectedDestinationFolderId}
                    onSelect={setSelectedDestinationFolderId}
                    expandedIds={expandedFolderIds}
                    onToggleExpand={toggleFolderExpand}
                    isAr={isAr}
                  />
                ))}

                {rootFolders.length === 0 && availableFolders.length === 0 && (
                  <p className="text-center py-6 text-xs text-zinc-400">
                    {isAr ? 'لا توجد مجلدات أخرى متاحة للنقل إليها.' : 'No other folders available.'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-[11px] text-zinc-400 truncate">
                {isAr ? 'الوجهة المحددة: ' : 'Selected: '}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {selectedDestinationFolderId === null 
                    ? (isAr ? 'الدرايف الرئيسي' : 'Root Drive')
                    : (files.find(f => f.id === selectedDestinationFolderId)?.name || '')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFileToMove(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  onClick={handleConfirmMove}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer"
                >
                  {isAr ? 'نقل إلى هنا' : 'Move Here'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  {isAr ? 'رفع ملف جديد' : 'Upload New File'}
                </h3>
              </div>
              <button
                onClick={() => !isUploading && setIsUploadModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                  {isAr ? 'اختر الملف من جهازك' : 'Pick a file from your device'}
                </label>
                <input
                  ref={uploadInputRef}
                  type="file"
                  onChange={handleUploadFilePicked}
                  className="w-full text-xs text-zinc-600 dark:text-zinc-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 dark:file:bg-blue-950/40 file:text-blue-600 dark:file:text-blue-300 file:cursor-pointer cursor-pointer bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700"
                />
                {uploadFileSelected && (
                  <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1.5">
                    <FileText size={12} className="shrink-0" />
                    <span className="truncate">{uploadFileSelected.name} • {(uploadFileSelected.size / 1024).toFixed(0)} KB</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                  {isAr ? 'اسم الملف' : 'File name'}
                </label>
                <input
                  type="text"
                  value={uploadForm.name}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={isAr ? 'اكتب اسم الملف...' : 'File name...'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                    {isAr ? 'السنة الدراسية' : 'Year'}
                  </label>
                  <select
                    value={uploadForm.yearIndex}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, yearIndex: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    {Array.from({ length: totalYears }, (_, i) => i + 1).map(y => (
                      <option key={y} value={y}>{isAr ? `السنة ${y}` : `Year ${y}`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1.5">
                    {isAr ? 'الفصل الدراسي' : 'Semester'}
                  </label>
                  <select
                    value={uploadForm.semesterIndex}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, semesterIndex: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
                  >
                    {Array.from({ length: semestersPerYear }, (_, i) => i + 1).map(s => (
                      <option key={s} value={s}>{isAr ? `الفصل ${s}` : `Semester ${s}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmUpload}
                disabled={!uploadFileSelected || isUploading}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white transition-all shadow-md shadow-blue-500/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{isUploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'رفع الملف' : 'Upload')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      <PromptModal
        isOpen={isFolderModalOpen}
        title={isAr ? 'إنشاء مجلد جديد' : 'Create New Folder'}
        placeholder={isAr ? 'اسم المجلد...' : 'Folder name...'}
        confirmText={isAr ? 'إنشاء' : 'Create'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        onConfirm={handleCreateFolder}
        onCancel={() => setIsFolderModalOpen(false)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!fileToDelete}
        title={fileToDelete?.type === 'folder' ? (isAr ? 'حذف المجلد' : 'Delete Folder') : (isAr ? 'حذف الملف' : 'Delete File')}
        message={fileToDelete?.type === 'folder' 
          ? (isAr ? `هل أنت متأكد من حذف المجلد "${fileToDelete?.name}" وجميع محتوياته؟` : `Delete folder "${fileToDelete?.name}" and all its contents?`) 
          : (isAr ? `هل أنت متأكد من حذف الملف "${fileToDelete?.name}" نهائياً؟` : `Permanently delete file "${fileToDelete?.name}"?`)}
        confirmText={isAr ? 'نعم، حذف' : 'Delete'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setFileToDelete(null)}
      />
    </div>
  );
}


