import { computed } from "vue";
import { storeToRefs } from "pinia";
import { hasGroupPermission } from "../../../shared/utils/group";
import { useGroupStore } from "../../../stores/group";

type NewInstanceGroupPickersDeps = {
  t: (key: string) => string;
};

export function useNewInstanceGroupPickers({ t }: NewInstanceGroupPickersDeps) {
  const { currentUserGroups } = storeToRefs(useGroupStore());

  const instanceCreatableGroups = computed(() => {
    return Array.from(currentUserGroups.value.values()).filter((group) => {
      return (
        hasGroupPermission(group, "group-instance-public-create") ||
        hasGroupPermission(group, "group-instance-plus-create") ||
        hasGroupPermission(group, "group-instance-open-create")
      );
    });
  });

  const groupIconUrlById = computed(
    () => new Map<string, string | undefined>(Array.from(currentUserGroups.value.values()).map((group) => [String(group.id), group.iconUrl ?? undefined]))
  );

  function groupIconUrl(item: { value: string | number }) {
    return groupIconUrlById.value.get(String(item.value));
  }

  const normalGroupPickerGroups = computed(() => [
    {
      key: "instanceCreatableGroups",
      label: t("dialog.new_instance.group_placeholder"),
      items: instanceCreatableGroups.value.map((group) => ({
        value: String(group.id),
        label: group.name ?? "",
        search: group.name ?? "",
      })),
    },
  ]);

  const legacyGroupPickerGroups = computed(() => [
    {
      key: "currentUserGroups",
      label: t("dialog.new_instance.group_placeholder"),
      items: Array.from(currentUserGroups.value.values())
        .filter(Boolean)
        .map((group) => ({
          value: String(group.id),
          label: group.name ?? "",
          search: group.name ?? "",
        })),
    },
  ]);

  return { groupIconUrl, normalGroupPickerGroups, legacyGroupPickerGroups };
}
