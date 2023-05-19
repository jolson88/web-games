import "./style.css";

const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
  throw new Error("WebGPU not supported");
}

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

const context = canvas.getContext("webgpu");
if (!context) {
  throw new Error("WebGPU not supported");
}

context.configure({
  device,
  format: canvasFormat,
});

const shaderModule = device.createShaderModule({
  label: "Hard-coded red triangle shaders",
  code: `
    @vertex fn vs(
        @builtin(vertex_index) vertexIndex: u32
    ) -> @builtin(position) vec4f {
        var pos = array<vec2f, 3>(
            vec2f( 0.0,  0.5),
            vec2f(-0.5, -0.5),
            vec2f( 0.5, -0.5)
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
    }

    @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
    }
  `,
});

const pipeline = device.createRenderPipeline({
  label: "Hard-coded red triangle pipeline",
  layout: "auto",
  vertex: {
    module: shaderModule,
    entryPoint: "vs",
  },
  fragment: {
    module: shaderModule,
    entryPoint: "fs",
    targets: [{ format: canvasFormat }],
  },
});

function render(device: GPUDevice, context: GPUCanvasContext): void {
  const renderPassDescriptor: GPURenderPassDescriptor = {
    label: "Basic canvas render pass",
    colorAttachments: [
      {
        view: context.getCurrentTexture().createView(),
        clearValue: [0.3, 0.3, 0.3, 1.0],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const encoder = device.createCommandEncoder({ label: "Our command encoder" });

  const pass = encoder.beginRenderPass(renderPassDescriptor);
  pass.setPipeline(pipeline);
  pass.draw(3); // Call vertex shader three times
  pass.end();

  const commandBuffer = encoder.finish();
  device.queue.submit([commandBuffer]);
}

render(device, context);
