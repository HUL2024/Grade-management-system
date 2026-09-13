import type { Grade, PeriodDirectGrade } from '../types';

/**
 * A student's final grade for one subject in one period can be entered
 * two ways:
 *  - "Detailed" (Way 1): individual assessment scores (CP, HW1, HW2, Quiz1,
 *    Quiz2, Test, etc.) that sum together.
 *  - "Direct" (Way 2): the teacher types the final period grade straight in.
 *
 * Rule: if ANY detailed assessment score exists for a student/subject/period,
 * that always wins — a direct grade is blocked from being entered, and if a
 * direct grade already existed, entering detailed scores overwrites/replaces
 * it. A direct grade is only ever used when there are no detailed scores.
 */
export function effectiveGrade(
  assessmentScores: Grade[],
  directGrade: PeriodDirectGrade | undefined
): number | null {
  const entered = assessmentScores.filter((g) => g.entry_status === 'entered' && g.score !== null);
  if (entered.length > 0) {
    return entered.reduce((sum, g) => sum + (g.score ?? 0), 0);
  }
  if (directGrade) {
    return directGrade.score;
  }
  return null;
}

/** Averages a list of period grades and rounds to a whole number (no decimals). */
export function roundWhole(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && v !== undefined);
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Averages a list of values and rounds to exactly one decimal place. */
export function roundOneDecimal(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v !== null && v !== undefined);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function gradeColorClass(value: number | null): string {
  if (value === null) return 'text-neutral-400';
  if (value >= 90) return 'text-green-400';
  if (value >= 70) return 'text-blue-400';
  return 'text-red-400';
}

/** Same grade-color bands as gradeColorClass, but hex values for contexts
 * (like html2canvas PDF export) that can't handle Tailwind's oklch-based
 * palette classes. */
export function gradeColorHexPrint(value: number | null): string {
  if (value === null) return '#000000';
  if (value >= 90) return '#15803d';
  if (value >= 70) return '#1d4ed8';
  return '#b91c1c';
}

/** A grade only counts as "approved" (safe to show on report cards / rankings) at these statuses. */
export function isApprovedStatus(status: string | undefined | null): boolean {
  return status === 'reviewed' || status === 'finalized' || status === 'locked';
}

/**
 * Same combination rule as effectiveGrade, but only returns a value once
 * every contributing entry has been approved by an administrator/principal.
 * Used for report cards and rankings — grades pending review never show here.
 */
export function effectiveApprovedGrade(
  assessmentScores: Grade[],
  directGrade: PeriodDirectGrade | undefined
): number | null {
  const entered = assessmentScores.filter((g) => g.entry_status === 'entered' && g.score !== null);
  if (entered.length > 0) {
    if (!entered.every((g) => isApprovedStatus(g.grade_status))) return null;
    return entered.reduce((sum, g) => sum + (g.score ?? 0), 0);
  }
  if (directGrade) {
    return isApprovedStatus(directGrade.status) ? directGrade.score : null;
  }
  return null;
}
