import { useMagicKeys, whenever } from "@vueuse/core";
import { onUnmounted } from "vue";
import type { ScreenshotDialogState } from "./screenshot-metadata-parse";

export function useScreenshotNavigation(
  screenshotMetadataDialog: ScreenshotDialogState,
  getAndDisplayScreenshot: (path: string | undefined, needsCarouselFiles?: boolean) => void
) {
  function navigatePrev() {
    const D = screenshotMetadataDialog;
    const filesArr = D.searchResults;

    if (D.searchIndex !== null && filesArr) {
      let searchIndex = D.searchIndex;
      if (searchIndex > 0) {
        getAndDisplayScreenshot(filesArr[searchIndex - 1], false);
        searchIndex--;
      } else {
        getAndDisplayScreenshot(filesArr[filesArr.length - 1], false);
        searchIndex = filesArr.length - 1;
      }
      D.searchIndex = searchIndex;
      return;
    }

    if (D.metadata.previousFilePath) {
      getAndDisplayScreenshot(D.metadata.previousFilePath);
    }
  }

  function navigateNext() {
    const D = screenshotMetadataDialog;
    const filesArr = D.searchResults;

    if (D.searchIndex !== null && filesArr) {
      let searchIndex = D.searchIndex;
      if (searchIndex < filesArr.length - 1) {
        getAndDisplayScreenshot(filesArr[searchIndex + 1], false);
        searchIndex++;
      } else {
        getAndDisplayScreenshot(filesArr[0], false);
        searchIndex = 0;
      }
      D.searchIndex = searchIndex;
      return;
    }

    if (D.metadata.nextFilePath) {
      getAndDisplayScreenshot(D.metadata.nextFilePath);
    }
  }

  const keys = useMagicKeys();
  const stopPrevWatch = whenever(
    () => keys["Alt+ArrowLeft"]?.value === true,
    () => {
      navigatePrev();
    }
  );
  const stopNextWatch = whenever(
    () => keys["Alt+ArrowRight"]?.value === true,
    () => {
      navigateNext();
    }
  );
  onUnmounted(() => {
    stopPrevWatch();
    stopNextWatch();
  });

  return { navigatePrev, navigateNext };
}
