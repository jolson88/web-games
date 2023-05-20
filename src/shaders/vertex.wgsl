@vertex
fn main(
  @builtin(vertex_index) VertexIndex : u32
) -> @builtin(position) vec4<f32> {
  var GAME_WIDTH: f32 = 224;
  var GAME_HEIGHT: f32 = 288;
  var positions = array<vec2<f32>, 3>(
    vec2(0, GAME_HEIGHT),
    vec2(0, 0),
    vec2(GAME_WIDTH, GAME_HEIGHT)
  );

  // Put game coordinates into clip space (-1, 1)
  var vector = positions[VertexIndex];
  var x = (vector.x / GAME_WIDTH * 2) - 1;
  var y = (vector.y / GAME_HEIGHT * 2) - 1;
  return vec4<f32>(x, y, 0.0, 1.0);
}