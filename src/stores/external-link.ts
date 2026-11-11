import { defineStore } from "pinia";
import { ref } from "vue";

export const useExternalLinkStore = defineStore("ExternalLink", () => {
  const externalLinkDialog = ref({
    visible: false,
    link: "",
  });

  function showExternalLinkDialog(link) {
    externalLinkDialog.value = {
      visible: true,
      link: String(link),
    };
  }

  return {
    externalLinkDialog,
    showExternalLinkDialog,
  };
});
