import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectVersionsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = import.meta.env.VITE_B2_BUCKET_NAME;
const REGION = import.meta.env.VITE_B2_REGION;
const ENDPOINT = import.meta.env.VITE_B2_ENDPOINT;
const KEY_ID = import.meta.env.VITE_B2_KEY_ID;
const APP_KEY = import.meta.env.VITE_B2_APPLICATION_KEY;

// Create S3 client connected to B2
export const b2Client = new S3Client({
  endpoint: ENDPOINT,
  region: REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: KEY_ID,
    secretAccessKey: APP_KEY,
  },
});

/**
 * Uploads a file to Backblaze B2
 * @param file The File object from an input
 * @param path The path/filename to save it as
 * @returns The public URL (if the bucket is public) or a key
 */
export async function uploadToB2(file: File, path: string): Promise<string> {
  const fileBuffer = await file.arrayBuffer();
  const fileArray = new Uint8Array(fileBuffer);

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
    Body: fileArray,
    ContentType: file.type,
  });

  await b2Client.send(command);
  
  // Construct the public URL if it's a public bucket
  // Using S3 endpoint path-style URL
  const publicUrl = `${ENDPOINT}/${BUCKET_NAME}/${path}`;
  return publicUrl;
}

/**
 * Uploads a file to Backblaze B2 and returns both publicUrl and b2Path
 */
export async function uploadFile(file: File, path: string): Promise<{ publicUrl: string; b2Path: string }> {
  const publicUrl = await uploadToB2(file, path);
  return { publicUrl, b2Path: path };
}

/**
 * Server-side hard delete via the `delete-b2-file` Supabase Edge Function.
 * The browser cannot always reach B2 (CORS restrictions on DELETE), so the
 * Edge Function — which runs with the B2 keys on the server — is the primary
 * path. Returns true when the function confirmed deletion (or the object was
 * already gone), false when the fallback client-side path should be used.
 */
async function deleteB2ViaEdgeFunction(cleanKeys: string[]): Promise<boolean> {
  const validKeys = cleanKeys.filter(Boolean);
  if (validKeys.length === 0) return true;
  try {
    const { supabase } = await import('./supabase');
    const { data, error } = await supabase.functions.invoke('delete-b2-file', {
      body: { paths: validKeys }
    });
    if (error) throw error;
    return Boolean((data as any)?.success);
  } catch (err) {
    console.warn('Edge Function B2 delete unavailable, falling back to client-side delete:', err);
    return false;
  }
}

/** Normalizes a raw path or URL into a clean B2 object key. */
function normalizeB2Key(path: string): string {
  let cleanKey = path.trim();
  if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
  if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
    const extracted = extractB2KeyFromUrl(cleanKey);
    if (extracted) cleanKey = extracted;
  }
  return cleanKey;
}

/**
 * Permanently deletes a file (including all previous versions and delete markers) from Backblaze B2
 * @param path The path/filename of the file to delete
 */
export async function deleteFromB2(path: string): Promise<void> {
  if (!path) return;
  const cleanKey = normalizeB2Key(path);
  if (!cleanKey) return;

  // Primary path: server-side hard delete (no CORS restrictions).
  if (await deleteB2ViaEdgeFunction([cleanKey])) return;

  try {
    // List all versions and delete markers for this object to perform hard delete
    const listVersions = new ListObjectVersionsCommand({
      Bucket: BUCKET_NAME,
      Prefix: cleanKey,
    });
    const versionsRes = await b2Client.send(listVersions);
    const versions = versionsRes.Versions?.filter(v => v.Key === cleanKey) || [];
    const deleteMarkers = versionsRes.DeleteMarkers?.filter(d => d.Key === cleanKey) || [];

    if (versions.length > 0 || deleteMarkers.length > 0) {
      await Promise.allSettled([
        ...versions.map(v => 
          b2Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: cleanKey,
            VersionId: v.VersionId,
          }))
        ),
        ...deleteMarkers.map(d => 
          b2Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: cleanKey,
            VersionId: d.VersionId,
          }))
        ),
      ]);
      return;
    }
  } catch (err) {
    console.warn('Could not list/hard-delete versions from B2, falling back to standard delete:', err);
  }

  try {
    // Standard delete fallback
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: cleanKey,
    });
    await b2Client.send(command);
  } catch (err) {
    console.error('Error in standard deleteFromB2:', err);
  }
}

