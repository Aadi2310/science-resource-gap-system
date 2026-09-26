import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiMode } from '../../api/client';
import { DataTable, Notice, PageTitle, StateBadge, Stat } from '../../components/Shared';
import { useAsync } from '../../hooks/useAsync';
import type { Requirement, SummaryReport } from '../../types';

export function NgoDashboard() {
  const [message, setMessage] = useState('');
  const summary = useAsync(() => api.reports.summary());
  const rows = useAsync(() => api.requirements.list({ page: 1, page_size: 100 }));
  const report = summary.data as SummaryReport | null;
  const counts = (report?.status_funnel ?? []).reduce<Record<string, number>>((result, item) => { result[item.status] = item.count; return result; }, {});
  const priority = report?.open_by_priority.reduce<Record<string, number>>((result, item) => { result[item.priority_class] = item.count; return result; }, {});
  const liveHasData = Boolean(rows.data?.total_count || report?.status_funnel.some((item) => item.count > 0));
  const requirements: Requirement[] = rows.data?.data ?? [];
  async function accept(row: Requirement) {
    try { await api.requirements.accept(row.requirement_id, row.version); setMessage(`Accepted ${row.resource_name} for ${row.school_name}.`); rows.reload(); summary.reload(); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Requirement could not be accepted.'); }
  }
  const stats = [
    ['Total open requirements', priority ? Object.values(priority).reduce((a, b) => a + b, 0) : null], ['Critical requirements', priority?.CRITICAL], ['High priority requirements', priority?.HIGH],
    ['Accepted requirements', counts.ACCEPTED], ['In-progress requirements', counts.IN_PROGRESS], ['Completed requirements', counts.COMPLETED],
  ] as const;
  return <>
    <PageTitle title="NGO Dashboard" description="Review prioritized school requirements and manage interventions." actions={<Link className="button button-secondary" to="/requirements">My Interventions</Link>} />
    {(summary.error || rows.error) && <Notice tone="warning">{[summary.error, rows.error].filter(Boolean).join(' ')}</Notice>}
    {message && <Notice>{message}</Notice>}
    <div className="stats-grid">{stats.map(([label, value]) => <Stat key={label} label={label} value={summary.loading || rows.loading ? '…' : apiMode === 'live' && !liveHasData ? 'No data available yet' : value ?? 'No data available yet'} />)}</div>
    <section className="panel"><div className="panel-heading"><div><h2>Prioritized Requirements</h2><p>Ranked by the current priority score.</p></div></div>
      <DataTable<Requirement> rows={requirements} rowKey={(row) => row.requirement_id} columns={[
        { key: 'rank', label: 'Rank', render: (row) => requirements.indexOf(row) + 1 }, { key: 'school_name', label: 'School' }, { key: 'district', label: 'District' }, { key: 'resource_name', label: 'Resource' }, { key: 'gap_qty', label: 'Gap' }, { key: 'priority_class', label: 'Priority', render: (row) => <StateBadge value={row.priority_class} /> }, { key: 'final_score', label: 'Score' }, { key: 'status', label: 'Status', render: (row) => <StateBadge value={row.status} /> },
        { key: 'action', label: 'Action', render: (row) => <span className="form-actions"><Link to={`/requirements/${row.requirement_id}`}>View</Link>{['OPEN', 'UNDER_REVIEW'].includes(row.status) && <button className="button button-primary button-small" onClick={() => void accept(row)}>Accept</button>}{['ACCEPTED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED'].includes(row.status) && <Link to={`/requirements/${row.requirement_id}`}>Update status</Link>}</span> },
      ]} emptyText={rows.loading ? 'Loading requirements…' : 'No data available yet.'} />
    </section>
    <nav className="panel quick-links"><h2>NGO modules</h2><ul><li><Link to="/requirements">Prioritized Requirements</Link></li><li><Link to="/requirements">My Interventions</Link></li><li><Link to="/reports">Reports</Link></li></ul></nav>
  </>;
}
