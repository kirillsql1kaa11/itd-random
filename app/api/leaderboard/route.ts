import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    let endpoint = `leaderboard?select=*&order=score.desc,accuracy.desc&limit=${limit}`;
    if (mode && mode !== 'all') {
      endpoint = `leaderboard?mode=eq.${encodeURIComponent(mode)}&select=*&order=score.desc,accuracy.desc&limit=${limit}`;
    }

    const records = await fetchSupabase<any[]>(endpoint);
    return NextResponse.json({ ok: true, leaderboard: records || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch leaderboard', details: err.message }, { status: 500 });
  }
}
