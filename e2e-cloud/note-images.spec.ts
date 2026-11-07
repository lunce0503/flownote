import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createCloudActor,stagingApi as api,stagingWeb as web} from './helpers/accounts';
import {registerNoteImages,file,src,readyImages} from './helpers/note-images';
registerNoteImages('chromium');

test.describe('installed app device images',()=>{
 test.use({userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/134.0.0.0 Mobile Safari/537.36 FlownoteAndroid/1.3.1'});
test('images added in device mode make no network request and survive reload, sync and another device',async({page,request,browser})=>{
 test.setTimeout(180000);const a=await createCloudActor(request),id=randomUUID(),headers={Authorization:'Bearer '+a.token};
 expect((await request.post(api+'/api/notes',{headers,data:{id,title:'Offline image note',content:{format:'markdown',version:1,markdown:'Keep offline original'},revision:1,client_id:randomUUID()}})).ok()).toBe(true);
 await page.context().addCookies([{name:'__Host-flownote_session',value:a.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);
 try{
  await page.goto('/settings');await expect(page.getByRole('switch',{name:'앱 동기화',exact:true})).toBeVisible();page.once('dialog',d=>d.accept());await page.getByRole('switch',{name:'앱 동기화',exact:true}).click();await expect(page.getByRole('switch',{name:'앱 동기화',exact:true})).toHaveAttribute('aria-checked','false');const requests:string[]=[];const listen=(r:{url:()=>string})=>{if(/\/web-api\/|\.railway\.app/.test(r.url()))requests.push(r.url());};page.on('request',listen);
  await page.goto('/blog/'+id);const editor=page.getByRole('textbox',{name:'노트 편집',exact:true});await expect(editor).toContainText('Keep offline original');await page.getByRole('button',{name:'편집 도구',exact:true}).click();await editor.press('ControlOrMeta+End');await editor.press('Enter');await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles(file);await readyImages(page,1);await expect(page.getByTestId('note-save-status')).toHaveText('기기에 저장됨 · 동기화 꺼짐');await page.reload();await readyImages(page,1);expect(requests).toEqual([]);page.off('request',listen);
  await page.goto('/settings');await expect(page.getByRole('switch',{name:'앱 동기화',exact:true})).toBeVisible();page.once('dialog',d=>d.accept());await page.getByRole('switch',{name:'앱 동기화',exact:true}).click();await expect(page.getByRole('switch',{name:'앱 동기화',exact:true})).toHaveAttribute('aria-checked','true',{timeout:60000});await expect.poll(async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.markdown).toContain(src);
  const other=await browser.newContext();try{await other.addCookies([{name:'__Host-flownote_session',value:a.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);await other.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);const p=await other.newPage();await p.goto(web+'/blog/'+id);await readyImages(p,1);}finally{await other.close();}
 }finally{expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);}
});

});
