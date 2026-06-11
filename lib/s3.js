import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME;

/**
 * Generate a presigned URL for direct browser → S3 upload.
 * Max 2GB, expires in 1 hour.
 */
export async function getUploadUrl(key, contentType, fileSize) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: fileSize,
  });

  const url = await getSignedUrl(s3, command, {
    expiresIn: 3600, // 1 hour
  });

  return url;
}

/**
 * Generate a presigned URL for file download/streaming.
 * Expires in 24 hours. Use CloudFront for production streaming.
 */
export async function getDownloadUrl(key, filename) {
  // If CloudFront is configured, use it for faster delivery
  if (process.env.CLOUDFRONT_DOMAIN) {
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });

  return getSignedUrl(s3, command, { expiresIn: 86400 });
}

/**
 * Generate a presigned URL for inline viewing/streaming (no download header).
 */
export async function getStreamUrl(key) {
  if (process.env.CLOUDFRONT_DOMAIN) {
    return `https://${process.env.CLOUDFRONT_DOMAIN}/${key}`;
  }

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, command, { expiresIn: 86400 });
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3.send(command);
}

/**
 * Generate a unique S3 key for a file.
 * Structure: projects/{projectId}/{fileId}/{filename}
 */
export function generateS3Key(projectId, fileId, filename) {
  return `projects/${projectId}/${fileId}/${filename}`;
}
