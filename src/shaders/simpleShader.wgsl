struct UniformBuffer {
  gameDimensions: vec2<f32>,
  position: vec2<f32>,
  color: vec4<f32>,
  scale: vec2<f32>,
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
  var x = (vertexPosition.x * uniforms.scale.x) + uniforms.position.x;
  var y = (vertexPosition.y * uniforms.scale.y) + uniforms.position.y;
  var clipX = (x / uniforms.gameDimensions.x * 2) - 1;
  var clipY = (y / uniforms.gameDimensions.y * 2) - 1;

  var output: VertexShaderOutput;
  output.position = vec4<f32>(clipX, clipY, 0.0, 1.0);
  output.color = uniforms.color;
  return output;
}

@fragment
fn fragmentMain(@location(0) inputColor: vec4<f32>) -> @location(0) vec4<f32> {
  return inputColor;
}