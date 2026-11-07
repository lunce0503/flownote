import {useRef} from 'react';
import {ImagePlus} from 'lucide-react';
import {NOTE_IMAGE_ACCEPT} from '@/entities/blog';

export default function NoteImageControl({disabled,busy,onFile}:{disabled:boolean;busy:boolean;onFile:(file:File)=>Promise<void>}) {
  const input = useRef<HTMLInputElement>(null);
  return <>
    <button type="button" aria-label="이미지 추가" title="이미지 추가 (PNG/JPEG/WebP/GIF, 2MiB 이하)" disabled={disabled||busy} onClick={()=>input.current?.click()}><ImagePlus size={17}/></button>
    <input ref={input} type="file" hidden aria-label="노트 이미지 파일" accept={NOTE_IMAGE_ACCEPT} disabled={disabled||busy} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';if(file)void onFile(file);}}/>
  </>;
}
