import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileCode2, Upload, FilePlus2, FileText, Folder, FolderPlus, PanelsTopLeft, MoreVertical, PanelLeft, RefreshCw } from 'lucide-react';
import { addNoteToFolder, deleteNote, deleteNoteFolder, getNoteFolders, getNoteSummaries,
  noteDrafts, postNoteData, removeNoteFromFolder, updateNoteFolder, updateNoteTitle, CODE_FILE_ACCEPT, isCodeContent, isMarkdown, noteFileName, newCodeContent, readCodeFile, assertCodeNoteFits } from '@/entities/blog';
import type { BlockDataProps, NoteFolder, NoteSummary } from '@/entities/blog';
import { getAuthUser } from '@/shared/api';
import { newWorkspaceId } from '@/shared/lib/deviceMode';
import { getSyncClientId, subscribeSyncEvents } from '@/shared/lib/sync';
import { workspaceTree } from '@/features/blog';
import { pauseNoteSave, waitForNoteSave } from '@/features/blog';
import {SharedFolderTree,getSharedFolders,createSharedFolder,updateSharedFolder,deleteSharedFolder,moveSharedMember,type SharedFolder} from '@/features/workspace';
import {getCanvasDocuments,createCanvasDocument,type CanvasDocumentSummary} from '@/entities/canvas';
import NoteEditor from './NoteEditor';
import { CodeFileDialog } from '@/features/blog';
import '@/shared/styles/workspace.css';
import './workspace.css';
import './code-editor.css';

