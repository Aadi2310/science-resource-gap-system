import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, apiMode } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { DataTable, FormField, Notice, PageTitle, Pagination, StateBadge } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import { mockSchools } from '../api/mock';
import type { School } from '../types';

export function SchoolsPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [district, setDistrict] = useState(''); const [status, setStatus] = useState('');
  const result = useAsync(() => api.schools.list({ page, page_size: 10, search, district, verification_status: status }), [page, search, district, status]);
  let rows = result.data?.data ?? [];
  if (apiMode === 'mock' && user?.role === 'SCHOOL') rows = rows.filter((row) => row.school_id === 'sch-001');
  const districts = [...new Set(mockSchools.map((school) => school.district))];
  const canRegister = apiMode === 'mock';
  return <>
    <PageTitle title="Schools" description="Search school profiles and review verification status." actions={canRegister ? <Link className="button button-primary" to="/schools/new">Register school profile</Link> : undefined} />
    {apiMode === 'live' && <Notice tone="info">The backend currently supports school profile detail and creation, but does not provide a paginated school collection endpoint. This register is available in demonstration mode.</Notice>}
    <section className="panel filter-panel" aria-label="School filters"><div className="filter-grid">
      <FormField label="Search school or UDISE code" htmlFor="school-search"><input id="school-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Enter a school name or code" /></FormField>
      <FormField label="District" htmlFor="district-filter"><select id="district-filter" value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }}><option value="">All districts</option>{districts.map((d) => <option key={d}>{d}</option>)}</select></FormField>
      <FormField label="Verification status" htmlFor="school-status"><select id="school-status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">All statuses</option><option value="VERIFIED">Verified</option><option value="PENDING">Pending</option><option value="REJECTED">Rejected</option></select></FormField>
    </div></section>
    {result.error && apiMode === 'live' ? <Notice tone="warning">{result.error}</Notice> : <section className="panel">
      <DataTable<School> rows={rows} rowKey={(row) => row.school_id} columns={[
        { key: 'school_name', label: 'School', render: (row) => <Link to={`/schools/${row.school_id}`}>{row.school_name}</Link> },
        { key: 'udise_code', label: 'UDISE+ code' }, { key: 'district', label: 'District' }, { key: 'school_type', label: 'School type', render: (row) => row.school_type.toLowerCase() },
        { key: 'student_strength_total', label: 'Students' }, { key: 'verification_status', label: 'Verification', render: (row) => <StateBadge value={row.verification_status} /> },
      ]} />
      <Pagination page={page} pageSize={10} total={result.data?.total_count ?? 0} onChange={setPage} />
    </section>}
  </>;
}

