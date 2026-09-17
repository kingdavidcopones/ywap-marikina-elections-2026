import {NextResponse} from 'next/server';
import {searchYouthRecords} from '@/lib/server/nominations';
import {isAdmin} from '@/lib/server/auth';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{slug: string}>}) {
  try {
    const {slug} = await context.params;
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return NextResponse.json({records: await searchYouthRecords(slug, query, await isAdmin())});
  } catch (error) { return nominationErrorResponse(error, 'Youth Records could not be searched.'); }
}
