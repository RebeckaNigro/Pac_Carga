
const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

const scoreEl = document.querySelector('#score');
const livesEl = document.querySelector('#lives');
const effectEl = document.querySelector('#effect');
const dialog = document.querySelector('#question');

const tile = 40;
const cols = 14;
const rows = 10;

// # = parede
// . = comidinha
// ? = porta de desafio
// B = booster liberado

const originalMap = [
    '##############',
    '#............#',
    '#.##.#.###...#',
    '#?.........?#.',
    '#.####....#.#.',
    '#......#....#.',
    '#.####.#.##.#.',
    '#?#....#......',
    '#....##....?..',
    '##############'
];

let map;
let player;
let enemies;
let score;
let lives;
let running;
let lastTime;
let unlocked;
let effectUntil;
let effectName;

const questions = {
    '1,3': {
        title: 'Sala de Ohm',
        text: 'Se V = 12 V e R = 4 Ω, qual é a corrente?',
        formula: 'I = V / R',
        answers: ['2 A', '3 A', '16 A'],
        correct: 1,
        solution: 'I = V / R = 12 / 4 = 3 A.',
        booster: 'Escudo'
    },

    '11,3': {
        title: 'Sala da corrente',
        text: 'Passam 10 C de carga em 2 s. Qual é a corrente?',
        formula: 'I = Q / t',
        answers: ['5 A', '8 A', '20 A'],
        correct: 0,
        solution: 'I = Q / t = 10 / 2 = 5 A.',
        booster: 'Velocidade'
    },

    '1,7': {
        title: 'Sala do campo magnético',
        text: 'Uma força de 10 N atua em q = 2 C a v = 5 m/s, perpendicularmente. Qual é B?',
        formula: 'B = F / (q · v)',
        answers: ['0,5 T', '1 T', '25 T'],
        correct: 1,
        solution: 'B = F / (q · v) = 10 / (2 · 5) = 1 T.',
        booster: 'Pulso'
    },

    '11,8': {
        title: 'Sala da tensão',
        text: 'Um resistor de 3 Ω conduz 2 A. Qual é a tensão?',
        formula: 'V = R · I',
        answers: ['1,5 V', '5 V', '6 V'],
        correct: 2,
        solution: 'V = R · I = 3 · 2 = 6 V.',
        booster: 'Escudo'
    }
};

// Controles do teclado
const keys = {};

addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }
});

addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

document.querySelector('#restart').onclick = start;

// Iniciar jogo
function start() {
    map = originalMap.map(row => row.split(''));

    player = {
        x: 1.5,
        y: 1.5,
        r: 13,
        speed: 3.2,
        dir: { x: 1, y: 0 }
    };

    enemies = [
        { x: 11.5, y: 1.5, charge: 1, color: '#ff6584' },
        { x: 10.5, y: 7.5, charge: -1, color: '#62dfff' },
        { x: 4.5, y: 5.5, charge: 1, color: '#ff9f4a' }
    ];

    score = 0;
    lives = 3;
    running = true;
    unlocked = [];
    effectUntil = 0;
    effectName = '';
    lastTime = performance.now();

    document.querySelector('#restart').hidden = true;

    updateHud();
    requestAnimationFrame(loop);
}

// Identificar célula
function cell(x, y) {
    return map[Math.floor(y)]?.[Math.floor(x)] || '#';
}

// Verificar parede
function wall(x, y) {
    return cell(x, y) === '#';
}

// Movimentação e colisão com paredes
function move(entity, dx, dy, speed) {
    const nx = entity.x + dx * speed;
    const ny = entity.y + dy * speed;
    const r = .27;

    if (
        !wall(nx - r, ny - r) &&
        !wall(nx + r, ny - r) &&
        !wall(nx - r, ny + r) &&
        !wall(nx + r, ny + r)
    ) {
        entity.x = nx;
        entity.y = ny;
        return true;
    }

    // Permite deslizar pelas paredes
    const freeX =
        !wall(nx - r, entity.y - r) &&
        !wall(nx + r, entity.y - r) &&
        !wall(nx - r, entity.y + r) &&
        !wall(nx + r, entity.y + r);

    if (freeX) {
        entity.x = nx;
        return true;
    }

    const freeY =
        !wall(entity.x - r, ny - r) &&
        !wall(entity.x + r, ny - r) &&
        !wall(entity.x - r, ny + r) &&
        !wall(entity.x + r, ny + r);

    if (freeY) {
        entity.y = ny;
        return true;
    }

    return false;
}

// Atualizar jogo
function update(dt) {
    const controls = [
        ['arrowleft', -1, 0],
        ['a', -1, 0],
        ['arrowright', 1, 0],
        ['d', 1, 0],
        ['arrowup', 0, -1],
        ['w', 0, -1],
        ['arrowdown', 0, 1],
        ['s', 0, 1]
    ];

    const playerSpeed = player.speed * (
        effectName === 'Velocidade' ? 1.65 : 1
    );

    for (const [key, x, y] of controls) {
        if (keys[key] && move(player, x, y, playerSpeed * dt)) {
            player.dir = { x, y };
            break;
        }
    }

    const cx = Math.floor(player.x);
    const cy = Math.floor(player.y);
    const here = cell(player.x, player.y);

    // Coletar comidinhas
    if (here === '.') {
        map[cy][cx] = ' ';
        score += 10;
        updateHud();
    }

    // Abrir desafio
    if (here === '?' && !dialog.open) {
        ask(cx, cy);
    }

    // Coletar booster
    if (here === 'B') {
        map[cy][cx] = ' ';
        activate(unlocked.shift() || 'Escudo');
        score += 50;
        updateHud();
    }

    // Movimentação dos inimigos
    for (const e of enemies) {
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;

        if (dist < 4.5) {
            // Positivo atrai e negativo repele o jogador
            const direction = e.charge > 0 ? 1 : -1;

            move(
                e,
                direction * dx / dist,
                direction * dy / dist,
                2.45 * dt
            );
        }

        if (e.charge < 0 && dist < 2.2) {
            move(player, dx / dist, dy / dist, .9 * dt);
        }

        if (dist < .62) {
            hit();
        }
    }

    // Verificar duração do booster
    if (effectUntil && performance.now() > effectUntil) {
        effectUntil = 0;
        effectName = '';
        updateHud();
    }

    // Verificar vitória
    if (![...map.flat()].includes('.')) {
        finish('Você coletou toda a energia!');
    }
}

