import type { CanvasDocumentSummary, CanvasFolder } from '@/entities/canvas';
import type { NoteSummary, NoteFolder } from '@/entities/blog';
export type WorkspaceFile = CanvasDocumentSummary & { kind: 'canvas' | 'note'; revision?: number };
export const workspaceFileKey = (file: WorkspaceFile) => `${file.kind}:${file.id}`;
export function workspaceFiles(canvases: CanvasDocumentSummary[], notes: NoteSummary[], canvasFolders: CanvasFolder[], noteFolders: NoteFolder[],
  location: string, query: string, kind: 'all' | 'canvas' | 'note', sort: 'recent' | 'title' = 'recent', sharedFolders: {id:string; note_ids:string[]; canvas_ids:string[]}[] = []): WorkspaceFile[] {
  const shared = location.startsWith('shared:') ? sharedFolders.find(f => `shared:${f.id}` === location) : undefined;
  if(location.startsWith('shared:')&&!shared)return [];
  const canvasFolder = canvasFolders.find(folder => folder.id === location);
  const noteFolder = location.startsWith('note:') ? noteFolders.find(folder => `note:${folder.id}` === location) : undefined;
  const filedCanvases = new Set([...canvasFolders.flatMap(folder => folder.canvasIds),...sharedFolders.flatMap(f=>f.canvas_ids)]);
  const filedNotes = new Set([...noteFolders.flatMap(folder => folder.noteIds),...sharedFolders.flatMap(f=>f.note_ids)]);
  const normalized = query.trim().toLocaleLowerCase();
  const result: WorkspaceFile[] = [
    ...canvases.filter(file => (!shared || shared.canvas_ids.includes(file.id)) && !noteFolder && (!canvasFolder || canvasFolder.canvasIds.includes(file.id)) && (location !== 'unfiled' || !filedCanvases.has(file.id))).map(file => ({ ...file, kind: 'canvas' as const })),
    ...notes.filter(file => (!shared || shared.note_ids.includes(file.id)) && !canvasFolder && (!noteFolder || noteFolder.noteIds.includes(file.id)) && (location !== 'unfiled' || !filedNotes.has(file.id))).map(file => ({ ...file, created_at: file.created_at instanceof Date ? file.created_at.toISOString() : file.created_at, kind: 'note' as const })),
  ].filter(file => (kind === 'all' || file.kind === kind) && file.title.toLocaleLowerCase().includes(normalized));
  result.sort((a, b) => (sort === 'recent' ? (Date.parse(String(b.updated_at ?? b.created_at)) || 0) - (Date.parse(String(a.updated_at ?? a.created_at)) || 0) : 0)
    || a.title.localeCompare(b.title, 'ko') || workspaceFileKey(a).localeCompare(workspaceFileKey(b)));
  return location === 'recent' && !normalized ? result.slice(0, 6) : result;
}
