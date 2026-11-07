// Browser unit: no local product server, no network or user data.
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const component=fileURLToPath(new URL('../src/widgets/BlogWidget/MarkdownWorkspace/MathComposer.tsx',import.meta.url));
const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import MathComposer from ${JSON.stringify(component)};createRoot(document.getElementById('root')).render(<MathComposer initial={{latex:'',kind:'inline'}} apply={draft=>window.applied=draft} close={()=>{}}/>);`,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',define:{'process.env.NODE_ENV':'"production"'},jsx:'automatic'});
const browser=await chromium.launch();
try{
 const p=await browser.newPage();await p.setContent('<div id="root"></div>');
 await p.evaluate(()=>{window.framesToFlush=[];window.requestAnimationFrame=fn=>{window.framesToFlush.push(fn);return window.framesToFlush.length;};});
 await p.addScriptTag({content:bundle.outputFiles[0].text});
 const input=p.getByLabel('LaTeX 수식',{exact:true});await input.fill('\\sq');await p.getByRole('button',{name:/\\sqrt/}).click();assert.equal(await input.inputValue(),'\\sqrt{}');
 // Real select-all + paste transport boundary. A previously queued app RAF must
 // never be allowed to replace the user's new selection between these commands.
 await input.evaluate(n=>{n.focus();n.select();});
 await p.evaluate(()=>{const frames=window.framesToFlush.splice(0);frames.forEach(fn=>fn(performance.now()));});
 await p.keyboard.insertText('\\sqrt{4}');
 assert.equal(await input.inputValue(),'\\sqrt{4}','Suggestion caret restoration replaced the new select-all');
 await p.getByRole('button',{name:'수식 적용',exact:true}).click();assert.equal(await p.evaluate(()=>window.applied?.latex),'\\sqrt{4}');
 console.log('PASS MathComposer: queued-frame boundary preserves select-all/paste and exact applied formula');
}finally{await browser.close();}
