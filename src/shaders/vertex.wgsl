struct UniformBuffer {
  gameWidth: f32,
  gameHeight: f32
};

@group(0) @binding(0)
var<uniform> uniforms: UniformBuffer;

@vertex
fn main(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4<f32> {
  var positions = array<vec2<f32>, 3>(
    vec2(0, uniforms.gameHeight),
    vec2(0, 0),
    vec2(uniforms.gameWidth, uniforms.gameHeight)
  );

  // Put game coordinates into clip space (-1, 1)
  var vector = positions[VertexIndex];
  var x = (vector.x / uniforms.gameWidth * 2) - 1;
  var y = (vector.y / uniforms.gameHeight * 2) - 1;
  return vec4<f32>(x, y, 0.0, 1.0);
}