import { computed } from "vue";

type SelectOption = {
  value?: unknown;
  name?: unknown;
};

export function useOptionKeySelect<Option extends SelectOption>(
  optionsMap: Readonly<Record<string, Option | undefined>>,
  getCurrentValue: () => Option | undefined,
  onSelect: (option: Option) => void
) {
  const selectedKey = computed(() => {
    const current = getCurrentValue();
    const found = Object.entries(optionsMap).find(([, option]) => {
      if (option === current) {
        return true;
      }
      return option?.value === current?.value || option?.name === current?.name;
    });
    return found?.[0] ?? "";
  });

  function selectByKey(key: string) {
    const option = optionsMap[key];
    if (!option) {
      return;
    }
    onSelect(option);
  }

  return { selectedKey, selectByKey };
}
