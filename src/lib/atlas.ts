import 'server-only';
import crypto from 'node:crypto';

/**
 * Atlas Cloud generation client.
 *
 * Submit async task -> poll until completed. Never long-poll inside one
 * serverless request: submitGen returns { id, getUrl } immediately, and the
 * client polls /api/creations/[id] which calls pollOnce once per request.
 *
 * The browser User-Agent keeps provider gateways that filter generic clients happy.
 *
 * NOTE on input-image field names — they differ by model:
 *   - image-edit (seedream/qwen .../edit): plural `images`
 *   - seedance image-to-video:            singular `image`
 * so each template declares its own `imageField`.
 */
import { getSettings } from '@/lib/settings';
import { putMedia, putDataUrl, signedMediaUrl } from '@/lib/media-storage';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function serviceConfig(kind: 'video' | 'image' | 'openai' = 'video'): Promise<{ base: string; key: string }> {
  const values = await getSettings(kind === 'video' ? ['provider.seedance.baseUrl', 'provider.seedance.apiKey'] : ['provider.openai.baseUrl', 'provider.openai.apiKey']);
  const base = values[kind === 'video' ? 'provider.seedance.baseUrl' : 'provider.openai.baseUrl'] || (kind === 'video' ? 'https://ark.cn-beijing.volces.com/api/v3' : 'https://api.openai.com/v1');
  const key = values[kind === 'video' ? 'provider.seedance.apiKey' : 'provider.openai.apiKey'] || '';
  if (!key) throw new Error(`${kind === 'video' ? 'seedance' : 'openai'}_provider_not_configured`);
  return { base: base.replace(/\/+$/, ''), key };
}

export async function submitRawGen(
  endpoint: 'generateImage' | 'generateVideo' | 'generateAudio',
  payload: Record<string, unknown>,
): Promise<SubmitResult> {
  let resp: any;
  if (endpoint === 'generateImage') {
    resp = await submitOpenAIImage(payload);
  } else {
    const content: unknown[] = [];
    if (typeof payload.prompt === 'string' && payload.prompt) content.push({ type: 'text', text: payload.prompt });
    if (!content.length && typeof payload.text === 'string' && payload.text) content.push({ type: 'text', text: payload.text });
    const imageValues = Array.isArray(payload.reference_images)
      ? payload.reference_images
      : Array.isArray(payload.images) ? payload.images : payload.image ? [payload.image] : [];
    for (const image of imageValues) content.push({ type: 'image_url', image_url: { url: image } });
    const videoValues = Array.isArray(payload.reference_videos)
      ? payload.reference_videos
      : typeof payload.video === 'string' ? [payload.video] : [];
    for (const video of videoValues) content.push({ type: 'video_url', video_url: { url: video } });
    const { base, key } = await serviceConfig('video');
    const requestBody = {
      model: payload.model,
      content,
      duration: payload.duration,
      resolution: payload.resolution,
      ratio: payload.ratio,
      generate_audio: payload.generate_audio ?? true,
      watermark: payload.watermark,
      return_last_frame: payload.return_last_frame,
    };
    const response = await fetch(`${base}/contents/generations/tasks`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA }, body: JSON.stringify(requestBody), cache: 'no-store' });
    resp = await response.json();
    if (!response.ok) throw new Error(`Seedance submit ${response.status}: ${JSON.stringify(resp)}`);
  }
  const d = resp.data || resp;
  const service = await serviceConfig(endpoint === 'generateImage' ? 'image' : 'video');
  if (endpoint === 'generateImage') {
    const output = imageOutput(d);
    if (!output) throw new Error(`image_provider_returned_no_output:${JSON.stringify(resp)}`);
    const storedOutput = output.startsWith('data:')
      ? await putDataUrl(`generated/${crypto.randomUUID()}.png`, output)
      : output;
    return { id: `image-${crypto.randomUUID()}`, getUrl: `immediate:${encodeURIComponent(storedOutput)}` };
  }
  const id = d.id || d.task_id;
  if (!id) throw new Error(`Seedance returned no task id: ${JSON.stringify(resp)}`);
  return { id, getUrl: d?.urls?.get || `${service.base}/contents/generations/tasks/${id}` };
}

function imageOutput(value: any): string {
  const item = Array.isArray(value) ? value[0] : Array.isArray(value?.data) ? value.data[0] : Array.isArray(value?.output) ? value.output[0] : value?.output || value;
  if (typeof item?.url === 'string') return item.url;
  if (typeof item?.b64_json === 'string') return `data:image/png;base64,${item.b64_json}`;
  if (typeof item === 'string') return item;
  return '';
}

