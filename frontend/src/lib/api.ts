import axios, { type AxiosError } from 'axios';
import type { ApiErrorShape } from '../types/api';

/** Normalized error thrown for every failed request. Calling code should
 * never need to touch the raw axios/response shape. */
export class ApiError extends Error {
  statusCode: number;
  errors?: string[];
  path: string;
  timestamp: string;
  requestId: string;

  constructor(shape: ApiErrorShape) {
    super(shape.message);
    this.name = 'ApiError';
    this.statusCode = shape.statusCode;
    this.errors = shape.errors;
    this.path = shape.path;
    this.timestamp = shape.timestamp;
    this.requestId = shape.requestId;
  }
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorShape>) => {
    if (error.response?.status === 401) {
      // TODO(Day 3/4): attempt a token refresh here and retry the original
      // request once auth is implemented. For now, 401s just surface as a
      // normal ApiError below.
    }

    if (error.response?.data) {
      return Promise.reject(new ApiError(error.response.data));
    }

    // No response body to unwrap — network error, timeout, CORS failure, etc.
    return Promise.reject(
      new ApiError({
        statusCode: 0,
        message: error.message || 'Network error',
        path: error.config?.url ?? '',
        timestamp: new Date().toISOString(),
        requestId: '',
      }),
    );
  },
);
