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
  created_at?: string;
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
