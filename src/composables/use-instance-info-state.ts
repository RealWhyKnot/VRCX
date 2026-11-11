import { reactive, watch } from "vue";
import type { ComputedRef } from "vue";
import type { RoomRef } from "../stores/instance-types";
import { useGroupStore } from "../stores/group";
import { useLocationStore } from "../stores/location";
import { useUserStore } from "../stores/user";
import { hasGroupPermission } from "../shared/utils/group";

export type InstanceInfoState = {
  isValidInstance: boolean;
  canCloseInstance: boolean;
  canRenameInstance: boolean;
  canSendAnnouncement: boolean;
  canLinkCalendarEvent: boolean;
  isAgeGated: boolean;
  isRoleRestricted: boolean;
  disabledContentSettings: string;
};

export function useInstanceInfoState(
  props: Readonly<{ instance: RoomRef | null; friendcount: number | undefined }>,
  resolvedInstanceLocation: ComputedRef<string>
) {
  const locationStore = useLocationStore();
  const userStore = useUserStore();
  const groupStore = useGroupStore();

  const instanceInfoState = reactive<InstanceInfoState>({
    isValidInstance: false,
    canCloseInstance: false,
    canRenameInstance: false,
    canSendAnnouncement: false,
    canLinkCalendarEvent: false,
    isAgeGated: false,
    isRoleRestricted: false,
    disabledContentSettings: "",
  });

  const parseInstanceInfo = () => {
    Object.assign(instanceInfoState, {
      isValidInstance: false,
      canCloseInstance: false,
      canRenameInstance: false,
      canSendAnnouncement: false,
      canLinkCalendarEvent: false,
      isAgeGated: false,
      isRoleRestricted: false,
      disabledContentSettings: "",
    });

    if (!resolvedInstanceLocation.value || !props.instance || Object.keys(props.instance).length === 0) return;

    instanceInfoState.isValidInstance = true;
    const ownerId = props.instance.ownerId;
    if (ownerId === userStore.currentUser.id) {
      instanceInfoState.canCloseInstance = true;
      instanceInfoState.canRenameInstance = true;
    } else if (ownerId?.startsWith("grp_")) {
      const group = groupStore.cachedGroups.get(ownerId);
      instanceInfoState.canCloseInstance = hasGroupPermission(group, "group-instance-moderate");
      instanceInfoState.canRenameInstance = hasGroupPermission(group, "group-instance-manage");
      instanceInfoState.canSendAnnouncement =
        hasGroupPermission(group, "group-instance-announcement-create") && resolvedInstanceLocation.value === locationStore.lastLocation.location;
      instanceInfoState.canLinkCalendarEvent = hasGroupPermission(group, "group-instance-manage") && hasGroupPermission(group, "group-instance-calendar-link");
    }
    instanceInfoState.isAgeGated = props.instance.ageGate === true;
    if (resolvedInstanceLocation.value.includes("~ageGate")) instanceInfoState.isAgeGated = true;
    instanceInfoState.isRoleRestricted = props.instance.roleRestricted === true;
    if (props.instance.$disabledContentSettings?.length) {
      instanceInfoState.disabledContentSettings = props.instance.$disabledContentSettings.join(", ");
    }
  };

  watch([resolvedInstanceLocation, () => props.instance, () => props.friendcount], parseInstanceInfo, {
    immediate: true,
  });

  return { instanceInfoState };
}
