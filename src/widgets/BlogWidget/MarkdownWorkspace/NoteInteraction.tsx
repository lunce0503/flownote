import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { Copy, Hand, Lasso, Pencil, RotateCcw, ScanText, ZoomIn, ZoomOut, Undo2, Redo2 } from 'lucide-react';
import {
  NOTE_DRAG_DISTANCE, NOTE_HOLD_MS, NOTE_MENU_ACTIONS, NOTE_MENU_INSET,
  noteMenuCenter, noteMenuItem, noteMenuSelection,
  type NoteAction, type NotePoint, type NoteQuickMenu, type NoteTextTools, type NoteTool,
} from './noteMobileTools';
import { domNoteTools } from './noteTextSelection';
import './note-interaction.css';

const actions = {
  edit: { label: '편집', Icon: Pencil }, pan: { label: '이동', Icon: Hand },
  lasso: { label: '올가미', Icon: Lasso }, 'zoom-in': { label: '확대', Icon: ZoomIn },
  'zoom-out': { label: '축소', Icon: ZoomOut }, copy: { label: '선택 복사', Icon: Copy },
  'select-all': { label: '전체 선택', Icon: ScanText }, undo: { label: '실행 취소', Icon: RotateCcw },
};
type Contact = { origin: NotePoint; previous: NotePoint; moved: boolean };

