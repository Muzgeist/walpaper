// ==================================================================
// Navegação entre telas + efeito de "vidro quebrando"
// ==================================================================
// Como funciona, em resumo:
//   1. Tiramos uma "foto" (html2canvas) da tela atual.
//   2. Já trocamos a tela ativa por baixo (a nova tela fica pronta,
//      escondida atrás da foto da tela antiga).
//   3. Desenhamos linhas de rachadura por cima da foto.
//   4. Cortamos a foto em vários "cacos" (clip-path) e jogamos cada
//      um para um lado diferente, girando e desaparecendo.
//   5. Quando os cacos terminam de cair, a tela nova já está visível
//      por baixo — é só remover a sobreposição.
// ==================================================================

const SHATTER_TOTAL_MS = 3000;     // duração total do efeito (pedida: ~3s)
const SHATTER_CRACK_MS = 260;      // quanto tempo as rachaduras ficam só "piscando" antes de quebrar
const SHATTER_FADE_MS = 320;       // fade final das rachaduras
const GRID_COLS = 7;
const GRID_ROWS = 5;
const JITTER = 0.22;               // o quanto os pontos da grade podem "tremer" (0 a 0.5)

const navButtons = document.querySelectorAll(".navBtn");
const shatterOverlay = document.getElementById("shatterOverlay");
const screens = {
    inicio: document.getElementById("screen-inicio"),
    sobre: document.getElementById("screen-sobre"),
    contato: document.getElementById("screen-contato"),
};

let currentScreen = "inicio";
let isTransitioning = false;

function setActiveNav(name) {
    navButtons.forEach(btn => {
        btn.classList.toggle("active", btn.dataset.screen === name);
    });
}

function showScreenInstantly(name) {
    Object.values(screens).forEach(el => el && el.classList.remove("active"));
    if (screens[name]) screens[name].classList.add("active");
}

// ------------------------------------------------------------------
// Gera uma grade de pontos com "tremor" (jitter) para parecer uma
// rachadura de vidro real, depois monta os cacos (triângulos) a
// partir dessa grade.
// ------------------------------------------------------------------
function buildShardGeometry(width, height) {
    const points = [];

    for (let r = 0; r <= GRID_ROWS; r++) {
        const row = [];
        for (let c = 0; c <= GRID_COLS; c++) {
            const baseX = (c / GRID_COLS) * width;
            const baseY = (r / GRID_ROWS) * height;

            const edgeCol = c === 0 || c === GRID_COLS;
            const edgeRow = r === 0 || r === GRID_ROWS;

            const cellW = width / GRID_COLS;
            const cellH = height / GRID_ROWS;

            const jitterX = edgeCol ? 0 : (Math.random() - 0.5) * cellW * JITTER * 2;
            const jitterY = edgeRow ? 0 : (Math.random() - 0.5) * cellH * JITTER * 2;

            row.push({ x: baseX + jitterX, y: baseY + jitterY });
        }
        points.push(row);
    }

    const shards = [];
    for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
            const p1 = points[r][c];
            const p2 = points[r][c + 1];
            const p3 = points[r + 1][c];
            const p4 = points[r + 1][c + 1];

            // Cada célula da grade vira 2 triângulos (um caco de vidro cada)
            const splitDiag = Math.random() > 0.5;
            if (splitDiag) {
                shards.push([p1, p2, p3]);
                shards.push([p2, p4, p3]);
            } else {
                shards.push([p1, p2, p4]);
                shards.push([p1, p4, p3]);
            }
        }
    }

    return { points, shards };
}

function pointsToClipPath(tri, width, height) {
    return "polygon(" + tri.map(p => `${(p.x / width * 100).toFixed(2)}% ${(p.y / height * 100).toFixed(2)}%`).join(",") + ")";
}

function triCentroid(tri) {
    return {
        x: (tri[0].x + tri[1].x + tri[2].x) / 3,
        y: (tri[0].y + tri[1].y + tri[2].y) / 3,
    };
}

// ------------------------------------------------------------------
// Desenha as linhas de rachadura (SVG) saindo de um ponto de origem
// (o botão que foi clicado) até bordas/junções da grade.
// ------------------------------------------------------------------
function buildCracksSVG(points, width, height, originX, originY) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", width);
    svg.setAttribute("height", height);
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.classList.add("shatterCracks");

    const flatPoints = points.flat();

    // Escolhe alguns pontos da grade espalhados para servir de "destino" das rachaduras principais
    const targets = [];
    const targetCount = 9;
    for (let i = 0; i < targetCount; i++) {
        targets.push(flatPoints[Math.floor(Math.random() * flatPoints.length)]);
    }

    targets.forEach(target => {
        const segments = 3 + Math.floor(Math.random() * 2);
        let path = `M ${originX} ${originY}`;
        for (let s = 1; s <= segments; s++) {
            const t = s / segments;
            const midX = originX + (target.x - originX) * t + (Math.random() - 0.5) * 26;
            const midY = originY + (target.y - originY) * t + (Math.random() - 0.5) * 26;
            path += ` L ${midX.toFixed(1)} ${midY.toFixed(1)}`;
        }
        const el = document.createElementNS(ns, "path");
        el.setAttribute("d", path);
        const len = Math.hypot(target.x - originX, target.y - originY);
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
        el.style.transition = `stroke-dashoffset ${180 + Math.random() * 120}ms ease-out`;
        svg.appendChild(el);
    });

    return svg;
}

