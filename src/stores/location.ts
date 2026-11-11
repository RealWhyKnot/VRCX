import { defineStore } from "pinia";
import { ref } from "vue";

export type LocationPlayer = {
  displayName: string;
  userId: string;
  joinTime: number;
  lastAvatar?: string;
};

export type LastLocation = {
  date: number | null;
  location: string;
  name: string;
  playerList: Map<string, LocationPlayer>;
  friendList: Map<string, LocationPlayer>;
};

export const useLocationStore = defineStore("Location", () => {
  const lastLocation = ref<LastLocation>({
    date: null,
    location: "",
    name: "",
    playerList: new Map(),
    friendList: new Map(),
  });
  const lastLocationDestination = ref("");
  const lastLocationDestinationTime = ref(0);

  function setLastLocation(value: LastLocation) {
    lastLocation.value = value;
  }

  function setLastLocationLocation(value: string) {
    lastLocation.value.location = value;
  }

  function setLastLocationDestination(value: string) {
    lastLocationDestination.value = value;
  }

  function setLastLocationDestinationTime(value: number) {
    lastLocationDestinationTime.value = value;
  }

  return {
    lastLocation,
    lastLocationDestination,
    lastLocationDestinationTime,
    setLastLocation,
    setLastLocationLocation,
    setLastLocationDestination,
    setLastLocationDestinationTime,
  };
});
