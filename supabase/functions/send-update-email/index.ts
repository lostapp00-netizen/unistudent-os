// Supabase Edge Function: send-update-email
//
// Sends the database-update notices to the students as email, at the same moment
// the notice reaches their in-app bell. The notice text is used verbatim (it is
// exactly what the site shows), while the framing — greeting, labels, footer —
// follows the language the student picked on the site (settings.language).
//
// Sending uses the same channels as the backup mail:
//   · Resend  → when a key is available (body or RESEND_API_KEY secret)
//   · Gmail   → when a sender + app password are available (body, as the admin
//               panel already sends them for backups, or the GMAIL_* secrets)
//
// Body:
//   notificationIds: string[]   the approved notices to email (required)
//   siteUrl?: string            link used by the button (defaults to the app URL)
//   senderName?: string         friendly sender name
//   senderEmail?: string        Gmail sender (admin's email settings)
//   appPassword?: string        Gmail app password
//   resendApiKey?: string       Resend key, when that channel is used
//   dryRun?: boolean            render the emails and return them without sending
//   testRecipient?: string      send every email to this address instead (testing)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const DEFAULT_SITE_URL = "https://unistudent-os.vercel.app";
const BRAND = "UniStudent OS";

type Lang = "ar" | "en";

/** Everything the email says around the notice text itself. */
const I18N: Record<Lang, {
  dir: "rtl" | "ltr";
  subject: (n: number) => string;
  eyebrow: string;
  greeting: (name: string) => string;
  intro: string;
  introOne: string;
  cardTitle: string;
  cta: string;
  footerWhy: string;
  footerDatabase: string;
  footerAuto: string;
  kind: Record<string, string>;
}> = {
  ar: {
    dir: "rtl",
    subject: (n) => (n > 1 ? `تحديثات جديدة في قاعدة بيانات كليتك (${n})` : "تحديث جديد في قاعدة بيانات كليتك"),
    eyebrow: "جرس الإشعارات · UniStudent OS",
    greeting: (name) => (name ? `أهلاً ${name}،` : "أهلاً بيك،"),
    intro: "في تحديثات جديدة في قاعدة بيانات كليتك:",
    introOne: "في تحديث جديد في قاعدة بيانات كليتك:",
    cardTitle: "ملخص التحديث",
    cta: "افتح UniStudent OS",
    footerWhy: "وصلتك الرسالة دي لأن كليتك مربوطة بقاعدة بيانات على UniStudent OS.",
    footerDatabase: "قاعدة البيانات",
    footerAuto: "رسالة تلقائية — مش محتاجة رد.",
    kind: { add: "إضافة", update: "تعديل", delete: "حذف", rename: "تغيير اسم", full_sync: "مزامنة" },
  },
  en: {
    dir: "ltr",
    subject: (n) => (n > 1 ? `${n} new updates in your college database` : "New update in your college database"),
    eyebrow: "Notification bell · UniStudent OS",
    greeting: (name) => (name ? `Hi ${name},` : "Hi there,"),
    intro: "There are new updates in your college database:",
    introOne: "There is a new update in your college database:",
    cardTitle: "Update summary",
    cta: "Open UniStudent OS",
    footerWhy: "You received this because your college is linked to a database on UniStudent OS.",
    footerDatabase: "Database",
    footerAuto: "Automatic message — no reply needed.",
    kind: { add: "Added", update: "Updated", delete: "Deleted", rename: "Renamed", full_sync: "Synced" },
  },
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ACCENTS: Record<string, { bg: string; fg: string; border: string }> = {
  add: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  delete: { bg: "#fff1f2", fg: "#be123c", border: "#fecdd3" },
  rename: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
  update: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
};

/** One notice, rendered as a card — same wording the app shows in the bell. */
function noticeCard(notice: any, lang: Lang): string {
  const t = I18N[lang];
  const accent = ACCENTS[notice.type] || { bg: "#f4f4f5", fg: "#3f3f46", border: "#e4e4e7" };
  const kind = t.kind[notice.type] || "";
  const when = notice.created_at
    ? new Date(notice.created_at).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">
      <tr>
        <td style="background:#ffffff;border:1px solid #e4e4e7;border-${lang === "ar" ? "right" : "left"}:4px solid ${accent.fg};border-radius:14px;padding:16px 18px;">
          ${kind ? `<span style="display:inline-block;background:${accent.bg};color:${accent.fg};border:1px solid ${accent.border};border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;">${escapeHtml(kind)}</span>` : ""}
          <p style="margin:10px 0 6px;font-size:15px;font-weight:800;color:#18181b;line-height:1.5;">${escapeHtml(notice.title)}</p>
          ${notice.message ? `<p style="margin:0;font-size:13px;color:#3f3f46;line-height:1.8;">${escapeHtml(notice.message)}</p>` : ""}
          ${when ? `<p style="margin:10px 0 0;font-size:11px;color:#a1a1aa;">${escapeHtml(when)}</p>` : ""}
        </td>
      </tr>
    </table>`;
}

/** The whole email for one student: their language, their name, their notices. */
function renderEmail(opts: {
  lang: Lang;
  studentName: string;
  databaseLabel: string;
  notices: any[];
  siteUrl: string;
}): { html: string; subject: string } {
  const { lang, studentName, databaseLabel, notices, siteUrl } = opts;
  const t = I18N[lang];
  const subject = t.subject(notices.length);
  const cards = notices.map((n) => noticeCard(n, lang)).join("");

  const html = `<!DOCTYPE html>
<html dir="${t.dir}" lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#18181b;direction:${t.dir};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e4e4e7;">
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5 0%,#2563eb 100%);padding:28px 24px;text-align:center;">
              <p style="margin:0;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:.2px;">${BRAND}</p>
              <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,.85);">${escapeHtml(t.eyebrow)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 24px 8px;">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;">${escapeHtml(t.greeting(studentName.trim()))}</p>
              <p style="margin:0 0 18px;font-size:13px;color:#52525b;line-height:1.8;">${escapeHtml(notices.length > 1 ? t.intro : t.introOne)}</p>
              ${cards}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 24px 26px;" align="center">
              <a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;padding:12px 26px;border-radius:14px;">${escapeHtml(t.cta)}</a>
            </td>
          </tr>
          <tr>
            <td style="background:#fafafa;border-top:1px solid #f4f4f5;padding:18px 24px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;color:#71717a;line-height:1.7;">${escapeHtml(t.footerWhy)}</p>
              ${databaseLabel ? `<p style="margin:0 0 6px;font-size:11px;color:#52525b;font-weight:700;">${escapeHtml(t.footerDatabase)}: ${escapeHtml(databaseLabel)}</p>` : ""}
              <p style="margin:0;font-size:10px;color:#a1a1aa;">${escapeHtml(t.footerAuto)} · ${BRAND}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { html, subject };
}

