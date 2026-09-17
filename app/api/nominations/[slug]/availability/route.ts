import {NextResponse} from 'next/server';
import {getNominationAvailability} from '@/lib/server/nominations';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await context.params;
    const availability = await getNominationAvailability(slug);
    if (!availability) return NextResponse.json({message: 'This nomination link is unavailable.'}, {status: 404});
    return NextResponse.json({availability});
  } catch (error) { return nominationErrorResponse(error, 'Nomination availability could not be checked.'); }
}
