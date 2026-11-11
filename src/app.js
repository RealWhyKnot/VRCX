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

await initPlugins();
await initPiniaPlugins();

const app = createApp(App);

app.use(pinia).use(i18n).use(VueQueryPlugin, { queryClient });
initComponents(app);
initRouter(app);
await initSentry(app);

app.mount("#root");
