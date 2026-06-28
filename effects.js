// ==================================================================
// Efeitos visuais e sonoros complementares
//   1. Halo que segue o cursor
//   2. Scroll reveal (Sobre / Contato)
//   3. Som de vidro quebrando (gerado via Web Audio API, sem arquivos)
//   4. Splash inicial com o logo se formando em partículas
// ==================================================================

// ------------------------------------------------------------------
// 1. Halo que segue o cursor
// ------------------------------------------------------------------
(function initCursorGlow() {
    const glow = document.getElementById("cursorGlow");
    if (!glow || window.matchMedia("(hover:none)").matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    window.addEventListener("mousemove", (e) => {
        targetX = e.clientX;
        targetY = e.clientY;
        glow.classList.remove("hidden");
    });

    window.addEventListener("mouseleave", () => glow.classList.add("hidden"));

    function loop() {
        // Suaviza o movimento (lerp) para o halo "flutuar" atrás do cursor
        currentX += (targetX - currentX) * 0.14;
        currentY += (targetY - currentY) * 0.14;
        glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
})();

// ------------------------------------------------------------------
// 2. Scroll reveal — elementos sobem e aparecem ao entrar na tela
// ------------------------------------------------------------------
(function initScrollReveal() {
    const targets = document.querySelectorAll(".revealOnScroll");
    if (!targets.length) return;

    // Atraso crescente para elementos próximos uns dos outros (efeito cascata)
    const delayMap = new Map();
    let counter = 0;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const el = entry.target;
                if (!delayMap.has(el)) {
                    delayMap.set(el, (counter++ % 4) * 90);
                }
                setTimeout(() => el.classList.add("revealed"), delayMap.get(el));
                observer.unobserve(el);
            }
        });
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });

    targets.forEach(el => observer.observe(el));
})();

// ------------------------------------------------------------------
// 3. Som de vidro quebrando (procedural — sem precisar de arquivo .mp3)
// ------------------------------------------------------------------
let audioCtx = null;
let noiseBuffer = null;

function getAudioContext() {
    if (!audioCtx) {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return null;
        audioCtx = new AudioCtor();
    }
    return audioCtx;
}

function getNoiseBuffer(ctx) {
    if (noiseBuffer) return noiseBuffer;
    const length = ctx.sampleRate * 0.6;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffer = buffer;
    return buffer;
}

// Toca um "estalo" de vidro: um ruído curto + estalos agudos aleatórios
window.playCrackSound = function playCrackSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    // Camada 1: ruído filtrado simulando o "estouro" do vidro
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = getNoiseBuffer(ctx);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(2800, now);
    bandpass.frequency.exponentialRampToValueAtTime(600, now + 0.35);
    bandpass.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.5, now + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.45);

    // Camada 2: pequenos "tinks" agudos aleatórios (cacos menores estalando)
    const tinkCount = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < tinkCount; i++) {
        const delay = Math.random() * 0.3;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        const freq = 1800 + Math.random() * 2600;
        osc.frequency.setValueAtTime(freq, now + delay);

        const tinkGain = ctx.createGain();
        tinkGain.gain.setValueAtTime(0.0001, now + delay);
        tinkGain.gain.exponentialRampToValueAtTime(0.12, now + delay + 0.005);
        tinkGain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.09);

        osc.connect(tinkGain);
        tinkGain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.1);
    }
};

// Alguns navegadores só liberam o AudioContext após uma interação do usuário
["pointerdown", "keydown"].forEach(evt => {
    window.addEventListener(evt, () => { getAudioContext(); }, { once: true, passive: true });
});

// ------------------------------------------------------------------
// 4. Splash inicial — o logo "Lumen" se formando em partículas
// ------------------------------------------------------------------
(function initSplash() {
    const splash = document.getElementById("splashScreen");
    const canvas = document.getElementById("splashCanvas");
    if (!splash || !canvas) return;

    const ctx2d = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const cssWidth = canvas.clientWidth || 640;
    const cssHeight = canvas.clientHeight || 220;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx2d.scale(dpr, dpr);

    // Desenha o texto numa tela auxiliar só pra "amostrar" onde tem pixel
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = cssWidth;
    sampleCanvas.height = cssHeight;
    const sampleCtx = sampleCanvas.getContext("2d");

    sampleCtx.fillStyle = "#fff";
    sampleCtx.textAlign = "center";
    sampleCtx.textBaseline = "middle";
    const fontSize = Math.min(cssWidth / 5.6, cssHeight * 0.62);
    sampleCtx.font = `700 ${fontSize}px Poppins, sans-serif`;
    sampleCtx.fillText("LUMEN", cssWidth / 2, cssHeight / 2);

    const imageData = sampleCtx.getImageData(0, 0, cssWidth, cssHeight).data;

    const targets = [];
    const step = 3.4; // densidade da amostragem — menor = mais partículas
    for (let y = 0; y < cssHeight; y += step) {
        for (let x = 0; x < cssWidth; x += step) {
            const alpha = imageData[(Math.floor(y) * cssWidth + Math.floor(x)) * 4 + 3];
            if (alpha > 120) targets.push({ x, y });
        }
    }

    const root = getComputedStyle(document.documentElement);
    const particleColor = (root.getPropertyValue("--accent") || "#ffffff").trim() || "#ffffff";

    const particles = targets.map(target => ({
        x: Math.random() * cssWidth,
        y: Math.random() * cssHeight + (Math.random() > 0.5 ? cssHeight : -cssHeight) * 0.6,
        tx: target.x,
        ty: target.y,
        size: 1 + Math.random() * 1.6,
        delay: Math.random() * 220,
    }));

    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    const FORM_MS = 1100;
    const HOLD_MS = 550;
    const FADE_MS = 600;
    const start = performance.now();
    let finished = false;

    function frame(now) {
        const elapsed = now - start;
        ctx2d.clearRect(0, 0, cssWidth, cssHeight);
        ctx2d.fillStyle = particleColor;

        particles.forEach(p => {
            const localElapsed = Math.max(0, elapsed - p.delay);
            const t = Math.min(1, localElapsed / FORM_MS);
            const eased = easeOutCubic(t);
            const x = p.x + (p.tx - p.x) * eased;
            const y = p.y + (p.ty - p.y) * eased;

            ctx2d.globalAlpha = 0.25 + eased * 0.75;
            ctx2d.beginPath();
            ctx2d.arc(x, y, p.size, 0, Math.PI * 2);
            ctx2d.fill();
        });
        ctx2d.globalAlpha = 1;

        if (elapsed < FORM_MS + 220) {
            requestAnimationFrame(frame);
        } else if (!finished) {
            finished = true;
            setTimeout(closeSplash, HOLD_MS);
        }
    }

    function closeSplash() {
        splash.classList.add("fadeOut");
        setTimeout(() => splash.classList.add("removed"), FADE_MS);
    }

    requestAnimationFrame(frame);

    // Caso algo impeça a animação (ex: aba em segundo plano), nunca trava o site
    setTimeout(() => {
        if (!finished) { finished = true; closeSplash(); }
    }, FORM_MS + HOLD_MS + 1500);
})();
