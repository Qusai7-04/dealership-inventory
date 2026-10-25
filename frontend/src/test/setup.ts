import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { randomUUID } from 'node:crypto';

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: randomUUID });
}

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
