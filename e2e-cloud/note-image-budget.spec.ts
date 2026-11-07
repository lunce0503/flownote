import {test,expect} from '@playwright/test';
import {randomUUID,createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {createCloudActor,stagingApi as api,stagingWeb as web} from './helpers/accounts';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const crc32=(b:Buffer)=>{let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
function chunk(name:string,data:Buffer){const t=Buffer.from(name),n=Buffer.alloc(4),crc=Buffer.alloc(4);n.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));return Buffer.concat([n,t,data,crc]);}
function largePng(){const width=1024,height=680,raw=Buffer.alloc((width*3+1)*height);let seed=0x12345678;for(let y=0;y<height;y++)for(let x=1;x<=width*3;x++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;raw[y*(width*3+1)+x]=seed&255;}const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',h),chunk('IDAT',deflateSync(raw,{level:1})),chunk('IEND',Buffer.alloc(0))]);}
const png=largePng(),src='data:image/png;base64,'+png.toString('base64');
for(const kind of ['preserved legacy','legacy image conversion'])test(kind+' counts full saved JSON and rejects oversized duplication without changing the original',async({page,request})=>{
 test.setTimeout(150000);const a=await createCloudActor(request),id=randomUUID(),headers={Authorization:'Bearer '+a.token},legacy=kind==='preserved legacy'?[{type:'paragraph',content:'legacy'.repeat(350000)}]:[{type:'image',props:{url:src,caption:'Preserve embedded original'}}];
 expect((await request.post(api+'/api/notes',{headers,data:{id,title:'Synthetic full payload',content:legacy,revision:1,client_id:randomUUID()}})).ok()).toBe(true);
 try{
  if(kind==='preserved legacy')expect((await request.post(api+'/api/notes',{headers,data:{id,title:'Synthetic full payload',content:{format:'markdown',version:1,markdown:'Preserve current text'},revision:2,client_id:randomUUID()}})).ok()).toBe(true);
  const before=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(hash(kind==='preserved legacy'?before.content.legacy_original:before.content)).toBe(hash(legacy));
  await page.context().addCookies([{name:'__Host-flownote_session',value:a.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),a.user);await page.goto(web+'/blog/'+id);
  const posts:string[]=[];page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/notes'))posts.push('POST');});
  if(kind==='preserved legacy'){
   await expect(page.getByRole('textbox',{name:'노트 편집',exact:true})).toContainText('Preserve current text');await page.getByRole('button',{name:'편집 도구',exact:true}).click();
   for(const mode of ['live','source']){
    if(mode==='source')await page.getByRole('button',{name:'원문',exact:true}).click();
    await page.getByLabel('노트 이미지 파일',{exact:true}).setInputFiles({name:'near-limit.png',mimeType:'image/png',buffer:png});await expect(page.getByRole('alert').filter({hasText:'원본과 메타데이터'})).toBeVisible();
    const after=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(after.revision).toBe(before.revision);expect(hash(after.content)).toBe(hash(before.content));
   }
  }else{
   await expect(page.getByRole('button',{name:'원본 보관 후 Markdown으로 전환',exact:true})).toBeVisible();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'원본 보관 후 Markdown으로 전환',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'원본과 메타데이터'})).toBeVisible();
   await expect(page.getByRole('button',{name:'원본 보관 후 Markdown으로 전환',exact:true})).toBeVisible();
  }
  expect(posts).toEqual([]);const after=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(after.revision).toBe(before.revision);expect(hash(after.content)).toBe(hash(before.content));
 }finally{expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);expect((await request.get(api+'/api/notes/'+id,{headers})).status()).toBe(404);}
});
