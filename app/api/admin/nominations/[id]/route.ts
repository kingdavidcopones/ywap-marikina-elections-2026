import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {deleteNomination, getNomination, updateNomination} from '@/lib/server/nominations';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';
type Context = {params: Promise<{id: string}>};

export async function GET(_request: Request, context: Context) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    const nomination = await getNomination(id, true);
    return nomination ? NextResponse.json({nomination}) : NextResponse.json({message: 'Nomination not found.'}, {status: 404});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be loaded.'); }
}

export async function PATCH(request: Request, context: Context) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    const action = await request.json();
    return NextResponse.json({nomination: await updateNomination(id, action)});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be saved.'); }
}

export async function DELETE(_request: Request, context: Context) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    await deleteNomination(id);
    return NextResponse.json({ok: true});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be deleted.'); }
}
