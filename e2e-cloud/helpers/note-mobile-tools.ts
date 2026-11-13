import { expect, test, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createCloudActor, stagingApi as api, stagingWeb as web } from './accounts';

type Point = { x: number; y: number; id: number };
type Format = 'code' | 'live' | 'source' | 'preview';

export async function noteTouchDriver(page: Page, engine: 'chromium' | 'webkit') {
  const surface = page.getByTestId('note-viewport');
  const cdp = engine === 'chromium' ? await page.context().newCDPSession(page) : null;
  let contacts: Point[] = [];
  if (!cdp) {
    // WebKit's synthetic pointer/capture contract is separate from CDP's real touch stream.
    await surface.evaluate(element => {
      const captured = new Set<number>();
      element.setPointerCapture = id => { captured.add(id); };
      element.hasPointerCapture = id => captured.has(id);
      element.releasePointerCapture = id => { captured.delete(id); };
    });
  }
  return async (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: Point[]) => {
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
    else {
      for (const point of contacts.filter(previous => !points.some(next => next.id === previous.id))) {
        await surface.dispatchEvent(type === 'touchCancel' ? 'pointercancel' : 'pointerup', {
          pointerId: point.id, pointerType: 'touch', clientX: point.x, clientY: point.y, buttons: 0,
        });
      }
      for (const point of points) {
        const previous = contacts.some(item => item.id === point.id);
        if (type === 'touchStart' && previous) continue;
        await surface.dispatchEvent(previous ? 'pointermove' : 'pointerdown', {
          pointerId: point.id, pointerType: 'touch', clientX: point.x, clientY: point.y, buttons: 1,
        });
      }
      contacts = points;
    }
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  };
}

export async function noteWordBounds(page: Page, format: Format, word = 'bravo') {
  return page.evaluate(({ format, word }) => {
    if (format === 'source') {
      const input = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Markdown 본문"]')!;
      const style = getComputedStyle(input), box = input.getBoundingClientRect();
      const context = document.createElement('canvas').getContext('2d')!; context.font = style.font;
      return { x: box.left + parseFloat(style.paddingLeft) + context.measureText('alpha ').width,
        y: box.top + parseFloat(style.paddingTop), width: context.measureText(word).width, height: parseFloat(style.lineHeight) };
    }
    const root = document.querySelector(format === 'code' ? '.cm-content' : format === 'live' ? '.note-live-content' : '.note-markdown')!;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode as Text, from = node.data.indexOf(word);
      if (from < 0) continue;
      const range = document.createRange(); range.setStart(node, from); range.setEnd(node, from + word.length);
      const box = range.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }
    throw new Error('Synthetic note text is missing');
  }, { format, word });
}

