export interface ParsedFile {
  path: string;
  content: string;
  snippet: string; // first 30-40 lines
  lineCount: number;
  extension: string;
  structures: StructureRef[];
}

export interface StructureRef {
  name: string;
  type: 'function' | 'class' | 'export' | 'route';
  lineStart: number;
  lineEnd: number;
}

export interface FileClassification {
  filePath: string;
  groupId: string;
  summary: string;
  functionSummaries: FunctionSummary[];
}

export interface FunctionSummary {
  name: string;
  lineStart: number;
  lineEnd: number;
  description: string;
  isPublicInterface: boolean;
}
