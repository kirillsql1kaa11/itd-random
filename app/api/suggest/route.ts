import { NextRequest, NextResponse } from 'next/server';
import { apiErrorPayload, fetchSupabase } from '@/lib/supabase-server';
import { uploadDataUrlScreenshot } from '@/lib/storage';

const MAX_BODY_BYTES = 4 * 1024 * 1024;
const MAX_SCREENSHOT_CHARS = 3 * 1024 * 1024;

function str(value: any, max: number): string {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').slice(0, max) : '';
}

function markerValue(value: any, max: number): string {
  return str(value, max).replace(/[\[\]]/g, '');
}

function isItdUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return host === 'xn--d1ah4a.com' || host.endsWith('.xn--d1ah4a.com');
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Некорректный запрос' }, { status: 400 });
    }

    if (Buffer.byteLength(JSON.stringify(body)) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Слишком большой запрос (максимум 4 МБ)' }, { status: 413 });
    }

    if (body.type === 'author' || (!body.screenshot && body.name)) {
      const name = str(body.name || body.author_name, 100);
      if (!name) {
        return NextResponse.json({ error: 'Укажите имя автора' }, { status: 400 });
      }

      const handle = str(body.handle, 100);
      const cleanHandle = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : `@${name.toLowerCase().replace(/[^a-z0-9_]/gi, '')}`;

      const profileUrl = str(body.profileUrl || body.profile_url, 300);
      if (profileUrl && !isItdUrl(profileUrl)) {
        return NextResponse.json({ error: 'Ссылка на профиль должна вести на ИТД' }, { status: 400 });
      }

      const segments: string[] = [];
      const bio = markerValue(body.bio, 1000);
      if (bio) segments.push(bio);
      if (profileUrl) segments.push(`[PROFILE: ${profileUrl}]`);
      const badge = markerValue(body.badge, 50);
      if (badge) segments.push(`[BADGE: ${badge}]`);
      const avatarColor = markerValue(body.avatarColor || body.avatar_color, 100);
      if (avatarColor) segments.push(`[COLOR: ${avatarColor}]`);

      const authorRecord = {
        name,
        handle: cleanHandle,
        bio: segments.join('\n\n'),
        submitted_by: str(body.submitted_by, 50) || 'Аноним',
        status: 'pending',
      };

      await fetchSupabase('suggestions_authors', {
        method: 'POST',
        prefer: 'return=minimal',
        body: authorRecord,
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

    const postUrl = str(body.itd_url || body.post_url, 300);
    if (postUrl && !isItdUrl(postUrl)) {
      return NextResponse.json({ error: 'Ссылка должна вести на пост ИТД' }, { status: 400 });
    }

    const screenshotUrl = await uploadDataUrlScreenshot(screenshot, 'suggestions');

    const segments: string[] = [];
    if (postUrl) segments.push(`[URL: ${postUrl}]`);
    const hint = markerValue(body.hint, 200);
    if (hint) segments.push(`[HINT: ${hint}]`);
    if (Array.isArray(body.tags) && body.tags.length > 0) {
      const tags = body.tags.map((t: any) => markerValue(t, 30)).filter(Boolean).slice(0, 8);
      if (tags.length > 0) segments.push(`[TAGS: ${tags.join(', ')}]`);
    }
    const postText = markerValue(body.post_text, 2000);
    if (postText) segments.push(postText);

    const record = {
      author_id: str(body.author_id, 100) || null,
      author_name: str(body.author_name, 100) || 'Не указан',
      screenshot: screenshotUrl,
      post_text: segments.join('\n'),
      submitted_by: str(body.submitted_by, 50) || 'Аноним',
      status: 'pending',
    };

    await fetchSupabase('suggestions_posts', {
      method: 'POST',
      prefer: 'return=minimal',
      body: record,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(apiErrorPayload(err, 'Не удалось сохранить предложение'), { status: 500 });
  }
}
