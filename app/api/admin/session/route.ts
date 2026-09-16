import {NextResponse} from 'next/server';
import {adminCredentialsMatch, clearAdminSession, isAdmin, setAdminSession} from '@/lib/server/auth';

export async function GET() {
  return NextResponse.json({authenticated: await isAdmin()});
}

export async function POST(request: Request) {
  const {username, password} = await request.json() as {username?: string; password?: string};
  if (!adminCredentialsMatch(username ?? '', password ?? '')) {
    return NextResponse.json({message: 'That username and password don’t match. Check both and try again.'}, {status: 401});
  }
  await setAdminSession();
  return NextResponse.json({authenticated: true});
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({authenticated: false});
}
