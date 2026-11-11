import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { render, type VNode } from "vue";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function renderToHtml(vnode: VNode, _props?: unknown): string {
  const container = document.createElement("div");

  render(vnode, container);
  return container.innerHTML;
}
