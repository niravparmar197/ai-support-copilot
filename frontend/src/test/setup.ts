import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Not automatic without `globals: true` in vite.config.ts's test block —
// testing-library's own auto-cleanup registration needs afterEach on
// globalThis, which explicit (non-global) vitest imports don't provide.
// Without this, DOM from one test's render() lingers into the next,
// which only breaks tests whose queries happen to collide (e.g. two
// renders each containing a "Send" button) rather than failing loudly
// every time — worth fixing here once rather than per test file.
afterEach(cleanup);
