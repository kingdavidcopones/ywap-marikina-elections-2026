import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {createServerSupabaseClient} from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {data, error} = await createServerSupabaseClient().from('audit_events').select('id, action, change_summary, created_at, elections(title)').order('created_at', {ascending: false}).limit(100);
    if (error) throw new Error(error.message);
    return NextResponse.json({events: data});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'Audit events could not be loaded.'}, {status: 503});
  }
}
