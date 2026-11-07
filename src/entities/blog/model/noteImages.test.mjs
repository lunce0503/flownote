import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeMarkdownImageUrl, safeMarkdownUrl, convertLegacy} from './markdown.ts';
import {imageMime, imageMarkdown, assertImageFits, MAX_NOTE_IMAGE_BYTES} from './noteImages.ts';

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
test('embedded raster images are allowed only in image positions, without relaxing link safety', () => {
  assert.equal(safeMarkdownImageUrl(png), png);
  assert.equal(safeMarkdownUrl(png), '');
  for (const value of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:text/html;base64,PHNjcmlwdD4=', 'data:image/png;base64,PHN2Zz48L3N2Zz4=', 'javascript:alert(1)', '//evil.example/a']) assert.equal(safeMarkdownImageUrl(value), '', value);
  assert.equal(safeMarkdownImageUrl('/uploads/original.png'), '/uploads/original.png');
  const original=[{type:'image',props:{url:png,caption:'existing'}}];
  const converted=convertLegacy(original);
  assert.ok(converted.content.markdown.includes(png));
  assert.deepEqual(converted.content.legacy_original,original);
});
test('file signatures, safe captions and document budgets reject invalid input without truncation', () => {
  assert.equal(imageMime(Uint8Array.from([137,80,78,71,13,10,26,10])), 'image/png');
  assert.equal(imageMime(new TextEncoder().encode('<svg>')), '');
  assert.equal(imageMarkdown({src:png,alt:'a](javascript:x)\nfile.png'}), `![a\\](javascript:x) file.png](${png})`);
  assert.doesNotThrow(() => assertImageFits('기존 본문', png));
  assert.throws(() => assertImageFits('x'.repeat(3 * 1024 * 1024), png), /크기/);
  assert.equal(MAX_NOTE_IMAGE_BYTES, 2 * 1024 * 1024);
});
test('image insertion budgets preserved legacy and all save metadata without dropping originals', () => {
  const markdown='x'.repeat(1700*1024),legacy=[{type:'paragraph',content:'original'.repeat(250000)}];
  const note={id:'id',title:'keep',content:{format:'markdown',version:1,markdown,legacy_original:legacy},revision:1};
  const original=JSON.stringify(note);
  assert.throws(()=>assertImageFits(markdown,png,note),/원본|저장/);
  assert.equal(JSON.stringify(note),original);
  assert.doesNotThrow(()=>assertImageFits('short',png,{...note,content:{format:'markdown',version:1,markdown:'short',legacy_original:[{type:'paragraph',content:'keep'}]}}));
});
test('legacy conversion budgets full JSON and escaping without deleting the original', async () => {
  const {assertNoteImageSaveFits}=await import('./noteImages.ts');
  const legacy=[{type:'paragraph',content:'"'.repeat(900000)}];
  const note={title:'Preserve',content:convertLegacy(legacy).content};
  const before=JSON.stringify(note);
  assert.throws(()=>assertNoteImageSaveFits(note),/원본|저장/);
  assert.equal(JSON.stringify(note),before);
  assert.doesNotThrow(()=>assertNoteImageSaveFits({content:convertLegacy([{type:'paragraph',content:[{type:'text',text:'keep'}]}]).content}));
});
