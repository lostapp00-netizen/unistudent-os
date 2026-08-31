import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  FolderPlus, 
  Upload, 
  FileText, 
  Folder, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  Download, 
  Move, 
  FolderInput, 
  ExternalLink,
  Eye,
  Home,
  Check,
  X
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DriveFile } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { ConfirmModal, PromptModal } from '../ui/CustomModal';

export function DriveTab() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const files = useAppStore(state => state.files);
  const addFile = useAppStore(state => state.addFile);
  const updateFile = useAppStore(state => state.updateFile);
  const deleteFile = useAppStore(state => state.deleteFile);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const [fileToMove, setFileToMove] = useState<DriveFile | null>(null);
  const [selectedDestinationFolderId, setSelectedDestinationFolderId] = useState<string | null>(null);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const uploadedFile = e.target.files[0];
    const fileId = uuidv4();
    const b2Path = `${fileId}_${uploadedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    
    setIsUploading(true);
    try {
      const { uploadToB2 } = await import('../../lib/backblaze');
      const publicUrl = await uploadToB2(uploadedFile, b2Path);
      
      addFile({
        id: fileId,
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: 'file',
        parentId: currentFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: publicUrl,
        b2FileId: b2Path
      });
    } catch (err: any) {
      console.warn('B2 upload fallback to local URL:', err);
      // Fallback local blob URL
      const localUrl = URL.createObjectURL(uploadedFile);
      addFile({
        id: fileId,
        name: uploadedFile.name,
        size: uploadedFile.size,
        type: 'file',
        parentId: currentFolderId,
        createdAt: new Date().toISOString().split('T')[0],
        url: localUrl
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    const file = fileToDelete;

    if (file.type === 'folder') {
      const descendantIds = getAllDescendantIds(file.id, files);
      [file.id, ...descendantIds].forEach(id => deleteFile(id));
    } else {
      if (file.b2FileId) {
        try {
          const { deleteFromB2 } = await import('../../lib/backblaze');
          await deleteFromB2(file.b2FileId);
        } catch (err) {}
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
      if (file.url) {
        window.open(file.url, '_blank');
      } else {
        try {
          const { openOrDownloadFile } = await import('../../lib/backblaze');
          await openOrDownloadFile(file, 'view');
        } catch (err: any) {
          alert(isAr ? 'لا يوجد رابط مباشر لهذا الملف.' : 'No direct preview URL for this file.');
        }
      }
    }
  };

  const handleDownload = async (e: React.MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    if (!file.url) {
      try {
        const { openOrDownloadFile } = await import('../../lib/backblaze');
        await openOrDownloadFile(file, 'download');
      } catch (err) {
        alert(isAr ? 'فشل تحميل الملف.' : 'Failed to download file.');
      }
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.open(file.url, '_blank');
    }
  };

  // Available move destinations (excluding the item itself and any descendant folders)
  const invalidFolderIds = fileToMove 
    ? new Set([fileToMove.id, ...(fileToMove.type === 'folder' ? getAllDescendantIds(fileToMove.id, files) : [])])
    : new Set<string>();

  const availableFolders = files.filter(f => f.type === 'folder' && !invalidFolderIds.has(f.id));

  // Build folder hierarchy display path
  const getFolderPath = (folder: DriveFile): string => {
    const parts = [folder.name];
    let curr = folder.parentId ? files.find(f => f.id === folder.parentId) : null;
    while (curr) {
      parts.unshift(curr.name);
      curr = curr.parentId ? files.find(f => f.id === curr!.parentId) : null;
    }
    return parts.join(' / ');
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
                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 shadow-2xs'
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
                    ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50 shadow-2xs'
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
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs"
          >
            <FolderPlus size={16} className="text-purple-600 dark:text-purple-400" />
            <span>{isAr ? 'إنشاء مجلد' : 'Create Folder'}</span>
          </button>

          <label className={`flex-1 sm:flex-none flex items-center justify-center gap-2 ${
            isUploading ? 'bg-zinc-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 cursor-pointer text-white'
          } px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shadow-xs`}>
            <Upload size={16} />
            <span>{isUploading ? (isAr ? 'جاري الرفع...' : 'Uploading...') : (isAr ? 'رفع ملف' : 'Upload File')}</span>
            <input type="file" className="hidden" disabled={isUploading} onChange={handleFileUpload} />
          </label>
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
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200/60 dark:border-purple-800/40' 
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60'
                  }`}>
                    {file.type === 'folder' ? <Folder size={22} /> : <FileText size={22} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
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
                    onClick={() => {
                      setFileToMove(file);
                      setSelectedDestinationFolderId(file.parentId);
                    }}
                    className="p-2 text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 dark:hover:text-purple-400 border border-zinc-200 dark:border-zinc-700/60 rounded-xl transition-all shadow-2xs"
                    title={isAr ? 'نقل إلى مجلد آخر' : 'Move to another folder'}
                  >
                    <Move size={15} />
                  </button>

                  {/* Preview / View in Browser */}
                  {file.type === 'file' && (
                    <button
                      onClick={() => handleItemClick(file)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all rounded-xl shadow-2xs"
                      title={isAr ? 'معاينة في المتصفح' : 'Preview'}
                    >
                      <Eye size={15} />
                    </button>
                  )}

                  {/* Download Button */}
                  {file.type === 'file' && (
                    <button
                      onClick={(e) => handleDownload(e, file)}
                      className="p-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all rounded-xl shadow-2xs"
                      title={isAr ? 'تنزيل الملف' : 'Download'}
                    >
                      <Download size={15} />
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => setFileToDelete(file)}
                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-2xs"
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

      {/* Move / Transfer Modal */}
      {fileToMove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <FolderInput className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="font-bold text-base text-zinc-900 dark:text-white">
                  {isAr ? 'نقل العنصر:' : 'Move Item:'} <span className="text-purple-600">{fileToMove.name}</span>
                </h3>
              </div>
              <button 
                onClick={() => setFileToMove(null)} 
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 block">
                {isAr ? 'اختر مجلد الوجهة للنقل:' : 'Select Destination Folder:'}
              </label>

              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {/* Root Destination Option */}
                <div
                  onClick={() => setSelectedDestinationFolderId(null)}
                  className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                    selectedDestinationFolderId === null
                      ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold shadow-xs'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <Home size={15} />
                    <span>{isAr ? 'الدرايف الرئيسي (المستوى الأول)' : 'Root Drive'}</span>
                  </div>
                  {selectedDestinationFolderId === null && <Check size={16} className="text-purple-600" />}
                </div>

                {/* Subfolder Destinations */}
                {availableFolders.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedDestinationFolderId(f.id)}
                    className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                      selectedDestinationFolderId === f.id
                        ? 'border-purple-600 bg-purple-50/70 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold shadow-xs'
                        : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs truncate">
                      <Folder size={15} className="shrink-0 text-purple-500" />
                      <span className="truncate">{getFolderPath(f)}</span>
                    </div>
                    {selectedDestinationFolderId === f.id && <Check size={16} className="text-purple-600 shrink-0" />}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setFileToMove(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleConfirmMove}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs"
              >
                {isAr ? 'نقل إلى هنا' : 'Move Here'}
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

