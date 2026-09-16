import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {listElections} from '@/lib/server/elections';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const admin = await isAdmin();
    return NextResponse.json({elections: await listElections({publicOnly: !admin})});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'Elections could not be loaded.'}, {status: 503});
  }
}
