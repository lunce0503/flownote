import assert from 'node:assert/strict';
import test from 'node:test';
import { canvasDraftConflicts, recoverQueuedCanvasDraft } from './canvasDraftRecovery.ts';

test('a pending old/unknown base cannot silently adopt a newer server revision',()=>{
 const draft={lines:[],images:[],textBoxes:[],hasPendingChanges:true,updatedAt:1,baseRevision:1};
 assert(canvasDraftConflicts(draft,2)); assert(!canvasDraftConflicts(draft,1));
 assert(canvasDraftConflicts({...draft,baseRevision:undefined},1));
 for(const baseRevision of [NaN,Infinity,-1])assert(canvasDraftConflicts({...draft,baseRevision},2));
 assert(canvasDraftConflicts(draft,NaN));
 assert(!canvasDraftConflicts({...draft,hasPendingChanges:false},2));
});
test('retry-only recovery preserves remote elements and local changes for a separate copy',()=>{
 const remote={lines:[],images:[],textBoxes:[{id:'box',text:'remote',status:'unchanged'},{id:'other',text:'keep',status:'unchanged'}],updatedAt:1,hasPendingChanges:false};
 const draft=recoverQueuedCanvasDraft(remote,[{modifiedTextBoxes:[{id:'box',text:'local'}],addedTextBoxes:[{id:'new',text:'added'}]}],1);
 assert.equal(draft.textBoxes.find(x=>x.id==='box').text,'local');assert.equal(draft.textBoxes.find(x=>x.id==='other').text,'keep');
 assert.equal(draft.textBoxes.find(x=>x.id==='new').status,'new');assert.equal(draft.baseRevision,1);assert(canvasDraftConflicts(draft,2));
 assert.equal(remote.textBoxes[0].text,'remote');
});
