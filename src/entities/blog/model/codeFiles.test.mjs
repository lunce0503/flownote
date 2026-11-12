import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCodeNoteFits, CODE_LANGUAGES, codeFileBytes, codeLanguageForFile, isCodeContent, newCodeContent, noteFileName, readCodeFile} from './codeFiles.ts';

test('code files retain their original text, extension and encoding through import and export', async () => {
  for (const language of CODE_LANGUAGES) {
    for (const encoding of ['utf-8', 'utf-8-bom', 'utf-16le', 'utf-16be']) {
      const original = newCodeContent(language.id, '  한글 😀\r\n\tvalue = "<script>"\r\n', encoding);
      const bytes = codeFileBytes(original);
      const name = `Main.${language.extensions[0]}`;
      const imported = await readCodeFile(new File([bytes], name));
      assert.deepEqual(imported.content, original);
      assert.equal(imported.title, name);
      assert.deepEqual(codeFileBytes(imported.content), bytes);
      assert.equal(noteFileName(imported), name);
    }
  }
  assert.equal(codeLanguageForFile('APP.TSX'), 'tsx');
  assert.equal(noteFileName({title: '기존 제목'}), '기존 제목.md');
  assert.equal(noteFileName({title: 'main.rs', content_format: 'code'}), 'main.rs');
});

test('invalid/binary input fails before a note is created, while empty and malformed JSON remain editable', async () => {
  assert.equal((await readCodeFile(new File([], 'empty.py'))).content.text, '');
  assert.equal((await readCodeFile(new File(['{ unfinished'], 'draft.json'))).content.text, '{ unfinished');
  await assert.rejects(readCodeFile(new File([new Uint8Array([0xff, 0xfe, 0])], 'bad.py')), /UTF/);
  await assert.rejects(readCodeFile(new File([new Uint8Array([0, 1, 2])], 'binary.py')), /바이너리/);
  await assert.rejects(readCodeFile(new File(['hello'], 'app.exe')), /확장자/);
  await assert.rejects(readCodeFile(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'large.ts')), /2MiB/);
  assert.equal(isCodeContent({format: 'code', version: 1, language: 'python', text: ''}), true);
  assert.equal(isCodeContent({format: 'code', version: 1, language: 'execute()', text: ''}), false);
  assert.equal(isCodeContent({format: 'code', version: 1, language: 'python', text: null}), false);
});

test('editing cannot produce an export larger than the file import budget', () => {
  assert.throws(() => assertCodeNoteFits({content:newCodeContent('python','x'.repeat(1024*1024),'utf-16le')}), /2MiB/);
  assert.doesNotThrow(() => assertCodeNoteFits({content:newCodeContent('python','x'.repeat(1024*1024),'utf-8')}));
});
