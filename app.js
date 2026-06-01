/** 
 * GLOBALS, STATES & UTILITIES
 */
const videoElement = document.querySelector('.input_video');
const bgCanvas = document.getElementById('bgCanvas');
const mainCanvas = document.getElementById('mainCanvas');
const bgCtx = bgCanvas.getContext('2d');
const ctx = mainCanvas.getContext('2d');

let width = window.innerWidth;
let height = window.innerHeight;

let time = 0;
let lastTime = performance.now();
let framesThisSecond = 0;
let lastFpsTime = performance.now();

let currentHands = []; // Holds MediaPipe tracked data
let handVelocities = 0; // Average motion speed of first hand
let lastPinchState = [false, false]; // Double buffer to detect single-frame pinch triggers
let handChargeLevel = [0, 0]; // For charging Fist gestures [hand0, hand1]
let visualizerData = new Array(64).fill(0); // Holds wave levels for display

// Custom visual connection indices
const FINGER_TIPS = [4, 8, 12, 16, 20];
const PALM_WRIST = 0;
const SKELETON_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8],       // Index
    [5, 9], [9, 10], [10, 11], [11, 12],   // Middle
    [9, 13], [13, 14], [14, 15], [15, 16], // Ring
    [13, 17], [17, 18], [18, 19], [19, 20],// Pinky
    [0, 17] // Palm Base Line
];

// Color Theme Config
let currentTheme = 'Rainbow';
const themes = {
    'Rainbow':   (t, index, total) => `hsl(${(t * 80 + index * (360 / Math.max(1, total))) % 360}, 100%, 60%)`,
    'Cyberpunk': (t, index, total) => (index % 2 === 0) ? '#ff0055' : '#00f3ff',
    'Lava':      (t, index, total) => `hsl(${(15 + (index * 8)) % 45}, 100%, ${50 + Math.sin(t * 3.5) * 12}%)`,
    'Ocean':     (t, index, total) => `hsl(${175 + (index * 15)}, 100%, ${55 + Math.cos(t * 2) * 10}%)`,
    'Galaxy':    (t, index, total) => `hsl(${265 + Math.sin(t * 1.5 + index) * 35}, 100%, 65%)`
};

// Particles, Ripples & UI Telemetry Elements
let particles = [];
let ripples = [];
const uiHands = document.getElementById('ui-hands');
const uiFps = document.getElementById('ui-fps');
const uiGesture = document.getElementById('ui-gesture');
const uiSpread = document.getElementById('ui-spread');

// Config parameters customizable inside HUD
let sensitivity = 0.05; // Pinch distance threshold
let showMatrix = true;
let showSparks = true;
let showArcs = true;
let showMandala = true;
let enableAudio = false;

// Matrix background columns
let matrixColumns = [];
const fontSize = 15;
let maxColumns = 0;

/**
 * HIGH-PERFORMANCE CUSTOM PARTICLE PHYSICS
 */
class Particle {
    constructor(x, y, color, vx, vy, type = 'spark') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = 1.0;
        this.type = type; // 'spark', 'bubble', 'charge'
        this.size = Math.random() * 3 + (type === 'bubble' ? 6 : 1.5);
        this.decay = Math.random() * 0.018 + 0.012;
        this.gravity = type === 'bubble' ? -0.06 : 0.08;
        this.friction = type === 'bubble' ? 0.98 : 0.95;
        this.angle = Math.random() * Math.PI * 2;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        
        if (this.type === 'bubble') {
            this.x += Math.sin(this.life * 8 + this.angle) * 0.7; // Sideways wave drift
        }

        this.life -= this.decay;
    }

    draw(canvasCtx) {
        if (this.life <= 0) return;
        canvasCtx.save();
        canvasCtx.globalAlpha = Math.max(0, this.life);
        canvasCtx.beginPath();
        if (this.type === 'bubble') {
            canvasCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            canvasCtx.strokeStyle = this.color;
            canvasCtx.lineWidth = 1.8;
            canvasCtx.stroke();
            
            // Highlight reflective bubble dot
            canvasCtx.beginPath();
            canvasCtx.arc(this.x - this.size * 0.35, this.y - this.size * 0.35, this.size * 0.2, 0, Math.PI * 2);
            canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            canvasCtx.fill();
        } else {
            canvasCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            canvasCtx.fillStyle = this.color;
            canvasCtx.fill();
        }
        canvasCtx.restore();
    }
}

