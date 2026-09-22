import type {Metadata} from 'next';
import {NominationDashboard} from '@/components/nomination-dashboard';

export const metadata: Metadata = {title: 'Nominations'};
export default function NominationsPage() { return <NominationDashboard />; }
