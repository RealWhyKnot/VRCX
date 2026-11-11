import { nextTick, reactive, ref } from "vue";
import type { Ref } from "vue";

import dayjs from "dayjs";

import { database } from "../../../services/database";
import { getWorldName } from "../../../shared/utils/world";

import type { InstanceActivityEntry, InstanceActivityRow } from "../activity-types";

function logActivityDetailReadyError(error: unknown) {
  console.error("onActivityDetailReady failed:", error);
}

export function useInstanceActivityData() {
  const activityData = ref<InstanceActivityEntry[]>([]);
  const activityDetailData = ref<InstanceActivityEntry[][]>([]);
  const allDateOfActivity = ref(new Set<string>());
  const worldNameArray = ref<string[]>([]);

  async function getAllDateOfActivity() {
    const utcDateStrings = await database.getDateOfInstanceActivity();
    const uniqueDates = new Set<string>();

    for (const utcString of utcDateStrings) {
      const formattedDate = dayjs.utc(utcString).tz().format("YYYY-MM-DD");
      uniqueDates.add(formattedDate);
    }

    allDateOfActivity.value = reactive(uniqueDates);
  }

  async function getWorldNameData() {
    worldNameArray.value = await Promise.all(
      activityData.value.map(async (item) => {
        return await getWorldName(item.location);
      })
    );
  }

  async function getActivityData(
    selectedDate: Ref<Date>,
    currentUser: Ref<{ id: string }>,
    friends: Ref<ReadonlyMap<string, unknown>>,
    localFavoriteFriends: Ref<ReadonlySet<string>>,
    onActivityDetailReady?: () => void
  ) {
    const localStartDate = dayjs.tz(selectedDate.value).startOf("day").toISOString();
    const localEndDate = dayjs.tz(selectedDate.value).endOf("day").toISOString();
    const dbData = await database.getInstanceActivity(localStartDate, localEndDate);

    const isFriendOrFavorite = (userId: string | null) => userId !== null && (friends.value.has(userId) || localFavoriteFriends.value.has(userId));

    const isFavoriteFriend = (userId: string | null) => userId !== null && localFavoriteFriends.value.has(userId);

    const transformData = (item: InstanceActivityRow): InstanceActivityEntry => ({
      ...item,
      joinTime: dayjs(item.created_at).subtract(item.time ?? 0, "millisecond"),
      leaveTime: dayjs(item.created_at),
      time: item.time !== null && item.time < 0 ? 0 : item.time,
      isFriend: item.user_id === currentUser.value.id ? null : isFriendOrFavorite(item.user_id),
      isFavorite: item.user_id === currentUser.value.id ? null : isFavoriteFriend(item.user_id),
    });

    activityData.value = dbData.currentUserData.map(transformData);

    const transformAndSort = (arr: InstanceActivityRow[]) => {
      return arr.map(transformData).sort((a, b) => {
        const timeDiff = Math.abs(a.joinTime.diff(b.joinTime, "second"));

        return timeDiff < 3 ? a.leaveTime.valueOf() - b.leaveTime.valueOf() : a.joinTime.valueOf() - b.joinTime.valueOf();
      });
    };

    const filterByLocation = (innerArray: InstanceActivityEntry[], locationSet: Set<string>) => {
      return innerArray.every((innerObject) => locationSet.has(innerObject.location));
    };
    const locationSet = new Set(activityData.value.map((item) => item.location));

    const preSplitActivityDetailData = Array.from(dbData.detailData.values())
      .map(transformAndSort)
      .filter((innerArray) => filterByLocation(innerArray, locationSet));

    activityDetailData.value = handleSplitActivityDetailData(preSplitActivityDetailData, currentUser.value.id);

    if (activityDetailData.value.length > 0 && onActivityDetailReady) {
      const onReady = onActivityDetailReady;
      void nextTick(() => {
        onReady();
      }).catch(logActivityDetailReadyError);
    }
  }

  function handleSplitActivityDetailData(activityDetailData: InstanceActivityEntry[][], currentUserId: string): InstanceActivityEntry[][] {
    function countTargetIdOccurrences(innerArray: InstanceActivityEntry[], targetId: string) {
      let count = 0;
      for (const obj of innerArray) {
        if (obj.user_id === targetId) {
          count++;
        }
      }
      return count;
    }

    function areIntervalsOverlapping(objA: InstanceActivityEntry, objB: InstanceActivityEntry) {
      const isObj1EndTimeBeforeObj2StartTime = objA.leaveTime.isBefore(objB.joinTime, "second");
      const isObj2EndTimeBeforeObj1StartTime = objB.leaveTime.isBefore(objA.joinTime, "second");
      return !(isObj1EndTimeBeforeObj2StartTime || isObj2EndTimeBeforeObj1StartTime);
    }

    function buildOverlapGraph(innerArray: InstanceActivityEntry[]) {
      const numObjects = innerArray.length;
      const adjacencyList: number[][] = Array.from({ length: numObjects }, (): number[] => []);

      for (let i = 0; i < numObjects; i++) {
        for (let j = i + 1; j < numObjects; j++) {
          const entryI = innerArray[i];
          const entryJ = innerArray[j];
          if (entryI && entryJ && areIntervalsOverlapping(entryI, entryJ)) {
            adjacencyList[i]?.push(j);
            adjacencyList[j]?.push(i);
          }
        }
      }
      return adjacencyList;
    }

    function depthFirstSearch(nodeIndex: number, visited: boolean[], graph: number[][], component: number[]) {
      visited[nodeIndex] = true;
      component.push(nodeIndex);
      for (const neighborIndex of graph[nodeIndex] ?? []) {
        if (!visited[neighborIndex]) {
          depthFirstSearch(neighborIndex, visited, graph, component);
        }
      }
    }

    function findConnectedComponents(graph: number[][], numNodes: number) {
      const visited = new Array<boolean>(numNodes).fill(false);
      const components: number[][] = [];

      for (let i = 0; i < numNodes; i++) {
        if (!visited[i]) {
          const component: number[] = [];
          depthFirstSearch(i, visited, graph, component);
          components.push(component);
        }
      }
      return components;
    }

    function processOuterArrayWithTargetId(outerArray: InstanceActivityEntry[][], targetId: string) {
      let i = 0;
      while (i < outerArray.length) {
        const currentInnerArray = outerArray[i];
        if (!currentInnerArray) {
          break;
        }
        const targetIdCount = countTargetIdOccurrences(currentInnerArray, targetId);
        if (targetIdCount > 1) {
          const graph = buildOverlapGraph(currentInnerArray);
          const connectedComponents = findConnectedComponents(graph, currentInnerArray.length);
          const newInnerArrays = connectedComponents.map((componentIndices) => {
            return componentIndices.flatMap((index) => {
              const entry = currentInnerArray[index];
              return entry === undefined ? [] : [entry];
            });
          });
          outerArray.splice(i, 1, ...newInnerArrays);
          i += newInnerArrays.length;
        } else {
          i += 1;
        }
      }
      return outerArray.sort((a, b) => (a[0]?.joinTime.valueOf() ?? 0) - (b[0]?.joinTime.valueOf() ?? 0));
    }

    return processOuterArrayWithTargetId(activityDetailData, currentUserId);
  }

  return {
    activityData,
    activityDetailData,
    allDateOfActivity,
    worldNameArray,

    getAllDateOfActivity,
    getWorldNameData,
    getActivityData,
  };
}
