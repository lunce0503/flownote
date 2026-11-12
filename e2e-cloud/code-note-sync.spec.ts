import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudActor, stagingApi as api, stagingWeb as web } from './helpers/accounts';
import { replaceCode } from './helpers/code-notes';

test.use({ browserName: 'webkit', viewport: { width: 390, height: 844 },
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 FlownoteIOS/1.3.1' });

test('code notes survive OFF edits and reload, then synchronize the exact source to another device', async ({ page, browser, request }) => {
  test.setTimeout(150000);
  const actor = await createCloudActor(request);
  const headers = { Authorization: 'Bearer ' + actor.token };
  const id = randomUUID();
  const original = { format: 'code', version: 1, language: 'python', encoding: 'utf-16le', text: 'print("cloud")\r\n' };
  const offlineText = 'print("기기에서 편집")\r\n# offline\r\n';
  expect((await request.post(api + '/api/notes', { headers, data: {
    id, title: 'sync-source.py', content: original, revision: 1, client_id: randomUUID(),
  } })).ok()).toBe(true);
  const cookie = { name: '__Host-flownote_session', value: actor.token, url: web, secure: true, httpOnly: true, sameSite: 'Strict' as const };
  const read = async () => {
    const response = await request.get(api + '/api/notes/' + id, { headers });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const editor = page.getByRole('textbox', { name: '코드 편집기', exact: true });
  const remoteContext = await browser.newContext({ viewport: { width: 1024, height: 900 } });
  try {
    await page.context().addCookies([cookie]);
    await page.addInitScript(user => localStorage.setItem('flownote_auth_user', JSON.stringify(user)), actor.user);
    await page.goto('/settings');
    await expect(page.getByRole('switch', { name: '앱 동기화', exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('switch', { name: '앱 동기화', exact: true }).click();
    await expect(page.getByRole('switch', { name: '앱 동기화', exact: true })).toHaveAttribute('aria-checked', 'false');
    const outgoing: string[] = [];
    const observe = (request: { url(): string }) => {
      if (/\/web-api\/|\.railway\.app/.test(request.url())) outgoing.push(request.url());
    };
    page.on('request', observe);
    await page.goto(web + '/blog/' + id);
    await expect(editor).toBeVisible();
    await replaceCode(page, offlineText);
    await expect(page.getByTestId('note-save-status')).toHaveText('기기에 저장됨 · 동기화 꺼짐');
    await page.reload();
    await expect(editor).toContainText('기기에서 편집');
    expect(outgoing).toEqual([]);
    expect((await read()).content).toEqual(original);
    page.off('request', observe);
    await page.goto('/settings');
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('switch', { name: '앱 동기화', exact: true }).click();
    await expect(page.getByRole('switch', { name: '앱 동기화', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await read()).content).toEqual({ ...original, text: offlineText });
    await remoteContext.addCookies([cookie]);
    await remoteContext.addInitScript(user => localStorage.setItem('flownote_auth_user', JSON.stringify(user)), actor.user);
    const remote = await remoteContext.newPage();
    await remote.goto(web + '/blog/' + id);
    await expect(remote.getByRole('textbox', { name: '코드 편집기', exact: true })).toContainText('기기에서 편집');
    const loaded = await read();
    expect(loaded.title).toBe('sync-source.py');
    expect(loaded.content).toEqual({ ...original, text: offlineText });
  } finally {
    await remoteContext.close();
    expect((await request.delete(api + '/api/notes/' + id, { headers })).ok()).toBe(true);
    expect((await request.post(api + '/api/users/logout-all', { headers })).status()).toBe(204);
  }
});
