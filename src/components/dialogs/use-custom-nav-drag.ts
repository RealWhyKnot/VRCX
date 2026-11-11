import { reactive } from "vue";
import type { Ref } from "vue";
import { isSortable } from "@dnd-kit/vue/sortable";
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/vue";
import type { NavDragNode, NavDragState, NavLayoutFolder, NavLayoutState, NavVisibleNode } from "./custom-nav-types";
import { buildVisibleNodes, cloneLayout, isFolderEntry, toOptionalId } from "./custom-nav-layout";

type NavDndEntity = {
  id?: string | number;
  index?: number;
};

export function useCustomNavDrag(localLayout: Ref<NavLayoutState[]>, expandedKeys: Ref<string[]>) {
  const dragState = reactive<NavDragState>({
    active: false,
    sourceId: null,
    sourceIsFolder: false,
    overTargetId: null,
    overIsFolder: false,
    lastOverNode: null,
  });

  const resolveNodeFromDnDEntity = (
    entity: NavDndEntity | null | undefined,
    nodes: NavVisibleNode[],
    options: { allowIndexFallback?: boolean } = {}
  ): NavVisibleNode | null => {
    const { allowIndexFallback = true } = options;
    if (!entity) return null;

    if (entity.id !== undefined) {
      const rawId = String(entity.id);
      const normalizedId = rawId.endsWith("__placeholder") ? rawId.slice(0, -"__placeholder".length) : rawId;
      const byId = findVisibleNodeById(normalizedId, nodes);
      if (byId) return byId;
    }

    if (allowIndexFallback && typeof entity.index === "number" && entity.index >= 0 && entity.index < nodes.length) {
      return nodes[entity.index] ?? null;
    }

    return null;
  };

  const resetDragState = () => {
    dragState.active = false;
    dragState.sourceId = null;
    dragState.sourceIsFolder = false;
    dragState.overTargetId = null;
    dragState.overIsFolder = false;
    dragState.lastOverNode = null;
  };

  const findVisibleNodeById = (id: string, nodes: NavVisibleNode[] | null = null): NavVisibleNode | null => {
    const source = nodes ?? buildVisibleNodes(localLayout.value, expandedKeys.value);
    return source.find((node) => node.id === id) ?? null;
  };

  const getNodeIndex = (nodes: NavVisibleNode[], needle: NavVisibleNode | null) => {
    if (!needle) return -1;
    return nodes.findIndex((node) => {
      if (node.type !== needle.type) return false;
      if (node.id !== needle.id) return false;
      return toOptionalId(node.parentId) === toOptionalId(needle.parentId);
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    const { source } = event.operation;
    if (!source) return;

    const nodes = buildVisibleNodes(localLayout.value, expandedKeys.value);
    const sourceNode = resolveNodeFromDnDEntity(source, nodes);
    if (!sourceNode) return;

    dragState.active = true;
    dragState.sourceId = sourceNode.id;
    dragState.sourceIsFolder = sourceNode.type === "folder";
    dragState.lastOverNode = null;
  };

  const onDragOver = (event: DragOverEvent) => {
    const { target } = event.operation;
    if (!target) {
      dragState.overTargetId = null;
      dragState.overIsFolder = false;
      return;
    }

    const nodes = buildVisibleNodes(localLayout.value, expandedKeys.value);
    const rawTargetNode = resolveNodeFromDnDEntity(target, nodes, { allowIndexFallback: false });
    let targetNode = rawTargetNode;

    if (dragState.sourceIsFolder && rawTargetNode?.parentId) {
      const parentFolderNode = findVisibleNodeById(rawTargetNode.parentId, nodes);
      if (parentFolderNode?.type === "folder") {
        targetNode = parentFolderNode;
      }
    }

    dragState.overTargetId = toOptionalId(targetNode?.id);
    dragState.overIsFolder = targetNode?.type === "folder" && !dragState.sourceIsFolder;
    if (!targetNode) return;

    if (dragState.sourceId && targetNode.id === dragState.sourceId) return;

    if (dragState.sourceIsFolder && targetNode.parentId) return;

    dragState.lastOverNode = {
      type: targetNode.type,
      id: targetNode.id,
      parentId: toOptionalId(targetNode.parentId),
    };
  };

  const removeItemFromEntries = (entries: NavLayoutState[], key: string) => {
    for (const [index, entry] of entries.entries()) {
      if (entry.type === "item" && entry.key === key) {
        entries.splice(index, 1);
        return true;
      }
      if (isFolderEntry(entry)) {
        const idx = entry.items.findIndex((k) => k === key);
        if (idx >= 0) {
          entry.items.splice(idx, 1);
          return true;
        }
      }
    }
    return false;
  };

  const moveItemByTarget = (sourceItemId: string, targetNode: NavVisibleNode | null, isMovingDown: boolean) => {
    const entries = cloneLayout(localLayout.value);
    const isRemoved = removeItemFromEntries(entries, sourceItemId);
    if (!isRemoved) return;

    if (!targetNode) {
      entries.push({ type: "item", key: sourceItemId });
      localLayout.value = entries;
      return;
    }

    if (targetNode.type === "folder") {
      const folder = entries.find((e): e is NavLayoutFolder => isFolderEntry(e) && e.id === targetNode.id);
      if (!folder) return;
      folder.items.push(sourceItemId);
      localLayout.value = entries;
      return;
    }

    if (targetNode.parentId) {
      const parentId = targetNode.parentId;
      const folder = entries.find((e): e is NavLayoutFolder => isFolderEntry(e) && e.id === parentId);
      if (!folder) return;
      const targetIdx = folder.items.findIndex((k) => k === targetNode.id);
      if (targetIdx < 0) return;
      const insertAt = targetIdx + (isMovingDown ? 1 : 0);
      folder.items.splice(insertAt, 0, sourceItemId);
      localLayout.value = entries;
      return;
    }

    const targetTopIdx = entries.findIndex((e) => e.type === "item" && e.key === targetNode.id);
    if (targetTopIdx < 0) return;
    const insertAt = targetTopIdx + (isMovingDown ? 1 : 0);
    entries.splice(insertAt, 0, { type: "item", key: sourceItemId });
    localLayout.value = entries;
  };

  const moveFolderByTarget = (sourceFolderId: string, targetNode: NavVisibleNode | null, isMovingDown: boolean, shouldAppendWhenNoTarget = false) => {
    const entries = cloneLayout(localLayout.value);
    const sourceIdx = entries.findIndex((e) => isFolderEntry(e) && e.id === sourceFolderId);
    if (sourceIdx < 0) return;
    const [folder] = entries.splice(sourceIdx, 1);
    if (!folder) return;

    if (targetNode?.parentId) return;

    if (!targetNode) {
      if (!shouldAppendWhenNoTarget) return;
      entries.push(folder);
      localLayout.value = entries;
      return;
    }

    const targetTopIdx = entries.findIndex((e) => {
      if (targetNode.type === "folder") {
        return isFolderEntry(e) && e.id === targetNode.id;
      }
      return e.type === "item" && e.key === targetNode.id;
    });
    if (targetTopIdx < 0) return;

    const insertAt = targetTopIdx + (isMovingDown ? 1 : 0);
    entries.splice(insertAt, 0, folder);
    localLayout.value = entries;
  };

  const onDragEnd = (event: DragEndEvent) => {
    const sourceIdSnapshot = toOptionalId(dragState.sourceId);
    const isSourceFolderSnapshot = dragState.sourceIsFolder;
    const wasOverFolder = dragState.overIsFolder;
    const overTargetId = toOptionalId(dragState.overTargetId);
    const lastOverNodeSnapshot: NavDragNode | null = dragState.lastOverNode
      ? {
          type: dragState.lastOverNode.type,
          id: dragState.lastOverNode.id,
          parentId: toOptionalId(dragState.lastOverNode.parentId),
        }
      : null;

    resetDragState();

    if (event.canceled) return;

    const { source, target } = event.operation;
    if (!isSortable(source)) return;

    const visibleNodes = buildVisibleNodes(localLayout.value, expandedKeys.value);
    const sourceNode =
      (sourceIdSnapshot ? visibleNodes.find((node) => node.id === sourceIdSnapshot && node.type === (isSourceFolderSnapshot ? "folder" : "item")) : null) ??
      resolveNodeFromDnDEntity(source, visibleNodes);
    if (!sourceNode) return;

    const isFolderDrag = sourceNode.type === "folder";
    const resolvedLastOverNode = lastOverNodeSnapshot ? (findVisibleNodeById(lastOverNodeSnapshot.id, visibleNodes) ?? lastOverNodeSnapshot) : null;
    const hoveredTarget = resolveNodeFromDnDEntity(target, visibleNodes, { allowIndexFallback: false });
    let targetNode: NavVisibleNode | null = resolvedLastOverNode ?? hoveredTarget ?? null;

    if (isFolderDrag && targetNode?.parentId) {
      targetNode = findVisibleNodeById(targetNode.parentId, visibleNodes) ?? targetNode;
    }

    if (isFolderDrag && overTargetId && !resolvedLastOverNode) {
      return;
    }

    if (!isFolderDrag && overTargetId && wasOverFolder) {
      targetNode = findVisibleNodeById(overTargetId, visibleNodes) ?? targetNode;
    }

    if (targetNode?.type === sourceNode.type && targetNode.id === sourceNode.id && toOptionalId(targetNode.parentId) === toOptionalId(sourceNode.parentId)) {
      return;
    }

    const sourceNodeIndex = getNodeIndex(visibleNodes, sourceNode);
    const targetNodeIndex = getNodeIndex(visibleNodes, targetNode);
    const isMovingDown = sourceNodeIndex >= 0 && targetNodeIndex >= 0 ? sourceNodeIndex < targetNodeIndex : false;
    if (isFolderDrag) {
      const shouldAppendWhenNoTarget = !overTargetId && !resolvedLastOverNode;
      moveFolderByTarget(sourceNode.id, targetNode, isMovingDown, shouldAppendWhenNoTarget);
    } else {
      moveItemByTarget(sourceNode.id, targetNode, isMovingDown);
    }
  };

  return { dragState, onDragStart, onDragOver, onDragEnd };
}
