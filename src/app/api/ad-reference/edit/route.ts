import { withAtlas } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildEditRequest, submitAdRefEdit, cleanRefText, AD_REF_EDIT_MODEL } from '@/lib/ad-reference';
import { chargeAndSubmit, chargeErrorResponse } from '@/lib/marketing-studio/gen-task';
import { configuredVideoCredits } from '@/lib/video-pricing';
import { isPublicHttpUrl, NonPublicMediaUrlError } from '@/lib/public-media-url';
import { isManagedMediaUrl, publicObjectUrl } from '@/lib/media-storage';
import { isSeedanceVideoModel } from '@/lib/seedance';

export const maxDuration = 60;

async function seedanceInputUrl(value: unknown): Promise<string> {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  if (isManagedMediaUrl(s)) return publicObjectUrl(s);
  if (!isPublicHttpUrl(s)) throw new NonPublicMediaUrlError(s);
  return s;
}

// 一次 Seedance reference-to-video 同时换人、换产品并生成对白、配音和音效。
async function handler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  let videoUrl = '';
  let avatarUrl = '';
  let productUrl = '';
  try {
    videoUrl = await seedanceInputUrl(body.videoUrl);
    avatarUrl = await seedanceInputUrl(body.avatarUrl);
    productUrl = await seedanceInputUrl(body.productUrl);
  } catch (e) {
    if (e instanceof NonPublicMediaUrlError) {
      return NextResponse.json({ error: 'media_url_not_public', detail: e.value }, { status: 400 });
    }
    throw e;
  }
  if (!videoUrl) return NextResponse.json({ error: 'video_url_required' }, { status: 400 });
  // 纯 omni:一次 video-edit 同时换人+换产品,avatar / product 至少一个。
  if (!avatarUrl && !productUrl) return NextResponse.json({ error: 'avatar_or_product_required' }, { status: 400 });

  // omni video-edit 按参考视频秒数计费;前端上传时读出时长随 body.videoSeconds 传来,缺省保守用 30s。
  const videoSeconds = Number(body.videoSeconds) > 0 ? Number(body.videoSeconds) : 30;
  const model = isSeedanceVideoModel(body.model) && String(body.model).endsWith('/reference-to-video') ? String(body.model) : AD_REF_EDIT_MODEL;

  const { prompt } = buildEditRequest({
    videoUrl,
    avatarUrl: avatarUrl || undefined,
    productUrl: productUrl || undefined,
    productNote: cleanRefText(body.productNote, '', 300),
    extraNote: cleanRefText(body.extraNote, '', 500),
  });

  try {
    const submit = await chargeAndSubmit({
      uid,
      cost: await configuredVideoCredits(model, '720p', videoSeconds),
      ref: 'ad-reference:edit',
      templateId: 'adref:edit',
      model,
      prompt,
      submit: () => submitAdRefEdit(videoUrl, prompt, [avatarUrl, productUrl].filter(Boolean), model, Number(body.videoSeconds)),
    });
    return NextResponse.json({ id: submit.id, getUrl: submit.getUrl, prompt });
  } catch (e) {
    return chargeErrorResponse(e, 'ad-reference/edit');
  }
}

export const POST = withAtlas(handler);
