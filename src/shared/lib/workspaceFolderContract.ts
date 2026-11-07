export type SharedFolder = {id:string;name:string;category:string;note_ids:string[];canvas_ids:string[];revision:number;created_at?:string;updated_at?:string};
const id=/^(?:device-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.every(x=>typeof x==='string'&&id.test(x))&&new Set(v).size===v.length;
export function parseSharedFolder(value:unknown):SharedFolder{
 if(!value||typeof value!=='object')throw Error('공통 폴더 응답을 확인하지 못했습니다. 기존 목록을 보존했습니다.');
 const f=value as Record<string,unknown>;
 if(typeof f.id!=='string'||!id.test(f.id)||typeof f.name!=='string'||!f.name.trim()||[...f.name].length>200||typeof f.category!=='string'||[...f.category].length>120||!ids(f.note_ids)||!ids(f.canvas_ids)||typeof f.revision!=='number'||!Number.isSafeInteger(f.revision)||f.revision<1)throw Error('공통 폴더 응답 형식이 다릅니다. 기존 자료를 보존했습니다.');
 return f as SharedFolder;
}
export function parseSharedFolders(value:unknown):SharedFolder[]{if(!Array.isArray(value))throw Error('공통 폴더 목록을 읽지 못했습니다. 기존 목록을 보존했습니다.');return value.map(parseSharedFolder);}
