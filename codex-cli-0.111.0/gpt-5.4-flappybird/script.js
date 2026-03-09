const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start-button");

const STORAGE_KEY = "flappy-bird-best-score";
const GRAVITY = 1800;
const FLAP_STRENGTH = -460;
const PIPE_SPEED = 180;
const PIPE_INTERVAL = 1450;
const PIPE_WIDTH = 76;
const PIPE_GAP = 170;
const GROUND_HEIGHT = 110;
const BIRD_X = 120;

function readBestScore() {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);
    const parsed = Number.parseInt(storedValue || "0", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeBestScore(score) {
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // Ignore storage failures so gameplay still works.
  }
}

const state = {
  phase: "idle",
  bird: {
    x: BIRD_X,
    y: canvas.height / 2 - 24,
    radius: 18,
    velocity: 0,
    rotation: 0,
  },
  pipes: [],
  score: 0,
  bestScore: readBestScore(),
  lastTime: 0,
  pipeTimer: 0,
};

bestScoreEl.textContent = String(state.bestScore);

function resetGame() {
  state.phase = "ready";
  state.bird.y = canvas.height / 2 - 24;
  state.bird.velocity = 0;
  state.bird.rotation = 0;
  state.pipes = [];
  state.score = 0;
  state.pipeTimer = 0;
  scoreEl.textContent = "0";
}

function startGame() {
  resetGame();
  state.phase = "running";
  hideOverlay();
  flap();
}

function flap() {
  if (state.phase === "idle") {
    startGame();
    return;
  }

  if (state.phase === "ready") {
    state.phase = "running";
    hideOverlay();
  }

  if (state.phase === "running") {
    state.bird.velocity = FLAP_STRENGTH;
  } else if (state.phase === "gameover") {
    showOverlay("Game Over", "Press Start Game or flap to try again.", "Play Again");
    resetGame();
  }
}

function showOverlay(title, message, buttonLabel) {
  overlay.classList.remove("hidden");
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = message;
  startButton.textContent = buttonLabel;
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function spawnPipe() {
  const minTop = 90;
  const maxTop = canvas.height - GROUND_HEIGHT - PIPE_GAP - 90;
  const topHeight = Math.random() * (maxTop - minTop) + minTop;

  state.pipes.push({
    x: canvas.width + PIPE_WIDTH,
    topHeight,
    bottomY: topHeight + PIPE_GAP,
    scored: false,
  });
}

function update(delta) {
  if (state.phase !== "running") {
    return;
  }

  state.pipeTimer += delta * 1000;
  if (state.pipeTimer >= PIPE_INTERVAL) {
    state.pipeTimer = 0;
    spawnPipe();
  }

  state.bird.velocity += GRAVITY * delta;
  state.bird.y += state.bird.velocity * delta;
  state.bird.rotation = Math.max(-0.6, Math.min(1.2, state.bird.velocity / 500));

  for (const pipe of state.pipes) {
    pipe.x -= PIPE_SPEED * delta;

    if (!pipe.scored && pipe.x + PIPE_WIDTH < state.bird.x) {
      pipe.scored = true;
      state.score += 1;
      scoreEl.textContent = String(state.score);
    }
  }

  state.pipes = state.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > -20);

  if (checkCollision()) {
    endGame();
  }
}

function checkCollision() {
  const birdTop = state.bird.y - state.bird.radius;
  const birdBottom = state.bird.y + state.bird.radius;
  const birdLeft = state.bird.x - state.bird.radius;
  const birdRight = state.bird.x + state.bird.radius;

  if (birdTop <= 0 || birdBottom >= canvas.height - GROUND_HEIGHT) {
    return true;
  }

  return state.pipes.some((pipe) => {
    const withinPipeX = birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH;
    const hitsTop = birdTop < pipe.topHeight;
    const hitsBottom = birdBottom > pipe.bottomY;
    return withinPipeX && (hitsTop || hitsBottom);
  });
}

function endGame() {
  state.phase = "gameover";

  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    writeBestScore(state.bestScore);
    bestScoreEl.textContent = String(state.bestScore);
  }

  showOverlay("Game Over", `Score ${state.score}. Press Start Game or flap to try again.`, "Play Again");
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#8ed9ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
  drawCloud(80, 120, 0.9);
  drawCloud(280, 190, 1.1);
  drawCloud(190, 70, 0.7);
}

