import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {deleteElection, syncElection} from '@/lib/server/elections';
import type {ElectionEvent, EligibleVoter} from '@/lib/election-data';

export async function PUT(request: Request, context: {params: Promise<{eventId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {eventId} = await context.params;
    const {election, voters} = await request.json() as {election: ElectionEvent; voters?: EligibleVoter[]};
    if (eventId !== election.id) return NextResponse.json({message: 'Election ID mismatch.'}, {status: 400});
    return NextResponse.json({election: await syncElection(election, voters)});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'The election could not be saved.'}, {status: 400});
  }
}

export async function DELETE(_request: Request, context: {params: Promise<{eventId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {eventId} = await context.params;
    await deleteElection(eventId);
    return NextResponse.json({ok: true});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'The election could not be deleted.'}, {status: 400});
  }
}
