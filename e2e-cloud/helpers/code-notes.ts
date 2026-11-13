import {test, expect, type Page, type APIRequestContext} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createCloudActor, stagingApi as api, stagingWeb as web} from './accounts';
import {codeFileBytes, newCodeContent, type CodeLanguage} from '../../src/entities/blog/model/codeFiles';

const samples: {language: CodeLanguage; extension: string; text: string}[] = [
  {language:'json',extension:'json',text:'{\r\n  "hello": "한글"\r\n}\r\n'},
  {language:'python',extension:'py',text:'def hello():\n    return "한글"\n'},
  {language:'rust',extension:'rs',text:'fn main() {\n    println!("한글");\n}\n'},
  {language:'typescript',extension:'ts',text:'const count: number = 1;\n'},
  {language:'javascript',extension:'js',text:'function hello() { return "한글"; }\n'},
  {language:'java',extension:'java',text:'class Main {\n    String value = "한글";\n}\n'},
  {language:'html',extension:'html',text:'<script>window.codeFileExecuted = true</script>\n'},
];
const editor = (page: Page) => page.getByRole('textbox',{name:'코드 편집기',exact:true});
async function codeTool(page: Page, name: string) {
  const button = page.getByRole('button', {name, exact:true});
  if (!await button.isVisible()) await page.getByLabel('코드 편집 도구 더보기', {exact:true}).click();
  await button.click();
}
export async function importCodeNote(page: Page, name: string, bytes: Uint8Array) {
  const previous = page.url();
  await page.getByLabel('코드 파일 선택',{exact:true}).setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(bytes)});
  await expect.poll(()=>page.url()).not.toBe(previous);
  await expect(editor(page)).toBeVisible();
  return new URL(page.url()).pathname.split('/').at(-1)!;
}
export async function replaceCode(page: Page, text: string) {
  await editor(page).click();
  const apple = await page.evaluate(() => /Mac/.test(navigator.platform) || /Apple Computer/.test(navigator.vendor) && /Mobile\//.test(navigator.userAgent));
  await editor(page).press(apple ? 'Meta+a' : 'Control+a');
  await page.keyboard.insertText(text.replaceAll('\r\n', '\n'));
}
async function actorPage(page: Page, request: APIRequestContext) {
  const actor = await createCloudActor(request);
  await page.context().addCookies([{name:'__Host-flownote_session',value:actor.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);
  await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),actor.user);
  await page.goto('/blog'); await page.getByRole('button',{name:'코드 파일 가져오기',exact:true}).waitFor();
  return actor;
}
async function cleanup(request: APIRequestContext, token: string, ids: string[]) {
  const headers={Authorization:'Bearer '+token};
  for(const id of ids) expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);
  expect((await request.post(api+'/api/users/logout-all',{headers})).status()).toBe(204);
}

