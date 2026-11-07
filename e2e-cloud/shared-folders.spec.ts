import {test,expect,type APIRequestContext,type Browser,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
const api='https://flownote-api-staging.up.railway.app',web='https://flownote-react-staging.vercel.app',path='/api/canvas/workspace-folders';
type Actor={token:string;user:{id:string}};
type Folder={id:string;name:string;category:string;revision:number;note_ids:string[];canvas_ids:string[]};
async function actor(request:APIRequestContext):Promise<Actor>{const email=`shared-${randomUUID()}@example.com`,password=randomUUID();expect((await request.post(api+'/api/users',{data:{email,password,username:'sh-'+randomUUID().slice(0,8),nickname:'Synthetic shared folders'}})).ok()).toBe(true);const r=await request.post(api+'/api/users/login',{data:{email,password}});expect(r.ok()).toBe(true);return r.json();}
const headers=(a:Actor)=>({Authorization:`Bearer ${a.token}`});
async function get(request:APIRequestContext,a:Actor,id:string):Promise<Folder>{const r=await request.get(api+path+'/'+id,{headers:headers(a)});expect(r.ok()).toBe(true);expect(r.headers()['x-flownote-owner']).toBe(a.user.id);return r.json();}
async function create(request:APIRequestContext,a:Actor,id=randomUUID()):Promise<Folder>{const r=await request.post(api+path,{headers:headers(a),data:{id,name:'Shared course',category:'Term 1'}});expect(r.ok()).toBe(true);return r.json();}
async function member(request:APIRequestContext,a:Actor,id:string,kind:'notes'|'documents',item:string,remove=false){const f=await get(request,a,id);const r=await request[remove?'delete':'post'](api+path+`/${id}/${kind}/${item}`,{headers:headers(a),data:{revision:f.revision}});expect(r.ok()).toBe(true);return r.json();}
async function seed(request:APIRequestContext,a:Actor){const id=randomUUID();expect((await request.post(api+'/api/notes',{headers:headers(a),data:{id,title:'Shared note',content:{format:'markdown',version:1,markdown:'Preserve original'},revision:1,client_id:randomUUID()}})).ok()).toBe(true);expect((await request.post(api+'/api/canvas/documents',{headers:headers(a),data:{id,title:'Shared canvas'}})).ok()).toBe(true);return id;}
async function cleanup(request:APIRequestContext,a:Actor){const list=await request.get(api+path,{headers:headers(a)});if(list.ok()){const items=await list.json();if(Array.isArray(items))for(const f of items)expect((await request.delete(api+path+'/'+f.id,{headers:headers(a),data:{revision:f.revision}})).ok()).toBe(true);else console.warn('Cleanup: prior endpoint is not a shared folder list');}for(const endpoint of ['/api/notes','/api/canvas/documents']){const r=await request.get(api+endpoint,{headers:headers(a)});expect(r.ok()).toBe(true);for(const v of await r.json())expect([200,204]).toContain((await request.delete(api+endpoint+'/'+v.id,{headers:headers(a)})).status());}}
async function login(browser:Browser,a:Actor,width=1440,installed=false){const ctx=await browser.newContext({viewport:{width,height:900},...(installed?{userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36 FlownoteAndroid/1.3.1'}:{})});await ctx.addCookies([{name:'__Host-flownote_session',value:a.token,url:web,httpOnly:true,secure:true,sameSite:'Strict'}]);await ctx.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);return ctx;}
async function showTree(p:Page){const b=p.getByRole('button',{name:'탐색기 토글',exact:true});if(await b.getAttribute('aria-expanded')!=='true')await b.click();}

test('shared API is an explicit namespace, canonicalizes UUIDs, enforces owner/CAS, and keeps tombstones without deleting materials',async({request})=>{
 const a=await actor(request),other=await actor(request),id=await seed(request,a),collision=randomUUID();
 try{
  for(const endpoint of ['/api/note-folders','/api/canvas/folders'])expect((await request.post(api+endpoint,{headers:headers(a),data:{id:collision,name:'Same legacy label',category:'Legacy'}})).ok()).toBe(true);
  const f=await create(request,a,collision);expect(f.note_ids).toEqual([]);expect(f.canvas_ids).toEqual([]);
  await member(request,a,f.id,'notes',id.toUpperCase());await member(request,a,f.id,'notes',id.toUpperCase());await member(request,a,f.id,'documents',id.toUpperCase());
  let current=await get(request,a,f.id);expect(current.note_ids).toEqual([id]);expect(current.canvas_ids).toEqual([id]);
  // Legacy create retries must not move members when ON CONFLICT keeps the old row.
  const oldRetry=await request.post(api+'/api/note-folders',{headers:headers(a),data:{id:collision,name:'Ignored retry',category:'',note_ids:[id]}});expect(oldRetry.ok()).toBe(true);expect((await oldRetry.json()).note_ids).toEqual([]);expect((await get(request,a,f.id)).note_ids).toEqual([id]);
  const retry=await request.post(api+path,{headers:headers(a),data:{id:f.id.toUpperCase(),name:f.name,category:f.category,note_ids:[id.toUpperCase(),id],canvas_ids:[id]}});expect(retry.ok()).toBe(true);expect((await retry.json()).revision).toBe(current.revision);
  expect((await request.post(api+path,{headers:headers(a),data:{id:f.id,name:f.name,category:f.category,note_ids:[],canvas_ids:[id]}})).status()).toBe(409);
  for(const endpoint of ['/api/note-folders','/api/canvas/folders']){const list=await(await request.get(api+endpoint,{headers:headers(a)})).json();expect(list.find((v:{id:string})=>v.id===collision)).toMatchObject({name:'Same legacy label',category:'Legacy'});}
  await member(request,a,f.id,'notes',id.toUpperCase(),true);expect((await get(request,a,f.id)).note_ids).toEqual([]);await member(request,a,f.id,'notes',id);
  current=await get(request,a,f.id);expect((await request.patch(api+path+'/'+f.id,{headers:headers(a),data:{name:'Stale',category:'',revision:current.revision-1}})).status()).toBe(409);
  expect((await request.get(api+path+'/'+f.id,{headers:headers(other)})).status()).toBe(404);expect((await request.post(api+path,{headers:headers(other),data:{id:f.id,name:f.name,category:f.category}})).status()).toBe(404);
  expect((await request.get(api+path+'/'+f.id,{headers:{...headers(a),'X-Flownote-Expected-Owner':other.user.id}})).status()).toBe(409);
  expect((await request.get(api+path)).status()).toBe(401);
  const bad=randomUUID();expect((await request.patch(api+path+'/'+f.id,{headers:headers(a),data:{name:'Must rollback',category:'',revision:current.revision,note_ids:[bad]}})).status()).toBe(404);expect(await get(request,a,f.id)).toEqual(current);
  const newID=randomUUID();expect((await request.post(api+path,{headers:headers(a),data:{id:newID,name:'No partial insert',category:'',note_ids:[bad]}})).status()).toBe(404);expect((await request.get(api+path+'/'+newID,{headers:headers(a)})).status()).toBe(404);
  const writes=await Promise.all(['A','B'].map(name=>request.patch(api+path+'/'+f.id,{headers:headers(a),data:{name,category:'CAS',revision:current.revision}})));expect(writes.map(r=>r.status()).sort()).toEqual([200,409]);
  current=await get(request,a,f.id);expect((await request.delete(api+path+'/'+f.id,{headers:headers(a),data:{revision:current.revision}})).ok()).toBe(true);expect((await request.post(api+path,{headers:headers(a),data:{id:f.id,name:f.name,category:f.category}})).status()).toBe(409);
  expect((await request.get(api+'/api/notes/'+id,{headers:headers(a)})).ok()).toBe(true);expect((await(await request.get(api+'/api/canvas/documents',{headers:headers(a)})).json()).some((v:{id:string})=>v.id===id)).toBe(true);
 }finally{for(const endpoint of ['/api/note-folders','/api/canvas/folders'])expect([200,204]).toContain((await request.delete(api+endpoint+'/'+collision,{headers:headers(a)})).status());await cleanup(request,a);await cleanup(request,other);}
});

test('legacy and shared moves serialize before row locks, keep one membership, and failed targets preserve the source',async({request})=>{
 const a=await actor(request),id=await seed(request,a),f=await create(request,a),legacy=randomUUID();
 try{
  expect((await request.post(api+'/api/canvas/folders',{headers:headers(a),data:{id:legacy,name:'Legacy',category:''}})).ok()).toBe(true);
  await member(request,a,f.id,'documents',id);
  const parallel=Array.from({length:12},()=>randomUUID());
  const saturation=await Promise.all(parallel.map(folder=>request.post(api+'/api/canvas/folders',{headers:headers(a),data:{id:folder,name:'Parallel folder',category:'Pool regression',canvas_ids:[id]}})));
  expect(saturation.map(r=>r.status())).toEqual(Array(12).fill(200));
  for(const folder of parallel)expect((await request.delete(api+'/api/canvas/folders/'+folder,{headers:headers(a)})).ok()).toBe(true);
  await member(request,a,f.id,'documents',id);
  for(let i=0;i<4;i++){
   const revision=(await get(request,a,f.id)).revision;
   const r=await Promise.all([request.post(api+`/api/canvas/folders/${legacy}/documents/${id}`,{headers:headers(a)}),request.post(api+path+`/${f.id}/documents/${id}`,{headers:headers(a),data:{revision}})]);
   expect(r[0].status()).toBe(200);expect([200,409]).toContain(r[1].status());
   const common=await get(request,a,f.id),old=await(await request.get(api+'/api/canvas/folders',{headers:headers(a)})).json();expect(Number(common.canvas_ids.includes(id))+Number(old.find((v:{id:string})=>v.id===legacy).canvasIds.includes(id))).toBe(1);
  }
  await member(request,a,f.id,'documents',id);
  expect((await request.post(api+`/api/canvas/folders/${randomUUID()}/documents/${id}`,{headers:headers(a)})).status()).toBe(404);expect((await get(request,a,f.id)).canvas_ids).toEqual([id]);
  expect((await request.patch(api+`/api/canvas/folders/${legacy}`,{headers:headers(a),data:{name:'Renamed legacy',category:'Unrelated'}})).ok()).toBe(true);expect((await get(request,a,f.id)).name).toBe('Shared course');
 }finally{expect([200,204]).toContain((await request.delete(api+'/api/canvas/folders/'+legacy,{headers:headers(a)})).status());await cleanup(request,a);}
});

for(const width of [390,1440])test(`common folders support both file kinds, new creation, category edit in note detail and another device at ${width}px`,async({browser,request})=>{
 test.setTimeout(120000);const a=await actor(request),id=await seed(request,a),ctx=await login(browser,a,width),other=await login(browser,a,820);const p=await ctx.newPage();
 try{
  await p.goto(web+'/canvas');await p.getByRole('button',{name:'새 폴더',exact:true}).click();await p.getByLabel('폴더 이름',{exact:true}).fill('Mixed materials');await p.getByLabel('폴더 카테고리',{exact:true}).fill('Term 1');
  const created=p.waitForResponse(r=>r.url().endsWith(path)&&r.request().method()==='POST');await p.getByRole('button',{name:'폴더 만들기',exact:true}).click();const f:Folder=await(await created).json();
  await showTree(p);await p.getByRole('button',{name:'모든 파일',exact:true}).click();await p.getByLabel('Shared note 이동',{exact:true}).selectOption('shared:'+f.id);await expect.poll(async()=>(await get(request,a,f.id)).note_ids).toContain(id);
  await p.getByLabel('Shared canvas 이동',{exact:true}).selectOption('shared:'+f.id);await expect.poll(async()=>(await get(request,a,f.id)).canvas_ids).toContain(id);
  await showTree(p);await p.locator(`[data-folder="shared:${f.id}"]`).click();const table=p.getByRole('table',{name:'Mixed materials 파일'});await expect(table).toContainText('Shared note');await expect(table).toContainText('Shared canvas');
  const before=p.url();await p.getByRole('button',{name:'새 노트',exact:true}).click();await expect(p).toHaveURL(u=>/\/blog\/.+/.test(u.pathname)&&u.href!==before);const newNote=p.url().split('/').at(-1)!;await expect.poll(async()=>(await get(request,a,f.id)).note_ids).toContain(newNote);
  await showTree(p);await p.getByLabel('Mixed materials 폴더 동작',{exact:true}).click();await p.getByRole('button',{name:'이름·카테고리 변경',exact:true}).click();await p.getByLabel('폴더 카테고리',{exact:true}).fill('Linear algebra');await p.getByLabel('폴더 이름',{exact:true}).fill('Shared revised');await p.getByRole('button',{name:'폴더 저장',exact:true}).click();await expect.poll(async()=>(await get(request,a,f.id)).category).toBe('Linear algebra');
  const p2=await other.newPage();await p2.goto(web+'/canvas');await showTree(p2);await expect(p2.locator(`[data-folder="shared:${f.id}"]`)).toContainText('Shared revised');await p2.locator(`[data-folder="shared:${f.id}"]`).click();await expect(p2.getByRole('table',{name:'Shared revised 파일'})).toContainText('Shared note');await expect(p2.getByRole('table',{name:'Shared revised 파일'})).toContainText('Shared canvas');
  expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await p.screenshot({path:test.info().outputPath('common-folder-note-'+width+'.png'),fullPage:true});
  await p.getByLabel('Shared revised 폴더 동작',{exact:true}).click();p.once('dialog',d=>d.accept());await p.getByRole('button',{name:'폴더만 삭제 (자료 유지)',exact:true}).click();
  await expect.poll(async()=>(await request.get(api+path+'/'+f.id,{headers:headers(a)})).status()).toBe(404);
  await p2.getByRole('button',{name:'목록 새로고침',exact:true}).click();await expect(p2.getByRole('status').filter({hasText:'선택한 공통 폴더를 찾을 수 없습니다.'})).toBeVisible();await expect(p2.locator('[role="row"][data-file-kind]')).toHaveCount(0);
  await p2.getByRole('button',{name:'미분류',exact:true}).click();await expect(p2.getByRole('table',{name:'미분류 파일'})).toContainText('Shared note');await expect(p2.getByRole('table',{name:'미분류 파일'})).toContainText('Shared canvas');expect((await request.get(api+'/api/notes/'+id,{headers:headers(a)})).ok()).toBe(true);

 }finally{await ctx.close();await other.close();await cleanup(request,a);}
});

test('OFF edits common folders and both memberships without traffic, ON persists them on another device with retry after a lost response',async({browser,request})=>{
 test.setTimeout(180000);const a=await actor(request),id=await seed(request,a),f=await create(request,a);await member(request,a,f.id,'notes',id);await member(request,a,f.id,'documents',id);const ctx=await login(browser,a,820,true),p=await ctx.newPage();
 try{
  await p.goto(web+'/settings');p.once('dialog',d=>d.accept());await p.getByRole('switch',{name:'앱 동기화',exact:true}).click();await expect(p.getByRole('switch',{name:'앱 동기화',exact:true})).toHaveAttribute('aria-checked','false');
  const outgoing:string[]=[];const listen=(r:{url:()=>string})=>{if(/\/web-api\/|\.railway\.app/.test(r.url()))outgoing.push(r.url())};p.on('request',listen);
  await p.goto(web+'/canvas');await showTree(p);await p.locator(`[data-folder="shared:${f.id}"]`).click();await p.getByLabel('현재 폴더 동작',{exact:true}).click();await p.getByRole('button',{name:'폴더 이름·카테고리 변경',exact:true}).click();await p.getByLabel('폴더 이름',{exact:true}).fill('Offline shared');await p.getByLabel('폴더 카테고리',{exact:true}).fill('Offline category');await p.getByRole('button',{name:'폴더 저장',exact:true}).click();
  await expect(p.getByRole('heading',{name:'Offline shared',exact:true})).toBeVisible();await p.reload();await showTree(p);await expect(p.locator(`[data-folder="shared:${f.id}"]`)).toContainText('Offline shared');
  await p.getByRole('button',{name:'새 폴더',exact:true}).click();await p.getByLabel('폴더 이름',{exact:true}).fill('Offline destination');await p.getByLabel('폴더 카테고리',{exact:true}).fill('Local category');await p.getByRole('button',{name:'폴더 만들기',exact:true}).click();
  await showTree(p);const local=p.locator('[data-folder^="shared:device-"]').filter({hasText:'Offline destination'});await expect(local).toBeVisible();const key=(await local.getAttribute('data-folder'))!;
  await p.getByRole('button',{name:'모든 파일',exact:true}).click();await p.getByLabel('Shared note 이동',{exact:true}).selectOption(key);await p.getByLabel('Shared canvas 이동',{exact:true}).selectOption(key);
  await p.reload();await showTree(p);await expect(p.locator(`[data-folder="${key}"]`)).toContainText('Offline destination');expect(outgoing).toEqual([]);p.off('request',listen);

  let lost=false;await p.route('**/api/canvas/workspace-folders/'+f.id,async route=>{if(!lost&&route.request().method()==='PATCH'){lost=true;await route.fetch();await route.abort('connectionfailed');}else await route.continue();});
  await p.goto(web+'/settings');p.once('dialog',d=>d.accept());await p.getByRole('switch',{name:'앱 동기화',exact:true}).click();await expect(p.getByRole('alert').filter({hasText:/동기화|기기 자료|네트워크|Network/}).first()).toBeVisible();
  await p.unroute('**/api/canvas/workspace-folders/'+f.id);p.once('dialog',d=>d.accept());await p.getByRole('switch',{name:'앱 동기화',exact:true}).click();await expect(p.getByRole('switch',{name:'앱 동기화',exact:true})).toHaveAttribute('aria-checked','true',{timeout:60000});
  const synced=await get(request,a,f.id);expect(synced.name).toBe('Offline shared');expect(synced.category).toBe('Offline category');expect(synced.note_ids).toEqual([]);expect(synced.canvas_ids).toEqual([]);const all:Folder[]=await(await request.get(api+path,{headers:headers(a)})).json();const destinations=all.filter(v=>v.name==='Offline destination');expect(destinations).toHaveLength(1);expect(destinations[0].category).toBe('Local category');expect(destinations[0].note_ids).toEqual([id]);expect(destinations[0].canvas_ids).toEqual([id]);expect(destinations[0].id).not.toContain('device-');
  const second=await login(browser,a);try{const p2=await second.newPage();await p2.goto(web+'/canvas');await expect(p2.locator(`[data-folder="shared:${f.id}"]`)).toContainText('Offline shared');}finally{await second.close();}
 }finally{await ctx.close();await cleanup(request,a);}
});
