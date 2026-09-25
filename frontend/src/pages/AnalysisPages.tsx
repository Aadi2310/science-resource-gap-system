import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, apiMode } from '../api/client';
import { mockSchools } from '../api/mock';
import { DataTable, FormField, Notice, PageTitle, StateBadge } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import type { Requirement, SchoolResource } from '../types';

export function GapAnalysisPage() {
  const [searchParams] = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') ?? (apiMode === 'mock' ? 'sch-001' : ''));
  const history = useAsync(() => !schoolId ? Promise.resolve({ assessments: [] }) : apiMode === 'mock' ? api.assessments.list(schoolId).then((page) => ({ assessments: page.data })) : api.reports.schoolHistory(schoolId), [schoolId]);
  const raw = history.data as { assessments?: Array<{ assessment_id: string; status: string; assessment_date: string; resources?: Array<SchoolResource | { school_resource: SchoolResource; gap?: { gap_qty: number; gap_ratio: number } | null; resource_state?: 'Adequate' | 'Gap' }> }> } | null;
  const latest = [...(raw?.assessments ?? [])].filter((assessment) => assessment.status === 'VERIFIED').sort((a, b) => b.assessment_date.localeCompare(a.assessment_date))[0];
  const rows = (latest?.resources ?? []).map((item) => {
    if ('school_resource' in item) return { ...item.school_resource, gap: item.gap, resource_state: item.resource_state };
    return item;
  });
  return <>
    <PageTitle title="Gap analysis" description="Compare required and functional resource quantities from the latest verified assessment." />
    {apiMode === 'live' && <Notice>Gap records are computed by the backend from verified assessments. This view uses the school history report; the backend does not provide a separate all-school gap endpoint.</Notice>}
    <section className="panel filter-panel"><div className="filter-grid">{apiMode === 'mock' ? <FormField label="School" htmlFor="gap-school"><select id="gap-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{mockSchools.map((s) => <option key={s.school_id} value={s.school_id}>{s.school_name}</option>)}</select></FormField> : <FormField label="School ID" htmlFor="gap-school"><input id="gap-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} /></FormField>}</div></section>
    {history.error && <Notice tone="error">{history.error}</Notice>}
    {latest && <section className="panel"><p className="panel-context">Assessment {latest.assessment_id} · {latest.assessment_date} · Verified</p><DataTable rows={rows} rowKey={(r) => r.school_resource_id} columns={[
      { key: 'resource_name', label: 'Resource' }, { key: 'required_qty', label: 'Required' }, { key: 'available_qty', label: 'Available' }, { key: 'functional_qty', label: 'Functional' },
      { key: 'gap_qty', label: 'Gap quantity', render: (r) => r.gap?.gap_qty ?? '—' }, { key: 'gap_ratio', label: 'Gap ratio', render: (r) => r.gap ? `${(r.gap.gap_ratio * 100).toFixed(1)}%` : '—' },
      { key: 'condition_rating', label: 'Condition' }, { key: 'resource_state', label: 'Assessment', render: (r) => r.resource_state ? <StateBadge value={r.resource_state} /> : 'Awaiting verification' },
    ]} /></section>}
    {!history.loading && !history.error && !latest && <Notice>No verified assessment is available for this school.</Notice>}
  </>;
}

export function PriorityPage() {
  const [priority, setPriority] = useState(''); const [district, setDistrict] = useState(''); const [status, setStatus] = useState('');
  const requirements = useAsync(() => api.requirements.list({ page: 1, page_size: 100, priority_class: priority, district: district || undefined, status: status || undefined }), [priority, district, status]);
  const rows = requirements.data?.data ?? [];
  const districtChoices = useMemo(() => [...new Set(rows.map((row) => row.district))], [rows]);
  return <>
    <PageTitle title="Priority rankings" description="Requirements ranked by the configured need and urgency score." />
    <section className="panel filter-panel"><div className="filter-grid">
      <FormField label="Priority class" htmlFor="priority-class"><select id="priority-class" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">All priorities</option>{['CRITICAL','HIGH','MEDIUM','LOW'].map((value) => <option key={value}>{value}</option>)}</select></FormField>
      <FormField label="District" htmlFor="priority-district"><select id="priority-district" value={district} onChange={(e) => setDistrict(e.target.value)}><option value="">All districts</option>{districtChoices.map((value) => <option key={value}>{value}</option>)}</select></FormField>
      <FormField label="Status" htmlFor="priority-status"><select id="priority-status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option>{['OPEN','UNDER_REVIEW','ACCEPTED','IN_PROGRESS','PARTIALLY_COMPLETED','COMPLETED','NOT_FEASIBLE','DISPUTED','CLOSED'].map((value) => <option key={value}>{value}</option>)}</select></FormField>
    </div></section>
    {requirements.error && <Notice tone="error">{requirements.error}</Notice>}
    <section className="panel"><DataTable<Requirement> rows={rows} rowKey={(row) => row.requirement_id} columns={[
      { key: 'rank', label: 'Rank', render: (_row) => rows.indexOf(_row) + 1 }, { key: 'school_name', label: 'School' }, { key: 'district', label: 'District' }, { key: 'resource_name', label: 'Resource' },
      { key: 'gap_qty', label: 'Gap quantity' }, { key: 'gap_ratio', label: 'Gap ratio', render: (row) => `${(Number(row.gap_ratio) * 100).toFixed(1)}%` },
      { key: 'final_score', label: 'Score', render: (row) => Number(row.final_score).toFixed(2) }, { key: 'priority_class', label: 'Priority', render: (row) => <StateBadge value={row.priority_class} /> },
    ]} /></section>
  </>;
}
