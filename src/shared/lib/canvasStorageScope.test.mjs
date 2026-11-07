import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasDatabaseName } from './canvasStorageScope.ts';

test('cloud caches and anonymous cache never share an account namespace', () => {
  assert.notEqual(canvasDatabaseName('A',false),canvasDatabaseName('B',false));
  assert.notEqual(canvasDatabaseName('',false),canvasDatabaseName('A',false));
  assert.notEqual(canvasDatabaseName('A',false),'flownote-canvas');
});
test('existing device storage stays separate and keeps its original name', () => {
  assert.equal(canvasDatabaseName('A',true),'flownote-canvas-device:A');
  assert.notEqual(canvasDatabaseName('A',true),canvasDatabaseName('A',false));
});
