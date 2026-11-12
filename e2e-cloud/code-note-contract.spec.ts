import {test,expect} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createCloudActor,stagingApi as api} from './helpers/accounts';

test('code note API preserves the typed source contract and blocks owner, format and revision replacement',async({request})=>{
  const actor=await createCloudActor(request),other=await createCloudActor(request),id=randomUUID(),client_id=randomUUID(),headers={Authorization:'Bearer '+actor.token};
  const content={format:'code',version:1,text:'fn main() {}\r\n',language:'rust',encoding:'utf-8-bom'};
  try{
    const create=await request.post(api+'/api/notes',{headers,data:{id,title:'main.rs',content,revision:1,client_id}});expect(create.ok(),`HTTP ${create.status()}`).toBe(true);
    const retry=await request.post(api+'/api/notes',{headers,data:{id,title:'main.rs',content,revision:1,client_id}});expect(retry.ok()).toBe(true);
    for(const invalid of [[],{format:'markdown',version:1,markdown:'old'}])expect((await request.post(api+'/api/notes',{headers,data:{id,title:'old',content:invalid,revision:2,client_id}})).status()).toBe(409);
    expect((await request.post(api+'/api/notes',{headers,data:{id,title:'main.rs',content:{...content,text:'changed'},revision:1,client_id}})).status()).toBe(409);
    expect((await request.post(api+'/api/notes',{headers,data:{id,title:'main.rs',content,revision:3,client_id}})).status()).toBe(409);
    expect((await request.post(api+'/api/notes',{headers,data:{id:randomUUID(),title:'bad.rs',content:{...content,encoding:'binary'},revision:1,client_id}})).status()).toBe(400);
    expect([403,404]).toContain((await request.get(api+'/api/notes/'+id,{headers:{Authorization:'Bearer '+other.token}})).status());
    const saved=await(await request.get(api+'/api/notes/'+id,{headers})).json();expect(saved.content).toEqual(content);expect(saved.revision).toBe(1);
  }finally{
    expect((await request.delete(api+'/api/notes/'+id,{headers})).ok()).toBe(true);
    for(const actorToRevoke of [actor,other])expect((await request.post(api+'/api/users/logout-all',{headers:{Authorization:'Bearer '+actorToRevoke.token}})).status()).toBe(204);
  }
});
