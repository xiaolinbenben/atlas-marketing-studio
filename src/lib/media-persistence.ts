import crypto from 'node:crypto';
import { putMedia, isManagedMediaUrl, readMedia } from '@/lib/media-storage';

function extensionFor(contentType: string): string {
  const type = contentType.toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';
  if (type.includes('mp4')) return 'mp4';
  if (type.includes('quicktime')) return 'mov';
  if (type.includes('webm')) return 'webm';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('wav')) return 'wav';
  return 'bin';
}

export async function persistMedia(source: string): Promise<string> {
  if (!source || isManagedMediaUrl(source)) return source;
  let bytes: ArrayBuffer;
  let contentType = 'application/octet-stream';
  if (source.startsWith('data:')) {
    const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(source);
    if (!match) return source;
    contentType = match[1];
    const buffer = match[2] ? Buffer.from(match[3], 'base64') : Buffer.from(decodeURIComponent(match[3]), 'utf8');
    bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  } else if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!response.ok) return source;
    contentType = response.headers.get('content-type') || contentType;
    bytes = await response.arrayBuffer();
  } else {
    return source;
  }
  const key = `generated/${crypto.randomUUID()}.${extensionFor(contentType)}`;
  return putMedia(key, bytes, contentType);
}

export async function persistMediaOutputs(outputs: string[]): Promise<string[]> {
  return Promise.all(outputs.map((source) => persistMedia(source)));
}

export async function mediaToDataUri(url: string): Promise<string> {
  const media = await readMedia(url);
  if (!media) return '';
  const bytes = new Uint8Array(media.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${media.contentType};base64,${Buffer.from(binary, 'binary').toString('base64')}`;
}
