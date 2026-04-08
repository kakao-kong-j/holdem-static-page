export type StackSize = '15BB' | '25BB' | '40BB' | '100BB';

export type ChartData = Record<string, string[]>;

export type StackData = Record<string, ChartData>;

export type AllData = Record<StackSize, StackData>;

export interface ColorDef {
  bg: string;
  text: string;
  label: string;
}

export interface QuizQuestion {
  stackSize: StackSize;
  chartName: string;
  hand: string;
  correctAction: string;
  heroPosition: string;
  villainPosition: string;
  situation: string;
}

export interface QuizRecord {
  question: QuizQuestion;
  userAnswer: string;
  correct: boolean;
  timestamp: number;
}
