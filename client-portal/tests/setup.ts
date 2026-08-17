import '@testing-library/jest-dom';

// jsdom does not implement ResizeObserver (used by Designer's panel auto-fit,
// shipped 08-17). Stub it so Designer/Collage render tests can mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}
