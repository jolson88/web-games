import "./style.css";
import { clearScreen, drawColoredQuad } from "./graphics";
import { GAME_ASPECT_RATIO } from "./constants";

let device: GPUDevice;
let context: GPUCanvasContext;
let lastFrameTime: DOMHighResTimeStamp;

async function start() {
  if (!navigator.gpu) {
    throw new Error("This browser does not support WebGPU");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("This browser supports WebGPU but it appears disabled");
  }

  device = await adapter.requestDevice();

  const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const height = window.innerHeight * devicePixelRatio;
  canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
  canvas.width = Math.min(
    height * GAME_ASPECT_RATIO,
    device.limits.maxTextureDimension2D
  );

  const contextCheck = canvas.getContext("webgpu");
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  if (!contextCheck) {
    throw new Error("WebGPU not supported");
  }
  context = contextCheck;
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: "premultiplied"
  });


  lastFrameTime = performance.now();
  requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp): void {
  const deltaTimeInMs = time - lastFrameTime;

  simulate(deltaTimeInMs);
  render(device, context);

  lastFrameTime = time;
  requestAnimationFrame(frame);
}

function simulate(_deltaTimeInMs: number): void {
  // Do nothing yet
}

function render(device: GPUDevice, context: GPUCanvasContext): void {
  clearScreen(device, context, { r: 0.0, g: 0.0, b: 0.0 });

  drawColoredQuad(
    device, context,
    { x: 100, y: 100 },
    { width: 50, height: 50 },
    { r: 1.0, g: 0.0, b: 0.0 }
  );
  drawColoredQuad(
    device, context,
    { x: 100, y: 200 },
    { width: 190, height: 5 },
    { r: 0.0, g: 1.0, b: 0.0 }
  );
  drawColoredQuad(
    device, context,
    { x: 130, y: 130 },
    { width: 50, height: 50 },
    { r: 0.0, g: 0.0, b: 1.0 }
  );
}

start();