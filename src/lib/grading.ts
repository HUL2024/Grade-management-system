import type { GradeScaleRow } from '../types';

export function letterForScore(score: number, scale: GradeScaleRow[]): GradeScaleRow | null {
  return scale.find((row) => score >= row.min_score && score <= row.max_score) ?? null;
}

export function computeRanks<T extends { id: string; average: number | null }>(
  rows: T[],
  tieRule: string
): Map<string, number> {
  const ranked = [...rows]
    .filter((r) => r.average !== null)
    .sort((a, b) => (b.average as number) - (a.average as number));

  const positions = new Map<string, number>();
  let lastScore: number | null = null;
  let lastRank = 0;
  let seen = 0;

  for (const row of ranked) {
    seen += 1;
    if (row.average !== lastScore) {
      lastRank = tieRule === 'next_rank_skip' ? seen : lastRank + 1;
      lastScore = row.average;
    }
    positions.set(row.id, lastRank);
  }
  return positions;
}
