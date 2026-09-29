import { readMedia, signedMediaUrl } from '@/lib/media-storage';
import { sameOriginMediaPath } from '@/lib/public-media-url';

// 同源 S3 媒体不能直接把应用路由交给供应商；提交短期预签名 URL。
// ad-reference 的 character / edit 接口共用,避免各写一份。
const MEDIA_PATH_PREFIX = '/api/marketing-studio/media/';

export const ADREF_VIDEO_UPLOAD_LIMIT = 200_000_000;
export const ADREF_IMAGE_UPLOAD_LIMIT = 10_000_000;

async function signedSameOriginMedia(path: string, maxBytes: number): Promise<string> {
  const key = decodeURIComponent(path.slice(MEDIA_PATH_PREFIX.length).split('?')[0] || '');
  if (!key) throw new Error('media_key_required');
  const media = await readMedia(path);
  if (!media) throw new Error(`media_not_found:${key}`);
  if (media.buffer.byteLength > maxBytes) {
    throw new Error(`media_too_large:${media.buffer.byteLength}`);
  }
  return signedMediaUrl(path, 900);
}

// 把输入媒体转换为 Seedance 可抓取的短期地址。
export async function prepareInputMediaForSeedance(
  rawValue: unknown,
  publicUrl: string,
  req: Request,
  _filenamePrefix: string,
  maxBytes: number,
): Promise<string> {
  const path = sameOriginMediaPath(rawValue, req);
  if (path) return signedSameOriginMedia(path, maxBytes);
  return publicUrl;
}
