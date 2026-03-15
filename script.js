/**
 * Utility Vector Class
 */
class Vec2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vec2(this.x * n, this.y * n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        let m = this.mag();
        return m === 0 ? new Vec2(0, 0) : new Vec2(this.x / m, this.y / m);
    }
}

/**
 * Basic Rigid Body for user drawn shapes
 */
class RigidShape {
    constructor(points, color = '#ffffff') {
        // Find center of mass roughly
        let cx = 0, cy = 0;
        for (let p of points) {
            cx += p.x;
            cy += p.y;
        }
        cx /= points.length;
        cy /= points.length;

        this.pos = new Vec2(cx, cy);
        this.vel = new Vec2(0, 0);
        this.points = points.map(p => new Vec2(p.x - cx, p.y - cy)); // Local points
        this.isStatic = true; // LINEAS AHORA SON ESTATICAS
        this.color = color;

        // Bounding box for simple floor collision
        this.updateBounds();
    }

    reposition(x, y) {
        this.pos.x = x;
        this.pos.y = y;
        this.updateBounds();
    }

    updateBounds() {
        this.minY = Infinity;
        this.maxY = -Infinity;
        for (let p of this.points) {
            let worldY = this.pos.y + p.y;
            if (worldY < this.minY) this.minY = worldY;
            if (worldY > this.maxY) this.maxY = worldY;
        }
    }

    update(gravity, dt) {
        if (this.isStatic) return;

        // Apply gravity
        this.vel = this.vel.add(gravity.mult(dt));
        this.pos = this.pos.add(this.vel.mult(dt));

        this.updateBounds();
    }

    render(ctx) {
        if (this.points.length < 2) return;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 10; // Ensure consistent thickness for obstacles
        
        ctx.beginPath();
        let first = this.points[0];
        ctx.moveTo(this.pos.x + first.x, this.pos.y + first.y);
        for (let i = 1; i < this.points.length; i++) {
            let p = this.points[i];
            ctx.lineTo(this.pos.x + p.x, this.pos.y + p.y);
        }
        ctx.stroke();
    }
}

/**
 * Circle Entity (e.g., the ball)
 */
class Ball {
    constructor(x, y, radius) {
        this.pos = new Vec2(x, y);
        this.oldPos = new Vec2(x, y); // For Verlet integration
        this.radius = radius;
        this.mass = radius;
    }

    reposition(x, y) {
        let dx = x - this.pos.x;
        let dy = y - this.pos.y;
        this.pos.x = x;
        this.pos.y = y;
        this.oldPos.x += dx;
        this.oldPos.y += dy;
    }

    update(gravity, dt) {
        // Verlet Integration
        let vel = this.pos.sub(this.oldPos);
        this.oldPos = new Vec2(this.pos.x, this.pos.y);

        // Add gravity
        let nextPos = this.pos.add(vel).add(gravity.mult(dt * dt));
        this.pos = nextPos;
    }

    render(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 213, 0, 1)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 187, 0, 0.5)';
        ctx.stroke();
    }
}

/**
 * Target Zone (e.g., goal area)
 */
class Target {
    constructor(x, y, width, height, type = 'box') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        const scaleFactor = Math.min(window.innerWidth, window.innerHeight) / 800;
        this.thickness = Math.max(6, 10 * scaleFactor);

        this.type = type;

        this.walls = [];
        if (this.type === 'box') {
            this.updateWalls();
        }
    }

    updateWalls() {
        // [left wall, right wall, bottom wall]
        this.walls = [
            { pos: new Vec2(this.x, this.y + this.height / 2), w: this.thickness, h: this.height, isBottom: false },
            { pos: new Vec2(this.x + this.width, this.y + this.height / 2), w: this.thickness, h: this.height, isBottom: false },
            { pos: new Vec2(this.x + this.width / 2, this.y + this.height), w: this.width + this.thickness, h: this.thickness, isBottom: true }
        ];
    }

    reposition(x, y) {
        this.x = x;
        this.y = y;
        if (this.type === 'box') {
            this.updateWalls();
        }
    }

    contains(ball) {
        if (this.type === 'box') {
            // Condition: ball goes deep enough inside the box without hitting the bottom
            return ball.pos.x > this.x + this.thickness &&
                ball.pos.x < this.x + this.width - this.thickness &&
                ball.pos.y > this.y + this.height / 2 &&
                ball.pos.y < this.y + this.height - ball.radius;
        } else {
            // "zone" type: just a simple bounding area
            return ball.pos.x > this.x && ball.pos.x < this.x + this.width &&
                ball.pos.y > this.y && ball.pos.y < this.y + this.height;
        }
    }

    render(ctx) {
        if (this.type === 'box') {
            ctx.fillStyle = 'rgba(255, 213, 0, 1)'; // Signal Green solid
            // Draw the walls
            this.walls.forEach(w => {
                ctx.fillRect(w.pos.x - w.w / 2, w.pos.y - w.h / 2, w.w, w.h);
            });
        } else {
            // Render non-blocking zone faintly
            ctx.beginPath();
            ctx.rect(this.x, this.y, this.width, this.height);
            ctx.strokeStyle = 'rgba(255, 213, 0, 0.5)';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw scoring zone faintly
        ctx.fillStyle = 'rgba(255, 213, 0, 0.1)';
        ctx.fillRect(this.x, this.y, this.width, this.height);

        ctx.fillStyle = '#00ff41';
        ctx.font = '14px "Space Mono"';
        ctx.fillText('', this.x + this.width / 3 - 25, this.y + this.height + 20);
    }
}

