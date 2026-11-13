import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudActor, stagingApi as api, stagingWeb as web } from './helpers/accounts';
import { noteTouchDriver } from './helpers/note-mobile-tools';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 900 }, userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/124.0.0.0 Mobile Safari/537.36 FlownoteAndroid/1.3.2' });

test('mobile code uses compact header and stable full-width text zoom, selection and settings', async ({ page, request }) => {
  const actor = await createCloudActor(request), id = randomUUID(), headers = { Authorization: 'Bearer '+actor.token };
  const text = 'alpha bravo charlie\n'+Array.from({length:60},(_,i)=>`line${i}`).join('\n');
  expect((await request.post(api+'/api/notes',{headers,data:{id,title:'synthetic-long-filename.ts',content:{format:'code',version:1,text,language:'typescript',encoding:'utf-8'},revision:1,client_id:randomUUID()}})).ok()).toBe(true);
  try {
    await page.context().addCookies([{name:'__Host-flownote_session',value:actor.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);
    await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),actor.user);
    await page.goto(web+'/blog/'+id); const editor=page.getByRole('textbox',{name:'코드 편집기',exact:true});await expect(editor).toBeVisible();
    await expect(page.getByRole('navigation',{name:'앱 기능',exact:true})).toBeHidden();
    expect((await page.locator('.note-document-heading').boundingBox())!.height).toBeLessThanOrEqual(60);
    await page.getByRole('button',{name:'파일 탐색기 열기',exact:true}).click();await expect(page.getByRole('dialog',{name:'노트 탐색기'})).toBeVisible();
    await page.keyboard.press('Escape');
    const width=(await page.locator('.cm-editor').boundingBox())!.width;
    for(const action of ['노트 축소','노트 확대율 초기화','노트 확대']) {
      await page.getByRole('button',{name:action,exact:true}).click();
      await expect.poll(async()=>Math.abs((await page.locator('.cm-editor').boundingBox())!.width-width)).toBeLessThan(2);
    }
    await page.getByLabel('코드 편집 도구 더보기',{exact:true}).click();await page.getByLabel('들여쓰기 너비',{exact:true}).selectOption('8');await page.getByLabel('코드 편집 도구 더보기',{exact:true}).click();
    const touch=await noteTouchDriver(page,'chromium');
    for(let pass=0;pass<3;pass++) {
      await page.getByRole('button',{name:'노트 올가미',exact:true}).click();await page.getByRole('button',{name:'노트 편집',exact:true}).click();
      const box=(await editor.boundingBox())!,point={x:box.x+25,y:box.y+15,id:1};
      await touch('touchStart',[point]);await touch('touchEnd',[]);await expect(editor).toBeFocused();
    }
    const stored=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(stored.content.text).toBe(text);expect(stored.revision).toBe(1);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.goto(web+'/canvas');await expect(page.getByRole('navigation',{name:'앱 기능',exact:true})).toBeVisible();
  } finally { await request.delete(api+'/api/notes/'+id,{headers});await request.post(api+'/api/users/logout-all',{headers}); }
});

test('reconnect revalidates revision without false review and resumes pending saves', async ({page,request})=>{
  test.setTimeout(120000);
  const actor=await createCloudActor(request),id=randomUUID(),headers={Authorization:'Bearer '+actor.token};
  expect((await request.post(api+'/api/notes',{headers,data:{id,title:'Reconnect.ts',content:{format:'code',version:1,text:'before',language:'typescript'},revision:1,client_id:randomUUID()}})).ok()).toBe(true);
  try {
    await page.context().addCookies([{name:'__Host-flownote_session',value:actor.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);
    await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),actor.user);
    await page.goto(web+'/blog/'+id);const editor=page.getByRole('textbox',{name:'코드 편집기',exact:true});await expect(editor).toBeVisible();
    await page.waitForResponse(response=>response.url().includes('socket.io')&&response.status()===200);
    await page.context().setOffline(true);await editor.press('ControlOrMeta+a');await page.keyboard.insertText('offline local change');
    await expect(page.getByTestId('note-save-status')).toContainText('저장 실패');
    await page.context().setOffline(false);
    await expect.poll(async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.text,{timeout:30000}).toBe('offline local change');
    await expect(page.getByRole('alert').filter({hasText:'다른 창의 변경'})).toHaveCount(0);
    await page.reload();await expect(editor).toHaveText('offline local change');
    const current=await(await request.get(api+'/api/notes/'+id,{headers})).json();
    await page.route('**/api/notes',async route=>{if(route.request().method()==='POST')await route.abort();else await route.continue();});
    await editor.press('ControlOrMeta+a');await page.keyboard.insertText('preserve this local draft');await expect(page.getByTestId('note-save-status')).toContainText('저장 실패');
    expect((await request.post(api+'/api/notes',{headers,data:{...current,content:{...current.content,text:'real remote change'},revision:current.revision+1,client_id:randomUUID()}})).ok()).toBe(true);
    await page.context().setOffline(true);await page.waitForTimeout(1500);await page.context().setOffline(false);
    await expect(page.getByRole('alert').filter({hasText:'다른 창의 변경'})).toBeVisible({timeout:30000});
    await expect(editor).toHaveText('preserve this local draft');
    const saved=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(saved.content.text).toBe('real remote change');
    await page.getByLabel('노트 세부 설정',{exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'파일 내보내기',exact:true}).click();expect((await download).suggestedFilename()).toBe('Reconnect.ts');
  } finally { await page.context().setOffline(false);await request.delete(api+'/api/notes/'+id,{headers});await request.post(api+'/api/users/logout-all',{headers}); }
});
