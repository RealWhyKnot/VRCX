import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn() },
}));

vi.mock("vue-i18n", async () => {
  const { ref } = await import("vue");
  return {
    useI18n: () => ({ t: (key: string) => key, locale: ref("en") }),
  };
});

import { applyTransforms, cropImage, useImageCropper } from "../../src/composables/use-image-cropper";

type CropperOptions = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  imgW?: number;
  imgH?: number;
  rotate?: number;
  flipH?: boolean;
  flipV?: boolean;
};

type MockContext = {
  drawImage: Mock;
  fillRect: Mock;
  translate: Mock;
  rotate: Mock;
  scale: Mock;
  fillStyle: string;
};

function makeImage(width: number, height: number) {
  return Object.assign(document.createElement("img"), { width, height });
}

function makeCropperResult({
  left = 0,
  top = 0,
  width = 100,
  height = 75,
  imgW = 100,
  imgH = 75,
  rotate = 0,
  flipH = false,
  flipV = false,
}: CropperOptions = {}) {
  return {
    coordinates: { left, top, width, height },
    image: {
      width: imgW,
      height: imgH,
      transforms: {
        rotate,
        flip: { horizontal: flipH, vertical: flipV },
      },
    },
  };
}

let mockCtx: MockContext;
let canvasInstances: HTMLCanvasElement[];
let toBlobSpy: Mock;

function canvasAt(index: number): HTMLCanvasElement {
  const canvas = canvasInstances.at(index);
  if (canvas === undefined) {
    throw new Error(`no canvas at index ${index}`);
  }
  return canvas;
}

let restoreCanvasPrototype: () => void = () => undefined;

function setupCanvasMocks() {
  canvasInstances = [];
  mockCtx = {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    fillStyle: "",
  };
  toBlobSpy = vi.fn((cb: BlobCallback) => cb(new Blob(["mock"], { type: "image/png" })));

  const proto = HTMLCanvasElement.prototype;
  const saved = ["getContext", "toDataURL", "toBlob"].map((name) => ({ name, descriptor: Object.getOwnPropertyDescriptor(proto, name) }));
  Object.defineProperties(proto, {
    getContext: {
      configurable: true,
      value: function (this: HTMLCanvasElement) {
        if (!canvasInstances.includes(this)) {
          canvasInstances.push(this);
        }
        return mockCtx;
      },
    },
    toDataURL: { configurable: true, value: () => "data:image/jpeg;base64,mock" },
    toBlob: { configurable: true, value: toBlobSpy },
  });
  restoreCanvasPrototype = () => {
    for (const { name, descriptor } of saved) {
      if (descriptor) {
        Object.defineProperty(proto, name, descriptor);
      }
    }
  };

  return { mockCtx, canvasInstances };
}

describe("useImageCropper", () => {
  test("returns all expected properties", () => {
    const result = useImageCropper();
    expect(result).toHaveProperty("cropperRef");
    expect(result).toHaveProperty("cropperImageSrc");
    expect(result).toHaveProperty("resetCropState");
    expect(result).toHaveProperty("loadImageForCrop");
    expect(result).toHaveProperty("getCroppedBlob");
  });

  test("initial state is correct", () => {
    const { cropperRef, cropperImageSrc } = useImageCropper();
    expect(cropperRef.value).toBeNull();
    expect(cropperImageSrc.value).toBe("");
  });

  test("resetCropState clears all state", () => {
    const { cropperImageSrc, resetCropState } = useImageCropper();
    cropperImageSrc.value = "data:image/png;base64,test";
    resetCropState();
    expect(cropperImageSrc.value).toBe("");
  });

  test("getCroppedBlob returns null when cropperRef is null", async () => {
    const { getCroppedBlob } = useImageCropper();
    const result = await getCroppedBlob();
    expect(result).toBeNull();
  });

  test("getCroppedBlob returns null when getResult returns no coordinates", async () => {
    const { getCroppedBlob, cropperRef } = useImageCropper();
    cropperRef.value = {
      getResult: () => ({}),
      setCoordinates: () => undefined,
      zoom: () => undefined,
      rotate: () => undefined,
      flip: () => undefined,
    };
    const result = await getCroppedBlob();
    expect(result).toBeNull();
  });

  test("getPreviewUrl shrinks a large crop before encoding it", () => {
    const { getPreviewUrl, cropperRef } = useImageCropper();
    const drawn: number[][] = [];
    const sizes: number[][] = [];
    const large = document.createElement("canvas");
    large.width = 2048;
    large.height = 1152;
    const proto = HTMLCanvasElement.prototype;
    const saved = ["getContext", "toDataURL"].map((name) => ({ name, descriptor: Object.getOwnPropertyDescriptor(proto, name) }));
    Object.defineProperties(proto, {
      getContext: {
        configurable: true,
        value: () => ({ drawImage: (_source: unknown, x: number, y: number, width: number, height: number) => drawn.push([x, y, width, height]) }),
      },
      toDataURL: {
        configurable: true,
        value: function (this: HTMLCanvasElement) {
          sizes.push([this.width, this.height]);
          return "data:image/jpeg;base64,small";
        },
      },
    });
    try {
      cropperRef.value = {
        getResult: () => ({ canvas: large }),
        setCoordinates: () => undefined,
        zoom: () => undefined,
        rotate: () => undefined,
        flip: () => undefined,
      };
      expect(getPreviewUrl()).toBe("data:image/jpeg;base64,small");
      expect(drawn).toEqual([[0, 0, 480, 270]]);
      expect(sizes).toEqual([[480, 270]]);
      cropperRef.value = null;
      expect(getPreviewUrl()).toBe("");
    } finally {
      for (const { name, descriptor } of saved) {
        if (descriptor) {
          Object.defineProperty(proto, name, descriptor);
        }
      }
    }
  });
});

