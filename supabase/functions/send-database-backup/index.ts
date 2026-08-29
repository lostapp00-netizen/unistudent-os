// Supabase Edge Function: Automated Database Backup & Email Dispatcher
// Deno TypeScript environment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY"); // Optional: for direct Resend email delivery
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "backup@unistudent.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all database tables
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
    ]);

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
      },
      summary: {
        totalSubjects: subjectsRes.data?.length || 0,
        totalTasks: tasksRes.data?.length || 0,
        totalNotes: notesRes.data?.length || 0,
        totalFiles: filesRes.data?.length || 0,
        totalSuggestions: suggestionsRes.data?.length || 0,
      },
    };

    const reqData = await req.json().catch(() => ({}));
    const targetEmail = reqData.targetEmail || "admin@gmail.com";

    // If Resend API Key is configured, send email with JSON attachment
    if (resendApiKey) {
      const backupJsonString = JSON.stringify(backupPayload, null, 2);
      const base64Backup = btoa(unescape(encodeURIComponent(backupJsonString)));

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [targetEmail],
          subject: `UniStudent OS - Automated Weekly Database Backup (${new Date().toISOString().split("T")[0]})`,
          html: `
            <h2>UniStudent OS - Automated Database Backup</h2>
            <p>Here is your automated snapshot of all database tables.</p>
            <ul>
              <li><strong>Subjects:</strong> ${backupPayload.summary.totalSubjects}</li>
              <li><strong>Tasks:</strong> ${backupPayload.summary.totalTasks}</li>
              <li><strong>Files:</strong> ${backupPayload.summary.totalFiles}</li>
              <li><strong>Timestamp:</strong> ${backupPayload.timestamp}</li>
            </ul>
            <p>The JSON backup file is attached below for your records.</p>
          `,
          attachments: [
            {
              filename: `unistudent_backup_${new Date().toISOString().split("T")[0]}.json`,
              content: base64Backup,
            },
          ],
        }),
      });

      const emailResData = await emailResponse.json();
      return new Response(JSON.stringify({ success: true, emailResult: emailResData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Backup generated successfully",
        summary: backupPayload.summary,
        timestamp: backupPayload.timestamp,
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
