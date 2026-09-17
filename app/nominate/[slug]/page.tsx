import type {Metadata} from 'next';
import {NominationForm} from '@/components/nomination-form';

export const metadata: Metadata = {title: 'Nomination form'};
export default async function NominatePage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  return <NominationForm slug={slug} />;
}