describe("cropImage", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    restoreCanvasPrototype();
    vi.restoreAllMocks();
  });

  test("returns null when no cropperResult", async () => {
    const result = await cropImage(makeImage(100, 75), 1, null);
    expect(result).toBeNull();
  });

  test("returns null when cropperResult has no coordinates", async () => {
    const result = await cropImage(makeImage(100, 75), 1, { image: {} });
    expect(result).toBeNull();
  });

  test("returns null when no originalImage", async () => {
    const result = await cropImage(null, 1, makeCropperResult());
    expect(result).toBeNull();
  });

  test("returns original file when no transforms and crop covers full image", async () => {
    const file = new File(["test"], "test.png", { type: "image/png" });
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
    });

    const result = await cropImage(img, 1, cropResult, file);
    expect(result).toBe(file);
  });

  test("returns original file when crop is within 1px tolerance", async () => {
    const file = new File(["test"], "test.png", { type: "image/png" });
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 1,
      top: 1,
      width: 199,
      height: 149,
      imgW: 200,
      imgH: 150,
    });

    const result = await cropImage(img, 1, cropResult, file);
    expect(result).toBe(file);
  });

  test("does NOT return original file when crop is partial", async () => {
    const file = new File(["test"], "test.png", { type: "image/png" });
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 10,
      top: 10,
      width: 100,
      height: 75,
      imgW: 200,
      imgH: 150,
    });

    const result = await cropImage(img, 1, cropResult, file);
    expect(result).not.toBe(file);
    expect(result).toBeInstanceOf(Blob);
  });

  test("does NOT return original file when transforms are applied", async () => {
    const file = new File(["test"], "test.png", { type: "image/png" });
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
      rotate: 90,
    });

    const result = await cropImage(img, 1, cropResult, file);
    expect(result).not.toBe(file);
    expect(result).toBeInstanceOf(Blob);
  });

  test("respects previewScale when computing crop dimensions", async () => {
    const img = makeImage(1600, 1200);
    const cropResult = makeCropperResult({
      left: 50,
      top: 50,
      width: 200,
      height: 150,
      imgW: 400,
      imgH: 300,
    });

    await cropImage(img, 0.25, cropResult);

    const cropCanvas = canvasAt(-1);
    expect(cropCanvas.width).toBe(800);
    expect(cropCanvas.height).toBe(600);
  });

  test("draws image with negative crop offset", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 10,
      top: 20,
      width: 100,
      height: 75,
      imgW: 200,
      imgH: 150,
    });

    await cropImage(img, 1, cropResult);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(img, -10, -20);
  });

  test("creates canvas via toBlob with image/png format", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 10,
      top: 10,
      width: 50,
      height: 50,
      imgW: 200,
      imgH: 150,
    });

    const result = await cropImage(img, 1, cropResult);

    expect(toBlobSpy).toHaveBeenCalledWith(expect.any(Function), "image/png");
    expect(result).toBeInstanceOf(Blob);
  });

  test("does not return original file when no file parameter provided", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
    });

    const result = await cropImage(img, 1, cropResult);

    expect(result).toBeInstanceOf(Blob);
  });
});

