<template>
  <template v-for="(feed, index) in wristFeed" :key="`full-${index}-${feed.type}-${feed.created_at}`">
    <div v-if="feed.type === 'GPS'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <template v-if="feed.isTraveling">
            <span class="name" v-text="feed.displayName"></span> is traveling to
            <VrLocation
              :location="feed.location"
              :hint="feed.worldName"
              :grouphint="feed.groupName"
              :instancedisplayname="feed.instanceDisplayName"
            ></VrLocation>
          </template>
          <template v-else>
            <span class="name" v-text="feed.displayName"></span> is in
            <VrLocation
              :location="feed.location"
              :hint="feed.worldName"
              :grouphint="feed.groupName"
              :instancedisplayname="feed.instanceDisplayName"
            ></VrLocation>
          </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Offline'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span> has logged out
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Online'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span>
          <span class="vr-mx">has logged in</span>
          <template v-if="feed.worldName">
            to
            <VrLocation
              :location="feed.location"
              :hint="feed.worldName"
              :grouphint="feed.groupName"
              :instancedisplayname="feed.instanceDisplayName"
            ></VrLocation>
          </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Status'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name mr-[5px]" v-text="feed.displayName"></span>
          <template v-if="feed.statusDescription === feed.previousStatusDescription">
            <i class="x-user-status" :class="statusClass(feed.previousStatus)"></i>
            <ArrowRight class="inline-block h-4 w-4" />
            <i class="x-user-status" :class="statusClass(feed.status)"></i>
          </template>
          <template v-else>
            <i class="x-user-status" :class="statusClass(feed.status)"></i>
            {{ feed.statusDescription }}
          </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'OnPlayerJoined'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has joined
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'OnPlayerLeft'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has left
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'OnPlayerJoining'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span> is joining
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Location'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <VrLocation :location="feed.location" :hint="feed.worldName" :grouphint="feed.groupName" :instancedisplayname="feed.instanceDisplayName"></VrLocation>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'VideoPlay'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          <span class="vr-mx">changed video to</span>
          <template v-if="feed.videoName">
            <span v-text="feed.videoName"></span>
          </template>
          <template v-else>
            <span v-text="feed.videoUrl"></span>
          </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'invite'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span> has invited you to
          <VrLocation :location="feed.details.worldId" :hint="feed.details.worldName" :instancedisplayname="feed.instanceDisplayName"></VrLocation>
          <span v-text="feed.details.inviteMessage"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'requestInvite'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span> has requested an invite
          <span v-text="feed.details.requestMessage"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'inviteResponse'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span> has responded to your invite <span v-text="feed.details.responseMessage"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'requestInviteResponse'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span> has responded to your invite request
          <span v-text="feed.details.responseMessage"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'friendRequest'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span> has sent you a friend request
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Friend'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span> is now your friend
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Unfriend'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span> is no longer your friend
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'DisplayName'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.previousDisplayName"></span> changed their name to <span class="name" v-text="feed.displayName"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'TrustLevel'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.displayName"></span> trust level is now
          {{ feed.trustLevel }}
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'boop'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span>
          <span v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'groupChange'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.senderUsername"></span>
          <span v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.announcement'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.event.created'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <CalendarPlus class="mr-5 h-5 w-5" />
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.event.starting'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <Clock class="mr-5 h-5 w-5" />
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.informative'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.invite'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.joinRequest'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.transfer'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'group.queueReady'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'instance.closed'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'PortalSpawn'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra flex items-center">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <template v-if="feed.displayName">
            <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
            has spawned a portal to
            <VrLocation class="ml-[5px]" :location="feed.instanceId" :hint="feed.worldName" :grouphint="feed.groupName"></VrLocation>
          </template>
          <template v-else> User has spawned a portal </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'AvatarChange'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          <span class="vr-mx">changed into avatar</span>
          <template v-if="feed.releaseStatus === 'public'">
            <i class="x-user-status online"></i>
          </template>
          <template v-else>
            <i class="x-user-status askme"></i>
          </template>
          {{ feed.name }}
          <template v-if="feed.description && feed.description !== feed.name"> - {{ feed.description }} </template>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'ChatBoxMessage'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          said <span v-text="feed.text"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Event'" class="x-friend-item">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          Event: <span class="name" v-text="feed.data"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'External'" class="x-friend-item">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          External:
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          <span class="name" v-text="feed.message"></span>
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'BlockedOnPlayerJoined'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          Blocked user <span class="name" v-text="feed.displayName"></span> has joined
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'BlockedOnPlayerLeft'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          Blocked user <span class="name" v-text="feed.displayName"></span> has left
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'MutedOnPlayerJoined'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          Muted user <span class="name" v-text="feed.displayName"></span> has joined
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'MutedOnPlayerLeft'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          Muted user <span class="name" v-text="feed.displayName"></span> has left
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Blocked'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has blocked you
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Unblocked'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has unblocked you
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Muted'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has muted you
        </span>
      </div>
    </div>
    <div v-else-if="feed.type === 'Unmuted'" class="x-friend-item" :class="{ friend: feed.isFriend, favorite: feed.isFavorite }">
      <div class="detail">
        <span class="extra">
          <span class="time">{{ formatDate(feed.created_at) }}</span>
          <span class="name" :style="{ '--vr-name-colour': feed.tagColour }" v-text="feed.displayName"></span>
          has unmuted you
        </span>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { ArrowRight } from "lucide-vue-next";
import { statusClass, formatVrFeedDate } from "../vr-status";
import type { VrFeedItem } from "../vr-types";
import VrLocation from "./VrLocation.vue";

const props = defineProps<{ wristFeed: VrFeedItem[]; culture: string; isHour12?: boolean | undefined }>();

function formatDate(date: string | undefined): string {
  return formatVrFeedDate(date, props.culture, props.isHour12);
}
</script>
