function alignToFourBytes(size: number): number {
  return (size + 3) & ~3;
}

export function createBuffer(
  device: GPUDevice,
  data: Float32Array | Uint16Array,
  bufferUsage: number
) {
  let bufferDescription: GPUBufferDescriptor = {
    size: alignToFourBytes(data.byteLength),
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
