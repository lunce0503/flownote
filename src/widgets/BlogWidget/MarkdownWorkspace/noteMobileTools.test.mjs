import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTE_MENU_ACTIONS, noteMenuItem, noteMenuSelection, noteMenuCenter, lassoTextRange } from './noteMobileTools.ts';

const bounds = { left: 0, top: 0, right: 390, bottom: 700 };
test('the note radial menu selects only note actions and supports center/outside cancellation', () => {
  const center = { x: 190, y: 300 };
  NOTE_MENU_ACTIONS.forEach((action, index) => {
    const point = noteMenuItem(index);
    assert.equal(noteMenuSelection(center, { x: center.x + point.x, y: center.y + point.y }), action);
  });
  assert.equal(noteMenuSelection(center, center), null);
  assert.equal(noteMenuSelection(center, { x: 190, y: 500 }), null);
  assert.deepEqual(noteMenuCenter({ x: 2, y: 3 }, bounds), { x: 106, y: 106 });
});
test('lasso text selection maps screen rows to a continuous editor range without changing source', () => {
  const points = [{ x: 20, y: 20 }, { x: 100, y: 20 }, { x: 100, y: 60 }, { x: 20, y: 60 }];
  const positionAt = ({ x, y }) => Math.floor(y / 20) * 50 + Math.round(x / 10);
  assert.deepEqual(lassoTextRange(points, bounds, 20, positionAt), { from: 52, to: 110 });
  assert.equal(lassoTextRange(points.slice(0, 2), bounds, 20, positionAt), null);
  assert.equal(lassoTextRange(points, bounds, 20, () => null), null);
  assert.equal(lassoTextRange(points, { left: 200, top: 0, right: 300, bottom: 700 }, 20, positionAt), null);
});

test('rich text lasso checks actual glyphs and ignores nearby paragraph-end carets', async () => {
  const { lassoCharacterRange } = await import('./noteMobileTools.ts');
  const points = [{ x: 60, y: 18 }, { x: 110, y: 18 }, { x: 110, y: 45 }, { x: 60, y: 45 }];
  const text = 'alpha bravo charlie';
  const segment = { from: 1, length: text.length, rectAt: offset => ({ left: offset * 10, right: (offset + 1) * 10, top: 20, bottom: 40 }) };
  assert.deepEqual(lassoCharacterRange(points, bounds, [segment]), { from: 7, to: 12 });
  const many = { from: 0, length: 1000000, rectAt: offset => ({ left: 0, right: 10, top: offset * 20, bottom: offset * 20 + 18 }) };
  let reads = 0;
  assert.deepEqual(lassoCharacterRange([{ x: 0, y: 20 }, { x: 20, y: 20 }, { x: 20, y: 38 }, { x: 0, y: 38 }], bounds,
    [{ ...many, rectAt: offset => { reads++; return many.rectAt(offset); } }]), { from: 1, to: 2 });
  assert.ok(reads < 100, 'visible-range search does not scan a million characters');
});


test('the note menu stays above a mobile keyboard even when the note extends below it', () => {
  const center = noteMenuCenter({ x: 195, y: 450 }, { left: 0, right: 390, top: 350, bottom: 900 },
    { left: 0, right: 390, top: 0, bottom: 500 });
  assert.equal(center.y, 394);
  assert.ok(center.y + 106 <= 500);
  assert.deepEqual(noteMenuCenter({ x: 195, y: 300 }, bounds, bounds), { x: 195, y: 300 });
});
