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
    { x: 100, y: 100 },
    { width: 50, height: 50 },
    { r: 1.0, g: 0.0, b: 0.0 }
  );
  Graphics.drawQuad(
    { x: 100, y: 200 },
    { width: 190, height: 5 },
    { r: 0.0, g: 1.0, b: 0.0 }
  );
  Graphics.drawQuad(
    { x: 130, y: 130 },
    { width: 50, height: 50 },
    { r: 0.0, g: 0.0, b: 1.0 }
  );

  Graphics.submit();
}

start();