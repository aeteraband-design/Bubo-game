const Haptics = {
    enabled: true,
    vibrate(pattern) { if (this.enabled && navigator.vibrate) try { navigator.vibrate(pattern); } catch(e) {} },
    flap() { this.vibrate(8); },
    collectTheme() { this.vibrate([35, 25, 45]); },
    powerup() { this.vibrate([45, 30, 60]); },
    hit() { this.vibrate([70, 35, 90]); },
    death() { this.vibrate([120, 50, 160, 50, 240]); }
};

const AudioFX = {
    ctx: null, musicGain: null, sfxGain: null,
    isMusicMuted: false, isSfxMuted: false, musicVolume: 0.38, sfxVolume: 1.0,
    mode: 'menu', musicTimer: null, step: 0,
    menuMelody: [293.66, 349.23, 440.00, 349.23, 523.25, 440.00, 392.00, 329.63, 440.00, 523.25, 587.33, 523.25, 440.00, 392.00, 349.23, 329.63],
    gameBass: [146.83, 146.83, 174.61, 146.83, 196.00, 174.61, 130.81, 164.81],
    gameArp: [293.66, 349.23, 440.00, 587.33, 523.25, 440.00, 349.23, 392.00],

    init() {
        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                    this.sfxGain = this.ctx.createGain();
                    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
                    this.sfxGain.connect(this.ctx.destination);
                    this.musicGain = this.ctx.createGain();
                    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
                    this.musicGain.connect(this.ctx.destination);
                }
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            if (!this.musicTimer) this.startMusicLoop();
        } catch(e) {}
    },
    resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
    setMuted(muted) {
        this.isMusicMuted = muted;
        if (this.musicGain && this.ctx) this.musicGain.gain.setValueAtTime(muted ? 0 : this.musicVolume, this.ctx.currentTime);
    },
    setMusicVolume(vol) { this.musicVolume = vol; if (this.musicGain && !this.isMusicMuted) this.musicGain.gain.setValueAtTime(vol, this.ctx.currentTime); },
    setSfxVolume(vol) { this.sfxVolume = vol; if (this.sfxGain) this.sfxGain.gain.setValueAtTime(vol, this.ctx.currentTime); },
    toggleMusic() { this.resume(); this.setMuted(!this.isMusicMuted); },
    setMode(newMode) { if (this.mode === newMode) return; this.mode = newMode; this.step = 0; },
    startMusicLoop() {
        if (this.musicTimer) clearTimeout(this.musicTimer);
        const tick = () => {
            if (!this.ctx || this.isMusicMuted || !this.musicGain || this.ctx.state !== 'running') {
                this.musicTimer = setTimeout(tick, 300); return;
            }
            const now = this.ctx.currentTime;
            const freq = this.mode === 'menu' ? this.menuMelody[this.step % this.menuMelody.length] : this.gameArp[this.step % this.gameArp.length];
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.frequency.setValueAtTime(freq, now);
            g.gain.setValueAtTime(0.15, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.connect(g); g.connect(this.musicGain);
            osc.start(now); osc.stop(now + 0.2);
            this.step++;
            this.musicTimer = setTimeout(tick, 220);
        };
        tick();
    },
    playFlap() {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.frequency.setValueAtTime(280, now); osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);
        g.gain.setValueAtTime(0.18, now); g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(g); g.connect(this.sfxGain || this.ctx.destination);
        osc.start(now); osc.stop(now + 0.1);
    },
    playCollect() { this.playFlap(); },
    playHit() { this.playFlap(); }
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('gameContainer');

let width = 0, height = 0, lastTime = 0, dtMult = 1.0, frame = 0;
let gameActive = false, waitingFirstTap = true, hoverAngle = 0, hasStartedCampaign = false;
let attempts = 3, score = 0, lives = 3.0, stamina = 100.0;
let shieldTime = 0, slowMotionTime = 0, speedBoostTime = 0, invulnerableTime = 0;
let pipes = [], items = [], particles = [], stars = [];

