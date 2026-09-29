import { SEEDANCE_VIDEO_MODELS } from '@/lib/seedance';

/** Seedance 2.0 default per-second prices. Administrators may edit these values. */
const PER_SEC_CREDITS: Record<string, Partial<Record<string, number>>> = {
  'bytedance/seedance-2.0/reference-to-video': { '480p': 3.2, '720p': 6.7, '1080p': 15.1, '4k': 34.4, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '*': 6.7 },
  'bytedance/seedance-2.0/image-to-video': { '480p': 3.2, '720p': 6.7, '1080p': 15.1, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '4k': 34.4, '*': 6.7 },
  'bytedance/seedance-2.0/text-to-video': { '480p': 3.2, '720p': 6.7, '1080p': 15.1, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '4k': 34.4, '*': 6.7 },
  'bytedance/seedance-2.0-fast/reference-to-video': { '480p': 3.2, '720p': 6.7, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '*': 6.7 },
  'bytedance/seedance-2.0-fast/image-to-video': { '480p': 3.2, '720p': 6.7, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '*': 6.7 },
  'bytedance/seedance-2.0-fast/text-to-video': { '480p': 3.2, '720p': 6.7, '720p-SR': 5.6, '1080p-SR': 12.1, '1440p-SR': 21.5, '*': 6.7 },
};

const FALLBACK_CREDITS_PER_SECOND = 7;

function rateForModel(model: string, resolution?: string): number {
  const table = PER_SEC_CREDITS[model];
  if (!table) return FALLBACK_CREDITS_PER_SECOND;
  const nums = Object.values(table).filter((v): v is number => typeof v === 'number');
  return table[resolution || ''] ?? table['*'] ?? Math.max(...nums);
}

/** Video cost is ceil(per-second price × ceil(duration)). */
export function videoCredits(model: string, resolution: string | undefined, seconds: number): number {
  const sec = Math.max(1, Math.ceil(seconds || 0));
  return Math.ceil(rateForModel(model, resolution) * sec);
}

export const estimateVideoCredits = videoCredits;

export const DEFAULT_VIDEO_PRICING_RULES = SEEDANCE_VIDEO_MODELS.flatMap((model) => {
  const resolutions = PER_SEC_CREDITS[model] || { '*': FALLBACK_CREDITS_PER_SECOND };
  return Object.entries(resolutions).filter(([resolution]) => resolution !== '*').map(([resolution, creditsPerSecond]) => ({
    model,
    resolution,
    creditsPerSecond: Math.max(0.01, creditsPerSecond || FALLBACK_CREDITS_PER_SECOND),
  }));
});

export async function ensureDefaultVideoPricingRules(): Promise<void> {
  const { prisma } = await import('@/lib/prisma');
  await prisma.$transaction(async (tx) => {
    for (const rule of DEFAULT_VIDEO_PRICING_RULES) {
      await tx.videoPricingRule.upsert({
        where: { model_resolution: { model: rule.model, resolution: rule.resolution } },
        create: rule,
        update: {},
      });
    }
  });
}

/** Reads the administrator price and falls back to the built-in default. */
export async function configuredVideoCredits(model: string, resolution: string | undefined, seconds: number): Promise<number> {
  const { prisma } = await import('@/lib/prisma');
  const rule = await prisma.videoPricingRule.findFirst({
    where: { model, resolution: { in: [resolution || '', '*'] } },
  });
  if (!rule) return videoCredits(model, resolution, seconds);
  return Math.ceil(rule.creditsPerSecond * Math.max(1, Math.ceil(seconds || 0)));
}