// Jogador atingido
function hit() {
    if (effectName === 'Escudo') {
        return;
    }

    if (--lives <= 0) {
        finish('Fim de jogo');
    } else {
        player.x = 1.5;
        player.y = 1.5;
    }

    updateHud();
}

// Mostrar pergunta
function ask(x, y) {
    const q = questions[`${x},${y}`];

    document.querySelector('#questionTitle').textContent = q.title;

    document.querySelector('#questionText').textContent =
        `${q.text} Fórmula: ${q.formula}.`;

    const answers = document.querySelector('#answers');
    answers.innerHTML = '';

    q.answers.forEach((answer, i) => {
        const b = document.createElement('button');

        b.type = 'button';
        b.textContent = answer;

        b.onclick = () => {
            if (i === q.correct) {
                map[y][x] = 'B';
                unlocked.push(q.booster);
                score += 25;
                dialog.close();
                updateHud();
            } else {
                wrongAnswer(q, x, y);
            }
        };

        answers.append(b);
    });

    if (!dialog.open) {
        dialog.showModal();
    }
}

// Resposta incorreta
function wrongAnswer(q, x, y) {
    document.querySelector('#questionTitle').textContent =
        'Resposta incorreta';

    document.querySelector('#questionText').textContent =
        'Veja a resposta e o cálculo completo para liberar a passagem.';

    const answers = document.querySelector('#answers');
    answers.innerHTML = '';

    const see = document.createElement('button');

    see.type = 'button';
    see.textContent = 'Ver resolução';
    see.onclick = () => showSolution(q, x, y);

    answers.append(see);
}

// Mostrar resolução
function showSolution(q, x, y) {
    document.querySelector('#questionTitle').textContent =
        'Resposta e cálculo';

    document.querySelector('#questionText').textContent =
        `Fórmula: ${q.formula} ${q.solution}`;

    const answers = document.querySelector('#answers');
    answers.innerHTML = '';

    const leave = document.createElement('button');

    leave.type = 'button';
    leave.textContent = 'Continuar sem booster';

    leave.onclick = () => {
        map[y][x] = ' ';
        dialog.close();
    };

    answers.append(leave);
}

// Ativar booster
function activate(name) {
    effectName = name;
    effectUntil = performance.now() + 6000;

    if (name === 'Pulso') {
        enemies.forEach(e => {
            e.x += e.x < player.x ? -1 : 1;
            e.y += e.y < player.y ? -1 : 1;
        });
    }

    updateHud();
}

// Finalizar jogo
function finish(message) {
    if (!running) {
        return;
    }

    running = false;
    effectEl.textContent = message;

    document.querySelector('#restart').hidden = false;
}

// Atualizar informações da tela
function updateHud() {
    scoreEl.textContent = score;
    livesEl.textContent = lives;

    effectEl.textContent = effectName
        ? `${effectName} ativo`
        : 'Sem booster';
}

// Desenhar jogo no Canvas
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenhar mapa
    map.forEach((row, y) => {
        row.forEach((v, x) => {
            const px = x * tile;
            const py = y * tile;

            // Paredes
            if (v === '#') {
                ctx.fillStyle = '#244c9c';
                ctx.fillRect(px, py, tile, tile);

      
            }

            // Comidinhas
            if (v === '.') {
                ctx.fillStyle = '#ffe9a4';
                ctx.beginPath();
                ctx.arc(px + 20, py + 20, 3, 0, 7);
                ctx.fill();
            }

            // Desafios e boosters
            if (v === '?' || v === 'B') {
                ctx.fillStyle = v === '?' ? '#a56aff' : '#80f0a4';
                ctx.fillRect(px + 7, py + 7, 26, 26);

                ctx.fillStyle = '#10142b';
                ctx.font = 'bold 20px sans-serif';

                ctx.fillText(
                    v === '?' ? '?' : '★',
                    14 + px,
                    27 + py
                );
            }
        });
    });

    // Desenhar inimigos
    enemies.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.x * tile, e.y * tile, 13, 0, 7);
        ctx.fill();

        ctx.fillStyle = '#17223d';
        ctx.font = 'bold 17px sans-serif';

        ctx.fillText(
            e.charge > 0 ? '+' : '−',
            e.x * tile - 5,
            e.y * tile + 6
        );
    });

    // Desenhar Pac-Man
    ctx.fillStyle = effectName === 'Escudo'
        ? '#aef5ff'
        : '#ffd83d';

    ctx.beginPath();

    ctx.arc(
        player.x * tile,
        player.y * tile,
        player.r,
        .25 * Math.PI,
        1.75 * Math.PI
    );

    ctx.lineTo(player.x * tile, player.y * tile);
    ctx.fill();
}

// Loop principal
function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, .04);

    lastTime = now;

    if (running && !dialog.open) {
        update(dt);
    }

    draw();

    if (running) {
        requestAnimationFrame(loop);
    }
}

// Iniciar
start();
