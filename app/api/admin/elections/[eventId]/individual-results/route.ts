import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {getIndividualElectionResults} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{eventId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {eventId} = await context.params;
    const records = await getIndividualElectionResults(eventId);
    if (!records) return NextResponse.json({message: 'Election not found.'}, {status: 404});
    return NextResponse.json({records});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Individual records could not be loaded.';
    return NextResponse.json({message}, {status: message.includes('anonymous election') ? 403 : 503});
  }
}
