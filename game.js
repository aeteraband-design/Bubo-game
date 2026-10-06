const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');

let width = 400, height = 700, gameActive = false, score = 0;
let owl = { x: 90, y: 260, radius: 25, vy: 0, gravity: 0.25, jump: -5.0, visible: true, rotation: 0 };
let pipes = [];

function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

function update() {
    if (!gameActive) return;
    owl.vy += owl.gravity;
    owl.y += owl.vy;

    if (owl.y + owl.radius > height || owl.y - owl.radius < 0) {
        gameActive = false;
        document.getElementById('gameOverModal').classList.remove('hidden');
    }
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#140326'; ctx.fillRect(0, 0, width, height);
    OwlRenderer.drawOwl(ctx, owl, 0);
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('topHud').classList.remove('hidden');
    gameActive = true;
    owl.y = height / 2;
    owl.vy = 0;
});

document.getElementById('restartBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.add('hidden');
    gameActive = true;
    owl.y = height / 2;
    owl.vy = 0;
    score = 0;
});

container.addEventListener('pointerdown', () => {
    if (gameActive) owl.vy = owl.jump;
});

OwlRenderer.setDynamicFavicon();
requestAnimationFrame(loop);