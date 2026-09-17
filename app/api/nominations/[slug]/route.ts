import {NextResponse} from 'next/server';
import {getNomination} from '@/lib/server/nominations';
import {isAdmin} from '@/lib/server/auth';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await context.params;
    const admin = await isAdmin();
    const nomination = await getNomination(slug, admin);
    if (!nomination) return NextResponse.json({message: 'This nomination is unavailable.'}, {status: 404});
    const now = Date.now();
    const live = (nomination.status === 'Published' || (nomination.status === 'Scheduled' && Date.parse(nomination.opensAt) <= now))
      && (!nomination.closesAt || Date.parse(nomination.closesAt) >= now);
    return NextResponse.json({nomination: {...nomination, youthRecords: [], nominees: []}, preview: !live});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be loaded.'); }
}
