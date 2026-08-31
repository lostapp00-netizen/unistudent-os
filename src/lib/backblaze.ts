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
 * Permanently deletes a file (including all previous versions and delete markers) from Backblaze B2
 * @param path The path/filename of the file to delete
 */
export async function deleteFromB2(path: string): Promise<void> {
  try {
    // List all versions and delete markers for this object to perform hard delete
    const listVersions = new ListObjectVersionsCommand({
      Bucket: BUCKET_NAME,
      Prefix: path,
    });
    const versionsRes = await b2Client.send(listVersions);
    const versions = versionsRes.Versions?.filter(v => v.Key === path) || [];
    const deleteMarkers = versionsRes.DeleteMarkers?.filter(d => d.Key === path) || [];

    if (versions.length > 0 || deleteMarkers.length > 0) {
      await Promise.all([
        ...versions.map(v => 
          b2Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: path,
            VersionId: v.VersionId,
          }))
        ),
        ...deleteMarkers.map(d => 
          b2Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: path,
            VersionId: d.VersionId,
          }))
        ),
      ]);
      return;
    }
  } catch (err) {
    console.warn('Could not list/hard-delete versions from B2, falling back to standard delete:', err);
  }

  // Standard delete fallback
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
  });

  await b2Client.send(command);
}

/**
 * Permanently deletes multiple files from Backblaze B2
 */
export async function deleteMultipleFromB2(paths: (string | undefined)[]): Promise<void> {
  const validPaths = paths.filter((p): p is string => Boolean(p && p.trim().length > 0));
  if (validPaths.length === 0) return;
  await Promise.allSettled(validPaths.map(p => deleteFromB2(p)));
}

/**
 * Generates a presigned download/view URL for private buckets
 */
export async function getPresignedDownloadUrl(
  path: string, 
  downloadFilename?: string, 
  inline: boolean = false
): Promise<string> {
  let contentDisposition: string | undefined = undefined;

  if (downloadFilename) {
    const encodedName = encodeURIComponent(downloadFilename);
    contentDisposition = `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`;
  } else if (inline) {
    contentDisposition = 'inline';
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
    ResponseContentDisposition: contentDisposition,
  });

  return await getSignedUrl(b2Client, command, { expiresIn: 3600 });
}

/**
 * Utility to extract B2 object key from a full URL if b2FileId was not explicitly saved
 */
export function extractB2KeyFromUrl(url?: string): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('blob:')) return null;
  
  try {
    const urlObj = new URL(url);
    const pathname = decodeURIComponent(urlObj.pathname);
    
    // Pattern 1: /BUCKET_NAME/key
    if (BUCKET_NAME && pathname.startsWith(`/${BUCKET_NAME}/`)) {
      return pathname.replace(`/${BUCKET_NAME}/`, '');
    }
    
    // Pattern 2: /file/BUCKET_NAME/key
    if (BUCKET_NAME && pathname.startsWith(`/file/${BUCKET_NAME}/`)) {
      return pathname.replace(`/file/${BUCKET_NAME}/`, '');
    }

    // Pattern 3: attachments/ or feedback_ or UUID_ prefix in path
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1];
      if (parts.includes('attachments')) {
        const attIdx = parts.indexOf('attachments');
        return parts.slice(attIdx).join('/');
      }
      if (lastPart.startsWith('feedback_') || lastPart.includes('_')) {
        return lastPart;
      }
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
 * Downloads a file directly to the user's device
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
      }, 1000);
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
    }, 1000);
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
      }, 1000);
      return;
    }
  } catch (e) {
    // CORS or fetch error: fallback to iframe/link
  }

  // 4. Fallback for cross-origin or presigned URLs with attachment header
  try {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) document.body.removeChild(link);
    }, 1000);
  } catch {
    window.open(url, '_blank');
  }
}

/**
 * Unified file handler for opening or downloading files from Backblaze / Base64 / URL
 */
export async function openOrDownloadFile(
  file: { name: string; url?: string; b2FileId?: string },
  action: 'view' | 'download'
): Promise<void> {
  const b2Key = file.b2FileId || extractB2KeyFromUrl(file.url);

  if (action === 'view') {
    // Data URL preview: convert to blob URL to avoid browser security restrictions on data: navigation
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

    // Backblaze S3 key: generate presigned inline URL
    if (b2Key) {
      try {
        const presignedUrl = await getPresignedDownloadUrl(b2Key, undefined, true);
        window.open(presignedUrl, '_blank');
        return;
      } catch (err) {
        console.warn('Error generating presigned view URL for B2 key:', b2Key, err);
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

    // Backblaze S3 key: generate presigned URL with attachment disposition
    if (b2Key) {
      try {
        const presignedUrl = await getPresignedDownloadUrl(b2Key, file.name);
        await triggerBrowserDownload(presignedUrl, file.name);
        return;
      } catch (err) {
        console.warn('Error getting presigned download URL for B2 key:', b2Key, err);
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
