<template>
  <InstanceFaces :faces="people.faces" :hidden-count="people.hiddenCount" :owners="owners" data-testid="instance-people" @pick="pickFace" @peek="peekFace" />
</template>

<script setup lang="ts">
import { computed } from "vue";

import InstanceFaces from "./InstanceFaces.vue";
import { useInstanceFaces } from "../composables/use-instance-faces";
import { instanceFaceSource, type InstanceFace, type InstancePeopleSource } from "../shared/utils/instance-faces";
import { logError } from "../stores/vrcx-messages";

defineOptions({ name: "InstancePeople" });

const props = defineProps<{ location: string; instance?: InstancePeopleSource | null }>();

const sources = computed(() => [instanceFaceSource(props.location, props.instance)]);
const { strangersFor, identify, peek, owners } = useInstanceFaces(sources);
const people = computed(() => strangersFor(props.location));

function pickFace(face: InstanceFace) {
  void identify(face).catch(logError);
}

function peekFace(face: InstanceFace) {
  void peek(face).catch(logError);
}
</script>
