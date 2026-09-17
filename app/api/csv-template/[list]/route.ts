import {MEMBER_CSV_TEMPLATE} from '@/lib/member-csv-template';

export async function GET(
  _request: Request,
  {params}: {params: Promise<{list: string}>},
) {
  const {list} = await params;
  if (list !== 'eligible-voters' && list !== 'youth-records') {
    return new Response('Not found', {status: 404});
  }

  return new Response(MEMBER_CSV_TEMPLATE, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${list}-template.csv"`,
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
