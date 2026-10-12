import sharp from 'sharp';

export async function optimizeScreenshot(imageInput: string): Promise<string> {
  if (!imageInput || typeof imageInput !== 'string') return imageInput;

  try {
    let buffer: Buffer;

    if (imageInput.startsWith('data:image/')) {
      const match = imageInput.match(/^data:image\/[a-zA-Z+]+;base64,(.+)$/);
      if (!match) return imageInput;
      buffer = Buffer.from(match[1], 'base64');
    } else if (/^[A-Za-z0-9+/=]+$/.test(imageInput.slice(0, 100)) && imageInput.length > 500) {
      buffer = Buffer.from(imageInput, 'base64');
    } else {
      return imageInput;
    }

    const optimized = await sharp(buffer)
      .resize({
        width: 1200,
        withoutEnlargement: true,
      })
      .webp({
        quality: 80,
        effort: 4,
      })
      .toBuffer();

    return `data:image/webp;base64,${optimized.toString('base64')}`;
  } catch {
    return imageInput;
  }
}