describe("cropImage with transforms", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    restoreCanvasPrototype();
    vi.restoreAllMocks();
  });

  test("creates intermediate transform canvas for rotation", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 150,
      height: 200,
      imgW: 200,
      imgH: 150,
      rotate: 90,
    });

    await cropImage(img, 1, cropResult);

    expect(canvasInstances.length).toBe(2);

    const transformCanvas = canvasAt(0);
    expect(transformCanvas.width).toBe(150);
    expect(transformCanvas.height).toBe(200);
  });

  test("applies rotation transform on intermediate canvas", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 150,
      height: 200,
      imgW: 200,
      imgH: 150,
      rotate: 90,
    });

    await cropImage(img, 1, cropResult);

    expect(mockCtx.translate).toHaveBeenCalled();
    expect(mockCtx.rotate).toHaveBeenCalledWith(Math.PI / 2);
  });

  test("applies horizontal flip via scale(-1, 1)", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
      flipH: true,
    });

    await cropImage(img, 1, cropResult);

    expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
  });

  test("applies vertical flip via scale(1, -1)", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
      flipV: true,
    });

    await cropImage(img, 1, cropResult);

    expect(mockCtx.scale).toHaveBeenCalledWith(1, -1);
  });

  test("applies both flips together", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 0,
      top: 0,
      width: 200,
      height: 150,
      imgW: 200,
      imgH: 150,
      flipH: true,
      flipV: true,
    });

    await cropImage(img, 1, cropResult);

    expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
    expect(mockCtx.scale).toHaveBeenCalledWith(1, -1);
  });

  test("does not create transform canvas when no transforms", async () => {
    const img = makeImage(200, 150);
    const cropResult = makeCropperResult({
      left: 10,
      top: 10,
      width: 50,
      height: 50,
      imgW: 200,
      imgH: 150,
    });

    await cropImage(img, 1, cropResult);

    expect(canvasInstances.length).toBe(1);
    expect(mockCtx.translate).not.toHaveBeenCalled();
    expect(mockCtx.rotate).not.toHaveBeenCalled();
  });
});

describe("applyTransforms", () => {
  beforeEach(() => {
    setupCanvasMocks();
  });

  afterEach(() => {
    restoreCanvasPrototype();
    vi.restoreAllMocks();
  });

  test("returns canvas with swapped dimensions for 90° rotation", () => {
    const img = makeImage(200, 150);
    const result = applyTransforms(img, 90, false, false);
    expect(result.width).toBe(150);
    expect(result.height).toBe(200);
  });

  test("returns canvas with same dimensions for 180° rotation", () => {
    const img = makeImage(200, 150);
    const result = applyTransforms(img, 180, false, false);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
  });

  test("returns canvas with swapped dimensions for 270° rotation", () => {
    const img = makeImage(200, 150);
    const result = applyTransforms(img, 270, false, false);
    expect(result.width).toBe(150);
    expect(result.height).toBe(200);
  });

  test("returns canvas with same dimensions for 0° rotation", () => {
    const img = makeImage(200, 150);
    const result = applyTransforms(img, 0, false, false);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
  });

  test("calls translate to center of canvas", () => {
    const img = makeImage(200, 150);
    applyTransforms(img, 90, false, false);

    expect(mockCtx.translate).toHaveBeenCalledWith(75, 100);
  });

  test("calls scale for horizontal flip", () => {
    const img = makeImage(200, 150);
    applyTransforms(img, 0, true, false);
    expect(mockCtx.scale).toHaveBeenCalledWith(-1, 1);
  });

  test("calls scale for vertical flip", () => {
    const img = makeImage(200, 150);
    applyTransforms(img, 0, false, true);
    expect(mockCtx.scale).toHaveBeenCalledWith(1, -1);
  });

  test("does not call scale when no flips", () => {
    const img = makeImage(200, 150);
    applyTransforms(img, 90, false, false);
    expect(mockCtx.scale).not.toHaveBeenCalled();
  });

  test("draws image centered at origin", () => {
    const img = makeImage(200, 150);
    applyTransforms(img, 0, false, false);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(img, -100, -75);
  });

  test("handles square image correctly", () => {
    const img = makeImage(100, 100);
    const result = applyTransforms(img, 90, false, false);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
  });
});
