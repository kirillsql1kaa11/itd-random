import { NextRequest, NextResponse } from 'next/server';
import { getCachedAuthors } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const refresh = searchParams.get('refresh') === 'true';
    const authors = await getCachedAuthors(refresh);
    return NextResponse.json({ ok: true, authors: authors || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch authors', details: err.message }, { status: 500 });
  }
}
