import { useRef, useState, useLayoutEffect } from 'react';
import {readNoteImage, imageMarkdown, assertImageFits} from '@/entities/blog';
import NoteImageControl from './NoteImageControl';
import LatexSuggestions from './LatexSuggestions';
import { latexCompletion, replaceCompletion, type LatexCommand } from './mathInput';

export default function MarkdownSource({ value, disabled, onChange, validateImage }: { value: string; disabled: boolean; onChange: (value: string) => void; validateImage?: (markdown: string, src: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(0), [dismissed, setDismissed] = useState('');
  const [imageBusy,setImageBusy]=useState(false),[imageError,setImageError]=useState('');
  const latest=useRef({value,disabled,onChange,validateImage}), mounted=useRef(false), reading=useRef(false);
  const pendingSelection=useRef<{value:string;cursor:number}|null>(null);
  useLayoutEffect(()=>{latest.current={value,disabled,onChange,validateImage};});
  useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useLayoutEffect(()=>{
    const pending=pendingSelection.current;
    if(pending&&pending.value===value&&!disabled){pendingSelection.current=null;input.current?.focus();input.current?.setSelectionRange(pending.cursor,pending.cursor);}
  },[value,disabled]);
  const addImage=async(file:File)=>{
    if(disabled||reading.current)return;
    const before=value,from=input.current?.selectionStart??value.length,to=input.current?.selectionEnd??from;
    reading.current=true;setImageBusy(true);setImageError('');
    try{
      const image=await readNoteImage(file);
      if(!mounted.current||latest.current.disabled)return;
      if(latest.current.value!==before)throw new Error('이미지를 읽는 동안 본문이 변경됐습니다. 현재 입력은 유지됩니다. 이미지를 다시 추가해주세요.');
      assertImageFits(before,image.src);latest.current.validateImage?.(before,image.src);
      const insert='\n\n'+imageMarkdown(image)+'\n\n',next=before.slice(0,from)+insert+before.slice(to);
      pendingSelection.current={value:next,cursor:from+insert.length};latest.current.onChange(next);
    }catch(error){if(mounted.current)setImageError(error instanceof Error?error.message:'이미지를 추가하지 못했습니다.');}
    finally{reading.current=false;if(mounted.current)setImageBusy(false);}
  };
  const completion = disabled || dismissed === `${value}:${cursor}` ? null : latexCompletion(value, cursor);
  const choose = (command: LatexCommand) => {
    if (!completion) return;
    const next = replaceCompletion(value, completion, command);
    onChange(next.value); setCursor(next.cursor);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(next.cursor, next.cursor); });
  };
  return <div className="note-source-editor">
    <div className="note-live-formatting"><NoteImageControl disabled={disabled} busy={imageBusy} onFile={addImage}/></div>
    {imageBusy&&<p className="note-image-status" role="status">이미지 읽는 중…</p>}
    {imageError&&<p className="note-image-status" role="alert">{imageError}</p>}
    <textarea ref={input} aria-label="Markdown 본문" spellCheck={false} value={value} disabled={disabled}
      onPaste={e=>{const file=e.clipboardData.files[0];if(file&&!disabled){e.preventDefault();void addImage(file);}}}
      onDrop={e=>{const file=e.dataTransfer.files[0];if(file&&!disabled){e.preventDefault();void addImage(file);}}}
      onChange={event => { setCursor(event.target.selectionStart); onChange(event.target.value); }}
      onSelect={event => setCursor(event.currentTarget.selectionStart)} onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (completion && event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); choose(completion.items[0]); }
        if (completion && event.key === 'Escape') { event.preventDefault(); setDismissed(`${value}:${cursor}`); }
      }} />
    <LatexSuggestions completion={completion} choose={choose} />
  </div>;
}
