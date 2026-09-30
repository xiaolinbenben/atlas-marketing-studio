import { withAtlas } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildEditRequest, submitAdRefEdit, cleanRefText, AD_REF_EDIT_MODEL } from '@/lib/ad-reference';
import { chargeAndSubmit, chargeErrorResponse } from '@/lib/marketing-studio/gen-task';
import { configuredVideoCredits } from '@/lib/video-pricing';
import { NonPublicMediaUrlError, toAtlasMediaUrl } from '@/lib/public-media-url';
import { prepareInputMediaForSeedance, ADREF_VIDEO_UPLOAD_LIMIT, ADREF_IMAGE_UPLOAD_LIMIT } from '@/lib/ad-reference-media';
import { publicOrigin } from '@/lib/settings';
import { isSeedanceVideoModel } from '@/lib/seedance';

export const maxDuration = 60;

// 一次 Seedance reference-to-video 同时换人、换产品并生成对白、配音和音效。
async function handler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const origin = await publicOrigin();
  let videoUrl = '';
  let avatarUrl = '';
  let productUrl = '';
  try {
    videoUrl = toAtlasMediaUrl(body.videoUrl, req, origin);
    avatarUrl = toAtlasMediaUrl(body.avatarUrl, req, origin);
    productUrl = toAtlasMediaUrl(body.productUrl, req, origin);
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
      submit: async () => {
        // 同源 S3 媒体先由服务端读取并生成短期预签名 URL，再提交给 Seedance。
        // images 顺序须与 buildEditRequest 的 "reference image N" 一致:先人像(avatar)后产品(product)。
        const atlasVideo = await prepareInputMediaForSeedance(body.videoUrl, videoUrl, req, 'adref-edit-video', ADREF_VIDEO_UPLOAD_LIMIT);
        const atlasImages: string[] = [];
        if (avatarUrl) atlasImages.push(await prepareInputMediaForSeedance(body.avatarUrl, avatarUrl, req, 'adref-edit-avatar', ADREF_IMAGE_UPLOAD_LIMIT));
        if (productUrl) atlasImages.push(await prepareInputMediaForSeedance(body.productUrl, productUrl, req, 'adref-edit-product', ADREF_IMAGE_UPLOAD_LIMIT));
        return submitAdRefEdit(atlasVideo, prompt, atlasImages, model);
      },
    });
    return NextResponse.json({ id: submit.id, getUrl: submit.getUrl, prompt });
  } catch (e) {
    return chargeErrorResponse(e, 'ad-reference/edit');
  }
}

export const POST = withAtlas(handler);
