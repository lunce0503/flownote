import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { basicSetup, EditorView } from 'codemirror';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { keymap, type Command } from '@codemirror/view';
import { indentWithTab, indentMore, indentLess, undo, redo } from '@codemirror/commands';
import { openSearchPanel, gotoLine } from '@codemirror/search';
import { foldAll, unfoldAll, indentUnit, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { linter } from '@codemirror/lint';
import { jsonParseLinter } from '@codemirror/lang-json';
import { tags } from '@lezer/highlight';
import { Braces, FoldVertical, IndentDecrease, IndentIncrease, Redo2, Search, UnfoldVertical, Undo2, WrapText, MoreVertical, Copy } from 'lucide-react';
import { CODE_LANGUAGES, type CodeContent, type CodeLanguage } from '@/shared/lib/codeContent';
import { codeLanguageExtension } from './codeLanguages';
import { markdownSync } from './markdownSync';
import './code-editor.css';
import { lassoTextRange, type RegisterNoteTools, type NotePoint } from './noteMobileTools';

const syntax = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-keyword)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: tags.comment, color: 'var(--workspace-muted)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: tags.typeName, color: 'var(--code-type)' },
  { tag: tags.function(tags.variableName), color: 'var(--code-function)' },
]));
const lineSeparator = (text: string) => text.includes('\r\n') ? '\r\n' : '\n';
const languageExtensions = (language: CodeLanguage): Extension => [
  codeLanguageExtension(language),
  language === 'json' ? linter(jsonParseLinter()) : [],
];