/**
 * Motor del Juego: Luqui
 * Tecnologías: Vanilla JS, Canvas 2D
 * Foco: Física, Dibujo y Renderizado (Naïve Design / Signal Graphics)
 */
class Game {
    constructor() {
        // Inicialización de Canvas
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Estado y Dimensiones
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Estado General
        this.isPlaying = false;
        this.currentLevelIndex = 0;
        this.score = 0;
        document.getElementById('full-restart').style.display = 'none';
        document.getElementById('in-game-retry').style.display = 'none';

        // Físicas (Valores iniciales aproximados)
        this.physicsConfig = {
            gravity: new Vec2(0, 0.0001), // MUCHO MAS LENTO
            floorRestitution: 0.3,
            friction: 0.3
        };
        this.rigidBodies = []; // Guarda todas las figuras dibujadas/objetos

        // Estado de Dibujo
        this.isDrawing = false;
        this.currentStroke = []; // Array de puntos {x, y}

        // Configuración visual "Naïve" para pincel
        this.brushStyle = {
            color: '#00ffff',
            glow: '#5effffff', // Acid pink para iluminar trazo
            width: 6
        };

        // Screen Detection and Boundary Frame (3% smaller)
        this.boundaryPadding = 0.03;
        this.updateBoundaries();

        this.init();
    }

    updateBoundaries() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        this.frameWidth = this.width * (1 - this.boundaryPadding);
        // boundaryMinY adjusted to start below header (approx 55px total from top)
        this.boundaryMinY = 55;

        this.frameHeight = (this.height - this.boundaryMinY) * (1 - (this.boundaryPadding / 2));

