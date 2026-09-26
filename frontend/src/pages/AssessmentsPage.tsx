import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, apiMode } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { FormField, Notice, PageTitle, StateBadge, DataTable } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import type { Assessment, Resource, ResourceCategory, SchoolResource } from '../types';

export function AssessmentsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [schoolId, setSchoolId] = useState(searchParams.get('school') ?? '');
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [rejectingId, setRejectingId] = useState(''); const [rejectionReason, setRejectionReason] = useState('');
  const emptyList = { data: [] as Assessment[], page: 1, page_size: 100, total_count: 0 };
  const list = useAsync(() => !schoolId ? Promise.resolve(emptyList) : apiMode === 'mock' || user?.role === 'ADMIN' || user?.role === 'SCHOOL' ? api.reports.schoolHistory(schoolId).then((history) => ({ data: (history as { assessments: Assessment[] }).assessments, page: 1, page_size: 100, total_count: (history as { assessments: Assessment[] }).assessments.length })) : api.assessments.list(schoolId), [schoolId, user?.role]);
  async function submitAssessment(row: Assessment) {
    setSubmittedMessage('');
    try { await api.assessments.submit(row.assessment_id, row.version); setSubmittedMessage(`Assessment ${row.assessment_id} was submitted for verification.`); list.reload(); }
    catch (e) { setSubmittedMessage(e instanceof Error ? e.message : 'The assessment could not be submitted.'); }
  }
  async function verifyAssessment(row: Assessment, status: 'VERIFIED' | 'REJECTED') {
    setSubmittedMessage('');
    try {
      await api.assessments.verify(row.assessment_id, { status, expected_version: row.version, ...(status === 'REJECTED' ? { reason: rejectionReason } : {}) });
      setSubmittedMessage(`Assessment ${row.assessment_id} was ${status.toLowerCase()}.`);
      setRejectingId(''); setRejectionReason(''); list.reload();
    } catch (e) { setSubmittedMessage(e instanceof Error ? e.message : 'The assessment could not be verified.'); }
  }
  const schoolOptions = useAsync(async () => {
    if (!user || apiMode !== 'mock') return [];
    if (user.role === 'SCHOOL') { const school = await api.dashboard.schoolForUser(user.user_id); return school ? [school] : []; }
    if (user.role === 'FIELD_COORDINATOR') return api.dashboard.assignedSchools(user.user_id);
    return (await api.schools.list({ page: 1, page_size: 100 })).data;
  }, [user?.role, user?.user_id]);
  const schools = schoolOptions.data ?? [];
  useEffect(() => {
    if (!schools.some((school) => school.school_id === schoolId) && schools.length) setSchoolId(schools[0].school_id);
  }, [schoolId, schools]);
  return <>
    <PageTitle title="Resource assessments" description="Review school resource snapshots and record new assessment data." actions={(user?.role === 'SCHOOL' || user?.role === 'FIELD_COORDINATOR' || apiMode === 'mock') ? <Link className="button button-primary" to={`/assessments/new?school=${schoolId}`}>Record an assessment</Link> : undefined} />
    {apiMode === 'live' && <Notice tone="info">Assessment history is requested for one school at a time. Enter a school ID to view records; the backend does not provide a school collection endpoint.</Notice>}
    <section className="panel filter-panel"><div className="filter-grid">
      {apiMode === 'mock' ? <FormField label="School" htmlFor="assessment-school"><select id="assessment-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{schools.map((school) => <option key={school.school_id} value={school.school_id}>{school.school_name}</option>)}</select></FormField> : <FormField label="School ID" htmlFor="assessment-school"><input id="assessment-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} /></FormField>}
    </div></section>
    {user?.role === 'ADMIN' && rejectingId && <section className="panel form-stack"><h2>Reject assessment</h2><FormField label="Reason for rejection" htmlFor="assessment-rejection-reason"><textarea id="assessment-rejection-reason" required value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></FormField><div className="form-actions"><button className="button button-secondary" onClick={() => { setRejectingId(''); setRejectionReason(''); }}>Cancel</button><button className="button button-primary" disabled={!rejectionReason.trim()} onClick={() => { const row = list.data?.data.find((assessment) => assessment.assessment_id === rejectingId); if (row) void verifyAssessment(row, 'REJECTED'); }}>Record rejection</button></div></section>}
    {submittedMessage && <Notice>{submittedMessage}</Notice>}{list.error && apiMode === 'live' && <Notice tone="warning">{list.error}</Notice>}
    <section className="panel"><DataTable<Assessment> rows={list.data?.data ?? []} rowKey={(row) => row.assessment_id} columns={[
      { key: 'assessment_date', label: 'Assessment date' }, { key: 'assessment_id', label: 'Reference' }, { key: 'status', label: 'Status', render: (row) => <StateBadge value={row.status} /> },
      { key: 'resources', label: 'Resource entries', render: (row) => row.resources?.length ?? '—' },
      { key: 'actions', label: 'Action', render: (row) => row.status === 'DRAFT' && user?.role !== 'ADMIN' ? <button className="button button-secondary button-small" onClick={() => submitAssessment(row)}>Submit assessment</button> : row.status === 'SUBMITTED' && user?.role === 'ADMIN' ? <span className="form-actions"><button className="button button-primary button-small" onClick={() => void verifyAssessment(row, 'VERIFIED')}>Verify</button><button className="button button-secondary button-small" onClick={() => { setRejectingId(row.assessment_id); setRejectionReason(''); }}>Reject</button></span> : <span className="muted">No action available</span> },
    ]} /></section>
  </>;
}