async function submitOpenAIImage(payload: Record<string, unknown>): Promise<any> {
  const service = await serviceConfig('image');
  const model = String(payload.model || 'gpt-image-2');
  const images = (Array.isArray(payload.images) ? payload.images : []).filter((value): value is string => typeof value === 'string' && value.length > 0);
  const endpoint = images.length ? `${service.base}/images/edits` : `${service.base}/images/generations`;
  const size = String(payload.size || ({ '9:16': '1024x1536', '16:9': '1536x1024', '3:4': '1024x1365', '4:3': '1365x1024', '1:1': '1024x1024' } as Record<string, string>)[String(payload.aspect_ratio || '')] || '1024x1024');
  if (!images.length) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${service.key}`, 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ model, prompt: payload.prompt, n: 1, size, quality: payload.quality || 'auto' }),
      cache: 'no-store',
    });
    const json = await response.json();
    if (!response.ok) throw new Error(`GPT image ${response.status}: ${JSON.stringify(json)}`);
    return json;
  }
  const form = new FormData();
  form.set('model', model);
  form.set('prompt', String(payload.prompt || ''));
  form.set('n', '1');
  form.set('size', size);
  for (const [index, source] of images.entries()) {
    const response = await fetch(source, { headers: { 'User-Agent': UA }, cache: 'no-store' });
    if (!response.ok) throw new Error(`image_reference_fetch_${response.status}`);
    const bytes = await response.arrayBuffer();
    form.append('image', new Blob([bytes], { type: response.headers.get('content-type') || 'image/png' }), `reference-${index}.png`);
  }
  const response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${service.key}`, 'User-Agent': UA }, body: form, cache: 'no-store' });
  const json = await response.json();
  if (!response.ok) throw new Error(`GPT image ${response.status}: ${JSON.stringify(json)}`);
  return json;
}

async function get(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000); // 查询 25s 超时
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${(await serviceConfig('video')).key}`, 'User-Agent': UA },
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e) {
    // 超时/中断:抛成 timeout —— poll route 会当网关瞬时错误(前端继续轮询,不误判整体失败)
    throw new Error(`Atlas poll timeout: ${String((e as Error)?.message || e)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Atlas poll ${res.status}: ${await res.text()}`);
  return res.json();
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string } {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) throw new Error('invalid data url');
  const mime = match[1];
  const body = match[3];
  const bytes = match[2]
    ? Buffer.from(body, 'base64')
    : Buffer.from(decodeURIComponent(body), 'utf8');
  const extension =
    mime.includes('png')
      ? 'png'
      : mime.includes('webp')
        ? 'webp'
        : mime.includes('mp4')
          ? 'mp4'
          : mime.includes('mpeg') || mime.includes('mp3')
            ? 'mp3'
            : mime.includes('wav')
              ? 'wav'
              : mime.includes('webm')
                ? 'webm'
                : mime.includes('quicktime')
                  ? 'mov'
                  : 'bin';
  return { blob: new Blob([bytes], { type: mime }), extension };
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function mediaExtension(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  if (ct.includes('jpeg') || ct.includes('jpg')) return 'jpg';
  if (ct.includes('mp4')) return 'mp4';
  if (ct.includes('quicktime')) return 'mov';
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('m4a')) return 'm4a';
  return 'bin';
}

function sniffMedia(bytes: Uint8Array, declared: string): { contentType: string; extension: string } {
  if (bytes.length >= 12) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { contentType: 'image/jpeg', extension: 'jpg' };
    }
    if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') {
      return { contentType: 'image/png', extension: 'png' };
    }
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
      return { contentType: 'image/webp', extension: 'webp' };
    }
    if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') {
      return { contentType: 'audio/wav', extension: 'wav' };
    }
    if (ascii(bytes, 4, 8) === 'ftyp') {
      const brand = ascii(bytes, 8, 12);
      return brand === 'qt  '
        ? { contentType: 'video/quicktime', extension: 'mov' }
        : { contentType: 'video/mp4', extension: 'mp4' };
    }
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return { contentType: 'video/webm', extension: 'webm' };
  }
  if (bytes.length >= 3 && ascii(bytes, 0, 3) === 'ID3') {
    return { contentType: 'audio/mpeg', extension: 'mp3' };
  }
  return { contentType: declared || 'application/octet-stream', extension: mediaExtension(declared) };
}

export async function uploadBlobToStorage(blob: Blob, filename: string): Promise<string> {
  const key = `${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const path = await putMedia(key, await blob.arrayBuffer(), blob.type || 'application/octet-stream');
  return signedMediaUrl(path, 900);
}

export async function uploadMediaToStorage(dataUrl: string, filenamePrefix = 'media'): Promise<string> {
  const { blob, extension } = dataUrlToBlob(dataUrl);
  return uploadBlobToStorage(blob, `${filenamePrefix}.${extension}`);
}

export async function uploadRemoteMediaToStorage(
  sourceUrl: string,
  filenamePrefix = 'media',
  maxBytes = 200_000_000,
): Promise<string> {
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new Error(`Media fetch ${res.status}: ${await res.text()}`);
  const len = Number(res.headers.get('content-length') || 0);
  if (len > maxBytes) throw new Error(`media_too_large:${len}`);
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength > maxBytes) throw new Error(`media_too_large:${buffer.byteLength}`);
  const declared = res.headers.get('content-type') || 'application/octet-stream';
  const meta = sniffMedia(new Uint8Array(buffer), declared);
  return uploadBlobToStorage(new Blob([buffer], { type: meta.contentType }), `${filenamePrefix}.${meta.extension}`);
}

