export type StackSize = '15BB' | '25BB' | '40BB' | '100BB';

export type ChartData = Record<string, string[]>;

export type StackData = Record<string, ChartData>;

export type AllData = Record<StackSize, StackData>;

export interface ColorDef {
  bg: string;
  text: string;
  label: string;
}
