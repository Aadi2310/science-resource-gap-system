import type { AdminUser, Assessment, Page, Requirement, ResourceCategory, School, SchoolResource, SummaryReport } from '../types';

const schools: School[] = [
  { school_id: 'sch-001', school_name: 'Government Higher Secondary School, Kolar', udise_code: '29230101201', school_type: 'GOVERNMENT', district: 'Kolar', state: 'Karnataka', student_strength_total: 842, verification_status: 'VERIFIED', address: 'M.G. Road, Kolar' },
  { school_id: 'sch-002', school_name: 'Government Model School, Tumakuru', udise_code: '29260402704', school_type: 'GOVERNMENT', district: 'Tumakuru', state: 'Karnataka', student_strength_total: 615, verification_status: 'VERIFIED', address: 'Sira Road, Tumakuru' },
  { school_id: 'sch-003', school_name: 'Aided High School, Chikkaballapur', udise_code: '29280204412', school_type: 'AIDED', district: 'Chikkaballapur', state: 'Karnataka', student_strength_total: 478, verification_status: 'PENDING', address: 'B.B. Road, Chikkaballapur' },
  { school_id: 'sch-004', school_name: 'Government Composite School, Ramanagara', udise_code: '29280501903', school_type: 'GOVERNMENT', district: 'Ramanagara', state: 'Karnataka', student_strength_total: 731, verification_status: 'VERIFIED', address: 'Bengaluru–Mysuru Road, Ramanagara' },
  { school_id: 'sch-005', school_name: 'Government Girls High School, Hassan', udise_code: '29270801409', school_type: 'GOVERNMENT', district: 'Hassan', state: 'Karnataka', student_strength_total: 559, verification_status: 'VERIFIED', address: 'Salagame Road, Hassan' },
];

const requirements: Requirement[] = [
  { requirement_id: 'req-001', school_id: 'sch-001', school_name: schools[0].school_name, district: 'Kolar', resource_name: 'Student microscopes', category_name: 'Biology Equipment', gap_qty: 18, gap_ratio: 0.72, final_score: 87.2, priority_class: 'CRITICAL', status: 'OPEN', version: 1 },
  { requirement_id: 'req-002', school_id: 'sch-002', school_name: schools[1].school_name, district: 'Tumakuru', resource_name: 'Physics experiment kits', category_name: 'Physics Equipment', gap_qty: 12, gap_ratio: 0.6, final_score: 74.4, priority_class: 'HIGH', status: 'UNDER_REVIEW', version: 2 },
  { requirement_id: 'req-003', school_id: 'sch-004', school_name: schools[3].school_name, district: 'Ramanagara', resource_name: 'Chemistry glassware sets', category_name: 'Chemistry Equipment', gap_qty: 8, gap_ratio: 0.4, final_score: 62.1, priority_class: 'HIGH', status: 'IN_PROGRESS', version: 3 },
  { requirement_id: 'req-004', school_id: 'sch-005', school_name: schools[4].school_name, district: 'Hassan', resource_name: 'Desktop computers', category_name: 'Computers/Computer Lab', gap_qty: 15, gap_ratio: 0.3, final_score: 49.8, priority_class: 'MEDIUM', status: 'OPEN', version: 1 },
  { requirement_id: 'req-005', school_id: 'sch-001', school_name: schools[0].school_name, district: 'Kolar', resource_name: 'Science lab safety kits', category_name: 'Science Laboratory', gap_qty: 5, gap_ratio: 0.2, final_score: 37.6, priority_class: 'LOW', status: 'COMPLETED', version: 5 },
  { requirement_id: 'req-006', school_id: 'sch-002', school_name: schools[1].school_name, district: 'Tumakuru', resource_name: 'Internet bandwidth', category_name: 'Connectivity & EdTech', gap_qty: 1, gap_ratio: 0.5, final_score: 68.3, priority_class: 'HIGH', status: 'ACCEPTED', version: 2 },
];

const assessments: Assessment[] = [
  { assessment_id: 'asm-001', school_id: 'sch-001', assessment_date: '2026-09-19', status: 'VERIFIED', version: 3, resources: [
    { school_resource_id: 'sr-1', resource_id: 'res-1', resource_name: 'Student microscopes', required_qty: 25, available_qty: 12, functional_qty: 7, condition_rating: 'POOR', has_alternative: 'NONE', gap: { gap_qty: 18, gap_ratio: 0.72 }, resource_state: 'Gap' },
    { school_resource_id: 'sr-2', resource_id: 'res-2', resource_name: 'Lab stools', required_qty: 30, available_qty: 32, functional_qty: 30, condition_rating: 'GOOD', has_alternative: 'FULL', gap: { gap_qty: 0, gap_ratio: 0 }, resource_state: 'Adequate' },
  ] },
  { assessment_id: 'asm-002', school_id: 'sch-002', assessment_date: '2026-09-16', status: 'VERIFIED', version: 2, resources: [
    { school_resource_id: 'sr-3', resource_id: 'res-3', resource_name: 'Physics experiment kits', required_qty: 20, available_qty: 11, functional_qty: 8, condition_rating: 'FAIR', has_alternative: 'PARTIAL', gap: { gap_qty: 12, gap_ratio: 0.6 }, resource_state: 'Gap' },
    { school_resource_id: 'sr-4', resource_id: 'res-4', resource_name: 'Desktop computers', required_qty: 20, available_qty: 9, functional_qty: 7, condition_rating: 'POOR', has_alternative: 'NONE', gap: { gap_qty: 13, gap_ratio: 0.65 }, resource_state: 'Gap' },
  ] },
];