export default function NoteInteraction({ children, disabled, editorTools, onEdit, code = false }: {
  code?: boolean;
  children: ReactNode;
  editorTools: RefObject<NoteTextTools | null>;
  disabled: boolean;
  onEdit?: () => void;
}) {
  const viewport = useRef<HTMLDivElement>(null), content = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<NoteTool>('edit');
  const isNativeControl = useCallback((target: Element) => Boolean(target.closest('button,select,input,summary,a,dialog,[role="dialog"]'))
    || (tool === 'edit' && Boolean(target.closest('.tiptap-mathematics-render,img'))), [tool]);
  const [zoom, setZoom] = useState(1), [baseWidth, setBaseWidth] = useState(0);
  const zoomRef = useRef(1);
  const pendingScroll = useRef<NotePoint | null>(null);
  const [menu, setMenu] = useState<NoteQuickMenu | null>(null);
  const menuRef = useRef<NoteQuickMenu | null>(null);
  const [lasso, setLasso] = useState<NotePoint[]>([]);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const lassoRef = useRef<NotePoint[]>([]);
  const [selectionLength, setSelectionLength] = useState(0), [message, setMessage] = useState('');
  const contacts = useRef(new Map<number, Contact>());
  const lastPointerType = useRef('');
  const hold = useRef<{ id: number; timer: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; anchor: NotePoint } | null>(null);

  const clearHold = () => { window.clearTimeout(hold.current?.timer); hold.current = null; };
  const cancel = useCallback(() => {
    window.clearTimeout(hold.current?.timer); hold.current = null;
    const pointers = [...contacts.current.keys()];
    contacts.current.clear();
    for (const id of pointers) if (viewport.current?.hasPointerCapture(id)) viewport.current.releasePointerCapture(id);
    pinch.current = null; menuRef.current = null;
    lassoRef.current = []; setLasso([]); setMenu(null);
  }, []);
  useEffect(() => {
    const outside = (event: globalThis.PointerEvent) => {
      if (!viewport.current?.contains(event.target as Node)) cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('pointerdown', outside, true);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      window.clearTimeout(hold.current?.timer);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [cancel]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const preventNativeHold = (event: TouchEvent) => {
      if (!isNativeControl(event.target as Element)) event.preventDefault();
    };
    element.addEventListener('touchstart', preventNativeHold, { passive: false, capture: true });
    return () => element.removeEventListener('touchstart', preventNativeHold, true);
  }, [isNativeControl]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setBaseWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => {
    if (pendingScroll.current && viewport.current) {
      viewport.current.scrollLeft = pendingScroll.current.x;
      viewport.current.scrollTop = pendingScroll.current.y;
      pendingScroll.current = null;
    }
  }, [zoom]);

  const tools = () => editorTools.current ?? (content.current
    ? domNoteTools(content.current.querySelector<HTMLElement>('.note-markdown') ?? content.current) : null);
  const zoomTo = (next: number, focus?: NotePoint, anchor?: NotePoint) => {
    const element = viewport.current;
    if (!element) return;
    const bounds = element.getBoundingClientRect();
    const point = focus ?? { x: bounds.left + element.clientWidth / 2, y: bounds.top + element.clientHeight / 2 };
    const origin = anchor ?? { x: (element.scrollLeft + point.x - bounds.left) / zoomRef.current,
      y: (element.scrollTop + point.y - bounds.top) / zoomRef.current };
    const value = Math.min(3, Math.max(0.5, next));
    if (code) { tools()?.setZoom?.(value, point, anchor); zoomRef.current = value; setZoom(value); return; }
    pendingScroll.current = { x: origin.x * value - point.x + bounds.left, y: origin.y * value - point.y + bounds.top };
    if (value === zoomRef.current) {
      element.scrollLeft = pendingScroll.current.x; element.scrollTop = pendingScroll.current.y;
      pendingScroll.current = null;
    }
    zoomRef.current = value; setZoom(value);
  };
  const activate = (action: NoteAction) => {
    clearHold(); menuRef.current = null; setMenu(null); setMessage('');
    if (action === 'zoom-in') zoomTo(zoomRef.current * 1.2);
    else if (action === 'zoom-out') zoomTo(zoomRef.current / 1.2);
    else if (action === 'copy') {
      const text = tools()?.selectedText() ?? '';
      if (!text) { setMessage('복사할 텍스트를 먼저 선택해주세요.'); return; }
      if (!navigator.clipboard) { setMessage('복사 기능을 사용할 수 없습니다. 선택한 범위는 유지됩니다.'); return; }
      void navigator.clipboard.writeText(text).then(() => setMessage('선택한 텍스트를 복사했습니다.'))
        .catch(() => setMessage('복사 권한을 확인해주세요. 선택한 범위는 유지됩니다.'));
    } else if (action === 'select-all') setSelectionLength(tools()?.selectAll().length ?? 0);
    else if (action === 'undo') { if (!disabled) tools()?.undo(); }
    else { cancel(); setTool(action); if (action === 'edit') { onEdit?.(); tools()?.focus(); } }
  };
  const panBy = (delta: NotePoint) => {
    const element = viewport.current;
    if (!element) return;
    const inner = editorTools.current?.scrollElement;
    let x = -delta.x, y = -delta.y;
    if (inner) {
      const before = { x: inner.scrollLeft, y: inner.scrollTop };
      const scale = code ? 1 : zoomRef.current;
      inner.scrollBy({ left: x / scale, top: y / scale, behavior: 'instant' });
      x -= (inner.scrollLeft - before.x) * scale;
      y -= (inner.scrollTop - before.y) * scale;
    }
    element.scrollLeft += x; element.scrollTop += y;
  };
  const block = (event: PointerEvent) => { event.preventDefault(); event.stopPropagation(); };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    lastPointerType.current = event.pointerType;
    if (event.button !== 0 || isNativeControl(event.target as Element)) return;
    if (tool === 'edit' && event.pointerType === 'touch') tools()?.focus();
    if (event.pointerType !== 'touch' && tool === 'edit') return;
    const point = { x: event.clientX, y: event.clientY };
    contacts.current.set(event.pointerId, { origin: point, previous: point, moved: false });
    if (contacts.current.size >= 2) {
      clearHold(); menuRef.current = null; setMenu(null); lassoRef.current = []; setLasso([]);
      const [first, second] = [...contacts.current.values()];
      const bounds = (code ? editorTools.current?.scrollElement : null)?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
      const scroll = (code ? editorTools.current?.scrollElement : null) ?? event.currentTarget;
      const center = { x: (first.previous.x + second.previous.x) / 2, y: (first.previous.y + second.previous.y) / 2 };
      pinch.current = { distance: Math.max(1, Math.hypot(first.previous.x - second.previous.x, first.previous.y - second.previous.y)),
        zoom: zoomRef.current, anchor: { x: (scroll.scrollLeft + center.x - bounds.left) / zoomRef.current,
          y: (scroll.scrollTop + center.y - bounds.top) / zoomRef.current } };
      event.currentTarget.setPointerCapture(event.pointerId); block(event); return;
    }
    if (event.pointerType === 'touch') {
      const element = event.currentTarget;
      hold.current = { id: event.pointerId, timer: window.setTimeout(() => {
        if (!contacts.current.has(event.pointerId) || contacts.current.size !== 1) return;
        const visual = window.visualViewport;
        const left = visual?.offsetLeft ?? 0, top = visual?.offsetTop ?? 0;
        const visible = { left, top, right: left + (visual?.width ?? window.innerWidth), bottom: top + (visual?.height ?? window.innerHeight) };
        const next = { ...noteMenuCenter(point, element.getBoundingClientRect(), visible), selected: null };
        menuRef.current = next; setMenu(next);
        element.setPointerCapture(event.pointerId);
      }, NOTE_HOLD_MS) };
    }
    if (event.pointerType === 'touch' || tool !== 'edit') { event.currentTarget.setPointerCapture(event.pointerId); block(event); }
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const contact = contacts.current.get(event.pointerId);
    if (!contact) return;
    const point = { x: event.clientX, y: event.clientY };
    const delta = { x: point.x - contact.previous.x, y: point.y - contact.previous.y };
    contact.previous = point;
    if (pinch.current) {
      block(event);
      if (contacts.current.size < 2) return;
      const [first, second] = [...contacts.current.values()];
      const distance = Math.hypot(first.previous.x - second.previous.x, first.previous.y - second.previous.y);
      const center = { x: (first.previous.x + second.previous.x) / 2, y: (first.previous.y + second.previous.y) / 2 };
      zoomTo(pinch.current.zoom * distance / pinch.current.distance, center, pinch.current.anchor); return;
    }
    const moved = Math.hypot(point.x - contact.origin.x, point.y - contact.origin.y);
    if (menuRef.current) {
      const next = { ...menuRef.current, selected: moved > NOTE_DRAG_DISTANCE ? noteMenuSelection(menuRef.current, point) : null };
      menuRef.current = next; setMenu(next); block(event); return;
    }
    if (!contact.moved && moved <= NOTE_DRAG_DISTANCE) return;
    clearHold();
    const movement = contact.moved ? delta : { x: point.x - contact.origin.x, y: point.y - contact.origin.y };
    contact.moved = true; event.currentTarget.setPointerCapture(event.pointerId); block(event);
    if (tool === 'lasso') {
      setBounds(event.currentTarget.getBoundingClientRect());
      if (!lassoRef.current.length) lassoRef.current = [contact.origin];
      if (lassoRef.current.length < 2000) lassoRef.current.push(point);
      setLasso([...lassoRef.current]);
    } else panBy(movement);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const contact = contacts.current.get(event.pointerId);
    if (!contact) return;
    const wasPinch = !!pinch.current;
    contacts.current.delete(event.pointerId); clearHold();
    const selected = menuRef.current?.selected;
    const wasMenu = !!menuRef.current;
    menuRef.current = null; setMenu(null);
    if (event.type === 'pointerup' && !pinch.current && !wasMenu && lassoRef.current.length) {
      const text = tools()?.selectLasso(lassoRef.current) ?? '';
      setSelectionLength(text.length); setMessage(text ? '' : '올가미 안의 텍스트를 찾지 못했습니다.');
    }
    lassoRef.current = []; setLasso([]);
    if (contacts.current.size === 0) pinch.current = null;
    if (event.type === 'pointerup' && event.pointerType === 'touch' && tool === 'edit' && !contact.moved && !wasMenu && !wasPinch) {
      tools()?.placeCaret({ x: event.clientX, y: event.clientY }); setSelectionLength(0);
    }
    if (event.pointerType === 'touch' || wasMenu || contact.moved || tool !== 'edit') block(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && selected) activate(selected);
  };

  return <section className={`note-interaction${code ? ' note-interaction-code' : ''}`} data-testid="note-interaction" data-tool={tool}>
    <div className="note-view-tools" role="toolbar" aria-label="노트 이동과 선택 도구">
      {(['edit', 'pan', 'lasso'] as const).map(action => {
        const { Icon, label } = actions[action];
        return <button key={action} type="button" aria-label={`노트 ${label}`} aria-pressed={tool === action}
          onMouseDown={event => event.preventDefault()} onClick={() => activate(action)}><Icon size={17} /><span>{label}</span></button>;
      })}
      {code && <>
        <button aria-label="노트 실행 취소" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => tools()?.undo()}><Undo2 size={17} /></button>
        <button aria-label="노트 다시 실행" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => tools()?.redo?.()}><Redo2 size={17} /></button>
      </>}
      <button type="button" aria-label="노트 축소" onClick={() => activate('zoom-out')}><ZoomOut size={17} /></button>
      <button type="button" aria-label="노트 확대율 초기화" onClick={() => zoomTo(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" aria-label="노트 확대" onClick={() => activate('zoom-in')}><ZoomIn size={17} /></button>
      <button type="button" aria-label="노트 선택 복사" onMouseDown={event => event.preventDefault()} onClick={() => activate('copy')}><Copy size={17} /></button>
    </div>
    <div ref={viewport} className="note-viewport" data-testid="note-viewport" data-zoom={zoom} role="region" aria-label="노트 본문 화면" tabIndex={0}
      onInputCapture={() => { setSelectionLength(0); setMessage(''); }}
      onSelectCapture={() => setSelectionLength(tools()?.selectedText().length ?? 0)}
      onPointerDownCapture={down} onPointerMoveCapture={move} onPointerUpCapture={up} onPointerCancelCapture={up}
      onLostPointerCapture={event => { if (event.target === event.currentTarget) up(event); }} onContextMenu={event => { if (lastPointerType.current === 'touch' && !isNativeControl(event.target as Element)) event.preventDefault(); }}
      onKeyDownCapture={event => { if (event.key === 'Escape') cancel(); }}>
      <div ref={content} className="note-zoom-content" style={{ zoom: code ? 1 : zoom, width: code ? '100%' : baseWidth || '100%' }}>{children}</div>
    </div>
    {lasso.length > 1 && bounds && <svg className="note-lasso-overlay" aria-hidden="true" style={{ left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }}>
      <polygon points={lasso.map(point => `${point.x - bounds.left},${point.y - bounds.top}`).join(' ')} />
    </svg>}
    {menu && <div className="note-quick-menu" data-testid="note-quick-menu" style={{
      left: menu.x - NOTE_MENU_INSET, top: menu.y - NOTE_MENU_INSET, width: NOTE_MENU_INSET * 2, height: NOTE_MENU_INSET * 2,
    }}>
      <span className="note-quick-center" role="status">{menu.selected ? actions[menu.selected].label : '끌어서 선택'}</span>
      {NOTE_MENU_ACTIONS.map((action, index) => {
        const { label, Icon } = actions[action], position = noteMenuItem(index);
        return <span key={action} data-action={action} data-selected={menu.selected === action} className="note-quick-item"
          style={{ left: NOTE_MENU_INSET + position.x, top: NOTE_MENU_INSET + position.y }} aria-hidden="true"><Icon size={20} /><span>{label}</span></span>;
      })}
    </div>}
    <p className="note-view-status" role="status" data-testid="note-selection-status">{message || (selectionLength ? `텍스트 ${selectionLength}자 선택` : '길게 눌러 도구 선택 · 올가미로 텍스트 범위 선택')}</p>
  </section>;
}
