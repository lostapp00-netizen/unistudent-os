import React, { useState } from 'react';
import { Paperclip, X, Loader2, File, Eye, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { EntityAttachment } from '../../types';

interface LocalAttachmentUploaderProps {
  attachments: EntityAttachment[];
  onChange: (attachments: EntityAttachment[]) => void;
}

export function LocalAttachmentUploader({ attachments, onChange }: LocalAttachmentUploaderProps) {
  const { t } = useTranslation();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const uploadedFile = e.target.files[0];
    const fileId = uuidv4();
    const b2Path = `attachments/${fileId}_${uploadedFile.name}`;
    
    setIsUploading(true);
    try {
      const { uploadToB2 } = await import('../../lib/backblaze');
      const publicUrl = await uploadToB2(uploadedFile, b2Path);
      
      const newAttachment: EntityAttachment = {
        id: fileId,
        name: uploadedFile.name,
        size: uploadedFile.size,
        url: publicUrl,
        b2FileId: b2Path
      };

      onChange([...attachments, newAttachment]);
    } catch (err: any) {
      console.error('Error uploading attachment:', err);
      alert('فشل رفع المرفق. تأكد من إعدادات Backblaze. ' + (err.message || ''));
    } finally {
      setIsUploading(false);
      e.target.value = ''; // reset input
    }
  };

  const handleRemove = async (attachmentId: string, b2FileId?: string) => {
    if (b2FileId) {
      try {
        const { deleteFromB2 } = await import('../../lib/backblaze');
        await deleteFromB2(b2FileId);
      } catch (err) {
        console.error('Error deleting attachment from B2:', err);
      }
    }
    onChange(attachments.filter(a => a.id !== attachmentId));
  };

  const handleView = async (att: EntityAttachment) => {
    try {
      const { openOrDownloadFile } = await import('../../lib/backblaze');
      await openOrDownloadFile(att, 'view');
    } catch (err) {
      if (att.url) window.open(att.url, '_blank');
      else alert('تعذر فتح الملف للمعاينة.');
    }
  };

  const handleDownload = async (att: EntityAttachment) => {
    try {
      const { openOrDownloadFile } = await import('../../lib/backblaze');
      await openOrDownloadFile(att, 'download');
    } catch (err) {
      if (att.url) window.open(att.url, '_blank');
      else alert('تعذر تنزيل الملف.');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col gap-3">
      {/* List of attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-col gap-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                <File size={16} className="text-zinc-400 flex-shrink-0" />
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">{att.name}</span>
                <span className="text-xs text-zinc-500 whitespace-nowrap">({formatSize(att.size)})</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 mr-2 rtl:mr-0 rtl:ml-2">
                <button
                  type="button"
                  onClick={() => handleView(att)}
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
                  title="معاينة"
                >
                  <Eye size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  className="p-1.5 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer"
                  title="تنزيل"
                >
                  <Download size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(att.id, att.b2FileId)}
                  className="p-1.5 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer"
                  title="حذف"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      <div className="relative">
        <input 
          type="file"
          id="attachment-upload"
          className="hidden"
          onChange={handleFileUpload}
          disabled={isUploading}
        />
        <label 
          htmlFor="attachment-upload"
          className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed rounded-xl text-sm font-medium transition-colors ${
            isUploading 
              ? 'border-zinc-300 text-zinc-400 cursor-not-allowed bg-zinc-50' 
              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 cursor-pointer dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/20'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>جاري الرفع...</span>
            </>
          ) : (
            <>
              <Paperclip size={16} />
              <span>إضافة مرفق جديد</span>
            </>
          )}
        </label>
      </div>
    </div>
  );
}
