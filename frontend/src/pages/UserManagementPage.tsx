import { FormEvent, useState } from 'react';
import { api, apiMode } from '../api/client';
import { DataTable, FormField, Notice, PageTitle, Pagination } from '../components/Shared';
import { useAsync } from '../hooks/useAsync';
import type { AdminUser, Role } from '../types';

export function UserManagementPage() {
  const [page, setPage] = useState(1); const [search, setSearch] = useState(''); const [showForm, setShowForm] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const users = useAsync(() => api.admin.users({ page, page_size: 10, search }), [page, search]);
  const [email, setEmail] = useState(''); const [fullName, setFullName] = useState(''); const [password, setPassword] = useState(''); const [role, setRole] = useState<Role>('FIELD_COORDINATOR');
  async function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setMessage(''); try { await api.admin.createUser({ email, full_name: fullName, password, role }); setMessage('The account was created.'); setShowForm(false); users.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'The account could not be created.'); } }
  async function toggle(row: AdminUser) { setError(''); setMessage(''); try { await api.admin.updateUser(row.user_id, { is_active: !row.is_active }); setMessage(`Account ${row.email} was ${row.is_active ? 'deactivated' : 'activated'}.`); users.reload(); } catch (e) { setError(e instanceof Error ? e.message : 'The account could not be updated.'); } }
  return <>
    <PageTitle title="User management" description="Review user accounts and create administrator or field coordinator accounts." actions={<button className="button button-primary" onClick={() => setShowForm((open) => !open)}>{showForm ? 'Close form' : 'Create account'}</button>} />
    {apiMode === 'live' && <Notice>School and organisation accounts register through the public role-specific registration flow. This screen creates administrator and field coordinator accounts.</Notice>}
    {message && <Notice tone="success">{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {showForm && <form className="panel form-panel form-stack" onSubmit={create}><h2>New account</h2><div className="form-row"><FormField label="Full name" htmlFor="user-name"><input id="user-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} /></FormField><FormField label="Email address" htmlFor="user-email"><input id="user-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></FormField></div><div className="form-row"><FormField label="Initial password" htmlFor="user-password" hint="At least 10 characters, including a letter and a number."><input id="user-password" type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} /></FormField><FormField label="Role" htmlFor="user-role"><select id="user-role" value={role} onChange={(e) => setRole(e.target.value as Role)}><option value="FIELD_COORDINATOR">Field Coordinator</option><option value="ADMIN">Administrator</option></select></FormField></div><div className="form-actions"><button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" type="submit">Create account</button></div></form>}
    <section className="panel filter-panel"><FormField label="Search by name or email" htmlFor="user-search"><input id="user-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></FormField></section>
    {users.error && <Notice tone="error">{users.error}</Notice>}
    <section className="panel"><DataTable<AdminUser> rows={users.data?.data ?? []} rowKey={(row) => row.user_id} columns={[
      { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email address' }, { key: 'role', label: 'Role', render: (row) => row.role.replace(/_/g, ' ') }, { key: 'is_active', label: 'Account status', render: (row) => row.is_active ? 'Active' : 'Inactive' },
      { key: 'action', label: 'Action', render: (row) => <button className="button button-secondary button-small" onClick={() => toggle(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button> },
    ]} /><Pagination page={page} pageSize={10} total={users.data?.total_count ?? 0} onChange={setPage} /></section>
  </>;
}