export default function MarkdownWorkspace() {
  const owner = getAuthUser()?.id ?? '';
  return <Workspace key={owner} owner={owner} />;
}
function Workspace({ owner }: { owner: string }) {
  const [codeDialog, setCodeDialog] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const creationWarning = location.state?.createdNoteId === noteId ? location.state?.noteCreationWarning : '';
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [sharedFolders,setSharedFolders]=useState<SharedFolder[]>([]);
  const [canvases,setCanvases]=useState<CanvasDocumentSummary[]>([]);
  const [folderForm,setFolderForm]=useState<{id?:string;kind:'shared'|'legacy';name:string;category:string}|null>(null);
  const createFolderId=useRef<string|null>(null);
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const operationBusy = useRef(false);
  const [drawer, setDrawer] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const [folderId, setFolderId] = useState('');
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(`flownote.blog.tree:${owner}`) ?? '[]');
      return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [];
    } catch { return []; }
  });
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const generation = useRef(0);
  const summaryRequest = useRef<AbortController | null>(null);
  const renameCurrent = useRef<((title: string) => void) | null>(null);
  const registerRename = useCallback((rename: ((title: string) => void) | null) => { renameCurrent.current = rename; }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    summaryRequest.current?.abort();
    const request = new AbortController();
    summaryRequest.current = request;
    const isCurrent = () => current === generation.current && !request.signal.aborted && getAuthUser()?.id === owner;
    const results = await Promise.allSettled([
      getNoteSummaries(request.signal, page => {
        if (isCurrent()) { setNotes(page); setLoading(false); }
      }),
      getNoteFolders().then(value => { if (isCurrent()) setFolders(value); return value; }),
      getSharedFolders().then(value=>{if(isCurrent())setSharedFolders(value);return value;}),
      getCanvasDocuments().then(value=>{if(isCurrent())setCanvases(value);return value;}),
    ]);
    if (!isCurrent()) return;
    const [noteResult, folderResult] = results;
    if (noteResult.status === 'fulfilled') setNotes(noteResult.value);
    if (folderResult.status === 'fulfilled') setFolders(folderResult.value);
    setError(results.some(r => r.status === 'rejected') ? '목록 일부를 불러오지 못했습니다. 다시 시도하세요.' : '');
    setLoading(false);
  }, [owner]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) void refresh(); });
    const unsubscribe = subscribeSyncEvents(event => {
      if (event.clientId === getSyncClientId() && event.action.startsWith('note-')) return;
      if (event.resource === 'canvas' || event.resource === 'notes' || event.resource === 'all') void refresh();
    });
    return () => { active = false; summaryRequest.current?.abort(); unsubscribe(); };
  }, [refresh]);
  useEffect(() => {
    try { localStorage.setItem(`flownote.blog.tree:${owner}`, JSON.stringify(collapsed)); } catch { /* UI preference only */ }
  }, [collapsed, owner]);
  useEffect(() => {
    if (!drawer || !window.matchMedia('(max-width: 700px)').matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const getItems = () => Array.from(sidebar.current?.querySelectorAll<HTMLElement>('button, select, [tabindex="0"], summary') ?? []).filter(e => e.getClientRects().length);
    getItems()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setDrawer(false); }
      if (e.key === 'Tab') {
        const items = getItems(), first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [drawer]);
  const selectedShared=sharedFolders.find(f=>f.note_ids.includes(noteId??''));
  const activeShared=folderId?sharedFolders.find(f=>'shared:'+f.id===folderId):selectedShared;
  const selectedFolder = folders.find(f => f.noteIds.includes(noteId ?? ''));
  const openedFolderId = selectedFolder?.id;
  const openedCategory = selectedFolder?.category.trim() || '카테고리 없음';
  useEffect(() => {
    if (!openedFolderId) return;
    queueMicrotask(() => setCollapsed(ids => ids.filter(id => id !== openedFolderId && id !== `category:${openedCategory}`)));
  }, [noteId, openedFolderId, openedCategory]);
  const activeFolder = folderId?folders.find(f=>f.id===folderId):selectedFolder;
  const selected = notes.find(n => n.id === noteId);
  const sharedNotes=new Set(sharedFolders.flatMap(f=>f.note_ids));
  const tree = workspaceTree(notes.filter(n=>!sharedNotes.has(n.id)), folders);
  const handleSaved = useCallback((saved: BlockDataProps) => {
    if (getAuthUser()?.id !== owner) return;
    const summary: NoteSummary = { content_format: isCodeContent(saved.content) ? 'code' : isMarkdown(saved.content) ? 'markdown' : 'blocknote', id: saved.id, title: saved.title, created_at: saved.created_at, updated_at: saved.updated_at, revision: saved.revision };
    setNotes(current => current.some(note => note.id === saved.id) ? current.map(note => note.id === saved.id ? summary : note) : [summary, ...current]);
  }, [owner]);
  const run = async (action: () => Promise<void>) => {
    if (operationBusy.current) return;
    operationBusy.current = true;
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch { setError('파일 작업에 실패했습니다. 최신 목록을 확인하고 다시 시도하세요. 입력과 원본은 유지됩니다.'); }
    finally { operationBusy.current = false; setBusy(false); }
  };
  const openNote = (id: string) => { navigate(`/blog/${id}`); if (window.matchMedia('(max-width: 700px)').matches) setDrawer(false); };
  const toggleFolder = (id: string) => setCollapsed(ids => ids.includes(id) ? ids.filter(v => v !== id) : [...ids, id]);
  const createDocument = async (document: Pick<BlockDataProps, 'title' | 'content'>) => {
    if (getAuthUser()?.id !== owner) return;
    const request = { ...document, id: newWorkspaceId(), created_at: new Date().toISOString(), revision: 1, client_id: getSyncClientId() };
    assertCodeNoteFits(request);
    const saved = await postNoteData(request);
    if (getAuthUser()?.id !== owner) return;
    let warning = '';
    if(activeShared){try{await moveSharedMember(activeShared,'note',saved.id);}catch{warning='노트는 만들었지만 공통 폴더에 넣지 못했습니다. 미분류에서 다시 이동하세요.';}}
    else if (activeFolder) {
      try { await addNoteToFolder(activeFolder.id, saved.id); }
      catch { warning = '노트는 만들었지만 폴더에 넣지 못했습니다. 미분류에서 이동을 다시 시도하세요.'; }
      setCollapsed(ids => ids.filter(v => v !== activeFolder.id));
    }
    if (getAuthUser()?.id !== owner) return;
    navigate(`/blog/${saved.id}`, { state: { noteCreationWarning: warning, createdNoteId: saved.id } });
    if (window.matchMedia('(max-width: 700px)').matches) setDrawer(false);
  };
  const newNote = () => void run(() => createDocument({ title: '제목 없음', content: { format: 'markdown', version: 1, markdown: '' } }));
  const importFile = (file: File) => void run(async () => {
    setFileError('');
    let document: Awaited<ReturnType<typeof readCodeFile>>;
    try { document = await readCodeFile(file); }
    catch (error) { setFileError(error instanceof Error ? error.message : '파일을 읽지 못했습니다.'); return; }
    await createDocument(document);
  });
  const newFolder = () => {createFolderId.current=null;setFolderForm({kind:'shared',name:'',category:activeShared?.category??activeFolder?.category??''});};
  const saveFolder=()=>void run(async()=>{
    if(!folderForm)return;
    if(folderForm.id){
      if(folderForm.kind==='shared'){const f=sharedFolders.find(f=>f.id===folderForm.id);if(!f)throw Error();await updateSharedFolder(f,folderForm.name,folderForm.category);}
      else await updateNoteFolder(folderForm.id,{name:folderForm.name,category:folderForm.category});
    }else{createFolderId.current??=newWorkspaceId();const f=await createSharedFolder(folderForm.name,folderForm.category,createFolderId.current);setFolderId('shared:'+f.id);createFolderId.current=null;}
    setFolderForm(null);
  });
  const moveNote=async(id:string,target:string,parent?:NoteFolder)=>{
    const source=sharedFolders.find(f=>f.note_ids.includes(id));
    if(target.startsWith('shared:')){const f=sharedFolders.find(f=>'shared:'+f.id===target);if(!f)throw Error();await moveSharedMember(f,'note',id);}
    else if(target)await addNoteToFolder(target,id);
    else if(source)await moveSharedMember(source,'note',id,true);
    else if(parent)await removeNoteFromFolder(parent.id,id);
    if(id===noteId)setFolderId(target);
  };
  const newCanvas=()=>void run(async()=>{if(!activeShared)return;const c=await createCanvasDocument('새 캔버스');try{await moveSharedMember(activeShared,'canvas',c.id);}catch{setError('캔버스는 만들었지만 폴더에 넣지 못했습니다. 작업 공간의 미분류에서 다시 이동하세요.');return;}navigate('/canvas/'+c.id);});
  const renameNote = (note: NoteSummary) => void run(async () => {
    const title = window.prompt('노트 이름 변경', note.title); if (!title?.trim() || title === note.title) return;
    if (note.id === noteId) {
      if (!renameCurrent.current) throw new Error('편집기를 불러오는 중입니다.');
      renameCurrent.current(title.trim()); return;
    }
    await updateNoteTitle(note.id, title.trim(), { revision: (note.revision ?? 0) + 1, clientId: getSyncClientId() });
  });
  const noteRow = (note: NoteSummary, parent?: NoteFolder) => <div className="note-tree-row" key={note.id}>
    <button className="note-tree-label" role="treeitem" aria-level={parent ? 3 : 2} data-parent={parent?.id} aria-selected={noteId === note.id}
      title={note.title} onClick={() => { setFolderId(parent?.id ?? ''); openNote(note.id); }}>
      <FileText size={16} /><span>{noteFileName(note)}</span>
    </button>
    <details className="note-file-menu"><summary aria-label={`${note.title} 파일 동작`}><MoreVertical size={17} /></summary><div>
      <button disabled={busy} onClick={() => renameNote(note)}>이름 변경</button>
      <label>노트 이동<select aria-label={`${note.title} 이동`} value={parent?.id ?? ''} disabled={busy}
        onChange={e => { const target = e.target.value; void run(async () => {
          await moveNote(note.id,target,parent);
          if (note.id === noteId) setFolderId(target);
        }); }}>
        <option value="">미분류</option>{sharedFolders.map(f=><option key={"shared:"+f.id} value={"shared:"+f.id}>{f.category||"카테고리 없음"} / {f.name}</option>)}{folders.map(f => <option key={f.id} value={f.id}>{f.category || '카테고리 없음'} / {f.name}</option>)}
      </select></label>
      <button disabled={busy} onClick={() => {
        if (window.confirm(`“${note.title}” 노트와 기기 초안을 삭제할까요?`)) void run(async () => {
          pauseNoteSave(owner, note.id); await waitForNoteSave(owner, note.id); await deleteNote(note.id); await noteDrafts.remove(owner, note.id);
          if (note.id === noteId) navigate('/blog');
        });
      }}>노트 삭제</button>
    </div></details>
  </div>;
  return <section onKeyDown={e => {
    if (e.key !== 'Escape') return;
    const menu = e.currentTarget.querySelector<HTMLDetailsElement>('.note-file-menu[open]');
    if (menu) { e.stopPropagation(); menu.open = false; menu.querySelector('summary')?.focus(); }
  }} className="note-workspace workspace-surface" data-testid="markdown-workspace" aria-label="노트 작업 공간">
    <header className="note-topbar">
      <button ref={toggle} aria-label="탐색기 토글" title="탐색기 토글" aria-expanded={drawer} aria-controls="note-explorer" onClick={() => setDrawer(v => !v)}><PanelLeft size={19} /></button>
      <div className="note-breadcrumb" title={[selectedFolder?.category, selectedFolder?.name, selected?.title].filter(Boolean).join(' / ')}>
        노트 / {selectedShared?`${selectedShared.category||'카테고리 없음'} / ${selectedShared.name} / `:''}{selectedFolder ? `${selectedFolder.category || '카테고리 없음'} / ${selectedFolder.name} / ` : ''}{selected?.title ?? '작업 공간'}
      </div>
      <button onClick={newNote} disabled={busy} aria-label="새 노트" title="새 노트"><FilePlus2 size={19} /></button>
      <button onClick={() => setCodeDialog(true)} disabled={busy} aria-label="새 코드 파일" title="새 코드 파일"><FileCode2 size={19} /></button>
      <button onClick={() => fileInput.current?.click()} disabled={busy} aria-label="코드 파일 가져오기" title="코드 파일 가져오기"><Upload size={19} /></button>
      <input ref={fileInput} type="file" hidden aria-label="코드 파일 선택" accept={CODE_FILE_ACCEPT} disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
        if (file) importFile(file);
      }} />
      {activeShared&&<button onClick={newCanvas} disabled={busy} aria-label="새 캔버스" title="새 캔버스"><PanelsTopLeft size={19}/></button>}
      {noteId&&<select aria-label="현재 노트 이동" disabled={busy} value={selectedShared?'shared:'+selectedShared.id:selectedFolder?.id??''} onChange={e=>{const target=e.target.value;void run(()=>moveNote(noteId,target,selectedFolder));}}><option value="">미분류</option>{sharedFolders.map(f=><option key={'shared:'+f.id} value={'shared:'+f.id}>{f.category||'카테고리 없음'} / {f.name}</option>)}{folders.map(f=><option key={f.id} value={f.id}>{f.category||'카테고리 없음'} / {f.name} (기존)</option>)}</select>}
      <button onClick={newFolder} disabled={busy} aria-label="새 폴더" title="새 폴더"><FolderPlus size={18} /></button>
    </header>
    {folderForm&&<form className="note-folder-form" aria-label="폴더 편집" onSubmit={e=>{e.preventDefault();saveFolder();}}><label>폴더 카테고리<input aria-label="폴더 카테고리" value={folderForm.category} maxLength={120} onChange={e=>setFolderForm({...folderForm,category:e.target.value})}/></label><label>폴더 이름<input aria-label="폴더 이름" value={folderForm.name} maxLength={200} required onChange={e=>setFolderForm({...folderForm,name:e.target.value})}/></label><button disabled={busy||!folderForm.name.trim()}>{folderForm.id?'폴더 저장':'폴더 만들기'}</button><button type="button" onClick={()=>setFolderForm(null)}>취소</button></form>}
    <div className="note-workspace-body">
      {drawer && <button className="note-drawer-scrim" aria-label="탐색기 닫기" onClick={() => setDrawer(false)} />}
      <aside id="note-explorer" ref={sidebar} className={`note-explorer ${drawer ? 'is-open' : ''}`} role={drawer && window.matchMedia('(max-width: 700px)').matches ? 'dialog' : 'complementary'} aria-modal={drawer && window.matchMedia('(max-width: 700px)').matches ? true : undefined} aria-label="노트 탐색기">
        <div className="note-explorer-heading"><span>탐색기</span><button aria-label="목록 새로고침" onClick={() => void refresh()}><RefreshCw size={15} /></button>
          <button className="note-mobile-close" onClick={() => setDrawer(false)}>닫기</button></div>
        {loading && <p role="status">목록 불러오는 중…</p>}
        {error && <div role="alert">{error}<button onClick={() => void refresh()}>다시 시도</button></div>}
        <div role="tree" aria-label="폴더와 노트" onKeyDown={e => {
          const target = e.target as HTMLElement;
          if (target.getAttribute('role') !== 'treeitem') return;
          const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="treeitem"]'));
          const index = items.indexOf(target);
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault(); items[e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
          }
          if (e.key === 'ArrowLeft' && target.dataset.parent) {
            e.preventDefault(); e.currentTarget.querySelector<HTMLElement>(`[data-folder="${CSS.escape(target.dataset.parent)}"]`)?.focus();
          }
          const folder = target.dataset.folder;
          if (folder && ['ArrowRight', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); setCollapsed(ids => e.key === 'ArrowRight' ? ids.filter(id => id !== folder) : [...new Set([...ids, folder])]); }
        }}>
          <SharedFolderTree folders={sharedFolders} notes={notes} canvases={canvases} selected={activeShared?'shared:'+activeShared.id:undefined} collapsed={id=>collapsed.includes(id)} select={setFolderId} toggle={toggleFolder} open={(kind,id)=>{if(kind==='note')openNote(id);else navigate('/canvas/'+id);}} edit={f=>setFolderForm({id:f.id,kind:'shared',name:f.name,category:f.category})} remove={f=>{if(window.confirm('폴더만 삭제할까요? 안의 노트와 캔버스는 미분류에 남습니다.'))void run(async()=>{await deleteSharedFolder(f);setFolderId('');});}} busy={busy}/>
          {tree.categories.map(([category, groups]) => <div key={category} role="group" aria-label={category}>
            <button className="note-tree-category" role="treeitem" aria-level={1} data-folder={`category:${category}`} aria-expanded={!collapsed.includes(`category:${category}`)} onClick={() => toggleFolder(`category:${category}`)}>{collapsed.includes(`category:${category}`) ? <ChevronRight size={14} /> : <ChevronDown size={14} />}{category}</button>
            {!collapsed.includes(`category:${category}`) && groups.map(({ folder, notes: members }) => <div key={folder.id}>
              <div className="note-tree-row">
                <button className="note-tree-label" role="treeitem" aria-level={2} data-folder={folder.id}
                  aria-expanded={!collapsed.includes(folder.id)} aria-selected={!noteId && activeFolder?.id === folder.id}
                  onClick={() => { setFolderId(folder.id); toggleFolder(folder.id); }}>
                  {collapsed.includes(folder.id) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}<Folder size={16} /><span title={folder.name}>{folder.name}</span>
                </button>
                <details className="note-file-menu"><summary aria-label={`${folder.name} 폴더 동작`}><MoreVertical size={17} /></summary><div>
                  <button disabled={busy} onClick={()=>setFolderForm({id:folder.id,kind:'legacy',name:folder.name,category:folder.category})}>이름·카테고리 변경</button>
                  <button disabled={busy} onClick={() => {
                    if (window.confirm('폴더만 삭제할까요? 안의 노트는 미분류에 남습니다.')) void run(async () => { await deleteNoteFolder(folder.id); setFolderId(''); });
                  }}>폴더만 삭제 (노트 유지)</button>
                </div></details>
              </div>
              {!collapsed.includes(folder.id) && <div role="group" aria-label={`${folder.name} 노트`} className="note-tree-children">{members.map(n => noteRow(n, folder))}{members.length === 0 && <p className="note-tree-empty">빈 폴더</p>}</div>}
            </div>)}
          </div>)}
          <div role="group" aria-label="미분류"><div className="note-tree-category"><button onClick={() => { setFolderId(''); navigate('/blog'); }}>미분류</button></div>{tree.unfiled.map(n => noteRow(n))}</div>
        </div>
        {!loading && notes.length === 0 && !error && <p>아직 노트가 없습니다. 새 노트로 시작하세요.</p>}
      </aside>
      <main className="note-content" aria-label="문서">
        {fileError && <p role="alert" className="note-notice">{fileError}</p>}
        {creationWarning && <p role="alert" className="note-notice">{creationWarning}<button onClick={() => navigate(location.pathname, { replace: true, state: null })}>닫기</button></p>}
        {error && <p role="alert" className="note-notice">{error}</p>}
        {noteId ? <NoteEditor key={`${owner}:${noteId}`} owner={owner} id={noteId} registerRename={registerRename} onSaved={handleSaved} /> :
          <div className="note-workspace-empty"><FileText size={32} /><h1>노트 작업 공간</h1><p>폴더에서 문서를 선택하거나 노트·코드 파일을 만드세요.</p><button onClick={newNote} disabled={busy}>새 노트</button></div>}
      </main>
    </div>
    {codeDialog && <CodeFileDialog close={() => setCodeDialog(false)} create={(title, language) => {
      setCodeDialog(false);
      void run(() => createDocument({ title, content: newCodeContent(language) }));
    }} />}
  </section>;
}
