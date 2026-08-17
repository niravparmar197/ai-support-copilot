import { useState } from 'react';
import { api, ApiError } from '../lib/api';

// TEMPORARY — verifies the api.ts client against the backend /health
// endpoint. Remove this block once verified (see CLAUDE.md task scope).
export function HomePage() {
  const [result, setResult] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const res = await api.get('/health');
      setResult(JSON.stringify(res.data));
      console.log('health check ok', res.data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err);
      setResult(`error: ${message}`);
      console.error('health check failed', err);
    }
  };

  return (
    <div>
      <h1 className="text-xl font-semibold">Home</h1>
      <button
        type="button"
        onClick={checkHealth}
        className="mt-4 rounded bg-blue-600 px-3 py-1.5 text-white"
      >
        Check backend health
      </button>
      {result && <p className="mt-2 text-sm text-gray-600">{result}</p>}
    </div>
  );
}
