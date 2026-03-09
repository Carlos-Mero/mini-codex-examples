const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const finalScoreEl = document.getElementById("final-score");
const messageEl = document.getElementById("message");
const gameOverEl = document.getElementById("game-over");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FRAME_MS = 1000 / 60;
const GROUND_HEIGHT = 110;
const PIPE_WIDTH = 72;
const PIPE_GAP = 165;
const PIPE_SPEED = 2.8;
const PIPE_SPAWN_MS = 1450;
const GRAVITY = 0.42;
const FLAP_STRENGTH = -7.2;
const MAX_FALL_SPEED = 10;
const BIRD_X = 110;
const BIRD_START_Y = HEIGHT / 2 - 20;
const STORAGE_KEY = "flappy-bird-best-score";

let animationFrameId = 0;
let lastTime = 0;
let pipeSpawnTimer = 0;
let state = "ready";
let score = 0;
let bestScore = loadBestScore();
let groundOffset = 0;
let idleTime = 0;
let pipes = [];

const bird = {
  x: BIRD_X,
  y: BIRD_START_Y,
  width: 34,
  height: 24,
  velocity: 0,
  rotation: 0,
};

bestScoreEl.textContent = String(bestScore);

function loadBestScore() {
  try {
    return Number(localStorage.getItem(STORAGE_KEY) || 0);
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Ignore storage errors.
  }
}

function setOverlayVisibility({ message = false, gameOver = false }) {
  messageEl.className = `overlay ${message ? "visible" : "hidden"}`;
  gameOverEl.className = `overlay ${gameOver ? "visible" : "hidden"}`;
}

function resetGame() {
  score = 0;
  pipeSpawnTimer = 0;
  groundOffset = 0;
  idleTime = 0;
  pipes = [];

  bird.y = BIRD_START_Y;
  bird.velocity = 0;
  bird.rotation = 0;

  scoreEl.textContent = "0";
  finalScoreEl.textContent = "0";
}

function startGame(withImmediateFlap = false) {
  resetGame();
  state = "playing";
  setOverlayVisibility({ message: false, gameOver: false });

  if (withImmediateFlap) {
    bird.velocity = FLAP_STRENGTH;
  }
}

function endGame() {
  if (state !== "playing") {
    return;
  }

  state = "gameover";
  finalScoreEl.textContent = String(score);

  if (score > bestScore) {
    bestScore = score;
    bestScoreEl.textContent = String(bestScore);
    saveBestScore(bestScore);
  }

  setOverlayVisibility({ message: false, gameOver: true });
}

function flap() {
  if (state === "ready" || state === "gameover") {
    startGame(true);
    return;
  }

  if (state === "playing") {
    bird.velocity = FLAP_STRENGTH;
  }
}

function spawnPipe() {
  const safeTop = 70;
  const safeBottom = HEIGHT - GROUND_HEIGHT - 70;
  const minGapTop = safeTop;
  const maxGapTop = safeBottom - PIPE_GAP;
  const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);

  pipes.push({
    x: WIDTH + PIPE_WIDTH,
    width: PIPE_WIDTH,
    gapTop,
    gapBottom: gapTop + PIPE_GAP,
    counted: false,
  });
}

function updateIdle(deltaMs) {
  idleTime += deltaMs;
  bird.y = BIRD_START_Y + Math.sin(idleTime / 240) * 10;
  bird.rotation = Math.sin(idleTime / 320) * 0.08;
}

function updateBird(frameFactor) {
  bird.velocity = Math.min(bird.velocity + GRAVITY * frameFactor, MAX_FALL_SPEED);
  bird.y += bird.velocity * frameFactor;
  bird.rotation = Math.min(Math.max(bird.velocity * 0.08, -0.45), 1.2);
}

function updateGround(frameFactor) {
  const tileWidth = 36;
  groundOffset = (groundOffset + PIPE_SPEED * frameFactor) % tileWidth;
}

function updatePipes(deltaMs, frameFactor) {
  pipeSpawnTimer += deltaMs;

  while (pipeSpawnTimer >= PIPE_SPAWN_MS) {
    pipeSpawnTimer -= PIPE_SPAWN_MS;
    spawnPipe();
  }

  for (const pipe of pipes) {
    pipe.x -= PIPE_SPEED * frameFactor;

    if (!pipe.counted && pipe.x + pipe.width < bird.x) {
      pipe.counted = true;
      score += 1;
      scoreEl.textContent = String(score);
    }
  }

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > -5);
}

function intersectsPipe(pipe) {
  const birdLeft = bird.x - bird.width / 2;
  const birdRight = bird.x + bird.width / 2;
  const birdTop = bird.y - bird.height / 2;
  const birdBottom = bird.y + bird.height / 2;

  const overlapsHorizontally = birdRight > pipe.x && birdLeft < pipe.x + pipe.width;
  const hitsTopPipe = birdTop < pipe.gapTop;
  const hitsBottomPipe = birdBottom > pipe.gapBottom;

  return overlapsHorizontally && (hitsTopPipe || hitsBottomPipe);
}

