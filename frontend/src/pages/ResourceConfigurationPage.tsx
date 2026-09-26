import { api } from '../api/client';
import { DataTable, Notice, PageTitle } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import type { ResourceCategory } from '../types';

export function ResourceConfigurationPage() {
  const categories = useAsync(() => api.resources.categories());
  return <><PageTitle title="Resource Configuration" description="Resource categories and their current importance weights." />
    {categories.error && <Notice tone="warning">{categories.error}</Notice>}
    <section className="panel"><DataTable<ResourceCategory> rows={categories.data?.data ?? []} rowKey={(row) => row.category_id} columns={[{ key: 'name', label: 'Resource category' }, { key: 'importance_weight', label: 'Importance weight' }, { key: 'is_active', label: 'Status', render: (row) => row.is_active ? 'Active' : 'Inactive' }]} emptyText="No data available yet." /></section>
  </>;
}
