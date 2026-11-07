import type { CanvasLocalDraft } from './canvasPersistenceModel.ts';
import type { CanvasSavePayload } from '@/entities/canvas';

export const canvasDraftConflicts = (draft:CanvasLocalDraft|null, revision:number):boolean => {
  if (!draft?.hasPendingChanges) return false;
  if (!Number.isSafeInteger(revision) || revision < 0) return true;
  if (!Number.isSafeInteger(draft.baseRevision) || draft.baseRevision! < 0) return revision > 0;
  return revision > draft.baseRevision!;
};

export const recoverQueuedCanvasDraft = (remote:CanvasLocalDraft,payloads:CanvasSavePayload[],baseRevision?:number):CanvasLocalDraft => {
  const apply = <T extends {id:string;status?:string}>(values:T[],added:string,modified:string,deleted:string):T[] => {
    const map = new Map(values.map(value=>[value.id,value]));
    for (const payload of payloads) {
      const changes = payload as Record<string,Array<T>|undefined>;
      for (const value of [...(changes[added]??[]),...(changes[modified]??[])]) map.set(value.id,{...value,status:map.has(value.id)?'modified':'new'});
      for (const value of changes[deleted]??[]) { const current=map.get(value.id); if(current)map.set(value.id,{...current,status:'deleted'}); }
    }
    return [...map.values()];
  };
  return {...remote,
    lines:apply(remote.lines,'addedLines','modifiedLines','deletedLines'),
    images:apply(remote.images,'addedImages','modifiedImages','deletedImages'),
    textBoxes:apply(remote.textBoxes,'addedTextBoxes','modifiedTextBoxes','deletedTextBoxes'),
    hasPendingChanges:true,baseRevision,updatedAt:Date.now()};
};
