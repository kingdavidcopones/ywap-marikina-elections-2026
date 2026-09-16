import 'server-only';
import {createHmac, timingSafeEqual} from 'node:crypto';
import {cookies} from 'next/headers';

const ADMIN_COOKIE = 'ywap_admin';
const VOTER_COOKIE = 'ywap_voter';
const ADMIN_SESSION_SECONDS = 7 * 24 * 60 * 60;

type SignedPayload = Record<string, unknown> & {exp: number};

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error('SESSION_SECRET is not configured.');
  return value;
}

function sign(payload: SignedPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verify<T extends SignedPayload>(token?: string): T | null {
  if (!token) return null;
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = createHmac('sha256', secret()).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as T;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function adminCredentialsMatch(username: string, password: string) {
  const expectedUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return false;
  const supplied = Buffer.from(`${username}\0${password}`);
  const expected = Buffer.from(`${expectedUsername}\0${expectedPassword}`);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export async function setAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign({role: 'admin', exp: Date.now() + ADMIN_SESSION_SECONDS * 1000}), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ADMIN_SESSION_SECONDS,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verify<SignedPayload & {role: string}>(token)?.role === 'admin';
}

export async function setVoterSession(payload: {voterId: string; electionId: string; memberId: string; firstName: string; ageGroup: string; ballotSlug: string}) {
  const jar = await cookies();
  jar.set(VOTER_COOKIE, sign({...payload, exp: Date.now() + 4 * 60 * 60 * 1000}), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 4 * 60 * 60,
  });
}

export async function getVoterToken() {
  const token = (await cookies()).get(VOTER_COOKIE)?.value;
  return verify<SignedPayload & {voterId: string; electionId: string; memberId: string; firstName: string; ageGroup: string; ballotSlug: string}>(token);
}
