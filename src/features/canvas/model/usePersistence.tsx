import { useCallback, useEffect, useRef, useState } from 'react';
import type { LineElement, ImageElement, TextBoxElement, CanvasLoadData, CanvasSavePayload } from '@/entities/canvas';
import { v4 as uuidv4 } from 'uuid';
import { deviceOwner, isDeviceOnly } from '@/shared/lib/deviceMode';
import { canvasDatabaseName } from '@/shared/lib/canvasStorageScope';
import { createCanvasDocument } from '@/entities/canvas';
import { canvasDraftConflicts, recoverQueuedCanvasDraft } from './canvasDraftRecovery';
import { API_BASE_URL, API_CORE_BASE_URL, authHeaders, resolveBrowserReachableUrl } from '@/shared/api';
import { publishSyncEvent } from '@/shared/lib/sync';
import { appendCanvasDeviceDiagnostic, readCanvasOperationQueue, readAuthorizedLegacyCanvasState, markCanvasLegacyStateMigrated, writeCanvasDraft, removeCanvasDraft } from './canvasIndexedDb';
import {
  SAVE_TRIGGER_PRIORITY,
  LOAD_TRIGGER_PRIORITY,
  enqueueUniqueByPriority,
  normalizeCanvasLoadData,
  serializeLine,
  serializeImage,
  serializeTextBox,
  buildDeletedElement,
  hasCanvasSavePayloadChanges,
  isAbortError,
  getCanvasLoadFailureMessage,
  applyServerCanvasStatus,
  markLinesSaved,
  markImagesSaved,
  markTextBoxesSaved,
  type SetLines,
  type SetImages,
  type SetTextBoxes,
  type CanvasLocalDraft,
  type CanvasSaveTrigger,
  type CanvasLoadTrigger,
  type CanvasSaveState,
} from './canvasPersistenceModel';
import {
  CANVAS_SOCKET_LOAD_TIMEOUT_MS,
  getCanvasSocket,
  emitCanvasSocket,
  emitCanvasStream,
  isCanvasMutationConflict,
  isCanvasPermanentSaveError,
  saveCanvasPayload,
  type CanvasChangedEvent,
  type CanvasStreamCallbacks,
  type CanvasLineStreamStartEvent,
  type CanvasLineStreamPointsEvent,
  type CanvasLineStreamEndEvent,
} from './canvasSocketClient';
import {
  readCanvasRetryQueue,
  hydrateCanvasRetryQueue,
  getCanvasRetryCount,
  addCanvasRetryQueueItem,
  removeCanvasRetryQueueItem,
  clearCanvasRetryQueue,
  updateCanvasRetryQueueItem,
  serializeCanvasDraft,
  removeCanvasLocalDraft,
  CANVAS_DRAFT_FAILURE_EVENT,
  readCanvasLocalDraftPersisted,
  writeCanvasLocalDraft,
  scheduleCanvasLocalDraft,
  type CanvasRetryQueueItem,
} from './canvasLocalDraft';
import { uploadCanvasAsset, buildCanvasAssetProxyUrl, readFileAsDataUrl, loadImage, hydrateImageElement } from './canvasAssetApi';

