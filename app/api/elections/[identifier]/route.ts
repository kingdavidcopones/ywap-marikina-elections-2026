import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {getElection} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{identifier: string}>}) {
  try {
    const {identifier} = await context.params;
    const election = await getElection(identifier, {publicOnly: !(await isAdmin())});
    if (!election) return NextResponse.json({message: 'Election not found.'}, {status: 404});
    return NextResponse.json({election});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'The election could not be loaded.'}, {status: 503});
  }
}
