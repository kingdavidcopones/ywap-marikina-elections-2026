import {createHash} from 'node:crypto';
import {NextRequest, NextResponse} from 'next/server';
import {setVoterSession} from '@/lib/server/auth';
import {getEligiblePositionIds} from '@/lib/server/eligible-positions';
import {getElection, listElections} from '@/lib/server/elections';
import {createServerSupabaseClient} from '@/lib/supabase';

function clientKey(request: NextRequest) {
  const raw = request.headers.get('x-forwarded-for')?.split(',')[0] ?? request.headers.get('x-real-ip') ?? 'unknown';
  return createHash('sha256').update(`${raw}:${process.env.SESSION_SECRET ?? ''}`).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {memberId?: string; lastName?: string; ballotSlug?: string};
    const supabase = createServerSupabaseClient();
    const key = clientKey(request);
    const now = new Date();
    const {data: rate} = await supabase.from('verification_attempts').select('attempt_count, reset_at').eq('client_key_hash', key).maybeSingle();
    if (rate && new Date(rate.reset_at) > now && rate.attempt_count >= 8) {
      return NextResponse.json({ok: false, message: 'You’ve tried several times. Please wait 15 minutes, or contact the election committee for help.'}, {status: 429});
    }

    const election = body.ballotSlug
      ? await getElection(body.ballotSlug)
      : (await listElections({publicOnly: true})).find((item) => item.status === 'Open' || item.status === 'Published');
    const canOpenAutomatically = election?.status === 'Scheduled' && Boolean(election.opensAt) && now >= new Date(election.opensAt);
    const isPublished = election?.status === 'Published';
    const isVotingStatus = election?.status === 'Open' || isPublished || canOpenAutomatically;
    if (!election || !isVotingStatus || !election.opensAt || now < new Date(election.opensAt) || (election.closesAt && now > new Date(election.closesAt))) {
      return NextResponse.json({ok: false, message: 'There is no election open for voting right now.'}, {status: 404});
    }

    const memberId = body.memberId?.trim().toUpperCase() ?? '';
    const lastName = body.lastName?.trim().toLocaleLowerCase('en') ?? '';
    const {data: voter, error} = await supabase.from('eligible_voters')
      .select('id, member_id, first_name, age_group, participation(submitted_at)')
      .eq('election_id', election.id).eq('member_id_normalized', memberId).eq('last_name_normalized', lastName).eq('eligible', true).maybeSingle();
    if (error) throw new Error(error.message);

    if (!voter) {
      const nextCount = rate && new Date(rate.reset_at) > now ? rate.attempt_count + 1 : 1;
      const resetAt = rate && new Date(rate.reset_at) > now ? rate.reset_at : new Date(now.getTime() + 15 * 60 * 1000).toISOString();
      await supabase.from('verification_attempts').upsert({client_key_hash: key, attempt_count: nextCount, reset_at: resetAt});
      return NextResponse.json({ok: false, message: 'We couldn’t find a matching voter record. Check your Member ID and last name, or contact the election committee.'}, {status: 401});
    }
    if ((voter.participation as Array<{submitted_at: string | null}> | null)?.some((item) => item.submitted_at)) {
      return NextResponse.json({ok: false, message: 'A ballot has already been submitted for this voter.'}, {status: 409});
    }

    if (election.status !== 'Open') {
      const {error: openError} = await supabase.from('elections').update({status: 'open'}).eq('id', election.id);
      if (openError) throw new Error(openError.message);
    }

    await supabase.from('verification_attempts').delete().eq('client_key_hash', key);
    const ageGroup = voter.age_group === 'young_people' ? 'Young People' : voter.age_group === 'young_adults' ? 'Young Adults' : 'Teens';
    const eligiblePositionIds = await getEligiblePositionIds(election.id, voter.id);
    await supabase.from('participation').upsert({election_id: election.id, eligible_voter_id: voter.id, verified_at: now.toISOString()}, {onConflict: 'election_id,eligible_voter_id'});
    await setVoterSession({voterId: voter.id, electionId: election.id, memberId: voter.member_id, firstName: voter.first_name.split(/\s+/)[0], ageGroup, ballotSlug: election.ballotSlug});
    return NextResponse.json({ok: true, voter: {memberId: voter.member_id, firstName: voter.first_name.split(/\s+/)[0], ageGroup, ballotSlug: election.ballotSlug, eligiblePositionIds}});
  } catch (error) {
    return NextResponse.json({ok: false, message: error instanceof Error ? error.message : 'Voter verification is unavailable.'}, {status: 503});
  }
}
