import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';
import {getNominationYouthRecords} from '@/lib/server/nominations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
    return NextResponse.json(await getNominationYouthRecords(id, page));
  } catch (error) { return nominationErrorResponse(error, 'Youth Records could not be loaded.'); }
}
