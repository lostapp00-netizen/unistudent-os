import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';
dotenv.config();

const b2Client = new S3Client({
  endpoint: process.env.VITE_B2_ENDPOINT,
  region: process.env.VITE_B2_REGION,
  credentials: {
    accessKeyId: process.env.VITE_B2_KEY_ID!,
    secretAccessKey: process.env.VITE_B2_APPLICATION_KEY!,
  },
});

async function setCors() {
  try {
    console.log("Setting CORS on bucket:", process.env.VITE_B2_BUCKET_NAME);
    const command = new PutBucketCorsCommand({
      Bucket: process.env.VITE_B2_BUCKET_NAME,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
            AllowedOrigins: ["*"], // Or restrict to localhost and your domain
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3000
          }
        ]
      }
    });
    
    await b2Client.send(command);
    console.log("CORS updated successfully!");
  } catch (err) {
    console.error("Failed to set CORS:", err);
  }
}

setCors();