export const usePersistence = (
  drawnLines: LineElement[],
  images: ImageElement[],
  textBoxes: TextBoxElement[],
  setDrawnLines: SetLines,
  setImages: SetImages,
  setTextBoxes: SetTextBoxes,
  canvasId?: string | null,
  streamCallbacks: CanvasStreamCallbacks = {},
) => {

  const CANVAS_API_URL = resolveBrowserReachableUrl(import.meta.env.VITE_CANVAS_API_URL) || API_CORE_BASE_URL || "";
  const CANVAS_SOCKET_URL = resolveBrowserReachableUrl(import.meta.env.VITE_CANVAS_SOCKET_URL) || API_BASE_URL || CANVAS_API_URL;

  const drawnLinesRef = useRef(drawnLines);
  const imagesRef = useRef(images);
  const textBoxesRef = useRef(textBoxes);
  const linesByIdRef = useRef(new Map<string, LineElement>());
  const imagesByIdRef = useRef(new Map<string, ImageElement>());
  const textBoxesByIdRef = useRef(new Map<string, TextBoxElement>());
  const dirtyLineIdsRef = useRef(new Set<string>());
  const dirtyImageIdsRef = useRef(new Set<string>());
  const dirtyTextBoxIdsRef = useRef(new Set<string>());
  const canvasIdRef = useRef(canvasId);
  const initializedCanvasIdRef = useRef<string | null | undefined>(undefined);
  const queueHydrationRef = useRef<Promise<void> | null>(null);
  const localRevisionRef = useRef(0);
  const serverRevisionRef = useRef(0);
  const persistenceScopeRef = useRef(canvasDatabaseName());
  const persistenceOwnerRef = useRef(deviceOwner());
  const conflictRef = useRef<{canvasId:string|null;baseRevision?:number}|null>(null);
  const recoveringCopyRef = useRef(false);
  const recoveryCopyIdRef = useRef<string|null>(null);
  const isScopeCurrent = useCallback(() => canvasDatabaseName() === persistenceScopeRef.current,[]);
  const draftBaseRevision = useCallback(() => conflictRef.current ? conflictRef.current.baseRevision : serverRevisionRef.current,[]);
  const saveInFlightRef = useRef(false);
  const saveAgainRequestedRef = useRef(false);
  const handleSaveRef = useRef<((trigger?: CanvasSaveTrigger) => Promise<void>) | null>(null);
  const handleLoadRef = useRef<((trigger?: CanvasLoadTrigger) => Promise<void>) | null>(null);
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  const loadAgainRequestedRef = useRef(false);
  const pendingLoadTriggersRef = useRef<CanvasLoadTrigger[]>([]);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const activeLoadRequestIdRef = useRef<string | null>(null);
  const loadCancelRequestedRef = useRef(false);
  const retryAbortControllerRef = useRef<AbortController | null>(null);
  const retryCancelRequestedRef = useRef(false);
  const pendingSaveTriggersRef = useRef<CanvasSaveTrigger[]>([]);
  const autoSaveTimerRef = useRef<number | null>(null);
  const streamedPointsByLineRef = useRef(new Map<string, LineElement["points"]>());
  const streamPointsFrameRef = useRef<number | null>(null);
  const remoteChangeQueueRef = useRef<CanvasChangedEvent[]>([]);
  const remoteApplyInFlightRef = useRef(false);
  const drainRemoteChangeQueueRef = useRef<() => boolean>(() => false);
  const streamCallbacksRef = useRef(streamCallbacks);
  const [saveState, setSaveState] = useState<CanvasSaveState>(() => ({
    status: "loading",
    message: "불러오는 중",
    pendingRetries: getCanvasRetryCount(canvasId),
  }));

  useEffect(() => {
    const failed = (event:Event) => {
      const detail = (event as CustomEvent<{scope:string;canvasId:string|null}>).detail;
      if (!isScopeCurrent() || detail?.scope !== persistenceScopeRef.current || detail.canvasId !== (canvasIdRef.current ?? null)) return;
      setSaveState(current => ({...current,status:conflictRef.current ? 'conflict' : 'failed',message:'기기 초안 저장 실패 · 창을 닫기 전에 복구해주세요.',lastErrorAt:Date.now()}));
    };
    window.addEventListener(CANVAS_DRAFT_FAILURE_EVENT,failed);
    return () => window.removeEventListener(CANVAS_DRAFT_FAILURE_EVENT,failed);
  },[isScopeCurrent]);

  useEffect(() => {
    streamCallbacksRef.current = streamCallbacks;
  }, [streamCallbacks]);

  useEffect(() => {
    let active = true;
    queueHydrationRef.current = readCanvasOperationQueue<CanvasRetryQueueItem>(persistenceScopeRef.current).then((queue) => {
      if (!active || !isScopeCurrent()) return;
      hydrateCanvasRetryQueue(queue.map((item) => ({
        ...item,
        mutationId: item.mutationId || item.id,
        canvasId: item.canvasId ?? null,
        nextAttemptAt: item.nextAttemptAt ?? item.createdAt ?? Date.now(),
        priority: item.priority ?? 40,
      })));
      setSaveState((current) => ({
        ...current,
        pendingRetries: getCanvasRetryCount(canvasIdRef.current),
      }));
    }).catch((error) => console.warn("캔버스 재시도 큐 복원 실패:", error));
    return () => {
      active = false;
    };
  }, [isScopeCurrent]);

  useEffect(() => {
    conflictRef.current = null; recoveryCopyIdRef.current = null;
    streamedPointsByLineRef.current.clear();
    initializedCanvasIdRef.current = undefined;
    remoteChangeQueueRef.current = [];
    pendingSaveTriggersRef.current = [];
    pendingLoadTriggersRef.current = ["selection"];
    loadAgainRequestedRef.current = true;
  }, [canvasId]);

  useEffect(() => {
    if (!isScopeCurrent()) return;
    drawnLinesRef.current = drawnLines;
    imagesRef.current = images;
    textBoxesRef.current = textBoxes;
    linesByIdRef.current = new Map(drawnLines.map((line) => [line.id, line]));
    imagesByIdRef.current = new Map(images.map((image) => [image.id, image]));
    textBoxesByIdRef.current = new Map(textBoxes.map((textBox) => [textBox.id, textBox]));
    dirtyLineIdsRef.current = new Set(drawnLines.filter((line) => line.status && line.status !== "unchanged").map((line) => line.id));
    dirtyImageIdsRef.current = new Set(images.filter((image) => image.status && image.status !== "unchanged").map((image) => image.id));
    dirtyTextBoxIdsRef.current = new Set(textBoxes.filter((textBox) => textBox.status && textBox.status !== "unchanged").map((textBox) => textBox.id));
    canvasIdRef.current = canvasId;
    localRevisionRef.current += 1;
    if (initializedCanvasIdRef.current !== (canvasId ?? null)) return;
    scheduleCanvasLocalDraft(canvasId, drawnLines, images, textBoxes, draftBaseRevision());
    if (conflictRef.current) return;

    const hasDirtyElements = dirtyLineIdsRef.current.size + dirtyImageIdsRef.current.size + dirtyTextBoxIdsRef.current.size > 0;
    const pendingRetries = getCanvasRetryCount(canvasId);
    if (hasDirtyElements) {
      setSaveState((current) => ({
        ...current,
        status: current.status === "saving" || current.status === "retrying" ? current.status : "pending",
        message: current.status === "saving" || current.status === "retrying" ? current.message : "저장할 변경 있음",
        pendingRetries,
      }));
      return;
    }

    setSaveState((current) => ({
      ...current,
      status: pendingRetries > 0 && current.status !== "saving" && current.status !== "retrying" ? "failed" : current.status,
      message: pendingRetries > 0 && current.status !== "saving" && current.status !== "retrying" ? "재시도 대기" : current.message,
      pendingRetries,
    }));
  }, [canvasId, drawnLines, images, textBoxes, draftBaseRevision, isScopeCurrent]);

  const buildCurrentSavePayload = useCallback((): CanvasSavePayload => {
    const payload: CanvasSavePayload = {
      addedLines: [], modifiedLines: [], deletedLines: [],
      addedImages: [], modifiedImages: [], deletedImages: [],
      addedTextBoxes: [], modifiedTextBoxes: [], deletedTextBoxes: [],
    };
    dirtyLineIdsRef.current.forEach((id) => {
      const line = linesByIdRef.current.get(id);
      if (!line) return;
      if (line.status === "new") payload.addedLines!.push(serializeLine(line));
      else if (line.status === "modified") payload.modifiedLines!.push(serializeLine(line));
      else if (line.status === "deleted") payload.deletedLines!.push(buildDeletedElement(line));
    });
    dirtyImageIdsRef.current.forEach((id) => {
      const image = imagesByIdRef.current.get(id);
      if (!image) return;
      if (image.status === "new") payload.addedImages!.push(serializeImage(image));
      else if (image.status === "modified") payload.modifiedImages!.push(serializeImage(image));
      else if (image.status === "deleted") payload.deletedImages!.push(buildDeletedElement(image));
    });
    dirtyTextBoxIdsRef.current.forEach((id) => {
      const textBox = textBoxesByIdRef.current.get(id);
      if (!textBox) return;
      if (textBox.status === "new") payload.addedTextBoxes!.push(serializeTextBox(textBox));
      else if (textBox.status === "modified") payload.modifiedTextBoxes!.push(serializeTextBox(textBox));
      else if (textBox.status === "deleted") payload.deletedTextBoxes!.push(buildDeletedElement(textBox));
    });
    return payload;
  }, []);

  const applyCanvasDraft = useCallback(async (
    draft: CanvasLocalDraft,
    targetCanvasId: string | null,
    signal?: AbortSignal,
  ) => {
    if (!isScopeCurrent() || signal?.aborted || canvasIdRef.current !== targetCanvasId) return false;
    initializedCanvasIdRef.current = targetCanvasId;
    const imagePlaceholders = draft.images.map((image) => ({ ...image, image: new Image() }));
    drawnLinesRef.current = draft.lines;
    imagesRef.current = imagePlaceholders;
    textBoxesRef.current = draft.textBoxes;
    setDrawnLines(draft.lines);
    setTextBoxes(draft.textBoxes);
    setImages(imagePlaceholders);

    await Promise.all(draft.images.map(async (imageData) => {
      const hydratedImage = await hydrateImageElement(imageData, CANVAS_API_URL, signal);
      if (!isScopeCurrent() || signal?.aborted || canvasIdRef.current !== targetCanvasId) return;
      setImages((current) => current.map((image) => (
        image.id === hydratedImage.id ? hydratedImage : image
      )));
    }));
    if (!isScopeCurrent() || signal?.aborted || canvasIdRef.current !== targetCanvasId) return false;
    return true;
  }, [CANVAS_API_URL, setDrawnLines, setImages, setTextBoxes, isScopeCurrent]);

  const commitSavedCanvasState = useCallback(() => {
    const savedLines = markLinesSaved(drawnLinesRef.current);
    const savedImages = markImagesSaved(imagesRef.current);
    const savedTextBoxes = markTextBoxesSaved(textBoxesRef.current);

    drawnLinesRef.current = savedLines;
    imagesRef.current = savedImages;
    textBoxesRef.current = savedTextBoxes;

    setDrawnLines(savedLines);
    setImages(savedImages);
    setTextBoxes(savedTextBoxes);
    writeCanvasLocalDraft(canvasIdRef.current, serializeCanvasDraft(
      savedLines, savedImages, savedTextBoxes, serverRevisionRef.current,
    ));
  }, [setDrawnLines, setImages, setTextBoxes]);

  const fetchCanvasData = useCallback(async (
    targetCanvasId: string | null,
    requestId: string,
    trigger: CanvasLoadTrigger,
    signal: AbortSignal,
  ): Promise<CanvasLoadData> => {
    if (!CANVAS_SOCKET_URL) throw new Error("캔버스 소켓 URL이 설정되지 않았습니다.");
    const data = await emitCanvasSocket<CanvasLoadData>(CANVAS_SOCKET_URL, "canvas:load", {
      authorization: authHeaders().Authorization,
      canvasId: targetCanvasId,
      requestId,
      trigger,
    }, {
      signal,
      timeoutMs: CANVAS_SOCKET_LOAD_TIMEOUT_MS,
    });
    return normalizeCanvasLoadData(data);
  }, [CANVAS_SOCKET_URL]);

  const hasPendingLocalChanges = useCallback(() => {
    const payload = buildCurrentSavePayload();
    return hasCanvasSavePayloadChanges(payload) || getCanvasRetryCount(canvasIdRef.current) > 0;
  }, [buildCurrentSavePayload]);

  // 증분 동기화: canvas:changed에 실려 온 변경분을 전체 리로드 없이 반영한다.
  // 요소는 id 기준 upsert(원격 상태 = unchanged), 삭제는 id로 제거한다.
  const applyRemoteChanges = useCallback(async (changes: CanvasSavePayload, revision?: number) => {
    if (!isScopeCurrent() || conflictRef.current) return;
    const targetCanvasId = canvasIdRef.current;
    const upsertById = <T extends { id: string }>(current: T[], upserts: T[], deletedIds: Set<string>): T[] => {
      const upsertIds = new Set(upserts.map((item) => item.id));
      return [...current.filter((item) => !deletedIds.has(item.id) && !upsertIds.has(item.id)), ...upserts];
    };

    const lineUpserts: LineElement[] = [...(changes.addedLines ?? []), ...(changes.modifiedLines ?? [])]
      .map((line) => ({ ...line, status: "unchanged" as const }));
    const deletedLineIds = new Set((changes.deletedLines ?? []).map((line) => line.id));
    if (lineUpserts.length > 0 || deletedLineIds.size > 0) {
      setDrawnLines((current) => upsertById(current, lineUpserts, deletedLineIds));
    }

    const textBoxUpserts: TextBoxElement[] = [...(changes.addedTextBoxes ?? []), ...(changes.modifiedTextBoxes ?? [])]
      .map((textBox) => ({ ...textBox, status: "unchanged" as const }));
    const deletedTextBoxIds = new Set((changes.deletedTextBoxes ?? []).map((textBox) => textBox.id));
    if (textBoxUpserts.length > 0 || deletedTextBoxIds.size > 0) {
      setTextBoxes((current) => upsertById(current, textBoxUpserts, deletedTextBoxIds));
    }

    const imageUpserts = [...(changes.addedImages ?? []), ...(changes.modifiedImages ?? [])];
    const deletedImageIds = new Set((changes.deletedImages ?? []).map((image) => image.id));
    if (imageUpserts.length > 0 || deletedImageIds.size > 0) {
      const placeholders: ImageElement[] = imageUpserts.map((imageData) => ({
        ...imageData,
        image: new Image(),
        status: "unchanged" as const,
      }));
      setImages((current) => upsertById(current, placeholders, deletedImageIds));
      await Promise.all(imageUpserts.map(async (imageData) => {
        try {
          const hydrated = await hydrateImageElement(imageData, CANVAS_API_URL);
          if (!isScopeCurrent() || conflictRef.current || canvasIdRef.current !== targetCanvasId) return;
          setImages((current) => current.map((image) => (
            image.id === hydrated.id ? { ...hydrated, status: "unchanged" as const } : image
          )));
        } catch {
          // 이미지 로드 실패 시 플레이스홀더 유지 — 다음 전체 로드에서 복구된다.
        }
      }));
    }

    if (isScopeCurrent() && canvasIdRef.current === targetCanvasId && typeof revision === "number") serverRevisionRef.current = revision;
  }, [CANVAS_API_URL, setDrawnLines, setImages, setTextBoxes, isScopeCurrent]);

  const drainRemoteChangeQueue = useCallback(() => {
    if (!isScopeCurrent() || conflictRef.current || saveInFlightRef.current || remoteApplyInFlightRef.current || hasPendingLocalChanges()) return false;
    let nextEvent = remoteChangeQueueRef.current.shift();
    while (nextEvent && typeof nextEvent.revision === "number" && nextEvent.revision <= serverRevisionRef.current) {
      nextEvent = remoteChangeQueueRef.current.shift();
    }
    if (!nextEvent) return false;

    streamCallbacksRef.current.onRemoteCanvasChanged?.(nextEvent);

    // 델타가 있고 revision이 직전과 연속이면 증분 적용, 아니면(갭·대형 mutation) 전체 리로드 폴백.
    const inlineChanges = nextEvent.changes;
    if (inlineChanges && typeof nextEvent.revision === "number" && nextEvent.revision === serverRevisionRef.current + 1) {
      remoteApplyInFlightRef.current = true;
      void applyRemoteChanges(inlineChanges, nextEvent.revision).finally(() => {
        remoteApplyInFlightRef.current = false;
        window.setTimeout(() => drainRemoteChangeQueueRef.current(), 0);
      });
      return true;
    }

    void handleLoadRef.current?.("remote");
    return true;
  }, [applyRemoteChanges, hasPendingLocalChanges, isScopeCurrent]);

  useEffect(() => {
    drainRemoteChangeQueueRef.current = drainRemoteChangeQueue;
  }, [drainRemoteChangeQueue]);

  const retryPendingSaves = useCallback(async (options?: { skipInFlightGuard?: boolean }) => {
    if (!CANVAS_SOCKET_URL || !isScopeCurrent() || conflictRef.current) return;
    if (initializedCanvasIdRef.current !== (canvasIdRef.current ?? null)) return;

    if (!options?.skipInFlightGuard) {
      pendingSaveTriggersRef.current = enqueueUniqueByPriority(
        pendingSaveTriggersRef.current, "retry", SAVE_TRIGGER_PRIORITY,
      );
    }

    if (!options?.skipInFlightGuard) {
      if (saveInFlightRef.current) {
        saveAgainRequestedRef.current = true;
        return;
      }
      saveInFlightRef.current = true;
    }

    try {
      const targetCanvasId = canvasIdRef.current ?? null;
      const now = Date.now();
      const queue = readCanvasRetryQueue()
        .filter((item) => item.canvasId === targetCanvasId && !item.blocked && item.nextAttemptAt <= now)
        .sort((left, right) => right.priority - left.priority || left.createdAt - right.createdAt)
        .slice(0, 1);
      if (queue.length === 0) {
        const pendingRetries = getCanvasRetryCount(targetCanvasId);
        const blocked = readCanvasRetryQueue().find((item) => item.canvasId === targetCanvasId && item.blocked);
        setSaveState((current) => ({
          ...current,
          pendingRetries,
          status: pendingRetries > 0 ? "failed" : current.status === "failed" ? "idle" : "saved",
          message: blocked ? "자동 재시도 중단 · 초안 보존됨" : pendingRetries > 0 ? "재시도 대기" : current.status === "failed" ? "저장 대기" : "저장 완료",
          lastSavedAt: pendingRetries > 0 || current.status === "failed" ? current.lastSavedAt : Date.now(),
        }));
        return;
      }

      setSaveState((current) => ({
        ...current,
        status: "retrying",
        message: "재시도 중",
        pendingRetries: queue.length,
      }));

      retryCancelRequestedRef.current = false;
      const retryAbortController = new AbortController();
      retryAbortControllerRef.current = retryAbortController;
      const revisionAtRetryStart = localRevisionRef.current;
      let failedCount = 0;
      for (const item of queue) {
        if (retryCancelRequestedRef.current || retryAbortController.signal.aborted) break;
        const currentPayload = buildCurrentSavePayload();
        const hasChangesAfterQueuedMutation = JSON.stringify(currentPayload) !== JSON.stringify(item.payload);
        updateCanvasRetryQueueItem(item.id, { lastError: undefined });
        const payloadToSave = hasChangesAfterQueuedMutation ? currentPayload : item.payload;
        const mutationIdToSave = hasChangesAfterQueuedMutation ? uuidv4() : item.mutationId;

        if (!hasCanvasSavePayloadChanges(payloadToSave)) {
          removeCanvasRetryQueueItem(item.id);
          continue;
        }

        if (hasChangesAfterQueuedMutation) {
          updateCanvasRetryQueueItem(item.id, {
            blocked: false,
            mutationId: mutationIdToSave,
            payload: payloadToSave,
            priority: Math.max(item.priority ?? 40, SAVE_TRIGGER_PRIORITY.retry),
          });
        }

        try {
          // A reconnect/old queue is not proof that the remote revision stayed put.
          const remote=await fetchCanvasData(item.canvasId,uuidv4(),'remote',retryAbortController.signal);
          if (!isScopeCurrent() || canvasIdRef.current!==targetCanvasId) return;
          const base=item.baseRevision ?? draftBaseRevision();
          if (canvasDraftConflicts({lines:[],images:[],textBoxes:[],hasPendingChanges:true,updatedAt:0,baseRevision:base},remote.revision ?? 0)) {
            const current=serializeCanvasDraft(drawnLinesRef.current,imagesRef.current,textBoxesRef.current,base);
            const draft=current.hasPendingChanges ? current : recoverQueuedCanvasDraft(applyServerCanvasStatus(remote),[payloadToSave],base);
            conflictRef.current={canvasId:targetCanvasId,baseRevision:base};
            writeCanvasLocalDraft(targetCanvasId,draft,{immediate:true});
            await applyCanvasDraft(draft,targetCanvasId,retryAbortController.signal);
            setSaveState(state=>({...state,status:'conflict',message:'다른 기기의 변경과 충돌 · 초안 사본으로 복구해주세요'}));
            return;
          }
          const response = await saveCanvasPayload(CANVAS_SOCKET_URL, item.canvasId, payloadToSave, mutationIdToSave, "retry", {
            signal: retryAbortController.signal,
          });
          if (!isScopeCurrent()) return;
          serverRevisionRef.current = response.revision;
          removeCanvasRetryQueueItem(item.id);
        } catch (error) {
          if (!isScopeCurrent()) return;
          if (retryCancelRequestedRef.current || isAbortError(error)) break;
          failedCount += 1;
          // 멱등성 충돌(409)은 같은 mutationId로 재시도하면 영원히 같은 409다(백오프만 늘어난다).
          // 되돌리기처럼 대기 중 payload가 바뀌면 이 상태가 되므로, 새 mutationId를 발급해
          // 백오프 없이 즉시 다시 시도한다. 서버 반영은 upsert/삭제 모두 멱등이라 중복 적용도 안전하다.
          const conflicted = isCanvasMutationConflict(error);
          updateCanvasRetryQueueItem(item.id, {
            blocked: isCanvasPermanentSaveError(error),
            attempts: conflicted ? item.attempts : item.attempts + 1,
            lastError: error instanceof Error ? error.message : String(error),
            ...(conflicted
              ? { mutationId: uuidv4(), nextAttemptAt: Date.now() }
              : { nextAttemptAt: Date.now() + Math.min(300_000, 2 ** Math.min(item.attempts + 1, 8) * 1000) }),
          });
        }
      }

      const remainingRetries = getCanvasRetryCount(targetCanvasId);
      if (retryCancelRequestedRef.current || retryAbortController.signal.aborted) {
        setSaveState((current) => ({
          ...current,
          status: "idle",
          message: "재시도 취소됨",
          pendingRetries: remainingRetries,
        }));
        return;
      }

      if (failedCount > 0) {
        setSaveState((current) => ({
          ...current,
          status: "failed",
          message: readCanvasRetryQueue().some((item) => item.canvasId === targetCanvasId && item.blocked)
            ? "자동 재시도 중단 · 초안 보존됨" : "저장 실패",
          pendingRetries: remainingRetries,
          lastErrorAt: Date.now(),
        }));
        return;
      }

      if (saveAgainRequestedRef.current || localRevisionRef.current !== revisionAtRetryStart) {
        saveAgainRequestedRef.current = true;
        setSaveState((current) => ({
          ...current,
          status: "pending",
          message: "저장할 변경 있음",
          pendingRetries: remainingRetries,
        }));
        return;
      }

      commitSavedCanvasState();

      setSaveState((current) => ({
        ...current,
        status: "saved",
        message: "저장 완료",
        pendingRetries: remainingRetries,
        lastSavedAt: Date.now(),
      }));
      void publishSyncEvent("canvas", "canvas-saved");
    } finally {
      retryAbortControllerRef.current = null;
      if (!options?.skipInFlightGuard) {
        saveInFlightRef.current = false;
        drainRemoteChangeQueue();
        if (saveAgainRequestedRef.current && !retryCancelRequestedRef.current) {
          saveAgainRequestedRef.current = false;
          window.setTimeout(() => {
            void handleSaveRef.current?.("auto");
          }, 0);
        }
      }
    }
  }, [CANVAS_SOCKET_URL, buildCurrentSavePayload, commitSavedCanvasState, drainRemoteChangeQueue, isScopeCurrent,fetchCanvasData,draftBaseRevision,applyCanvasDraft]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!navigator.onLine || saveInFlightRef.current) return;
      const hasDueRetry = readCanvasRetryQueue().some((item) => (
        item.canvasId === (canvasIdRef.current ?? null) && !item.blocked && item.nextAttemptAt <= Date.now()
      ));
      if (hasDueRetry) void retryPendingSaves();
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [retryPendingSaves]);

  const handleSave = useCallback(async (trigger: CanvasSaveTrigger = "manual") => {
    if (!isScopeCurrent() || conflictRef.current) return;
    if (initializedCanvasIdRef.current !== (canvasIdRef.current ?? null)) return;
    if (!CANVAS_SOCKET_URL) {
      console.warn("캔버스 소켓 URL이 설정되지 않아 저장을 건너뜁니다.");
      return;
    }

    pendingSaveTriggersRef.current = enqueueUniqueByPriority(
      pendingSaveTriggersRef.current, trigger, SAVE_TRIGGER_PRIORITY,
    );

    if (saveInFlightRef.current) {
      saveAgainRequestedRef.current = true;
      return;
    }

    saveInFlightRef.current = true;
    setSaveState((current) => ({
      ...current,
      status: "saving",
      message: "저장 중",
      pendingRetries: getCanvasRetryCount(canvasIdRef.current),
    }));

    let activeMutation: { mutationId: string; payload: CanvasSavePayload } | null = null;
    // 저장이 진행되는 동안 캔버스가 전환될 수 있으므로(느린 네트워크에서 실제 발생)
    // 시도 시점의 canvasId를 캡처해 실패 큐 귀속과 성공 후 정리를 그 캔버스에만 적용한다.
    let attemptCanvasId: string | null = canvasIdRef.current ?? null;
    try {
      do {
        if (!isScopeCurrent() || conflictRef.current) return;
        saveAgainRequestedRef.current = false;
        const currentTrigger = pendingSaveTriggersRef.current.shift() ?? trigger;
        attemptCanvasId = canvasIdRef.current ?? null;

        if (getCanvasRetryCount(attemptCanvasId) > 0) {
          const queued = addCanvasRetryQueueItem(attemptCanvasId, buildCurrentSavePayload(),undefined,undefined,SAVE_TRIGGER_PRIORITY[trigger],draftBaseRevision());
          if (currentTrigger === "manual") {
            updateCanvasRetryQueueItem(queued.id, { blocked: false, nextAttemptAt: Date.now() });
          }
          await retryPendingSaves({ skipInFlightGuard: true });
          if (getCanvasRetryCount(attemptCanvasId) > 0) return;
          if (saveAgainRequestedRef.current) continue;
        }

        const payload = buildCurrentSavePayload();
        if (!hasCanvasSavePayloadChanges(payload)) {
          return;
        }

        const revisionAtSaveStart = localRevisionRef.current;
        const mutationId = uuidv4();
        activeMutation = { mutationId, payload };
        const response = await saveCanvasPayload(CANVAS_SOCKET_URL, attemptCanvasId, payload, mutationId, currentTrigger);
        if (!isScopeCurrent()) return;
        activeMutation = null;

        if (canvasIdRef.current !== attemptCanvasId) {
          saveAgainRequestedRef.current = true;
          continue;
        }
        serverRevisionRef.current = response.revision;

        if (localRevisionRef.current !== revisionAtSaveStart) {
          saveAgainRequestedRef.current = true;
          continue;
        }

        void publishSyncEvent("canvas", "canvas-saved");
        commitSavedCanvasState();
        clearCanvasRetryQueue(attemptCanvasId);
        setSaveState((current) => ({
          ...current,
          status: "saved",
          message: "저장 완료",
          pendingRetries: getCanvasRetryCount(canvasIdRef.current),
          lastSavedAt: Date.now(),
        }));
      } while (saveAgainRequestedRef.current);
    } catch (err) {
      if (!isScopeCurrent()) return;
      console.error("저장 실패:", err);
      void appendCanvasDeviceDiagnostic({
        id: uuidv4(),
        operation: "SAVE",
        canvasId: attemptCanvasId,
        message: err instanceof Error ? err.message : String(err),
        createdAt: Date.now(),
      });
      const payload = activeMutation?.payload
        ?? (canvasIdRef.current === attemptCanvasId ? buildCurrentSavePayload() : null);
      if (payload && hasCanvasSavePayloadChanges(payload)) {
        const queued = addCanvasRetryQueueItem(
          attemptCanvasId,
          payload,
          err instanceof Error ? err.message : String(err),
          // 409로 실패한 mutationId를 큐에 그대로 넣으면 재시도가 같은 409를 무한 반복한다.
          // 충돌한 경우엔 새 mutationId로 큐에 넣어 다음 시도가 성공할 수 있게 한다.
          isCanvasMutationConflict(err) ? uuidv4() : activeMutation?.mutationId,
          SAVE_TRIGGER_PRIORITY[trigger],
          draftBaseRevision(),
        );
        updateCanvasRetryQueueItem(queued.id, {
          blocked: isCanvasPermanentSaveError(err),
          attempts: queued.attempts + 1,
          nextAttemptAt: Date.now() + 2_000,
        });
        if (canvasIdRef.current === attemptCanvasId) {
          writeCanvasLocalDraft(attemptCanvasId, serializeCanvasDraft(
            drawnLinesRef.current, imagesRef.current, textBoxesRef.current, draftBaseRevision(),
          ), { immediate: true });
        }
      }
      setSaveState((current) => ({
        ...current,
        status: "failed",
        message: isCanvasPermanentSaveError(err) ? "자동 재시도 중단 · 초안 보존됨" : "저장 실패",
        pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        lastErrorAt: Date.now(),
      }));
    } finally {
      saveInFlightRef.current = false;
      drainRemoteChangeQueue();
    }
  }, [CANVAS_SOCKET_URL, buildCurrentSavePayload, commitSavedCanvasState, drainRemoteChangeQueue, retryPendingSaves, isScopeCurrent, draftBaseRevision]);

  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  const requestSave = useCallback(() => {
    if (!CANVAS_SOCKET_URL || !isScopeCurrent() || conflictRef.current) return;
    if (initializedCanvasIdRef.current !== (canvasIdRef.current ?? null)) return;

    const payload = buildCurrentSavePayload();
    if (!hasCanvasSavePayloadChanges(payload) && getCanvasRetryCount(canvasIdRef.current) === 0) return;

    setSaveState((current) => ({
      ...current,
      status: current.status === "saving" || current.status === "retrying" ? current.status : "pending",
      message: current.status === "saving" || current.status === "retrying" ? current.message : "저장 중",
      pendingRetries: getCanvasRetryCount(canvasIdRef.current),
    }));

    if (autoSaveTimerRef.current !== null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void handleSave("auto");
    }, 800);
  }, [CANVAS_SOCKET_URL, buildCurrentSavePayload, handleSave, isScopeCurrent]);

  const cancelPendingSaves = useCallback(() => {
    if (!isScopeCurrent() || conflictRef.current) return;
    retryCancelRequestedRef.current = true;
    retryAbortControllerRef.current?.abort();
    clearCanvasRetryQueue(canvasIdRef.current);
    saveAgainRequestedRef.current = false;

    setSaveState((current) => ({
      ...current,
      status: "idle",
      message: "재시도 취소됨",
      pendingRetries: getCanvasRetryCount(canvasIdRef.current),
    }));
  }, [isScopeCurrent]);

  const handleFlushSave = useCallback(() => {
    if (!CANVAS_SOCKET_URL) return;
    // Initial/StrictMode cleanup must not replace a persisted draft with empty state.
    if (initializedCanvasIdRef.current !== (canvasIdRef.current ?? null)) return;
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    writeCanvasLocalDraft(canvasIdRef.current, serializeCanvasDraft(
      drawnLinesRef.current, imagesRef.current, textBoxesRef.current, draftBaseRevision(),
    ), { immediate: true,scope:persistenceScopeRef.current,ownerId:persistenceOwnerRef.current });
    if (!isScopeCurrent() || conflictRef.current) return;
    const payload = buildCurrentSavePayload();
    if (!hasCanvasSavePayloadChanges(payload)) return;

    addCanvasRetryQueueItem(canvasIdRef.current, payload, undefined, undefined, SAVE_TRIGGER_PRIORITY.flush,draftBaseRevision());
    setSaveState((current) => ({
      ...current,
      status: "saving",
      message: "저장 중",
      pendingRetries: getCanvasRetryCount(canvasIdRef.current),
    }));

    void handleSave("flush");
  }, [CANVAS_SOCKET_URL, buildCurrentSavePayload, handleSave, draftBaseRevision, isScopeCurrent]);


  const performLoad = useCallback(async (
    targetCanvasId: string | null,
    requestId: string,
    trigger: CanvasLoadTrigger,
    signal: AbortSignal,
  ) => {
    await queueHydrationRef.current;
    if (!isScopeCurrent()) return;
    let localDraft = await readCanvasLocalDraftPersisted(targetCanvasId);
    try {
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
      setSaveState((current) => ({
        ...current,
        status: "loading",
        message: "불러오는 중",
        pendingRetries: getCanvasRetryCount(canvasIdRef.current),
      }));

      if (!CANVAS_SOCKET_URL) {
        console.warn("캔버스 소켓 URL이 설정되지 않아 빈 캔버스를 사용합니다.");
        if (localDraft) {
          await applyCanvasDraft(localDraft, targetCanvasId, signal);
          if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
          setSaveState((current) => ({
            ...current,
            status: localDraft?.hasPendingChanges ? "pending" : "idle",
            message: localDraft?.hasPendingChanges ? "저장할 변경 있음" : "저장 대기",
            pendingRetries: getCanvasRetryCount(canvasIdRef.current),
          }));
          return;
        }
        initializedCanvasIdRef.current = targetCanvasId;
        setDrawnLines([]);
        setImages([]);
        setTextBoxes([]);
        setSaveState((current) => ({
          ...current,
          status: "idle",
          message: "저장 대기",
          pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        }));
        return;
      }

      const data = await fetchCanvasData(targetCanvasId, requestId, trigger, signal);
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
      console.log("불러온 데이터:", data);

      const remoteRevision = typeof data.revision === "number" ? data.revision : 0;
      if (targetCanvasId && !isDeviceOnly()) {
        const legacy = await readAuthorizedLegacyCanvasState<CanvasLocalDraft>(targetCanvasId);
        if (!isScopeCurrent() || signal.aborted) return;
        const validLegacy = legacy.draft && Array.isArray(legacy.draft.lines) && Array.isArray(legacy.draft.images) && Array.isArray(legacy.draft.textBoxes) ? legacy.draft : null;
        if (!localDraft && validLegacy) {
          localDraft={...validLegacy,ownerId:deviceOwner()};
          await writeCanvasDraft(targetCanvasId,localDraft,persistenceScopeRef.current);
        }
        if (!localDraft && legacy.queue.length) {
          const items = (legacy.queue as CanvasRetryQueueItem[]).filter(item=>item.payload && typeof item.payload === 'object');
          if (items.length) {
            localDraft=recoverQueuedCanvasDraft(applyServerCanvasStatus(data),items.map(item=>item.payload));
            await writeCanvasDraft(targetCanvasId,localDraft,persistenceScopeRef.current);
          }
        }
        if (validLegacy || legacy.queue.length) await markCanvasLegacyStateMigrated(targetCanvasId,persistenceScopeRef.current);
      }
      if (!localDraft) {
        const queued = readCanvasRetryQueue().filter(item=>item.canvasId===targetCanvasId && hasCanvasSavePayloadChanges(item.payload));
        if (queued.length) localDraft=recoverQueuedCanvasDraft(applyServerCanvasStatus(data),queued.map(item=>item.payload),queued[0].baseRevision);
      }
      if (!isScopeCurrent() || signal.aborted) return;
      const draftConflictsWithRemote = canvasDraftConflicts(localDraft,remoteRevision);
      conflictRef.current = draftConflictsWithRemote ? {canvasId:targetCanvasId,baseRevision:localDraft?.baseRevision} : null;
      serverRevisionRef.current = remoteRevision;

      if (localDraft?.hasPendingChanges) {
        await applyCanvasDraft(localDraft, targetCanvasId, signal);
        if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
        setSaveState((current) => ({
          ...current,
          status: draftConflictsWithRemote ? "conflict" : "pending",
          message: draftConflictsWithRemote ? "다른 기기의 변경과 충돌 · 초안 사본으로 복구해주세요" : "저장할 변경 있음",
          pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        }));
        return;
      }

      await applyCanvasDraft(applyServerCanvasStatus(data), targetCanvasId, signal);
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
      const partialLoad = data.loadStatus === "PARTIAL";
      setSaveState((current) => ({
        ...current,
        status: partialLoad || getCanvasRetryCount(canvasIdRef.current) > 0 ? "failed" : "saved",
        message: partialLoad
          ? data.loadWarnings?.[0] ?? "일부 요소 불러오기 실패"
          : getCanvasRetryCount(canvasIdRef.current) > 0 ? "재시도 대기" : "저장 완료",
        pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        lastSavedAt: Date.now(),
      }));
      void retryPendingSaves();

      console.log("캔버스 데이터 로드 및 적용 완료.");
      window.setTimeout(() => drainRemoteChangeQueue(), 0);
    } catch (error) {
      if (isAbortError(error)) {
        if (loadCancelRequestedRef.current && canvasIdRef.current === targetCanvasId) {
          setSaveState((current) => ({
            ...current,
            status: conflictRef.current ? "conflict" : "idle",
            message: conflictRef.current ? "초안 보존됨 · 서버 상태를 다시 확인해주세요" : "불러오기 취소됨",
            pendingRetries: getCanvasRetryCount(canvasIdRef.current),
          }));
        }
        return;
      }
      console.error("불러오기 실패:", error);
      void appendCanvasDeviceDiagnostic({
        id: uuidv4(),
        operation: "LOAD",
        canvasId: targetCanvasId,
        message: error instanceof Error ? error.message : String(error),
        createdAt: Date.now(),
      });
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
      const failureMessage = getCanvasLoadFailureMessage(error);
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : undefined;
      const accessDenied = status === 401 || status === 403 || status === 404;
      if (localDraft && !accessDenied) {
        if (localDraft.hasPendingChanges) conflictRef.current={canvasId:targetCanvasId,baseRevision:localDraft.baseRevision};
        await applyCanvasDraft(localDraft, targetCanvasId, signal);
        if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return;
        setSaveState((current) => ({
          ...current,
          status: localDraft?.hasPendingChanges ? "conflict" : "failed",
          message: localDraft?.hasPendingChanges ? "서버 상태 확인 필요 · 초안 보존됨" : failureMessage,
          pendingRetries: getCanvasRetryCount(canvasIdRef.current),
          lastErrorAt: Date.now(),
        }));
        return;
      }
      initializedCanvasIdRef.current = undefined;
      setDrawnLines([]);
      setImages([]);
      setTextBoxes([]);
      setSaveState((current) => ({
        ...current,
        status: "failed",
        message: failureMessage,
        pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        lastErrorAt: Date.now(),
      }));
    }
  }, [CANVAS_SOCKET_URL, applyCanvasDraft, drainRemoteChangeQueue, fetchCanvasData, retryPendingSaves, setDrawnLines, setImages, setTextBoxes, isScopeCurrent]);

  const cancelActiveLoadRequest = useCallback((userRequested: boolean) => {
    if (userRequested) {
      loadCancelRequestedRef.current = true;
      loadAgainRequestedRef.current = false;
      pendingLoadTriggersRef.current = [];
    }
    const requestId = activeLoadRequestIdRef.current;
    loadAbortControllerRef.current?.abort();
    if (CANVAS_SOCKET_URL && requestId && !isDeviceOnly()) {
      getCanvasSocket(CANVAS_SOCKET_URL).emit("canvas:load-cancel", { requestId });
    }
  }, [CANVAS_SOCKET_URL]);

  const cancelCanvasLoad = useCallback(() => {
    cancelActiveLoadRequest(true);
  }, [cancelActiveLoadRequest]);

  useEffect(() => () => {
    cancelActiveLoadRequest(false);
  }, [cancelActiveLoadRequest]);

  const handleLoad = useCallback((trigger: CanvasLoadTrigger = "manual"): Promise<void> => {
    pendingLoadTriggersRef.current = enqueueUniqueByPriority(
      pendingLoadTriggersRef.current, trigger, LOAD_TRIGGER_PRIORITY,
    );
    loadAgainRequestedRef.current = true;
    loadCancelRequestedRef.current = false;
    if (loadInFlightRef.current) {
      if (trigger === "selection") cancelActiveLoadRequest(false);
      return loadInFlightRef.current;
    }

    const loadPromise = (async () => {
      do {
        loadAgainRequestedRef.current = false;
        const currentTrigger = pendingLoadTriggersRef.current.shift() ?? trigger;
        const targetCanvasId = canvasIdRef.current ?? null;
        const requestId = uuidv4();
        const abortController = new AbortController();
        activeLoadRequestIdRef.current = requestId;
        loadAbortControllerRef.current = abortController;
        try {
          await performLoad(targetCanvasId, requestId, currentTrigger, abortController.signal);
        } finally {
          if (activeLoadRequestIdRef.current === requestId) {
            activeLoadRequestIdRef.current = null;
            loadAbortControllerRef.current = null;
          }
        }
        if (canvasIdRef.current !== targetCanvasId) {
          loadAgainRequestedRef.current = true;
        }
        if (pendingLoadTriggersRef.current.length > 0) {
          loadAgainRequestedRef.current = true;
        }
      } while (loadAgainRequestedRef.current && !loadCancelRequestedRef.current);
    })().finally(() => {
      loadInFlightRef.current = null;
    });

    loadInFlightRef.current = loadPromise;
    return loadPromise;
  }, [cancelActiveLoadRequest, performLoad]);

  useEffect(() => {
    handleLoadRef.current = handleLoad;
  }, [handleLoad]);

  useEffect(() => {
    if (!CANVAS_SOCKET_URL || !canvasId || isDeviceOnly()) return undefined;

    let isActive = true;
    const socket = getCanvasSocket(CANVAS_SOCKET_URL);
    const handleRemoteCanvasChanged = (event: CanvasChangedEvent) => {
      if (!isActive || !isScopeCurrent() || event?.canvasId !== canvasIdRef.current) return;
      if (conflictRef.current) return;
      if (!saveInFlightRef.current && hasPendingLocalChanges() && typeof event.revision === 'number' && event.revision > serverRevisionRef.current) {
        conflictRef.current={canvasId:canvasIdRef.current ?? null,baseRevision:serverRevisionRef.current};
        setSaveState(current=>({...current,status:'conflict',message:'다른 기기의 변경과 충돌 · 초안 사본으로 복구해주세요'}));
        return;
      }

      remoteChangeQueueRef.current = [...remoteChangeQueueRef.current, event].slice(-50);

      if (saveInFlightRef.current || hasPendingLocalChanges()) {
        setSaveState((current) => ({
          ...current,
          status: current.status === "saving" || current.status === "retrying" ? current.status : "pending",
          message: current.status === "saving" || current.status === "retrying" ? current.message : "원격 변경 대기",
          pendingRetries: getCanvasRetryCount(canvasIdRef.current),
        }));
        return;
      }

      drainRemoteChangeQueue();
    };

    const handleRemoteLineStart = (event: CanvasLineStreamStartEvent) => {
      if (!isActive || event?.canvasId !== canvasIdRef.current) return;
      streamCallbacksRef.current.onLineStreamStart?.(event);
    };
    const handleRemoteLinePoints = (event: CanvasLineStreamPointsEvent) => {
      if (!isActive || event?.canvasId !== canvasIdRef.current) return;
      streamCallbacksRef.current.onLineStreamPoints?.(event);
    };
    const handleRemoteLineEnd = (event: CanvasLineStreamEndEvent) => {
      if (!isActive || event?.canvasId !== canvasIdRef.current) return;
      streamCallbacksRef.current.onLineStreamEnd?.(event);
    };

    const joinRoom = () => {
      void emitCanvasSocket(CANVAS_SOCKET_URL, "canvas:join", {
        authorization: authHeaders().Authorization,
        canvasId,
      }).catch((error) => {
        console.warn("캔버스 실시간 동기화 참여 실패:", error);
      });
    };

    // iPad 등에서 탭 절전으로 소켓이 끊기면 서버 방(room) 멤버십이 사라진다.
    // 재연결마다 다시 참여하고, 끊긴 동안 놓친 원격 변경을 한 번 동기화한다.
    let hasJoinedOnce = false;
    const handleSocketConnect = () => {
      if (!isActive) return;
      joinRoom();
      if (hasJoinedOnce) {
        if (getCanvasRetryCount(canvasIdRef.current) > 0) {
          // Reconnection alone does not prove that a failed payload can be saved.
          void retryPendingSaves().then(() => {
            if (!saveInFlightRef.current && !hasPendingLocalChanges()) {
              void handleLoadRef.current?.("remote");
            }
          });
        } else if (!saveInFlightRef.current && !hasPendingLocalChanges()) {
          void handleLoadRef.current?.("remote");
        }
      }
      hasJoinedOnce = true;
    };

    socket.on("canvas:changed", handleRemoteCanvasChanged);
    socket.on("canvas:line-start", handleRemoteLineStart);
    socket.on("canvas:line-points", handleRemoteLinePoints);
    socket.on("canvas:line-end", handleRemoteLineEnd);
    socket.on("connect", handleSocketConnect);
    if (socket.connected) handleSocketConnect();

    return () => {
      isActive = false;
      socket.off("canvas:changed", handleRemoteCanvasChanged);
      socket.off("canvas:line-start", handleRemoteLineStart);
      socket.off("canvas:line-points", handleRemoteLinePoints);
      socket.off("canvas:line-end", handleRemoteLineEnd);
      socket.off("connect", handleSocketConnect);
      socket.emit("canvas:leave", {
        authorization: authHeaders().Authorization,
        canvasId,
      });
    };
  }, [CANVAS_SOCKET_URL, canvasId, drainRemoteChangeQueue, hasPendingLocalChanges, retryPendingSaves, isScopeCurrent]);

  const streamLineStart = useCallback((line: Omit<LineElement, "status">) => {
    if (!CANVAS_SOCKET_URL || !canvasIdRef.current || !isScopeCurrent() || conflictRef.current) return;
    emitCanvasStream(CANVAS_SOCKET_URL, "canvas:line-start", {
      authorization: authHeaders().Authorization,
      canvasId: canvasIdRef.current,
      line,
    });
  }, [CANVAS_SOCKET_URL, isScopeCurrent]);

  const flushStreamLinePoints = useCallback((lineId?: string) => {
    if (!CANVAS_SOCKET_URL || !canvasIdRef.current || !isScopeCurrent() || conflictRef.current) return;
    const entries = lineId
      ? [[lineId, streamedPointsByLineRef.current.get(lineId) ?? []] as const]
      : [...streamedPointsByLineRef.current.entries()];
    entries.forEach(([targetLineId, points]) => {
      if (points.length === 0) return;
      streamedPointsByLineRef.current.delete(targetLineId);
      emitCanvasStream(CANVAS_SOCKET_URL, "canvas:line-points", {
        authorization: authHeaders().Authorization,
        canvasId: canvasIdRef.current,
        lineId: targetLineId,
        points,
      });
    });
  }, [CANVAS_SOCKET_URL, isScopeCurrent]);

  const streamLinePoints = useCallback((lineId: string, points: LineElement["points"]) => {
    if (!CANVAS_SOCKET_URL || !canvasIdRef.current || !isScopeCurrent() || conflictRef.current || points.length === 0) return;
    const pending = streamedPointsByLineRef.current.get(lineId) ?? [];
    streamedPointsByLineRef.current.set(lineId, [...pending, ...points]);
    if (streamPointsFrameRef.current !== null) return;
    streamPointsFrameRef.current = window.requestAnimationFrame(() => {
      streamPointsFrameRef.current = null;
      flushStreamLinePoints();
    });
  }, [CANVAS_SOCKET_URL, flushStreamLinePoints, isScopeCurrent]);

  const streamLineEnd = useCallback((line: Omit<LineElement, "status">) => {
    if (!CANVAS_SOCKET_URL || !canvasIdRef.current || !isScopeCurrent() || conflictRef.current) return;
    flushStreamLinePoints(line.id);
    emitCanvasStream(CANVAS_SOCKET_URL, "canvas:line-end", {
      authorization: authHeaders().Authorization,
      canvasId: canvasIdRef.current,
      lineId: line.id,
      line,
    });
  }, [CANVAS_SOCKET_URL, flushStreamLinePoints, isScopeCurrent]);

  useEffect(() => () => {
    if (streamPointsFrameRef.current !== null) window.cancelAnimationFrame(streamPointsFrameRef.current);
    flushStreamLinePoints();
  }, [flushStreamLinePoints]);


  const addImageFile = useCallback(async (
    file: File,
    placementCenter?: { x: number; y: number },
  ) => {
    if (!file || !isScopeCurrent()) return;
    const targetCanvasId = canvasIdRef.current;

    try {
      const uploadedAsset = await uploadCanvasAsset(CANVAS_API_URL, CANVAS_SOCKET_URL, file);
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return null;
      const uploadedAssetUrl = buildCanvasAssetProxyUrl(CANVAS_API_URL, uploadedAsset?.id);
      const imageUrl = uploadedAssetUrl || uploadedAsset?.url || await readFileAsDataUrl(file);
      let normalizedImageUrl = imageUrl;
      let img: HTMLImageElement;
      try {
        img = await loadImage(imageUrl);
      } catch (error) {
        const fallbackUrl = buildCanvasAssetProxyUrl(CANVAS_API_URL, uploadedAsset?.id);
        if (!fallbackUrl) throw error;
        img = await loadImage(fallbackUrl);
        normalizedImageUrl = fallbackUrl;
      }
      if (!isScopeCurrent() || canvasIdRef.current !== targetCanvasId) return null;
      const imgElement: ImageElement = {
        id: uuidv4(), // 이미지에도 고유 ID 부여
        image: img,
        url: normalizedImageUrl,
        assetId: uploadedAsset?.id,
        objectKey: uploadedAsset?.objectKey,
        contentType: uploadedAsset?.contentType,
        byteSize: uploadedAsset?.byteSize,
        x: 0,
        y: 0,
        width: img.width * 0.5,
        height: img.height * 0.5,
        status: 'new' // 새로 추가된 상태
      };
      const center = placementCenter ?? { x: 100 + imgElement.width / 2, y: 100 + imgElement.height / 2 };
      imgElement.x = center.x - imgElement.width / 2;
      imgElement.y = center.y - imgElement.height / 2;
      setImages(prev => [...prev, imgElement]);
      return imgElement;
    } catch (err) {
      console.error("업로드 실패:", err);
      return null;
    }
  }, [CANVAS_API_URL, CANVAS_SOCKET_URL, setImages, isScopeCurrent]);

  const handleImageUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>,
    placementCenter?: { x: number; y: number },
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await addImageFile(file, placementCenter);
    e.target.value = "";
  }, [addImageFile]);

  const recoverConflictCopy = useCallback(async ():Promise<string|null> => {
    if (!conflictRef.current || !isScopeCurrent() || recoveringCopyRef.current) return null;
    recoveringCopyRef.current=true;
    const originalId=canvasIdRef.current;
    const local=serializeCanvasDraft(drawnLinesRef.current,imagesRef.current,textBoxesRef.current,draftBaseRevision());
    const copy:CanvasLocalDraft={...local,ownerId:deviceOwner(),baseRevision:0,hasPendingChanges:true,
      lines:local.lines.filter(item=>item.status!=='deleted').map(item=>({...item,status:'new'})),
      images:local.images.filter(item=>item.status!=='deleted').map(item=>({...item,status:'new'})),
      textBoxes:local.textBoxes.filter(item=>item.status!=='deleted').map(item=>({...item,status:'new'}))};
    try {
      setSaveState(current=>({...current,message:'초안 사본 복구 중'}));
      const id=recoveryCopyIdRef.current ?? (await createCanvasDocument('충돌 초안 복구 사본')).id;
      recoveryCopyIdRef.current=id;
      await writeCanvasDraft(id,copy,persistenceScopeRef.current);
      if (!isScopeCurrent()) return null;
      await saveCanvasPayload(CANVAS_SOCKET_URL,id,{addedLines:copy.lines.map(serializeLine),addedImages:copy.images.map(serializeImage),addedTextBoxes:copy.textBoxes.map(serializeTextBox)},uuidv4(),'manual');
      if (!isScopeCurrent()) return null;
      await removeCanvasDraft(id,persistenceScopeRef.current);
      clearCanvasRetryQueue(originalId);removeCanvasLocalDraft(originalId);
      initializedCanvasIdRef.current=undefined;
      return id;
    } catch {
      if (isScopeCurrent()) setSaveState(current=>({...current,status:'conflict',message:'사본 복구 실패 · 원래 초안과 원격 내용은 보존됨'}));
      return null;
    } finally {recoveringCopyRef.current=false;}
  },[CANVAS_SOCKET_URL,draftBaseRevision,isScopeCurrent]);

  return {
    recoverConflictCopy,
    handleSave,
    requestSave,
    handleLoad,
    cancelCanvasLoad,
    handleImageUpload,
    addImageFile,
    handleFlushSave,
    retryPendingSaves: () => handleSave("manual"),
    cancelPendingSaves,
    saveState,
    streamLineStart,
    streamLinePoints,
    streamLineEnd,
  };
};