export function registerNoteMobileTools(engine: 'chromium' | 'webkit') {
  for (const format of ['code', 'live', 'source', 'preview'] as const) {
    test(`note mobile tools ${engine} ${format}: lasso selects real text, edits persist and view gestures preserve source`, async ({ page, request }) => {
      test.setTimeout(150000);
      const actor = await createCloudActor(request), id = randomUUID();
      const headers = { Authorization: 'Bearer ' + actor.token };
      const text = format === 'code' ? 'alpha bravo charlie\r\n\r\n' + 'wide '.repeat(80) + '\r\nsecond line\r\n' : 'alpha bravo charlie\n\nsecond line\n';
      const content = format === 'code' ? { format: 'code', version: 1, language: 'plaintext', encoding: 'utf-16le', text }
        : { format: 'markdown', version: 1, markdown: text };
      const created = await request.post(api + '/api/notes', { headers, data: {
        id, title: format === 'code' ? 'mobile-tools.txt' : 'Synthetic mobile note tools', content, revision: 1, client_id: randomUUID(),
      } });
      expect(created.ok()).toBe(true);
      const read = async () => {
        const response = await request.get(api + '/api/notes/' + id, { headers }); expect(response.ok()).toBe(true);
        return response.json();
      };
      try {
        await page.context().addCookies([{ name: '__Host-flownote_session', value: actor.token, url: web, secure: true, httpOnly: true, sameSite: 'Strict' }]);
        await page.addInitScript(user => {
          localStorage.setItem('flownote_auth_user', JSON.stringify(user));
          Object.assign(window, { noteTestCopied: [] });
          Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: async (value: string) => { (window as unknown as { noteTestCopied: string[] }).noteTestCopied.push(value); },
          } });
        }, actor.user);
        await page.goto(web + '/blog/' + id);
        if (format === 'source') {
          await page.getByRole('button', { name: '편집 도구', exact: true }).click();
          await page.getByRole('button', { name: '원문', exact: true }).click();
        } else if (format === 'preview') await page.getByRole('button', { name: '미리보기', exact: true }).click();
        const target = format === 'code' ? page.getByRole('textbox', { name: '코드 편집기', exact: true })
          : format === 'source' ? page.getByRole('textbox', { name: 'Markdown 본문', exact: true })
          : page.locator(format === 'live' ? '.note-live-content' : '.note-markdown');
        await expect(target).toBeVisible();
        const surface = page.getByTestId('note-viewport'), touch = await noteTouchDriver(page, engine);
        const choose = async (action: string) => {
          const box = (await surface.boundingBox())!;
          const origin = { x: box.x + Math.min(160, box.width / 2), y: box.y + Math.min(180, box.height / 2), id: 1 };
          await touch('touchStart', [origin]);
          const menu = page.getByTestId('note-quick-menu'); await expect(menu).toBeVisible();
          const item = (await menu.locator(`[data-action="${action}"]`).boundingBox())!;
          await touch('touchMove', [{ x: item.x + item.width / 2, y: item.y + item.height / 2, id: 1 }]);
          await expect(menu.locator(`[data-action="${action}"]`)).toHaveAttribute('data-selected', 'true');
          await touch('touchEnd', []); await expect(menu).toHaveCount(0);
        };
        await choose('zoom-in');
        expect(Number(await surface.getAttribute('data-zoom'))).toBeGreaterThan(1);
        await page.getByRole('button', { name: '노트 확대율 초기화', exact: true }).click();
        await expect(surface).toHaveAttribute('data-zoom', '1');
        await page.getByRole('button', { name: '노트 올가미', exact: true }).click();
        const word = await noteWordBounds(page, format);
        const points = [{ x: word.x + 0.1, y: word.y - 2 }, { x: word.x + word.width - 0.1, y: word.y - 2 },
          { x: word.x + word.width - 0.1, y: word.y + word.height + 2 }, { x: word.x + 0.1, y: word.y + word.height + 2 },
          { x: word.x + 0.1, y: word.y - 2 }].map(point => ({ ...point, id: 1 }));
        await touch('touchStart', [points[0]]);
        for (const point of points.slice(1)) await touch('touchMove', [point]);
        await touch('touchEnd', []);
        await expect(page.getByTestId('note-selection-status')).toContainText('5자 선택');
        if (format === 'code') await page.getByLabel('코드 편집 도구 더보기', { exact: true }).click();
        await page.getByRole('button', { name: '노트 선택 복사', exact: true }).click();
        expect(await page.evaluate(() => (window as unknown as { noteTestCopied: string[] }).noteTestCopied)).toEqual(['bravo']);
        const unchanged = await read(); expect(unchanged.content).toEqual(content); expect(unchanged.revision).toBe(1);
        if (format !== 'preview') {
          await page.getByRole('button', { name: '노트 편집', exact: true }).click();
          await page.keyboard.insertText('BETA');
          await expect.poll(async () => {
            const saved = await read(); return saved.content.text ?? saved.content.markdown;
          }).toContain('alpha BETA charlie');
          if (format === 'code') {
            const saved = await read(); expect(saved.content.encoding).toBe('utf-16le'); expect(saved.content.text).toBe(text.replace('bravo', 'BETA'));
          }
          await choose('undo');
          await expect.poll(async () => {
            const saved = await read(); return saved.content.text ?? saved.content.markdown;
          }).toContain('alpha bravo charlie');
        }
        if (format !== 'preview') {
          const caret = await noteWordBounds(page, format);
          const point = { x: caret.x + 0.1, y: caret.y + caret.height / 2, id: 1 };
          await touch('touchStart', [point]); await touch('touchEnd', []);
          await page.keyboard.insertText('TAP');
          await expect.poll(async () => {
            const stored = await read(); return stored.content.text ?? stored.content.markdown;
          }).toContain('alpha TAPbravo charlie');
          await choose('undo');
          await expect.poll(async () => {
            const stored = await read(); return stored.content.text ?? stored.content.markdown;
          }).toContain('alpha bravo charlie');
        }
        const saved = await read();
        await choose('zoom-in'); await choose('zoom-in'); await choose('pan');
        const panSurface = format === 'code' ? page.locator('.cm-scroller') : surface;
        await panSurface.evaluate(element => { element.scrollLeft = 70; });
        const beforePan = await panSurface.evaluate(element => element.scrollLeft);
        const box = (await surface.boundingBox())!;
        const origin = { x: box.x + Math.min(180, box.width / 2), y: box.y + Math.min(300, box.height - 40), id: 1 };
        await touch('touchStart', [origin]); await touch('touchMove', [{ ...origin, x: origin.x + 35 }]); await touch('touchEnd', []);
        expect(await panSurface.evaluate(element => element.scrollLeft)).toBeLessThan(beforePan - 20);
        const beforePinch = Number(await surface.getAttribute('data-zoom'));
        const first = { ...origin, x: origin.x - 45 }, second = { ...origin, x: origin.x + 45, id: 2 };
        await touch('touchStart', [first]); await touch('touchStart', [first, second]);
        await touch('touchMove', [{ ...first, x: first.x - 15 }, { ...second, x: second.x + 15 }]); await touch('touchEnd', []);
        expect(Number(await surface.getAttribute('data-zoom'))).toBeGreaterThan(beforePinch);
        await touch('touchStart', [origin]); await expect(page.getByTestId('note-quick-menu')).toBeVisible();
        await touch('touchCancel', []); await expect(page.getByTestId('note-quick-menu')).toHaveCount(0);
        const afterGestures = await read(); expect(afterGestures.content).toEqual(saved.content); expect(afterGestures.revision).toBe(saved.revision);
        await page.reload(); await expect(page.getByTestId('note-interaction')).toBeVisible();
        expect((await read()).content).toEqual(saved.content);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        if (format === 'code') {
          const wrappedText = Array.from({ length: 54 }, (_, index) => `word${index}`).join(' ');
          await expect(target).toBeVisible();
          await target.press('ControlOrMeta+a'); await page.keyboard.insertText(wrappedText);
          await expect.poll(async () => (await read()).content.text).toBe(wrappedText);
          await page.getByLabel('코드 편집 도구 더보기', { exact: true }).click();
          await page.getByRole('button', { name: '자동 줄바꿈', exact: true }).click();
          const line = page.locator('.cm-line').first();
          await expect.poll(async () => (await line.boundingBox())!.height).toBeGreaterThan(150);
          const box = (await line.boundingBox())!;
          await page.getByRole('button', { name: '노트 올가미', exact: true }).click();
          const wrapTouch = await noteTouchDriver(page, engine);
          const outline = [{ x: box.x + 0.1, y: box.y - 1 }, { x: box.x + box.width - 0.1, y: box.y - 1 },
            { x: box.x + box.width - 0.1, y: box.y + box.height + 1 }, { x: box.x + 0.1, y: box.y + box.height + 1 },
            { x: box.x + 0.1, y: box.y - 1 }].map(point => ({ ...point, id: 1 }));
          await wrapTouch('touchStart', [outline[0]]);
          for (const point of outline.slice(1)) await wrapTouch('touchMove', [point]);
          await wrapTouch('touchEnd', []);
          await page.getByLabel('코드 편집 도구 더보기', { exact: true }).click();
          await page.getByRole('button', { name: '노트 선택 복사', exact: true }).click();
          expect(await page.evaluate(() => (window as unknown as { noteTestCopied: string[] }).noteTestCopied.at(-1))).toBe(wrappedText);
          expect((await read()).content.text).toBe(wrappedText);
        }
      } finally {
        expect((await request.delete(api + '/api/notes/' + id, { headers })).ok()).toBe(true);
        expect((await request.post(api + '/api/users/logout-all', { headers })).status()).toBe(204);
      }
    });
  }

  test(`note mobile tools ${engine}: native math taps and dialog input remain usable`, async ({ page, request }) => {
    page.setDefaultTimeout(15000);
    const actor = await createCloudActor(request), id = randomUUID();
    const headers = { Authorization: 'Bearer ' + actor.token };
    expect((await request.post(api + '/api/notes', { headers, data: { id, title: 'Synthetic note math touch',
      content: { format: 'markdown', version: 1, markdown: 'Inline $x$\n' }, revision: 1, client_id: randomUUID(),
    } })).ok()).toBe(true);
    try {
      await page.context().addCookies([{ name: '__Host-flownote_session', value: actor.token, url: web, secure: true, httpOnly: true, sameSite: 'Strict' }]);
      await page.addInitScript(user => localStorage.setItem('flownote_auth_user', JSON.stringify(user)), actor.user);
      await page.goto(web + '/blog/' + id);
      await page.locator('.tiptap-mathematics-render .katex-html').tap();
      const dialog = page.getByRole('dialog', { name: '수식 편집', exact: true }); await expect(dialog).toBeVisible();
      const input = dialog.getByRole('textbox', { name: 'LaTeX 수식', exact: true });
      await expect(input).not.toHaveCSS('touch-action', 'none');
      await input.tap(); await input.press('ControlOrMeta+a'); await page.keyboard.insertText('x+1');
      await expect(input).toHaveValue('x+1');
      await dialog.getByRole('button', { name: '수식 적용', exact: true }).tap();
      await expect(dialog).toHaveCount(0);
      await expect.poll(async () => (await (await request.get(api + '/api/notes/' + id, { headers })).json()).content.markdown).toContain('x+1');
      await expect(page.getByTestId('note-quick-menu')).toHaveCount(0);
    } finally {
      expect((await request.delete(api + '/api/notes/' + id, { headers })).ok()).toBe(true);
      expect((await request.post(api + '/api/users/logout-all', { headers })).status()).toBe(204);
    }
  });
}
