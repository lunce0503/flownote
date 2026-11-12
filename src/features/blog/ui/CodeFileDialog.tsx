import { useEffect, useRef, useState } from 'react';
import './code-file-dialog.css';
import { CODE_LANGUAGES, codeFileExtension, codeLanguageForFile, type CodeLanguage } from '@/entities/blog';

export default function CodeFileDialog({ close, create }: {
  close: () => void;
  create: (name: string, language: CodeLanguage) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [language, setLanguage] = useState<CodeLanguage>('json');
  const [name, setName] = useState('untitled.json');
  const [error, setError] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="note-code-dialog" aria-label="새 코드 파일" onCancel={close}>
    <form onSubmit={event => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || /[\\/:*?"<>|]/.test(trimmed) || [...trimmed].some(character => character.charCodeAt(0) < 32)) { setError('파일 이름을 확인해주세요.'); return; }
      const extension = trimmed.split('.').at(-1)?.toLowerCase();
      const supported = CODE_LANGUAGES.some(item => item.extensions.some(value => value === extension));
      const filename = supported ? trimmed : `${trimmed}.${codeFileExtension(language)}`;
      create(filename, codeLanguageForFile(filename));
    }}>
      <h2>새 코드 파일</h2>
      <label>파일 이름<input aria-label="파일 이름" value={name} maxLength={180} onChange={event => setName(event.target.value)} autoFocus /></label>
      <label>언어<select aria-label="파일 언어" value={language} onChange={event => {
        const selected = CODE_LANGUAGES.find(item => item.id === event.target.value)!.id;
        setLanguage(selected);
        setName(value => `${value.replace(/\.[^.]+$/, '')}.${codeFileExtension(selected)}`);
      }}>{CODE_LANGUAGES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}
      <footer><button type="button" onClick={close}>취소</button><button type="submit">만들기</button></footer>
    </form>
  </dialog>;
}