const CATEGORIES = {
    music: { name: 'Музыка', color: '#E056FD', count: 20 },
    logic: { name: 'Обо всём', color: '#4ADE80', count: 15 },
    kino: { name: 'Кино', color: '#00D2FF', count: 10 },
    series: { name: 'Сериалы', color: '#F43F5E', count: 10 },
    cartoons: { name: 'Мультики', color: '#38BDF8', count: 10 },
    fun: { name: 'Фан-дом', color: '#2DD4BF', count: 5 }
};
let collected = { music: 0, logic: 0, kino: 0, series: 0, cartoons: 0, fun: 0 };

const owl = {
    x: 90, y: 260, baseY: 260, radius: 25, vy: 0, gravity: 0.26, jump: -5.2, rotation: 0, wing: 0, visible: true,
    flap() {
        this.vy = this.jump; this.wing = 1.0;
        AudioFX.playFlap(); Haptics.flap();
        stamina = Math.max(0, stamina - 0.25);
    },
    update() {
        if (waitingFirstTap) {
            hoverAngle += 0.055 * dtMult;
            this.y = this.baseY + Math.sin(hoverAngle) * 7.5;
            this.rotation = Math.sin(hoverAngle) * 0.05;
            return;
        }
        this.vy += this.gravity * dtMult;
        this.y += this.vy * dtMult;
        this.rotation = Math.min(0.48, Math.max(-0.38, this.vy * 0.055));
        if (this.wing > 0) this.wing -= 0.055 * dtMult;
    }
};

function resize() {
    width = container.clientWidth; height = container.clientHeight;
    canvas.width = width; canvas.height = height;
    if (stars.length === 0) {
        for (let i = 0; i < 50; i++) stars.push({ x: Math.random() * width, y: Math.random() * height, size: Math.random() * 1.5 + 0.5, alpha: Math.random() });
    }
}
window.addEventListener('resize', resize);
resize();

function getTotalCollectedThemes() {
    return Object.values(collected).reduce((a, b) => a + b, 0);
}

function getDifficultyMultipliers() {
    const total = getTotalCollectedThemes();
    if (total >= 42) return { speedMult: 1.30, level: 'ХАРД', color: '#F43F5E' };
    if (total >= 21) return { speedMult: 1.15, level: 'МЕДИУМ', color: '#F59E0B' };
    return { speedMult: 1.0, level: 'ЛАЙТ', color: '#22C55E' };
}

function updateHUD() {
    document.getElementById('scoreVal').innerText = score;
    document.getElementById('staminaVal').innerText = Math.round(stamina) + '%';
    const total = getTotalCollectedThemes();
    const diff = getDifficultyMultipliers();
    document.getElementById('diffLabel').innerText = diff.level;
    document.getElementById('diffLabel').style.color = diff.color;
    document.getElementById('diffPercent').innerText = Math.round((total / 70) * 100) + '%';
    document.getElementById('diffProgressBar').style.width = Math.round((total / 70) * 100) + '%';
}

function spawnPipe() {
    const baseGap = 234; const pipeWidth = 84;
    const topHeight = Math.floor(Math.random() * 180) + 60;
    pipes.push({ x: width + 25, width: pipeWidth, top: topHeight, bottom: height - (topHeight + baseGap) });
    
    // Спавн случайного бонуса/темы
    const keys = Object.keys(CATEGORIES);
    const chosenKey = keys[Math.floor(Math.random() * keys.length)];
    items.push({ x: width + 25 + pipeWidth / 2, y: topHeight + baseGap / 2, radius: 26, type: chosenKey, collected: false });
}

function handleTap(e) {
    AudioFX.resume();
    if (waitingFirstTap) {
        waitingFirstTap = false; gameActive = true; lastTime = 0;
        document.getElementById('tapToStartMsg').classList.add('hidden');
        spawnPipe(); owl.flap();
        return;
    }
    if (gameActive) owl.flap();
}

container.addEventListener('pointerdown', handleTap);
window.addEventListener('keydown', (e) => { if (e.code === 'Space') handleTap({}); });

