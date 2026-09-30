import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isPublicHttpUrl, NonPublicMediaUrlError } from '@/lib/public-media-url';
import { getSettings } from '@/lib/settings';

const MEDIA_PATH_PREFIX = '/api/marketing-studio/media/';

export type MediaStorageCapabilities = { provider: 's3'; configured: boolean; directUpload: false };
export type StoredMedia = { buffer: ArrayBuffer; contentType: string };

export class MediaStorageNotConfiguredError extends Error {
  constructor() { super('media_storage_not_configured'); this.name = 'MediaStorageNotConfiguredError'; }
}

type S3Config = { endpoint: string; region: string; bucket: string; accessKeyId: string; secretAccessKey: string };

async function config(): Promise<S3Config> {
  const values = await getSettings(['s3.endpoint', 's3.region', 's3.bucket', 's3.accessKeyId', 's3.secretAccessKey']);
  const result: S3Config = {
    endpoint: values['s3.endpoint'] || '', region: values['s3.region'] || 'us-east-1', bucket: values['s3.bucket'] || '',
    accessKeyId: values['s3.accessKeyId'] || '', secretAccessKey: values['s3.secretAccessKey'] || '',
  };
  if (!result.endpoint || !result.bucket || !result.accessKeyId || !result.secretAccessKey) throw new MediaStorageNotConfiguredError();
  return result;
}

async function clientAndConfig() {
  const current = await config();
  return { current, client: new S3Client({ endpoint: current.endpoint, region: current.region, credentials: { accessKeyId: current.accessKeyId, secretAccessKey: current.secretAccessKey } }) };
}

function safeKey(key: string): string {
  const value = key.trim().replace(/^\/+/, '');
  if (!value || value.includes('..') || value.includes('\\')) throw new Error('invalid_media_key');
  return value;
}

function keyFromValue(value: string): string {
  const input = value.trim();
  if (input.startsWith(MEDIA_PATH_PREFIX)) return safeKey(decodeURIComponent(input.slice(MEDIA_PATH_PREFIX.length)));
  try { const url = new URL(input); if (url.pathname.startsWith(MEDIA_PATH_PREFIX)) return safeKey(decodeURIComponent(url.pathname.slice(MEDIA_PATH_PREFIX.length))); } catch { /* use the raw key */ }
  return safeKey(input);
}

export async function getMediaStorageCapabilities(): Promise<MediaStorageCapabilities> {
  const values = await getSettings(['s3.endpoint', 's3.bucket', 's3.accessKeyId', 's3.secretAccessKey']);
  return {
    provider: 's3',
    configured: Boolean(values['s3.endpoint'] && values['s3.bucket'] && values['s3.accessKeyId'] && values['s3.secretAccessKey']),
    directUpload: false,
  };
}
export function isManagedMediaUrl(value: unknown): boolean { return typeof value === 'string' && (value.startsWith(MEDIA_PATH_PREFIX) || value.includes(MEDIA_PATH_PREFIX)); }
export function mediaPath(key: string): string { return `${MEDIA_PATH_PREFIX}${encodeURIComponent(safeKey(key))}`; }

export async function publicObjectUrl(value: string): Promise<string> {
  const values = await getSettings(['s3.publicUrl']);
  const base = (values['s3.publicUrl'] || '').trim().replace(/\/+$/, '');
  if (!isPublicHttpUrl(base)) throw new NonPublicMediaUrlError(value);
  const key = keyFromValue(value);
  return `${base}/${key.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

export async function putMedia(key: string, value: ArrayBuffer, contentType: string): Promise<string> {
  const { current, client } = await clientAndConfig();
  await client.send(new PutObjectCommand({ Bucket: current.bucket, Key: safeKey(key), Body: new Uint8Array(value), ContentType: contentType }));
  return mediaPath(key);
}

export async function putDataUrl(key: string, value: string): Promise<string> {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(value);
  if (!match) throw new Error('invalid_data_url');
  const contentType = match[1];
  const bytes = match[2]
    ? Buffer.from(match[3], 'base64')
    : Buffer.from(decodeURIComponent(match[3]), 'utf8');
  return putMedia(key, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), contentType);
}

export async function signedMediaUrl(value: string, expiresIn = 900): Promise<string> {
  const { current, client } = await clientAndConfig();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: current.bucket, Key: keyFromValue(value) }), { expiresIn });
}

export async function readMedia(value: string): Promise<StoredMedia | null> {
  const { current, client } = await clientAndConfig();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: current.bucket, Key: keyFromValue(value) }));
    if (!response.Body) return null;
    const bytes = await response.Body.transformToByteArray();
    return { buffer: new Uint8Array(bytes).slice().buffer, contentType: response.ContentType || 'application/octet-stream' };
  } catch (error) {
    if (String(error).includes('NoSuchKey') || String(error).includes('NotFound')) return null;
    throw error;
  }
}

export async function serveMedia(request: Request, value: string, includeBody: boolean): Promise<Response> {
  const { current, client } = await clientAndConfig();
  const key = keyFromValue(value);
  let head;
  try {
    head = await client.send(new HeadObjectCommand({ Bucket: current.bucket, Key: key }));
  } catch (error) {
    if (String(error).includes('NoSuchKey') || String(error).includes('NotFound')) return new Response('not found', { status: 404 });
    throw error;
  }
  const size = Number(head.ContentLength || 0);
  const baseHeaders = { 'Content-Type': head.ContentType || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=900', 'Content-Disposition': 'inline', Vary: 'Range' };
  const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range') || '');
  if (match) {
    const start = Number(match[1]); const end = Math.min(match[2] ? Number(match[2]) : size - 1, size - 1);
    if (start < 0 || start >= size || end < start) return new Response('range not satisfiable', { status: 416, headers: { ...baseHeaders, 'Content-Range': `bytes */${size}` } });
    const length = end - start + 1; const headers = { ...baseHeaders, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(length) };
    if (!includeBody) return new Response(null, { status: 206, headers });
    const response = await client.send(new GetObjectCommand({ Bucket: current.bucket, Key: key, Range: `bytes=${start}-${end}` }));
    return new Response(response.Body?.transformToWebStream(), { status: 206, headers });
  }
  const headers = { ...baseHeaders, 'Content-Length': String(size) };
  if (!includeBody) return new Response(null, { headers });
  const response = await client.send(new GetObjectCommand({ Bucket: current.bucket, Key: key }));
  return new Response(response.Body?.transformToWebStream(), { headers });
}

export async function handleClientUploadRequest(): Promise<Response> { return Response.json({ error: 'direct_upload_not_supported' }, { status: 404 }); }
