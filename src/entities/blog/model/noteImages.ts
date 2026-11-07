export const MAX_NOTE_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_NOTE_IMAGE_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const NOTE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
export type NoteImage = {src: string; alt: string; title?: string};

export function imageMime(bytes: Uint8Array): string {
  const starts = (signature: number[]) => signature.every((v, i) => bytes[i] === v);
  const text = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (starts([137,80,78,71,13,10,26,10])) return 'image/png';
  if (starts([255,216,255])) return 'image/jpeg';
  if (['GIF87a','GIF89a'].includes(text(0,6))) return 'image/gif';
  if (text(0,4) === 'RIFF' && text(8,12) === 'WEBP') return 'image/webp';
  return '';
}

export function safeEmbeddedNoteImage(url: string): string {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,/.exec(url);
  if (!match) return '';
  const body = url.slice(match[0].length);
  if (!body.length || body.length % 4 || body.length > Math.ceil(MAX_NOTE_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body)) return '';
  if (body.length / 4 * 3 - (body.endsWith('==') ? 2 : body.endsWith('=') ? 1 : 0) > MAX_NOTE_IMAGE_BYTES) return '';
  try {
    const prefix = Uint8Array.from(atob(body.slice(0,16)), c => c.charCodeAt(0));
    return imageMime(prefix) === match[1] ? url : '';
  } catch { return ''; }
}

export function imageMarkdown({src, alt, title}: NoteImage): string {
  const escape = (value: string) => value.replace(/[\r\n\t]/g, ' ').replace(/[\\[\]]/g, '\\$&');
  const url = src.replace(/[()\s<>]/g, c => encodeURIComponent(c));
  return `![${escape(alt)}](${url}${title ? ` "${title.replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g,' ')}"` : ''})`;
}

export function assertNoteImageSaveFits(note: unknown) {
  if (new TextEncoder().encode(JSON.stringify(note)).length + 1024 > MAX_NOTE_IMAGE_DOCUMENT_BYTES) throw new Error('원본과 메타데이터를 포함한 저장 크기는 3MiB 이하여야 합니다. 본문과 원본은 유지됩니다. 이미지를 줄이거나 새 노트에 추가해주세요.');
}

export function assertImageFits(markdown: string, src: string, note?: unknown) {
  if (new TextEncoder().encode(markdown).length + src.length + 1024 > MAX_NOTE_IMAGE_DOCUMENT_BYTES) throw new Error('이미지를 포함한 노트 크기는 3MiB 이하만 지원합니다. 이미지를 줄이거나 다른 노트에 추가해주세요.');
  if (note && typeof note === 'object' && !Array.isArray(note)) {
    const snapshot = note as {content?: unknown};
    const content = snapshot.content && typeof snapshot.content === 'object' && !Array.isArray(snapshot.content) ? snapshot.content : {};
    // Reserve caption/selection/next-revision overhead without dropping legacy.
    assertNoteImageSaveFits({...snapshot,content:{...content,markdown:markdown+'\n\n![]('+src+')\n\n'}});
  }
}

export async function readNoteImage(file: File): Promise<NoteImage> {
  if (!file.size || file.size > MAX_NOTE_IMAGE_BYTES) throw new Error('이미지는 파일당 2MiB 이하만 추가할 수 있습니다.');
  const mime = imageMime(new Uint8Array(await file.slice(0,12).arrayBuffer()));
  if (!mime || (file.type && file.type !== mime)) throw new Error('PNG, JPEG, WebP, GIF 이미지 파일을 선택해주세요.');
  const src = await new Promise<string>((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('이미지를 읽지 못했습니다.'));
    reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다. 다시 선택해주세요.'));
    reader.readAsDataURL(new Blob([file], {type:mime}));
  });
  const image = new Image(); image.src = src;
  try { await image.decode(); } catch { throw new Error('손상되었거나 지원하지 않는 이미지입니다.'); }
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('이미지 해상도가 너무 큽니다. 크기를 줄인 뒤 추가해주세요.');
  return {src, alt:file.name.replace(/[\r\n\t]/g,' ').slice(0,200) || '이미지'};
}
