import { submitRawGen } from '@/lib/atlas';
import { SEEDANCE_MODELS, isSeedanceVideoModel } from '@/lib/seedance';

/**
 * 爆款广告复刻统一使用 Seedance 2.0 reference-to-video。
 * 参考视频、产品图和人物图作为内容输入，提示词要求保留原片节奏并生成对白、配音和音效。
 */

export const SEEDANCE_REFERENCE_MODEL = SEEDANCE_MODELS.standard.referenceToVideo;
export const AD_REF_EDIT_MODEL = SEEDANCE_REFERENCE_MODEL;

// 参考视频上传限制
export const AD_REF_MAX_VIDEO_BYTES = 60_000_000;
export const AD_REF_MAX_IMAGE_BYTES = 10_000_000;

export function cleanRefText(v: unknown, fallback = '', max = 1200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) || fallback : fallback;
}

/**
 * 由结构化输入组装 video-edit 编辑指令(英文,已实测的模板):
 * 参考图动态编号:先人像后产品,prompt 里用 "reference image N" 指回。
 */
export function buildEditRequest({
  videoUrl,
  avatarUrl,
  productUrl,
  productNote,
  extraNote,
}: {
  videoUrl: string;
  avatarUrl?: string;
  productUrl?: string;
  productNote?: string;
  extraNote?: string;
}) {
  const images: string[] = [];
  const parts: string[] = [
    'Keep the SAME scene, background, lighting, camera framing, camera motion, cuts, pacing and overall energy of the source video.',
  ];
  if (avatarUrl) {
    images.push(avatarUrl);
    parts.push(
      `Replace the presenter/person in the video with the person shown in reference image ${images.length} — use their exact face, hair and identity, keep the same head and hand motion, gestures and expressiveness. If the original person is talking, the new person talks the same way.`,
    );
  }
  if (productUrl) {
    images.push(productUrl);
    parts.push(
      `Replace only the product held/shown in the video with the exact product shown in reference image ${images.length}. Keep its exact shape, colors, materials, cap/lid, packaging, label layout, logos, visible text, typography, color blocks and small details${productNote ? ` (${productNote})` : ''}. If the product has a printed label or brand text, keep that label front-facing and legible whenever the original product faces camera. Do not simplify it into a generic product, do not remove or blur the label, and do not change the presenter/person, hand pose, scene, lighting, camera motion or pacing.`,
    );
  }
  if (extraNote) parts.push(extraNote);
  parts.push(
    'This is one complete video generation: create the final picture, spoken dialogue, voice performance, accurate lip sync and scene-matched sound effects together in this request. Use generate_audio=true. If no exact dialogue was supplied, write a concise product-focused line in the language of the product notes. Do not require a later voice, lip-sync or motion pass.',
  );
  parts.push('Photorealistic, natural, no added on-screen text, no watermark.');
  return {
    prompt: parts.join(' '),
    images,
  };
}

/** Seedance 参考视频编辑，原生生成对白、配音和音效。 */
export async function submitAdRefEdit(videoUrl: string, prompt: string, images: string[], model: string = AD_REF_EDIT_MODEL) {
  return submitRawGen('generateVideo', {
    model: isSeedanceVideoModel(model) && model.endsWith('/reference-to-video') ? model : AD_REF_EDIT_MODEL,
    video: videoUrl,
    prompt,
    ...(images.length ? { reference_images: images.slice(0, 8) } : {}),
    resolution: '720p',
    generate_audio: true,
  });
}
