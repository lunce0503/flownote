import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudActor, stagingApi as api, stagingWeb as web } from './accounts';

type Actor = Awaited<ReturnType<typeof createCloudActor>>;
const initializedPages = new WeakSet<Page>();
async function session(page:Page,actor:Actor) {
  await page.context().clearCookies();
  await page.context().addCookies([
    {name:'__Host-flownote_session',value:actor.token,url:web,httpOnly:true,secure:true,sameSite:'Strict'},
    {name:'__Host-flownote_test_actor',value:encodeURIComponent(JSON.stringify(actor.user)),url:web,secure:true,sameSite:'Strict'},
  ]);
  if (!initializedPages.has(page)) {
    // Multiple addInitScripts have no ordering guarantee. One script reads the
    // current synthetic actor, so reload/account switches cannot replay actor A.
    await page.addInitScript(()=>{
      const value=document.cookie.split('; ').find(cookie=>cookie.startsWith('__Host-flownote_test_actor='))?.split('=').slice(1).join('=');
      if(value)localStorage.setItem('flownote_auth_user',decodeURIComponent(value));
    });
    initializedPages.add(page);
  }
}
async function createCanvas(request:APIRequestContext,actor:Actor) {
  const r=await request.post(api+'/api/canvas/documents',{headers:{Authorization:'Bearer '+actor.token},data:{title:'Synthetic canvas safety'}});
  expect(r.ok()).toBe(true);return (await r.json()).id as string;
}
async function seed(page:Page,name:string,id:string,draft:unknown) {
  await page.evaluate(async({name,id,draft})=>new Promise<void>((resolve,reject)=>{
    const r=indexedDB.open(name,1);
    r.onupgradeneeded=()=>{for(const store of ['drafts','operations']) if(!r.result.objectStoreNames.contains(store))r.result.createObjectStore(store);};
    r.onerror=()=>reject(r.error);
    r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft,id);tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error);};};
  }),{name,id,draft});
}
async function fileAction(page:Page,name:string) {
  const button=page.getByRole('button',{name,exact:true});
  if(await button.count() && await button.first().isVisible()) await button.first().click();
  else {await page.getByRole('button',{name:'파일 동작',exact:true}).click();await page.getByRole('menuitem',{name,exact:true}).click();}
}
async function cleanup(request:APIRequestContext,actor:Actor,ids:string[]) {
  for(const id of ids) expect((await request.delete(api+'/api/canvas/documents/'+id,{headers:{Authorization:'Bearer '+actor.token}})).ok()).toBe(true);
  expect((await request.post(api+'/api/users/logout',{headers:{Authorization:'Bearer '+actor.token}})).ok()).toBe(true);
}

