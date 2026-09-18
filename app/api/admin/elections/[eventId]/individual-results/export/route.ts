import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {getIndividualElectionResults} from '@/lib/server/elections';
import {buildCsv} from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{eventId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {eventId} = await context.params;
    const records = await getIndividualElectionResults(eventId);
    if (!records) return NextResponse.json({message: 'Election not found.'}, {status: 404});
    const csv = buildCsv(['Voter', 'Member ID', 'Age group', 'Position', 'Vote', 'Submitted at'],
      records.map((record) => [record.voterName, record.memberId, record.ageGroup, record.position, record.choice, record.submittedAt]));
    return new Response(csv, {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="individual-responses.csv"'}});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Individual records could not be exported.';
    return NextResponse.json({message}, {status: message.includes('anonymous election') ? 403 : 503});
  }
}
