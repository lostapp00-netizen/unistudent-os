import { db } from './db';
import { EmailBackupConfig } from '../types';

export interface SendBackupResult {
  success: boolean;
  message: string;
  timestamp?: string;
  error?: string;
}

/**
 * Dispatches database backup snapshot to the configured email
 */
export async function sendDatabaseBackupEmail(config: EmailBackupConfig): Promise<SendBackupResult> {
  if (!config.targetEmail || !config.targetEmail.trim()) {
    throw new Error('يرجى تحديد البريد الإلكتروني المستلم للنسخة الاحتياطية.');
  }

  if (!config.senderEmail || !config.senderEmail.trim()) {
    throw new Error('يرجى إدخال بريد Gmail المرسل في الإعدادات.');
  }

  if (!config.appPassword || !config.appPassword.trim()) {
    throw new Error('يرجى إدخال كلمة مرور تطبيقات جوجل (Google App Password) المكونة من 16 حرفاً.');
  }

  // 1. Export real database snapshot
  const backupData = await db.exportFullDatabaseBackup();

  // 2. Call backend serverless API
  try {
    const response = await fetch('/api/send-backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        targetEmail: config.targetEmail.trim(),
        senderEmail: config.senderEmail.trim(),
        appPassword: config.appPassword.trim(),
        backupData,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.success) {
      const errMsg = result.error || result.message || 'فشل إرسال الإيميل من الخادم.';
      throw new Error(errMsg);
    }

    return {
      success: true,
      message: result.message || `تم إرسال النسخة الاحتياطية بنجاح إلى ${config.targetEmail}`,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    // Check if network error (e.g. running in local Vite dev mode without Vercel serverless)
    if (err.message.includes('Failed to fetch') || err.message.includes('404')) {
      // In local dev preview where /api endpoint is not proxied, provide clear instructions
      console.warn('API /api/send-backup endpoint unreachable locally, downloading backup directly:', err);
      
      // Auto-trigger backup JSON file download locally so user still gets the file
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `unistudent_database_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        if (document.body.contains(a)) document.body.removeChild(a);
      }, 1000);

      return {
        success: true,
        message: `تم إنشاء وتحميل ملف النسخة الاحتياطية بنجاح (سيتم الإرسال التلقائي عبر Gmail بمجرد الرفع على الاستضافة).`,
        timestamp: new Date().toISOString(),
      };
    }

    throw err;
  }
}
