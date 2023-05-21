function alignToFourBytes(size: number): number {
  return (size + 3) & ~3;
}

export function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint16Array,
  bufferUsage: number
): GPUBuffer {
  let bufferDescription: GPUBufferDescriptor = {
    size: alignToFourBytes(data.byteLength),
    usage: bufferUsage,
    mappedAtCreation: true,
  };
  const buffer = device.createBuffer(bufferDescription);
  fillBuffer(buffer, data);
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
