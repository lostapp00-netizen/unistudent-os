// Supabase Edge Function: hard-delete files from Backblaze B2 (server-side).
// The browser cannot always reach B2 directly (CORS restrictions on DELETE),
// so deletion runs here with the B2 master keys from secrets.
//
// Required secrets (supabase secrets set ...):
//   B2_KEY_ID          — B2 keyID (application key ID)
//   B2_APPLICATION_KEY — B2 application key
//   B2_BUCKET_ID       — bucket ID (optional; resolved by name if omitted)
//   B2_BUCKET_NAME     — bucket name (used only to resolve the ID)
//
// Body: { paths: string[] } — B2 object keys (or full URLs; keys are normalized).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/** Strips bucket/endpoint prefixes from a URL and returns the clean object key. */
function normalizeKey(raw: string, bucketName: string): string {
  let key = String(raw || "").trim();
  if (key.startsWith("/")) key = key.slice(1);
  if (/^https?:\/\//i.test(key)) {
    try {
      const urlObj = new URL(key);
      const parts = decodeURIComponent(urlObj.pathname).split("/").filter(Boolean);
      const bucketLower = (bucketName || "").toLowerCase();
      if (bucketLower && parts[0]?.toLowerCase() === bucketLower) parts.shift();
      else if (bucketLower && parts[0]?.toLowerCase() === "file" && parts[1]?.toLowerCase() === bucketLower) {
        parts.shift();
        parts.shift();
      }
      key = parts.join("/");
    } catch {
      // keep raw key as-is
    }
  }
  return key;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const keyId = Deno.env.get("B2_KEY_ID") || Deno.env.get("B2_APPLICATION_KEY_ID");
    const appKey = Deno.env.get("B2_APPLICATION_KEY");
    let bucketId = Deno.env.get("B2_BUCKET_ID");
    const bucketName = Deno.env.get("B2_BUCKET_NAME") || "";

    if (!keyId || !appKey) {
      return new Response(
        JSON.stringify({ success: false, error: "B2 credentials are not configured (B2_KEY_ID / B2_APPLICATION_KEY secrets)." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const reqData = await req.json().catch(() => ({}));
    const rawPaths: string[] = Array.isArray(reqData.paths) ? reqData.paths : [];
    if (rawPaths.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No paths provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authorize against B2
    const authRes = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
      headers: { Authorization: "Basic " + btoa(`${keyId}:${appKey}`) },
    });
    if (!authRes.ok) {
      const text = await authRes.text();
      return new Response(
        JSON.stringify({ success: false, error: `B2 authorization failed: ${text}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const auth = await authRes.json();
    const storageApi = auth.apiInfo?.storageApi || {};
    const apiUrl: string = storageApi.apiUrl || auth.apiUrl;
    const authToken: string = auth.authorizationToken;

    // 2. Resolve bucketId by name when the secret is not set
    if (!bucketId) {
      if (!bucketName) {
        return new Response(
          JSON.stringify({ success: false, error: "B2_BUCKET_ID or B2_BUCKET_NAME secret is required." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const bucketsRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
        method: "POST",
        headers: { Authorization: authToken, "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: auth.accountId, bucketName }),
      });
      const buckets = await bucketsRes.json();
      bucketId = buckets?.buckets?.find((b: any) => b.bucketName === bucketName)?.bucketId;
      if (!bucketId) {
        return new Response(
          JSON.stringify({ success: false, error: `Bucket "${bucketName}" not found.` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 3. Hard-delete every version of every requested key
    const results: { key: string; deleted: number }[] = [];
    for (const rawPath of rawPaths) {
      const key = normalizeKey(rawPath, bucketName);
      if (!key) continue;

      let deletedCount = 0;
      let startFileName: string | undefined = undefined;

      // Paginate versions (keys with many versions / markers)
      for (let page = 0; page < 10; page++) {
        const listRes = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
          method: "POST",
          headers: { Authorization: authToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            bucketId,
            prefix: key,
            maxFileCount: 1000,
            ...(startFileName ? { startFileName } : {}),
          }),
        });
        if (!listRes.ok) break;
        const list = await listRes.json();
        const files: any[] = list?.files || [];

        const exactMatches = files.filter((f) => f.fileName === key);
        for (const f of exactMatches) {
          const delRes = await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, {
            method: "POST",
            headers: { Authorization: authToken, "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: f.fileId, fileName: f.fileName }),
          });
          if (delRes.ok) deletedCount++;
        }

        if (!list.nextFileName) break;
        startFileName = list.nextFileName;
        // Stop paging when past the exact key (versions are sorted lexicographically)
        if (startFileName && startFileName > key) break;
      }

      // An object that does not exist is treated as successfully deleted.
      results.push({ key, deleted: deletedCount });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