const categories: ResourceCategory[] = [
  { category_id: 'cat-1', name: 'Science Laboratory', importance_weight: 100, is_active: true },
  { category_id: 'cat-2', name: 'Physics Equipment', importance_weight: 95, is_active: true },
  { category_id: 'cat-3', name: 'Chemistry Equipment', importance_weight: 95, is_active: true },
  { category_id: 'cat-4', name: 'Biology Equipment', importance_weight: 90, is_active: true },
  { category_id: 'cat-5', name: 'Computers/Computer Lab', importance_weight: 85, is_active: true },
  { category_id: 'cat-6', name: 'Connectivity & EdTech', importance_weight: 70, is_active: true },
];

const adminUsers: AdminUser[] = [
  { user_id: 'usr-1', email: 'district.office@gov.example', role: 'ADMIN', full_name: 'District Science Officer', is_active: true },
  { user_id: 'usr-2', email: 'coordinator.kolar@gov.example', role: 'FIELD_COORDINATOR', full_name: 'Kolar Field Coordinator', is_active: true },
  { user_id: 'usr-3', email: 'school.kolar@gov.example', role: 'SCHOOL', full_name: 'GHSS Kolar School Official', is_active: true },
  { user_id: 'usr-4', email: 'program@science-foundation.example', role: 'NGO', full_name: 'Science Foundation Officer', is_active: true },
];

function page<T>(data: T[], pageNo: number, pageSize: number): Page<T> {
  const start = (pageNo - 1) * pageSize;
  return { data: data.slice(start, start + pageSize), page: pageNo, page_size: pageSize, total_count: data.length };
}