// ------------------------------------------------------------------
// Efeito principal: racha e quebra a tela atual, revelando a próxima
// ------------------------------------------------------------------
function shatterTransition(targetName, originEl) {
    if (isTransitioning || targetName === currentScreen) return;
    isTransitioning = true;

    const activeScreen = screens[currentScreen];
    const rect = activeScreen.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));

    // Ponto de origem da rachadura: o botão de navegação clicado
    let originX = width / 2, originY = 0;
    if (originEl) {
        const btnRect = originEl.getBoundingClientRect();
        originX = Math.min(width, Math.max(0, (btnRect.left + btnRect.width / 2) - rect.left));
        originY = Math.max(0, (btnRect.top + btnRect.height / 2) - rect.top);
    }

    const finish = () => finishTransition(targetName);

    // Sem html2canvas disponível (ex: offline) -> troca direta, sem travar o site
    if (typeof html2canvas !== "function") {
        showScreenInstantly(targetName);
        currentScreen = targetName;
        setActiveNav(targetName);
        isTransitioning = false;
        return;
    }

    html2canvas(activeScreen, {
        backgroundColor: null,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
    }).then(canvas => {
        const imageURL = canvas.toDataURL("image/png");
        runShatterAnimation(imageURL, width, height, rect, originX, originY, targetName);
    }).catch(() => {
        // Se a captura falhar por qualquer motivo, troca de forma simples
        showScreenInstantly(targetName);
        currentScreen = targetName;
        setActiveNav(targetName);
        isTransitioning = false;
    });
}

function runShatterAnimation(imageURL, width, height, rect, originX, originY, targetName) {
    const { points, shards } = buildShardGeometry(width, height);

    shatterOverlay.innerHTML = "";
    shatterOverlay.style.top = rect.top + "px";
    shatterOverlay.style.left = rect.left + "px";
    shatterOverlay.style.width = width + "px";
    shatterOverlay.style.height = height + "px";
    shatterOverlay.classList.add("active");

    const maxDist = Math.hypot(width, height);

    const shardEls = shards.map(tri => {
        const el = document.createElement("div");
        el.className = "shatterShard";
        el.style.width = width + "px";
        el.style.height = height + "px";
        el.style.backgroundImage = `url(${imageURL})`;
        el.style.backgroundSize = `${width}px ${height}px`;
        el.style.clipPath = pointsToClipPath(tri, width, height);
        el.style.opacity = "1";
        shatterOverlay.appendChild(el);

        const centroid = triCentroid(tri);
        const dx = centroid.x - originX;
        const dy = centroid.y - originY;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const nx = dx / dist, ny = dy / dist;

        return { el, dist, nx, ny };
    });

    // Linhas de rachadura por cima dos cacos
    const cracksSVG = buildCracksSVG(points, width, height, originX, originY);
    shatterOverlay.appendChild(cracksSVG);

    requestAnimationFrame(() => {
        cracksSVG.classList.add("show");
        cracksSVG.querySelectorAll("path").forEach(p => {
            p.style.strokeDashoffset = "0";
        });
    });

    if (typeof window.playCrackSound === "function") {
        window.playCrackSound();
    }

    // Fase 1: a tela "racha" (linhas aparecem) antes de se despedaçar.
    // Só agora, depois da rachadura completa, a tela nova é revelada por
    // baixo — ela ficará escondida pelos cacos até eles voarem para fora.
    setTimeout(() => {
        showScreenInstantly(targetName);
        cracksSVG.classList.add("fade");

        const flightBudget = SHATTER_TOTAL_MS - SHATTER_CRACK_MS - 120; // tempo restante para os cacos voarem

        shardEls.forEach(({ el, dist, nx, ny }) => {
            const proximity = dist / maxDist; // 0 = perto do clique, 1 = longe
            const delay = proximity * 260 + Math.random() * 120;
            const duration = flightBudget * (0.55 + Math.random() * 0.35);

            const travel = 140 + proximity * 420 + Math.random() * 80;
            const rotate = (Math.random() - 0.5) * 140;
            const fallExtra = 90 + Math.random() * 140;

            el.style.transition = `transform ${duration}ms cubic-bezier(.27,.67,.32,1) ${delay}ms, opacity ${duration * 0.8}ms ease-in ${delay + duration * 0.2}ms`;
            el.style.transform = `translate(${(nx * travel).toFixed(1)}px, ${(ny * travel + fallExtra).toFixed(1)}px) rotate(${rotate.toFixed(1)}deg) scale(.85)`;
            el.style.opacity = "0";
        });
    }, SHATTER_CRACK_MS);

    setTimeout(() => {
        finishTransition(targetName);
    }, SHATTER_TOTAL_MS);
}

function finishTransition(targetName) {
    shatterOverlay.classList.remove("active");
    shatterOverlay.innerHTML = "";
    currentScreen = targetName;
    setActiveNav(targetName);
    isTransitioning = false;
}

navButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const target = btn.dataset.screen;
        shatterTransition(target, btn);
    });
});

// ==================================================================
// Formulário de contato (apenas front-end, sem backend conectado)
// ==================================================================
const contactForm = document.getElementById("contactForm");
const formFeedback = document.getElementById("formFeedback");

if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
        e.preventDefault();
        formFeedback.textContent = "Mensagem enviada! Em breve entraremos em contato. ✓";
        formFeedback.classList.add("show");
        contactForm.reset();

        setTimeout(() => {
            formFeedback.classList.remove("show");
        }, 4000);
    });
}
