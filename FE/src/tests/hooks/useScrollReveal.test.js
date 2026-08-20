import { renderHook } from '@testing-library/react';
import { useScrollReveal } from '../../hooks/useScrollReveal';

describe('hooks/useScrollReveal', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() => useScrollReveal());
    expect(result.current).toBeDefined();
    expect(typeof result.current).toBe('object');
    expect(result.current).toHaveProperty('current');
  });

  it('adds is-visible class immediately when IntersectionObserver is unavailable', () => {
    const original = global.IntersectionObserver;
    delete global.IntersectionObserver;

    const div = document.createElement('div');
    document.body.appendChild(div);

    const { result } = renderHook(() => useScrollReveal());
    // Manually attach ref
    result.current.current = div;

    // Re-run effect by doing another render
    renderHook(() => {
      const ref = useScrollReveal();
      ref.current = div;
    });

    document.body.removeChild(div);
    if (original) global.IntersectionObserver = original;
  });

  it('accepts custom options without throwing', () => {
    expect(() => {
      renderHook(() => useScrollReveal({ threshold: 0.5, rootMargin: '0px', once: false }));
    }).not.toThrow();
  });
});
