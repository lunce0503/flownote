import {test,expect,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createCloudActor,stagingApi as api,stagingWeb as web} from './accounts';

const base64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const file={name:'diagram [one].png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')};
const src='data:image/png;base64,'+base64;
const images=(p:Page)=>p.getByTestId('markdown-live-editor').locator('img');
async function readyImages(p:Page,count:number){await expect(images(p)).toHaveCount(count);await expect.poll(()=>images(p).evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).naturalWidth===1))).toBe(true);}
async function transfer(p:Page,kind:'paste'|'drop'){
 await p.getByRole('textbox',{name:'노트 편집',exact:true}).evaluate(async(node,{base64,kind})=>{
  // Native keyboard selectionchange is asynchronous. The synthetic paste below
  // does not get the browser's input-event sequencing, so wait for selection sync.
  if(kind==='paste')await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0)),dt=new DataTransfer();dt.items.add(new File([bytes],'pasted.png',{type:'image/png'}));
  const r=node.getBoundingClientRect();node.dispatchEvent(kind==='paste'?new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}):new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true,clientX:r.x+8,clientY:r.y+8}));
 },{base64,kind});
}
export function registerNoteImages(engine:'chromium'|'webkit'){test.describe(`note image restoration ${engine}`,()=>{
 test.use({viewport:{width:engine==='chromium'?1440:390,height:1000}});
 test('file, clipboard, drop, source and preview preserve images and text across save/reload without unsafe formats',async({page,request,browser})=>{
  test.setTimeout(150000);const a=await createCloudActor(request),id=randomUUID(),headers={Authorization:'Bearer '+a.token};
  expect((await request.post(api+'/api/notes',{headers,data:{id,title:'Synthetic image note',content:{format:'markdown',version:1,markdown:'Before\n\nAfter'},revision:1,client_id:randomUUID()}})).ok()).toBe(true);
  await page.context().addCookies([{name:'__Host-flownote_session',value:a.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);
  const saved=async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.markdown as string;
  try{
   await page.goto('/blog/'+id);const editor=page.getByRole('textbox',{name:'노트 편집',exact:true});await expect(editor).toContainText('Before');await page.getByRole('button',{name:'편집 도구',exact:true}).click();
   await expect(page.getByRole('button',{name:'이미지 추가',exact:true})).toBeVisible();await editor.press('ControlOrMeta+End');await editor.press('Enter');
   await page.evaluate(()=>{const original=HTMLImageElement.prototype.decode;Object.assign(window,{releaseNoteImage:null});HTMLImageElement.prototype.decode=function(){const image=this;return new Promise<void>((resolve,reject)=>{Object.assign(window,{releaseNoteImage:()=>{HTMLImageElement.prototype.decode=original;original.call(image).then(resolve,reject);}});});};});
   await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles(file);
   await expect.poll(()=>page.evaluate(()=>typeof (window as Window&{releaseNoteImage?:unknown}).releaseNoteImage)).toBe('function');
   await editor.pressSequentially(' preserved while reading');await page.evaluate(()=>{(window as Window&{releaseNoteImage?:()=>void}).releaseNoteImage?.();});await readyImages(page,1);await expect(editor).toContainText('preserved while reading');
   await editor.press('ControlOrMeta+z');await expect(images(page)).toHaveCount(0);await editor.press('ControlOrMeta+Shift+z');await readyImages(page,1);
   await editor.press('ControlOrMeta+End');await transfer(page,'paste');await readyImages(page,2);await transfer(page,'drop');await readyImages(page,3);
   await expect.poll(saved).toContain(src);await expect.poll(async()=>((await saved()).match(/data:image\/png;base64,/g)||[]).length).toBe(3);
   const before=await saved();await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')});await expect(page.getByRole('alert').filter({hasText:'PNG, JPEG, WebP, GIF'})).toBeVisible();expect(await saved()).toBe(before);
   await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles({name:'bad.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])});await expect(page.getByRole('alert').filter({hasText:'손상'})).toBeVisible();expect(await saved()).toBe(before);
   await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles({name:'oversize.png',mimeType:'image/png',buffer:Buffer.alloc(2*1024*1024+1)});await expect(page.getByRole('alert').filter({hasText:'2MiB'})).toBeVisible();expect(await saved()).toBe(before);
   await page.reload();await readyImages(page,3);await expect(editor).toContainText('Before');await expect(editor).toContainText('After');await expect(page.getByTestId('markdown-live-editor').locator('img[onerror]')).toHaveCount(0);
   await page.getByRole('button',{name:'미리보기',exact:true}).click();const preview=page.getByTestId('markdown-preview');await expect(preview.locator('img')).toHaveCount(3);await expect.poll(()=>preview.locator('img').evaluateAll(nodes=>nodes.every(n=>(n as HTMLImageElement).naturalWidth===1))).toBe(true);
   await page.getByRole('button',{name:'편집',exact:true}).click();await page.getByRole('button',{name:'편집 도구',exact:true}).click();await page.getByRole('button',{name:'원문',exact:true}).click();const source=page.getByRole('textbox',{name:'Markdown 본문',exact:true});await source.press('ControlOrMeta+End');await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles(file);await expect(source).toHaveValue(/data:image\/png;base64,/);await expect.poll(async()=>((await saved()).match(/data:image\/png;base64,/g)||[]).length).toBe(4);
   await page.getByRole('button',{name:'실시간 편집',exact:true}).click();await readyImages(page,4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
   const other=await browser.newContext();try{await other.addCookies([{name:'__Host-flownote_session',value:a.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);await other.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);const p=await other.newPage();await p.goto(web+'/blog/'+id);await readyImages(p,4);}finally{await other.close();}
   await page.getByLabel('노트 세부 설정',{exact:true}).click();const pending=page.waitForEvent('download');await page.getByRole('button',{name:'.md 내보내기',exact:true}).click();const download=await pending,stream=await download.createReadStream();let text='';for await(const chunk of stream!)text+=chunk.toString();expect(text).toBe(await saved());
  }finally{expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);}
 });
});


}
export {file,src,readyImages};
