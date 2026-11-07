import { canvasDatabaseName } from '@/shared/lib/canvasStorageScope';
const DATABASE_VERSION = 1;
const OPERATIONS_STORE = "operations";
const DRAFTS_STORE = "drafts";

const openDatabase = (databaseName: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(databaseName, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(OPERATIONS_STORE)) {
      database.createObjectStore(OPERATIONS_STORE);
    }
    if (!database.objectStoreNames.contains(DRAFTS_STORE)) {
      database.createObjectStore(DRAFTS_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  request.onblocked = () => reject(new Error('다른 창의 캔버스 저장을 확인해주세요.'));
});

const runRequest = async <T>(storeName: string, mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>, databaseName = canvasDatabaseName()): Promise<T> => {
  const database = await openDatabase(databaseName);
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      let value: T;
      request.onsuccess = () => { value = request.result; };
      transaction.oncomplete = () => resolve(value);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB 요청에 실패했습니다."));
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 저장에 실패했습니다.'));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB 트랜잭션이 취소되었습니다."));
    });
  } finally {
    database.close();
  }
};

export const readCanvasOperationQueue = async <T>(databaseName = canvasDatabaseName()): Promise<T[]> => {
  if (typeof indexedDB === "undefined") return [];
  const value = await runRequest<unknown>(OPERATIONS_STORE, "readonly", (store) => store.get("retryQueue"), databaseName);
  return Array.isArray(value) ? value as T[] : [];
};

export const writeCanvasOperationQueue = async <T>(queue: T[], databaseName = canvasDatabaseName()): Promise<void> => {
  if (typeof indexedDB === "undefined") throw new Error('기기 저장소를 사용할 수 없습니다.');
  await runRequest<IDBValidKey>(OPERATIONS_STORE, "readwrite", (store) => store.put(queue, "retryQueue"), databaseName);
};

export const readCanvasDraft = async <T>(canvasId: string, databaseName = canvasDatabaseName()): Promise<T | null> => {
  if (typeof indexedDB === "undefined") return null;
  const value = await runRequest<unknown>(DRAFTS_STORE, "readonly", (store) => store.get(canvasId), databaseName);
  return value == null ? null : value as T;
};

export const writeCanvasDraft = async <T>(canvasId: string, draft: T, databaseName = canvasDatabaseName()): Promise<void> => {
  if (typeof indexedDB === "undefined") throw new Error('기기 저장소를 사용할 수 없습니다.');
  await runRequest<IDBValidKey>(DRAFTS_STORE, "readwrite", (store) => store.put(draft, canvasId), databaseName);
};

export const removeCanvasDraft = async (canvasId: string, databaseName = canvasDatabaseName()): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  await runRequest<undefined>(DRAFTS_STORE, "readwrite", (store) => store.delete(canvasId), databaseName);
};

// Only call after a successful authorized fetch for this exact canvas. Legacy
// unowned data is never a fallback for a denied/offline request.
export const readAuthorizedLegacyCanvasState = async <T>(canvasId: string): Promise<{draft:T|null;queue:unknown[]}> => {
  const scope = canvasDatabaseName();
  if (!canvasId || !scope.startsWith('flownote-canvas-cloud:') || scope.endsWith(':anonymous') || typeof indexedDB === 'undefined') return {draft:null,queue:[]};
  if (await runRequest(OPERATIONS_STORE,'readonly',store=>store.get(`legacyMigrated:${canvasId}`),scope)) return {draft:null,queue:[]};
  const legacy = await new Promise<IDBDatabase|null>((resolve,reject) => {
    const request = indexedDB.open('flownote-canvas'); let absent = false;
    request.onupgradeneeded = () => { absent = true; request.transaction?.abort(); };
    request.onerror = () => absent ? resolve(null) : reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  if (!legacy) return {draft:null,queue:[]};
  try {
    const read = <V>(store:string,key:string):Promise<V|undefined> => new Promise((resolve,reject) => {
      if (!legacy.objectStoreNames.contains(store)) {resolve(undefined);return;}
      const tx=legacy.transaction(store,'readonly'),request=tx.objectStore(store).get(key); let value:V|undefined;
      request.onsuccess=()=>{value=request.result;}; tx.oncomplete=()=>resolve(value);
      tx.onerror=tx.onabort=()=>reject(tx.error ?? new Error('이전 초안을 읽을 수 없습니다.'));
    });
    const [draft,queue]=await Promise.all([read<T>(DRAFTS_STORE,canvasId),read<unknown[]>(OPERATIONS_STORE,'retryQueue')]);
    if (canvasDatabaseName()!==scope) return {draft:null,queue:[]};
    return {draft:draft ?? null,queue:Array.isArray(queue) ? queue.filter(item => item && typeof item === 'object' && 'canvasId' in item && item.canvasId===canvasId) : []};
  } finally {legacy.close();}
};

export const markCanvasLegacyStateMigrated = async (canvasId:string, scope=canvasDatabaseName()):Promise<void> => {
  await runRequest(OPERATIONS_STORE,'readwrite',store=>store.put(true,`legacyMigrated:${canvasId}`),scope);
};

export type CanvasDeviceDiagnostic = {
  id: string;
  operation: "LOAD" | "SAVE";
  canvasId: string | null;
  message: string;
  createdAt: number;
};

export const appendCanvasDeviceDiagnostic = async (event: CanvasDeviceDiagnostic): Promise<void> => {
  if (typeof indexedDB === "undefined") return;
  const scope = canvasDatabaseName();
  const current = await readCanvasDeviceDiagnostics(scope);
  await runRequest<IDBValidKey>(OPERATIONS_STORE, "readwrite", (store) => (
    store.put([event, ...current].slice(0, 100), "deviceDiagnostics")
  ),scope);
};

export const readCanvasDeviceDiagnostics = async (scope=canvasDatabaseName()): Promise<CanvasDeviceDiagnostic[]> => {
  if (typeof indexedDB === "undefined") return [];
  const value = await runRequest<unknown>(OPERATIONS_STORE, "readonly", (store) => store.get("deviceDiagnostics"),scope);
  return Array.isArray(value) ? value as CanvasDeviceDiagnostic[] : [];
};
