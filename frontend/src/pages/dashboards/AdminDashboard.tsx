import { Link } from 'react-router-dom';
import { api, apiMode } from '../../api/client';
import { DataTable, Notice, PageTitle, Stat } from '../../components/Shared';
import { useAsync } from '../../hooks/useAsync';
import type { Assessment, Requirement, SummaryReport } from '../../types';

const statusLabels: Record<string, string> = { OPEN: 'Open', UNDER_REVIEW: 'Under Review', ACCEPTED: 'Accepted', IN_PROGRESS: 'In Progress', PARTIALLY_COMPLETED: 'Partially Completed', COMPLETED: 'Completed', NOT_FEASIBLE: 'Not Feasible', DISPUTED: 'Disputed', CLOSED: 'Closed' };
export function AdminDashboard() {
  const schools = useAsync(() => api.schools.list({ page: 1, page_size: 100 }));
  const summary = useAsync(() => api.reports.summary());
  const requirements = useAsync(() => api.requirements.list({ page: 1, page_size: 100 }));
  const assessments = useAsync(() => api.dashboard.allAssessments());
  const report = summary.data as SummaryReport | null;
  const schoolRows = schools.data?.data ?? [];
  const reqRows: Requirement[] = requirements.data?.data ?? [];
  const assessmentRows: Assessment[] = assessments.data ?? [];
  const totalSchools = schools.data?.total_count;
  const verifiedSchools = schoolRows.filter((s) => s.verification_status === 'VERIFIED').length;
  const statusCounts = (report?.status_funnel ?? []).reduce<Record<string, number>>((acc, row) => { acc[row.status] = row.count; return acc; }, {});
  const priorityCounts = report?.open_by_priority.reduce<Record<string, number>>((acc, row) => { acc[row.priority_class] = row.count; return acc; }, {});
  const liveHasSummaryData = Boolean(report?.status_funnel.some((item) => item.count > 0) || report?.open_by_priority.some((item) => item.count > 0));
  const stat = (value: number | undefined) => apiMode === 'live' && (value === undefined || value === 0) ? 'No data available yet' : value ?? 'No data available yet';
  return <>
    <PageTitle title="System Administration" description="System-wide school, assessment, and requirement monitoring." />
    {(schools.error || summary.error || requirements.error) && <Notice tone="warning">{[schools.error, summary.error, requirements.error].filter(Boolean).join(' ')}</Notice>}
    <div className="admin-dashboard">
      <section aria-labelledby="admin-overview-title"><div className="admin-section-heading"><div><h2 id="admin-overview-title">System overview</h2><p>Current reach and activity across the portal</p></div></div>
        <div className="admin-overview-grid">{[
          ['Total schools', stat(totalSchools)], ['Verified schools', stat(totalSchools === undefined ? undefined : verifiedSchools)], ['Pending schools', stat(totalSchools === undefined ? undefined : schoolRows.filter((s) => s.verification_status === 'PENDING').length)], ['Assessments', stat(assessments.data ? assessmentRows.length : undefined)], ['Requirements', stat(requirements.data?.total_count)],
        ].map(([label, value]) => <Stat key={String(label)} label={String(label)} value={value} />)}</div>
      </section>
      <div className="admin-dashboard-columns">
        <section className="panel admin-dashboard-panel"><div className="admin-section-heading"><div><h2>Resource gap overview</h2><p>Open requirements by priority</p></div><Link to="/priorities">View rankings</Link></div>
          <div className="admin-priority-list">{(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((level) => <div className="admin-priority-row" key={level}><span className={`admin-priority-mark admin-priority-${level.toLowerCase()}`} /><span>{level.charAt(0) + level.slice(1).toLowerCase()}</span><strong>{priorityCounts?.[level] === undefined || (apiMode === 'live' && !liveHasSummaryData) ? '—' : stat(priorityCounts[level])}</strong></div>)}</div>
        </section>
        <section className="panel admin-dashboard-panel"><div className="admin-section-heading"><div><h2>Assessment monitoring</h2><p>Verification workflow</p></div><Link to="/assessments">Review assessments</Link></div>
          <div className="admin-priority-list">{(['DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED'] as const).map((status) => { const count = assessmentRows.filter((a) => a.status === status).length; return <div className="admin-priority-row" key={status}><span>{status.replaceAll('_', ' ')}</span><strong>{!assessments.data || (apiMode === 'live' && count === 0) ? '—' : count}</strong></div>; })}</div>
        </section>
      </div>
      <section className="panel admin-dashboard-panel"><div className="admin-section-heading"><div><h2>Requirement status</h2><p>Distribution across the intervention lifecycle</p></div><Link to="/requirements">Manage requirements</Link></div>
        <div className="admin-status-grid">{Object.entries(statusLabels).map(([key, label]) => <div className="admin-status-item" key={key}><span>{label}</span><strong>{statusCounts?.[key] === undefined || (apiMode === 'live' && !liveHasSummaryData) ? '—' : stat(statusCounts[key])}</strong></div>)}</div>
      </section>
      <section className="admin-actions-section"><div className="admin-section-heading"><div><h2>Administration</h2><p>Common system management tasks</p></div></div>
        <div className="admin-actions-grid">{[['/schools', 'Manage schools'], ['/assessments', 'Verify assessments'], ['/requirements', 'Manage requirements'], ['/users', 'Manage users'], ['/resource-configuration', 'Resource categories'], ['/resource-configuration', 'Weight configuration'], ['/reports', 'Reports']].map(([to, label]) => <Link className="admin-action-link" key={label} to={to}><span>{label}</span><span aria-hidden="true">›</span></Link>)}</div>
      </section>
      <section className="panel admin-dashboard-panel"><div className="admin-section-heading"><div><h2>Highest-priority requirements</h2><p>Items that may need administrative attention</p></div><Link to="/priorities">All rankings</Link></div>
        <DataTable rows={reqRows.slice(0, 8)} rowKey={(row) => row.requirement_id} columns={[{ key: 'school_name', label: 'School' }, { key: 'district', label: 'District' }, { key: 'resource_name', label: 'Resource' }, { key: 'priority_class', label: 'Priority' }, { key: 'status', label: 'Status' }]} emptyText="No data available yet." />
      </section>
    </div>
  </>;
}
