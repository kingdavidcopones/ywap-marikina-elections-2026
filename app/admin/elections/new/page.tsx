import type {Metadata} from 'next';
import {redirect} from 'next/navigation';

export const metadata: Metadata = {title: 'Create election'};

export default function CreateElectionPage() {
  redirect('/admin?create=election');
}
