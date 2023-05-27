import shaderCode from './shaders/simpleShader.wgsl';

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

export interface Vector3 extends Vector2 {
  z?: number,
}

export interface Dimensions {
  width: number,
  height: number,
}

export enum LightMedium {
  Opaque,
  Transparent
};

export enum RenderType {
  Circle,
  Quad,
}

interface RenderRequest {
  type: RenderType,
  lightMedium: LightMedium,
  position: Vector3,
  uniformValues: Float32Array,
  uniformBuffer: GPUBuffer,
  uniformBindGroup: GPUBindGroup,
}

const FLOAT32_SIZE = 4;
const TAU = 2 * Math.PI;
const CIRCLE_FACES = 64;

let device: GPUDevice;
let context: GPUCanvasContext;
let depthTexture: GPUTexture;
let screenWidth: number;
let screenHeight: number;

let pendingRenderRequests: Array<RenderRequest> = [];
let opaqueRenderPipeline: GPURenderPipeline;
let transparentRenderPipeline: GPURenderPipeline;
let uniformBindGroupLayout: GPUBindGroupLayout;

let circleVertexBuffer: GPUBuffer;
let simpleQuadVertexBuffer: GPUBuffer;

export async function initialize(canvasId: string, gameWidth: number, gameHeight: number): Promise<void> {
  screenWidth = gameWidth;
  screenHeight = gameHeight;
  const aspectRatio = gameWidth / gameHeight;

  if (!navigator.gpu) {
    throw new Error('This browser does not support WebGPU');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('This browser supports WebGPU but it appears disabled');
  }

  device = await adapter.requestDevice();

  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const height = window.innerHeight;
  canvas.height = Math.min(height, device.limits.maxTextureDimension2D);
  canvas.width = Math.min(
    height * aspectRatio,
    device.limits.maxTextureDimension2D
  );

  const contextCheck = canvas.getContext('webgpu');
  const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
  if (!contextCheck) {
    throw new Error('WebGPU not supported');
  }
  context = contextCheck;
  context.configure({
    device,
    format: canvasFormat,
    alphaMode: 'opaque'
  });

  const canvasTexture = context.getCurrentTexture();
  if (depthTexture) {
    depthTexture.destroy();
  }
  depthTexture = device.createTexture({
    size: [canvasTexture.width, canvasTexture.height],
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  createPipelines();
}

export function clearScreen(color: Color): void {
  const canvasTexture = context.getCurrentTexture();

  const commandEncoder = device.createCommandEncoder();
  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: 'Clearing pass',
    colorAttachments: [
      {
        view: canvasTexture.createView(),
        clearValue: { r: color.r, g: color.g, b: color.b, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: depthTexture.createView(),
      depthClearValue: 0.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    }
  };
  const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
  renderPass.end();
      
  device.queue.submit([commandEncoder.finish()]);
}

function createUniformValues(position: Vector3, dimensions: Dimensions, color: Color): Float32Array {
  return new Float32Array([
    screenWidth, screenHeight, 1.0, 0.0,
    position.x, position.y, position.z ?? 0.0, 0.0,
    dimensions.width, dimensions.height, 0.0, 0.0,
    color.r, color.g, color.b, color.a ?? 1.0,
  ]);
}

export function drawCircle(position: Vector3, radius: number, color: Color): void {
  const uniformValues = createUniformValues(position, { width: radius, height: radius }, color);
  const uniformBuffer = createBuffer(
    uniformValues,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );
  const uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [{
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    }],
  });

  const alpha = color.a ?? 1.0;
  pendingRenderRequests.push({
    type: RenderType.Circle,
    lightMedium: (alpha < 1.0) ? LightMedium.Transparent : LightMedium.Opaque,
    position,
    uniformValues,
    uniformBuffer,
    uniformBindGroup
  });
}

export function drawQuad(
  position: Vector3,
  dimensions: Dimensions,
  color: Color,
): void {
  const uniformValues = createUniformValues(position, dimensions, color);
  const uniformBuffer = createBuffer(
    uniformValues,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  );
  const uniformBindGroup = device.createBindGroup({
    layout: uniformBindGroupLayout,
    entries: [{
      binding: 0,
      resource: {
        buffer: uniformBuffer,
      },
    }],
  });

  const alpha = color.a ?? 1.0;
  pendingRenderRequests.push({
    type: RenderType.Quad,
    lightMedium: (alpha < 1.0) ? LightMedium.Transparent : LightMedium.Opaque,
    position,
    uniformValues,
    uniformBuffer,
    uniformBindGroup
  });
}

export function submit(): void {
  sortRenderingRequestsByDistance();

  submitRenderRequests(LightMedium.Opaque);
  submitRenderRequests(LightMedium.Transparent);

  pendingRenderRequests = [];
}

function sortRenderingRequestsByDistance(): void {
  pendingRenderRequests = pendingRenderRequests.sort((first, second) => {
    if ((first.position.z ?? 0) < (second.position.z ?? 0)) {
      return -1;
    }

    return (first.position.z === second.position.z) ? 0 : 1;
  });
}

function submitRenderRequests(typeToSubmit: LightMedium): void {
  let renderRequest: RenderRequest;
  const canvasTexture = context.getCurrentTexture();
  const commandEncoder = device.createCommandEncoder();
  for (let i = 0; i < pendingRenderRequests.length; i++) {
    renderRequest = pendingRenderRequests[i];
    if (renderRequest.lightMedium !== typeToSubmit) {
      continue;
    }

    const renderPass = commandEncoder.beginRenderPass({
      label: `Simple rendering pass for quads`,
      colorAttachments: [{
        view: canvasTexture.createView(),
        loadOp: 'load',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 0.0,
        depthLoadOp: 'load',
        depthStoreOp: 'store',
      },
    });
    device.queue.writeBuffer(renderRequest.uniformBuffer, 0, renderRequest.uniformValues);
    renderPass.setBindGroup(0, renderRequest.uniformBindGroup);
    renderPass.setPipeline(typeToSubmit === LightMedium.Opaque ? opaqueRenderPipeline : transparentRenderPipeline);

    if (renderRequest.type === RenderType.Quad) {
      renderPass.setVertexBuffer(0, simpleQuadVertexBuffer);
      renderPass.draw(3, 1, 0);
      renderPass.draw(3, 1, 3);
      renderPass.end();
      continue;
    }

    if (renderRequest.type === RenderType.Circle) {
      renderPass.setVertexBuffer(0, circleVertexBuffer);
      for (let i = 0; i < CIRCLE_FACES; i++) {
        renderPass.draw(3, 1, i * 3);
      }
      renderPass.end();
      continue;
    }
  }
  device.queue.submit([commandEncoder.finish()]);
}

function convertVector2ArrayToFloat32Array(input: Array<Vector2>): Float32Array {
  const numbers = new Array<number>();
  for (let vector of input) {
    numbers.push(vector.x);
    numbers.push(vector.y);
  }
  return new Float32Array(numbers);
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

function createPipelines(): void {
  simpleQuadVertexBuffer = createBuffer(
    convertVector2ArrayToFloat32Array([
      { x: -0.5, y: 0.5 },
      { x: 0.5, y: 0.5 },
      { x: -0.5, y: -0.5 },
      { x: -0.5, y: -0.5 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: -0.5 },
    ]),
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
  );

  const sliceRadians = TAU / CIRCLE_FACES;
  const circlePoints = new Array<Vector2>(CIRCLE_FACES);
  for (let i = 0; i < CIRCLE_FACES; i++) {
    const unitX = Math.sin(sliceRadians * i) * 0.5;
    const unitY = Math.cos(sliceRadians * i) * 0.5;
    circlePoints[i] = { x: unitX, y: unitY };
  }

  const centerVertex = { x: 0, y: 0 };
  const circleVertices = new Array<Vector2>(CIRCLE_FACES * 3);
  for (let i = 0; i < CIRCLE_FACES; i++) {
    circleVertices[i * 3] = centerVertex;
    circleVertices[i * 3 + 1] = circlePoints[i];
    circleVertices[i * 3 + 2] = circlePoints[(i + 1) % CIRCLE_FACES];
  }

  circleVertexBuffer = createBuffer(
    convertVector2ArrayToFloat32Array(circleVertices),
    GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  );

  uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {}
        }
    ]
  });

  const vertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: FLOAT32_SIZE * 2,
    attributes: [{
      shaderLocation: 0,
      format: 'float32x2',
      offset: 0,
    }],
  };
  opaqueRenderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: 'vertexMain',
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: 'fragmentMain',
      targets: [{ 
        format: navigator.gpu.getPreferredCanvasFormat(),
        blend: {
          alpha: {
            srcFactor: 'one',
            dstFactor: 'zero',
            operation: 'add',
          },
          color: {
            srcFactor: 'one',
            dstFactor: 'zero',
            operation: 'add',
          }
        }
      }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'front',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'greater-equal',
      format: 'depth24plus',
    }
  });

  transparentRenderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: 'vertexMain',
      buffers: [vertexBufferLayout],
    },
    fragment: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: 'fragmentMain',
      targets: [{ 
        format: navigator.gpu.getPreferredCanvasFormat(),
        blend: {
          alpha: {
            srcFactor: 'one',
            dstFactor: 'zero',
            operation: 'add',
          },
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one',
            operation: 'add',
          }
        }
      }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'front',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'greater-equal',
      format: 'depth24plus',
    }
  });
}
