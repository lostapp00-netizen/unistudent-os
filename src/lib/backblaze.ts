import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
 * Deletes a file from Backblaze B2
 * @param path The path/filename of the file to delete
 */
export async function deleteFromB2(path: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
  });

  await b2Client.send(command);
}

/**
 * Generates a presigned download URL for private buckets
 */
export async function getPresignedDownloadUrl(path: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: path,
  });

  return await getSignedUrl(b2Client, command, { expiresIn: 3600 });
}
