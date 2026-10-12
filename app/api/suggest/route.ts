import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabase } from '@/lib/supabase-server';
import { optimizeScreenshot } from '@/lib/image-optimizer';

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

    if (body.type === 'author' || (!body.screenshot && body.name)) {
      const name = str(body.name || body.author_name, 100);
      if (!name) {
        return NextResponse.json({ error: 'Укажите имя автора' }, { status: 400 });
      }

      const handle = str(body.handle, 100);
      const cleanHandle = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : `@${name.toLowerCase().replace(/[^a-z0-9_]/gi, '')}`;

      let fullBio = str(body.bio, 1000);
      const profileUrl = str(body.profileUrl || body.profile_url, 300);
      if (profileUrl) {
        fullBio = fullBio ? `${fullBio}\n\n[PROFILE: ${profileUrl}]` : `[PROFILE: ${profileUrl}]`;
      }
      const badge = str(body.badge, 50);
      if (badge) {
        fullBio += `\n[BADGE: ${badge}]`;
      }
      const avatarColor = str(body.avatarColor || body.avatar_color, 100);
      if (avatarColor) {
        fullBio += `\n[COLOR: ${avatarColor}]`;
      }

      const authorRecord = {
        name,
        handle: cleanHandle,
        bio: fullBio,
        submitted_by: str(body.submitted_by, 50) || 'Аноним',
        status: 'pending'
      };

      await fetchSupabase('suggestions_authors', {
        method: 'POST',
        prefer: 'return=minimal',
        body: authorRecord
      });

      return NextResponse.json({ ok: true });
    }

    const screenshot = body.screenshot;
    if (typeof screenshot !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(screenshot)) {
      return NextResponse.json({ error: 'Некорректный скриншот' }, { status: 400 });
    }

    if (screenshot.length > MAX_SCREENSHOT_CHARS) {
      return NextResponse.json({ error: 'Скриншот слишком большой' }, { status: 413 });
    }

    let fullText = str(body.post_text, 2000);
    const postUrl = str(body.itd_url || body.post_url, 300);
    if (postUrl) {
      fullText = `[URL: ${postUrl}]\n${fullText}`;
    }
    const hint = str(body.hint, 200);
    if (hint) {
      fullText = `[HINT: ${hint}]\n${fullText}`;
    }
    if (Array.isArray(body.tags) && body.tags.length > 0) {
      fullText = `[TAGS: ${body.tags.join(', ')}]\n${fullText}`;
    }

    const compressedScreenshot = await optimizeScreenshot(screenshot);

    const record = {
      author_id: str(body.author_id, 100) || null,
      author_name: str(body.author_name, 100) || 'Не указан',
      screenshot: compressedScreenshot,
      post_text: fullText,
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
