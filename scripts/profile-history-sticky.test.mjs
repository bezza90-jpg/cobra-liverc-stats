import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../public/assets/styles.css',import.meta.url),'utf8');

test('desktop racer history keeps its column headings visible while scrolling',()=>{
  assert.match(css,/\.profile-history\s*>\s*table\s*>\s*thead\s*\{\s*position:sticky;\s*top:0;/);
  assert.match(css,/\.profile-history\s*\{\s*overflow-y:auto;/);
});
