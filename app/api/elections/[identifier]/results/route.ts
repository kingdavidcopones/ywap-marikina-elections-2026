import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {getElectionResults} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{identifier: string}>}) {
  try {
    const {identifier} = await context.params;
    const admin = await isAdmin();
    const payload = await getElectionResults(identifier, !admin);
    if (!payload) return NextResponse.json({message: 'Election results were not found.'}, {status: 404});
    if (!admin && payload.election.status !== 'Published') {
      return NextResponse.json({message: 'Results have not been published yet.'}, {status: 403});
    }
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'Results could not be loaded.'}, {status: 503});
  }
}