export function SchoolDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const school = useAsync(() => api.schools.detail(id), [id]);
  const history = useAsync(() => apiMode === 'mock' ? api.assessments.list(id).then((page) => ({ assessments: page.data })) : api.reports.schoolHistory(id), [id]);
  if (school.loading) return <p className="muted">Loading school profile…</p>;
  if (school.error) return <Notice tone="error">{school.error}</Notice>;
  const row = school.data!;
  const assessments = (history.data as { assessments?: Array<{ assessment_id: string; assessment_date: string; status: string }> } | null)?.assessments ?? [];
  return <>
    <PageTitle title={row.school_name} description={`${row.district}, ${row.state}`} actions={<>{apiMode === 'mock' && <Link className="button button-secondary" to={`/schools/${id}/edit`}>Edit profile</Link>}{(apiMode === 'mock' || user?.role === 'SCHOOL' || user?.role === 'FIELD_COORDINATOR') && <Link className="button button-primary" to={`/assessments/new?school=${id}`}>Record assessment</Link>}</>} />
    {apiMode === 'live' && <Notice tone="info">The backend provides school profile viewing and administrator verification. It does not expose profile editing or a school collection endpoint; school profile registration is completed with account registration.</Notice>}
    <section className="detail-grid panel"><div><span className="detail-label">UDISE+ code</span><strong>{row.udise_code || 'Not provided'}</strong></div><div><span className="detail-label">School type</span><strong>{row.school_type}</strong></div><div><span className="detail-label">Student strength</span><strong>{row.student_strength_total.toLocaleString('en-IN')}</strong></div><div><span className="detail-label">Verification status</span><StateBadge value={row.verification_status} /></div><div className="detail-span"><span className="detail-label">Address</span><strong>{row.address || 'Address not provided'}</strong></div></section>
    {history.error && apiMode === 'live' && <Notice tone="warning">{history.error}</Notice>}
    <section className="panel"><div className="panel-heading"><div><h2>Assessment history</h2><p>Submitted resource snapshots for this school</p></div><Link to={`/gap-analysis?school=${id}`}>View gap analysis</Link></div><DataTable rows={assessments} rowKey={(a) => a.assessment_id} columns={[{ key: 'assessment_date', label: 'Assessment date' }, { key: 'assessment_id', label: 'Assessment reference' }, { key: 'status', label: 'Status', render: (a) => <StateBadge value={a.status as 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED'} /> }]} /></section>
  </>;
}

export function SchoolFormPage() {
  const { id } = useParams(); const navigate = useNavigate(); const editing = Boolean(id);
  const [name, setName] = useState(''); const [udise, setUdise] = useState(''); const [district, setDistrict] = useState(''); const [state, setState] = useState('Karnataka'); const [schoolType, setSchoolType] = useState<School['school_type']>('GOVERNMENT'); const [strength, setStrength] = useState(''); const [address, setAddress] = useState(''); const [error, setError] = useState('');
  useEffect(() => { if (!id) return; api.schools.detail(id).then((school) => { setName(school.school_name); setUdise(school.udise_code ?? ''); setDistrict(school.district); setState(school.state); setSchoolType(school.school_type); setStrength(String(school.student_strength_total)); setAddress(school.address ?? ''); }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'School profile could not be loaded.')); }, [id]);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError('');
    const payload = { school_name: name, udise_code: udise || undefined, district, state, school_type: schoolType, student_strength_total: Number(strength), address: address || undefined };
    try { if (editing) await api.schools.update(id!, payload); else await api.schools.create(payload); navigate('/schools'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The school profile could not be saved.'); }
  }
  return <><PageTitle title={editing ? 'Edit school profile' : 'Register school profile'} description="Enter the official school details used for resource assessment and reporting." />
    {apiMode === 'live' && editing && <Notice tone="warning">The backend does not expose a school profile edit endpoint. The form is demonstration-only until that API contract is available.</Notice>}
    {error && <Notice tone="error">{error}</Notice>}
    <form className="panel form-panel form-stack" onSubmit={submit}>
      <FormField label="School name" htmlFor="school-name"><input id="school-name" required maxLength={255} value={name} onChange={(e) => setName(e.target.value)} /></FormField>
      <FormField label="UDISE+ code" htmlFor="udise" hint="Enter the 11-digit code when available."><input id="udise" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} value={udise} onChange={(e) => setUdise(e.target.value)} /></FormField>
      <div className="form-row"><FormField label="District" htmlFor="school-district"><input id="school-district" required value={district} onChange={(e) => setDistrict(e.target.value)} /></FormField><FormField label="State" htmlFor="school-state"><input id="school-state" required value={state} onChange={(e) => setState(e.target.value)} /></FormField></div>
      <div className="form-row"><FormField label="School type" htmlFor="school-type"><select id="school-type" value={schoolType} onChange={(e) => setSchoolType(e.target.value as School['school_type'])}><option value="GOVERNMENT">Government</option><option value="AIDED">Aided</option><option value="PRIVATE">Private</option></select></FormField><FormField label="Total student strength" htmlFor="student-strength"><input id="student-strength" type="number" min="0" required value={strength} onChange={(e) => setStrength(e.target.value)} /></FormField></div>
      <FormField label="Address" htmlFor="school-address"><textarea id="school-address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} /></FormField>
      <div className="form-actions"><Link className="button button-secondary" to="/schools">Cancel</Link><button className="button button-primary" type="submit">{editing ? 'Save changes' : 'Register school'}</button></div>
    </form>
  </>;
}
