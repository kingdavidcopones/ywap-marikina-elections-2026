import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';
import {getAllNominationNominees, getNominationNominees} from '@/lib/server/nominations';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    const searchParams = new URL(request.url).searchParams;
    if (searchParams.get('all') === 'true') {
      const nominees = await getAllNominationNominees(id);
      return NextResponse.json({nominees, total: nominees.length});
    }
    const page = Number(searchParams.get('page') ?? '1');
    return NextResponse.json(await getNominationNominees(id, page));
  } catch (error) { return nominationErrorResponse(error, 'Nominees could not be loaded.'); }
}
