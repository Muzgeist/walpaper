# Guia do Código — Dynamic Wallpaper

Este arquivo explica como o projeto está organizado, onde cada função
mora e o que ela faz. A ideia é que você consiga abrir `script.js` e
saber exatamente o motivo de cada bloco existir.

---

## 1. Estrutura de arquivos

```
att walison/
├── index.html        → estrutura da página (HTML)
├── style.css         → toda a aparência (CSS)
├── script.js         → toda a lógica/comportamento (JavaScript)
├── GUIA_DO_CODIGO.md → este guia
└── wallpapers/       → as imagens usadas no carrossel
```

Regra geral: **HTML diz o que existe, CSS diz como aparece, JS diz como
se comporta.**

---

## 2. index.html — o que tem na página

| Elemento                          | Para que serve |
|------------------------------------|-----------------|
| `.backgroundGradient` / `.backgroundGlow` | Camadas de fundo (gradiente + brilho) que mudam de cor com o tema |
| `.hero`                            | Título e texto de boas-vindas |
| `#autoplayBar` / `#autoplayFill`   | Barra fina que enche conforme o tempo passa até a próxima troca automática |
| `#previous` / `#next`              | Setas do carrossel |
| `.viewer`                           | Caixa que contém a imagem, o canvas WebGL e o botão de info |
| `#wallpaper`                        | A `<img>` que mostra o wallpaper atual |
| `#glCanvas`                         | Canvas usado **só** durante a animação de poeira (WebGL) |
| `#infoBtn`                          | Botão "ⓘ" que abre o modal de detalhes |
| `.dots`                             | Bolinhas indicadoras (uma por wallpaper), geradas via JS |
| `#lockWallpaper`                    | Checkbox "Travar wallpaper" |
| `#modalOverlay`                     | Janela (modal) com nome, tamanho, cores e botão de download |
| `.siteFooter`                       | Rodapé com o copyright |

> Os `id`s (ex: `id="wallpaper"`) são os "ganchos" que o `script.js`
> usa para encontrar e controlar cada elemento via
> `document.getElementById(...)`.

---

## 3. style.css — como cada coisa aparece

O CSS usa **variáveis customizadas** (`--primary`, `--background`,
etc.) declaradas em `:root`. Essas variáveis são alteradas em tempo
real pelo JavaScript (função `updateTheme()`), e é por isso que a
interface inteira muda de cor junto com o wallpaper — tudo que usa
`var(--primary)`, `var(--background)`, etc. é redesenhado
automaticamente quando essas variáveis mudam.

Principais blocos:

- **Reset** → zera margens/paddings padrão do navegador.
- **`.backgroundGradient` / `.backgroundGlow`** → o fundo roxo/neon.
- **`.viewer` / `#wallpaper` / `#glCanvas`** → a imagem fica em modo
  `object-fit: cover` (preenche sem distorcer) e o canvas fica
  posicionado **exatamente em cima** da imagem (`position: absolute`)
  para mostrar a poeira.
- **`.autoplayBar` / `.autoplayBarFill`** → a barra de progresso. A
  largura da `.autoplayBarFill` é controlada pelo JS.
- **`.modalOverlay` / `.modalCard`** → janela de detalhes, escondida
  por padrão (`opacity:0; visibility:hidden`) e revelada quando o JS
  adiciona a classe `.open`.
- **Media queries (`@media`)** ao final → ajustam tamanhos de fonte,
  botões e o `.viewer` para telas pequenas, baixas ou em modo
  paisagem, garantindo que nada fique cortado.

---

## 4. script.js — a lógica, função por função

O arquivo é organizado em blocos, sempre na ordem em que as coisas
acontecem. Veja o mapa:

### 4.1 Configuração inicial (topo do arquivo)
```js
const wallpapers = [...]       // lista de imagens do carrossel
const AUTOPLAY_MS = 10*60*1000 // troca automática a cada 10 minutos
const DUST_MS = 1100           // duração da animação de poeira (ms)
const BUILD_MS = 1300          // duração da imagem "se construindo"
```
Essas três constantes controlam **todos os tempos** do site. Se quiser
trocar a velocidade do carrossel, é só mudar `AUTOPLAY_MS`.

Em seguida, várias linhas `const x = document.getElementById(...)`
guardam referências aos elementos do HTML — assim o código não precisa
buscar no DOM toda hora.

### 4.2 Bolinhas (dots)
```js
dotsContainer.innerHTML = "";
wallpapers.forEach(() => { ... });   // cria 1 bolinha por wallpaper
function updateDots() { ... }        // marca a bolinha atual como "ativa"
```

### 4.3 Paleta de cores (tema dinâmico)
- `rgbToHex(rgb)` → converte `[255, 0, 128]` em `"#ff0080"`.
- `brightness(color)` → calcula o "brilho" de uma cor (fórmula
  padrão de luminosidade), usada para decidir se o texto deve ficar
  branco ou preto.
- `updateTheme()` → usa a biblioteca **Color Thief** para extrair 5
  cores da imagem atual e aplica cada uma numa variável CSS
  (`--background`, `--primary`, etc.) via
  `root.style.setProperty(...)`. **Essa função é o coração da
  "adaptação automática de cores".**

