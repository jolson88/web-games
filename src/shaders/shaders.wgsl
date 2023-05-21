struct UniformBuffer {
  gameWidth: f32,
  gameHeight: f32
};

@group(0) @binding(0)
var<uniform> uniforms: UniformBuffer;

struct VertexShaderOutput {
  @builtin(position) clipSpacePosition: vec4<f32>,
  @location(0) color: vec4<f32>
};

@vertex
fn vertexMain(
  @location(0) vertexPosition: vec2<f32>,
) -> VertexShaderOutput {
  // Our vertices coming from game are in game coordinates.
  // Clip space is in the range [-1, 1] for all dimensions.
  // Convert vertices to clip space.
  var x = (vertexPosition.x / uniforms.gameWidth * 2) - 1;
  var y = (vertexPosition.y / uniforms.gameHeight * 2) - 1;

  var output: VertexShaderOutput;
  output.clipSpacePosition = vec4<f32>(x, y, 0.0, 1.0);
  output.color = vec4<f32>(1.0, 0.0, 0.0, 1.0);
  return output;
}

@fragment
fn fragmentMain(@location(0) inputColor: vec4<f32>) -> @location(0) vec4<f32> {
  return inputColor;
}