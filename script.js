// ==============================
// Wallpapers
// ==============================
const wallpapers = [
    "wallpapers/agatha.jpg",
    "wallpapers/chainsaw-man.jpg",
    "wallpapers/himmy.jpg",
    "wallpapers/hollow-knight.jpg",
    "wallpapers/maomao.jpg",
    "wallpapers/nazuna.jpg",
    "wallpapers/yoru.jpg"
];

const AUTOPLAY_MS = 10 * 100 * 10; // 10 minutos
const DUST_MS = 1100;                // duração da dissolução (WebGL)
const BUILD_MS = 1300;               // duração da construção da nova imagem

const image = document.getElementById("wallpaper");
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const dotsContainer = document.querySelector(".dots");
const lockCheckbox = document.getElementById("lockWallpaper");
const glCanvas = document.getElementById("glCanvas");
const autoplayFill = document.getElementById("autoplayFill");
const infoBtn = document.getElementById("infoBtn");
const modalOverlay = document.getElementById("modalOverlay");
const modalClose = document.getElementById("modalClose");
const modalName = document.getElementById("modalName");
const modalDimensions = document.getElementById("modalDimensions");
const modalColors = document.getElementById("modalColors");
const modalDownload = document.getElementById("modalDownload");

const colorThief = new ColorThief();

let current = 0;
let interval = null;
let isAnimating = false;
let lastPalette = [];

// Pré-carrega todas as imagens para evitar travamentos na troca
wallpapers.forEach(src => { const img = new Image(); img.src = src; });

// Criar bolinhas automaticamente
dotsContainer.innerHTML = "";
wallpapers.forEach(() => {
    const dot = document.createElement("span");
    dot.className = "dot";
    dotsContainer.appendChild(dot);
});
const dots = document.querySelectorAll(".dot");

function updateDots() {
    dots.forEach(dot => dot.classList.remove("active"));
    dots[current].classList.add("active");
}

function rgbToHex(rgb) {
    return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
}

function brightness(color) {
    return (color[0] * 299 + color[1] * 587 + color[2] * 114) / 1000;
}

function updateTheme() {
    if (!image.complete) return;
    const palette = colorThief.getPalette(image, 5);
    lastPalette = palette;

    const root = document.documentElement;
    const background = rgbToHex(palette[0]);
    const primary = rgbToHex(palette[1]);
    const secondary = rgbToHex(palette[2]);
    const accent = rgbToHex(palette[3]);
    const text = brightness(palette[0]) > 140 ? "#111111" : "#FFFFFF";

    root.style.setProperty("--background", background);
    root.style.setProperty("--primary", primary);
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--text", text);
}

// ==============================
// WebGL — dissolução em poeira
// ==============================
const gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl");

const VERT_SRC = `
    attribute vec2 aOrigin;
    attribute vec2 aUV;
    attribute vec2 aVel;
    attribute float aSeed;
    uniform float uTime;
    uniform float uDuration;
    uniform float uPointSize;
    varying vec2 vUV;
    varying float vAlpha;
    void main(){
        float t = clamp(uTime / uDuration, 0.0, 1.0);
        float wind = sin(uTime * 3.0 + aSeed * 6.28) * 0.05;
        vec2 pos = aOrigin;
        pos.x += aVel.x * t + wind * t;
        pos.y += aVel.y * t - 0.55 * t * t;
        vAlpha = 1.0 - t;
        vUV = aUV;
        gl_PointSize = uPointSize;
        gl_Position = vec4(pos, 0.0, 1.0);
    }
`;

const FRAG_SRC = `
    precision mediump float;
    uniform sampler2D uTexture;
    uniform vec2 uCellUV;
    varying vec2 vUV;
    varying float vAlpha;
    void main(){
        vec2 uv = vUV + (gl_PointCoord - 0.5) * uCellUV;
        vec4 color = texture2D(uTexture, uv);
        gl_FragColor = vec4(color.rgb, color.a * vAlpha);
    }
`;

function compileShader(src, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    return shader;
}

