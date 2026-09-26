import { mockApi } from './mock';
import type { AdminUser, Assessment, Page, Requirement, Resource, ResourceCategory, School, SummaryReport, TokenPair, TurnaroundReport, UserSession } from '../types';

const baseUrl = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
export const apiMode = import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'live';
const ACCESS_KEY = 'srg_access_token';
const REFRESH_KEY = 'srg_refresh_token';

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

function token() { return localStorage.getItem(ACCESS_KEY); }
function storeTokens(pair: TokenPair) {
  localStorage.setItem(ACCESS_KEY, pair.access_token);
  localStorage.setItem(REFRESH_KEY, pair.refresh_token);
}
export function clearTokens() { localStorage.removeItem(ACCESS_KEY); localStorage.removeItem(REFRESH_KEY); localStorage.removeItem('srg_user'); }

let refreshInFlight: Promise<boolean> | null = null;
function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return Promise.resolve(false);
    refreshInFlight = fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).then(async (response) => {
      if (!response.ok) {
        clearTokens();
        return false;
      }
      storeTokens(await response.json() as TokenPair);
      return true;
    }).catch(() => {
      clearTokens();
      return false;
    }).finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token()) headers.set('Authorization', `Bearer ${token()}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (response.status === 401 && retry && localStorage.getItem(REFRESH_KEY) && !path.endsWith('/auth/refresh')) {
    if (await refreshAccessToken()) return request<T>(path, init, false);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    let code: string | undefined;
    try { const payload = await response.json(); message = payload.error?.message ?? message; code = payload.error?.code; } catch { /* response has no JSON body */ }
    throw new ApiError(message, response.status, code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function query(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== '') search.set(key, String(value)); });
  return search.toString();
}

export const api = {
  dashboard: {
    schoolForUser(userId: string) { return apiMode === 'mock' ? mockApi.schoolForUser(userId) : Promise.resolve(null); },
    assignedSchools(userId: string) { return apiMode === 'mock' ? mockApi.assignedSchools(userId) : Promise.resolve([]); },
    allAssessments() { return apiMode === 'mock' ? mockApi.allAssessments() : Promise.resolve([]); },
  },
  auth: {
    async login(email: string, password: string, demoRole: UserSession['role']): Promise<UserSession> {
      if (apiMode === 'mock') {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        const pair: TokenPair = { access_token: 'mock-access-token', refresh_token: 'mock-refresh-token', role: demoRole };
        storeTokens(pair);
        const user = { user_id: `demo-${demoRole.toLowerCase()}`, role: demoRole, full_name: email.split('@')[0].replace(/[._-]/g, ' ') || 'Demonstration user', email };
        localStorage.setItem('srg_user', JSON.stringify(user));
        return user;
      }
      const pair = await request<TokenPair>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      storeTokens(pair);
      const session = await request<{ user_id: string; role: UserSession['role'] }>('/session');
      const user = { ...session, email };
      localStorage.setItem('srg_user', JSON.stringify(user));
      return user;
    },
    async restoreSession(): Promise<UserSession | null> {
      if (apiMode === 'mock') {
        try { return JSON.parse(localStorage.getItem('srg_user') ?? 'null') as UserSession | null; }
        catch { clearTokens(); return null; }
      }
      if (!token() && !localStorage.getItem(REFRESH_KEY)) return null;
      try {
        const session = await request<{ user_id: string; role: UserSession['role'] }>('/session');
        const cached = JSON.parse(localStorage.getItem('srg_user') ?? 'null') as Partial<UserSession> | null;
        const user = { ...session, email: cached?.email, full_name: cached?.full_name };
        localStorage.setItem('srg_user', JSON.stringify(user));
        return user;
      } catch {
        clearTokens();
        return null;
      }
    },
    async logout() {
      if (apiMode === 'live' && token()) {
        await request<void>('/auth/logout', { method: 'POST', body: JSON.stringify({ refresh_token: localStorage.getItem(REFRESH_KEY) }) }).catch(() => undefined);
      }
      clearTokens();
    },
  },
  schools: {
    list(params: { page: number; page_size: number; search?: string; district?: string; verification_status?: string }): Promise<Page<School>> {
      if (apiMode === 'mock') return mockApi.schools(params);
      throw new ApiError('The backend does not expose a school collection endpoint yet.', 501, 'ENDPOINT_NOT_AVAILABLE');
    },
    detail(id: string): Promise<School | null> { return apiMode === 'mock' ? mockApi.school(id) : request<School>(`/schools/${id}`); },
    create(payload: Record<string, unknown>): Promise<School> { return apiMode === 'mock' ? mockApi.createSchool(payload) : request<School>('/schools', { method: 'POST', body: JSON.stringify(payload) }); },
    update(id: string, payload: Record<string, unknown>): Promise<School> {
      if (apiMode === 'mock') return mockApi.updateSchool(id, payload);
      return Promise.reject(new ApiError('The backend does not expose a school edit endpoint yet.', 501, 'ENDPOINT_NOT_AVAILABLE'));
    },
  },
  requirements: {
    list(params: { page: number; page_size: number; priority_class?: string; status?: string; district?: string; resource_category?: string; school_id?: string }): Promise<Page<Requirement>> {
      if (apiMode === 'mock') return mockApi.requirements(params);
      return request<Page<Requirement>>(`/requirements?${query(params)}`);
    },
    detail(id: string): Promise<Requirement | null> { return apiMode === 'mock' ? mockApi.requirement(id) : request<Requirement>(`/requirements/${id}`); },
    async accept(id: string, expected_version: number) {
      if (apiMode === 'mock') return mockApi.acceptRequirement(id);
      return request<{ status: string }>(`/requirements/${id}/accept`, { method: 'POST', body: JSON.stringify({ expected_version }) });
    },
    updateStatus(id: string, payload: Record<string, unknown>) {
      if (apiMode === 'mock') return mockApi.updateRequirement(id, payload);
      return request<Record<string, unknown>>(`/requirements/${id}/status`, { method: 'POST', body: JSON.stringify(payload) });
    },
    acknowledgeChange(id: string, expected_version: number) {
      if (apiMode === 'mock') return mockApi.updateRequirement(id, { data_changed_since_acceptance: false });
      return request<Record<string, unknown>>(`/requirements/${id}/acknowledge-data-change`, { method: 'POST', body: JSON.stringify({ expected_version }) });
    },
    feedback(id: string, payload: Record<string, unknown>) {
      if (apiMode === 'mock') return mockApi.recordFeedback(id, payload);
      return request<Record<string, unknown>>(`/requirements/${id}/feedback`, { method: 'POST', body: JSON.stringify(payload) });
    },
    create(): Promise<never> { return Promise.reject(new ApiError('Requirements are generated from verified assessments by the backend.', 501, 'SERVER_GENERATED')); },
    update(): Promise<never> { return Promise.reject(new ApiError('Requirement changes are limited to the documented lifecycle actions.', 501, 'LIFECYCLE_CONTROLLED')); },
  },
  assessments: {
    list(schoolId: string): Promise<Page<Assessment>> {
      if (apiMode === 'mock') return mockApi.assessments(schoolId).then((data) => ({ data, page: 1, page_size: 20, total_count: data.length }));
      return request<Page<Assessment>>(`/schools/${schoolId}/assessments?page=1&page_size=100`);
    },
    create(schoolId: string, payload: Record<string, unknown>) {
      if (apiMode === 'mock') return mockApi.createAssessment(schoolId, payload);
      return request<{ assessment_id: string; status: 'DRAFT'; version: number }>(`/schools/${schoolId}/assessments`, { method: 'POST', body: JSON.stringify(payload) });
    },
    submit(id: string, expected_version: number) {
      if (apiMode === 'mock') return mockApi.submitAssessment(id);
      return request<Assessment>(`/assessments/${id}/submit`, { method: 'POST', body: JSON.stringify({ expected_version }) });
    },
    verify(id: string, payload: { status: 'VERIFIED' | 'REJECTED'; expected_version: number; reason?: string }) {
      if (apiMode === 'mock') return mockApi.verifyAssessment(id, payload.status);
      return request<Assessment>(`/assessments/${id}/verify`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
  },
  resources: {
    categories(): Promise<Page<ResourceCategory>> { return apiMode === 'mock' ? mockApi.categories() : request<Page<ResourceCategory>>('/resource-categories?page=1&page_size=100'); },
    list(categoryId: string): Promise<Page<Resource>> { return apiMode === 'mock' ? mockApi.resources(categoryId) : request<Page<Resource>>(`/resources?${query({ category_id: categoryId, page: 1, page_size: 100 })}`); },
  },
  reports: {
    summary(): Promise<SummaryReport> { return apiMode === 'mock' ? mockApi.summary() : request<SummaryReport>('/reports/summary'); },
    coverage(): Promise<{ coverage_percent: number; verified_schools: number }> { return apiMode === 'mock' ? mockApi.coverage() : request('/reports/coverage'); },
    turnaround(): Promise<TurnaroundReport[]> { return apiMode === 'mock' ? mockApi.turnaround() : request<Page<TurnaroundReport>>('/reports/turnaround?page=1&page_size=100').then((result) => result.data); },
    schoolHistory(id: string) { return apiMode === 'mock' ? mockApi.schoolHistory(id) : request(`/reports/school/${id}/history`); },
  },
  admin: {
    users(params: { page: number; page_size: number; search?: string }): Promise<Page<AdminUser>> { return apiMode === 'mock' ? mockApi.users(params) : request<Page<AdminUser>>(`/users?${query(params)}`); },
    createUser(payload: Record<string, unknown>) { return apiMode === 'mock' ? mockApi.createUser(payload) : request('/users', { method: 'POST', body: JSON.stringify(payload) }); },
    updateUser(id: string, payload: Record<string, unknown>) { return apiMode === 'mock' ? mockApi.updateUser(id, payload) : request(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); },
  },
};