export default function CodeEditor({ content, disabled, onChange, onSave, validateContent, registerTools }: {
  registerTools?: RegisterNoteTools;
  content: CodeContent;
  disabled: boolean;
  onChange: (content: CodeContent) => void;
  onSave: () => void;
  validateContent: (content: CodeContent) => void;
}) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const latest = useRef({ content, disabled, onChange, onSave, validateContent });
  useLayoutEffect(() => { latest.current = { content, disabled, onChange, onSave, validateContent }; });
  const [sync] = useState(() => markdownSync(content.text));
  const [compartments] = useState(() => ({
    language: new Compartment(), editable: new Compartment(), wrap: new Compartment(),
    indentation: new Compartment(),
  }));
  const [zoom, setZoom] = useState(1);
  const [optionsOpen, setOptionsOpen] = useState(() => !matchMedia('(max-width: 700px)').matches);
  useEffect(() => {
    const media = matchMedia('(max-width: 700px)');
    const change = () => setOptionsOpen(!media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const [wrapped, setWrapped] = useState(false);
  const [indent, setIndent] = useState(4);
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [formatError, setFormatError] = useState('');
  const suppress = useRef(false);
  const newline = useRef(lineSeparator(content.text));
  const zoomRef = useRef(1);

  useEffect(() => {
    if (!parent.current) return;
    const initial = latest.current;
    const editor = new EditorView({
      parent: parent.current,
      state: EditorState.create({
        doc: initial.content.text,
        extensions: [
          basicSetup, syntax,
          EditorState.transactionFilter.of(transaction => {
            if (!transaction.docChanged || suppress.current) return transaction;
            try {
              latest.current.validateContent({ ...latest.current.content, text: transaction.newDoc.sliceString(0, undefined, newline.current) });
              return transaction;
            } catch (error) {
              queueMicrotask(() => setFormatError(error instanceof Error ? error.message : '코드 파일의 크기를 확인해주세요.'));
              return [];
            }
          }),
          compartments.language.of(languageExtensions(initial.content.language)),
          compartments.editable.of([EditorState.readOnly.of(initial.disabled), EditorView.editable.of(!initial.disabled)]),
          compartments.wrap.of([]),
          compartments.indentation.of([indentUnit.of('    '), EditorState.tabSize.of(4)]),
          // Keep CodeMirror's internal line parsing universal. Android DOM input
          // can contain LF text nodes even when the imported file uses CRLF.
          EditorView.contentAttributes.of({
            'aria-label': '코드 편집기', 'aria-describedby': 'note-code-help',
            inputmode: 'text', spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off',
          }),
          EditorState.phrases.of({
            Find: '검색', Replace: '바꾸기', next: '다음', previous: '이전', all: '모두',
            'match case': '대소문자 구분', regexp: '정규식', 'by word': '단어 단위',
            replace: '바꾸기', 'replace all': '모두 바꾸기', close: '닫기',
            'go to line': '줄로 이동', go: '이동',
          }),
          keymap.of([indentWithTab, { key: 'Mod-s', run: () => { latest.current.onSave(); return true; } }]),
          EditorView.updateListener.of(update => {
            if (update.selectionSet || update.docChanged) {
              const position = update.state.selection.main.head;
              const line = update.state.doc.lineAt(position);
              setCursor({ line: line.number, column: position - line.from + 1 });
            }
            if (update.docChanged && !suppress.current && !latest.current.disabled) {
              const text = update.state.doc.sliceString(0, undefined, newline.current);
              sync.emit(text);
              latest.current.onChange({ ...latest.current.content, text });
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  }, [compartments, sync]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.composing || !sync.receive(content.text)) return;
    suppress.current = true;
    newline.current = lineSeparator(content.text);
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content.text } });
    suppress.current = false;
  }, [content.text, compartments, sync]);
  useEffect(() => {
    view.current?.dispatch({ effects: compartments.language.reconfigure(languageExtensions(content.language)) });
  }, [content.language, compartments]);
  useEffect(() => {
    view.current?.dispatch({ effects: compartments.editable.reconfigure([
      EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled),
    ]) });
  }, [disabled, compartments]);
  useEffect(() => {
    view.current?.dispatch({ effects: compartments.wrap.reconfigure(wrapped ? EditorView.lineWrapping : []) });
  }, [wrapped, compartments]);
  useEffect(() => {
    view.current?.dispatch({ effects: compartments.indentation.reconfigure([
      indentUnit.of(' '.repeat(indent)), EditorState.tabSize.of(indent),
    ]) });
  }, [indent, compartments]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || !registerTools) return;
    const selectedText = () => editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to);
    registerTools({
      placeCaret: point => {
        const position = editor.posAtCoords(point, false);
        if (position !== null) editor.dispatch({ selection: { anchor: position } });
        editor.focus();
      },
      scrollElement: editor.scrollDOM, selectedText,
      setZoom: (value: number, focus: NotePoint, anchor?: NotePoint) => {
        const scroll = editor.scrollDOM, bounds = scroll.getBoundingClientRect();
        const point = { x: focus.x - bounds.left, y: focus.y - bounds.top };
        const origin = anchor ?? { x: (scroll.scrollLeft + point.x) / zoomRef.current, y: (scroll.scrollTop + point.y) / zoomRef.current };
        zoomRef.current = value; setZoom(value);
        editor.requestMeasure({ read: () => null, write: () => {
          scroll.scrollLeft = origin.x * value - point.x; scroll.scrollTop = origin.y * value - point.y;
        } });
      }, focus: () => {
        if (document.activeElement === editor.contentDOM && !latest.current.disabled) editor.contentDOM.blur();
        editor.focus();
      },
      undo: () => { if (!latest.current.disabled) undo(editor); },
      redo: () => { if (!latest.current.disabled) redo(editor); },
      selectAll: () => {
        editor.dispatch({ selection: { anchor: 0, head: editor.state.doc.length } });
        return selectedText();
      },
      selectLasso: points => {
        const rowHeight = editor.defaultLineHeight * editor.scaleY;
        const selected = lassoTextRange(points, editor.contentDOM.getBoundingClientRect(), rowHeight,
          point => editor.posAtCoords(point, false));
        if (!selected) return '';
        editor.dispatch({ selection: { anchor: selected.from, head: selected.to } });
        return selectedText();
      },
    });
    return () => registerTools(null);
  }, [registerTools]);

  const run = (command: Command, focus = true) => {
    const editor = view.current;
    if (!editor) return;
    command(editor);
    if (focus) editor.focus();
  };
  const formatJSON = () => {
    const editor = view.current;
    if (!editor || disabled) return;
    try {
      const text = editor.state.sliceDoc();
      const newline = editor.state.lineBreak;
      const formatted = JSON.stringify(JSON.parse(text), null, indent).replaceAll('\n', newline)
        + (text.endsWith('\n') ? newline : '');
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: formatted } });
      setFormatError(''); editor.focus();
    } catch { setFormatError('JSON 문법을 확인해주세요. 현재 입력은 그대로 보관됩니다.'); }
  };

  return <section className="note-code-editor" data-testid="note-code-editor" data-language={content.language} style={{ '--note-code-zoom': zoom } as React.CSSProperties}>
    <div className="note-code-toolbar" role="toolbar" aria-label="코드 편집 도구">
      <details className="note-code-options" open={optionsOpen} onToggle={event => setOptionsOpen(event.currentTarget.open)}>
      <summary aria-label="코드 편집 도구 더보기"><MoreVertical size={18} /></summary>
      <div className="note-code-options-content" onClick={event => { if (matchMedia('(max-width: 700px)').matches && (event.target as Element).closest('button')) setOptionsOpen(false); }}>
      <select aria-label="코드 언어" value={content.language} disabled={disabled} onChange={event => {
        const language = CODE_LANGUAGES.find(item => item.id === event.target.value)!.id;
        onChange({ ...content, text: view.current?.state.doc.sliceString(0, undefined, newline.current) ?? content.text, language });
      }}>{CODE_LANGUAGES.map(language => <option key={language.id} value={language.id}>{language.label}</option>)}</select>
      <button aria-label="실행 취소" title="실행 취소" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => run(undo)}><Undo2 size={17} /></button>
      <button aria-label="다시 실행" title="다시 실행" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => run(redo)}><Redo2 size={17} /></button>
      <button aria-label="들여쓰기" title="들여쓰기" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => run(indentMore)}><IndentIncrease size={17} /></button>
      <button aria-label="내어쓰기" title="내어쓰기" disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={() => run(indentLess)}><IndentDecrease size={17} /></button>
      <button aria-label="검색·바꾸기" title="검색·바꾸기" onClick={() => run(openSearchPanel, false)}><Search size={17} /></button>
      <button aria-label="코드 접기" title="코드 접기" onClick={() => run(foldAll)}><FoldVertical size={17} /></button>
      <button aria-label="코드 펼치기" title="코드 펼치기" onClick={() => run(unfoldAll)}><UnfoldVertical size={17} /></button>
      <button aria-label="자동 줄바꿈" title="자동 줄바꿈" aria-pressed={wrapped} onClick={() => setWrapped(value => !value)}><WrapText size={17} /></button>
      <button aria-label="줄로 이동" onClick={() => run(gotoLine, false)}>줄 이동</button>
      <select aria-label="들여쓰기 너비" value={indent} onChange={event => setIndent(Number(event.target.value))}>
        <option value={2}>2칸</option><option value={4}>4칸</option><option value={8}>8칸</option>
      </select>
      {content.language === 'json' && <button aria-label="JSON 정렬" disabled={disabled} onClick={formatJSON}><Braces size={17} /><span>정렬</span></button>}
      <button aria-label="노트 선택 복사" className="note-code-menu-copy" onClick={() => { const editor = view.current; if (editor) void navigator.clipboard?.writeText(editor.state.sliceDoc(editor.state.selection.main.from, editor.state.selection.main.to)).catch(() => setFormatError('복사 권한을 확인해주세요.')); }}><Copy size={17} />선택 복사</button>
      </div></details>
    </div>
    {formatError && <p role="alert" className="note-code-error">{formatError}</p>}
    <div ref={parent} className="note-code-surface" />
    <footer className="note-code-status"><span>Ln {cursor.line}, Col {cursor.column}</span><span>{content.encoding ?? 'utf-8'} · {lineSeparator(content.text) === '\r\n' ? 'CRLF' : 'LF'}</span></footer>
    <p id="note-code-help" className="note-code-help">Tab 들여쓰기 · Ctrl/Cmd+S 저장 · Esc 다음 Tab으로 편집기에서 이동</p>
  </section>;
}
