import { withAtlas } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  cleanText,
  normalizeVideoDuration,
  normalizeVideoRatio,
  normalizeVideoResolutionForModel,
  submitShotVideo,
  submitShotRefVideo,
  normalizeSeedanceModel,
} from '@/lib/marketing-studio/workflow';
import {
  chargeAndSubmit,
  chargeErrorResponse,
  linkMarketingCreationTask,
} from '@/lib/marketing-studio/gen-task';
import { configuredVideoCredits } from '@/lib/video-pricing';
import { publicOrigin } from '@/lib/settings';
import { isManagedMediaUrl, signedMediaUrl } from '@/lib/media-storage';

export const maxDuration = 60;

// 逐镜出视频(Seedance 2.0 i2v):需登录 + 扣 MK_VIDEO_COST;提交失败退款、异步失败由 poll 退款,Atlas 报错透传。
async function handler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const origin = await publicOrigin(req);
  const prompt = cleanText(body.prompt, '', 3000);
  const ratio = normalizeVideoRatio(body.ratio);
  const duration = normalizeVideoDuration(body.duration);
  const requestedModel = typeof body.model === 'string' ? body.model : '';
  const creationId = typeof body.creationId === 'string' ? body.creationId.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  // 本站相对路径(/api/marketing-studio/media/...)补成公网绝对 URL,否则 Atlas 拉不到。
  const toAbs = (u: unknown): string => {
    const s = typeof u === 'string' ? u.trim() : '';
    if (s.startsWith('/api/marketing-studio/media/')) return new URL(s, origin).toString();
    return /^https?:\/\//.test(s) ? s : '';
  };

  // drama 逐镜:传了 referenceImages[] 就走 reference-to-video(产品图+角色定妆图+场景图 直接出视频);
  // 否则 marketing 单首帧 i2v(imageUrl)。
  const referenceImages = await Promise.all((Array.isArray(body.referenceImages) ? body.referenceImages : []).map(async (value: unknown) => {
    const absolute = toAbs(value);
    return absolute && isManagedMediaUrl(absolute) ? signedMediaUrl(absolute, 900) : absolute;
  })).then((values) => values.filter(Boolean) as string[]);

  try {
    if (referenceImages.length) {
      const model = normalizeSeedanceModel(requestedModel, 'referenceToVideo');
      const resolution = normalizeVideoResolutionForModel(body.resolution, model);
      const submit = await chargeAndSubmit({
        uid,
        cost: await configuredVideoCredits(model, resolution, duration),
        ref: 'drama:ref-video',
        templateId: 'mk-shot',
        model,
        prompt,
        submit: () => submitShotRefVideo(referenceImages, prompt, { ratio, resolution, duration, model }),
      });
      return NextResponse.json({ id: submit.id, getUrl: submit.getUrl });
    }

    const rawImageUrl = toAbs(body.imageUrl);
    const imageUrl = rawImageUrl && isManagedMediaUrl(rawImageUrl) ? await signedMediaUrl(rawImageUrl, 900) : rawImageUrl;
    if (!/^https?:\/\//.test(imageUrl)) return NextResponse.json({ error: 'image_url_required' }, { status: 400 });
    const model = normalizeSeedanceModel(requestedModel, 'imageToVideo');
    const resolution = normalizeVideoResolutionForModel(body.resolution, model);
    const submit = await chargeAndSubmit({
      uid,
      cost: await configuredVideoCredits(model, resolution, duration),
      ref: 'marketing:shot-video',
      templateId: 'mk-shot',
      model,
      prompt,
      submit: () => submitShotVideo(imageUrl, prompt, { ratio, resolution, duration, model }),
    });
    const parentLinked = await linkMarketingCreationTask({
      uid,
      creationId,
      taskId: submit.id,
      getUrl: submit.getUrl,
      model,
    });
    return NextResponse.json({ id: submit.id, getUrl: submit.getUrl, parentLinked });
  } catch (e) {
    return chargeErrorResponse(e, 'marketing/shot-video');
  }
}

export const POST = withAtlas(handler);
