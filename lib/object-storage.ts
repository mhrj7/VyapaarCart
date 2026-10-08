import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const listingKeyPattern = /^listings\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
};

function getConfig(): StorageConfig {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error("S3-compatible image storage is not configured.");
  }

  return {
    endpoint,
    region: process.env.S3_REGION || "auto",
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: publicBaseUrl.replace(/\/$/, ""),
  };
}

function getClient(config: StorageConfig) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function isListingImageKey(value: string, clerkId?: string) {
  if (!listingKeyPattern.test(value)) return false;
  return !clerkId || value.startsWith(`listings/${clerkId}/`);
}

export function publicImageUrl(key: string) {
  if (!isListingImageKey(key)) return null;
  const { publicBaseUrl } = getConfig();
  return `${publicBaseUrl}/${key}`;
}

export async function uploadListingImage(key: string, body: Uint8Array, contentType: string) {
  if (!isListingImageKey(key)) throw new Error("Invalid listing image key.");
  const config = getConfig();
  await getClient(config).send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return { key, url: publicImageUrl(key) };
}

export async function deleteListingImage(key: string) {
  if (!isListingImageKey(key)) return;
  const config = getConfig();
  await getClient(config).send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}
