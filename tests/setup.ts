import "@testing-library/jest-dom/vitest";

// Mock IntersectionObserver for Infinite Scroll tests in jsdom
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    if (options?.root) this.root = options.root;
    if (options?.rootMargin) this.rootMargin = options.rootMargin;
    if (options?.threshold) {
      this.thresholds = Array.isArray(options.threshold)
        ? options.threshold
        : [options.threshold];
    }
  }

  observe(target: Element): void {
    // Immediate simulated trigger for testing can be triggered manually or automatically
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: MockIntersectionObserver,
});
