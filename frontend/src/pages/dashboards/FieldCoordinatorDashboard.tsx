import { Link } from 'react-router-dom';
import { api, apiMode } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, Notice, PageTitle, StateBadge, Stat } from '../../components/Shared';
import { useAsync } from '../../hooks/useAsync';
import type { Assessment, Requirement, School } from '../../types';

export function FieldCoordinatorDashboard() {
  const { user } = useAuth();
  const data = useAsync(async () => {
    if (!user) return [];
    const schools = await api.dashboard.assignedSchools(user.user_id);
    return Promise.all(schools.map(async (school) => {
      const [history, requirements] = await Promise.all([api.reports.schoolHistory(school.school_id), api.requirements.list({ page: 1, page_size: 100, school_id: school.school_id })]);
      return { school, assessments: (history as { assessments: Assessment[] }).assessments, requirements: requirements.data };
    }));
  }, [user?.user_id]);
  const assigned = data.data ?? [];
  const allAssessments = assigned.flatMap((item) => item.assessments);
  const allRequirements: Requirement[] = assigned.flatMap((item) => item.requirements);
  const needsAssessment = assigned.filter((item) => !item.assessments.length || !['SUBMITTED', 'VERIFIED'].includes(item.assessments[0].status)).length;
  const noLiveData = apiMode === 'live' && !assigned.length;
  return <>
    <PageTitle title="Assigned Schools Dashboard" description="Manage and monitor the schools assigned to you." actions={<Link className="button button-primary" to="/schools/new">Register school</Link>} />
    {data.error && <Notice tone="warning">{data.error}</Notice>}
    {!data.loading && !assigned.length && <Notice>{apiMode === 'live' ? 'No data available yet. School assignments are not exposed by the current API.' : 'No schools are assigned to this coordinator.'}</Notice>}
    <div className="stats-grid"><Stat label="Assigned schools" value={data.loading ? '…' : noLiveData ? 'No data available yet' : assigned.length} /><Stat label="Schools requiring assessment" value={data.loading ? '…' : noLiveData ? 'No data available yet' : needsAssessment} /><Stat label="Submitted assessments" value={noLiveData ? 'No data available yet' : allAssessments.filter((a) => a.status === 'SUBMITTED').length} /><Stat label="Verified assessments" value={noLiveData ? 'No data available yet' : allAssessments.filter((a) => a.status === 'VERIFIED').length} /><Stat label="Rejected assessments" value={noLiveData ? 'No data available yet' : allAssessments.filter((a) => a.status === 'REJECTED').length} /><Stat label="Open requirements" value={noLiveData ? 'No data available yet' : allRequirements.filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status)).length} /></div>
    <section className="panel"><h2>Assigned Schools</h2><DataTable rows={assigned} rowKey={(item) => item.school.school_id} columns={[
      { key: 'school', label: 'School', render: (item) => (item.school as School).school_name }, { key: 'district', label: 'District', render: (item) => (item.school as School).district }, { key: 'verification', label: 'Verification status', render: (item) => <StateBadge value={(item.school as School).verification_status} /> },
      { key: 'assessment', label: 'Latest assessment', render: (item) => { const latest = (item.assessments as Assessment[])[0]; return latest ? <StateBadge value={latest.status} /> : 'None'; } }, { key: 'gaps', label: 'Open gaps', render: (item) => (item.requirements as Requirement[]).filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status)).length }, { key: 'requirements', label: 'Requirements', render: (item) => (item.requirements as Requirement[]).length },
      { key: 'action', label: 'Action', render: (item) => { const school = item.school as School; return <span className="form-actions"><Link to={`/schools/${school.school_id}`}>View school</Link><Link to={`/assessments/new?school=${school.school_id}`}>Create assessment</Link><Link to={`/assessments?school=${school.school_id}`}>View assessment</Link><Link to={`/requirements?school=${school.school_id}`}>Requirements</Link></span>; } },
    ]} emptyText={data.loading ? 'Loading assigned schools…' : 'No data available yet.'} /></section>
    <div className="dashboard-grid"><section className="panel"><h2>Open requirements from assigned schools</h2><DataTable rows={allRequirements.filter((r) => ['OPEN', 'UNDER_REVIEW'].includes(r.status))} rowKey={(row) => row.requirement_id} columns={[{ key: 'school_name', label: 'School' }, { key: 'resource_name', label: 'Resource' }, { key: 'priority_class', label: 'Priority' }, { key: 'status', label: 'Status' }, { key: 'action', label: 'Action', render: (row) => <Link to={`/requirements/${row.requirement_id}`}>View</Link> }]} /></section>
      <section className="panel quick-links"><h2>Quick actions</h2><ul><li><Link to="/schools/new">Register school</Link></li><li><Link to="/schools">View assigned schools</Link></li><li><Link to="/assessments">View assessments</Link></li><li><Link to="/requirements">View requirements</Link></li><li><Link to="/priorities">Priority rankings</Link></li></ul></section></div>
  </>;
}
