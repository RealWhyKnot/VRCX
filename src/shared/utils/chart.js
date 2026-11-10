let echarts = null;

function loadEcharts() {
  if (echarts) {
    return Promise.resolve(echarts);
  }
  return import("echarts").then((module) => {
    echarts = module;
    return echarts;
  });
}
export { loadEcharts };
