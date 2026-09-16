import {NextResponse} from 'next/server';
import {getVoterToken} from '@/lib/server/auth';
import {createServerSupabaseClient} from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const voter = await getVoterToken();
    if (!voter) return NextResponse.json({message: 'Verify your voter record before submitting.'}, {status: 401});
    const {selections} = await request.json() as {selections?: Record<string, string>};
    if (!selections || typeof selections !== 'object') return NextResponse.json({message: 'The ballot is incomplete.'}, {status: 400});
    const {data, error} = await createServerSupabaseClient().rpc('submit_ballot', {
      p_election_id: voter.electionId, p_voter_id: voter.voterId, p_selections: selections,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({submittedAt: data});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The ballot could not be submitted.';
    return NextResponse.json({message}, {status: /already been submitted/i.test(message) ? 409 : 400});
  }
}
