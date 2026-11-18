/**
 * Reveal visible elements immediately, then animate the rest just before they enter.
 * Observing each element avoids thresholds tied to the height of an entire section.
 * @param {Iterable<Element> | ArrayLike<Element>} elements
 * @param {Window & typeof globalThis} viewport
 */
export function revealOnView(elements, viewport = window) {
  const items = Array.from(elements).filter((item) => !item.classList.contains('is-visible'));
  if (!items.length) return () => {};

  if (viewport.matchMedia('(prefers-reduced-motion: reduce)').matches || !viewport.IntersectionObserver) {
    items.forEach((item) => item.classList.add('is-visible'));
    return () => {};
  }

  const observer = new viewport.IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px 64px 0px' });

  items.forEach((item) => {
    const bounds = item.getBoundingClientRect();
    if (bounds.top < viewport.innerHeight && bounds.bottom > 0) {
      item.classList.add('is-visible');
    } else {
      observer.observe(item);
    }
  });

  return () => observer.disconnect();
}
