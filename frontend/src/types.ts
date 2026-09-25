export type Role = 'SCHOOL' | 'NGO' | 'ADMIN' | 'FIELD_COORDINATOR';
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type RequirementStatus = 'OPEN' | 'UNDER_REVIEW' | 'ACCEPTED' | 'IN_PROGRESS' | 'PARTIALLY_COMPLETED' | 'COMPLETED' | 'NOT_FEASIBLE' | 'DISPUTED' | 'CLOSED';

export interface UserSession {
  user_id: string;
  role: Role;
  full_name?: string;
  email?: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  role: Role;
}

export interface School {
  school_id: string;
  user_id?: string;
  school_name: string;
  udise_code?: string | null;
  school_type: 'GOVERNMENT' | 'AIDED' | 'PRIVATE';
  district: string;
  state: string;
  student_strength_total: number;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  address?: string | null;
}

export interface Requirement {
  requirement_id: string;
  school_id: string;
  school_name: string;
  district: string;
  resource_name: string;
  category_name: string;
  gap_qty: number;
  gap_ratio: number;
  final_score: number;
  priority_class: Priority;
  status: RequirementStatus;
  version: number;
  data_changed_since_acceptance?: boolean;
}

export interface Page<T> {
  data: T[];
  page: number;
  page_size: number;
  total_count: number;
}

export interface ResourceCategory {
  category_id: string;
  name: string;
  importance_weight: number;
  is_active: boolean;
}

export interface Resource {
  resource_id: string;
  category_id: string;
  name: string;
  unit_of_measure: string;
  is_active: boolean;
}

export interface SchoolResource {
  school_resource_id: string;
  resource_id: string;
  resource_name?: string;
  required_qty: number;
  available_qty: number;
  functional_qty: number;
  condition_rating: 'GOOD' | 'FAIR' | 'POOR' | 'NOT_APPLICABLE';
  has_alternative: 'NONE' | 'PARTIAL' | 'FULL';
  gap?: { gap_qty: number; gap_ratio: number } | null;
  resource_state?: 'Adequate' | 'Gap' | null;
}

export interface Assessment {
  assessment_id: string;
  school_id: string;
  assessment_date: string;
  status: 'DRAFT' | 'SUBMITTED' | 'VERIFIED' | 'REJECTED';
  version: number;
  resources?: SchoolResource[];
}

export interface SummaryReport {
  open_by_priority: Array<{ priority_class: Priority; count: number }>;
  status_funnel: Array<{ status: RequirementStatus; count: number }>;
  open_by_district_and_category: Array<{ district: string; resource_category: string; priority_class: Priority; count: number }>;
}

export interface TurnaroundReport {
  org_id?: string;
  org_name: string;
  resource_category: string;
  average_days: number;
  completed_count: number;
}

export interface AdminUser {
  user_id: string;
  email: string;
  role: Role;
  full_name: string;
  is_active: boolean;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
