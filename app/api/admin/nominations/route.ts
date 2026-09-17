import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {createNomination, listNominations} from '@/lib/server/nominations';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';
import {NominationError} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try { return NextResponse.json({nominations: await listNominations()}); }
  catch (error) { return nominationErrorResponse(error, 'Nominations could not be loaded.'); }
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NominationError('Send valid nomination details.');
    const {name, description} = body;
    return NextResponse.json({nomination: await createNomination(name, description)}, {status: 201});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be created.'); }
}
