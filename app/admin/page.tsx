import {ElectionDashboard} from '@/components/election-dashboard';

export default async function AdminPage({searchParams}: {searchParams: Promise<{create?: string}>}) {
  const {create} = await searchParams;
  return <ElectionDashboard isCreateDialogOpen={create === 'election'} />;
}
