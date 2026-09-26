import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { apiMode } from './api/client';
import { useAuth } from './auth/AuthContext';
import type { Role } from './types';
import { PortalLayout } from './components/PortalLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SchoolsPage, SchoolDetailPage, SchoolFormPage } from './pages/SchoolsPage';
import { AssessmentsPage, AssessmentFormPage } from './pages/AssessmentsPage';
import { RequirementsPage, RequirementDetailPage } from './pages/RequirementsPage';
import { GapAnalysisPage, PriorityPage } from './pages/AnalysisPages';
import { ReportsPage } from './pages/ReportsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { ResourceConfigurationPage } from './pages/ResourceConfigurationPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="main-content" aria-live="polite">Checking sign-in status…</main>;
  return user ? <>{children}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

function RoleOnly({ children, roles }: { children: React.ReactNode; roles: Role[] }) {
  const { user } = useAuth();
  return user && roles.includes(user.role) ? <>{children}</> : <Navigate to="/dashboard" replace />;
}

export function App() {
  const { user } = useAuth();
  return <>
    {apiMode === 'mock' && user && <div className="demo-banner">Demonstration data is enabled. Changes are not sent to the backend.</div>}
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route element={<Protected><PortalLayout /></Protected>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/schools" element={<RoleOnly roles={['SCHOOL','ADMIN','FIELD_COORDINATOR']}><SchoolsPage /></RoleOnly>} />
        <Route path="/schools/new" element={<RoleOnly roles={['ADMIN','FIELD_COORDINATOR']}><SchoolFormPage /></RoleOnly>} />
        <Route path="/schools/:id" element={<RoleOnly roles={['SCHOOL','ADMIN','FIELD_COORDINATOR']}><SchoolDetailPage /></RoleOnly>} />
        <Route path="/schools/:id/edit" element={<RoleOnly roles={['ADMIN','FIELD_COORDINATOR']}><SchoolFormPage /></RoleOnly>} />
        <Route path="/assessments" element={<RoleOnly roles={['SCHOOL','ADMIN','FIELD_COORDINATOR']}><AssessmentsPage /></RoleOnly>} />
        <Route path="/assessments/new" element={<RoleOnly roles={['SCHOOL','FIELD_COORDINATOR']}><AssessmentFormPage /></RoleOnly>} />
        <Route path="/requirements" element={<RoleOnly roles={['SCHOOL','NGO','ADMIN','FIELD_COORDINATOR']}><RequirementsPage /></RoleOnly>} />
        <Route path="/requirements/:id" element={<RoleOnly roles={['SCHOOL','NGO','ADMIN','FIELD_COORDINATOR']}><RequirementDetailPage /></RoleOnly>} />
        <Route path="/gap-analysis" element={<RoleOnly roles={['ADMIN']}><GapAnalysisPage /></RoleOnly>} />
        <Route path="/priorities" element={<RoleOnly roles={['NGO','ADMIN','FIELD_COORDINATOR']}><PriorityPage /></RoleOnly>} />
        <Route path="/reports" element={<RoleOnly roles={['SCHOOL','NGO','ADMIN']}><ReportsPage /></RoleOnly>} />
        <Route path="/users" element={<AdminOnly><UserManagementPage /></AdminOnly>} />
        <Route path="/resource-configuration" element={<AdminOnly><ResourceConfigurationPage /></AdminOnly>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  </>;
}
