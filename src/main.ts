import "./style.css";
import vertexShaderCode from "./shaders/vertex.wgsl";
import fragmentShaderCode from "./shaders/fragment.wgsl";

let GAME_WIDTH = 224;
let GAME_HEIGHT = 288;
let GAME_ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

let device: GPUDevice;
let context: GPUCanvasContext;
let pipeline: GPURenderPipeline;
let gameStartTime: DOMHighResTimeStamp;
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
    alphaMode: "premultiplied",
  });

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: vertexShaderCode,
      }),
      entryPoint: "main",
    },
    fragment: {
      module: device.createShaderModule({
        code: fragmentShaderCode,
      }),
      entryPoint: "main",
      targets: [{ format: canvasFormat }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });

  gameStartTime = performance.now();
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
  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: "Basic rendering pass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const encoder = device.createCommandEncoder();
  const renderPass = encoder.beginRenderPass(renderPassDescriptor);
  renderPass.setPipeline(pipeline);
  renderPass.draw(3, 1, 0, 0);
  renderPass.end();
  device.queue.submit([encoder.finish()]);
}

start();
