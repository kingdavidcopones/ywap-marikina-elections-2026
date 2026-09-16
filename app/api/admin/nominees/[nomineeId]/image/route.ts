import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/server/auth';
import {uploadCandidateImage} from '@/lib/server/candidate-images';

export async function POST(request: Request, context: {params: Promise<{nomineeId: string}>}) {
  if (!(await isAdmin())) return NextResponse.json({message: 'Admin sign-in required.'}, {status: 401});
  try {
    const {nomineeId} = await context.params;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({message: 'Choose a candidate image.'}, {status: 400});
    return NextResponse.json({imageUrl: await uploadCandidateImage(nomineeId, file)}, {status: 201});
  } catch (error) {
    return NextResponse.json({message: error instanceof Error ? error.message : 'The candidate image could not be uploaded.'}, {status: 400});
  }
}
