import shaderCode from "./shaders/simpleShader.wgsl";
import { FLOAT32_SIZE, GAME_HEIGHT, GAME_WIDTH } from "./constants";

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

let simpleQuadPipeline: GPURenderPipeline;
let simpleQuadVertexBuffer: GPUBuffer;
let simpleQuadRenderRequests: Array<RenderSimpleQuadRequest> = [];

export function clearScreen(device: GPUDevice, context: GPUCanvasContext, color: Color): void {
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

export function drawColoredQuad(device: GPUDevice,
  position: Vector2,
  dimensions: Dimensions,
  color: Color,
): void {
  if (!simpleQuadPipeline) {
    createSimpleQuadPipeline(device);
  }

  const uniformValues = new Float32Array([
    GAME_WIDTH, GAME_HEIGHT,
    position.x, position.y,
    color.r, color.g, color.b, color.a ?? 1.0,
    dimensions.width, dimensions.height,
  ]);
  const uniformBuffer = createBuffer(
    device,
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

export function submit(device: GPUDevice, context: GPUCanvasContext): void {
  submitSimpleQuads(device, context);
}

function submitSimpleQuads(device: GPUDevice, context: GPUCanvasContext): void {
  if (!simpleQuadPipeline) {
    createSimpleQuadPipeline(device);
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

function alignToBytes(bytes: number, value: number): number {
  return (value + (bytes - 1)) & ~(bytes - 1);
}

function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint16Array,
  bufferUsage: number
): GPUBuffer {
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

function createSimpleQuadPipeline(device: GPUDevice): void {
  const quadVertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: FLOAT32_SIZE * 2,
    attributes: [{
      shaderLocation: 0,
      format: "float32x2",
      offset: 0,
    }],
  };
  simpleQuadVertexBuffer = createBuffer(
    device,
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
