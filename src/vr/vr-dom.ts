export async function refreshCustomScript(): Promise<void> {
  document.getElementById("vr-custom-script")?.remove();
  const customScript = await AppApiVr.CustomVrScript();
  if (customScript) {
    const $vrCustomScript = document.createElement("script");
    $vrCustomScript.setAttribute("id", "vr-custom-script");
    $vrCustomScript.type = "text/javascript";
    $vrCustomScript.textContent = customScript;
    document.head.appendChild($vrCustomScript);
  }
}

export function setNotyOpacity(value: number): void {
  const css = `.noty_layout { opacity: ${(value / 100).toFixed(2)}; }`;
  const element = document.getElementById("noty-opacity");
  if (element) {
    element.innerHTML = css;
  } else {
    document.body.insertAdjacentHTML("beforeend", `<style id="noty-opacity">${css}</style>`);
  }
}

export function updateNowPlayingCircle(percentage: number, isProgressPie: boolean): void {
  const circle = document.querySelector<SVGGeometryElement>(".np-progress-circle-stroke");
  if (!circle) {
    throw new Error("The now playing progress circle is missing from the VR overlay. Check the .hmd markup in Vr.vue.");
  }
  if (isProgressPie && percentage !== 0) {
    circle.style.opacity = "0.5";
    const circumference = circle.getTotalLength();
    circle.style.strokeDashoffset = String(circumference - (percentage / 100) * circumference);
  } else {
    circle.style.opacity = "0";
  }
}
