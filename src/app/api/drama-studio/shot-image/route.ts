import { withAtlas } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { submitShotImage, normalizeRatio, MK_IMAGE_COST, SHOT_IMAGE_MODEL, SHOT_IMAGE_EDIT_MODEL } from '@/lib/marketing-studio/workflow';
import { chargeAndSubmit, chargeErrorResponse } from '@/lib/marketing-studio/gen-task';
import { publicOrigin } from '@/lib/settings';
import { isManagedMediaUrl, signedMediaUrl } from '@/lib/media-storage';

export const maxDuration = 60;

// 剧本分镜出图(复用 marketing 底层 nano-banana):需登录 + 扣 MK_IMAGE_COST;提交/异步失败均退款,Atlas 报错透传。
async function handler(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const uid = session.user.id;

  const body = await req.json().catch(() => ({}));
  const origin = await publicOrigin();
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 3000) : '';
  const ratio = normalizeRatio(body.ratio);
  // 相对路径(本站 /api/marketing-studio/media/...)补成绝对 URL,否则被过滤掉 → refImages 空 → 退回纯文生图,
  // 定妆图/产品/场景参考图静默失效、每镜不一致(marketing 早修过 toAbsMedia,drama 这里之前漏修)。
  const toAbs = (u: unknown): string => {
    const s = typeof u === 'string' ? u.trim() : '';
    if (s.startsWith('/api/marketing-studio/media/')) return new URL(s, origin).toString();
    return /^https?:\/\//.test(s) ? s : '';
  };
  const refImages = (await Promise.all((Array.isArray(body.refImages) ? body.refImages : []).map(async (value: unknown) => {
    const absolute = toAbs(value);
    return absolute && isManagedMediaUrl(absolute) ? signedMediaUrl(absolute, 900) : absolute;
  }))).filter(Boolean) as string[];
  if (!prompt) return NextResponse.json({ error: 'prompt_required' }, { status: 400 });

  try {
    const submit = await chargeAndSubmit({
      uid,
      cost: MK_IMAGE_COST,
      ref: 'drama:shot-image',
      templateId: 'drama-shot',
      model: refImages.length ? SHOT_IMAGE_EDIT_MODEL : SHOT_IMAGE_MODEL,
      prompt,
      submit: () => submitShotImage(prompt, ratio, refImages),
    });
    return NextResponse.json({ id: submit.id, getUrl: submit.getUrl });
  } catch (e) {
    return chargeErrorResponse(e, 'drama/shot-image');
  }
}

export const POST = withAtlas(handler);