let glProgram = null;
if (gl) {
    glProgram = gl.createProgram();
    gl.attachShader(glProgram, compileShader(VERT_SRC, gl.VERTEX_SHADER));
    gl.attachShader(glProgram, compileShader(FRAG_SRC, gl.FRAGMENT_SHADER));
    gl.linkProgram(glProgram);
    gl.useProgram(glProgram);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

function dissolveToNext(nextSrc) {
    if (isAnimating || !gl) { swapImage(nextSrc); return; }
    isAnimating = true;

    const w = image.clientWidth, h = image.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    glCanvas.width = w * dpr;
    glCanvas.height = h * dpr;
    glCanvas.style.width = w + "px";
    glCanvas.style.height = h + "px";
    gl.viewport(0, 0, glCanvas.width, glCanvas.height);

    // Textura a partir da imagem atual
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    // Grade de partículas
    const cols = 34, rows = 20;
    const origins = [], uvs = [], vels = [], seeds = [];

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const ox = (x + 0.5) / cols * 2 - 1;
            const oy = 1 - (y + 0.5) / rows * 2;
            origins.push(ox, oy);
            uvs.push((x + 0.5) / cols, (y + 0.5) / rows);
            vels.push((Math.random() - 0.5) * 0.9, Math.random() * 0.5 + 0.15);
            seeds.push(Math.random());
        }
    }

    function makeBuffer(data, size, name) {
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(glProgram, name);
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    }

    makeBuffer(origins, 2, "aOrigin");
    makeBuffer(uvs, 2, "aUV");
    makeBuffer(vels, 2, "aVel");
    makeBuffer(seeds, 1, "aSeed");

    gl.uniform1i(gl.getUniformLocation(glProgram, "uTexture"), 0);
    gl.uniform1f(gl.getUniformLocation(glProgram, "uDuration"), DUST_MS / 1000);
    gl.uniform1f(gl.getUniformLocation(glProgram, "uPointSize"), Math.max(w / cols, h / rows) * dpr * 1.15);
    gl.uniform2f(gl.getUniformLocation(glProgram, "uCellUV"), 1 / cols, 1 / rows);

    image.style.transition = "none";
    image.style.opacity = "0";
    glCanvas.style.opacity = "1";

    const start = performance.now();
    function frame(now) {
        const elapsed = (now - start) / 1000;
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform1f(gl.getUniformLocation(glProgram, "uTime"), elapsed);
        gl.drawArrays(gl.POINTS, 0, cols * rows);

        if (elapsed * 1000 < DUST_MS) {
            requestAnimationFrame(frame);
        } else {
            glCanvas.style.opacity = "0";
            swapImage(nextSrc);
        }
    }
    requestAnimationFrame(frame);
}

function swapImage(nextSrc) {
    image.style.filter = "blur(22px)";
    image.style.transform = "scale(1.06)";
    image.src = nextSrc;
}

function loadWallpaper() {
    dissolveToNext(wallpapers[current]);
}

image.addEventListener("load", () => {
    if (!isAnimating) { updateDots(); updateTheme(); return; }

    requestAnimationFrame(() => {
        image.style.transition = `opacity ${BUILD_MS}ms ease, filter ${BUILD_MS}ms ease, transform ${BUILD_MS}ms ease`;
        image.style.opacity = "1";
        image.style.filter = "blur(0px)";
        image.style.transform = "scale(1)";
    });

    updateDots();
    updateTheme();

    setTimeout(() => { isAnimating = false; }, BUILD_MS);
});

function goNext() {
    current = (current + 1) % wallpapers.length;
    loadWallpaper();
    restartAutoplay();
}

function goPrevious() {
    current = (current - 1 + wallpapers.length) % wallpapers.length;
    loadWallpaper();
    restartAutoplay();
}

next.onclick = goNext;
previous.onclick = goPrevious;

window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") goNext();
    if (e.key === "ArrowLeft") goPrevious();
});

dots.forEach((dot, index) => {
    dot.onclick = () => {
        if (index === current) return;
        current = index;
        loadWallpaper();
        restartAutoplay();
    };
});

// ==============================
// Travar wallpaper (freeze)
// ==============================
function applyLockState() {
    const locked = lockCheckbox.checked;

    next.disabled = locked;
    previous.disabled = locked;
    dots.forEach(dot => dot.style.pointerEvents = locked ? "none" : "auto");

    if (locked) {
        stopAutoplay();
        autoplayFill.style.transition = "none";
    } else {
        startAutoplay();
    }
}

lockCheckbox.addEventListener("change", applyLockState);

// ==============================
// Autoplay (10 minutos) + barra de progresso
// ==============================
function startAutoplay() {
    stopAutoplay();
    interval = setInterval(() => {
        if (!lockCheckbox.checked) goNext();
    }, AUTOPLAY_MS);
    runProgressBar();
}

function stopAutoplay() {
    if (interval) clearInterval(interval);
    interval = null;
}

function restartAutoplay() {
    if (!lockCheckbox.checked) startAutoplay();
}

function runProgressBar() {
    autoplayFill.style.transition = "none";
    autoplayFill.style.width = "0%";
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            autoplayFill.style.transition = `width ${AUTOPLAY_MS}ms linear`;
            autoplayFill.style.width = "100%";
        });
    });
}

// ==============================
// Modal de detalhes do wallpaper
// ==============================
function formatName(src) {
    const file = src.split("/").pop().replace(/\.[^/.]+$/, "");
    return file
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());
}

function openModal() {
    modalName.textContent = formatName(wallpapers[current]);
    modalDimensions.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;

    modalColors.innerHTML = "";
    (lastPalette.length ? lastPalette : [[91, 44, 255]]).forEach(rgb => {
        const hex = rgbToHex(rgb);
        const swatch = document.createElement("span");
        swatch.className = "swatch";
        swatch.style.background = hex;
        swatch.dataset.hex = hex;
        swatch.title = "Clique para copiar";
        swatch.onclick = () => navigator.clipboard?.writeText(hex);
        modalColors.appendChild(swatch);
    });

    modalDownload.href = wallpapers[current];
    modalDownload.download = wallpapers[current].split("/").pop();

    modalOverlay.classList.add("open");
}

function closeModal() {
    modalOverlay.classList.remove("open");
}

infoBtn.onclick = openModal;
modalClose.onclick = closeModal;
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
});

updateDots();
updateTheme();
applyLockState();
