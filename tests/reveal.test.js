import assert from 'node:assert/strict';
import test from 'node:test';
import { revealOnView } from '../src/utils/reveal.js';

function scene(height, { reducedMotion = false, observerAvailable = true } = {}) {
  const observed = new Set();
  let callback;
  let margin;
  let scroll = 0;
  const viewport = {
    innerHeight: height,
    matchMedia: () => ({ matches: reducedMotion }),
    IntersectionObserver: observerAvailable ? class {
      constructor(fn, options) {
        callback = fn;
        margin = Number.parseFloat(options.rootMargin.split(' ')[2]);
      }
      observe(item) { observed.add(item); }
      unobserve(item) { observed.delete(item); }
      disconnect() { observed.clear(); }
    } : undefined,
  };
  const element = (top, height) => {
    const classes = new Set();
    return {
      classList: { add: (value) => classes.add(value), contains: (value) => classes.has(value) },
      getBoundingClientRect: () => ({ top: top - scroll, bottom: top + height - scroll }),
      visible: () => classes.has('is-visible'),
    };
  };
  const update = ({ scrollY = scroll, height = viewport.innerHeight } = {}) => {
    scroll = scrollY;
    viewport.innerHeight = height;
    if (callback) callback([...observed].map((target) => {
      const bounds = target.getBoundingClientRect();
      return { target, isIntersecting: bounds.top <= height + margin && bounds.bottom > 0 };
    }));
  };
  return { viewport, element, update, observed };
}

test('a section already visible on a large screen starts appearing before any scroll', () => {
  const s = scene(1200);
  const header = s.element(900, 180);
  const tallCard = s.element(1100, 1500);
  revealOnView([header, tallCard], s.viewport);
  assert.equal(header.visible(), true);
  assert.equal(tallCard.visible(), true);
});

test('a smaller screen keeps later content hidden, then starts its animation before entry', () => {
  const s = scene(700);
  const service = s.element(850, 300);
  revealOnView([service], s.viewport);
  s.update();
  assert.equal(service.visible(), false);
  s.update({ scrollY: 100 });
  assert.ok(service.getBoundingClientRect().top > s.viewport.innerHeight);
  assert.equal(service.visible(), true);
  assert.equal(s.observed.has(service), false);
});

test('resizing to a taller viewport reveals content without a scroll event', () => {
  const s = scene(700);
  const header = s.element(1000, 180);
  revealOnView([header], s.viewport);
  assert.equal(header.visible(), false);
  s.update({ height: 1200 });
  assert.equal(header.visible(), true);
});

test('starting halfway down a page reveals intersecting content immediately', () => {
  const s = scene(800);
  s.update({ scrollY: 1400 });
  const current = s.element(1300, 400);
  const previous = s.element(800, 200);
  const next = s.element(2500, 300);
  revealOnView([current, previous, next], s.viewport);
  assert.equal(current.visible(), true);
  assert.equal(previous.visible(), false);
  assert.equal(next.visible(), false);
});

for (const options of [{ reducedMotion: true }, { observerAvailable: false }]) {
  test(`content stays available with ${JSON.stringify(options)}`, () => {
    const s = scene(700, options);
    const item = s.element(4000, 300);
    revealOnView([item], s.viewport);
    assert.equal(item.visible(), true);
  });
}
