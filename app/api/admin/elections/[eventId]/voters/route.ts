import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {getElectionVoters} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{eventId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {eventId} = await context.params;
    return NextResponse.json({voters: await getElectionVoters(eventId)});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'Voters could not be loaded.'}, {status: 503});
  }
}
