import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const b2Client = new S3Client({
  endpoint: process.env.VITE_B2_ENDPOINT,
  region: process.env.VITE_B2_REGION,
  credentials: {
    accessKeyId: process.env.VITE_B2_KEY_ID!,
    secretAccessKey: process.env.VITE_B2_APPLICATION_KEY!,
  },
});

async function testUpload() {
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
      Key: 'test.txt',
      Body: 'Hello world',
      ContentType: 'text/plain',
    });
    console.log("Uploading...");
    await b2Client.send(command);
    console.log("Upload successful!");
  } catch (err) {
    console.error("Upload failed:", err);
  }
}
testUpload();
