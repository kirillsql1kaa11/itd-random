export interface Author {
  id: string;
  name: string;
  handle: string;
  avatarColor?: string;
  avatarText?: string;
  avatar_color?: string;
  avatar_text?: string;
  badge?: string | null;
  bio?: string | null;
  style?: string | null;
  verified?: boolean;
}

export interface QuizOption {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  avatarText: string;
  verified: boolean;
}

export interface QuizQuestion {
  id: string;
  postText: string;
  screenshot: string;
  hint: string;
  difficulty: string;
  tags: string[];
  options: QuizOption[];
  qToken: string;
}

export type GameMode = 'blitz' | 'survival' | 'practice';

export interface LeaderboardRecord {
  id?: string;
  nickname: string;
  score: number;
  streak: number;
  accuracy: number;
  mode: string;
  player_id?: string | null;
  session_id?: string | null;
  created_at?: string;
}

export interface LeaderboardResponse {
  ok: boolean;
  leaderboard: LeaderboardRecord[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface SuggestionPost {
  id?: string;
  author_id?: string;
  author_name: string;
  screenshot: string;
  post_text: string;
  submitted_by: string;
  status?: string;
  created_at?: string;
}

export interface UserStats {
  gamesPlayed: number;
  totalScore: number;
  bestScore: number;
  maxStreak: number;
  correctAnswers: number;
  totalAnswers: number;
  history: Array<{
    date: string;
    score: number;
    accuracy: number;
    mode: GameMode;
  }>;
}

export interface GameHistoryItem {
  post: QuizQuestion;
  correctAuthor: {
    name: string;
    handle: string;
    avatarColor?: string;
    avatarText?: string;
    bio?: string;
  };
  chosenAuthorId: string | null;
  isCorrect: boolean;
}

export interface GameResult {
  score: number;
  accuracy: number;
  maxStreak: number;
  correctCount: number;
  totalCount: number;
  mode: GameMode;
  isTest: boolean;
  history: GameHistoryItem[];
}

export type SubmitState = 'idle' | 'saving' | 'done' | 'error' | 'skipped';

export interface AnalyticsDay {
  date: string;
  sessions: number;
  players: number;
}

export interface AnalyticsFunnel {
  started: number;
  played: number;
  submitted: number;
}

export interface HardQuestionStat {
  post_id: string;
  author_name: string | null;
  attempts: number;
  correct: number;
  error_rate: number;
}

export interface AdminStats {
  totalGames: number;
  uniquePlayers: number;
  topScore: number;
  topPlayer: string;
  totalPosts: number;
  totalAuthors: number;
  pendingPosts: number;
  pendingAuthors: number;
  dau: number;
  wau: number;
  gamesToday: number;
  games7d: number;
  completionRate: number;
  returnRate: number;
  avgScore: number;
  avgAccuracy: number;
  suggestionConversion: number;
  daily: AnalyticsDay[];
  funnel: AnalyticsFunnel;
  hardQuestions: HardQuestionStat[];
}
