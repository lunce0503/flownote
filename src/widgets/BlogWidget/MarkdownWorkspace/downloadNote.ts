import { codeFileBytes, type CodeContent } from '@/entities/blog';
import { downloadBlob } from '@/shared/lib/downloadBlob';

export function downloadNote(name: string, text: string, type = 'text/markdown;charset=utf-8') {
  void downloadBlob(name, new Blob([text], { type }));
}


export function downloadCodeNote(name: string, content: CodeContent): void {
  const type = /\.json$/i.test(name) ? 'application/json' : 'text/plain';
  void downloadBlob(name, new Blob([codeFileBytes(content)], { type }));
}
