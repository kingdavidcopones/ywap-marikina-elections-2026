import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase';

export async function getEligiblePositionIds(electionId: string, voterId: string): Promise<string[]> {
  const supabase = createServerSupabaseClient();
  const {data, error} = await supabase.rpc('eligible_position_ids', {
    p_election_id: electionId,
    p_voter_id: voterId,
  });
  if (!error) return data ?? [];
  if (error.code !== 'PGRST202') throw new Error(error.message);

  // Older databases have neither this RPC nor custom voting rules. Never fall
  // back to group-only checks if the voting_rule column exists.
  const {error: ruleColumnError} = await supabase.from('positions').select('voting_rule').limit(0);
  if (ruleColumnError?.code !== '42703') {
    throw new Error(ruleColumnError?.message ?? 'The election database migration is incomplete.');
  }

  const {data: voter, error: voterError} = await supabase.from('eligible_voters')
    .select('age_group')
    .eq('id', voterId)
    .eq('election_id', electionId)
    .eq('eligible', true)
    .maybeSingle();
  if (voterError) throw new Error(voterError.message);
  if (!voter) return [];

  const {data: positions, error: positionsError} = await supabase.from('positions')
    .select('id, group_scope')
    .eq('election_id', electionId)
    .order('display_order');
  if (positionsError) throw new Error(positionsError.message);
  return (positions ?? [])
    .filter((position) => position.group_scope === 'general' || position.group_scope === voter.age_group)
    .map((position) => position.id);
}
