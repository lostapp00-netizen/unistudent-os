// Supabase Edge Function: Automated Database Backup & Email Dispatcher
// Deno TypeScript environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    // Parse request body
    const reqData = await req.json().catch(() => ({}));
    const targetEmail = reqData.targetEmail || "admin@gmail.com";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || reqData.resendApiKey || "re_test_backup";
    const senderEmail = Deno.env.get("SENDER_EMAIL") || reqData.senderEmail || "lastimpro351@gmail.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch all database tables & auth users
    const [
      settingsRes,
      subjectsRes,
      tasksRes,
      notesRes,
      appointmentsRes,
      scheduleRes,
      groupsRes,
      filesRes,
      suggestionsRes,
      authUsersRes,
    ] = await Promise.all([
      supabase.from("settings").select("*"),
      supabase.from("subjects").select("*"),
      supabase.from("tasks").select("*"),
      supabase.from("notes").select("*"),
      supabase.from("appointments").select("*"),
      supabase.from("schedule_items").select("*"),
      supabase.from("groups").select("*"),
      supabase.from("drive_files").select("*"),
      supabase.from("suggestions").select("*"),
      supabase.auth.admin.listUsers().catch(() => ({ data: { users: [] } })),
    ]);

    const realAuthUsers = (authUsersRes?.data?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email || "",
      created_at: u.created_at || "",
      last_sign_in_at: u.last_sign_in_at || "",
    }));

    const backupPayload = {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: "production",
      data: {
        settings: settingsRes.data || [],
        subjects: subjectsRes.data || [],
        tasks: tasksRes.data || [],
        notes: notesRes.data || [],
        appointments: appointmentsRes.data || [],
        schedule_items: scheduleRes.data || [],
        groups: groupsRes.data || [],
        drive_files: filesRes.data || [],
        suggestions: suggestionsRes.data || [],
        auth_users: realAuthUsers,
      },
      summary: {
        totalSettings: settingsRes.data?.length || 0,
        totalSubjects: subjectsRes.data?.length || 0,
        totalTasks: tasksRes.data?.length || 0,
        totalNotes: notesRes.data?.length || 0,
        totalAppointments: appointmentsRes.data?.length || 0,
        totalSchedule: scheduleRes.data?.length || 0,
        totalFiles: filesRes.data?.length || 0,
        totalSuggestions: suggestionsRes.data?.length || 0,
      },
    };

    const backupJsonString = JSON.stringify(backupPayload, null, 2);

    // 2. If Resend API Key is available, dispatch email
    let emailSent = false;
    let emailResponseData = null;

    if (resendApiKey && resendApiKey.startsWith("re_") && resendApiKey !== "re_test_backup") {
      try {
        const base64Backup = btoa(unescape(encodeURIComponent(backupJsonString)));
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `UniStudent OS <${senderEmail}>`,
            to: [targetEmail],
            subject: `UniStudent OS - Automated Database Backup (${new Date().toISOString().split("T")[0]})`,
            html: `
              <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                <h2 style="color: #6366f1;">UniStudent OS - Automated Database Backup</h2>
                <p>Hello Administrator,</p>
                <p>This is your automated system database backup snapshot generated on <strong>${new Date().toUTCString()}</strong>.</p>
                <div style="background: #f4f4f5; padding: 15px; border-radius: 10px; margin: 15px 0;">
                  <h4 style="margin-top: 0;">Backup Data Summary:</h4>
                  <ul>
                    <li><strong>Students / Settings:</strong> ${backupPayload.summary.totalSettings}</li>
                    <li><strong>Subjects:</strong> ${backupPayload.summary.totalSubjects}</li>
                    <li><strong>Tasks:</strong> ${backupPayload.summary.totalTasks}</li>
                    <li><strong>Notes:</strong> ${backupPayload.summary.totalNotes}</li>
                    <li><strong>Drive Files:</strong> ${backupPayload.summary.totalFiles}</li>
                    <li><strong>Feedback / Complaints:</strong> ${backupPayload.summary.totalSuggestions}</li>
                  </ul>
                </div>
                <p>The complete backup JSON is attached to this email.</p>
              </div>
            `,
            attachments: [
              {
                filename: `unistudent_backup_${new Date().toISOString().split("T")[0]}.json`,
                content: base64Backup,
              },
            ],
          }),
        });

        emailResponseData = await emailResponse.json();
        emailSent = emailResponse.ok;
      } catch (err: any) {
        console.error("Resend error:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        emailResponse: emailResponseData,
        message: emailSent
          ? `Backup successfully emailed to ${targetEmail}`
          : "Backup generated successfully (No active Resend API key configured for direct SMTP)",
        summary: backupPayload.summary,
        timestamp: backupPayload.timestamp,
        backup: backupPayload,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
