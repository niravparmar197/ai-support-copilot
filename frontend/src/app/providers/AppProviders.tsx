import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { StoreProvider } from './StoreProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <QueryProvider>{children}</QueryProvider>
    </StoreProvider>
  );
}
