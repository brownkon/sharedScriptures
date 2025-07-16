export type StudyMode = 'flashcard' | 'fill-in-blank' | null;
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface StudyVerse {
  verseId: string;
  bookId: string;
  chapterId: string;
  verse: number;
  reference: string;
  text: string;
  isFavorite?: boolean;
  studyCount?: number;
  lastStudied?: Date;
  accuracy?: number;
}

export interface StudySession {
  id: string;
  userId: string;
  mode: StudyMode;
  difficulty?: DifficultyLevel;
  verses: StudyVerse[];
  startTime: Date;
  endTime?: Date;
  totalVerses: number;
  correctAnswers: number;
  accuracy: number;
  timeSpent: number;
}
