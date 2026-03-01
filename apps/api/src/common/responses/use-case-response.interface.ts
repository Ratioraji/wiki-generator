export interface UseCaseResponse<T> {
  data: T;
  statusCode: number;
  message: string;
  meta?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  statusCode: number;
  message: string;
  meta?: Record<string, unknown>;
}
