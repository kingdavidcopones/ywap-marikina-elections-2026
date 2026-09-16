import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase';

const BUCKET = 'candidate-images';
const STORAGE_PREFIX = 'candidate-image://';
const SIGNED_URL_SECONDS = 4 * 60 * 60;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

async function ensureBucket() {
  const supabase = createServerSupabaseClient();
  const {data} = await supabase.storage.getBucket(BUCKET);
  if (data) {
    if (data.public) {
      const {error} = await supabase.storage.updateBucket(BUCKET, {
        public: false,
        allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
        fileSizeLimit: MAX_IMAGE_BYTES,
      });
      if (error) throw new Error(error.message);
    }
    return supabase;
  }

  const {error} = await supabase.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: Object.keys(MIME_EXTENSIONS),
    fileSizeLimit: MAX_IMAGE_BYTES,
  });
  if (error && !error.message.toLocaleLowerCase('en').includes('already exists')) throw new Error(error.message);
  return supabase;
}

function storagePath(imageUrl?: string) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith(STORAGE_PREFIX)) return imageUrl.slice(STORAGE_PREFIX.length);
  try {
    const pathname = new URL(imageUrl).pathname;
    const marker = `/storage/v1/object/sign/${BUCKET}/`;
    const markerIndex = pathname.indexOf(marker);
    return markerIndex >= 0 ? decodeURIComponent(pathname.slice(markerIndex + marker.length)) : null;
  } catch {
    return null;
  }
}

export function normalizeCandidateImageUrl(imageUrl?: string) {
  const path = storagePath(imageUrl);
  return path ? `${STORAGE_PREFIX}${path}` : imageUrl;
}

export async function signCandidateImageUrls(imageUrls: Array<string | null | undefined>) {
  const paths = [...new Set(imageUrls.map((imageUrl) => storagePath(imageUrl ?? undefined)).filter((path): path is string => Boolean(path)))];
  const signedUrls = new Map<string, string>();
  if (!paths.length) return signedUrls;

  const supabase = createServerSupabaseClient();
  const {data, error} = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(error.message);
  for (const item of data ?? []) {
    if (item.signedUrl) signedUrls.set(`${STORAGE_PREFIX}${item.path}`, item.signedUrl);
  }
  return signedUrls;
}

export async function uploadCandidateImage(nomineeId: string, file: File) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nomineeId)) {
    throw new Error('Invalid candidate ID.');
  }
  const extension = MIME_EXTENSIONS[file.type];
  if (!extension) throw new Error('Choose a PNG, JPG, GIF, WebP, or SVG image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Choose an image smaller than 2 MB.');

  const supabase = await ensureBucket();
  const path = `${nomineeId}/${crypto.randomUUID()}.${extension}`;
  const {error} = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
    cacheControl: '31536000',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const {data, error: signError} = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signError) throw new Error(signError.message);
  return data.signedUrl;
}
