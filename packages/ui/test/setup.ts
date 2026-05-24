import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll } from 'vitest';

// Vitest 4 + Testing Library 16: cleanup is no longer auto-registered.
// Without this, DOM nodes from prior `render()` calls accumulate and
// `getBy*` queries return "multiple elements" errors.
afterEach(() => {
  cleanup();
});

// happy-dom doesn't implement layout, so `getBoundingClientRect()` returns
// all zeros. @tanstack/react-virtual measures its scroll element on mount
// and refuses to render rows when the size is 0×0. Stub layout so the
// virtualizer believes the container has real space to fill.
const MOCK_WIDTH = 800;
const MOCK_HEIGHT = 600;

beforeAll(() => {
  if (typeof Element === 'undefined') return;

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return MOCK_WIDTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return MOCK_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return MOCK_WIDTH;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return MOCK_HEIGHT;
    },
  });

  Element.prototype.getBoundingClientRect = function getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: MOCK_WIDTH,
      bottom: MOCK_HEIGHT,
      width: MOCK_WIDTH,
      height: MOCK_HEIGHT,
      toJSON() {
        return this;
      },
    } as DOMRect;
  };
});
