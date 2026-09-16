import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {syncElection} from '@/lib/server/elections';
import type {ElectionEvent, EligibleVoter} from '@/lib/election-data';

export async function POST(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {election, voters = []} = await request.json() as {election: ElectionEvent; voters: EligibleVoter[]};
    return NextResponse.json({election: await syncElection(election, voters)}, {status: 201});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'The election could not be created.'}, {status: 400});
  }
}
