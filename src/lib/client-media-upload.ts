'use client';

/** S3 credentials remain server-side; uploads use the authenticated API route. */
export async function uploadDirectMediaIfSupported(
  _file: Blob,
  _options: { kind: 'ad-reference' | 'reel'; filename: string },
): Promise<string> {
  return '';
}
