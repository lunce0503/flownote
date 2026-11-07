import axios from 'axios';
import { API_CORE_BASE_URL, authHeaders, getAuthUser } from '@/shared/api';
import { isDeviceOnly, newWorkspaceId } from '@/shared/lib/deviceMode';
import { publishSyncEvent } from '@/shared/lib/sync';
import {parseSharedFolder,parseSharedFolders,type SharedFolder} from '@/shared/lib/workspaceFolderContract';
export type {SharedFolder};
const base = '/api/canvas/workspace-folders';
async function request<T>(method: string, path: string, data?: unknown): Promise<T> {
 const owner=getAuthUser()?.id;if(!owner)throw new Error('로그인한 계정을 확인하세요.');
 const response=await axios.request<T>({method,url:API_CORE_BASE_URL+base+path,data,headers:{...authHeaders(),'X-Flownote-Expected-Owner':owner}});
 if(getAuthUser()?.id!==owner)throw new Error('로그인한 계정이 바뀌었습니다.');
 if(!isDeviceOnly()&&response.headers['x-flownote-owner']!==owner)throw new Error('공통 폴더 계정 응답을 확인하지 못했습니다. 기존 자료를 보존했습니다.');
 if(method!=='GET')void publishSyncEvent('all','folder-updated');
 return response.data;
}
export const getSharedFolders=()=>request<unknown>('GET','').then(parseSharedFolders);
export const createSharedFolder=(name:string,category:string,id=newWorkspaceId())=>request<SharedFolder>('POST','',{id,name,category}).then(parseSharedFolder);
export const updateSharedFolder=(f:SharedFolder,name:string,category:string)=>request<SharedFolder>('PATCH','/'+f.id,{name,category,revision:f.revision}).then(parseSharedFolder);
export const deleteSharedFolder=(f:SharedFolder)=>request<SharedFolder>('DELETE','/'+f.id,{revision:f.revision}).then(parseSharedFolder);
export async function moveSharedMember(f:SharedFolder,kind:'note'|'canvas',id:string,remove=false){
 // A late socket refresh can supersede the list reload after the preceding move.
 // Read the latest membership revision; metadata changes still require a new choice.
 const current=await request<unknown>('GET','/'+f.id).then(parseSharedFolder);
 if(current.name!==f.name||current.category!==f.category)throw new Error('폴더 이름·카테고리가 변경됐습니다. 목록을 새로고침하고 이동할 폴더를 다시 선택하세요.');
 if(remove&&!(kind==='note'?current.note_ids:current.canvas_ids).includes(id))throw new Error('자료의 폴더 소속이 변경됐습니다. 목록을 새로고침하고 다시 선택하세요.');
 return request<SharedFolder>(remove?'DELETE':'POST',`/${f.id}/${kind==='note'?'notes':'documents'}/${id}`,{revision:current.revision}).then(parseSharedFolder);
}
