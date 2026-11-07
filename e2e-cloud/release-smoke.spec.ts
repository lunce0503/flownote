import { test, expect } from '@playwright/test';
import { createCloudActor, stagingApi, stagingWeb } from './helpers/accounts';

test('release smoke: cloud session, core routes and configuration', async ({page, request}) => {
  const {token,user} = await createCloudActor(request);
  const headers = {Authorization:`Bearer ${token}`};
  try {
    expect((await request.get(`${stagingApi}/api/users/me`)).status()).toBe(401);
    expect((await request.get(`${stagingApi}/api/users/me`,{headers})).ok()).toBe(true);
    const response = await request.get(`${stagingApi}/api/mobile/config`);
    expect(response.ok()).toBe(true);
    const config = await response.json();
    expect(config.web_url ?? config.webUrl).toBe(stagingWeb);
    expect(config.core_api_url ?? config.coreApiUrl).toBe(stagingApi);
    await page.context().addCookies([{name:'__Host-flownote_session',value:token,url:stagingWeb,secure:true,httpOnly:true,sameSite:'Strict'}]);
    await page.addInitScript(value => localStorage.setItem('flownote_auth_user',JSON.stringify(value)),user);
    for (const route of ['/blog','/canvas','/library']) {
      const navigation = await page.goto(route);
      expect(navigation?.ok()).toBe(true);
      await expect(page).toHaveURL(stagingWeb+route);
      await expect(page.getByRole('heading',{name:route === '/library' ? '전공서 책장' : '작업 공간',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'로그인',exact:true})).toHaveCount(0);
    }
    await page.reload(); await expect(page).toHaveURL(stagingWeb+'/library');
  } finally {
    expect((await request.post(`${stagingApi}/api/users/logout`,{headers})).ok()).toBe(true);
  }
});
