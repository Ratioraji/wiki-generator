export interface SSEEvent {
  type: 'status' | 'progress' | 'complete' | 'existing' | 'error';
  message?: string;
  progress?: number;
  phase?: 'ingestion' | 'grouping' | 'classification' | 'analysis' | 'assembly';
  subsystem?: string;
  wikiId?: string;
  error?: string;
}
