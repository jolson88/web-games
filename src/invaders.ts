import "./style.css";
import * as Graphics from "./graphics";

const GAME_WIDTH = 224;
const GAME_HEIGHT = 288;

let lastFrameTime: DOMHighResTimeStamp;

async function start(): Promise<void> {
  await Graphics.initialize("gameCanvas", GAME_WIDTH, GAME_HEIGHT);

  lastFrameTime = performance.now();
  requestAnimationFrame(frame);
}

function frame(time: DOMHighResTimeStamp): void {
  const deltaTimeInMs = time - lastFrameTime;

  simulate(deltaTimeInMs / 1000);
  render();

  lastFrameTime = time;
  requestAnimationFrame(frame);
}

function simulate(_secondsDelta: number): void {
  // Do nothing yet
}

function render(): void {
  Graphics.clearScreen({ r: 0.0, g: 0.0, b: 0.0 });

  Graphics.drawQuad(
    { x: 100, y: 120, z: 0.8 },
    { width: 50, height: 50 },
    { r: 1.0, g: 0.0, b: 0.0, a: 0.8 }
  );
  Graphics.drawQuad(
    { x: 130, y: 130, z: 0.2 },
    { width: 50, height: 50 },
    { r: 0.0, g: 0.0, b: 1.0, a: 1.0 }
  );
  Graphics.drawQuad(
    { x: 100, y: 130, z: 0.1 },
    { width: 190, height: 5 },
    { r: 0.0, g: 0.8, b: 0.0 }
  );
  Graphics.drawQuad(
    { x: 30, y: 110 },
    { width: 20, height: 180 },
    { r: 0.3, g: 0.3, b: 0.6 }
  );

  Graphics.submit();
}

start();