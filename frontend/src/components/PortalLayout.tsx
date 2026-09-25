import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { Role } from '../types';

const roleLabels: Record<Role, string> = {
  SCHOOL: 'School Official', NGO: 'Organisation User', ADMIN: 'Administrator', FIELD_COORDINATOR: 'Field Coordinator',
};
const navigation: Array<{ label: string; path: string; roles: Role[] }> = [
  { label: 'Dashboard', path: '/dashboard', roles: ['SCHOOL', 'NGO', 'ADMIN', 'FIELD_COORDINATOR'] },
  { label: 'Schools', path: '/schools', roles: ['SCHOOL', 'ADMIN', 'FIELD_COORDINATOR'] },
  { label: 'Resource assessments', path: '/assessments', roles: ['SCHOOL', 'ADMIN', 'FIELD_COORDINATOR'] },
  { label: 'Requirements', path: '/requirements', roles: ['SCHOOL', 'NGO', 'ADMIN', 'FIELD_COORDINATOR'] },
  { label: 'Gap analysis', path: '/gap-analysis', roles: ['SCHOOL', 'ADMIN'] },
  { label: 'Priority rankings', path: '/priorities', roles: ['NGO', 'ADMIN', 'FIELD_COORDINATOR'] },
  { label: 'Reports', path: '/reports', roles: ['SCHOOL', 'NGO', 'ADMIN'] },
  { label: 'User management', path: '/users', roles: ['ADMIN'] },
];

function labelForPath(path: string) {
  if (path.includes('/schools/new')) return 'Register school';
  if (path.includes('/edit')) return 'Edit school';
  if (path.startsWith('/schools/')) return 'School profile';
  if (path.includes('/assessments/new')) return 'New assessment';
  if (path.startsWith('/requirements/')) return 'Requirement details';
  return navigation.find((item) => item.path === path)?.label ?? 'Dashboard';
}

export function PortalLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = navigation.filter((item) => user && item.roles.includes(user.role));
  const current = labelForPath(location.pathname);

  async function logout() { await signOut(); navigate('/login', { replace: true }); }

  return <div className="portal-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <header className="topbar">
      <button className="menu-toggle" aria-expanded={menuOpen} aria-controls="portal-navigation" onClick={() => setMenuOpen((open) => !open)}>Menu</button>
      <div className="department-mark" aria-label="Department identity placeholder">DEPT</div>
      <div className="department-copy"><p className="department-name">Department of School Education</p><p className="system-name">Science Resource Gap System</p></div>
      <div className="topbar-account"><span className="account-name">{user?.full_name || user?.email || roleLabels[user!.role]}</span><span className="role-label">{roleLabels[user!.role]}</span><button className="button button-secondary button-small" onClick={logout}>Sign out</button></div>
    </header>
    <div className="portal-body">
      <aside id="portal-navigation" className={`sidebar${menuOpen ? ' sidebar-open' : ''}`} aria-label="Main navigation">
        <p className="nav-heading">Modules</p>
        <nav>{links.map((item) => <NavLink onClick={() => setMenuOpen(false)} key={item.path} to={item.path} className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}>{item.label}</NavLink>)}</nav>
        <div className="sidebar-footer"><span className="role-indicator">Signed in as</span><strong>{roleLabels[user!.role]}</strong></div>
      </aside>
      <main id="main-content" className="main-content" tabIndex={-1}>
        <div className="breadcrumb" aria-label="Breadcrumb"><span>Home</span><span aria-hidden="true">/</span><span aria-current="page">{current}</span></div>
        <Outlet />
      </main>
    </div>
    <footer className="portal-footer"><span>Science Resource Gap System</span><span>Government education administration portal</span></footer>
  </div>;
}