export function registerCanvasSafety(engine:'chromium'|'webkit') {
  test.describe(`canvas persistence safety ${engine}`,()=>{
    test.use({viewport:{width:engine==='webkit'?820:1440,height:1000},hasTouch:engine==='webkit'});

    test('a different account cannot restore owned or unowned legacy drafts after denied load',async({page,request})=>{
      const a=await createCloudActor(request),b=await createCloudActor(request),id=await createCanvas(request,a);
      try {
        await session(page,a);await page.goto(web+'/canvas');
        const draft={ownerId:a.user.id,lines:[{id:randomUUID(),points:[{x:30,y:30},{x:90,y:90}],color:'#000000',strokeWidth:2,status:'new'}],images:[],textBoxes:[],updatedAt:Date.now(),hasPendingChanges:true,baseRevision:0};
        await seed(page,'flownote-canvas-cloud:'+a.user.id,id,draft);
        await seed(page,'flownote-canvas',id,{...draft,ownerId:undefined});
        await session(page,b);await page.goto(web+'/canvas/'+id);
        await expect(page.locator('[data-testid="canvas-save-status"]:visible')).toHaveAttribute('data-save-state','failed');
        await expect(page.getByTestId('canvas-render-surface')).toHaveAttribute('data-visible-line-count','0');
        const own=await page.evaluate(({id,owner})=>new Promise(resolve=>{const r=indexedDB.open('flownote-canvas-cloud:'+owner);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readonly'),get=tx.objectStore('drafts').get(id);get.onsuccess=()=>{resolve(get.result??null);db.close();};};}),{id,owner:b.user.id});
        expect(own).toBe(null);
      } finally {await page.close();await cleanup(request,a,[id]);await cleanup(request,b,[]);}
    });

    test('conflicting draft stays blocked across save, flush and reload and recovers into a separate canvas',async({page,request})=>{
      const actor=await createCloudActor(request),id=await createCanvas(request,actor),ids=[id],headers={Authorization:'Bearer '+actor.token};
      try {
        const box={id:randomUUID(),x:20,y:20,width:240,height:80,text:'Remote current content'};
        expect((await request.post(api+'/api/canvas/save',{headers,data:{canvasId:id,mutationId:randomUUID(),payload:{addedTextBoxes:[box]}}})).ok()).toBe(true);
        const data=await(await request.get(api+'/api/canvas/metadata?canvasId='+id,{headers})).json();
        expect(Number.isSafeInteger(data.revision)).toBe(true);
        expect(data.revision).toBeGreaterThan(0);
        await session(page,actor);await page.goto(web+'/canvas');
        const base=Math.max(0,data.revision-1);
        await seed(page,'flownote-canvas-cloud:'+actor.user.id,id,{ownerId:actor.user.id,lines:[],images:[],textBoxes:[{...box,text:'Local pending content',status:'modified'}],updatedAt:Date.now(),hasPendingChanges:true,baseRevision:base});
        let originalWrites=0;
        page.on('request',r=>{if(r.method()==='POST' && r.postData()?.includes(id) && (r.url().includes('/api/canvas/save') || r.postData()?.includes('canvas:save')))originalWrites++;});
        await page.goto(web+'/canvas/'+id);await expect(page.locator('[data-testid="canvas-save-status"]:visible')).toHaveAttribute('data-save-state','conflict');
        await fileAction(page,'캔버스 저장');await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await page.waitForTimeout(1800);
        expect(originalWrites).toBe(0);
        await page.reload();await expect(page.locator('[data-testid="canvas-save-status"]:visible')).toHaveAttribute('data-save-state','conflict');
        await fileAction(page,'초안을 새 캔버스로 복구');
        await expect.poll(()=>new URL(page.url()).pathname).not.toBe('/canvas/'+id);
        const copyId=new URL(page.url()).pathname.split('/').at(-1)!;ids.push(copyId);
        await expect(page.locator('[data-testid="canvas-save-status"]:visible')).toHaveAttribute('data-save-state','saved');
        const original=await(await request.get(api+'/api/canvas/load?canvasId='+id,{headers})).json();
        const copy=await(await request.get(api+'/api/canvas/load?canvasId='+copyId,{headers})).json();
        expect(original.textBoxes.find((v:{id:string})=>v.id===box.id).text).toBe('Remote current content');
        expect(copy.textBoxes.find((v:{id:string})=>v.id===box.id).text).toBe('Local pending content');
        expect(originalWrites).toBe(0);
      } finally {await page.close();await cleanup(request,actor,ids);}
    });

    test('aborted IndexedDB draft writes surface a failure instead of reporting durable storage',async({page,request})=>{
      const actor=await createCloudActor(request),id=await createCanvas(request,actor);
      try {
        await session(page,actor);await page.goto(web+'/canvas/'+id);
        await expect(page.getByTestId('canvas-input-surface')).toHaveAttribute('data-ready','true');
        await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){const r=original.apply(this,args);if(this.name==='drafts')r.addEventListener('success',()=>this.transaction.abort());return r;};});
        await page.context().setOffline(true);
        const surface=page.getByTestId('canvas-input-surface'),box=await surface.boundingBox();expect(box).not.toBe(null);
        await page.mouse.move(box!.x+320,box!.y+420);await page.mouse.down();await page.mouse.move(box!.x+370,box!.y+450,{steps:5});await page.mouse.up();
        await expect(page.getByTestId('canvas-render-surface')).not.toHaveAttribute('data-visible-line-count','0');
        await expect(page.locator('[data-testid="canvas-save-status"]:visible')).toHaveAttribute('aria-label',/기기 초안 저장 실패/);
        const persisted=await page.evaluate(({owner,id})=>new Promise(resolve=>{const r=indexedDB.open('flownote-canvas-cloud:'+owner);r.onsuccess=()=>{const db=r.result,tx=db.transaction('drafts','readonly'),get=tx.objectStore('drafts').get(id);get.onsuccess=()=>{resolve(get.result??null);db.close();};};}),{owner:actor.user.id,id});
        expect(persisted).toBe(null);
      } finally {await page.close();await cleanup(request,actor,[id]);}
    });
  });
}