function drawCloud(x, y, scale) {
  ctx.beginPath();
  ctx.arc(x, y, 22 * scale, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 24 * scale, y - 12 * scale, 18 * scale, Math.PI, Math.PI * 2);
  ctx.arc(x + 48 * scale, y, 22 * scale, Math.PI * 1.5, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

function drawPipes() {
  for (const pipe of state.pipes) {
    drawPipe(pipe.x, 0, pipe.topHeight, true);
    drawPipe(pipe.x, pipe.bottomY, canvas.height - GROUND_HEIGHT - pipe.bottomY, false);
  }
}

function drawPipe(x, y, height, upsideDown) {
  ctx.fillStyle = "#69bf43";
  ctx.fillRect(x, y, PIPE_WIDTH, height);

  ctx.fillStyle = "#4f9f2d";
  ctx.fillRect(x + PIPE_WIDTH - 10, y, 10, height);

  const lipY = upsideDown ? y + height - 28 : y;
  ctx.fillStyle = "#7fdb57";
  ctx.fillRect(x - 6, lipY, PIPE_WIDTH + 12, 28);

  ctx.fillStyle = "#3f7f23";
  ctx.fillRect(x + PIPE_WIDTH - 4, lipY, 10, 28);
}

function drawGround(time) {
  const groundY = canvas.height - GROUND_HEIGHT;

  ctx.fillStyle = "#d6b15e";
  ctx.fillRect(0, groundY, canvas.width, GROUND_HEIGHT);

  ctx.fillStyle = "#b78f41";
  for (let x = -((time / 6) % 32); x < canvas.width + 32; x += 32) {
    ctx.fillRect(x, groundY + 14, 18, 12);
    ctx.fillRect(x + 12, groundY + 40, 18, 12);
    ctx.fillRect(x, groundY + 66, 18, 12);
  }

  ctx.fillStyle = "#7cb342";
  ctx.fillRect(0, groundY, canvas.width, 18);
  ctx.fillStyle = "#5a8d27";
  ctx.fillRect(0, groundY + 18, canvas.width, 6);
}

function drawBird() {
  ctx.save();
  ctx.translate(state.bird.x, state.bird.y);
  ctx.rotate(state.bird.rotation);

  ctx.fillStyle = "#ffd54f";
  ctx.beginPath();
  ctx.arc(0, 0, state.bird.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f6b300";
  ctx.beginPath();
  ctx.ellipse(-4, 4, 12, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(7, -6, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1f1f1f";
  ctx.beginPath();
  ctx.arc(9, -6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff8c42";
  ctx.beginPath();
  ctx.moveTo(15, -1);
  ctx.lineTo(30, 5);
  ctx.lineTo(15, 11);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#ff6b6b";
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.lineTo(-28, -10);
  ctx.lineTo(-20, 4);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawReadyHint() {
  if (state.phase !== "ready") {
    return;
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fillRect(70, 260, 280, 70);
  ctx.strokeStyle = "#6d5418";
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 260, 280, 70);

  ctx.fillStyle = "#2b210d";
  ctx.font = '16px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.fillText("FLAP TO START", canvas.width / 2, 304);
}

function drawScore() {
  ctx.fillStyle = "rgba(43, 33, 13, 0.85)";
  ctx.font = '28px "Press Start 2P"';
  ctx.textAlign = "center";
  ctx.fillText(String(state.score), canvas.width / 2, 58);
}

function render(timestamp) {
  const delta = Math.min((timestamp - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = timestamp;

  update(delta);
  drawBackground();
  drawPipes();
  drawGround(timestamp);
  drawBird();
  drawReadyHint();

  if (state.phase === "running" || state.phase === "gameover") {
    drawScore();
  }

  requestAnimationFrame(render);
}

function handleInput(event) {
  if (event.type === "keydown" && event.code !== "Space") {
    return;
  }

  if (event.cancelable) {
    event.preventDefault();
  }

  flap();
}

startButton.addEventListener("click", () => startGame());
canvas.addEventListener("pointerdown", handleInput);
window.addEventListener("keydown", handleInput);

showOverlay("Tap to Fly", "Press Space, click, or tap to start.", "Start Game");
requestAnimationFrame(render);
