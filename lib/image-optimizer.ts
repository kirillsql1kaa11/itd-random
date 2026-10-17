import sharp from 'sharp';

export interface OptimizedImage {
  buffer: Buffer;
  contentType: string;
}

function parseImageInput(imageInput: string): Buffer | null {
  if (!imageInput || typeof imageInput !== 'string') return null;
  const dataUrlMatch = imageInput.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
  if (dataUrlMatch) {
    try {
      return Buffer.from(dataUrlMatch[1], 'base64');
    } catch {
      return null;
    }
  }
  if (/^[A-Za-z0-9+/=_-]+$/.test(imageInput.slice(0, 200)) && imageInput.length > 500) {
    try {
      return Buffer.from(imageInput.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    } catch {
      return null;
    }
  }
  return null;
}

export async function optimizeImageBuffer(imageInput: string): Promise<OptimizedImage | null> {
  const buffer = parseImageInput(imageInput);
  if (!buffer || buffer.length === 0) return null;
  try {
    const optimized = await sharp(buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
    return { buffer: optimized, contentType: 'image/webp' };
  } catch {
    return null;
  }
}
