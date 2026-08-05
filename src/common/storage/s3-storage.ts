import './env-loader';
import {
  DeleteObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import multerS3 from 'multer-s3';
import { randomBytes } from 'crypto';
import { extname } from 'path';

const SPACES_BUCKET = process.env.SPACES_BUCKET as string;
// DigitalOcean Spaces supports ACLs (unlike AWS S3's newer "Bucket owner
// enforced" default), so public-read is safe to default to here — these
// uploads (banners/product/category images) are meant to be publicly
// viewable.
const SPACES_ACL = process.env.SPACES_ACL || 'public-read';
const SPACES_ENDPOINT = normalizeEndpoint(
  process.env.SPACES_ENDPOINT,
  SPACES_BUCKET,
);

export const s3Client = new S3Client({
  region: process.env.SPACES_REGION,
  endpoint: SPACES_ENDPOINT,
  // Spaces uses virtual-hosted-style URLs (bucket.region.digitaloceanspaces.com),
  // so path-style addressing is intentionally left off.
  credentials: {
    accessKeyId: process.env.SPACES_KEY as string,
    secretAccessKey: process.env.SPACES_SECRET as string,
  },
});

// The SDK prepends the bucket to the endpoint host for virtual-hosted-style
// addressing, so SPACES_ENDPOINT must be the *regional* endpoint
// (https://fra1.digitaloceanspaces.com), not the bucket's own URL
// (https://bucket.fra1.digitaloceanspaces.com) — otherwise the bucket ends
// up duplicated in the hostname and every request fails DNS resolution.
// Strip it here so either form works.
function normalizeEndpoint(
  rawEndpoint: string | undefined,
  bucket: string,
): string | undefined {
  if (!rawEndpoint) return undefined;
  try {
    const url = new URL(rawEndpoint);
    if (url.hostname.startsWith(`${bucket}.`)) {
      url.hostname = url.hostname.slice(bucket.length + 1);
    }
    return url.origin;
  } catch {
    return rawEndpoint;
  }
}

type MulterCallback = (error: any, acceptFile: boolean) => void;

export function createS3Storage(folder: string, allowedMimeTypes: RegExp) {
  return {
    storage: multerS3({
      s3: s3Client,
      bucket: SPACES_BUCKET,
      acl: SPACES_ACL,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key: (req, file, cb) => {
        const randomName = randomBytes(16).toString('hex');
        cb(null, `${folder}/${randomName}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (
      req: unknown,
      file: Express.Multer.File,
      cb: MulterCallback,
    ) => {
      if (!file.mimetype.match(allowedMimeTypes)) {
        cb(new Error('Only image files are allowed!'), false);
      } else {
        cb(null, true);
      }
    },
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  };
}

// Server-side upload (no multer/HTTP request involved) — used to mirror
// externally-hosted files (e.g. Facebook CDN images) into our own bucket.
export async function uploadBufferToSpaces(
  folder: string,
  buffer: Buffer,
  contentType: string,
  extension: string,
): Promise<string> {
  const key = `${folder}/${randomBytes(16).toString('hex')}${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: SPACES_ACL as ObjectCannedACL,
    }),
  );

  const host = SPACES_ENDPOINT?.replace(/^https?:\/\//, '');
  return `https://${SPACES_BUCKET}.${host}/${key}`;
}

// Best-effort cleanup: never throws, so a failed delete doesn't fail the
// request that triggered it (e.g. replacing/removing a banner image).
export async function deleteS3ObjectByUrl(url?: string | null): Promise<void> {
  const key = url ? extractS3Key(url) : null;
  if (!key) return;

  try {
    await s3Client.send(
      new DeleteObjectCommand({ Bucket: SPACES_BUCKET, Key: key }),
    );
  } catch {
    // ignore — orphaned object cleanup is not worth failing the request over
  }
}

function extractS3Key(url: string): string | null {
  try {
    const { pathname, hostname } = new URL(url);
    if (hostname.startsWith(`${SPACES_BUCKET}.`)) {
      return decodeURIComponent(pathname.replace(/^\//, ''));
    }
    if (pathname.startsWith(`/${SPACES_BUCKET}/`)) {
      return decodeURIComponent(pathname.slice(SPACES_BUCKET.length + 2));
    }
    // Not one of our Spaces URLs (e.g. a legacy local `/uploads/...` path
    // from before this migration) — nothing to delete.
    return null;
  } catch {
    return null;
  }
}
