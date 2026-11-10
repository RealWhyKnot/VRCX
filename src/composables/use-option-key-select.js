import { computed } from "vue";

export function useOptionKeySelect(optionsMap, getCurrentValue, onSelect) {
  const selectedKey = computed(() => {
    const current = getCurrentValue();
    const found = Object.entries(optionsMap).find(([, option]) => {
      if (option === current) {
        return true;
      }
      return option?.value === current?.value || option?.name === current?.name;
    });
    return found ? String(found[0]) : "";
  });

  function selectByKey(key) {
    const option = optionsMap[key];
    if (!option) {
      return;
    }
    onSelect(option);
  }

  return { selectedKey, selectByKey };
}