/**
 * INITIALIZATION & RESIZING
 */
function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    bgCanvas.width = width;
    bgCanvas.height = height;
    mainCanvas.width = width;
    mainCanvas.height = height;
    
    maxColumns = Math.floor(width / fontSize);
    matrixColumns = new Array(maxColumns).fill(1).map(() => Math.random() * (height / fontSize));
}
window.addEventListener('resize', resize);
resize();

// Startup visual logs inside Splash Card
const diagTerminal = document.getElementById('diagTerminal');
const splashLogs = [
    { delay: 100, text: "[SYSTEM] Booting cybernetic framework...", type: "prompt" },
    { delay: 700, text: "[CAMERA] Searching visual feeds...", type: "text" },
    { delay: 1200, text: "[NEURAL] Loading MediaPipe Hands v0.1...", type: "text" },
    { delay: 1800, text: "[SYNTH] Aligning low-frequency ambient sweep...", type: "text" },
    { delay: 2300, text: "[STATUS] Secure sandbox validated. Ready.", type: "prompt" }
];

let logIndex = 0;
function playDiagnostics() {
    if (logIndex >= splashLogs.length) return;
    const current = splashLogs[logIndex];
    setTimeout(() => {
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="terminal-prompt">${current.type === "prompt" ? "&gt;" : "#"}</span><span class="terminal-text">${current.text}</span>`;
        diagTerminal.appendChild(line);
        diagTerminal.scrollTop = diagTerminal.scrollHeight;
        logIndex++;
        playDiagnostics();
    }, current.delay - (logIndex > 0 ? splashLogs[logIndex - 1].delay : 0));
}
playDiagnostics();

// HUD UI Event Listeners
document.getElementById('toggleMatrix').addEventListener('change', (e) => showMatrix = e.target.checked);
document.getElementById('toggleSparks').addEventListener('change', (e) => showSparks = e.target.checked);
document.getElementById('toggleArcs').addEventListener('change', (e) => showArcs = e.target.checked);
document.getElementById('toggleMandala').addEventListener('change', (e) => showMandala = e.target.checked);
document.getElementById('toggleAudio').addEventListener('change', (e) => {
    enableAudio = e.target.checked;
    if (enableAudio) {
        initAudio();
    } else if (audioCtx) {
        masterGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
    }
});

const sensitivitySlider = document.getElementById('pinchSensitivity');
const sensitivityVal = document.getElementById('sensitivityVal');
sensitivitySlider.addEventListener('input', (e) => {
    sensitivity = parseFloat(e.target.value);
    sensitivityVal.innerText = sensitivity.toFixed(2);
});

// Color Theme Buttons
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentTheme = e.target.getAttribute('data-theme');
        
        // Grab dummy accent color for panel updates
        const nextAccent = themes[currentTheme](0, 1, 2);
        document.documentElement.style.setProperty('--accent', nextAccent);
        // Extract RGB cleanly
        const hex = nextAccent.startsWith('hsl') ? '0, 255, 204' : nextAccent;
        if (hex.startsWith('#')) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
        }
    });
});

// Dragging Control Panel Handler
const controlPanel = document.getElementById('controlPanel');
const dragHeader = document.getElementById('dragHeader');
let isDragging = false;
let startX, startY, initialLeft, initialRight;

dragHeader.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    const rect = controlPanel.getBoundingClientRect();
    initialLeft = rect.left;
    initialRight = window.innerWidth - rect.right;
    
    document.addEventListener('mousemove', dragPanel);
    document.addEventListener('mouseup', stopDragPanel);
});

function dragPanel(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    controlPanel.style.right = (initialRight - dx) + 'px';
    controlPanel.style.top = Math.max(10, Math.min(window.innerHeight - 300, rectTop() + dy)) + 'px';
    startX = e.clientX;
    startY = e.clientY;
}

function rectTop() {
    return controlPanel.getBoundingClientRect().top;
}

function stopDragPanel() {
    isDragging = false;
    document.removeEventListener('mousemove', dragPanel);
    document.removeEventListener('mouseup', stopDragPanel);
}

// Mobile touch-dragging support for holographic panel
dragHeader.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    const rect = controlPanel.getBoundingClientRect();
    initialRight = window.innerWidth - rect.right;
    
    document.addEventListener('touchmove', dragPanelTouch, {passive: false});
    document.addEventListener('touchend', stopDragPanelTouch);
});

function dragPanelTouch(e) {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    
    controlPanel.style.right = (initialRight - dx) + 'px';
    controlPanel.style.top = Math.max(10, Math.min(window.innerHeight - 300, rectTop() + dy)) + 'px';
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    e.preventDefault();
}

function stopDragPanelTouch() {
    isDragging = false;
    document.removeEventListener('touchmove', dragPanelTouch);
    document.removeEventListener('touchend', stopDragPanelTouch);
}

// Triggers camera and models load
document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('startOverlay').classList.add('hidden');
    setTimeout(() => {
        document.getElementById('startOverlay').classList.add('none');
    }, 800);
    
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controlPanel').classList.remove('hidden');
    document.getElementById('themes').classList.remove('hidden');
    
    initMediaPipe();
    requestAnimationFrame(renderLoop);
});


/**
 * WEB AUDIO SYNTHESIZER ENGINE
 */
let audioCtx = null;
let masterGain = null;
let droneOscA = null;
let droneOscB = null;
let ambientFilter = null;
let polyOscs = [];
let polyGains = [];
let audioAnalyser = null;

function initAudio() {
    if (audioCtx) {
        if (enableAudio) {
            masterGain.gain.setTargetAtTime(0.25, audioCtx.currentTime, 0.1);
        }
        return;
    }
    
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Master levels
        masterGain = audioCtx.createGain();
        masterGain.gain.value = enableAudio ? 0.25 : 0;
        
        // Analyzer for telemetry wave visualizer inside control panel
        audioAnalyser = audioCtx.createAnalyser();
        audioAnalyser.fftSize = 64;
        
        masterGain.connect(audioAnalyser);
        audioAnalyser.connect(audioCtx.destination);

        // A. Low-frequency ambient filter & FM hum drone
        ambientFilter = audioCtx.createBiquadFilter();
        ambientFilter.type = 'lowpass';
        ambientFilter.frequency.value = 180;
        ambientFilter.Q.value = 4.5;
        ambientFilter.connect(masterGain);

        droneOscA = audioCtx.createOscillator();
        droneOscB = audioCtx.createOscillator();
        const droneGainA = audioCtx.createGain();
        const droneGainB = audioCtx.createGain();
        
        droneOscA.type = 'sawtooth';
        droneOscB.type = 'sine';
        
        droneOscA.frequency.value = 60; // Deep base D
        droneOscB.frequency.value = 90.2; // 5th harmonic modulation
        
        droneGainA.gain.value = 0.08;
        droneGainB.gain.value = 0.12;

        droneOscA.connect(droneGainA);
        droneOscB.connect(droneGainB);
        
        droneGainA.connect(ambientFilter);
        droneGainB.connect(ambientFilter);
        
        droneOscA.start();
        droneOscB.start();
        
        // B. Polyphonic harmonic synthesizers for dual-hands
        for (let i = 0; i < 3; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = 220; // Default G scale
            gain.gain.value = 0;
            
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start();
            
            polyOscs.push(osc);
            polyGains.push(gain);
        }
    } catch (e) {
        console.error("Browser Web Audio blocked or unsupported", e);
    }
}

// Plays dynamic synthesis based on hand spreads (sweeps filter frequencies)
function updateSoundscape(hands) {
    if (!audioCtx || !ambientFilter) return;
    
    if (hands.length === 0) {
        // Drop chord gains cleanly
        polyGains.forEach(g => g.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15));
        ambientFilter.frequency.setTargetAtTime(120, audioCtx.currentTime, 0.2);
        return;
    }

    // 1. Map Hand 1 Spread (Wrist to Pinky) to cutoff lowpass sweeps
    const spreadVal = getDist(hands[0][0], hands[0][20]);
    const maxCutoff = 150 + Math.min(spreadVal * 3200, 2400); // Opens up on fully open hand
    ambientFilter.frequency.setTargetAtTime(maxCutoff, audioCtx.currentTime, 0.08);

    // 2. Plays a warm minor chord triad if two hands are detected
    if (hands.length >= 2) {
        const indexHand0 = hands[0][8];
        const indexHand1 = hands[1][8];
        const distIndex = getDist(indexHand0, indexHand1);
        
        // Closer distance = higher key pitch progression
        const baseFreq = 160 + (1 - Math.min(distIndex, 0.8)) * 320;
        
        // Minor 7th chord structures: Base, Minor Third, Perfect Fifth
        const intervals = [1.0, 1.2, 1.5]; 
        
        polyOscs.forEach((osc, idx) => {
            const nextFreq = baseFreq * intervals[idx];
            osc.frequency.setTargetAtTime(nextFreq, audioCtx.currentTime, 0.12);
        });

        // Modulate volumes based on hand height
        const avgY = 1.0 - (indexHand0.y + indexHand1.y) / 2;
        const volumeFactor = Math.min(avgY * 0.12, 0.15);
        polyGains.forEach(g => g.gain.setTargetAtTime(volumeFactor, audioCtx.currentTime, 0.1));
    } else {
        polyGains.forEach(g => g.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15));
    }
}

// Custom trigger synthesizer: Laser zap synth for Pinch gestures
function triggerLaserSynth() {
    if (!audioCtx || !enableAudio) return;

    const zapOsc = audioCtx.createOscillator();
    const zapGain = audioCtx.createGain();
    const zapFilter = audioCtx.createBiquadFilter();

    zapOsc.type = 'sawtooth';
    zapFilter.type = 'highpass';
    zapFilter.frequency.setValueAtTime(600, audioCtx.currentTime);

    // Dynamic frequency envelope sweep
    zapOsc.frequency.setValueAtTime(1100, audioCtx.currentTime);
    zapOsc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.18);

    // Amplitude decay envelope
    zapGain.gain.setValueAtTime(0.35, audioCtx.currentTime);
    zapGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);

    zapOsc.connect(zapFilter);
    zapFilter.connect(zapGain);
    zapGain.connect(masterGain);

    zapOsc.start();
    zapOsc.stop(audioCtx.currentTime + 0.22);
}


/**
 * GEOMATRIC STATE & MULTI-GESTURE LOGIC
 */
function getDist(ptA, ptB) {
    return Math.hypot(ptA.x - ptB.x, ptA.y - ptB.y);
}

function mapToCanvas(point) {
    // Horizontally mirrored scaling
    return { x: point.x * width, y: point.y * height };
}

function detectGestures() {
    if (!currentHands.length) {
        uiGesture.innerText = "None";
        uiSpread.innerText = "0%";
        return;
    }

    let gestureOutput = "Hands Idle";
    let handsCount = currentHands.length;

    // Detect Heart Shape (when both index tips and thumbs are very close)
    if (handsCount >= 2) {
        const index0 = currentHands[0][8];
        const index1 = currentHands[1][8];
        const thumb0 = currentHands[0][4];
        const thumb1 = currentHands[1][4];

        const indexDist = getDist(index0, index1);
        const thumbDist = getDist(thumb0, thumb1);

        if (indexDist < 0.12 && thumbDist < 0.14) {
            gestureOutput = "VALENTINE HEART";
            uiGesture.innerText = gestureOutput;
            uiSpread.innerText = "Dual Synergy";
            return;
        }
    }

    currentHands.forEach((hand, idx) => {
        const thumbTip = hand[4];
        const indexTip = hand[8];
        
        // 1. Pinch detection (Thumb + Index Tip)
        const dPinch = getDist(thumbTip, indexTip);
        const isPinching = dPinch < sensitivity;
        
        if (isPinching && !lastPinchState[idx]) {
            const midpoint = {
                x: (thumbTip.x + indexTip.x) / 2,
                y: (thumbTip.y + indexTip.y) / 2
            };
            createShockwave(mapToCanvas(midpoint), themes[currentTheme](time, idx, 2));
            triggerLaserSynth();
        }
        lastPinchState[idx] = isPinching;
        
        if (isPinching) {
            gestureOutput = "AURORA PINCH";
            return;
        }

        // 2. Fist Charging vs Open Hand explosion
        // Average distance of finger tips (4, 8, 12, 16, 20) to palm base (0)
        let palmBase = hand[0];
        let tipIndices = [4, 8, 12, 16, 20];
        let dSum = 0;
        tipIndices.forEach(tIdx => dSum += getDist(hand[tIdx], palmBase));
        let avgBaseDistance = dSum / 5;

        // Fist detected if average finger length folded inside palm
        if (avgBaseDistance < 0.20) {
            gestureOutput = "FIST CHARGING";
            handChargeLevel[idx] = Math.min(1.0, handChargeLevel[idx] + 0.02);
            // Spawn orbit charge particles
            if (showSparks) {
                const palmCenter = mapToCanvas(hand[9]);
                createChargeParticles(palmCenter, themes[currentTheme](time, idx, 2), handChargeLevel[idx]);
            }
            return;
        } else {
            // Trigger explosion release burst if fist was previously fully charged
            if (handChargeLevel[idx] > 0.4) {
                const palmCenter = mapToCanvas(hand[9]);
                createExplosionBurst(palmCenter, themes[currentTheme](time, idx, 2), handChargeLevel[idx] * 35);
                triggerLaserSynth();
            }
            handChargeLevel[idx] = 0;
        }

        // 3. Victory/Peace Sign (Index and Middle pointing up, Ring and Pinky down)
        const indexState = hand[8].y < hand[6].y;
        const middleState = hand[12].y < hand[10].y;
        const ringState = hand[16].y > hand[14].y;
        const pinkyState = hand[20].y > hand[18].y;

        if (indexState && middleState && ringState && pinkyState) {
            gestureOutput = "PEACE BUBBLES";
            // Spawn float bubbles
            if (showSparks && Math.random() > 0.35) {
                const ptIndex = mapToCanvas(hand[8]);
                const ptMiddle = mapToCanvas(hand[12]);
                const mid = { x: (ptIndex.x + ptMiddle.x) / 2, y: (ptIndex.y + ptMiddle.y) / 2 };
                particles.push(new Particle(mid.x, mid.y, themes[currentTheme](time, idx, 3), 0, -2, 'bubble'));
            }
            return;
        }
    });

    uiGesture.innerText = gestureOutput;
    
    // Calculate primary index to pinky spread percent
    if (currentHands[0]) {
        const rawSpread = getDist(currentHands[0][8], currentHands[0][20]);
        let percent = Math.min(100, Math.round(rawSpread * 280));
        uiSpread.innerText = `${percent}%`;
    }
}


/**
 * HIGH-FIDELITY PARTICLES & RIPPLES CREATOR
 */
function createParticlesAtTip(pos, color, count = 2) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 3 + 1;
        particles.push(new Particle(
            pos.x, 
            pos.y, 
            color, 
            Math.cos(angle) * velocity, 
            Math.sin(angle) * velocity - 1,
            'spark'
        ));
    }
}

function createChargeParticles(pos, color, level) {
    // Generate orbiting sparks around palm center
    const radius = 60 * (1.0 - level * 0.7);
    const orbitCount = Math.floor(level * 4) + 1;
    for (let i = 0; i < orbitCount; i++) {
        const phi = Math.random() * Math.PI * 2;
        const targetX = pos.x + Math.cos(phi) * radius;
        const targetY = pos.y + Math.sin(phi) * radius;
        
        // Speed points inward
        const vx = (pos.x - targetX) * 0.15;
        const vy = (pos.y - targetY) * 0.15;
        particles.push(new Particle(targetX, targetY, '#ffffff', vx, vy, 'charge'));
    }
}

function createExplosionBurst(pos, color, count) {
    for (let i = 0; i < count; i++) {
        const phi = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const speed = Math.random() * 8 + 4;
        particles.push(new Particle(pos.x, pos.y, color, Math.cos(phi) * speed, Math.sin(phi) * speed, 'spark'));
    }
}

function createShockwave(pos, color) {
    ripples.push({
        x: pos.x,
        y: pos.y,
        radius: 4,
        maxRadius: 180,
        life: 1.0,
        color: color
    });
}


/**
 * REAL-TIME RENDERING ENGINES
 */
function drawBackground() {
    if (!showMatrix) {
        bgCtx.clearRect(0, 0, width, height);
        return;
    }

    // destination-out leaves soft organic transparency trails
    bgCtx.globalCompositeOperation = 'destination-out';
    bgCtx.fillStyle = `rgba(0, 0, 0, ${0.12 + Math.min(handVelocities * 12, 0.4)})`;
    bgCtx.fillRect(0, 0, width, height);
    bgCtx.globalCompositeOperation = 'source-over';

    // Matrix Code columns
    bgCtx.fillStyle = themes[currentTheme](time, 1, 1);
    bgCtx.font = fontSize + "px 'JetBrains Mono', monospace";
    
    let flowSpeed = 1 + (handVelocities * 120);

    for (let i = 0; i < matrixColumns.length; i++) {
        if (Math.random() > 0.94) {
            // Halfwidth katakana character blocks
            const char = String.fromCharCode(0x30A0 + Math.random() * 90);
            bgCtx.fillText(char, i * fontSize, matrixColumns[i] * fontSize);
        }
        
        matrixColumns[i] += Math.random() * flowSpeed;
        
        if (matrixColumns[i] * fontSize > height && Math.random() > 0.95) {
            matrixColumns[i] = 0;
        }
    }
}

function renderPhysics() {
    // 1. Draw Sparks and bubbles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) {
            particles.splice(i, 1);
        } else {
            p.draw(ctx);
        }
    }

    // 2. Draw shockwaves/ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.radius += (r.maxRadius - r.radius) * 0.08;
        r.life -= 0.025;

        if (r.life <= 0) {
            ripples.splice(i, 1);
        } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = r.color;
            ctx.lineWidth = 5 * r.life;
            ctx.globalAlpha = r.life;
            ctx.stroke();
            ctx.restore();
        }
    }
}

// Visual updates for aura lamps behind control panel
function updateAuraGlows() {
    const leftGlow = document.getElementById('leftAura');
    const rightGlow = document.getElementById('rightAura');
    
    if (currentHands.length === 0) {
        leftGlow.style.opacity = 0;
        rightGlow.style.opacity = 0;
        return;
    }

    if (currentHands[0]) {
        const p0 = mapToCanvas(currentHands[0][9]);
        leftGlow.style.opacity = 0.8;
        leftGlow.style.left = `${window.innerWidth - p0.x - 150}px`;
        leftGlow.style.top = `${p0.y - 150}px`;
    }

    if (currentHands[1]) {
        const p1 = mapToCanvas(currentHands[1][9]);
        rightGlow.style.opacity = 0.8;
        rightGlow.style.left = `${window.innerWidth - p1.x - 150}px`;
        rightGlow.style.top = `${p1.y - 150}px`;
    } else {
        rightGlow.style.opacity = 0;
    }
}

// Draws the beautiful mini oscilloscope visualizer inside panel
function drawOscilloscope() {
    const visualizerCanvas = document.getElementById('synthVisualizer');
    const vCtx = visualizerCanvas.getContext('2d');
    const w = visualizerCanvas.width = visualizerCanvas.parentElement.offsetWidth;
    const h = visualizerCanvas.height = 48;

    vCtx.clearRect(0, 0, w, h);
    vCtx.lineWidth = 2.0;
    vCtx.strokeStyle = themes[currentTheme](time, 1, 1);

    vCtx.shadowBlur = 8;
    vCtx.shadowColor = themes[currentTheme](time, 1, 1);
    
    vCtx.beginPath();
    
    if (audioCtx && enableAudio && audioAnalyser) {
        const bufferLength = audioAnalyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser.getByteTimeDomainData(dataArray);

        const sliceWidth = w / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // Normalized wave level
            const y = (v * h) / 2;

            if (i === 0) {
                vCtx.moveTo(x, y);
            } else {
                vCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
    } else {
        // Fallback: draw animated cyber-wave
        const step = w / 40;
        for (let i = 0; i <= 40; i++) {
            const x = i * step;
            // Wave amplitude maps to hand velocities to feel reactive!
            const amplitude = 4 + handVelocities * 120;
            const y = h / 2 + Math.sin(i * 0.35 + time * 6) * amplitude;
            if (i === 0) vCtx.moveTo(x, y);
            else vCtx.lineTo(x, y);
        }
    }
    
    vCtx.stroke();
    vCtx.shadowBlur = 0;
}


/**
 * MAIN FRAMERATE LOOP
 */
function renderLoop(timestamp) {
    requestAnimationFrame(renderLoop);

    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    time += dt;

    // Framework FPS counter
    framesThisSecond++;
    if (timestamp > lastFpsTime + 1000) {
        uiFps.innerText = framesThisSecond;
        framesThisSecond = 0;
        lastFpsTime = timestamp;
    }

    drawBackground();
    updateAuraGlows();

    // 1. destination-out fades existing pixels to keep neon trail tail
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.fillRect(0, 0, width, height);
    
    // 2. Enable glow screen blend compositing
    ctx.globalCompositeOperation = 'screen';

    // Particle render layer
    renderPhysics();

    if (currentHands.length > 0) {
        
        // A. Draw Neon Connectors & Joint Bones
        currentHands.forEach((hand, handIdx) => {
            const activeColor = themes[currentTheme](time, handIdx, 2);
            
            // Draw skeleton connector bones
            ctx.shadowBlur = 10;
            ctx.shadowColor = activeColor;
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            SKELETON_CONNECTIONS.forEach(pair => {
                const ptStart = mapToCanvas(hand[pair[0]]);
                const ptEnd = mapToCanvas(hand[pair[1]]);
                ctx.moveTo(ptStart.x, ptStart.y);
                ctx.lineTo(ptEnd.x, ptEnd.y);
            });
            ctx.stroke();

            // Draw Fist charging orb rings
            if (handChargeLevel[handIdx] > 0.15) {
                const palmCenter = mapToCanvas(hand[9]);
                const radius = 30 + handChargeLevel[handIdx] * 40;
                
                ctx.beginPath();
                ctx.arc(palmCenter.x, palmCenter.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 + handChargeLevel[handIdx] * 4;
                ctx.shadowBlur = 25;
                ctx.shadowColor = activeColor;
                ctx.stroke();
            }

            // Draw index/fingertips joints
            ctx.shadowBlur = 18;
            FINGER_TIPS.forEach((tipIndex, idx) => {
                const pt = mapToCanvas(hand[tipIndex]);
                const color = themes[currentTheme](time, idx, FINGER_TIPS.length);
                
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = color;
                ctx.fill();

                if (showSparks && Math.random() > 0.5) {
                    createParticlesAtTip(pt, color, 1);
                }
            });
            ctx.shadowBlur = 0; // Reset shadow
        });

        // B. Inter-Hand Dual Connections & Electric Arcs
        if (showArcs && currentHands.length >= 2) {
            const h0 = currentHands[0];
            const h1 = currentHands[1];

            FINGER_TIPS.forEach((tipIndex, idx) => {
                const pt0 = mapToCanvas(h0[tipIndex]);
                const pt1 = mapToCanvas(h1[tipIndex]);
                const dist = getDist(pt0, pt1);

                const glowColor = themes[currentTheme](time, idx, FINGER_TIPS.length);

                // Jagged Electric Arcs when hands draw close
                if (dist < 180 && Math.random() > 0.45) {
                    ctx.beginPath();
                    ctx.moveTo(pt0.x, pt0.y);
                    
                    // Add midpoint lightning jitter
                    const midX = (pt0.x + pt1.x) / 2 + (Math.random() - 0.5) * 45;
                    const midY = (pt0.y + pt1.y) / 2 + (Math.random() - 0.5) * 45;
                    
                    ctx.lineTo(midX, midY);
                    ctx.lineTo(pt1.x, pt1.y);

                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2.5;
                    ctx.shadowBlur = 20;
                    ctx.shadowColor = glowColor;
                    ctx.stroke();
                }

                // Neon flowing gradient connecting threads
                ctx.beginPath();
                ctx.moveTo(pt0.x, pt0.y);
                ctx.lineTo(pt1.x, pt1.y);

                const threadGrad = ctx.createLinearGradient(pt0.x, pt0.y, pt1.x, pt1.y);
                threadGrad.addColorStop(0, themes[currentTheme](time, idx, 5));
                threadGrad.addColorStop(0.5, '#ffffff');
                threadGrad.addColorStop(1, themes[currentTheme](time, idx + 2, 5));

                ctx.strokeStyle = threadGrad;
                ctx.lineWidth = 2.5;
                ctx.stroke();
            });

            // Draw pulsing connection heart icon in the screen center on Valentine gesture
            const h0Index = currentHands[0][8];
            const h1Index = currentHands[1][8];
            const h0Thumb = currentHands[0][4];
            const h1Thumb = currentHands[1][4];
            if (getDist(h0Index, h1Index) < 0.12 && getDist(h0Thumb, h1Thumb) < 0.14) {
                const center = {
                    x: (h0Index.x + h1Index.x + h0Thumb.x + h1Thumb.x) * width / 4,
                    y: (h0Index.y + h1Index.y + h0Thumb.y + h1Thumb.y) * height / 4
                };
                
                ctx.save();
                ctx.translate(center.x, center.y);
                
                const heartScale = 1.0 + Math.sin(time * 10) * 0.15; // Pulse
                ctx.scale(heartScale, heartScale);
                
                ctx.beginPath();
                ctx.moveTo(0, -10);
                // Draw heart spline
                ctx.bezierCurveTo(-20, -35, -45, -15, -45, 10);
                ctx.bezierCurveTo(-45, 35, -15, 55, 0, 75);
                ctx.bezierCurveTo(15, 55, 45, 35, 45, 10);
                ctx.bezierCurveTo(45, -15, 20, -35, 0, -10);
                
                ctx.fillStyle = themes[currentTheme](time, 1, 1);
                ctx.shadowBlur = 30;
                ctx.shadowColor = themes[currentTheme](time, 1, 1);
                ctx.fill();
                ctx.restore();
            }

            // Draw Sacred Rotating Mandala
            if (showMandala) {
                const allTips = FINGER_TIPS.map(t => mapToCanvas(h0[t])).concat(
                                FINGER_TIPS.map(t => mapToCanvas(h1[t])) );
                
                const cx = allTips.reduce((sum, p) => sum + p.x, 0) / 10;
                const cy = allTips.reduce((sum, p) => sum + p.y, 0) / 10;

                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(time * 0.45);

                ctx.beginPath();
                for (let i = 0; i < 10; i++) {
                    const startNode = { x: allTips[i].x - cx, y: allTips[i].y - cy };
                    const endNode = { x: allTips[(i + 3) % 10].x - cx, y: allTips[(i + 3) % 10].y - cy };
                    ctx.moveTo(startNode.x, startNode.y);
                    ctx.lineTo(endNode.x, endNode.y);
                }
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                ctx.lineWidth = 1.0;
                ctx.stroke();
                ctx.restore();
            }
        }

        detectGestures();
    }

    // Reset compositing
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw Control visualizer waves
    drawOscilloscope();
}


/**
 * MEDIAPIPE SENSORS BOOTSTRAP
 */
function initMediaPipe() {
    const loaderTerminal = document.getElementById('diagTerminal');
    const startLine = document.createElement('div');
    startLine.className = 'terminal-line';
    startLine.innerHTML = `<span class="terminal-prompt">&gt;</span><span class="terminal-text" style="color: white;">[SYSTEM] Initializing camera lens...</span>`;
    loaderTerminal.appendChild(startLine);

    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.65
    });

    hands.onResults((results) => {
        // Dynamic hand telemetry telemetry counts
        const handCount = results.multiHandLandmarks ? results.multiHandLandmarks.length : 0;
        uiHands.innerText = handCount;

        // Calculate single-frame hand velocities
        if (currentHands.length > 0 && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const oldIndex = currentHands[0][8];
            const newIndex = results.multiHandLandmarks[0][8];
            if (oldIndex && newIndex) {
                handVelocities = getDist(oldIndex, newIndex);
            }
        } else {
            handVelocities = 0;
        }

        currentHands = results.multiHandLandmarks || [];
        updateSoundscape(currentHands);
    });

    const camera = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({image: videoElement});
        },
        width: 1280,
        height: 720,
        facingMode: 'user'
    });

    camera.start().catch((err) => {
        console.error("Camera startup failed", err);
        // Show elegant visual fallback card
        document.getElementById('errorOverlay').classList.remove('none');
        document.getElementById('startOverlay').classList.add('none');
    });
}
