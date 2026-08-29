import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FolderPlus, Upload, FileText, Folder, Trash2, ChevronLeft, Download } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { DriveFile } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export function DriveTab() {
  const { t } = useTranslation();
  const files = useAppStore(state => state.files);
  const addFile = useAppStore(state => state.addFile);
  const deleteFile = useAppStore(state => state.deleteFile);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const currentFolder = currentFolderId ? files.find(f => f.id === currentFolderId) : null;
  const currentFiles = files.filter(f => f.parentId === currentFolderId);

  const handleCreateFolder = () => {
    const folderName = prompt(t('create_folder') + ' - Name:');
    if (!folderName) return;

    addFile({
      id: uuidv4(),
      name: folderName,
      size: 0,
      type: 'folder',
      parentId: currentFolderId,
      createdAt: new Date().toISOString().split('T')[0],
    });
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const uploadedFile = e.target.files[0];
    const fileId = uuidv4();
    const b2Path = `${fileId}_${uploadedFile.name}`;
    
    setIsUploading(true);
    try {
      // Lazy import to avoid loading S3 SDK on start
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
        b2FileId: b2Path // We store the path to delete it later
      });
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert('فشل رفع الملف. تأكد من إعدادات Backblaze. رسالة الخطأ: ' + (err.message || 'غير معروف'));
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (e: React.MouseEvent, file: DriveFile) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من الحذف؟')) return;

    if (file.type === 'file' && file.b2FileId) {
      try {
        const { deleteFromB2 } = await import('../../lib/backblaze');
        await deleteFromB2(file.b2FileId);
      } catch (err) {
        console.error('Error deleting from B2:', err);
        // Continue to delete from DB even if B2 fails, or show error
      }
    }
    deleteFile(file.id);
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
        const { openOrDownloadFile } = await import('../../lib/backblaze');
        await openOrDownloadFile(file, 'view');
      } catch (err: any) {
        console.error('Error opening file:', err);
        if (file.url) {
          window.open(file.url, '_blank');
        } else {
          alert('فشل فتح الملف للمعاينة.');
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {currentFolderId && (
            <button
              onClick={() => setCurrentFolderId(currentFolder?.parentId || null)}
              className="p-2 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h2 className="text-xl font-semibold flex items-center gap-2">
            {currentFolder ? currentFolder.name : t('drive')}
          </h2>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleCreateFolder}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-4 py-2 rounded-xl transition-colors shadow-sm"
          >
            <FolderPlus size={18} />
            {t('create_folder')}
          </button>
          <label className={`flex-1 sm:flex-none flex items-center justify-center gap-2 ${isUploading ? 'bg-zinc-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-blue-700 cursor-pointer'} text-white px-4 py-2 rounded-xl transition-colors shadow-sm`}>
            <Upload size={18} />
            {isUploading ? 'جاري الرفع...' : t('upload_file')}
            <input type="file" className="hidden" disabled={isUploading} onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {currentFiles.length === 0 ? (
          <div className="py-20 text-center text-zinc-400 flex flex-col items-center">
            <Folder size={64} className="mb-4 opacity-30 text-zinc-500" />
            <p>Folder is empty</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {currentFiles.map(file => (
              <li key={file.id} className="group flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => handleItemClick(file)}>
                <div className="flex items-center gap-4 min-w-0">
                  <div className={`p-2.5 rounded-xl ${file.type === 'folder' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                    {file.type === 'folder' ? <Folder size={24} /> : <FileText size={24} />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-white truncate">{file.name}</p>
                    <p className="text-sm text-zinc-500">{file.createdAt} {file.type === 'file' && `• ${formatSize(file.size)}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {file.type === 'file' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const { openOrDownloadFile } = await import('../../lib/backblaze');
                          await openOrDownloadFile(file, 'download');
                        } catch (err) {
                          console.error('Download error:', err);
                          if (file.url) {
                            window.open(file.url, '_blank');
                          } else {
                            alert('فشل تنزيل الملف.');
                          }
                        }
                      }}
                      className="p-2 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all rounded-xl shadow-xs"
                      title={t('download_file') || 'تنزيل'}
                    >
                      <Download size={18} />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, file)}
                    className="p-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-all rounded-xl shadow-xs"
                    title={t('delete') || 'حذف'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