const databaseLabelOf = (row: any): string =>
  [row?.college_name_ar || row?.college_name_en || row?.university_name_ar || row?.university_name_en, row?.cohort_name]
    .filter(Boolean)
    .join(" — ");

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const body = await req.json().catch(() => ({}));

    const ids: string[] = Array.from(new Set((body.notificationIds || []).filter(Boolean)));
    if (ids.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "notificationIds is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteUrl: string = (body.siteUrl || DEFAULT_SITE_URL).replace(/\/+$/, "");
    const senderName: string = body.senderName || BRAND;
    const senderEmail: string = (body.senderEmail || Deno.env.get("GMAIL_SENDER_EMAIL") || Deno.env.get("SENDER_EMAIL") || "").trim();
    const appPassword: string = (body.appPassword || Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
    const resendApiKey: string = (body.resendApiKey || Deno.env.get("RESEND_API_KEY") || "").trim();
    const dryRun: boolean = Boolean(body.dryRun);
    const testRecipient: string = (body.testRecipient || "").trim();

    const useResend = resendApiKey.startsWith("re_");
    const useGmail = !useResend && Boolean(senderEmail && appPassword);
    if (!dryRun && !useResend && !useGmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "no_email_transport",
          message:
            "مفيش وسيلة إرسال متظبطة: ضيف مفتاح Resend أو بريد Gmail وكلمة مرور التطبيقات في إعدادات النسخ الاحتياطي، أو حدّد RESEND_API_KEY على السيرفر.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. The notices that were just approved — the same rows the bell shows.
    const { data: notices, error: noticesError } = await supabase
      .from("student_notifications")
      .select("id, title, message, type, scope, audience, university_database_id, review_state, created_at, deleted_at")
      .in("id", ids)
      .is("deleted_at", null);
    if (noticesError) throw noticesError;

    const emailable = (notices || []).filter(
      (n: any) => n.scope === "database" && n.audience === "database" && n.university_database_id && n.review_state === "approved"
    );
    if (emailable.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, skipped: ids.length, message: "nothing to email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Recipients per database: the students whose site is linked to it.
    const dbIds = Array.from(new Set(emailable.map((n: any) => n.university_database_id)));
    const { data: databases } = await supabase
      .from("university_databases")
      .select("id, college_name_ar, college_name_en, university_name_ar, university_name_en, cohort_name")
      .in("id", dbIds);
    const dbById = new Map((databases || []).map((d: any) => [d.id, d]));

    const { data: students, error: studentsError } = await supabase
      .from("settings")
      .select("user_id, name, email, language, university_database_id, specialization_database_id")
      .or(dbIds.map((id) => `university_database_id.eq.${id},specialization_database_id.eq.${id}`).join(","));
    if (studentsError) throw studentsError;

    // One email per student: all their notices for this database, in one message.
    const perStudent = new Map<string, { email: string; name: string; lang: Lang; dbId: string; notices: any[] }>();
    for (const student of students || []) {
      const email = String(student.email || "").trim();
      if (!email) continue;
      for (const notice of emailable) {
        if (
          student.university_database_id !== notice.university_database_id &&
          student.specialization_database_id !== notice.university_database_id
        ) continue;
        const key = `${student.user_id}`;
        const entry = perStudent.get(key) || {
          email,
          name: String(student.name || "").trim(),
          lang: (String(student.language || "ar").startsWith("en") ? "en" : "ar") as Lang,
          dbId: notice.university_database_id,
          notices: [],
        };
        if (!entry.notices.some((n) => n.id === notice.id)) entry.notices.push(notice);
        perStudent.set(key, entry);
      }
    }

    const messages = Array.from(perStudent.values()).map((entry) => {
      const { html, subject } = renderEmail({
        lang: entry.lang,
        studentName: entry.name,
        databaseLabel: databaseLabelOf(dbById.get(entry.dbId)),
        notices: entry.notices,
        siteUrl,
      });
      return { ...entry, html, subject, to: testRecipient || entry.email };
    });

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          transport: useResend ? "resend" : useGmail ? "gmail" : "none",
          recipients: messages.length,
          emails: messages.map((m) => ({ to: m.to, language: m.lang, subject: m.subject, notices: m.notices.length, html: m.html })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Send — small batches so a Gmail account is not throttled.
    let transporter: any = null;
    if (useGmail) {
      const nodemailer = (await import("npm:nodemailer@6.9.16")).default;
      transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: senderEmail, pass: appPassword },
      });
    }

    const sendOne = async (message: (typeof messages)[number]): Promise<{ ok: boolean; error?: string }> => {
      try {
        if (useResend) {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
            body: JSON.stringify({
              from: `${senderName} <${senderEmail || "onboarding@resend.dev"}>`,
              to: [message.to],
              subject: message.subject,
              html: message.html,
            }),
          });
          if (!response.ok) return { ok: false, error: `${response.status} ${(await response.text()).slice(0, 200)}` };
          return { ok: true };
        }
        await transporter.sendMail({
          from: `"${senderName}" <${senderEmail}>`,
          to: message.to,
          subject: message.subject,
          html: message.html,
        });
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err?.message || String(err) };
      }
    };

    const results: Array<{ to: string; language: Lang; notices: number; ok: boolean; error?: string }> = [];
    const batchSize = 5;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      const settled = await Promise.all(batch.map(sendOne));
      batch.forEach((message, index) => {
        results.push({
          to: message.to,
          language: message.lang,
          notices: message.notices.length,
          ok: settled[index].ok,
          ...(settled[index].error ? { error: settled[index].error } : {}),
        });
      });
    }

    const sent = results.filter((r) => r.ok).length;
    return new Response(
      JSON.stringify({
        success: sent > 0 || messages.length === 0,
        transport: useResend ? "resend" : "gmail",
        recipients: messages.length,
        sent,
        failed: results.length - sent,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-update-email failed:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
