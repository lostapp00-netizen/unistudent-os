import React, { useState } from 'react';
import { FileText, Download, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { EntityAttachment } from '../../types';

interface AttachmentBadgeProps {
  attachment: EntityAttachment | { id: string; name: string; url?: string; b2FileId?: string; size?: number };
  variant?: 'compact' | 'card';
  className?: string;
}

export function AttachmentBadge({ attachment, variant = 'compact', className = '' }: AttachmentBadgeProps) {
  const { settings } = useAppStore();
  const isAr = settings.language === 'ar';
  
  const [isOpening, setIsOpening] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleOpen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpening(true);
    try {
      const { openOrDownloadFile } = await import('../../lib/backblaze');
      await openOrDownloadFile(attachment, 'view');
    } catch (err: any) {
      console.error('Error viewing attachment:', err);
      if (attachment.url) {
        window.open(attachment.url, '_blank');
      } else {
        alert(isAr ? 'تعذر فتح الملف للمعاينة.' : 'Failed to open file for preview.');
      }
    } finally {
      setIsOpening(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDownloading(true);
    try {
      const { openOrDownloadFile } = await import('../../lib/backblaze');
      await openOrDownloadFile(attachment, 'download');
    } catch (err: any) {
      console.error('Error downloading attachment:', err);
      if (attachment.url) {
        window.open(attachment.url, '_blank');
      } else {
        alert(isAr ? 'تعذر تنزيل الملف.' : 'Failed to download file.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      className={`inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 px-2.5 py-1 rounded-xl transition-all border border-zinc-200 dark:border-zinc-700 shadow-2xs group ${className}`}
    >
      <button
        type="button"
        onClick={handleOpen}
        disabled={isOpening}
        className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        title={isAr ? `معاينة: ${attachment.name}` : `Preview: ${attachment.name}`}
      >
        {isOpening ? (
          <Loader2 size={12} className="animate-spin text-indigo-500 flex-shrink-0" />
        ) : (
          <FileText size={12} className="text-indigo-500 flex-shrink-0" />
        )}
        <span className="truncate max-w-[130px] sm:max-w-[160px] text-left rtl:text-right">{attachment.name}</span>
      </button>

      <div className="h-3 w-px bg-zinc-300 dark:bg-zinc-700 mx-0.5" />

      <button
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        className="p-1 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
        title={isAr ? 'تنزيل الملف' : 'Download file'}
      >
        {isDownloading ? (
          <Loader2 size={12} className="animate-spin text-indigo-600 dark:text-indigo-400" />
        ) : (
          <Download size={12} />
        )}
      </button>
    </div>
  );
}