/**
 * Permanently deletes multiple files from Backblaze B2
 */
export async function deleteMultipleFromB2(paths: (string | undefined)[]): Promise<void> {
  const validPaths = paths.filter((p): p is string => Boolean(p && p.trim().length > 0));
  if (validPaths.length === 0) return;
  const cleanKeys = Array.from(new Set(validPaths.map(normalizeB2Key).filter(Boolean)));
  // Primary path: one server-side batch hard delete.
  if (await deleteB2ViaEdgeFunction(cleanKeys)) return;
  await Promise.allSettled(cleanKeys.map(p => deleteFromB2(p)));
}

/**
 * Generates a presigned download/view URL for private buckets
 */
export async function getPresignedDownloadUrl(
  path: string, 
  downloadFilename?: string, 
  inline: boolean = false
): Promise<string> {
  let cleanKey = path.trim();
  if (cleanKey.startsWith('/')) cleanKey = cleanKey.slice(1);
  if (cleanKey.startsWith('http://') || cleanKey.startsWith('https://')) {
    const extracted = extractB2KeyFromUrl(cleanKey);
    if (extracted) cleanKey = extracted;
  }

  let contentDisposition: string | undefined = undefined;

  if (downloadFilename) {
    const safeAsciiName = downloadFilename.replace(/[^\x20-\x7E]/g, '_');
    const utf8Encoded = encodeURIComponent(downloadFilename);
    contentDisposition = `attachment; filename="${safeAsciiName}"; filename*=UTF-8''${utf8Encoded}`;
  } else if (inline) {
    contentDisposition = 'inline';
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: cleanKey,
    ResponseContentDisposition: contentDisposition,
  });

  return await getSignedUrl(b2Client, command, { expiresIn: 3600 });
}

/**
 * Utility to extract B2 object key from a full URL or path if b2FileId was not explicitly saved
 */
export function extractB2KeyFromUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return null;
  
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const urlObj = new URL(url);
      const pathname = decodeURIComponent(urlObj.pathname);
      
      // Pattern 1: /BUCKET_NAME/key
      if (BUCKET_NAME && pathname.toLowerCase().startsWith(`/${BUCKET_NAME.toLowerCase()}/`)) {
        return pathname.slice(BUCKET_NAME.length + 2);
      }
      
      // Pattern 2: /file/BUCKET_NAME/key
      if (BUCKET_NAME && pathname.toLowerCase().startsWith(`/file/${BUCKET_NAME.toLowerCase()}/`)) {
        return pathname.slice(BUCKET_NAME.length + 7);
      }

      // Pattern 3: attachments/ or feedback_ or UUID_ prefix in path
      const parts = pathname.split('/').filter(Boolean);
      if (parts.length > 0) {
        if (parts.includes('attachments')) {
          const attIdx = parts.indexOf('attachments');
          return parts.slice(attIdx).join('/');
        }
        const lastPart = parts[parts.length - 1];
        if (lastPart.startsWith('feedback_') || /^[0-9a-f]{8}-/i.test(lastPart) || lastPart.includes('_')) {
          return lastPart;
        }
      }
    } else {
      // If it's already a clean key path
      let clean = url.trim();
      if (clean.startsWith('/')) clean = clean.slice(1);
      return clean;
    }
  } catch {}
  return null;
}

