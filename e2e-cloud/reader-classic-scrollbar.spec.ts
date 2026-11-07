import {test, expect} from '@playwright/test';
import {createCloudActor, stagingWeb as web, stagingApi as api} from './helpers/accounts';
import {verifyReader} from '../../flownote-desktop/scripts/reader-web-smoke.mjs';

// Playwright normally hides scrollbars. Keep Chromium's actual classic gutter
// to exercise the same width/height feedback boundary as packaged Windows.
test.use({viewport:{width:1008,height:655},launchOptions:{ignoreDefaultArgs:['--hide-scrollbars']}});
test('classic scrollbar preserves full-window spread, real glyph selection and vocabulary through save/reload',async({page,request})=>{
  const actor=await createCloudActor(request);
  await page.context().addCookies([{name:'__Host-flownote_session',value:actor.token,url:web,secure:true,httpOnly:true,sameSite:'Strict'}]);
  await page.addInitScript(user=>localStorage.setItem('flownote_auth_user',JSON.stringify(user)),actor.user);
  await page.goto(web+'/library');
  const headers={Authorization:'Bearer '+actor.token};
  try {
    await verifyReader(page,{classicScrollbar:true});
    await expect(page.locator('.book-reader')).toHaveCount(0);
  } finally {
    // This actor is new and owns only this synthetic fixture. Clean it even if
    // the regression interrupts the native helper before its normal deletion.
    const list=await request.get(api+'/api/library/books',{headers});expect(list.ok()).toBe(true);
    for(const book of (await list.json()).books.filter(book=>!book.deleted)) {
      const current=await request.get(api+'/api/library/books/'+book.id,{headers});expect(current.ok()).toBe(true);
      const revision=(await current.json()).revision;
      expect((await request.delete(api+'/api/library/books/'+book.id+'?revision='+revision,{headers})).ok()).toBe(true);
    }
  }
});
