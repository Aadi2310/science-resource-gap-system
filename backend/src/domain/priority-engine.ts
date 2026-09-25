export type WeightConfig = { severity_weight: number; importance_weight: number; students_weight: number; alternative_weight: number; condition_weight: number; critical_threshold: number; high_threshold: number; medium_threshold: number };
const alternativeScores: Record<string, number> = { NONE: 100, PARTIAL: 50, FULL: 0 };
const conditionScores: Record<string, number> = { GOOD: 0, FAIR: 50, POOR: 100, NOT_APPLICABLE: 100 };

export function calculatePriority(input: { gapRatio: number; importance: number; studentsAffected: number; maxStudentsAffected: number; alternative: string; condition: string; config: WeightConfig }) {
  const severity = input.gapRatio * 100;
  const students = input.maxStudentsAffected > 0 ? Math.min(input.studentsAffected / input.maxStudentsAffected * 100, 100) : 0;
  const alternative = alternativeScores[input.alternative];
  const condition = conditionScores[input.condition];
  if (alternative === undefined || condition === undefined) throw new Error('Unsupported priority input');
  const c = input.config;
  const finalScore = c.severity_weight * severity + c.importance_weight * input.importance + c.students_weight * students + c.alternative_weight * alternative + c.condition_weight * condition;
  const priorityClass = finalScore >= c.critical_threshold ? 'CRITICAL' : finalScore >= c.high_threshold ? 'HIGH' : finalScore >= c.medium_threshold ? 'MEDIUM' : 'LOW';
  return { severity: round(severity), importance: round(input.importance), students: round(students), alternative: round(alternative), condition: round(condition), finalScore: round(finalScore), priorityClass };
}

function round(n: number) { return Math.round(n * 100) / 100; }