/**
 * Converts a Base64 Data URL to a native Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteString = atob(parts[1] || '');
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([uint8Array], { type: mimeType });
}

/**
 * Downloads a file directly to the user's device via native Blob anchor click
 */
export async function triggerBrowserDownload(url: string, filename: string): Promise<void> {
  // 1. If it's a data URL, convert to Blob and download
  if (url.startsWith('data:')) {
    try {
      const blob = dataUrlToBlob(url);
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 2000);
      return;
    } catch (e) {
      console.warn('Error downloading data URL as blob:', e);
    }
  }

  // 2. If it's already a blob URL
  if (url.startsWith('blob:')) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 2000);
    return;
  }

  // 3. Try CORS fetch to download as Blob
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        if (document.body.contains(link)) document.body.removeChild(link);
      }, 2000);
      return;
    }
  } catch (e) {
    // CORS or fetch error: fallback to anchor / iframe
  }

  // 4. Fallback for cross-origin or presigned URLs
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 5000);
  } catch {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 2000);
  }
}

/**
 * Unified file handler for opening or downloading files from Backblaze / Base64 / URL
 *
 * IMPORTANT: the browser only allows window.open() while "transient user
 * activation" is alive (~a few seconds after the click). Downloading the whole
 * object from B2 in the browser before opening it used to exceed that window,
 * so previews/downloads silently did nothing. The primary path is now a fast
 * presigned URL generation followed by an immediate open/click.
 */
export async function openOrDownloadFile(
  file: { name: string; url?: string; b2FileId?: string },
  action: 'view' | 'download'
): Promise<void> {
  const b2Key = file.b2FileId || extractB2KeyFromUrl(file.url);

  if (action === 'view') {
    // Data URL preview
    if (file.url?.startsWith('data:')) {
      try {
        const blob = dataUrlToBlob(file.url);
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        return;
      } catch (err) {
        console.warn('Could not convert data url to blob for preview:', err);
      }
    }

    // Blob URL preview
    if (file.url?.startsWith('blob:')) {
      window.open(file.url, '_blank');
      return;
    }

    // Backblaze S3 key: presigned inline URL (fast — keeps user activation alive)
    if (b2Key) {
      try {
        const presignedUrl = await getPresignedDownloadUrl(b2Key, undefined, true);
        const win = window.open(presignedUrl, '_blank');
        if (win) return;
        // Popup blocked — last resort anchor click
        const link = document.createElement('a');
        link.href = presignedUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      } catch (err) {
        console.warn('Error generating preview URL for B2 key:', b2Key, err);
      }
    }

    // Direct URL fallback
    if (file.url) {
      window.open(file.url, '_blank');
      return;
    }
  } else if (action === 'download') {
    // Data URL download
    if (file.url?.startsWith('data:')) {
      await triggerBrowserDownload(file.url, file.name);
      return;
    }

    // Blob URL download
    if (file.url?.startsWith('blob:')) {
      await triggerBrowserDownload(file.url, file.name);
      return;
    }

    // Backblaze S3 key: presigned attachment URL guarantees the exact filename
    // and works on private buckets (no CORS-prone in-browser fetch needed).
    if (b2Key) {
      try {
        const presignedUrl = await getPresignedDownloadUrl(b2Key, file.name);
        await triggerBrowserDownload(presignedUrl, file.name);
        return;
      } catch (presignedErr) {
        console.warn('Presigned download error:', presignedErr);
      }
    }

    // Direct URL download fallback
    if (file.url) {
      await triggerBrowserDownload(file.url, file.name);
      return;
    }
  }

  throw new Error('No valid URL or file ID available.');
}

/**
 * Universal preview function
 */
export async function previewFile(file: { name: string; url?: string; b2FileId?: string }): Promise<void> {
  return openOrDownloadFile(file, 'view');
}

/**
 * Universal download function
 */
export async function downloadFile(file: { name: string; url?: string; b2FileId?: string }): Promise<void> {
  return openOrDownloadFile(file, 'download');
}
