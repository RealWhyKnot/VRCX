import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { h, isVNode, render } from "vue";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

function toVNode(renderable, props) {
  if (typeof renderable === "function") {
    const rendered = renderable(props);

    if (isVNode(rendered)) {
      return rendered;
    }

    if (typeof rendered === "function" || typeof rendered === "object") {
      return h(rendered, props);
    }

    return rendered;
  }

  if (typeof renderable === "object") {
    return h(renderable, props);
  }

  return renderable;
}

export function renderToHtml(renderable, props) {
  const container = document.createElement("div");
  const vnode = toVNode(renderable, props);

  render(vnode, container);
  return container.innerHTML;
}
