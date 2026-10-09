export type Question = { id: string; category: string; points: number; question: string; answer: string };
export type Match = { teams: string[]; scores: number[]; turn: number; categories: string[]; questions: Question[]; completed: string[]; active: string | null; revealed: boolean; stealing: boolean; seconds: number; paused: boolean; finished: boolean };
export const QUESTION_SECONDS = 60;
export const STEAL_SECONDS = 30;
export const POINT_VALUES = [200, 400, 600] as const;
export function selectQuestions(bank: Question[], categories: string[], used: string[], random = Math.random): Question[] {
  if (categories.length !== 6 || new Set(categories).size !== 6) throw new Error('اختر ٣ فئات لكل فريق، دون تكرار.');
  const excluded = new Set(used);
  return categories.flatMap(category => POINT_VALUES.flatMap(points => {
    const pool = bank.filter(q => q.category === category && q.points === points && !excluded.has(q.id));
    if (pool.length < 2) throw new Error('انتهت الأسئلة الجديدة في إحدى الفئات. اختر فئة أخرى.');
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); const a = pool[i]; const b = pool[j]; if(a && b){pool[i]=b;pool[j]=a;} }
    return pool.slice(0, 2);
  }));
}
export function newMatch(teams: string[], categories: string[], questions: Question[]): Match {
  return { teams, categories, questions, scores: [0, 0], turn: 0, completed: [], active: null, revealed: false, stealing: false, seconds: QUESTION_SECONDS, paused: false, finished: false };
}
export function settleQuestion(match: Match, winner: number | null): Match {
  const question = match.questions.find(q => q.id === match.active);
  if (!question) return match;
  const scores = [...match.scores];
  if (winner !== null) scores[winner] = (scores[winner] ?? 0) + question.points;
  const completed = [...match.completed, question.id];
  return { ...match, scores, completed, active: null, turn: 1 - match.turn, stealing: false, revealed: false, paused: false, seconds: QUESTION_SECONDS, finished: completed.length === match.questions.length };
}