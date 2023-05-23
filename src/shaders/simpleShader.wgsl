struct UniformBuffer {
  gameDimensions: vec2<f32>,
  position: vec3<f32>,
  scale: vec2<f32>,
  color: vec4<f32>,
};

@group(0) @binding(0)
var<uniform> uniforms: UniformBuffer;

struct VertexShaderOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>
};

@vertex
fn vertexMain(
  @location(0) vertexPosition: vec2<f32>
) -> VertexShaderOutput {
  var gamePosition = (vertexPosition * uniforms.scale) + vec2<f32>(uniforms.position.x, uniforms.position.y);

  // Conversion: [0..gameDimensions] -> [0..1] -> [0..2] -> [-1..1]
  var clipSpacePosition = (gamePosition / uniforms.gameDimensions * 2) - 1;

  var output: VertexShaderOutput;
  output.position = vec4<f32>(clipSpacePosition, uniforms.position.z, 1.0);
  output.color = uniforms.color;
  return output;
}

@fragment
fn fragmentMain(@location(0) inputColor: vec4<f32>) -> @location(0) vec4<f32> {
  return inputColor;
}