interface Entry { resource_id: string; required_qty: string; available_qty: string; functional_qty: string; condition_rating: SchoolResource['condition_rating']; has_alternative: SchoolResource['has_alternative']; students_affected: string; }
const emptyEntry = (): Entry => ({ resource_id: '', required_qty: '', available_qty: '', functional_qty: '', condition_rating: 'NOT_APPLICABLE', has_alternative: 'NONE', students_affected: '' });

export function AssessmentFormPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState(params.get('school') ?? '');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<Entry[]>([emptyEntry()]);
  const schoolOptions = useAsync(async () => {
    if (!user || apiMode !== 'mock') return [];
    if (user.role === 'SCHOOL') { const school = await api.dashboard.schoolForUser(user.user_id); return school ? [school] : []; }
    if (user.role === 'FIELD_COORDINATOR') return api.dashboard.assignedSchools(user.user_id);
    return [];
  }, [user?.role, user?.user_id]);
  const allowedSchools = schoolOptions.data ?? [];
  useEffect(() => {
    if (!allowedSchools.some((school) => school.school_id === schoolId) && allowedSchools.length) setSchoolId(allowedSchools[0].school_id);
  }, [allowedSchools, schoolId]);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const categories = useAsync(() => api.resources.categories());
  const categoryRows = categories.data?.data ?? [];
  const effectiveCategory = categoryId || categoryRows[0]?.category_id || '';
  const resources = useAsync(() => effectiveCategory ? api.resources.list(effectiveCategory) : Promise.resolve({ data: [], page: 1, page_size: 100, total_count: 0 }), [effectiveCategory]);
  const visibleResources = resources.data?.data ?? [];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const clean = entries.filter((row) => row.resource_id).map((row) => ({ resource_id: row.resource_id, required_qty: Number(row.required_qty), available_qty: Number(row.available_qty), functional_qty: Number(row.functional_qty), condition_rating: row.condition_rating, has_alternative: row.has_alternative, ...(row.students_affected ? { students_affected: Number(row.students_affected) } : {}) }));
    if (!clean.length) { setError('Add at least one resource entry before saving the assessment.'); return; }
    if (clean.some((row) => row.functional_qty > row.available_qty)) { setError('Functional quantity cannot exceed available quantity.'); return; }
    try {
      const result = await api.assessments.create(schoolId, { idempotency_key: crypto.randomUUID(), assessment_date: date, resources: clean });
      setMessage(`Draft assessment ${result.assessment_id} was created. Submit it for administrator verification when the entries are complete.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'The assessment could not be saved.'); }
  }
  function update(index: number, patch: Partial<Entry>) { setEntries((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row)); }

  return <>
    <PageTitle title="Record resource assessment" description="Enter required, available, and functional quantities for each science resource." />
    {apiMode === 'live' && <Notice>Only verified assessments contribute to gap and priority calculations. A submitted assessment cannot be edited.</Notice>}
    {categories.error && <Notice tone="warning">{categories.error}</Notice>}{error && <Notice tone="error">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
    <form className="form-stack" onSubmit={save}>
      <section className="panel form-panel"><h2>Assessment details</h2><div className="form-row">
        {apiMode === 'mock' ? <FormField label="School" htmlFor="assessment-school-id"><select id="assessment-school-id" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{allowedSchools.map((school) => <option key={school.school_id} value={school.school_id}>{school.school_name}</option>)}</select></FormField> : <FormField label="School ID" htmlFor="assessment-school-id"><input id="assessment-school-id" required value={schoolId} onChange={(e) => setSchoolId(e.target.value)} /></FormField>}
        <FormField label="Assessment date" htmlFor="assessment-date"><input id="assessment-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
      </div></section>
      <section className="panel form-panel"><div className="panel-heading"><div><h2>Resource entries</h2><p>Record quantities and the condition of available items.</p></div><button className="button button-secondary button-small" type="button" onClick={() => setEntries((rows) => [...rows, emptyEntry()])}>Add resource row</button></div>
        {entries.map((entry, index) => <fieldset className="resource-entry" key={index}><legend>Resource entry {index + 1}</legend>
          <div className="form-row"><FormField label="Resource category" htmlFor={`category-${index}`}><select id={`category-${index}`} value={effectiveCategory} onChange={(e) => { setCategoryId(e.target.value); update(index, { resource_id: '' }); }}>{categoryRows.map((category: ResourceCategory) => <option key={category.category_id} value={category.category_id}>{category.name}</option>)}</select></FormField>
            <FormField label="Resource" htmlFor={`resource-${index}`}><select id={`resource-${index}`} required value={entry.resource_id} onChange={(e) => update(index, { resource_id: e.target.value })}><option value="">Select a resource</option>{visibleResources.map((resource: Resource) => <option key={resource.resource_id} value={resource.resource_id}>{resource.name} ({resource.unit_of_measure})</option>)}</select></FormField></div>
          <div className="form-row form-row-3"><FormField label="Required quantity" htmlFor={`required-${index}`}><input id={`required-${index}`} type="number" min="0" required value={entry.required_qty} onChange={(e) => update(index, { required_qty: e.target.value })} /></FormField><FormField label="Available quantity" htmlFor={`available-${index}`}><input id={`available-${index}`} type="number" min="0" required value={entry.available_qty} onChange={(e) => { const available_qty = e.target.value; update(index, { available_qty, ...(Number(available_qty) === 0 ? { condition_rating: 'NOT_APPLICABLE' } : entry.condition_rating === 'NOT_APPLICABLE' ? { condition_rating: 'POOR' } : {}) }); }} /></FormField><FormField label="Functional quantity" htmlFor={`functional-${index}`}><input id={`functional-${index}`} type="number" min="0" max={entry.available_qty || undefined} required value={entry.functional_qty} onChange={(e) => update(index, { functional_qty: e.target.value })} /></FormField></div>
          <div className="form-row form-row-3"><FormField label="Condition rating" htmlFor={`condition-${index}`}><select id={`condition-${index}`} value={entry.condition_rating} onChange={(e) => update(index, { condition_rating: e.target.value as Entry['condition_rating'] })}><option value="NOT_APPLICABLE">Not applicable (no items available)</option><option value="GOOD">Good</option><option value="FAIR">Fair</option><option value="POOR">Poor</option></select></FormField><FormField label="Practical alternative" htmlFor={`alternative-${index}`}><select id={`alternative-${index}`} value={entry.has_alternative} onChange={(e) => update(index, { has_alternative: e.target.value as Entry['has_alternative'] })}><option value="NONE">None</option><option value="PARTIAL">Partial</option><option value="FULL">Full</option></select></FormField><FormField label="Students affected (optional)" htmlFor={`affected-${index}`}><input id={`affected-${index}`} type="number" min="0" value={entry.students_affected} onChange={(e) => update(index, { students_affected: e.target.value })} /></FormField></div>
          {entries.length > 1 && <button type="button" className="text-button" onClick={() => setEntries((rows) => rows.filter((_, i) => i !== index))}>Remove resource entry {index + 1}</button>}
        </fieldset>)}
      </section>
      <div className="form-actions"><Link className="button button-secondary" to="/assessments">Cancel</Link><button className="button button-primary" type="submit">Save draft assessment</button></div>
    </form>
  </>;
}
