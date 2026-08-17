/** Mirrors the backend's global exception filter response shape. */
export interface ApiErrorShape {
  statusCode: number;
  message: string;
  errors?: string[];
  path: string;
  timestamp: string;
  requestId: string;
}
