import { Link } from 'react-router-dom';
import { api, apiMode } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, Notice, PageTitle, StateBadge, Stat } from '../../components/Shared';
import { useAsync } from '../../hooks/useAsync';
import type { Assessment, Requirement, School } from '../../types';

export function SchoolDashboard() {
  const { user } = useAuth();
  const data = useAsync(async () => {
    if (!user) return null;
    const school = await api.dashboard.schoolForUser(user.user_id);
    if (!school) return null;
    const [history, requirements] = await Promise.all([api.reports.schoolHistory(school.school_id), api.requirements.list({ page: 1, page_size: 100, school_id: school.school_id })]);
    return { school, assessments: (history as { assessments: Assessment[] }).assessments, requirements: requirements.data };
  }, [user?.user_id]);
  const school = data.data?.school as School | undefined;
  const assessments = data.data?.assessments ?? [];
  const requirements = data.data?.requirements ?? [];
  const latest = assessments[0];
  return <>
    <PageTitle title="My School Dashboard" description="Updates and resource needs for your school." actions={<Link className="button button-secondary" to="/schools">View My School</Link>} />
    {data.error && <Notice tone="warning">{data.error}</Notice>}
    {!data.loading && !school && <Notice>{apiMode === 'live' ? 'No data available yet. A school profile is not linked to this account.' : 'No school is linked to this demonstration account.'}</Notice>}
    {school && <>
      <div className="stats-grid"><Stat label="My school" value={school.school_name} note={`${school.district}, ${school.state}`} /><Stat label="Verification" value={<StateBadge value={school.verification_status} />} /><Stat label="Latest assessment" value={latest ? <StateBadge value={latest.status} /> : 'None yet'} note={latest?.assessment_date} /><Stat label="Open requirements" value={requirements.filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status)).length} note="For this school" /></div>
      <section className="panel"><h2>Resource gap summary</h2><DataTable rows={requirements} rowKey={(row) => row.requirement_id} columns={[{ key: 'resource_name', label: 'Resource' }, { key: 'gap_qty', label: 'Gap' }, { key: 'priority_class', label: 'Priority', render: (row: Requirement) => <StateBadge value={row.priority_class} /> }, { key: 'status', label: 'Status', render: (row: Requirement) => <StateBadge value={row.status} /> }]} /></section>
      <div className="dashboard-grid"><section className="panel"><h2>My open requirements</h2><DataTable rows={requirements.filter((r) => !['COMPLETED', 'CLOSED'].includes(r.status))} rowKey={(row) => row.requirement_id} columns={[{ key: 'resource_name', label: 'Resource' }, { key: 'priority_class', label: 'Priority', render: (row: Requirement) => <StateBadge value={row.priority_class} /> }, { key: 'status', label: 'Status', render: (row: Requirement) => <StateBadge value={row.status} /> }, { key: 'action', label: 'Action', render: (row: Requirement) => <Link to={`/requirements/${row.requirement_id}`}>View</Link> }]} /></section>
        <section className="panel quick-links"><h2>Quick actions</h2><ul><li><Link to="/schools">View My School</Link></li><li><Link to={`/assessments/new?school=${school.school_id}`}>Create Assessment</Link></li><li><Link to="/assessments">View Assessments</Link></li><li><Link to="/requirements">View My Requirements</Link></li><li><Link to="/reports">Reports</Link></li></ul></section></div>
      <section className="panel"><h2>Recent activity</h2><DataTable rows={assessments.slice(0, 5)} rowKey={(row) => row.assessment_id} columns={[{ key: 'assessment_date', label: 'Date' }, { key: 'assessment_id', label: 'Assessment' }, { key: 'status', label: 'Status', render: (row) => <StateBadge value={row.status} /> }]} emptyText="No assessment activity yet." /></section>
    </>}
  </>;
}
