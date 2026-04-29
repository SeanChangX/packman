import { Client } from 'minio'
import { Readable } from 'stream'

const BUCKET = process.env.MINIO_BUCKET ?? 'packman-items'

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
    // Set public read policy for photo URLs
    await minioClient.setBucketPolicy(
      BUCKET,
      JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET}/*`],
          },
        ],
      })
    )
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
  // If MinIO is public-read, return a direct URL instead of a presigned one
  const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost'
  const port = process.env.MINIO_PORT ?? '9000'
  const ssl = process.env.MINIO_USE_SSL === 'true'
  const protocol = ssl ? 'https' : 'http'

  // Use MINIO_PUBLIC_URL for external access if set, otherwise construct from MinIO env.
  const baseUrl = process.env.MINIO_PUBLIC_URL
    ?? `${protocol}://${endpoint}:${port}`

  return `${baseUrl}/${BUCKET}/${objectName}`
}

export function objectNameFromUrl(url?: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length))
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