function update() {
    owl.update();
    if (!gameActive) return;
    frame += dtMult;

    stamina = Math.max(0, stamina - 0.04 * dtMult);
    if (stamina <= 0) { handleRunFailure('Кончились силы!'); return; }

    const diff = getDifficultyMultipliers();
    let currentSpeed = 2.24 * diff.speedMult;

    // Движение труб
    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= currentSpeed * dtMult;
        if (pipes[i].x < -40) { pipes.splice(i, 1); spawnPipe(); score++; }

        // Коллизии с трубами
        if (shieldTime <= 0 && invulnerableTime <= 0) {
            if (owl.x + owl.radius > pipes[i].x && owl.x - owl.radius < pipes[i].x + pipes[i].width) {
                if (owl.y - owl.radius < pipes[i].top || owl.y + owl.radius > height - pipes[i].bottom) {
                    handleHit();
                }
            }
        }
    }

    // Движение предметов
    for (let i = items.length - 1; i >= 0; i--) {
        items[i].x -= currentSpeed * dtMult;
        if (Math.hypot(owl.x - items[i].x, owl.y - items[i].y) < owl.radius + items[i].radius && !items[i].collected) {
            items[i].collected = true;
            collected[items[i].type]++;
            AudioFX.playCollect();
            items.splice(i, 1);
        }
        if (items[i] && items[i].x < -40) items.splice(i, 1);
    }

    if (owl.y + owl.radius > height || owl.y - owl.radius < 0) handleHit();
}

function handleHit() {
    AudioFX.playHit();
    lives = Math.max(0, lives - 1.0);
    if (lives <= 0) handleRunFailure('Кончились жизни!');
    else invulnerableTime = 90;
}

function handleRunFailure(reason) {
    gameActive = false; waitingFirstTap = false;
    attempts = Math.max(0, attempts - 1);
    document.getElementById('gameOverModal').classList.remove('hidden');
    document.getElementById('gameOverSubtext').innerText = reason;
}

function draw() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#140326'; ctx.fillRect(0, 0, width, height);

    stars.forEach(st => {
        ctx.fillStyle = `rgba(255, 255, 255, ${st.alpha})`;
        ctx.beginPath(); ctx.arc(st.x, st.y, st.size, 0, Math.PI * 2); ctx.fill();
    });

    pipes.forEach(p => {
        ctx.fillStyle = '#7a22d6';
        ctx.fillRect(p.x, 0, p.width, p.top);
        ctx.fillRect(p.x, height - p.bottom, p.width, p.bottom);
    });

    items.forEach(it => {
        ctx.fillStyle = CATEGORIES[it.type]?.color || '#FE7600';
        ctx.beginPath(); ctx.arc(it.x, it.y, it.radius, 0, Math.PI * 2); ctx.fill();
    });

    OwlRenderer.drawOwl(ctx, owl, frame);
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = timestamp - lastTime; lastTime = timestamp;
    dtMult = Math.min(dt / 16.666, 2.0);

    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Управление кнопками интерфейса
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('topHud').classList.remove('hidden');
    document.getElementById('bottomHud').classList.remove('hidden');
    waitingFirstTap = true;
});

document.getElementById('openRulesBtn').addEventListener('click', () => document.getElementById('rulesModal').classList.remove('hidden'));
document.getElementById('closeRulesBtn').addEventListener('click', () => document.getElementById('rulesModal').classList.add('hidden'));
document.getElementById('understoodRulesBtn').addEventListener('click', () => document.getElementById('rulesModal').classList.add('hidden'));
document.getElementById('openSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('hidden'));
document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));
document.getElementById('saveSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.add('hidden'));

document.getElementById('restartFromGameOverBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.add('hidden');
    lives = 3.0; stamina = 100.0; score = 0; waitingFirstTap = true; gameActive = false;
    pipes = []; items = [];
});

OwlRenderer.setDynamicFavicon();
requestAnimationFrame(gameLoop);