export interface Color {
  r: number,
  g: number,
  b: number,
  a?: number,
}

function alignToFourBytes(size: number): number {
  return (size + 3) & ~3;
}

function alignToSixteenBytes(size: number): number {
  return (size + 15) & ~15;
}

export function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint16Array,
  bufferUsage: number
): GPUBuffer {
  const isUniform = new Boolean(bufferUsage & GPUBufferUsage.UNIFORM);
  let bufferDescription: GPUBufferDescriptor = {
    size: isUniform ? alignToSixteenBytes(data.byteLength) : alignToFourBytes(data.byteLength),
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

export function fillBuffer(
  buffer: GPUBuffer,
  data: Float32Array | Uint16Array
): void {
  const writeArray =
    data instanceof Uint16Array
      ? new Uint16Array(buffer.getMappedRange())
      : new Float32Array(buffer.getMappedRange());
  writeArray.set(data);
  buffer.unmap();
}

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