export function registerCodeNotes(engine: string) {
  test(`code files ${engine}: import, edit, persist and export the original language, name and bytes`,async({page,request})=>{
    test.setTimeout(180000);
    const actor=await actorPage(page,request),headers={Authorization:'Bearer '+actor.token},ids:string[]=[];
    try {
      for(const [index,sample] of samples.entries()) {
        const name=`code-${randomUUID().slice(0,6)}.${sample.extension}`;
        const encoding=index===0?'utf-8-bom':index===1?'utf-16le':'utf-8';
        const original=newCodeContent(sample.language,sample.text,encoding);
        const id=await importCodeNote(page,name,codeFileBytes(original));ids.push(id);
        await expect(page.getByTestId('note-code-editor')).toHaveAttribute('data-language',sample.language);
        await expect(page.getByLabel('노트 제목',{exact:true})).toHaveValue(name);
        await expect(page.locator('.cm-lineNumbers')).toBeVisible();
        expect(await page.evaluate(()=>('codeFileExecuted' in window))).toBe(false);
        const created=await(await request.get(api+'/api/notes/'+id,{headers})).json();
        expect(created.content).toEqual(original);
        const updatedText=sample.text+' ';
        await replaceCode(page,updatedText);
        await expect.poll(async()=> (await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.text).toBe(updatedText);
        await page.reload();await expect(editor(page)).toBeVisible();
        const loaded=await(await request.get(api+'/api/notes/'+id,{headers})).json();
        expect(loaded.content.text).toBe(updatedText);expect(loaded.content.encoding).toBe(encoding);
        await page.getByLabel('노트 세부 설정',{exact:true}).click();
        const pending=page.waitForEvent('download');await page.getByRole('button',{name:'파일 내보내기',exact:true}).click();
        const download=await pending;expect(download.suggestedFilename()).toBe(name);
        const stream=await download.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
        expect(Buffer.concat(chunks)).toEqual(Buffer.from(codeFileBytes({...original,text:updatedText})));
        const summaries=await(await request.get(api+'/api/notes?view=summary',{headers})).json();
        const summary=summaries.notes.find((item:{id:string})=>item.id===id);expect(summary.content_format).toBe('code');expect(summary.content).toBeUndefined();
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    } finally {await cleanup(request,actor.token,ids);}
  });

  test(`code files ${engine}: create JSON, format, search and recover save conflicts without losing the draft`,async({page,request})=>{
    test.setTimeout(120000);
    const actor=await actorPage(page,request),headers={Authorization:'Bearer '+actor.token},ids:string[]=[];
    try {
      await page.goto('/canvas');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.getByRole('button',{name:'새 코드 파일',exact:true}).click();
      const dialog=page.getByRole('dialog',{name:'새 코드 파일',exact:true});
      await dialog.getByLabel('파일 이름',{exact:true}).fill('new-code.json');await dialog.getByRole('button',{name:'만들기',exact:true}).click();
      await expect(editor(page)).toBeVisible();const id=new URL(page.url()).pathname.split('/').at(-1)!;ids.push(id);
      await replaceCode(page,'{"a":1,"b":2}');await codeTool(page,'JSON 정렬');
      await expect.poll(async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.text).toContain('\n');
      await codeTool(page,'검색·바꾸기');await page.getByLabel('검색',{exact:true}).fill('"a"');await page.getByLabel('바꾸기',{exact:true}).fill('"renamed"');await page.getByRole('button',{name:'모두 바꾸기',exact:true}).click();
      await expect.poll(async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.text).toContain('"renamed"');
      await page.route('**/web-api/api/notes',route=>route.request().method()==='POST'?route.fulfill({status:409,contentType:'application/json',body:'{"error":"Synthetic revision conflict"}'}):route.continue());
      await replaceCode(page,'{"draft":"기기 보존"}');await expect(page.getByTestId('note-save-status')).toContainText('충돌');
      const server=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(server.content.text).toContain('"renamed"');
      await page.reload();await expect(page.getByRole('button',{name:'초안 복구',exact:true})).toBeVisible();
      await page.unroute('**/web-api/api/notes');page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'초안 복구',exact:true}).click();
      await expect.poll(async()=>(await(await request.get(api+'/api/notes/'+id,{headers})).json()).content.text).toBe('{"draft":"기기 보존"}');
      const before=(await(await request.get(api+'/api/notes?view=summary',{headers})).json()).notes.length;
      await page.getByLabel('코드 파일 선택',{exact:true}).setInputFiles({name:'binary.py',mimeType:'application/octet-stream',buffer:Buffer.from([0,1,2])});
      await expect(page.getByRole('alert').filter({hasText:'바이너리'})).toBeVisible();
      expect((await(await request.get(api+'/api/notes?view=summary',{headers})).json()).notes.length).toBe(before);
    } finally {await cleanup(request,actor.token,ids);}
  });

  test(`code files ${engine}: Android-style DOM newlines retain the imported CRLF source`, async ({ page, request }) => {
    const actor = await actorPage(page, request);
    const headers = { Authorization: 'Bearer ' + actor.token };
    const ids: string[] = [];
    const original = 'let a = 1;\r\nlet b = 2;';
    try {
      const id = await importCodeNote(page, 'dom-newline.js', codeFileBytes(newCodeContent('javascript', original, 'utf-16le')));
      ids.push(id);
      await editor(page).click();
      await editor(page).press('ControlOrMeta+End');
      await page.evaluate(() => {
        const content = document.querySelector('.cm-content')!;
        const line = content.querySelector('.cm-line:last-child')!;
        const node = document.createTextNode('\n');
        line.append(node);
        getSelection()!.setBaseAndExtent(node, 1, node, 1);
        content.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: '\n', bubbles: true }));
      });
      await expect.poll(async () => (await (await request.get(api + '/api/notes/' + id, { headers })).json()).content.text)
        .toBe(original + '\r\n');
      const language = page.getByLabel('코드 언어', { exact: true });
      if (!await language.isVisible()) await page.getByLabel('코드 편집 도구 더보기', { exact: true }).click();
      await language.selectOption('typescript');
      await expect.poll(async () => (await (await request.get(api + '/api/notes/' + id, { headers })).json()).content.language)
        .toBe('typescript');
      expect((await (await request.get(api + '/api/notes/' + id, { headers })).json()).content.text).toBe(original + '\r\n');
      await page.reload();
      await expect(editor(page)).toBeVisible();
      expect((await (await request.get(api + '/api/notes/' + id, { headers })).json()).content.encoding).toBe('utf-16le');
    } finally {
      await cleanup(request, actor.token, ids);
    }
  });
}
