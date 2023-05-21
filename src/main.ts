import "./style.css";
import shaderCode from "./shaders/shaders.wgsl";
import { createBuffer } from "./graphics";

let FLOAT32_SIZE = 4;
let GAME_WIDTH = 224;
let GAME_HEIGHT = 288;
let GAME_ASPECT_RATIO = GAME_WIDTH / GAME_HEIGHT;

let device: GPUDevice;
let context: GPUCanvasContext;
let pipeline: GPURenderPipeline;
let quadVertexBuffer: GPUBuffer;
let quadVertexBufferLayout: GPUVertexBufferLayout;
let quadIndexBuffer: GPUBuffer;

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

  const quadVertices = new Float32Array([
    0,
    GAME_HEIGHT,
    GAME_WIDTH,
    GAME_HEIGHT,
    0,
    0,
    GAME_WIDTH,
    0,
  ]);
  const quadIndices = new Uint16Array([0, 1, 2, 2, 1, 3]);
  quadVertexBuffer = createBuffer(
    device,
    quadVertices,
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );
  quadVertexBufferLayout = {
    arrayStride: FLOAT32_SIZE * 2,
    attributes: [
      {
        shaderLocation: 0,
        format: "float32x2",
        offset: 0,
      },
    ],
  };
  quadIndexBuffer = createBuffer(
    device,
    quadIndices,
    GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
  );

  pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: "vertexMain",
      buffers: [quadVertexBufferLayout],
    },
    fragment: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: "fragmentMain",
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
  const uniformData = new Float32Array([GAME_WIDTH, GAME_HEIGHT]);
  const uniformBuffer = createBuffer(
    device,
    uniformData,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );
  const uniformBindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: {
          buffer: uniformBuffer,
        },
      },
    ],
  });

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

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.setBindGroup(0, uniformBindGroup);
  renderPass.setVertexBuffer(0, quadVertexBuffer);
  renderPass.setIndexBuffer(quadIndexBuffer, "uint16");
  renderPass.setPipeline(pipeline);
  renderPass.drawIndexed(3, 1);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}

start();
