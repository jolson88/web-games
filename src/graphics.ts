import shaderCode from "./shaders/simpleShader.wgsl";

export interface Color {
  r: number,
  g: number,
  b: number,
  a?: number,
}

export interface Vector2 {
  x: number,
  y: number,
}

export interface Dimensions {
  width: number,
  height: number,
}

interface RenderSimpleQuadRequest {
  uniformValues: Float32Array,
  uniformBuffer: GPUBuffer,
  uniformBindGroup: GPUBindGroup,
}

const FLOAT32_SIZE = 4;

let device: GPUDevice;
let context: GPUCanvasContext;
let screenWidth: number;
let screenHeight: number;

let simpleQuadPipeline: GPURenderPipeline;
let simpleQuadVertexBuffer: GPUBuffer;
let simpleQuadRenderRequests: Array<RenderSimpleQuadRequest> = [];

export async function initialize(canvasId: string, gameWidth: number, gameHeight: number): Promise<void> {
  screenWidth = gameWidth;
  screenHeight = gameHeight;
  const aspectRatio = gameWidth / gameHeight;

  if (!navigator.gpu) {
    throw new Error("This browser does not support WebGPU");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("This browser supports WebGPU but it appears disabled");
  }

  device = await adapter.requestDevice();

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const height = window.innerHeight * devicePixelRatio;
  canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
  canvas.width = Math.min(
    height * aspectRatio,
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
}

export function clearScreen(color: Color): void {
  simpleQuadRenderRequests.splice(0, simpleQuadRenderRequests.length);

  const commandEncoder = device.createCommandEncoder();
  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: "Clearing pass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: { r: color.r, g: color.g, b: color.b, a: color.a ?? 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}

export function drawQuad(
  position: Vector2,
  dimensions: Dimensions,
  color: Color,
): void {
  if (!simpleQuadPipeline) {
    createSimpleQuadPipeline();
  }

  const uniformValues = new Float32Array([
    screenWidth, screenHeight,
    position.x, position.y,
    color.r, color.g, color.b, color.a ?? 1.0,
    dimensions.width, dimensions.height,
  ]);
  const uniformBuffer = createBuffer(
    uniformValues,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );
  const uniformBindGroup = device.createBindGroup({
    layout: simpleQuadPipeline.getBindGroupLayout(0),
    entries: [{
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    }],
  });

  simpleQuadRenderRequests.push({
    uniformValues,
    uniformBuffer,
    uniformBindGroup
  });
}

export function submit(): void {
  submitSimpleQuads();
}

function submitSimpleQuads(): void {
  if (!simpleQuadPipeline) {
    createSimpleQuadPipeline();
  }

  let renderRequest: RenderSimpleQuadRequest;
  const commandEncoder = device.createCommandEncoder();
  for (let i = 0; i < simpleQuadRenderRequests.length; i++) {
    renderRequest = simpleQuadRenderRequests[i];
    const renderPass = commandEncoder.beginRenderPass({
      label: `Simple rendering pass for quad ${i}`,
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        loadOp: "load",
        storeOp: "store",
      }],
    });
    device.queue.writeBuffer(renderRequest.uniformBuffer, 0, renderRequest.uniformValues);
    renderPass.setBindGroup(0, renderRequest.uniformBindGroup);
    renderPass.setVertexBuffer(0, simpleQuadVertexBuffer);
    renderPass.setPipeline(simpleQuadPipeline);
    renderPass.draw(3, 1, 0);
    renderPass.draw(3, 1, 3);
    renderPass.end();
  }
  device.queue.submit([commandEncoder.finish()]);

  for (let renderRequest of simpleQuadRenderRequests) {
    renderRequest.uniformBuffer.destroy();
  }

  simpleQuadRenderRequests.slice(0, simpleQuadRenderRequests.length);
}

function createBuffer(
  data: Float32Array | Uint16Array,
  bufferUsage: number
): GPUBuffer {
  function alignToBytes(bytes: number, value: number): number {
    return (value + (bytes - 1)) & ~(bytes - 1);
  }

  const isUniform = new Boolean(bufferUsage & GPUBufferUsage.UNIFORM);
  let bufferDescription: GPUBufferDescriptor = {
    size: isUniform ? alignToBytes(16, data.byteLength) : alignToBytes(4, data.byteLength),
    usage: bufferUsage,
    mappedAtCreation: true,
  };
  const buffer = device.createBuffer(bufferDescription);
  const writeArray =
    data instanceof Uint16Array
      ? new Uint16Array(buffer.getMappedRange())
      : new Float32Array(buffer.getMappedRange());
  writeArray.set(data);
  buffer.unmap();
  return buffer;
}

function createSimpleQuadPipeline(): void {
  const quadVertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: FLOAT32_SIZE * 2,
    attributes: [{
      shaderLocation: 0,
      format: "float32x2",
      offset: 0,
    }],
  };
  simpleQuadVertexBuffer = createBuffer(
    new Float32Array([
      -0.5, 0.5,
      0.5, 0.5,
      -0.5, -0.5,
      -0.5, -0.5,
      0.5, 0.5,
      0.5, -0.5,
    ]),
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );

  simpleQuadPipeline = device.createRenderPipeline({
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
      targets: [{ format: navigator.gpu.getPreferredCanvasFormat() }],
    },
    primitive: {
      topology: "triangle-list",
    },
  });
}
