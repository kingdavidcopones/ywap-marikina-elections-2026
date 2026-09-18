import {NextResponse} from 'next/server';
import {checkNominationEmailAvailable} from '@/lib/server/nominations';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await context.params;
    const email = new URL(request.url).searchParams.get('email') ?? '';
    return NextResponse.json({available: await checkNominationEmailAvailable(slug, email)});
  } catch (error) { return nominationErrorResponse(error, 'Email could not be checked.'); }
}
