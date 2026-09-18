import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {nominationErrorResponse} from '@/lib/server/nomination-errors';
import {getAllNominationNominees} from '@/lib/server/nominations';
import {buildCsv} from '@/lib/csv';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, context: {params: Promise<{id: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {id} = await context.params;
    const nominees = await getAllNominationNominees(id);
    const csv = buildCsv(['Name', 'Position nominated', 'Nominated by', 'Submitted at'],
      nominees.map((entry) => [entry.nomineeName, entry.positionName, entry.nominatorName || entry.nominatorEmail || '', entry.submittedAt]));
    return new Response(csv, {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="nominees.csv"'}});
  } catch (error) { return nominationErrorResponse(error, 'Nominees could not be exported.'); }
}
