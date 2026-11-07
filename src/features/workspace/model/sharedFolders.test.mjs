import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFiles,workspaceFileKey} from './files.ts';
import {createDeviceWorkspace,handleDeviceRequest,migrateDeviceWorkspace} from '../../../shared/lib/deviceWorkspace.ts';
const c=[{id:'same',title:'Canvas'}],n=[{id:'same',title:'Note'}];
test('explicit shared namespace combines both kinds while legacy equal IDs remain separate',()=>{
 const cf=[{id:'collision',canvasIds:['same']}],nf=[{id:'collision',noteIds:['same']}];
 const shared=[{id:'collision',name:'Shared',note_ids:['same'],canvas_ids:['same']}];
 assert.deepEqual(workspaceFiles(c,n,cf,nf,'shared:collision','','all','title',shared).map(workspaceFileKey),['canvas:same','note:same']);
 assert.deepEqual(workspaceFiles(c,n,cf,nf,'collision','','all').map(workspaceFileKey),['canvas:same']);
 assert.deepEqual(workspaceFiles(c,n,cf,nf,'note:collision','','all').map(workspaceFileKey),['note:same']);
 assert.equal(workspaceFiles(c,n,[],[],'unfiled','','all','title',shared).length,0);
});
test('offline shared folders create/classify/move both types atomically and deletion preserves material',()=>{
 const s=createDeviceWorkspace();s.notes=[{id:'n'}];s.canvases=[{id:'c'}];
 const f=handleDeviceRequest(s,'POST','/api/canvas/workspace-folders',{name:'Course',category:'Math'});
 handleDeviceRequest(s,'POST',`/api/canvas/workspace-folders/${f.id}/notes/n`);
 handleDeviceRequest(s,'POST',`/api/canvas/workspace-folders/${f.id}/documents/c`);
 assert.deepEqual(s.workspaceFolders[0].note_ids,['n']);assert.deepEqual(s.workspaceFolders[0].canvas_ids,['c']);
 handleDeviceRequest(s,'PATCH',`/api/canvas/workspace-folders/${f.id}`,{name:'Algebra',category:'Term 2'});
 assert.equal(s.workspaceFolders[0].category,'Term 2');
 assert.throws(()=>handleDeviceRequest(s,'POST',`/api/canvas/workspace-folders/${f.id}/notes/foreign`));
 handleDeviceRequest(s,'DELETE',`/api/canvas/workspace-folders/${f.id}`);
 assert.equal(s.workspaceFolders.length,0);assert.equal(s.notes.length,1);assert.equal(s.canvases.length,1);
});
test('old device snapshots and pending plans gain the additive shared collection without losing data',()=>{
 const s=createDeviceWorkspace();delete s.workspaceFolders;delete s.sync.base.workspaceFolders;s.notes=[{id:'retained'}];
 s.sync.pending={id:'resume',createdAt:'2026-10-30',cursor:1,idMap:{'device-n':'cloud-n'},desired:structuredClone(s),operations:[{id:'acked',collection:'notes',action:'upsert',itemId:'cloud-n',value:{id:'cloud-n',title:'ACK retained'}},{id:'later',collection:'noteFolders',action:'upsert',itemId:'f',value:{id:'f',name:'Unsent'}}],conflicts:[]};
 delete s.sync.pending.desired.workspaceFolders;delete s.sync.pending.desired.sync;
 const result=migrateDeviceWorkspace(s);assert.deepEqual(result.workspaceFolders,[]);assert.equal(result.notes[0].id,'retained');assert.deepEqual(result.sync.pending.desired.workspaceFolders,[]);assert.equal(result.sync.pending.cursor,1);assert.deepEqual(result.sync.pending.idMap,{'device-n':'cloud-n'});assert.deepEqual(result.sync.pending.operations,s.sync.pending.operations);assert.deepEqual(migrateDeviceWorkspace(result),result);
});

import {reconcileWorkspace,buildDeviceSyncPlan} from '../../../shared/lib/deviceSyncModel.ts';
test('concurrent moves never duplicate a shared member and preserve the alternative as recovery',()=>{
 const base=createDeviceWorkspace();base.notes=[{id:'n'}];base.workspaceFolders=['a','b','c'].map(id=>({id,name:id,category:'',note_ids:id==='a'?['n']:[],canvas_ids:[],revision:1}));
 const local=structuredClone(base),remote=structuredClone(base);local.workspaceFolders[0].note_ids=[];local.workspaceFolders[1].note_ids=['n'];remote.workspaceFolders[0].note_ids=[];remote.workspaceFolders[2].note_ids=['n'];
 const merged=reconcileWorkspace(base,local,remote,'move-conflict');
 assert.equal(merged.workspace.workspaceFolders.filter(f=>f.note_ids.includes('n')).length,1);assert(merged.conflicts.some(c=>c.id.includes('location')));
});
test('resuming an ACKed old plan retains cursor/idMap and produces no duplicate note create',()=>{
 const s=createDeviceWorkspace();s.notes=[{id:'device-n',title:'N',content:{format:'markdown',version:1,markdown:'kept'}}];
 const remote=createDeviceWorkspace();remote.notes=[{...s.notes[0],id:'cloud-n'}];s.sync.pending={id:'old',cursor:1,idMap:{'device-n':'cloud-n'},createdAt:'2026-10-30',desired:structuredClone(remote),conflicts:[],operations:[{id:'ack',collection:'notes',action:'upsert',itemId:'cloud-n',value:remote.notes[0]}]};delete s.sync.pending.desired.workspaceFolders;
 const migrated=migrateDeviceWorkspace(s),plan=buildDeviceSyncPlan(migrated,remote,'new',()=>{throw Error('must reuse map');});
 assert.equal(plan.idMap['device-n'],'cloud-n');assert(!plan.operations.some(o=>o.collection==='notes'));
});

test('a shared folder removed on another device never exposes all files under its old label',()=>{assert.deepEqual(workspaceFiles(c,n,[],[],'shared:deleted','','all','recent',[]),[]);});

import {parseSharedFolders} from '../../../shared/lib/workspaceFolderContract.ts';
test('an unexpected API shape fails closed instead of converting a health response to an empty folder list',()=>{
 assert.throws(()=>parseSharedFolders({status:'UP'}));assert.throws(()=>parseSharedFolders([{id:'bad',note_ids:[],canvas_ids:[],revision:1}]));
 const id='33333333-3333-4333-8333-333333333333';assert.equal(parseSharedFolders([{id,name:'공통',category:'수학',note_ids:[],canvas_ids:[],revision:1}]).length,1);
});
