import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './uiSlice';

// Redux owns client-only UI state (sidebar, modals, theme, etc.).
// Anything that originates from the server belongs in React Query
// (see src/app/providers/QueryProvider.tsx), not here.
export const store = configureStore({
  reducer: {
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
