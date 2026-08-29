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
 * Downloads a file directly to the user's device
 */
export async function triggerBrowserDownload(url: string, filename: string): Promise<void> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('Fetch failed with status ' + res.status);
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
  } catch (e) {
    // Fallback if fetch fails (e.g. CORS limitation)
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
  }
}

/**
 * Unified file handler for opening or downloading files from Backblaze / URL
 */
export async function openOrDownloadFile(
  file: { name: string; url?: string; b2FileId?: string },
  action: 'view' | 'download'
): Promise<void> {
  if (action === 'view') {
    if (file.b2FileId) {
      try {
        const url = await getPresignedDownloadUrl(file.b2FileId, undefined, true);
        window.open(url, '_blank');
        return;
      } catch (err) {
        console.error('Error getting preview URL:', err);
        if (file.url) {
          window.open(file.url, '_blank');
          return;
        }
        throw err;
      }
    } else if (file.url) {
      window.open(file.url, '_blank');
      return;
    }
  } else if (action === 'download') {
    if (file.b2FileId) {
      const url = await getPresignedDownloadUrl(file.b2FileId, file.name);
      await triggerBrowserDownload(url, file.name);
      return;
    } else if (file.url) {
      await triggerBrowserDownload(file.url, file.name);
      return;
    }
  }
  throw new Error('No valid URL or file ID available.');
}
