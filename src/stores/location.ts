import { defineStore } from "pinia";
import { ref } from "vue";

export const useLocationStore = defineStore("Location", () => {
  const lastLocation = ref({
    date: null,
    location: "",
    name: "",
    playerList: new Map(),
    friendList: new Map(),
  });
  const lastLocationDestination = ref("");
  const lastLocationDestinationTime = ref(0);

  function setLastLocation(value) {
    lastLocation.value = value;
  }

  function setLastLocationLocation(value) {
    lastLocation.value.location = value;
  }

  function setLastLocationDestination(value) {
    lastLocationDestination.value = value;
  }

  function setLastLocationDestinationTime(value) {
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
