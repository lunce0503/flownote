import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createCloudActor,stagingApi as api,stagingWeb as web} from './helpers/accounts';
import {importCodeNote} from './helpers/code-notes';
import {newCodeContent,codeFileBytes} from '../src/entities/blog/model/codeFiles';
import {parseExport} from '../../flownote-mobile/lib/web-shell-policy';

test.use({browserName:'webkit'});

test('iOS code export keeps code extensions and exact UTF-8/UTF-16 bytes through the real bounded receiver policy',async({browser,request})=>{
  test.setTimeout(120000);
  const actor=await createCloudActor(request),headers={Authorization:'Bearer '+actor.token},ids:string[]=[];
  const context=await browser.newContext({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 FlownoteIOS/1.3.0'});
  await context.addCookies([{name:'__Host-flownote_session',value:actor.token,url:web,httpOnly:true,secure:true,sameSite:'Strict'}]);
  await context.addInitScript(user=>{localStorage.setItem('flownote_auth_user',JSON.stringify(user));Object.assign(window,{codeExports:[],ReactNativeWebView:{postMessage:(raw:string)=>(window as unknown as {codeExports:string[]}).codeExports.push(raw)}});},actor.user);
  const page=await context.newPage();
  try{
    await page.goto(web+'/blog');
    for(const [language,extension,encoding] of [['python','py','utf-16be'],['rust','rs','utf-8-bom'],['json','jsonc','utf-8']] as const){
      const name=`source-${randomUUID().slice(0,6)}.${extension}`,content=newCodeContent(language,'한글\r\n',encoding),bytes=codeFileBytes(content);
      ids.push(await importCodeNote(page,name,bytes));
      await page.getByLabel('노트 세부 설정',{exact:true}).click();await page.getByRole('button',{name:'파일 내보내기',exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>(window as unknown as {codeExports:string[]}).codeExports.length)).toBeGreaterThan(0);
      const raw=await page.evaluate(()=>(window as unknown as {codeExports:string[]}).codeExports.pop()!);
      const received=parseExport(raw,page.url(),web);expect(received.name).toBe(name);expect(Buffer.from(received.base64,'base64')).toEqual(Buffer.from(bytes));
    }
  }finally{await context.close();for(const id of ids)expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);expect((await request.post(api+'/api/users/logout-all',{headers})).status()).toBe(204);}
});
