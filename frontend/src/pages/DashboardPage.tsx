import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, apiMode } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable, Notice, PageTitle, StateBadge, Stat } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import { mockSummaryStats } from '../api/mock';
import type { Requirement } from '../types';

export function DashboardPage() {
  const { user } = useAuth();
  const summary = useAsync(() => user && ['ADMIN', 'NGO'].includes(user.role) ? api.reports.summary() : Promise.resolve(null), [user?.role]);
  const requirements = useAsync(() => api.requirements.list({ page: 1, page_size: 5 }));
  const schools = useAsync(() => api.schools.list({ page: 1, page_size: 100 }));
  const summaryData = summary.data as Awaited<ReturnType<typeof api.reports.summary>> | null;
  const openCount = summaryData?.status_funnel.filter((x) => !['CLOSED', 'COMPLETED'].includes(x.status)).reduce((sum, row) => sum + row.count, 0);
  const highCount = summaryData?.open_by_priority.filter((x) => ['CRITICAL', 'HIGH'].includes(x.priority_class)).reduce((sum, row) => sum + row.count, 0);
  const chartData = summaryData?.open_by_priority.map((row) => ({ priority: row.priority_class, count: row.count })) ?? [];
  let tableRows: Requirement[] = requirements.data?.data ?? [];
  if (user?.role === 'SCHOOL') tableRows = tableRows.filter((row) => row.school_id === 'sch-001');
  if (user?.role === 'FIELD_COORDINATOR') tableRows = tableRows.filter((row) => ['Kolar', 'Tumakuru'].includes(row.district));

  return <>
    <PageTitle title="Dashboard" description="Current overview of verified school resource needs and follow-up activity." actions={<Link className="button button-secondary" to="/reports">View reports</Link>} />
    {apiMode === 'live' && user?.role === 'SCHOOL' && <Notice>School-level history is available in Reports. The backend does not expose a school collection or a role-specific dashboard summary.</Notice>}
    {apiMode === 'live' && user?.role === 'FIELD_COORDINATOR' && <Notice>The backend does not expose a field coordinator summary report. Assigned school requirements remain available below.</Notice>}
    {apiMode === 'live' && (summary.error || requirements.error) && <Notice tone="warning">Some dashboard measures are unavailable: {[summary.error, requirements.error].filter(Boolean).join(' ')}</Notice>}
    <div className="stats-grid">
      <Stat label="Schools tracked" value={schools.data?.total_count ?? (apiMode === 'mock' ? mockSummaryStats.totalSchools : '—')} note="Registered school profiles" />
      <Stat label="Open requirements" value={openCount ?? '—'} note="Based on the status summary" />
      <Stat label="Critical and high priority" value={highCount ?? '—'} note="Current prioritized requirements" />
      <Stat label="Recent verified assessments" value={apiMode === 'mock' ? mockSummaryStats.recentAssessments : '—'} note="Verified assessment activity" />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><h2>Open requirements by priority</h2><p>Counts from the current reporting summary</p></div></div>
        {summary.loading ? <p className="muted">Loading priority summary…</p> : chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={260}><BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}><CartesianGrid stroke="#d8dde3" vertical={false} /><XAxis dataKey="priority" tick={{ fill: '#283746', fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: '#283746', fontSize: 12 }} /><Tooltip /><Bar dataKey="count" name="Requirements" fill="#1a4480" radius={[0, 0, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="empty-note">No priority summary is available.</p>}
      </section>
      <section className="panel quick-links"><div className="panel-heading"><div><h2>Module access</h2><p>Available for your account role</p></div></div>
        <ul>{[['/schools', 'School register', ['SCHOOL', 'ADMIN', 'FIELD_COORDINATOR']], ['/assessments', 'Resource assessments', ['SCHOOL', 'ADMIN', 'FIELD_COORDINATOR']], ['/requirements', 'Requirements', ['SCHOOL', 'NGO', 'ADMIN', 'FIELD_COORDINATOR']], ['/priorities', 'Priority rankings', ['NGO', 'ADMIN', 'FIELD_COORDINATOR']], ['/reports', 'Reports and analytics', ['SCHOOL', 'NGO', 'ADMIN']]].filter(([, , roles]) => (roles as string[]).includes(user?.role ?? '')).map(([to, label]) => <li key={to as string}><Link to={to as string}>{label}<span aria-hidden="true">›</span></Link></li>)}</ul>
      </section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2>Recent priority items</h2><p>Highest ranked requirements in the visible set</p></div><Link to="/priorities">View all rankings</Link></div>
      {requirements.error && apiMode === 'live' ? <Notice tone="warning">{requirements.error}</Notice> : <DataTable rows={tableRows.slice(0, 5)} rowKey={(row) => row.requirement_id} columns={[
        { key: 'school_name', label: 'School' }, { key: 'resource_name', label: 'Resource' }, { key: 'district', label: 'District' }, { key: 'gap_qty', label: 'Gap quantity' }, { key: 'priority_class', label: 'Priority', render: (row) => <StateBadge value={row.priority_class} /> },
      ]} />}
    </section>
  </>;
}
