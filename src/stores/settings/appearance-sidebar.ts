import type { Ref } from "vue";

import { configRepository } from "../../services/config";
import { saveSetting } from "./appearance-helpers";

export function createSidebarSortControls(sortMethod1: Ref<string>, sortMethod2: Ref<string>, sortMethod3: Ref<string>, sortMethods: Ref<string[]>) {
  function setSidebarSortMethods(methods: string[]) {
    sortMethods.value = methods;
    saveSetting(configRepository.setString("VRCX_sidebarSortMethods", JSON.stringify(methods)));
  }

  function handleSaveSidebarSortOrder() {
    if (sortMethod1.value === sortMethod2.value) {
      sortMethod2.value = "";
    }
    if (sortMethod1.value === sortMethod3.value) {
      sortMethod3.value = "";
    }
    if (sortMethod2.value === sortMethod3.value) {
      sortMethod3.value = "";
    }
    if (!sortMethod1.value) {
      sortMethod2.value = "";
    }
    if (!sortMethod2.value) {
      sortMethod3.value = "";
    }
    setSidebarSortMethods([sortMethod1.value, sortMethod2.value, sortMethod3.value]);
  }

  function setSidebarSortMethod1(method: string) {
    sortMethod1.value = method;
    handleSaveSidebarSortOrder();
  }

  function setSidebarSortMethod2(method: string) {
    sortMethod2.value = method;
    handleSaveSidebarSortOrder();
  }

  function setSidebarSortMethod3(method: string) {
    sortMethod3.value = method;
    handleSaveSidebarSortOrder();
  }

  return { setSidebarSortMethod1, setSidebarSortMethod2, setSidebarSortMethod3, setSidebarSortMethods };
}