### 4.4 Animação de poeira (WebGL) — a parte mais avançada
Esse bloco é o que faz a imagem "se desfazer em poeira". Funciona
assim:

1. **`VERT_SRC` e `FRAG_SRC`** são pequenos programas escritos em
   *GLSL* (a linguagem de shaders do WebGL) — um para calcular a
   *posição* de cada partícula (vertex shader) e outro para calcular
   sua *cor* (fragment shader).
2. **`compileShader()`** compila esses textos em programas que a GPU
   entende.
3. **`dissolveToNext(nextSrc)`** é a função principal:
   - Tira uma "foto" (textura) da imagem atual.
   - Cria uma grade de partículas (34 colunas × 20 linhas) — cada
     partícula sabe qual pedacinho da imagem deve mostrar.
   - Envia essas informações para a GPU em **buffers**
     (`makeBuffer`).
   - Roda um loop (`frame`) com `requestAnimationFrame`, que pede para
     a GPU redesenhar a cena a cada quadro, atualizando o "tempo"
     (`uTime`) — é esse tempo que o shader usa para mover, girar e
     apagar cada partícula (veja a gravidade e o "vento" dentro do
     `VERT_SRC`).
   - Quando o tempo acaba (`DUST_MS`), chama `swapImage()`.
4. **`swapImage(nextSrc)`** deixa a imagem borrada/ampliada e troca o
   `src` — o evento `load` (mais abaixo) cuida de "desborrar" e
   devolver ao tamanho normal, dando a sensação de a imagem se
   "construir".

> Se o navegador não suportar WebGL, `dissolveToNext` simplesmente
> chama `swapImage` direto, sem travar o site.

### 4.5 Troca de imagem e construção
```js
function loadWallpaper() { dissolveToNext(wallpapers[current]); }

image.addEventListener("load", () => { ... });
```
Esse "load" é disparado todo vez que a `<img>` termina de carregar uma
nova foto. Ele aplica a transição CSS de "desborrar" e chama
`updateDots()` + `updateTheme()` para atualizar bolinha ativa e cores.

### 4.6 Navegação (setas, teclado, bolinhas)
```js
function goNext() { ... }
function goPrevious() { ... }
next.onclick = goNext;
previous.onclick = goPrevious;
window.addEventListener("keydown", ...)   // setas do teclado
dots.forEach(...)                          // clique nas bolinhas
```
Toda navegação passa por `goNext`/`goPrevious`, que sempre chamam
`restartAutoplay()` — isso garante que o cronômetro de 10 minutos
reinicia após qualquer troca manual.

### 4.7 Travar wallpaper (freeze)
```js
function applyLockState() { ... }
```
Lê o estado do checkbox `#lockWallpaper`. Se marcado: desabilita
setas/bolinhas e para o autoplay. Se desmarcado: religa tudo.

### 4.8 Autoplay + barra de progresso
```js
function startAutoplay() { ... }   // liga o setInterval de 10 min
function stopAutoplay() { ... }    // desliga
function restartAutoplay() { ... } // reinicia o cronômetro
function runProgressBar() { ... }  // anima a barrinha de 0% a 100%
```
`runProgressBar()` usa um truque comum em CSS: zera a largura sem
transição, espera dois quadros (`requestAnimationFrame` duplo) e só
depois liga a transição e manda para 100% — isso garante que o
navegador "registre" o reset antes de iniciar a animação suave.

### 4.9 Modal de detalhes
```js
function formatName(src) { ... }  // "hollow-knight.jpg" → "Hollow Knight"
function openModal() { ... }      // monta nome, tamanho, cores e link de download
function closeModal() { ... }
```
`openModal()` usa `image.naturalWidth/naturalHeight` (tamanho real do
arquivo, não o tamanho exibido na tela) e `lastPalette` (a última
paleta calculada por `updateTheme()`) para preencher o modal. O botão
de download usa o atributo HTML `download` numa tag `<a>`, que faz o
navegador salvar o arquivo em vez de abri-lo.

### 4.10 Inicialização (fim do arquivo)
```js
updateDots();
updateTheme();
applyLockState();
```
Essas três chamadas finais garantem que, ao abrir a página, a bolinha
certa já apareça ativa, o tema já reflita a primeira imagem e o
autoplay já comece funcionando.

---

## 5. Fluxo resumido (linha do tempo de uma troca de wallpaper)

1. Usuário clica em "next" (ou o autoplay dispara) → `goNext()`.
2. `goNext()` chama `loadWallpaper()` e `restartAutoplay()`.
3. `loadWallpaper()` chama `dissolveToNext()`.
4. WebGL desenha a poeira por `DUST_MS` (1,1s).
5. `swapImage()` troca o `src` da imagem (borrada).
6. O evento `load` dispara → imagem "desborra" suavemente por
   `BUILD_MS` (1,3s) e o tema/cores são atualizados.

---

## 6. Dica para testar

Como o projeto usa `<canvas>` (WebGL) e a biblioteca Color Thief, **não
abra o `index.html` direto pelo duplo clique**. Alguns navegadores
bloqueiam leitura de pixels em páginas abertas via `file://`. Use um
servidor local, por exemplo:

```bash
# dentro da pasta do projeto
python -m http.server 8000
```

Depois acesse `http://localhost:8000` no navegador.
