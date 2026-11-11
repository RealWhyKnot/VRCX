import { instanceCategoryIcons } from "../../../shared/constants/instance";

export function selectInputText(event: MouseEvent) {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    target.select();
  }
}

export function categoryIconClass(iconUrl: string): string | undefined {
  const icons: Record<string, string | undefined> = instanceCategoryIcons;
  return icons[iconUrl];
}
