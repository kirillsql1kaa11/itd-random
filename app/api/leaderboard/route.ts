import { NextRequest, NextResponse } from 'next/server';
import { apiErrorPayload, fetchSupabaseResponse } from '@/lib/supabase-server';

const MODES = new Set(['blitz', 'survival', 'practice']);
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const modeParam = searchParams.get('mode') || 'all';
    const mode = MODES.has(modeParam) ? modeParam : 'all';
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;

    const filters = [
      'select=*',
      `order=score.desc,accuracy.desc,created_at.asc`,
      `limit=${limit}`,
      `offset=${offset}`,
    ];
    if (mode !== 'all') filters.unshift(`mode=eq.${encodeURIComponent(mode)}`);

    const res = await fetchSupabaseResponse(`leaderboard?${filters.join('&')}`, { prefer: 'count=exact' });
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}: ${details.slice(0, 200)}`);
    }

    const records = await res.json().catch(() => []);
    const contentRange = res.headers.get('content-range') || '';
    const totalRaw = contentRange.split('/')[1] || '0';
    const total = Number.isFinite(parseInt(totalRaw, 10)) ? parseInt(totalRaw, 10) : 0;
    const pages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      leaderboard: Array.isArray(records) ? records : [],
      total,
      page,
      pages,
      limit,
    });
  } catch (err: any) {
    return NextResponse.json(apiErrorPayload(err, 'Не удалось загрузить рейтинг'), { status: 500 });
  }
}
