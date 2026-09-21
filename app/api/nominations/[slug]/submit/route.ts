import {NextResponse} from 'next/server';
import {submitNomination} from '@/lib/server/nominations';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';
import {NominationError} from '@/lib/server/nomination-errors';

export async function POST(request: Request, context: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await context.params;
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NominationError('Send valid nomination choices.');
    const {ageGroup, name, choices} = body;
    return NextResponse.json({submittedAt: await submitNomination(slug, ageGroup, name, choices)}, {status: 201});
  } catch (error) { return nominationErrorResponse(error, 'Nomination could not be submitted.'); }
}