export interface GenInput {
  endpoint: 'generateImage' | 'generateVideo' | 'generateAudio';
  model: string;
  prompt?: string;
  /** audio generation text prompt */
  text?: string;
  /** input image (http url or data: URI) */
  image?: string;
  /** multiple input images (http urls or data: URIs) */
  images?: string[];
  /** which payload key the model expects the input image under */
  imageField?: 'image' | 'images';
  /** extra model params, e.g. { duration: 5, resolution: '720p' } */
  extra?: Record<string, unknown>;
}

export interface SubmitResult {
  id: string;
  getUrl: string;
}

export async function submitGen(input: GenInput): Promise<SubmitResult> {
  const payload: Record<string, unknown> = { model: input.model };
  if (input.prompt) payload.prompt = input.prompt;
  if (input.text) payload.text = input.text;
  if (input.images?.length) {
    const field = input.imageField || 'images';
    payload[field] = field === 'images' ? input.images : input.images[0];
  } else if (input.image) {
    const field = input.imageField || 'images';
    payload[field] = field === 'images' ? [input.image] : input.image;
  }
  Object.assign(payload, input.extra || {});

  return submitRawGen(input.endpoint, payload);
}

export type AtlasStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface PollResult {
  status: AtlasStatus;
  outputs: string[];
  error?: string;
  raw: any;
}

function outputUrl(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const url = record.url || record.download_url || record.output || record.uri || record.video_url || record.image_url;
  return typeof url === 'string' ? url : '';
}

function collectOutputUrls(value: unknown, result: string[] = []): string[] {
  if (typeof value === 'string' && /^https?:\/\//.test(value)) result.push(value);
  else if (value && typeof value === 'object') {
    const direct = outputUrl(value);
    if (direct) result.push(direct);
    const record = value as Record<string, unknown>;
    for (const key of ['outputs', 'output', 'content', 'data', 'result', 'video_url', 'image_url']) {
      const child = record[key];
      if (child && child !== value) collectOutputUrls(child, result);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) collectOutputUrls(item, result);
  }
  return [...new Set(result)];
}

function errorText(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return String(value).slice(0, 500);
  }
}

/** One poll request against the task's get URL. Safe for serverless. */
export async function pollOnce(getUrl: string): Promise<PollResult> {
  if (getUrl.startsWith('immediate:')) {
    const value = decodeURIComponent(getUrl.slice('immediate:'.length));
    return { status: 'completed', outputs: value ? [value] : [], raw: { output: value } };
  }
  const r = await get(getUrl);
  const d = r?.data ?? r;
  const rawStatus = String(d?.status ?? 'processing').toLowerCase();
  const status: AtlasStatus =
    rawStatus === 'completed' || rawStatus === 'succeeded' || rawStatus === 'success'
      ? 'completed'
      : rawStatus === 'failed' || rawStatus === 'error' || rawStatus === 'canceled' || rawStatus === 'cancelled'
        ? 'failed'
        : rawStatus === 'pending' || rawStatus === 'starting' || rawStatus === 'queued'
          ? 'pending'
          : 'processing';
  const outputs = collectOutputUrls(d);
  return {
    status,
    outputs,
    error: errorText(d?.error),
    raw: d,
  };
}

export const DEFAULT_CHAT_MODEL = 'gpt-5.6-sol';
const CHAT_TIMEOUT_MS = 45_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

export async function atlasChat(
  messages: ChatMessage[],
  model = DEFAULT_CHAT_MODEL,
  maxTokens = 900,
  timeoutMs = CHAT_TIMEOUT_MS,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const service = await serviceConfig('openai');
    const res = await fetch(`${service.base}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${service.key}`,
        'Content-Type': 'application/json',
        'User-Agent': UA,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens,
        stream: false,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Atlas chat ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Atlas chat returned empty content');
    return content.trim();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Atlas chat timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
