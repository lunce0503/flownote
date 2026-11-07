import {test,expect} from '@playwright/test';
import {createCloudActor,stagingApi as api,stagingWeb as web} from './helpers/accounts';

test('upload boundaries reject active content, oversized images and directory listing',async({request})=>{
  const actor=await createCloudActor(request),headers={Authorization:'Bearer '+actor.token};
  try {
    for(const route of ['/api/notes/upload','/api/canvas/assets']) {
      const r=await request.post(api+route,{headers,multipart:{image:{name:'disguised.png',mimeType:'image/png',buffer:Buffer.from('<!doctype html><script>window.uploadExecuted=true</script>')}}});
      expect(r.status()).toBe(415);
    }
    for(const bytes of [2*1024*1024+1,2*1024*1024+128*1024]) {
      const r=await request.post(api+'/api/notes/upload',{headers,multipart:{image:{name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(bytes)}}});
      expect(r.status()).toBe(413);
    }
    const directory=await request.get(api+'/uploads/');expect([403,404]).toContain(directory.status());
    const proxied=await request.get(web+'/web-api/uploads/synthetic-missing.html');
    expect(proxied.status()).toBe(404);
    expect(proxied.headers()['content-security-policy']).toContain('sandbox');
    expect(proxied.headers()['x-content-type-options']).toBe('nosniff');
  } finally {expect((await request.post(api+'/api/users/logout',{headers})).ok()).toBe(true);}
});
