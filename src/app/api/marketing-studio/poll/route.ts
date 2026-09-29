import { withAtlas } from '@/lib/request-context';
import { NextResponse } from 'next/server';
import { pollMarketingTask } from '@/lib/marketing-studio/poll-task';
import { getSetting } from '@/lib/settings';

export const maxDuration = 60;

// 无库代理轮询:前端传 Atlas 任务 getUrl,后端用 key 查状态。marketing/drama/ad-reference 共用。
// 完成后把输出从供应商临时地址转存到 S3，返回可内联播放/不过期的同源 url。
// 锁死 Atlas 域名防 SSRF(否则后端会带着 key 去请求任意 url)。
// 轮询本身无成本、需持有 taskId,故不加 session/不扣费;但会按 taskId 更新落库任务状态,
// Atlas 异步失败(审核block/超时等)时按 taskId 幂等退款(processing→failed 原子转移,只退一次)。
async function handler(req: Request) {
  const body = await req.json().catch(() => ({}));
  const getUrl = typeof body.getUrl === 'string' ? body.getUrl : '';
  let validUrl = getUrl.startsWith('immediate:');
  try {
    if (!validUrl) {
      const candidate = new URL(getUrl);
      const configured = new URL(await getSetting('provider.seedance.baseUrl', 'https://ark.cn-beijing.volces.com/api/v3'));
      validUrl = candidate.protocol === configured.protocol && candidate.host === configured.host && candidate.pathname.startsWith(`${configured.pathname.replace(/\/$/, '')}/contents/generations/tasks/`);
    }
  } catch { validUrl = false; }
  if (!validUrl) {
    return NextResponse.json({ error: 'invalid_get_url' }, { status: 400 });
  }
  try {
    return NextResponse.json(await pollMarketingTask(getUrl));
  } catch (error) {
    const detail = String(error);
    console.error('[marketing/poll] poll error:', detail);
    return NextResponse.json({ error: 'poll_failed', detail }, { status: 502 });
  }
}

export const POST = withAtlas(handler);
