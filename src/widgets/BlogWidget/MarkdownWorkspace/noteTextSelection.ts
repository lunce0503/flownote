import { lassoCharacterRange, lassoTextRange, type NotePoint, type NoteTextTools } from './noteMobileTools';

function caretAt(point: NotePoint) {
  const caret = document.caretPositionFromPoint?.(point.x, point.y);
  if (caret) return { node: caret.offsetNode, offset: caret.offset };
  const legacy = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const range = legacy.caretRangeFromPoint?.(point.x, point.y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

export function textDisplayRowHeight(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const ratio = element.offsetWidth ? element.getBoundingClientRect().width / element.offsetWidth : 1;
  return (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5 || 22) * ratio;
}

export function domNoteTools(root: HTMLElement): NoteTextTools {
  const selectionText = () => {
    const selection = getSelection();
    return selection?.anchorNode && selection.focusNode && root.contains(selection.anchorNode)
      && root.contains(selection.focusNode) ? selection.toString() : '';
  };
  return {
    placeCaret: point => {
      const caret = caretAt(point);
      if (!caret || !root.contains(caret.node)) return;
      const range = document.createRange(); range.setStart(caret.node, caret.offset); range.collapse(true);
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    },
    focus: () => root.focus(), undo: () => {}, selectedText: selectionText,
    selectAll: () => {
      const range = document.createRange(); range.selectNodeContents(root);
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      return selectionText();
    },
    selectLasso: points => {
      const nodes: Text[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) nodes.push(walker.currentNode as Text);
      const offsets = new Map<Node, number>();
      let length = 0;
      for (const node of nodes) { offsets.set(node, length); length += node.length; }
      const selected = lassoCharacterRange(points, root.getBoundingClientRect(), nodes.filter(node => node.length > 0).map(node => {
        const range = document.createRange();
        return { from: offsets.get(node) ?? 0, length: node.length, rectAt: (offset: number) => {
          range.setStart(node, offset); range.setEnd(node, offset + 1);
          return range.getBoundingClientRect();
        } };
      }));
      if (!selected) return '';
      const endpoint = (position: number) => {
        const node = nodes.find(item => (offsets.get(item) ?? 0) + item.length >= position) ?? nodes.at(-1)!;
        return { node, offset: position - (offsets.get(node) ?? 0) };
      };
      const from = endpoint(selected.from), to = endpoint(selected.to);
      const range = document.createRange(); range.setStart(from.node, from.offset); range.setEnd(to.node, to.offset);
      const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
      return selectionText();
    },
  };
}

function withTextareaMirror<T>(input: HTMLTextAreaElement, read: (positionAt: (point: NotePoint) => number | null) => T): T {
  // Use the browser's normal textarea layout for wrapping, zoom and scroll.
  const bounds = input.getBoundingClientRect(), style = getComputedStyle(input);
  const scale = input.offsetWidth ? bounds.width / input.offsetWidth : 1;
  const mirror = document.createElement('div');
  for (const property of ['font', 'letter-spacing', 'line-height', 'tab-size', 'padding', 'border-width', 'border-style', 'box-sizing', 'word-break', 'overflow-wrap']) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }
  Object.assign(mirror.style, {
    position: 'fixed', left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${input.offsetWidth}px`, height: `${input.offsetHeight}px`, transform: `scale(${scale})`,
    transformOrigin: 'top left', whiteSpace: 'pre-wrap', overflow: 'hidden', opacity: '0', zIndex: '2147483647',
  });
  const scrollbar = input.offsetWidth - input.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
  mirror.style.paddingRight = `${parseFloat(style.paddingRight) + Math.max(0, scrollbar)}px`;
  const text = document.createTextNode(input.value + ' '); mirror.append(text); document.body.append(mirror);
  mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft;
  try {
    return read(point => {
      const caret = caretAt(point);
      return caret?.node === text ? Math.min(caret.offset, input.value.length) : null;
    });
  } finally { mirror.remove(); }
}

export function textareaNoteTools(input: HTMLTextAreaElement): NoteTextTools {
  const selectedText = () => input.value.slice(input.selectionStart, input.selectionEnd);
  return {
    placeCaret: point => withTextareaMirror(input, positionAt => {
      const position = positionAt(point);
      input.focus({ preventScroll: true });
      if (position !== null) input.setSelectionRange(position, position);
    }),
    scrollElement: input, selectedText, focus: () => input.focus({ preventScroll: true }),
    undo: () => { input.focus({ preventScroll: true }); document.execCommand('undo'); },
    selectAll: () => { input.focus({ preventScroll: true }); input.setSelectionRange(0, input.value.length); return selectedText(); },
    selectLasso: points => {
      return withTextareaMirror(input, positionAt => {
        const selected = lassoTextRange(points, input.getBoundingClientRect(), textDisplayRowHeight(input), positionAt);
        if (!selected) return '';
        input.focus({ preventScroll: true }); input.setSelectionRange(selected.from, selected.to);
        return selectedText();
      });
    },
  };
}
