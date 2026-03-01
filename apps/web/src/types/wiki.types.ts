// SSE events received from the backend during wiki generation
export interface SSEEvent {
  type: 'status' | 'progress' | 'complete' | 'existing' | 'error';
  message?: string;
  progress?: number;
  phase?: 'ingestion' | 'grouping' | 'classification' | 'analysis' | 'assembly';
  subsystem?: string;
  wikiId?: string;
  error?: string;
}

// Wiki list item — lightweight shape for history cards
export interface WikiListItem {
  id: string;
  repoName: string;
  repoUrl: string;
  branch: string;
  status: 'processing' | 'complete' | 'failed';
  totalSubsystems: number | null;
  totalFiles: number | null;
  repoSummary: string | null;
  completedAt: string | null;
  createdAt: string;
}

// Full wiki response — for the wiki viewer page
export interface WikiResponse {
  id: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  repoSummary: string;
  status: string;
  totalFiles: number;
  totalSubsystems: number;
  subsystems: WikiSubsystem[];
  completedAt: string;
  createdAt: string;
}

export interface WikiSubsystem {
  id: string;
  groupId: string;
  name: string;
  description: string;
  overview: string;
  howItWorks: string;
  publicInterfaces: InterfaceDoc[];
  citations: Citation[];
  dependencies: string[];
  keyFiles: string[];
  displayOrder: number;
}

export interface InterfaceDoc {
  name: string;
  type: string;
  signature: string;
  description: string;
  filePath: string;
  lineStart: number;
}

export interface Citation {
  description: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  githubUrl: string;
}

export interface CheckExistingResponse {
  exists: boolean;
  wikiId?: string;
  createdAt?: string;
}

export interface QaResponse {
  answer: string;
  sources: { subsystem: string; filePath: string; lines: string }[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
