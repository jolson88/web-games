let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;

function start(): void {
  initializeCanvas();
}

function initializeCanvas(): void {
  canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
  if (!canvas) {
    throw new Error('Could not initialize canvas');
  }

  canvas.width = window.innerWidth * 2; // Account for high-DPI screens
  canvas.height = window.innerHeight * 2;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;

  context = canvas.getContext('2d') as CanvasRenderingContext2D;
  if (!context) {
    throw new Error('Could not get 2d context');
  }

  context.scale(2, 2);
  context.fillStyle = 'rgb(100, 0, 255)';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

start();
