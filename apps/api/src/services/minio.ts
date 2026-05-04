import { Client } from 'minio'
import { Readable } from 'stream'

const BUCKET = process.env.MINIO_BUCKET ?? 'packman-items'
const PRESIGN_EXPIRY_SECONDS = 60 * 60 // 1 hour

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'packman',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'packman_secret',
})

export async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET)
  }
  // Always reassert a private policy. ensureBucket runs on every API startup,
  // so this also fixes any bucket left in legacy public-read state from older
  // versions of this code.
  try {
    const current = await minioClient.getBucketPolicy(BUCKET).catch(() => '')
    if (current && current !== '{}') {
      // Empty-string policy in the MinIO SDK is "delete". setBucketPolicy with
      // an empty object is the canonical "no anonymous access" form.
      await minioClient.setBucketPolicy(BUCKET, '')
    }
  } catch {
    // Some MinIO versions throw NoSuchBucketPolicy when none is set — that is
    // already the desired state, so we silently ignore.
  }
}

export async function uploadToMinio(
  objectName: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  })
}

export async function uploadStreamToMinio(
  objectName: string,
  source: NodeJS.ReadableStream,
  size: number,
  contentType: string
): Promise<void> {
  // The MinIO SDK types insist on stream.Readable. unzipper's entry.stream()
  // returns a Node Readable in practice, but some callers may pass a plain
  // ReadableStream — wrap it so the type is satisfied without copying buffers.
  const readable = source instanceof Readable ? source : Readable.from(source as any)
  await minioClient.putObject(BUCKET, objectName, readable, size, {
    'Content-Type': contentType,
  })
}

export async function getObjectStream(objectName: string): Promise<Readable> {
  return minioClient.getObject(BUCKET, objectName)
}

export async function getPresignedUrl(objectName: string): Promise<string> {
  // Time-limited signed URL. Bucket is private; clients must use either this
  // (short-lived) URL or the auth-protected /api/items/:id/photo proxy.
  const signed = await minioClient.presignedGetObject(BUCKET, objectName, PRESIGN_EXPIRY_SECONDS)

  // If MINIO_PUBLIC_URL is set, rewrite the host of the signed URL so external
  // clients can reach the object (the signature is preserved by URL.parse).
  const publicBase = process.env.MINIO_PUBLIC_URL
  if (publicBase) {
    const signedUrl = new URL(signed)
    const publicUrl = new URL(publicBase)
    signedUrl.protocol = publicUrl.protocol
    signedUrl.host = publicUrl.host
    return signedUrl.toString()
  }
  return signed
}

export function objectNameFromUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  // Strip query string (presigned URLs include S3 signature params).
  const pathPart = url.slice(index + marker.length).split('?')[0]
  return decodeURIComponent(pathPart)
}

export async function getObjectBuffer(objectName: string): Promise<Buffer> {
  const stream = await minioClient.getObject(BUCKET, objectName)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

export async function deleteObject(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET, objectName)
}

export async function listAllObjectNames(prefix = ''): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const names: string[] = []
    const stream = minioClient.listObjectsV2(BUCKET, prefix, true)
    stream.on('data', (obj) => { if (obj.name) names.push(obj.name) })
    stream.on('end', () => resolve(names))
    stream.on('error', reject)
  })
}

export function bucketName() {
  return BUCKET
}
