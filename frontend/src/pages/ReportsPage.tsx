import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, apiMode } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable, FormField, Notice, PageTitle, Stat } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import type { Assessment, Requirement, SummaryReport } from '../types';

export function ReportsPage() {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState('');
  const isSummaryRole = user?.role === 'ADMIN' || user?.role === 'NGO';
  const summary = useAsync(() => isSummaryRole ? api.reports.summary() : Promise.resolve(null), [user?.role]);
  const coverage = useAsync(() => user?.role === 'ADMIN' ? api.reports.coverage() : Promise.resolve(null), [user?.role]);
  const turnaround = useAsync(() => user?.role === 'ADMIN' ? api.reports.turnaround() : Promise.resolve([]), [user?.role]);
  const schoolHistory = useAsync(() => user?.role === 'SCHOOL' && schoolId ? api.reports.schoolHistory(schoolId) : Promise.resolve(null), [user?.role, schoolId]);
  const schoolOptions = useAsync(async () => {
    if (apiMode !== 'mock' || user?.role !== 'SCHOOL') return [];
    const school = await api.dashboard.schoolForUser(user.user_id);
    return school ? [school] : [];
  }, [user?.role, user?.user_id]);
  useEffect(() => { const own = schoolOptions.data?.[0]; if (own && schoolId !== own.school_id) setSchoolId(own.school_id); }, [schoolOptions.data, schoolId]);
  const data = summary.data as SummaryReport | null;
  const categoryRows = data?.open_by_district_and_category ?? [];
  const chartData = Object.values(categoryRows.reduce<Record<string, { district: string; CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }>>((acc, row) => {
    acc[row.district] ??= { district: row.district, CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    acc[row.district][row.priority_class] += row.count;
    return acc;
  }, {}));
  function exportCsv() {
    const headings = ['District', 'Resource category', 'Priority class', 'Requirement count'];
    const lines = categoryRows.map((row) => [row.district, row.resource_category, row.priority_class, row.count].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
    const file = new Blob([[headings.join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'science-resource-gap-report.csv'; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (user?.role === 'SCHOOL') {
    const history = schoolHistory.data as { assessments?: Assessment[]; requirements?: Requirement[] } | null;
    return <>
      <PageTitle title="School history report" description="Review assessment and requirement history for your school." actions={<button className="button button-secondary print-hide" onClick={() => window.print()}>Print report</button>} />
      {apiMode === 'mock' ? <FormField label="School" htmlFor="history-school"><select id="history-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{(schoolOptions.data ?? []).map((school) => <option key={school.school_id} value={school.school_id}>{school.school_name}</option>)}</select></FormField> : <FormField label="School ID" htmlFor="history-school"><input id="history-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} /></FormField>}
      {schoolHistory.error && <Notice tone="error">{schoolHistory.error}</Notice>}
      <section className="panel"><h2>Assessment history</h2><DataTable<Assessment> rows={history?.assessments ?? []} rowKey={(row) => row.assessment_id} columns={[{ key: 'assessment_date', label: 'Assessment date' }, { key: 'assessment_id', label: 'Assessment reference' }, { key: 'status', label: 'Status' }]} /></section>
      <section className="panel"><h2>Requirement history</h2><DataTable<Requirement> rows={history?.requirements ?? []} rowKey={(row) => row.requirement_id} columns={[{ key: 'resource_name', label: 'Resource' }, { key: 'gap_qty', label: 'Gap quantity' }, { key: 'priority_class', label: 'Priority' }, { key: 'status', label: 'Status' }]} /></section>
    </>;
  }
  if (user?.role === 'FIELD_COORDINATOR') return <><PageTitle title="Reports and analytics" description="Available reporting follows the authorised role permissions." /><Notice>The current backend does not expose a report endpoint for Field Coordinators. Use assigned school assessment and requirement modules.</Notice></>;

  return <>
    <PageTitle title="Reports and analytics" description="Review requirement status, priority distribution, school coverage, and intervention turnaround." actions={<><button className="button button-secondary print-hide" onClick={exportCsv} disabled={!categoryRows.length}>Download CSV</button><button className="button button-secondary print-hide" onClick={() => window.print()}>Print report</button></>} />
    {summary.error && <Notice tone="warning">{summary.error}</Notice>}
    <div className="stats-grid stats-grid-three"><Stat label="Open requirements" value={data?.status_funnel.filter((row) => !['CLOSED', 'COMPLETED'].includes(row.status)).reduce((sum, row) => sum + row.count, 0) ?? 'Not available'} /><Stat label="Critical priority" value={data?.open_by_priority.find((row) => row.priority_class === 'CRITICAL')?.count ?? 'Not available'} /><Stat label="Verified school coverage" value={coverage.data ? `${coverage.data.coverage_percent}%` : user?.role === 'ADMIN' ? 'Not available' : 'Administrator access required'} /></div>
    <section className="panel chart-panel"><div className="panel-heading"><div><h2>Open requirements by district and priority</h2><p>Grouped counts from the report summary endpoint</p></div></div>{chartData.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height={300}><BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}><CartesianGrid stroke="#d8dde3" vertical={false} /><XAxis dataKey="district" tick={{ fill: '#283746', fontSize: 12 }} /><YAxis allowDecimals={false} tick={{ fill: '#283746', fontSize: 12 }} /><Tooltip /><Legend /><Bar dataKey="CRITICAL" stackId="priority" fill="#a52727" /><Bar dataKey="HIGH" stackId="priority" fill="#9a5b00" /><Bar dataKey="MEDIUM" stackId="priority" fill="#5a6b7b" /><Bar dataKey="LOW" stackId="priority" fill="#1a4480" /></BarChart></ResponsiveContainer></div> : <p className="empty-note">No district-level data is available.</p>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Requirement status funnel</h2><p>Current requirement counts by lifecycle status</p></div></div><DataTable rows={data?.status_funnel ?? []} rowKey={(row) => row.status} columns={[{ key: 'status', label: 'Status' }, { key: 'count', label: 'Requirements' }]} /></section>
    {user?.role === 'ADMIN' && <section className="panel"><div className="panel-heading"><div><h2>Intervention turnaround</h2><p>Average days from acceptance through completion, by organisation and category</p></div></div>{turnaround.error && <Notice tone="warning">{turnaround.error}</Notice>}<DataTable rows={turnaround.data ?? []} rowKey={(row) => `${row.org_name}-${row.resource_category}`} columns={[{ key: 'org_name', label: 'Organisation' }, { key: 'resource_category', label: 'Resource category' }, { key: 'average_days', label: 'Average days' }, { key: 'completed_count', label: 'Completed interventions' }]} /></section>}
    <p className="print-only">Generated by Science Resource Gap System</p>
  </>;
}
