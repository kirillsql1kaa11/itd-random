import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabase } from '@/lib/supabase-server';

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_SCREENSHOT_CHARS = 1.5 * 1024 * 1024;

function str(value: any, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Слишком большой запрос (максимум 2 МБ)' }, { status: 413 });
    }

    const screenshot = body.screenshot;
    if (typeof screenshot !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshot)) {
      return NextResponse.json({ error: 'Некорректный скриншот' }, { status: 400 });
    }

    if (screenshot.length > MAX_SCREENSHOT_CHARS) {
      return NextResponse.json({ error: 'Скриншот слишком большой' }, { status: 413 });
    }

    const record = {
      author_id: str(body.author_id, 100) || null,
      author_name: str(body.author_name, 100) || 'Не указан',
      screenshot,
      post_text: str(body.post_text, 2000),
      submitted_by: str(body.submitted_by, 50) || 'Аноним',
      status: 'pending'
    };

    await fetchSupabase('suggestions_posts', {
      method: 'POST',
      prefer: 'return=minimal',
      body: record
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Не удалось сохранить предложение', details: err.message }, { status: 500 });
  }
}
