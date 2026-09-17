import 'server-only';
import {NextResponse} from 'next/server';

export class NominationError extends Error {
  constructor(message: string, public readonly status: 400 | 404 | 409 | 503 = 400) {
    super(message);
  }
}

export function nominationErrorResponse(error: unknown, fallback: string) {
  if (error instanceof NominationError) {
    return NextResponse.json({message: error.message}, {status: error.status});
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({message: 'Send a valid JSON request body.'}, {status: 400});
  }
  console.error(fallback, error);
  return NextResponse.json({message: fallback}, {status: 503});
}
