import { CODE_LANGUAGES, isCodeContent, type CodeContent, type CodeLanguage, type CodeEncoding } from '../../../shared/lib/codeContent.ts';
export { CODE_LANGUAGES, isCodeContent } from '../../../shared/lib/codeContent.ts';
export type { CodeContent, CodeLanguage, CodeEncoding } from '../../../shared/lib/codeContent.ts';

export const CODE_FILE_ACCEPT = CODE_LANGUAGES.flatMap(language => language.extensions.map(extension => `.${extension}`)).join(',');
export const MAX_CODE_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_CODE_NOTE_BYTES = 3 * 1024 * 1024;

export function codeLanguageForFile(name: string): CodeLanguage {
  const extension = name.split('.').at(-1)?.toLowerCase();
  return CODE_LANGUAGES.find(language => language.extensions.some(item => item === extension))?.id ?? 'plaintext';
}

export function codeFileExtension(language: CodeLanguage): string {
  return CODE_LANGUAGES.find(item => item.id === language)!.extensions[0];
}

export function noteFileName(note: { title: string; content?: unknown; content_format?: string }): string {
  const title = note.title || '제목 없음';
  return isCodeContent(note.content) || note.content_format === 'code' ? title : `${title.replace(/\.md$/i, '')}.md`;
}

export function newCodeContent(language: CodeLanguage, text = '', encoding: CodeEncoding = 'utf-8'): CodeContent {
  return { format: 'code', version: 1, text, language, encoding };
}

export function assertCodeNoteFits(note: { content: unknown }): void {
  if (isCodeContent(note.content) && codeFileBytes(note.content).length > MAX_CODE_FILE_BYTES) {
    throw new Error('코드 파일은 2MiB까지 편집하고 내보낼 수 있습니다.');
  }
  if (isCodeContent(note.content) && new TextEncoder().encode(JSON.stringify(note)).length > MAX_CODE_NOTE_BYTES) {
    throw new Error('코드 파일과 메타데이터의 저장 크기는 3MiB 이하여야 합니다.');
  }
}

export async function readCodeFile(file: File): Promise<{ title: string; content: CodeContent }> {
  if (file.size > MAX_CODE_FILE_BYTES) throw new Error('코드 파일은 2MiB까지 가져올 수 있습니다.');
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (!CODE_LANGUAGES.some(language => language.extensions.some(item => item === extension))) {
    throw new Error('지원하는 텍스트·코드 파일의 확장자를 선택해주세요.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  let encoding: CodeEncoding = 'utf-8';
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { encoding = 'utf-8-bom'; offset = 3; }
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'utf-16le'; offset = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = 'utf-16be'; offset = 2; }
  let text: string;
  try {
    text = new TextDecoder(encoding === 'utf-8-bom' ? 'utf-8' : encoding, { fatal: true, ignoreBOM: true }).decode(bytes.subarray(offset));
  } catch {
    throw new Error('파일을 읽지 못했습니다. UTF-8 또는 BOM이 있는 UTF-16 텍스트 파일을 선택해주세요.');
  }
  if ([...text].some(character => character.charCodeAt(0) < 9 || character.charCodeAt(0) >= 14 && character.charCodeAt(0) < 32)) throw new Error('바이너리 파일은 코드 노트로 가져올 수 없습니다.');
  const result = { title: file.name, content: newCodeContent(codeLanguageForFile(file.name), text, encoding) };
  assertCodeNoteFits(result);
  return result;
}

export function codeFileBytes(content: CodeContent): Uint8Array<ArrayBuffer> {
  if (content.encoding === 'utf-16le' || content.encoding === 'utf-16be') {
    const bytes = new Uint8Array(2 + content.text.length * 2);
    const view = new DataView(bytes.buffer);
    const littleEndian = content.encoding === 'utf-16le';
    view.setUint16(0, 0xfeff, littleEndian);
    for (let index = 0; index < content.text.length; index++) view.setUint16(2 + index * 2, content.text.charCodeAt(index), littleEndian);
    return bytes;
  }
  const text = new TextEncoder().encode(content.text);
  if (content.encoding !== 'utf-8-bom') return text;
  const bytes = new Uint8Array(text.length + 3);
  bytes.set([0xef, 0xbb, 0xbf]); bytes.set(text, 3);
  return bytes;
}
