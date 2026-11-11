import type * as Echarts from "echarts";

let echarts: typeof Echarts | null = null;

function loadEcharts(): Promise<typeof Echarts> {
  if (echarts) {
    return Promise.resolve(echarts);
  }
  return import("echarts").then((module) => {
    echarts = module;
    return module;
  });
}
export { loadEcharts };
