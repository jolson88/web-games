import shaderCode from "./shaders/simpleShader.wgsl";
import { FLOAT32_SIZE, GAME_HEIGHT, GAME_WIDTH } from "./constants";

export interface Color {
  r: number,
  g: number,
  b: number,
  a?: number,
}

let quadPipeline: GPURenderPipeline;
let quadVertexBuffer: GPUBuffer;

export function clearScreen(device: GPUDevice, context: GPUCanvasContext, color: Color): void {
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

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);
}

export function drawColoredQuad(device: GPUDevice, context: GPUCanvasContext,
  x: number, y: number,
  width: number, height: number,
  color: Color,
): void {
  if (!quadPipeline) {
    createSimpleQuadPipeline(device);
  }

  const centerX = x + (width / 2);
  const centerY = y - (height / 2);

  const uniformValues = new Float32Array([
    GAME_WIDTH, GAME_HEIGHT,
    centerX, centerY,
    color.r, color.g, color.b, color.a ?? 1.0,
    width, height,
  ]);
  const uniformBuffer = createBuffer(
    device,
    uniformValues,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );
  const uniformBindGroup = device.createBindGroup({
    layout: quadPipeline.getBindGroupLayout(0),
    entries: [{
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    }],
  });

  const commandEncoder = device.createCommandEncoder();
  const renderPass = commandEncoder.beginRenderPass({
    label: "Simple quad rendering pass",
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      loadOp: "load",
      storeOp: "store",
    }],
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
  renderPass.setBindGroup(0, uniformBindGroup);
  renderPass.setVertexBuffer(0, quadVertexBuffer);
  renderPass.setPipeline(quadPipeline);
  renderPass.draw(3, 1, 0);
  renderPass.draw(3, 1, 3);
  renderPass.end();
  device.queue.submit([commandEncoder.finish()]);

  uniformBuffer.destroy();
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
  quadVertexBuffer = createBuffer(
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

  quadPipeline = device.createRenderPipeline({
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
