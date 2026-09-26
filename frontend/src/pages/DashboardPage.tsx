import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { FieldCoordinatorDashboard } from './dashboards/FieldCoordinatorDashboard';
import { NgoDashboard } from './dashboards/NgoDashboard';
import { SchoolDashboard } from './dashboards/SchoolDashboard';

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'SCHOOL') return <SchoolDashboard />;
  if (user?.role === 'NGO') return <NgoDashboard />;
  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'FIELD_COORDINATOR') return <FieldCoordinatorDashboard />;
  return <Navigate to="/login" replace />;
}
