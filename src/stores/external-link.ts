import { defineStore } from "pinia";
import { ref } from "vue";

export const useExternalLinkStore = defineStore("ExternalLink", () => {
  const externalLinkDialog = ref({
    visible: false,
    link: "",
  });

  function showExternalLinkDialog(link: string) {
    externalLinkDialog.value = {
      visible: true,
      link,
    };
  }

  return {
    externalLinkDialog,
    showExternalLinkDialog,
  };
});
