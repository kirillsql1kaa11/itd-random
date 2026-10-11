import { NextRequest, NextResponse } from 'next/server';
import { fetchSupabase } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
  try {
    const authors = await fetchSupabase<any[]>('authors?select=*&order=name.asc');
    return NextResponse.json({ ok: true, authors: authors || [] });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to fetch authors', details: err.message }, { status: 500 });
  }
}