export const mockApi = {
  async schools(params: { page: number; page_size: number; search?: string; district?: string; verification_status?: string }) {
    let rows = [...schools];
    if (params.search) rows = rows.filter((s) => `${s.school_name} ${s.udise_code} ${s.district}`.toLowerCase().includes(params.search!.toLowerCase()));
    if (params.district) rows = rows.filter((s) => s.district === params.district);
    if (params.verification_status) rows = rows.filter((s) => s.verification_status === params.verification_status);
    return page(rows, params.page, params.page_size);
  },
  async school(id: string) { return schools.find((s) => s.school_id === id) ?? schools[0]; },
  async createSchool(payload: Record<string, unknown>) {
    const row = { ...payload, school_id: `sch-${Date.now()}`, verification_status: 'PENDING' as const } as School;
    schools.unshift(row); return row;
  },
  async updateSchool(id: string, payload: Record<string, unknown>) {
    const index = schools.findIndex((s) => s.school_id === id);
    if (index < 0) throw new Error('School profile was not found.');
    schools[index] = { ...schools[index], ...payload } as School;
    return schools[index];
  },
  async requirements(params: { page: number; page_size: number; priority_class?: string; status?: string; district?: string; resource_category?: string; school_id?: string }) {
    let rows = [...requirements].sort((a, b) => b.final_score - a.final_score);
    if (params.priority_class) rows = rows.filter((r) => r.priority_class === params.priority_class);
    if (params.status) rows = rows.filter((r) => r.status === params.status);
    if (params.district) rows = rows.filter((r) => r.district === params.district);
    if (params.resource_category) rows = rows.filter((r) => r.category_name === params.resource_category);
    if (params.school_id) rows = rows.filter((r) => r.school_id === params.school_id);
    return page(rows, params.page, params.page_size);
  },
  async requirement(id: string) { return requirements.find((r) => r.requirement_id === id) ?? requirements[0]; },
  async acceptRequirement(id: string) { const row = requirements.find((r) => r.requirement_id === id); if (!row) throw new Error('Requirement was not found.'); row.status = 'ACCEPTED'; row.version += 1; return row; },
  async updateRequirement(id: string, payload: Record<string, unknown>) { const row = requirements.find((r) => r.requirement_id === id); if (!row) throw new Error('Requirement was not found.'); if (typeof payload.new_status === 'string') row.status = payload.new_status as Requirement['status']; Object.assign(row, payload); row.version += 1; return row; },
  async recordFeedback(id: string, payload: Record<string, unknown>) { const row = requirements.find((r) => r.requirement_id === id); if (!row) throw new Error('Requirement was not found.'); if (payload.confirmation === 'CONFIRMED') row.status = 'CLOSED'; if (payload.confirmation === 'DISPUTED') row.status = 'DISPUTED'; row.version += 1; return row; },
  async assessments(schoolId: string) { return assessments.filter((a) => a.school_id === schoolId); },
  async schoolHistory(id: string) { return { school: await this.school(id), assessments: assessments.filter((a) => a.school_id === id), requirements: requirements.filter((r) => r.school_id === id) }; },
  async categories() { return page(categories, 1, 100); },
  async resources(categoryId: string) {
    return page([
      { resource_id: 'res-1', category_id: categoryId, name: 'Student microscopes', unit_of_measure: 'unit', is_active: true },
      { resource_id: 'res-2', category_id: categoryId, name: 'Laboratory equipment sets', unit_of_measure: 'set', is_active: true },
    ], 1, 100);
  },
  async summary(): Promise<SummaryReport> {
    return {
      open_by_priority: [{ priority_class: 'CRITICAL', count: 4 }, { priority_class: 'HIGH', count: 12 }, { priority_class: 'MEDIUM', count: 19 }, { priority_class: 'LOW', count: 8 }],
      status_funnel: [{ status: 'OPEN', count: 21 }, { status: 'UNDER_REVIEW', count: 7 }, { status: 'ACCEPTED', count: 5 }, { status: 'IN_PROGRESS', count: 8 }, { status: 'PARTIALLY_COMPLETED', count: 3 }, { status: 'COMPLETED', count: 11 }, { status: 'NOT_FEASIBLE', count: 2 }, { status: 'DISPUTED', count: 1 }, { status: 'CLOSED', count: 16 }],
      open_by_district_and_category: [{ district: 'Kolar', resource_category: 'Biology Equipment', priority_class: 'CRITICAL', count: 3 }, { district: 'Tumakuru', resource_category: 'Physics Equipment', priority_class: 'HIGH', count: 5 }, { district: 'Hassan', resource_category: 'Computers/Computer Lab', priority_class: 'MEDIUM', count: 4 }],
    };
  },
  async users(params: { page: number; page_size: number; search?: string }) {
    const rows = params.search ? adminUsers.filter((u) => `${u.full_name} ${u.email}`.toLowerCase().includes(params.search!.toLowerCase())) : adminUsers;
    return page(rows, params.page, params.page_size);
  },
  async coverage() { return { coverage_percent: 68.4, verified_schools: 284 }; },
  async turnaround() { return [{ org_name: 'Science Foundation', resource_category: 'Biology Equipment', average_days: 24.6, completed_count: 8 }, { org_name: 'Education Support Trust', resource_category: 'Physics Equipment', average_days: 31.2, completed_count: 5 }]; },
  async createAssessment(schoolId: string, payload: Record<string, unknown>) {
    const entries = ((payload.resources as Array<Record<string, unknown>> | undefined) ?? []).map((entry, index) => {
      const required = Number(entry.required_qty); const functional = Number(entry.functional_qty); const gapQty = Math.max(required - functional, 0);
      return { ...entry, school_resource_id: `new-sr-${Date.now()}-${index}`, gap: { gap_qty: gapQty, gap_ratio: required ? gapQty / required : 0 }, resource_state: gapQty ? 'Gap' as const : 'Adequate' as const } as unknown as SchoolResource;
    });
    const row = { assessment_id: `asm-${Date.now()}`, school_id: schoolId, assessment_date: String(payload.assessment_date), status: 'DRAFT' as const, version: 1, resources: entries };
    assessments.unshift(row); return row;
  },
  async submitAssessment(id: string) { const row = assessments.find((assessment) => assessment.assessment_id === id); if (!row) throw new Error('Assessment was not found.'); row.status = 'SUBMITTED'; row.version += 1; return row; },
  async verifyAssessment(id: string, status: 'VERIFIED' | 'REJECTED') { const row = assessments.find((assessment) => assessment.assessment_id === id); if (!row) throw new Error('Assessment was not found.'); row.status = status; row.version += 1; return row; },
  async createUser(payload: Record<string, unknown>) { const row = { user_id: `usr-${Date.now()}`, email: String(payload.email), role: payload.role as AdminUser['role'], full_name: String(payload.full_name), is_active: true }; adminUsers.unshift(row); return row; },
  async updateUser(id: string, payload: Record<string, unknown>) { const row = adminUsers.find((user) => user.user_id === id); if (!row) throw new Error('User account was not found.'); Object.assign(row, payload); return row; },
};

export const mockSummaryStats = { totalSchools: 284, totalGaps: 43, highPriority: 16, recentAssessments: 12 };
export const mockSchools = schools;
export const mockRequirements = requirements;
