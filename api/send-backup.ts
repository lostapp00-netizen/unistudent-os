import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { targetEmail, senderEmail, appPassword, backupData } = req.body || {};

    if (!targetEmail || !targetEmail.trim()) {
      return res.status(400).json({ error: 'Target email is required.' });
    }

    // Sender credentials (from request body or server env)
    const activeSenderEmail = (senderEmail || process.env.GMAIL_SENDER_EMAIL || process.env.VITE_GMAIL_SENDER_EMAIL || '').trim();
    const activeAppPassword = (appPassword || process.env.GMAIL_APP_PASSWORD || process.env.VITE_GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');

    if (!activeSenderEmail || !activeAppPassword) {
      return res.status(400).json({ 
        error: 'بيانات بريد Gmail المرسل غير مكتملة. يرجى إدخال البريد الإلكتروني وكلمة مرور التطبيقات (App Password) المكونة من 16 حرفاً.' 
      });
    }

    // Create Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: activeSenderEmail,
        pass: activeAppPassword,
      },
    });

    const currentDate = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'short' });
    const backupJsonString = JSON.stringify(backupData || {}, null, 2);

    const summary = backupData?.summary || {
      totalStudents: backupData?.students?.length || 0,
      totalSubjects: backupData?.subjects?.length || 0,
      totalTasks: backupData?.tasks?.length || 0,
      totalNotes: backupData?.notes?.length || 0,
      totalFiles: backupData?.files?.length || 0,
    };

    // كل الجداول اللي النسخة بتحتويها — بتتعرض في الإيميل عشان الأدمن يتأكد إن
    // النسخة شاملة (بما فيها قوالب الجامعات وأنظمة الحساب GPA/النقط).
    const includedTables: string[] = Array.isArray(backupData?.includedTables) && backupData.includedTables.length > 0
      ? backupData.includedTables
      : Object.keys(backupData?.data || {});

    // HTML Email Template
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; direction: rtl; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; padding: 30px 25px; text-align: center; }
          .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
          .header p { margin: 8px 0 0; opacity: 0.9; font-size: 13px; }
          .body { padding: 25px; }
          .card { background: #f1f5f9; border-radius: 14px; padding: 18px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
          .stats-grid { display: table; width: 100%; border-collapse: separate; border-spacing: 8px; margin: 15px 0; }
          .stat-cell { display: table-cell; width: 50%; background: #ffffff; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center; }
          .stat-num { font-size: 20px; font-weight: 900; color: #4f46e5; margin: 0; }
          .stat-label { font-size: 11px; color: #64748b; margin: 3px 0 0; font-weight: bold; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
          .badge { display: inline-block; background: #ecfdf5; color: #059669; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 20px; border: 1px solid #a7f3d0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 النسخة الاحتياطية لقاعدة البيانات - UniStudent OS</h1>
            <p>${timestamp}</p>
          </div>
          <div class="body">
            <div style="text-align: center; margin-bottom: 15px;">
              <span class="badge">✓ تم إنشاء النسخة الاحتياطية بنجاح</span>
            </div>
            <p>مرحباً بك،</p>
            <p>تم استخراج النسخة الاحتياطية الشاملة لمنصة <strong>UniStudent OS</strong> بنجاح. يحتوي الملف المرفق أدناه على جميع سجلات قاعدة البيانات بصيغة JSON قابلة للاستعادة في أي وقت.</p>
            
            <div class="card">
              <h3 style="margin-top: 0; font-size: 14px; color: #334155;">📊 ملخص إحصائيات النظام:</h3>
              <table class="stats-grid">
                <tr>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalStudents || 0}</p>
                    <p class="stat-label">إجمالي الطلاب المسجلين</p>
                  </td>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalSubjects || 0}</p>
                    <p class="stat-label">إجمالي المواد الدراسية</p>
                  </td>
                </tr>
                <tr>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalTasks || 0}</p>
                    <p class="stat-label">إجمالي المهام</p>
                  </td>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalNotes || 0}</p>
                    <p class="stat-label">الملاحظات</p>
                  </td>
                </tr>
                <tr>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalFiles || 0}</p>
                    <p class="stat-label">ملفات الدرايف</p>
                  </td>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalUniversityDatabases || 0}</p>
                    <p class="stat-label">قواعد بيانات الجامعات والدفعات</p>
                  </td>
                </tr>
                <tr>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalRestoreLinks || 0}</p>
                    <p class="stat-label">روابط الاسترداد</p>
                  </td>
                  <td class="stat-cell">
                    <p class="stat-num">${summary.totalSuggestions || 0}</p>
                    <p class="stat-label">المقترحات والشكاوى</p>
                  </td>
                </tr>
              </table>
              <p style="margin: 12px 0 0; font-size: 11px; color: #64748b; line-height: 1.7;">
                النسخة شاملة كل جداول المنصة (${includedTables.length} جدول):
                ${includedTables.join(' — ')}.
                <br>
                نظام الحساب (GPA / النقط) محفوظ مع بيانات كل طالب في جدول <code>settings</code>، ومع كل قاعدة بيانات في جدول <code>university_databases</code>.
              </p>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.6;">
              🔒 <strong>تأمين البيانات:</strong> تجد ملف النسخة الكاملة مرفقاً بهذه الرسالة باسم <code>unistudent_backup_${currentDate}.json</code>. يرجى الاحتفاظ به في مكان آمن.
            </p>
          </div>
          <div class="footer">
            تم الإرسال تلقائياً بواسطة نظام النسخ الاحتياطي لمنصة UniStudent OS
          </div>
        </div>
      </body>
      </html>
    `;

    // Send Mail
    const info = await transporter.sendMail({
      from: `"UniStudent OS Backup" <${activeSenderEmail}>`,
      to: targetEmail,
      subject: `UniStudent OS - نسخة احتياطية لقاعدة البيانات (${currentDate})`,
      html: htmlContent,
      attachments: [
        {
          filename: `unistudent_database_backup_${currentDate}.json`,
          content: backupJsonString,
          contentType: 'application/json',
        },
      ],
    });

    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `تم إرسال النسخة الاحتياطية بنجاح إلى ${targetEmail}`,
    });
  } catch (error: any) {
    console.error('Error sending backup email via nodemailer:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'حدث خطأ أثناء إرسال البريد الإلكتروني.',
    });
  }
}
