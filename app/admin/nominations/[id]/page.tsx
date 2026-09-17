import type {Metadata} from 'next';
import {NominationEditor} from '@/components/nomination-editor';

export const metadata: Metadata = {title: 'Manage nomination'};
export default async function NominationPage({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <NominationEditor id={id} />;
}
