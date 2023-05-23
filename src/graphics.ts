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

export enum RenderRequestType {
  Opaque,
  Transparent
};

interface RenderRequest {
  type: RenderRequestType,
  position: Vector3,
  uniformValues: Float32Array,
  uniformBuffer: GPUBuffer,
  uniformBindGroup: GPUBindGroup,
}

const FLOAT32_SIZE = 4;

let device: GPUDevice;
let context: GPUCanvasContext;
let depthTexture: GPUTexture;
let screenWidth: number;
let screenHeight: number;

let pendingRenderRequests: Array<RenderRequest> = [];
let opaqueRenderPipeline: GPURenderPipeline;
let transparentRenderPipeline: GPURenderPipeline;
let uniformBindGroupLayout: GPUBindGroupLayout;

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
  const devicePixelRatio = window.devicePixelRatio || 1;
  const height = window.innerHeight * devicePixelRatio;
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

export function drawQuad(
  position: Vector3,
  dimensions: Dimensions,
  color: Color,
): void {
  const alpha = color.a ?? 1.0;
  const uniformValues = new Float32Array([
    screenWidth, screenHeight, 1.0, 0.0,
    position.x, position.y, position.z ?? 0.0, 0.0,
    dimensions.width, dimensions.height, 0.0, 0.0,
    color.r, color.g, color.b, 1.0, // TODO: Restore alpha,
  ]);
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

  pendingRenderRequests.push({
    type: (alpha < 1.0) ? RenderRequestType.Transparent : RenderRequestType.Opaque,
    position,
    uniformValues,
    uniformBuffer,
    uniformBindGroup
  });
}

function sortRenderingRequestsByDistance(): void {
  pendingRenderRequests = pendingRenderRequests.sort((first, second) => {
    if ((first.position.z ?? 0) < (second.position.z ?? 0)) {
      return -1;
    }

    return (first.position.z === second.position.z) ? 0 : 1;
  });
}

export function submit(): void {
  sortRenderingRequestsByDistance();

  submitRenderRequests(RenderRequestType.Opaque);
  submitRenderRequests(RenderRequestType.Transparent);

  pendingRenderRequests = [];
}

function submitRenderRequests(typeToSubmit: RenderRequestType): void {
  let renderRequest: RenderRequest;
  const canvasTexture = context.getCurrentTexture();
  const commandEncoder = device.createCommandEncoder();
  for (let i = 0; i < pendingRenderRequests.length; i++) {
    renderRequest = pendingRenderRequests[i];
    if (renderRequest.type !== typeToSubmit) {
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
    renderPass.setVertexBuffer(0, simpleQuadVertexBuffer);
    renderPass.setPipeline(typeToSubmit === RenderRequestType.Opaque ? opaqueRenderPipeline : transparentRenderPipeline);
    renderPass.draw(3, 1, 0);
    renderPass.draw(3, 1, 3);
    renderPass.end();
  }
  device.queue.submit([commandEncoder.finish()]);
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
  const quadVertexBufferLayout: GPUVertexBufferLayout = {
    arrayStride: FLOAT32_SIZE * 2,
    attributes: [{
      shaderLocation: 0,
      format: 'float32x2',
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

  uniformBindGroupLayout = device.createBindGroupLayout({
    entries: [
        {
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: {}
        }
    ]
  });

  opaqueRenderPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [uniformBindGroupLayout],
    }),
    vertex: {
      module: device.createShaderModule({
        code: shaderCode,
      }),
      entryPoint: 'vertexMain',
      buffers: [quadVertexBufferLayout],
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
      buffers: [quadVertexBufferLayout],
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
