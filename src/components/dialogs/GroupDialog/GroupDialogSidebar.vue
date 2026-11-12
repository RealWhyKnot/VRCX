<template>
  <div class="flex-none w-77 pr-4 overflow-y-auto">
    <div class="rounded-xl bg-(--profile-card) overflow-hidden flex flex-col">
      <div class="relative aspect-17/6">
        <img
          v-if="!groupDialog.loading && !bannerError && groupDialog.ref.bannerUrl"
          class="absolute inset-0 block h-full w-full cursor-pointer object-cover"
          :src="groupDialog.ref.bannerUrl"
          loading="lazy"
          @click="showFullscreenImageDialog(groupDialog.ref.bannerUrl)"
          @error="bannerError = true"
        />
        <div
          class="absolute bottom-0 left-3 z-10 h-[96px] w-[96px] translate-y-1/2 overflow-hidden rounded-lg [filter:drop-shadow(0_0_1px_var(--color-shadow-strong))_drop-shadow(0_0_4px_var(--color-shadow-medium))_drop-shadow(0_2px_8px_var(--color-shadow-soft))]"
        >
          <Image v-if="groupDialog.loading || imageError" class="w-full! h-full! object-cover text-muted-foreground bg-accent" />
          <img
            v-else
            class="w-full h-full object-cover cursor-pointer"
            :src="groupDialog.ref.iconUrl ?? undefined"
            loading="lazy"
            @click.stop="showFullscreenImageDialog(groupDialog.ref.iconUrl ?? '')"
            @error="imageError = true"
          />
        </div>
      </div>

      <div class="flex flex-col p-3 mt-10">
        <div class="flex w-full min-w-0 max-w-full items-start justify-between gap-2">
          <div class="flex min-w-0 flex-1 flex-col">
            <span class="font-bold cursor-pointer block min-w-0" @click="copyToClipboard(groupDialog.ref.name ?? '')">
              <span class="flex min-w-0 items-center gap-1">
                <span v-if="groupDialog.ref.ownerId === currentUser.id" class="shrink-0">👑</span>
                <span class="truncate" :title="groupDialog.ref.name || groupDialog.id">{{ groupDialog.ref.name || groupDialog.id }}</span>
              </span>
            </span>
            <span
              class="x-grey font-mono text-xs truncate block min-w-0 cursor-pointer"
              @click="showUserDialog(groupDialog.ref.ownerId)"
              v-text="groupDialog.ownerDisplayName || groupDialog.ref.ownerId"
            ></span>
          </div>
          <div class="ml-2 flex shrink-0 items-center justify-end gap-2">
            <template v-if="groupDialog.inGroup && groupDialog.ref?.myMember">
              <TooltipWrapper v-if="groupDialog.ref.myMember?.isRepresenting" side="top" :content="t('dialog.group.actions.unrepresent_tooltip')">
                <Button
                  class="rounded-lg ml-[6px]"
                  variant="secondary"
                  size="icon"
                  :aria-label="t('dialog.group.actions.unrepresent_tooltip')"
                  @click="clearGroupRepresentation(groupDialog.id)"
                >
                  <BookmarkCheck />
                </Button>
              </TooltipWrapper>
              <TooltipWrapper v-else side="top" :content="t('dialog.group.actions.represent_tooltip')">
                <span>
                  <Button
                    class="rounded-lg"
                    variant="outline"
                    size="icon"
                    :aria-label="t('dialog.group.actions.represent_tooltip')"
                    :disabled="groupDialog.ref.privacy === 'private'"
                    @click="setGroupRepresentation(groupDialog.id)"
                  >
                    <Bookmark />
                  </Button>
                </span>
              </TooltipWrapper>
            </template>
            <template v-else-if="groupDialog.ref.myMember?.membershipStatus === 'requested'">
              <TooltipWrapper side="top" :content="t('dialog.group.actions.cancel_join_request_tooltip')">
                <span>
                  <Button
                    class="rounded-lg"
                    variant="outline"
                    size="icon"
                    :aria-label="t('dialog.group.actions.cancel_join_request_tooltip')"
                    @click="cancelGroupRequest(groupDialog.id)"
                  >
                    <X />
                  </Button>
                </span>
              </TooltipWrapper>
            </template>
            <template v-else-if="groupDialog.ref.myMember?.membershipStatus === 'invited'">
              <TooltipWrapper side="top" :content="t('dialog.group.actions.pending_request_tooltip')">
                <span>
                  <Button
                    class="rounded-lg"
                    variant="outline"
                    size="icon"
                    :aria-label="t('dialog.group.actions.pending_request_tooltip')"
                    @click="joinGroup(groupDialog.id)"
                  >
                    <Check />
                  </Button>
                </span>
              </TooltipWrapper>
            </template>
            <template v-else>
              <TooltipWrapper v-if="groupDialog.ref.joinState === 'request'" side="top" :content="t('dialog.group.actions.request_join_tooltip')">
                <Button
                  class="rounded-lg"
                  variant="outline"
                  size="icon"
                  :aria-label="t('dialog.group.actions.request_join_tooltip')"
                  @click="joinGroup(groupDialog.id)"
                >
                  <MessageSquare />
                </Button>
              </TooltipWrapper>
              <TooltipWrapper v-if="groupDialog.ref.joinState === 'invite'" side="top" :content="t('dialog.group.actions.invite_required_tooltip')">
                <span>
                  <Button class="rounded-lg" variant="outline" size="icon" :aria-label="t('dialog.group.actions.invite_required_tooltip')" disabled>
                    <MessageSquare />
                  </Button>
                </span>
              </TooltipWrapper>
              <TooltipWrapper v-if="groupDialog.ref.joinState === 'open'" side="top" :content="t('dialog.group.actions.join_group_tooltip')">
                <Button
                  class="rounded-lg"
                  variant="outline"
                  size="icon"
                  :aria-label="t('dialog.group.actions.join_group_tooltip')"
                  @click="joinGroup(groupDialog.id)"
                >
                  <Check />
                </Button>
              </TooltipWrapper>
            </template>
            <GroupDialogActionsMenu :group-dialog-command="groupDialogCommand" />
          </div>
        </div>

        <div class="flex flex-col gap-1 mt-2">
          <div v-if="groupDialog.ref.$languages && groupDialog.ref.$languages.length" class="flex flex-wrap gap-1">
            <Badge
              v-for="item in groupDialog.ref.$languages"
              :key="item.key"
              variant="outline"
              class="h-5 px-1.5 inline-flex items-center gap-1 text-[11px] leading-none"
            >
              <span class="flags inline-block shrink-0 self-center" :class="languageClass(item.key)"></span>
              <span class="inline-flex items-center leading-none">{{ item.value }} ({{ item.key }})</span>
            </Badge>
          </div>

          <div class="flex flex-wrap gap-1">
            <Badge v-if="groupDialog.ref.isVerified" variant="outline">
              {{ t("dialog.group.tags.verified") }}
            </Badge>
            <Badge v-if="groupDialog.ref.privacy === 'private'" variant="outline">
              {{ t("dialog.group.tags.private") }}
            </Badge>
            <Badge v-if="groupDialog.ref.privacy === 'default'" variant="outline">
              {{ t("dialog.group.tags.public") }}
            </Badge>
            <Badge v-if="groupDialog.ref.joinState === 'open'" variant="outline">
              {{ t("dialog.group.tags.open") }}
            </Badge>
            <Badge v-else-if="groupDialog.ref.joinState === 'request'" variant="outline">
              {{ t("dialog.group.tags.request") }}
            </Badge>
            <Badge v-else-if="groupDialog.ref.joinState === 'invite'" variant="outline">
              {{ t("dialog.group.tags.invite") }}
            </Badge>
            <Badge v-else-if="groupDialog.ref.joinState === 'closed'" variant="outline">
              {{ t("dialog.group.tags.closed") }}
            </Badge>
            <Badge v-if="groupDialog.inGroup" variant="outline">
              {{ t("dialog.group.tags.joined") }}
            </Badge>
            <Badge v-if="groupDialog.ref.myMember?.bannedAt" variant="outline">
              {{ t("dialog.group.tags.banned") }}
            </Badge>
          </div>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3 mt-2.5">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.header") }}
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.short_code") }}</span>
          <span class="text-right text-muted-foreground"> {{ groupDialog.ref.shortCode }}.{{ groupDialog.ref.discriminator }} </span>
        </div>
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.members") }}</span>
          <span class="text-right text-muted-foreground">
            {{ groupDialog.ref.memberCount }}
          </span>
        </div>
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.online_members") }}</span>
          <span class="text-right text-muted-foreground">
            {{ groupDialog.ref.onlineMemberCount }}
          </span>
        </div>
        <TooltipWrapper side="right" :content="formatDateFilter(groupDialog.ref.createdAt, 'long')" :disabled="!groupDialog.ref.createdAt">
          <div class="flex justify-between items-start gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.created") }}</span>
            <span class="text-right text-muted-foreground">{{ timeAgo(groupDialog.ref.createdAt) }}</span>
          </div>
        </TooltipWrapper>
        <div v-if="groupDialog.ref.links?.length" class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.links") }}</span>
          <div class="flex gap-1">
            <template v-for="(link, index) in groupDialog.ref.links" :key="index">
              <TooltipWrapper v-if="link">
                <template #content>
                  <span v-text="link" />
                </template>
                <img :src="getFaviconUrl(link)" class="w-[16px] h-[16px] align-middle cursor-pointer" loading="lazy" @click.stop="openExternalLink(link)" />
              </TooltipWrapper>
            </template>
          </div>
        </div>
        <div class="flex justify-between items-center gap-2 text-xs">
          <span class="text-muted-foreground">{{ t("dialog.group.info.id") }}</span>
          <Button
            class="-mr-1.5 h-5 gap-1 px-1.5 text-xs font-normal text-muted-foreground has-[>svg]:px-1.5"
            size="sm"
            variant="ghost"
            @click="copyToClipboard(groupDialog.id)"
          >
            <Copy class="size-3" />
            {{ t("dialog.group.info.copy_id") }}
          </Button>
        </div>
      </div>
    </div>

    <div class="rounded-xl bg-(--profile-card) p-3 mt-2.5">
      <div class="flex items-center justify-between mb-2 pb-2 border-b border-muted-foreground/20">
        <span class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {{ t("dialog.user.info.vrcx_info") }}
          <TooltipWrapper side="right" :content="t('dialog.user.info.vrcx_info_tooltip')">
            <Info class="h-3 w-3 shrink-0" />
          </TooltipWrapper>
        </span>
      </div>
      <div class="flex flex-col gap-1.5">
        <TooltipWrapper side="right" :content="formatDateFilter(groupDialog.lastVisit, 'long')" :disabled="!groupDialog.lastVisit">
          <div class="flex justify-between items-start gap-2 text-xs">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.last_visited") }}</span>
            <span class="text-right text-muted-foreground">{{ timeAgo(groupDialog.lastVisit) }}</span>
          </div>
        </TooltipWrapper>
        <TooltipWrapper side="right" :content="t('dialog.user.info.open_previous_instance')">
          <div
            class="flex justify-between items-start gap-2 text-xs cursor-pointer hover:text-foreground"
            @click="showPreviousInstancesListDialog(groupDialog.ref)"
          >
            <span class="text-muted-foreground shrink-0">{{ t("dialog.user.info.join_count") }}</span>
            <span class="text-right text-muted-foreground">{{ groupDialog.joinCount || "—" }}</span>
          </div>
        </TooltipWrapper>
        <TooltipWrapper v-if="groupDialog.instancesSeen > 0" side="right" :content="formatDateFilter(groupDialog.lastInstanceSeenAt, 'long')">
          <div class="flex justify-between items-start gap-2 text-xs" data-testid="group-instances-seen">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.instances_seen") }}</span>
            <span class="text-right text-muted-foreground tabular-nums">{{ groupDialog.instancesSeen.toLocaleString() }}</span>
          </div>
        </TooltipWrapper>
      </div>
    </div>

    <div v-if="groupDialog.ref.membershipStatus === 'member' && groupDialog.ref.myMember" class="rounded-xl bg-(--profile-card) p-3 mt-2.5">
      <div class="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2 pb-2 border-b border-border">
        {{ t("dialog.group.info.member_info") }}
      </div>
      <div class="flex flex-col gap-1.5">
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.visibility") }}</span>
          <span class="text-right text-muted-foreground">
            <template v-if="groupDialog.ref.myMember.visibility === 'visible'">
              {{ t("dialog.group.tags.everyone") }}
            </template>
            <template v-else-if="groupDialog.ref.myMember.visibility === 'friends'">
              {{ t("dialog.group.tags.friends") }}
            </template>
            <template v-else-if="groupDialog.ref.myMember.visibility === 'hidden'">
              {{ t("dialog.group.tags.hidden") }}
            </template>
          </span>
        </div>
        <TooltipWrapper
          side="right"
          :content="formatDateFilter(groupDialog.ref.myMember.joinedAt, 'long')"
          @click="showPreviousInstancesListDialog(groupDialog.ref)"
        >
          <div class="flex justify-between items-start gap-2 text-xs cursor-pointer">
            <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.joined_at") }}</span>
            <span class="text-right text-muted-foreground">{{ timeAgo(groupDialog.ref.myMember.joinedAt) }}</span>
          </div>
        </TooltipWrapper>
        <div class="flex justify-between items-start gap-2 text-xs">
          <span class="text-muted-foreground shrink-0">{{ t("dialog.group.info.roles") }}</span>
          <span v-if="groupDialog.memberRoles.length === 0" class="text-right text-muted-foreground">—</span>
          <span v-else class="text-right text-muted-foreground">
            <template v-for="(role, rIndex) in groupDialog.memberRoles" :key="rIndex">
              <TooltipWrapper side="right">
                <template #content>
                  <span>{{ t("dialog.group.info.role") }} {{ role.name }}</span>
                  <br />
                  <span>{{ t("dialog.group.info.role_description") }} {{ role.description }}</span>
                  <br />
                  <span v-if="role.updatedAt">
                    {{ t("dialog.group.info.role_updated_at") }}
                    {{ formatDateFilter(role.updatedAt, "long") }}
                  </span>
                  <span v-else>
                    {{ t("dialog.group.info.role_created_at") }}
                    {{ formatDateFilter(role.createdAt, "long") }}
                  </span>
                  <br />
                  <span>{{ t("dialog.group.info.role_permissions") }}</span>
                  <br />
                  <template v-for="(permission, pIndex) in role.permissions" :key="pIndex">
                    <span>{{ permission }}</span>
                    <br />
                  </template>
                </template>
                <span>{{ role.name }}{{ rIndex < groupDialog.memberRoles.length - 1 ? ", " : "" }}</span>
              </TooltipWrapper>
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Bookmark, BookmarkCheck, Check, Copy, Image, Info, MessageSquare, X } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { ref, watch } from "vue";
import Button from "@/components/ui/button/Button.vue";
import Badge from "../../ui/badge/Badge.vue";
import GroupDialogActionsMenu from "./GroupDialogActionsMenu.vue";
import { useGroupMembershipActions } from "./use-group-membership-actions";
import { copyToClipboard, openExternalLink } from "../../../shared/utils/app-actions";
import { formatDateFilter } from "../../../coordinators/date-coordinator";
import { getFaviconUrl } from "../../../shared/utils/url-utils";
import { languageClass } from "../../../shared/utils/user";
import { timeAgo } from "../../../shared/utils/base/format";
import { useGalleryStore } from "../../../stores/gallery";
import { useGroupStore } from "../../../stores/group";
import { useUserStore } from "../../../stores/user";
import { showUserDialog } from "../../../coordinators/user-coordinator";
import type { VrcxGroup } from "../../../types/vrcx";

defineProps<{
  groupDialogCommand: (command: string) => void;
  showPreviousInstancesListDialog: (groupRef: Partial<VrcxGroup>) => void;
}>();

const { t } = useI18n();
const { groupDialog } = storeToRefs(useGroupStore());
const { currentUser } = storeToRefs(useUserStore());
const { showFullscreenImageDialog } = useGalleryStore();

const imageError = ref(false);
const bannerError = ref(false);

watch(
  () => groupDialog.value.id,
  () => {
    imageError.value = false;
    bannerError.value = false;
  }
);

const { setGroupRepresentation, clearGroupRepresentation, cancelGroupRequest, joinGroup } = useGroupMembershipActions({
  t,
  groupDialog,
  currentUser,
});
</script>
