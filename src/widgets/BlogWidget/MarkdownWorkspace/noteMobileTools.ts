export type NotePoint = { x: number; y: number };
export type NoteTool = 'edit' | 'pan' | 'lasso';
export const NOTE_MENU_ACTIONS = ['edit', 'pan', 'lasso', 'zoom-in', 'zoom-out', 'copy', 'select-all', 'undo'] as const;
export type NoteAction = typeof NOTE_MENU_ACTIONS[number];
export const NOTE_MENU_RADIUS = 78;
export const NOTE_MENU_INSET = 106;
export const NOTE_HOLD_MS = 450;
export const NOTE_DRAG_DISTANCE = 10;
export type NoteQuickMenu = NotePoint & { selected: NoteAction | null };
export type NoteBounds = { left: number; top: number; right: number; bottom: number };

export interface NoteTextTools {
  selectLasso: (points: NotePoint[]) => string;
  selectAll: () => string;
  selectedText: () => string;
  focus: () => void;
  placeCaret: (point: NotePoint) => void;
  undo: () => void;
  scrollElement?: HTMLElement;
}
export type RegisterNoteTools = (tools: NoteTextTools | null) => void;

export function noteMenuItem(index: number): NotePoint {
  const angle = index * Math.PI / 4 - Math.PI / 2;
  return { x: Math.cos(angle) * NOTE_MENU_RADIUS, y: Math.sin(angle) * NOTE_MENU_RADIUS };
}
export function noteMenuSelection(center: NotePoint, point: NotePoint): NoteAction | null {
  const x = point.x - center.x, y = point.y - center.y;
  if (Math.hypot(x, y) < 30 || Math.hypot(x, y) > 140) return null;
  const index = (Math.round((Math.atan2(y, x) + Math.PI / 2) / (Math.PI / 4)) + 8) % 8;
  return NOTE_MENU_ACTIONS[index];
}
export function noteMenuCenter(point: NotePoint, bounds: NoteBounds, visible?: NoteBounds): NotePoint {
  if (visible) {
    const clipped = { left: Math.max(bounds.left, visible.left), right: Math.min(bounds.right, visible.right),
      top: Math.max(bounds.top, visible.top), bottom: Math.min(bounds.bottom, visible.bottom) };
    // A keyboard can leave less than one ring inside the note. Let the overlay
    // use the visible screen on that axis while its actions still target this note.
    bounds = {
      left: clipped.right - clipped.left < NOTE_MENU_INSET * 2 ? visible.left : clipped.left,
      right: clipped.right - clipped.left < NOTE_MENU_INSET * 2 ? visible.right : clipped.right,
      top: clipped.bottom - clipped.top < NOTE_MENU_INSET * 2 ? visible.top : clipped.top,
      bottom: clipped.bottom - clipped.top < NOTE_MENU_INSET * 2 ? visible.bottom : clipped.bottom,
    };
  }
  const clamp = (value: number, start: number, end: number) => {
    const inset = Math.min(NOTE_MENU_INSET, (end - start) / 2);
    return Math.max(start + inset, Math.min(end - inset, value));
  };
  return { x: clamp(point.x, bounds.left, bounds.right), y: clamp(point.y, bounds.top, bounds.bottom) };
}

// Scan the closed polygon in display rows, then select the editor's contiguous
// text range between its first and last enclosed caret positions.
export function lassoTextRange(points: NotePoint[], bounds: NoteBounds, rowHeight: number,
  positionAt: (point: NotePoint) => number | null): { from: number; to: number } | null {
  if (points.length < 3) return null;
  const top = Math.max(bounds.top, Math.min(...points.map(point => point.y)));
  const bottom = Math.min(bounds.bottom, Math.max(...points.map(point => point.y)));
  if (bottom - top < 3) return null;
  const step = Math.max(2, rowHeight / 2);
  let from = Infinity, to = -Infinity;
  for (let y = top + Math.min(step / 2, (bottom - top) / 2); y < bottom; y += step) {
    const crossings: number[] = [];
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      if ((point.y > y) !== (next.y > y)) crossings.push(point.x + (y - point.y) * (next.x - point.x) / (next.y - point.y));
    });
    crossings.sort((a, b) => a - b);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const left = Math.max(bounds.left, crossings[index]);
      const right = Math.min(bounds.right, crossings[index + 1]);
      if (right - left < 2) continue;
      const start = positionAt({ x: left + 0.5, y }), end = positionAt({ x: right - 0.5, y });
      if (start === null || end === null) continue;
      from = Math.min(from, start, end); to = Math.max(to, start, end);
    }
  }
  return Number.isFinite(from) && to > from ? { from, to } : null;
}

export type NoteTextSegment = { from: number; length: number; rectAt: (offset: number) => NoteBounds | null };

const insideLasso = (point: NotePoint, polygon: NotePoint[]) => {
  let inside = false;
  polygon.forEach((start, index) => {
    const end = polygon[(index + 1) % polygon.length];
    if ((start.y > point.y) !== (end.y > point.y)
      && point.x < (end.x - start.x) * (point.y - start.y) / (end.y - start.y) + start.x) inside = !inside;
  });
  return inside;
};

// Caret-from-point APIs can return the end of a nearby paragraph for blank
// leading. Character rectangles keep rich-text lasso selection on actual glyphs.
export function lassoCharacterRange(points: NotePoint[], bounds: NoteBounds, segments: NoteTextSegment[]) {
  if (points.length < 3) return null;
  const top = Math.max(bounds.top, Math.min(...points.map(point => point.y)));
  const bottom = Math.min(bounds.bottom, Math.max(...points.map(point => point.y)));
  let from = Infinity, to = -Infinity;
  for (const segment of segments) {
    const first = segment.rectAt(0), last = segment.rectAt(segment.length - 1);
    if (!first || !last || last.bottom < top || first.top > bottom) continue;
    const boundary = (past: (rect: NoteBounds) => boolean) => {
      let low = 0, high = segment.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2), rect = segment.rectAt(middle);
        if (rect && past(rect)) low = middle + 1;
        else high = middle;
      }
      return low;
    };
    const begin = boundary(rect => rect.bottom < top), end = boundary(rect => rect.top <= bottom);
    for (let index = begin; index < end; index++) {
      const rect = segment.rectAt(index);
      if (!rect || rect.right <= rect.left || rect.bottom <= rect.top) continue;
      const center = { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
      if (center.x < bounds.left || center.x > bounds.right || center.y < bounds.top || center.y > bounds.bottom || !insideLasso(center, points)) continue;
      from = Math.min(from, segment.from + index); to = Math.max(to, segment.from + index + 1);
    }
  }
  return Number.isFinite(from) && to > from ? { from, to } : null;
}
