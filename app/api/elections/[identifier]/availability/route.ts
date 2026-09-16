import {NextResponse} from 'next/server';
import {getElectionAvailability} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{identifier: string}>}) {
  try {
    const {identifier} = await context.params;
    const election = await getElectionAvailability(identifier);
    if (!election) return NextResponse.json({message: 'This voting link is unavailable.'}, {status: 404});

    return NextResponse.json({election});
  } catch {
    return NextResponse.json({message: 'The voting link could not be checked.'}, {status: 503});
  }
}
