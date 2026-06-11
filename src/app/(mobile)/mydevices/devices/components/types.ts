export type CodeType = 'days' | 'free' | 'reset' | 'retrieve';

export type ResultStatus =
  | 'idle' | 'generating' | 'generated' | 'writing' | 'written' | 'writeFailed' | 'error';

export interface ResultState {
  status: ResultStatus;
  codeType: CodeType | null;
  codeDec: string | null;
  error: string | null;
}

export interface LastCode {
  codeDec: string;
  codeType: CodeType;
  at: number;
}
