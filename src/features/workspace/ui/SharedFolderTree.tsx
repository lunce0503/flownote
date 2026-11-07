import {ChevronDown,ChevronRight,FileText,Folder,MoreVertical,PanelsTopLeft} from 'lucide-react';
import './shared-folders.css';
import type {SharedFolder} from '../model/folders';
export default function SharedFolderTree({folders,notes,canvases,selected,collapsed,select,toggle,open,edit,remove,move,busy=false}:{
 folders:SharedFolder[];notes:{id:string;title:string}[];canvases:{id:string;title:string}[];selected?:string;collapsed:(id:string)=>boolean;
 select:(id:string)=>void;toggle:(id:string)=>void;open:(kind:'note'|'canvas',id:string)=>void;edit:(folder:SharedFolder)=>void;remove:(folder:SharedFolder)=>void;
 move?:(folder:SharedFolder,kind:'note'|'canvas',id:string)=>void;busy?:boolean;
}){
 const categories=[...new Set(folders.map(f=>f.category||'카테고리 없음'))].sort((a,b)=>a.localeCompare(b,'ko'));
 return <div className="shared-folder-tree">{categories.map(category=><div key={category} role="group" aria-label={`공통 ${category}`}>
  <div className="canvas-tree-category note-tree-category">{category}</div>
  {folders.filter(f=>(f.category||'카테고리 없음')===category).map(f=>{const key=`shared:${f.id}`;return <div key={key} onDragOver={e=>{if(move)e.preventDefault();}} onDrop={e=>{if(!move)return;e.preventDefault();const kind=e.dataTransfer.getData('application/x-flownote-kind'),id=e.dataTransfer.getData('text/plain');if(id&&(kind==='note'||kind==='canvas'))move(f,kind,id);}}>
    <div className="shared-folder-row"><button role="treeitem" aria-level={1} data-folder={key} aria-selected={selected===key} aria-expanded={!collapsed(key)} className="canvas-tree-folder note-tree-label" onClick={()=>{select(key);toggle(key);}}>
      {collapsed(key)?<ChevronRight size={14}/>:<ChevronDown size={14}/>}<Folder size={17}/><span title={f.name}>{f.name}</span><small>{f.note_ids.length+f.canvas_ids.length}</small>
    </button><details className="shared-folder-menu"><summary aria-label={`${f.name} 폴더 동작`}><MoreVertical size={17}/></summary><div>
      <button disabled={busy} onClick={e=>{e.currentTarget.closest('details')?.removeAttribute('open');edit(f);}}>이름·카테고리 변경</button>
      <button disabled={busy} onClick={()=>remove(f)}>폴더만 삭제 (자료 유지)</button>
    </div></details></div>
    {!collapsed(key)&&<div role="group" aria-label={`${f.name} 자료`} className="canvas-tree-files note-tree-children">
      {notes.filter(n=>f.note_ids.includes(n.id)).map(n=><button key={'note:'+n.id} role="treeitem" aria-level={2} onClick={()=>open('note',n.id)}><FileText size={14}/><span>{n.title}</span></button>)}
      {canvases.filter(c=>f.canvas_ids.includes(c.id)).map(c=><button key={'canvas:'+c.id} role="treeitem" aria-level={2} onClick={()=>open('canvas',c.id)}><PanelsTopLeft size={14}/><span>{c.title}</span></button>)}
      {!f.note_ids.length&&!f.canvas_ids.length&&<p className="canvas-tree-empty">빈 폴더</p>}
    </div>}
  </div>})}
 </div>)}</div>;
}
