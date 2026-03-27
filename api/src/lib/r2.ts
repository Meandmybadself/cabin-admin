export function r2KeyForPhoto(takenAt: number, categoryId: string, id: string): string {
  const date = new Date(takenAt * 1000).toISOString().slice(0, 10);
  return `photos/${date}/${categoryId}/${id}`;
}

// R2 presigned URLs via the CF R2 binding use createMultipartUpload / presignedUrl methods
// available on the R2Bucket binding in Workers runtime.
export async function presignUpload(
  bucket: R2Bucket,
  key: string,
  contentType: string
): Promise<string> {
  // @ts-ignore — presignedUrl is available in the runtime but not yet typed in @cloudflare/workers-types
  const url: string = await (bucket as any).createPresignedUrl('PUT', key, {
    expiresIn: 15 * 60,
    httpMetadata: { contentType },
  });
  return url;
}

export async function presignRead(bucket: R2Bucket, key: string): Promise<string> {
  // @ts-ignore
  const url: string = await (bucket as any).createPresignedUrl('GET', key, {
    expiresIn: 60 * 60,
  });
  return url;
}
