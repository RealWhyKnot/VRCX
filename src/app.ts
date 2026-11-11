import { VueQueryPlugin } from "@tanstack/vue-query";
import { createApp } from "vue";

import { i18n } from "./plugins/i18n";
import { initComponents } from "./plugins/components";
import { initPlugins } from "./plugins";
import { initRouter } from "./plugins/router";
import { initSentry } from "./plugins/sentry";
import { initPiniaPlugins, pinia } from "./stores";
import { queryClient } from "./queries/client";

import App from "./App.vue";
import "./api/request-global";
import { markStartup } from "./services/startup-trace";

markStartup("scripts loaded");
await initPlugins();
await initPiniaPlugins();
markStartup("plugins and stores ready");

const app = createApp(App);

app.use(pinia).use(i18n).use(VueQueryPlugin, { queryClient });
initComponents(app);
initRouter(app);
await initSentry(app);

app.mount("#root");
markStartup("app mounted");
