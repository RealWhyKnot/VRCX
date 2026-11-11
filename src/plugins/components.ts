import type { App } from "vue";

import TooltipWrapper from "../components/ui/tooltip/TooltipWrapper.vue";

import AvatarInfo from "../components/AvatarInfo.vue";
import CountdownTimer from "../components/CountdownTimer.vue";
import DisplayName from "../components/DisplayName.vue";
import LocationWorld from "../components/LocationWorld.vue";

export function initComponents(app: App): void {
  app.component("CountdownTimer", CountdownTimer);
  app.component("AvatarInfo", AvatarInfo);
  app.component("DisplayName", DisplayName);
  app.component("LocationWorld", LocationWorld);
  app.component("TooltipWrapper", TooltipWrapper);
}