function checkCollisions() {
  const hitsCeiling = bird.y - bird.height / 2 <= 0;
  const hitsGround = bird.y + bird.height / 2 >= HEIGHT - GROUND_HEIGHT;
  const hitsPipe = pipes.some(intersectsPipe);

  if (hitsCeiling || hitsGround || hitsPipe) {
    endGame();
  }
}

function drawCloud(x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.arc(x + radius, y + 6, radius * 0.8, 0, Math.PI * 2);
  ctx.arc(x - radius, y + 8, radius * 0.72, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#70c5ce");
  gradient.addColorStop(1, "#dff7ff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255, 255, 255, 0.78)";
  drawCloud(80, 110, 26);
  drawCloud(230, 85, 16);
  drawCloud(320, 170, 22);

  ctx.fillStyle = "#8fd16c";
  ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);
  ctx.fillStyle = "#75bf56";
  ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, 18);

  const tileWidth = 36;
  for (let x = -groundOffset; x < WIDTH + tileWidth; x += tileWidth) {
    ctx.fillStyle = "#d8c26d";
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT + 18, tileWidth - 4, 26);
    ctx.fillStyle = "#c9b457";
    ctx.fillRect(x, HEIGHT - GROUND_HEIGHT + 44, tileWidth - 4, 12);
  }
}

function drawPipes() {
  for (const pipe of pipes) {
    const capHeight = 22;
    const bottomHeight = HEIGHT - GROUND_HEIGHT - pipe.gapBottom;

    ctx.fillStyle = "#60c24e";
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapTop);
    ctx.fillRect(pipe.x, pipe.gapBottom, pipe.width, bottomHeight);

    ctx.fillStyle = "#4ca53c";
    ctx.fillRect(pipe.x - 4, pipe.gapTop - capHeight, pipe.width + 8, capHeight);
    ctx.fillRect(pipe.x - 4, pipe.gapBottom, pipe.width + 8, capHeight);

    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.fillRect(pipe.x + 10, 0, 10, pipe.gapTop);
    ctx.fillRect(pipe.x + 10, pipe.gapBottom, 10, bottomHeight);
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  ctx.fillStyle = "#ffd93d";
  ctx.beginPath();
  ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff9f1c";
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(22, -3);
  ctx.lineTo(22, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f3722c";
  ctx.beginPath();
  ctx.ellipse(-4, 2, 10, 6, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(6, -6, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#222222";
  ctx.beginPath();
  ctx.arc(7, -6, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawReadyHint() {
  if (state !== "ready") {
    return;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
  ctx.textAlign = "center";
  ctx.font = "700 28px system-ui";
  ctx.fillText("Get Ready!", WIDTH / 2, 220);
  ctx.font = "500 17px system-ui";
  ctx.fillText("Tap, click, or press Space to flap", WIDTH / 2, 250);
}

function drawGameOverShade() {
  if (state !== "gameover") {
    return;
  }

  ctx.fillStyle = "rgba(20, 20, 20, 0.32)";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function render() {
  drawBackground();
  drawPipes();
  drawBird();
  drawReadyHint();
  drawGameOverShade();
}

function update(deltaMs) {
  const frameFactor = deltaMs / FRAME_MS;

  if (state === "ready") {
    updateIdle(deltaMs);
    return;
  }

  if (state !== "playing") {
    return;
  }

  updateBird(frameFactor);
  updateGround(frameFactor);
  updatePipes(deltaMs, frameFactor);
  checkCollisions();
}

function gameLoop(timestamp) {
  const deltaMs = lastTime ? Math.min(timestamp - lastTime, 34) : FRAME_MS;
  lastTime = timestamp;

  update(deltaMs);
  render();
  animationFrameId = window.requestAnimationFrame(gameLoop);
}

function handleInput(event) {
  if (event.type === "keydown") {
    const validKey = event.code === "Space" || event.code === "ArrowUp";
    if (!validKey) {
      return;
    }
    event.preventDefault();
  }

  flap();
}

startBtn.addEventListener("click", () => startGame(true));
restartBtn.addEventListener("click", () => startGame(true));
window.addEventListener("keydown", handleInput);
canvas.addEventListener("mousedown", handleInput);
canvas.addEventListener(
  "touchstart",
  (event) => {
    event.preventDefault();
    handleInput(event);
  },
  { passive: false }
);

resetGame();
setOverlayVisibility({ message: true, gameOver: false });
render();
animationFrameId = window.requestAnimationFrame(gameLoop);
window.addEventListener("beforeunload", () => window.cancelAnimationFrame(animationFrameId));
