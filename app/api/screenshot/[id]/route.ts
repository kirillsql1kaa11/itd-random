import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabase } from '@/lib/supabase-server';

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return new NextResponse('Not found', { status: 404 });

    const rows = await fetchSupabase<any[]>(`posts?id=eq.${encodeURIComponent(id)}&select=screenshot`);
    const value = Array.isArray(rows) && rows.length > 0 ? rows[0].screenshot : null;
    if (typeof value !== 'string' || !value) {
      return new NextResponse('Not found', { status: 404 });
    }

    if (/^https?:\/\//i.test(value)) {
      const upstream = await fetch(value, { cache: 'no-store' });
      if (!upstream.ok) return new NextResponse('Not found', { status: 404 });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      if (buffer.length > MAX_IMAGE_BYTES) {
        return new NextResponse('Image too large', { status: 413 });
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return new NextResponse('Not found', { status: 404 });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_IMAGE_BYTES) {
      return new NextResponse('Image too large', { status: 413 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': match[1],
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Server error', { status: 500 });
  }
}
