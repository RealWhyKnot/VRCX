<template>
  <div class="flex flex-1 min-h-0 flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-semibold">
        {{ t("dialog.group_member_moderation.selected_users") }}
        <span class="ml-1 text-muted-foreground font-normal">{{ selectedUsersArray.length }}</span>
      </span>
      <Button
        class="rounded-full"
        size="icon-sm"
        variant="ghost"
        :disabled="!selectedUsersArray.length"
        :aria-label="t('common.actions.delete')"
        @click="$emit('clear-all')"
      >
        <Trash2 />
      </Button>
    </div>

    <div class="flex gap-2">
      <InputGroupField
        :model-value="selectUserId"
        size="sm"
        class="flex-1"
        :placeholder="t('dialog.group_member_moderation.user_id_placeholder')"
        clearable
        @update:model-value="$emit('update:selectUserId', $event)"
        @keydown.enter="selectUserId && $emit('select-user')"
      />
      <TooltipWrapper :content="t('dialog.group_member_moderation.select_user')" side="top">
        <Button size="icon-sm" variant="outline" :disabled="!selectUserId" @click="$emit('select-user')">
          <Plus />
        </Button>
      </TooltipWrapper>
    </div>

    <ScrollArea class="flex-1 min-h-24 rounded-md border">
      <div v-if="selectedUsersArray.length" class="p-1">
        <div v-for="user in selectedUsersArray" :key="user.id ?? user.userId ?? ''" class="flex items-center gap-1.5 rounded px-2 py-1 text-sm hover:bg-muted">
          <TooltipWrapper v-if="user.membershipStatus !== 'member'" side="top">
            <template #content>
              <span>{{ t("dialog.group_member_moderation.user_isnt_in_group") }}</span>
            </template>
            <AlertTriangle class="size-3.5 shrink-0 text-amber-500" />
          </TooltipWrapper>
          <span class="flex-1 truncate font-medium" v-text="user.user?.displayName || user.userId"></span>
          <button
            type="button"
            class="inline-flex shrink-0 cursor-pointer items-center text-muted-foreground hover:text-foreground"
            :ariaLabel="t('common.actions.delete')"
            @click="$emit('delete-user', user)"
          >
            <X class="size-3.5" />
          </button>
        </div>
      </div>
      <div v-else class="p-3 text-center text-sm text-muted-foreground">—</div>
    </ScrollArea>

    <Separator />

    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold">{{ t("dialog.group_member_moderation.roles") }}</span>
      <Select :model-value="selectedRoles" multiple @update:model-value="emitSelectedRoles">
        <SelectTrigger class="w-full">
          <SelectValue :placeholder="t('dialog.group_member_moderation.choose_roles_placeholder')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="role in selectableRoles" :key="role.id" :value="role.id">
            {{ role.name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div class="grid grid-cols-2 gap-2">
        <Button size="sm" variant="outline" :disabled="rolesDisabled" @click="$emit('add-roles')">{{ t("dialog.group_member_moderation.add_roles") }}</Button>
        <Button size="sm" variant="secondary" :disabled="rolesDisabled" @click="$emit('remove-roles')">{{
          t("dialog.group_member_moderation.remove_roles")
        }}</Button>
      </div>
    </div>

    <Separator />

    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold">{{ t("dialog.group_member_moderation.notes") }}</span>
      <InputGroupTextareaField
        :model-value="note"
        class="text-xs"
        :rows="2"
        :placeholder="t('dialog.group_member_moderation.note_placeholder')"
        input-class="resize-none min-h-0"
        @update:model-value="$emit('update:note', $event)"
      />
      <Button size="sm" variant="outline" :disabled="isActionDisabled('group-members-manage')" @click="$emit('save-note')">{{
        t("dialog.group_member_moderation.save_note")
      }}</Button>
    </div>

    <Separator />

    <div class="flex flex-col gap-2">
      <span class="text-sm font-semibold">{{ t("dialog.group_member_moderation.actions") }}</span>
      <div class="grid grid-cols-3 gap-2">
        <Button size="sm" variant="outline" :disabled="isActionDisabled('group-members-remove')" @click="$emit('kick')">{{
          t("dialog.group_member_moderation.kick")
        }}</Button>
        <Button size="sm" variant="destructive" :disabled="isActionDisabled('group-bans-manage')" @click="$emit('ban')">{{
          t("dialog.group_member_moderation.ban")
        }}</Button>
        <Button size="sm" variant="outline" :disabled="isActionDisabled('group-bans-manage')" @click="$emit('unban')">{{
          t("dialog.group_member_moderation.unban")
        }}</Button>
      </div>
    </div>

    <div v-if="progressCurrent" class="flex flex-col gap-2 rounded-md border p-2">
      <div class="flex items-center gap-2 text-sm">
        <Spinner class="size-4" />
        <span class="flex-1"> {{ t("dialog.group_member_moderation.progress") }} {{ progressCurrent }}/{{ progressTotal }} </span>
        <Button size="sm" variant="secondary" @click="$emit('cancel-progress')">{{ t("dialog.group_member_moderation.cancel") }}</Button>
      </div>
      <Progress :model-value="progressPercent" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { AlertTriangle, Plus, Trash2, X } from "lucide-vue-next";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { AcceptableValue } from "reka-ui";
import Button from "@/components/ui/button/Button.vue";
import Spinner from "@/components/ui/spinner/Spinner.vue";
import Progress from "@/components/ui/progress/Progress.vue";
import ScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";
import Separator from "@/components/ui/separator/Separator.vue";
import InputGroupField from "@/components/ui/input-group/InputGroupField.vue";
import InputGroupTextareaField from "@/components/ui/input-group/InputGroupTextareaField.vue";
import Select from "@/components/ui/select/Select.vue";
import SelectContent from "@/components/ui/select/SelectContent.vue";
import SelectItem from "@/components/ui/select/SelectItem.vue";
import SelectTrigger from "@/components/ui/select/SelectTrigger.vue";
import SelectValue from "@/components/ui/select/SelectValue.vue";
import { hasGroupPermission } from "@/shared/utils/group";
import type { SelectedRow } from "./group-moderation-types";
import type { VrcxGroup } from "../../../types/vrcx";

const props = withDefaults(
  defineProps<{
    selectUserId?: string;
    selectedUsersArray?: SelectedRow[];
    selectedRoles?: string[];
    note?: string;
    progressCurrent?: number;
    progressTotal?: number;
    groupRef?: Partial<VrcxGroup>;
  }>(),
  {
    selectUserId: "",
    selectedUsersArray: () => [],
    selectedRoles: () => [],
    note: "",
    progressCurrent: 0,
    progressTotal: 0,
    groupRef: () => ({}),
  }
);

const emit = defineEmits<{
  "update:selectUserId": [value: string];
  "update:note": [value: string];
  "update:selectedRoles": [value: string[]];
  "select-user": [];
  "clear-all": [];
  "delete-user": [user: SelectedRow];
  "add-roles": [];
  "remove-roles": [];
  "save-note": [];
  kick: [];
  ban: [];
  unban: [];
  "cancel-progress": [];
}>();

const { t } = useI18n();

function isActionDisabled(permission: string) {
  return Boolean(!props.selectedUsersArray.length || props.progressCurrent || !hasGroupPermission(props.groupRef, permission));
}

const selectableRoles = computed(() => (props.groupRef.roles ?? []).filter((role): role is typeof role & { id: string } => typeof role.id === "string"));

function emitSelectedRoles(value: AcceptableValue | AcceptableValue[]) {
  const roleIds: readonly unknown[] = Array.isArray(value) ? value : [];
  emit(
    "update:selectedRoles",
    roleIds.filter((roleId): roleId is string => typeof roleId === "string")
  );
}

const rolesDisabled = computed(() => !props.selectedRoles.length || isActionDisabled("group-roles-assign"));

const progressPercent = computed(() => (props.progressTotal ? Math.round((props.progressCurrent / props.progressTotal) * 100) : 0));
</script>
