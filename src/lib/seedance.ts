/** Seedance 2.0 model IDs shipped by the provider. Keep these in code. */
export const SEEDANCE_MODELS = {
  standard: {
    imageToVideo: 'bytedance/seedance-2.0/image-to-video',
    referenceToVideo: 'bytedance/seedance-2.0/reference-to-video',
    textToVideo: 'bytedance/seedance-2.0/text-to-video',
  },
  fast: {
    imageToVideo: 'bytedance/seedance-2.0-fast/image-to-video',
    referenceToVideo: 'bytedance/seedance-2.0-fast/reference-to-video',
    textToVideo: 'bytedance/seedance-2.0-fast/text-to-video',
  },
} as const;

export type SeedanceVariant = keyof typeof SEEDANCE_MODELS;
export type SeedanceInput = keyof typeof SEEDANCE_MODELS.standard;

export const SEEDANCE_VARIANTS: readonly { key: SeedanceVariant; label: string }[] = [
  { key: 'standard', label: 'Seedance 2.0（普通）' },
  { key: 'fast', label: 'Seedance 2.0 Fast（快速）' },
];

export const SEEDANCE_VIDEO_MODELS = Object.values(SEEDANCE_MODELS).flatMap((models) => Object.values(models));

export const SEEDANCE_RESOLUTIONS: Record<SeedanceVariant, readonly string[]> = {
  standard: ['480p', '720p', '1080p', '720p-SR', '1080p-SR', '1440p-SR', '4k'],
  fast: ['480p', '720p', '720p-SR', '1080p-SR', '1440p-SR'],
};

export function isSeedanceVideoModel(value: unknown): value is string {
  return typeof value === 'string' && (SEEDANCE_VIDEO_MODELS as readonly string[]).includes(value);
}

export function seedanceModel(input: SeedanceInput, variant: unknown): string {
  const key: SeedanceVariant = variant === 'fast' ? 'fast' : 'standard';
  return SEEDANCE_MODELS[key][input];
}

export function seedanceVariantForModel(model: string): SeedanceVariant {
  return model.includes('seedance-2.0-fast') ? 'fast' : 'standard';
}