        this.boundaryMinX = (this.width - this.frameWidth) / 2;
        this.boundaryMaxX = this.boundaryMinX + this.frameWidth;
        this.boundaryMaxY = this.boundaryMinY + this.frameHeight;
    }

    init() {
        this.resize();
        this.bindEvents();

        // UI Bindings
        document.getElementById('start-pro-btn').addEventListener('click', () => {
            document.getElementById('start-modal').classList.add('hidden');
            this.currentLevelIndex = 1;
            console.log(`load level pro`);
            this.loadLevel(this.currentLevelIndex - 1);
            this.isPlaying = true;
            this.lastTime = performance.now();
            document.getElementById('full-restart').style.display = '';
            document.getElementById('in-game-retry').style.display = '';
        });

        document.getElementById('start-expert-btn').addEventListener('click', () => {
            document.getElementById('start-modal').classList.add('hidden');
            this.currentLevelIndex = 11;
            console.log(`load level expert`);
            this.loadLevel(this.currentLevelIndex - 1);
            this.isPlaying = true;
            this.lastTime = performance.now();
            document.getElementById('full-restart').style.display = '';
            document.getElementById('in-game-retry').style.display = '';
        });

        document.getElementById('restart-game-btn').addEventListener('click', () => {
            document.getElementById('final-modal').classList.add('hidden');
            document.getElementById('start-modal').classList.remove('hidden');
            this.currentLevelIndex = 1;
            this.score = 0;
            this.isPlaying = false; // Wait for player to click start again
            this.loadLevel(this.currentLevelIndex - 1);
            this.render(); // force render
            document.getElementById('full-restart').style.display = '';
            document.getElementById('in-game-retry').style.display = '';
        });

        document.getElementById('retry-btn').addEventListener('click', () => {
            document.getElementById('feedback-modal').classList.add('hidden');
            this.loadLevel(this.currentLevelIndex - 1);
        });

        // In-game Retry binding
        document.getElementById('in-game-retry').addEventListener('click', () => {
            this.loadLevel(this.currentLevelIndex - 1);
        });

        // Full Restart binding
        document.getElementById('full-restart').addEventListener('click', () => {
            window.location.reload();
        });

        // Expert Mode start binding
        document.getElementById('expert-btn').addEventListener('click', () => {
            document.getElementById('pro-modal').classList.add('hidden');
            this.currentLevelIndex = 11;
            this.loadLevel(this.currentLevelIndex - 1);
            document.getElementById('full-restart').style.display = '';
            document.getElementById('in-game-retry').style.display = '';
        });

        // Pro Restart binding
        document.getElementById('pro-restart-btn').addEventListener('click', () => {
            document.getElementById('pro-modal').classList.add('hidden');
            document.getElementById('start-modal').classList.remove('hidden');
            this.currentLevelIndex = 1;
            this.score = 0;
            this.isPlaying = false; // Wait for player to click start again
            this.loadLevel(this.currentLevelIndex - 1);
            this.render(); // force render
            document.getElementById('full-restart').style.display = '';
            document.getElementById('in-game-retry').style.display = '';
        });

        // Load first Level
        this.loadLevel(this.currentLevelIndex);

        // Iniciar Bucle Visual
        this.lastTime = performance.now();
        requestAnimationFrame(this.gameLoop.bind(this));
        console.log("[SISTEMA] Motor de Física Inicializado.");
    }

    loadLevel(index) {
        console.log(`Index load level: `, index);
        this.rigidBodies = []; // Clear drawings
        this.currentStroke = [];
        this.isDrawing = false;


        // Update UI
        if (this.currentLevelIndex > 0 && this.currentLevelIndex < 11) {
            const levelPro = this.currentLevelIndex;
            console.log(`level 1 a 10: `, levelPro);
            document.querySelector('.level-indicator').innerText = `NIVEL PRO: ` + levelPro;
            this.updateScoreUI();
        }

        if (this.currentLevelIndex > 10) {
            const levelExp = this.currentLevelIndex - 10;
            console.log(`level 11 a 20: `, levelExp);
            document.querySelector('.level-indicator').innerText = `NIVEL EXPERTO: ` + levelExp;
            this.updateScoreUI();
        }


        // Dark theme toggle for Expert Mode
        if (index >= 10) {
            console.log(`dark mode ok: `, index);
            document.body.classList.add('expert-mode');
        } else {
            console.log(`dark mode no: `, index);
            document.body.classList.remove('expert-mode');
        }

        // Basic Level Setup based on index (10 Pro UX + 10 Expert)
        let cx = this.width / 2;
        let cy = this.height / 2;

        // Basic Level Setup based on index (10 Pro UX + 10 Expert)
        // Normalize coordinates: 0.0 to 1.0 within the boundary frame
        const levels = [
            // Level 1: Basic drop - Caja grande
            { bx: 0.3, by: 0.2, tx: 0.3, ty: 0.8, tw: 0.15, th: 0.12, type: 'box' },
            // Level 2: Offset (Needs a slope) - Caja chica
            { bx: 0.2, by: 0.2, tx: 0.7, ty: 0.8, tw: 0.1, th: 0.08, type: 'box' },
            // Level 3: Wall block in the middle
            {
                bx: 0.2, by: 0.3, tx: 0.8, ty: 0.8, tw: 0.1, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 1.0 }] // Muro vertical
                ]
            },
            // Level 4: Funnel (Embudo) structure
            {
                bx: 0.2, by: 0.1, tx: 0.45, ty: 0.85, tw: 0.1, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.3, y: 0.5 }, { x: 0.43, y: 0.7 }],
                    [{ x: 0.7, y: 0.5 }, { x: 0.57, y: 0.7 }]
                ]
            },
            // Level 5: Static Tunnel bounds
            {
                bx: 0.2, by: 0.1, tx: 0.8, ty: 0.8, tw: 0.1, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.35, y: 0.45 }, { x: 0.65, y: 0.45 }], // Techo tunel
                    [{ x: 0.35, y: 0.55 }, { x: 0.65, y: 0.55 }]  // Piso tunel
                ]
            },
            // Level 6: Floating zone with platform underneath
            {
                bx: 0.2, by: 0.2, tx: 0.7, ty: 0.5, tw: 0.1, th: 0.1, type: 'zone', obstacles: [
                    [{ x: 0.7, y: 0.6 }, { x: 0.8, y: 0.6 }] // Plataforma bajo la zona
                ]
            },
            // Level 7: Multiple random walls
            {
                bx: 0.8, by: 0.1, tx: 0.2, ty: 0.8, tw: 0.1, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.5, y: 0.1 }, { x: 0.5, y: 0.3 }],
                    [{ x: 0.35, y: 0.3 }, { x: 0.35, y: 1.0 }]
                ]
            },
            // Level 8: Zig Zag setup
            {
                bx: 0.5, by: 0.1, tx: 0.5, ty: 0.85, tw: 0.12, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.3, y: 0.25 }, { x: 0.6, y: 0.35 }],
                    [{ x: 0.7, y: 0.45 }, { x: 0.4, y: 0.55 }]
                ]
            },
            // Level 9: Narrow gap dropping
            {
                bx: 0.3, by: 0.1, tx: 0.75, ty: 0.8, tw: 0.1, th: 0.12, type: 'box', obstacles: [
                    [{ x: 0.5, y: 0.0 }, { x: 0.5, y: 0.45 }],
                    [{ x: 0.5, y: 0.55 }, { x: 0.5, y: 1.0 }]
                ]
            },
            // Level 10: Enclosed box start
            {
                bx: 0.1, by: 0.05, tx: 0.85, ty: 0.85, tw: 0.08, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.3, y: 0.5 }, { x: 0.4, y: 0.5 }],
                    [{ x: 0.6, y: 0.5 }, { x: 0.7, y: 0.5 }],
                    [{ x: 0.45, y: 0.65 }, { x: 0.55, y: 0.65 }]
                ]
            },
            // --- EXPERT MODE LEVELS ---
            // Level 11: Tight gap floating target
            {
                bx: 0.2, by: 0.05, tx: 0.75, ty: 0.4, tw: 0.08, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.4, y: 0.0 }, { x: 0.4, y: 0.55 }],
                    [{ x: 0.55, y: 1.0 }, { x: 0.55, y: 0.45 }]
                ]
            },
            // Level 12: Suspended container, tiny gap
            {
                bx: 0.5, by: 0.05, tx: 0.5, ty: 0.65, tw: 0.06, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.4, y: 0.15 }, { x: 0.45, y: 0.25 }],
                    [{ x: 0.6, y: 0.15 }, { x: 0.55, y: 0.25 }],
                    [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }]
                ]
            },
            // Level 13: Multiple diagonal ramps
            {
                bx: 0.15, by: 0.05, tx: 0.8, ty: 0.8, tw: 0.1, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.25, y: 0.2 }, { x: 0.5, y: 0.3 }],
                    [{ x: 0.75, y: 0.35 }, { x: 0.45, y: 0.45 }],
                    [{ x: 0.25, y: 0.6 }, { x: 0.65, y: 0.55 }]
                ]
            },
            // Level 14: Vertical Plinko
            {
                bx: 0.5, by: 0.05, tx: 0.5, ty: 0.8, tw: 0.12, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.4, y: 0.2 }, { x: 0.55, y: 0.22 }],
                    [{ x: 0.6, y: 0.4 }, { x: 0.45, y: 0.42 }],
                    [{ x: 0.4, y: 0.6 }, { x: 0.55, y: 0.62 }]
                ]
            },
            // Level 15: Target behind a huge wall
            {
                bx: 0.1, by: 0.05, tx: 0.7, ty: 0.8, tw: 0.08, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.5, y: 0.0 }, { x: 0.5, y: 0.8 }]
                ]
            },
            // Level 16: Two thin towers and a small target
            {
                bx: 0.2, by: 0.05, tx: 0.8, ty: 0.8, tw: 0.06, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.4, y: 0.3 }, { x: 0.4, y: 1.0 }],
                    [{ x: 0.6, y: 0.2 }, { x: 0.6, y: 1.0 }]
                ]
            },
            // Level 17: U-Turn required
            {
                bx: 0.3, by: 0.2, tx: 0.2, ty: 0.05, tw: 0.1, th: 0.08, type: 'box', obstacles: [
                    [{ x: 0.4, y: 0.0 }, { x: 0.4, y: 0.4 }],
                    [{ x: 0.1, y: 0.4 }, { x: 0.4, y: 0.4 }],
                    [{ x: 0.1, y: 0.0 }, { x: 0.1, y: 0.2 }]
                ]
            },
            // Level 18: Zone target suspended mid-air
            {
                bx: 0.1, by: 0.1, tx: 0.7, ty: 0.2, tw: 0.1, th: 0.1, type: 'zone', obstacles: [
                    [{ x: 0.5, y: 0.0 }, { x: 0.5, y: 0.4 }],
                    [{ x: 0.6, y: 0.4 }, { x: 0.9, y: 0.4 }]
                ]
            },
            // Level 19: Extremely narrow shaft
            {
                bx: 0.5, by: 0.05, tx: 0.5, ty: 0.8, tw: 0.08, th: 0.1, type: 'box', obstacles: [
                    [{ x: 0.45, y: 0.2 }, { x: 0.45, y: 0.7 }],
                    [{ x: 0.55, y: 0.2 }, { x: 0.55, y: 0.7 }]
                ]
            },
            // Level 20: The Ultimate Challenge
            {
                bx: 0.1, by: 0.05, tx: 0.8, ty: 0.4, tw: 0.07, th: 0.07, type: 'box', obstacles: [
                    [{ x: 0.3, y: 0.0 }, { x: 0.3, y: 0.6 }],
                    [{ x: 0.5, y: 1.0 }, { x: 0.5, y: 0.4 }],
                    [{ x: 0.7, y: 0.0 }, { x: 0.7, y: 0.6 }]
                ]
            }
        ];

        // Ensure we don't go out of bounds
        let levelData = levels[Math.min(index, levels.length - 1)];

        // Adaptive scaling based on screen size
        const scaleFactor = Math.min(this.frameWidth, this.frameHeight) / 800;
        const ballSize = Math.max(12, 20 * scaleFactor);
        const tWidth = levelData.tw * this.frameWidth;
        const tHeight = levelData.th * this.frameHeight;

        // Map relative coordinates to absolute pixels
        const bx = this.boundaryMinX + levelData.bx * this.frameWidth;
        const by = this.boundaryMinY + levelData.by * this.frameHeight;
        const tx = this.boundaryMinX + levelData.tx * this.frameWidth;
        const ty = this.boundaryMinY + levelData.ty * this.frameHeight;

        this.ball = new Ball(bx, by, ballSize);
        this.ball.relX = levelData.bx;
        this.ball.relY = levelData.by;

        this.target = new Target(tx, ty, tWidth, tHeight, levelData.type);
        this.target.relX = levelData.tx;
        this.target.relY = levelData.ty;

        // Agregar algunos estáticos predefinidos si los hubiera (obstáculos)
        if (levelData.obstacles) {
            for (let obs of levelData.obstacles) {
                // Map relative obstacle points to absolute pixels
                let mappedObs = obs.map(p => ({
                    x: this.boundaryMinX + p.x * this.frameWidth,
                    y: this.boundaryMinY + p.y * this.frameHeight
                }));
                const color = 'rgba(255, 213, 0, 1)'; // Target Box color
                const shape = new RigidShape(mappedObs, color);
                let sRel = this.getRelPos(shape.pos.x, shape.pos.y);
                shape.relX = sRel.relX;
                shape.relY = sRel.relY;
                this.rigidBodies.push(shape);
            }
        }

        this.levelCompleted = false;
    }

    resize() {
        this.updateBoundaries();
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Reposition all active game objects
        if (this.ball && this.ball.relX !== undefined) {
            this.ball.reposition(
                this.boundaryMinX + this.ball.relX * this.frameWidth,
                this.boundaryMinY + this.ball.relY * this.frameHeight
            );
        }
        if (this.target && this.target.relX !== undefined) {
            this.target.reposition(
                this.boundaryMinX + this.target.relX * this.frameWidth,
                this.boundaryMinY + this.target.relY * this.frameHeight
            );
        }
        for (let body of this.rigidBodies) {
            if (body.relX !== undefined) {
                body.reposition(
                    this.boundaryMinX + body.relX * this.frameWidth,
                    this.boundaryMinY + body.relY * this.frameHeight
                );
            }
        }
    }

    getRelPos(x, y) {
        return {
            relX: (x - this.boundaryMinX) / this.frameWidth,
            relY: (y - this.boundaryMinY) / this.frameHeight
        };
    }

    bindEvents() {
        window.addEventListener('resize', this.resize.bind(this));

        // Ratón
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        window.addEventListener('mouseup', this.stopDrawing.bind(this));

        // Táctil
        this.canvas.addEventListener('touchstart', this.startDrawingTouch.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.drawTouch.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.stopDrawingTouch.bind(this), { passive: false });
    }

    // -- CAPTURA DE INPUT --

    getMousePos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        return new Vec2(evt.clientX - rect.left, evt.clientY - rect.top);
    }

    getTouchPos(evt) {
        const rect = this.canvas.getBoundingClientRect();
        return new Vec2(evt.touches[0].clientX - rect.left, evt.touches[0].clientY - rect.top);
    }

    startDrawing(evt) {
        if (!this.isPlaying) return;
        this.isDrawing = true;
        this.currentStroke = [this.getMousePos(evt)];
    }

    startDrawingTouch(evt) {
        evt.preventDefault();
        if (!this.isPlaying) return;
        this.isDrawing = true;
        this.currentStroke = [this.getTouchPos(evt)];
    }

    draw(evt) {
        if (!this.isDrawing || !this.isPlaying) return;
        this.currentStroke.push(this.getMousePos(evt));
    }

    drawTouch(evt) {
        evt.preventDefault();
        if (!this.isDrawing || !this.isPlaying) return;
        this.currentStroke.push(this.getTouchPos(evt));
    }

    stopDrawing() {
        this.finishStroke();
    }

    stopDrawingTouch(evt) {
        evt.preventDefault();
        this.finishStroke();
    }

    finishStroke() {
        if (!this.isDrawing) return;
        this.isDrawing = false;

        // Validar tamaño mínimo para convertirse en objeto físico
        if (this.currentStroke.length > 5) {
            this.convertStrokeToPhysicsObject(this.currentStroke);
        }

        this.currentStroke = [];
    }

    // -- LÓGICA DE FÍSICA Y ESTADOS --

    convertStrokeToPhysicsObject(points) {
        // Reducir puntos para optimizar colisiones (simplificación básica)
        let simplified = [];
        for (let i = 0; i < points.length; i += 3) {
            simplified.push(points[i]);
        }
        if (simplified.length < 2) simplified = points;

        let body = new RigidShape(simplified, this.brushStyle.color);
        let sRel = this.getRelPos(body.pos.x, body.pos.y);
        body.relX = sRel.relX;
        body.relY = sRel.relY;
        console.log(`[FÍSICA] Nuevo Rígido creado con masa aproximada.`);
        this.rigidBodies.push(body);
    }

    // Line segment to circle collision helper
    closestPointOnSegment(p, a, b) {
        let ab = b.sub(a);
        let t = p.sub(a).x * ab.x + p.sub(a).y * ab.y;
        t /= ab.x * ab.x + ab.y * ab.y;
        t = Math.max(0, Math.min(1, t));
        return a.add(ab.mult(t));
    }

    updatePhysics(deltaTime) {
        if (this.levelCompleted) return;

        // Limitar deltaTime para evitar explosiones físicas
        if (deltaTime > 50) deltaTime = 50;

        // Update body
        for (let body of this.rigidBodies) {
            body.update(this.physicsConfig.gravity, deltaTime);

            // Colisión muy básica con el suelo (Límite inferior del marco)
            if (body.maxY > this.boundaryMaxY) {
                // Resolver colisión empujando hacia arriba
                let overlap = body.maxY - this.boundaryMaxY;
                body.pos.y -= overlap;

                // Invertir velocidad y aplicar fricción/restitución
                body.vel.y *= -this.physicsConfig.floorRestitution;
                body.vel.x *= this.physicsConfig.friction;

                body.updateBounds();
            }
        }

        // Update Ball
        if (this.ball) {
            this.ball.update(this.physicsConfig.gravity, deltaTime);

            // Update relative position for resizing
            let bRel = this.getRelPos(this.ball.pos.x, this.ball.pos.y);
            this.ball.relX = bRel.relX;
            this.ball.relY = bRel.relY;

            // Ball Floor Collision (Límite inferior del marco)
            if (this.ball.pos.y + this.ball.radius > this.boundaryMaxY) {
                this.ball.pos.y = this.boundaryMaxY - this.ball.radius;
                // Fake restitution in verlet
                let velY = this.ball.pos.y - this.ball.oldPos.y;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.y = this.ball.pos.y + velY * this.physicsConfig.floorRestitution;
                this.ball.oldPos.x = this.ball.pos.x - velX * this.physicsConfig.friction;
            }

            // Ball Wall collisions (Límites del marco)
            if (this.ball.pos.x - this.ball.radius < this.boundaryMinX) {
                this.ball.pos.x = this.boundaryMinX + this.ball.radius;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.x = this.ball.pos.x + velX * 0.5;
            } else if (this.ball.pos.x + this.ball.radius > this.boundaryMaxX) {
                this.ball.pos.x = this.boundaryMaxX - this.ball.radius;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.x = this.ball.pos.x + velX * 0.5;
            }
            if (this.ball.pos.y - this.ball.radius < this.boundaryMinY) {
                this.ball.pos.y = this.boundaryMinY + this.ball.radius;
                let velY = this.ball.pos.y - this.ball.oldPos.y;
                this.ball.oldPos.y = this.ball.pos.y + velY * 0.5;
            }

            // Recopilar lineas para colisionar (cuerpos rígidos + trazo actual)
            let allLines = [];
            for (let body of this.rigidBodies) {
                let pts = [];
                for (let i = 0; i < body.points.length; i++) {
                    pts.push(body.pos.add(body.points[i]));
                }
                allLines.push(pts);
            }

            // Incluir trazo actual (en tiempo real)
            if (this.isDrawing && this.currentStroke.length > 1) {
                allLines.push(this.currentStroke);
            }

            // Ball vs all lines (Lines to Circle collision)
            for (let pts of allLines) {
                for (let i = 0; i < pts.length - 1; i++) {
                    let p1 = pts[i];
                    let p2 = pts[i + 1];

                    let closest = this.closestPointOnSegment(this.ball.pos, p1, p2);
                    let distVec = this.ball.pos.sub(closest);
                    let dist = distVec.mag();

                    if (dist < this.ball.radius) {
                        // Collision! Resolve penetration
                        let overlap = this.ball.radius - dist;
                        let normal = distVec.normalize();
                        if (dist === 0) normal = new Vec2(0, -1); // fallback

                        // Limit overlap to prevent explosive exits
                        if (overlap > this.ball.radius * 0.8) overlap = this.ball.radius * 0.8;

                        // Push ball away
                        this.ball.pos = this.ball.pos.add(normal.mult(overlap));

                        // Apply friction loss
                        this.ball.oldPos = this.ball.oldPos.add(normal.mult(-overlap * 0.8));
                    }
                }
            }

            // Ball vs Target Walls (AABB vs Circle)
            if (this.target && this.target.type === 'box') { // Only check walls if it's a 'box' type target
                for (let wall of this.target.walls) {
                    // AABB logic
                    let closestX = Math.max(wall.pos.x - wall.w / 2, Math.min(this.ball.pos.x, wall.pos.x + wall.w / 2));
                    let closestY = Math.max(wall.pos.y - wall.h / 2, Math.min(this.ball.pos.y, wall.pos.y + wall.h / 2));

                    let dx = this.ball.pos.x - closestX;
                    let dy = this.ball.pos.y - closestY;
                    let distSq = (dx * dx) + (dy * dy);

                    if (distSq < this.ball.radius * this.ball.radius) {
                        // Collision! Resolve penetration
                        let dist = Math.sqrt(distSq);
                        let overlap = this.ball.radius - dist;
                        let normal = new Vec2(dx / dist, dy / dist);
                        if (dist === 0) normal = new Vec2(0, -1); // fallback

                        // Push ball away
                        this.ball.pos = this.ball.pos.add(normal.mult(overlap));

                        // Apply friction loss
                        if (wall.isBottom && normal.y < 0) {
                            // Reducir rebote drásticamente si está golpeando el fondo de la caja
                            let velX = this.ball.pos.x - this.ball.oldPos.x;
                            this.ball.oldPos.x = this.ball.pos.x - velX * 0.2; // Alta fricción
                            this.ball.oldPos.y = this.ball.pos.y; // Absorber velocidad Y
                        } else {
                            this.ball.oldPos = this.ball.oldPos.add(normal.mult(-overlap * 0.5));
                        }
                    }
                }
            }
        }
    }

    checkWinCondition() {
        if (this.levelCompleted) return;

        if (this.ball && this.target && this.target.contains(this.ball)) {
            // Check if ball is relatively still inside the target
            let speed = this.ball.pos.sub(this.ball.oldPos).mag();
            if (speed < 1.0) {
                this.levelCompleted = true;

                // Calculate points (e.g., base 1000 minus penalty for drawn objects)
                let pts = Math.max(50, 1000 - (this.rigidBodies.length * 50));
                this.score += pts;
                this.updateScoreUI();

                this.showReward();
            }
        }
    }

    updateScoreUI() {
        document.querySelector('.score-indicator').innerText = `PUNTOS: ${this.score.toString().padStart(5, '0')}`;
    }

    showFeedback() {
        const feedbackModal = document.getElementById('feedback-modal');
        feedbackModal.classList.remove('hidden');
    }

    showReward() {
        if (this.currentLevelIndex === 10) {
            // Reached end of Pro levels, show Pro Complete modal
            const proModal = document.getElementById('pro-modal');
            document.getElementById('pro-points').innerText = this.score.toString().padStart(5, '0');
            document.getElementById('full-restart').style.display = 'none';
            document.getElementById('in-game-retry').style.display = 'none';
            proModal.classList.remove('hidden');
            return;
        } else if (this.currentLevelIndex === 20) {
            // Reached end of Expert levels
            const finalModal = document.getElementById('final-modal');
            document.getElementById('final-points').innerText = this.score.toString().padStart(5, '0');
            document.getElementById('full-restart').style.display = 'none';
            document.getElementById('in-game-retry').style.display = 'none';
            finalModal.classList.remove('hidden');
            return;
        }

        const rewardModal = document.getElementById('reward-modal');

        // Update trinket text dynamically
        const trinkets = ["🌟", "🏆", "💎", "⚙️", "🚀"];
        const badge = rewardModal.querySelector('.trinket-badge');
        badge.innerText = trinkets[this.currentLevelIndex % trinkets.length];

        // Update popup Level Text dynamically
        const title = rewardModal.querySelector('h2');

        if (this.currentLevelIndex >= 10) {
            const nivelActual = this.currentLevelIndex - 10
            title.innerText = `¡Nivel ${nivelActual} EXPERTO Superado!`;
            document.getElementById('in-game-retry').style.display = 'none';
        } else {
            const nivelActual = this.currentLevelIndex
            title.innerText = `¡Nivel ${nivelActual} PRO Superado!`;
            document.getElementById('in-game-retry').style.display = 'none';
        }


        rewardModal.classList.remove('hidden');

        const nextBtn = document.getElementById('next-btn');
        nextBtn.onclick = () => {
            document.getElementById('in-game-retry').style.display = '';
            rewardModal.classList.add('hidden');
            this.currentLevelIndex++;
            // Wrap around if finishing expert mode or handle win screen, optionally
            if (this.currentLevelIndex > 20) {
                this.currentLevelIndex = 0; // restart or handle final win screen later
            }
            this.loadLevel(this.currentLevelIndex - 1);
        };
    }

    // -- RENDERIZADO VISUAL --

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Render Frame Boundary (Subtle visual indication)
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([10, 10]);
        this.ctx.strokeRect(this.boundaryMinX, this.boundaryMinY, this.frameWidth, this.frameHeight);
        this.ctx.setLineDash([]);

        // Estilos Naïve Typography / Drawing
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this.brushStyle.width;

        // Render Target
        if (this.target) this.target.render(this.ctx);

        // Trazos ya completados (Objetos físicos)
        // Set default stroke style and width before looping
        this.ctx.strokeStyle = this.brushStyle.color;
        this.ctx.lineWidth = this.brushStyle.width;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';

        for (let body of this.rigidBodies) {
            body.render(this.ctx);
        }

        // Disable shadow for ball
        this.ctx.shadowBlur = 0;

        // Render Ball
        if (this.ball) this.ball.render(this.ctx);

        // Transparencia normal para ball
        this.ctx.globalAlpha = 1;

        // Trazo actual interactivo (Mismo estilo que líneas dibujadas)
        if (this.isDrawing && this.currentStroke.length > 0) {
            this.ctx.strokeStyle = this.brushStyle.color;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.lineWidth = this.brushStyle.width;

            this.ctx.beginPath();
            let first = this.currentStroke[0];
            this.ctx.moveTo(first.x, first.y);
            for (let i = 1; i < this.currentStroke.length; i++) {
                this.ctx.lineTo(this.currentStroke[i].x, this.currentStroke[i].y);
            }
            this.ctx.stroke();
        }
    }

    // -- BUCLE PRINCIPAL --

    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.isPlaying) {
            this.updatePhysics(deltaTime);
            this.checkWinCondition();
        }

        this.render();

        requestAnimationFrame(this.gameLoop.bind(this));
    }
}

// Iniciar aplicación
window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});