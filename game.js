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
    constructor(points) {
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

        // Bounding box for simple floor collision
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

    render(ctx, style) {
        if (this.points.length < 2) return;

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
        ctx.fillStyle = 'rgba(255, 187, 0, 1)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 187, 0, 0.7)';
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
        this.thickness = 10;
        this.type = type;

        this.walls = [];
        if (this.type === 'box') {
            // Define las paredes del contenedor en forma de U
            // [left wall, right wall, bottom wall]
            this.walls = [
                { pos: new Vec2(this.x, this.y + this.height / 2), w: this.thickness, h: this.height, isBottom: false },
                { pos: new Vec2(this.x + this.width, this.y + this.height / 2), w: this.thickness, h: this.height, isBottom: false },
                { pos: new Vec2(this.x + this.width / 2, this.y + this.height), w: this.width + this.thickness, h: this.thickness, isBottom: true }
            ];
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
            color: '#22ffcbff',
            glow: '#adffffff', // Acid pink para iluminar trazo
            width: 6
        };

        this.init();
    }

    init() {
        this.resize();
        this.bindEvents();

        // UI Bindings
        document.getElementById('start-pro-btn').addEventListener('click', () => {
            document.getElementById('start-modal').classList.add('hidden');
            this.currentLevelIndex = 9;
console.log(`load level pro`);
            this.loadLevel(this.currentLevelIndex - 1);
            this.isPlaying = true;
            this.lastTime = performance.now();
        });

        document.getElementById('start-expert-btn').addEventListener('click', () => {
            document.getElementById('start-modal').classList.add('hidden');
            this.currentLevelIndex = 19;
console.log(`load level expert`);
            this.loadLevel(this.currentLevelIndex - 1);
            this.isPlaying = true;
            this.lastTime = performance.now();
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

        const levels = [
            // Level 1: Basic drop - Caja grande
            { bx: cx - 200, by: cy - 200, tx: cx - 200, ty: this.height - 150, tw: 150, th: 150, type: 'box', obstacles: [] },
            // Level 2: Offset (Needs a slope) - Caja chica
            { bx: cx - 300, by: cy - 200, tx: cx + 100, ty: this.height - 120, tw: 80, th: 100, type: 'box', obstacles: [] },
            // Level 3: Wall block in the middle
            {
                bx: cx - 300, by: cy - 100, tx: cx + 250, ty: this.height - 150, tw: 120, th: 120, type: 'box', obstacles: [
                    [{ x: cx, y: cy }, { x: cx, y: this.height }] // Muro vertical
                ]
            },
            // Level 4: Funnel (Embudo) structure
            {
                bx: cx - 300, by: 100, tx: cx - 50, ty: this.height - 100, tw: 100, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 200, y: cy }, { x: cx - 70, y: cy + 150 }],
                    [{ x: cx + 200, y: cy }, { x: cx + 70, y: cy + 150 }]
                ]
            },
            // Level 5: Static Tunnel bounds
            {
                bx: cx - 300, by: 100, tx: cx + 300, ty: this.height - 150, tw: 100, th: 100, type: 'box', obstacles: [
                    [{ x: cx - 150, y: cy - 50 }, { x: cx + 150, y: cy - 50 }], // Techo tunel
                    [{ x: cx - 150, y: cy + 50 }, { x: cx + 150, y: cy + 50 }]  // Piso tunel
                ]
            },
            // Level 6: Floating zone with platform underneath
            {
                bx: cx - 350, by: 200, tx: cx + 200, ty: cy, tw: 100, th: 100, type: 'zone', obstacles: [
                    [{ x: cx + 200, y: cy + 100 }, { x: cx + 300, y: cy + 100 }] // Plataforma bajo la zona
                ]
            },
            // Level 7: Multiple random walls
            {
                bx: cx + 200, by: 100, tx: cx - 300, ty: this.height - 120, tw: 120, th: 120, type: 'box', obstacles: [
                    [{ x: cx, y: 100 }, { x: cx, y: 300 }],
                    [{ x: cx - 150, y: 300 }, { x: cx - 150, y: this.height }]
                ]
            },
            // Level 8: Zig Zag setup
            {
                bx: cx, by: 100, tx: cx, ty: this.height - 120, tw: 150, th: 150, type: 'box', obstacles: [
                    [{ x: cx - 200, y: 250 }, { x: cx + 100, y: 350 }],
                    [{ x: cx + 200, y: 450 }, { x: cx - 100, y: 550 }]
                ]
            },
            // Level 9: Narrow gap dropping
            {
                bx: cx - 200, by: 100, tx: cx + 250, ty: this.height - 150, tw: 100, th: 150, type: 'box', obstacles: [
                    [{ x: cx, y: 0 }, { x: cx, y: cy - 50 }],
                    [{ x: cx, y: cy + 50 }, { x: cx, y: this.height }]
                ]
            },
            // Level 10: Enclosed box start
            {
                bx: cx - 400, by: 50, tx: cx + 350, ty: this.height - 100, tw: 80, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 200, y: cy }, { x: cx - 100, y: cy }],
                    [{ x: cx + 100, y: cy }, { x: cx + 200, y: cy }],
                    [{ x: cx - 50, y: cy + 150 }, { x: cx + 50, y: cy + 150 }]
                ]
            },
            // --- EXPERT MODE LEVELS ---
            // Level 11: Tight gap floating target
            {
                bx: cx - 300, by: 50, tx: cx + 250, ty: cy - 100, tw: 80, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 100, y: 0 }, { x: cx - 100, y: cy + 50 }],
                    [{ x: cx + 50, y: this.height }, { x: cx + 50, y: cy - 50 }]
                ]
            },
            // Level 12: Suspended container, tiny gap
            {
                bx: cx, by: 50, tx: cx, ty: cy + 150, tw: 60, th: 100, type: 'box', obstacles: [
                    [{ x: cx - 100, y: 150 }, { x: cx - 50, y: 250 }],
                    [{ x: cx + 100, y: 150 }, { x: cx + 50, y: 250 }],
                    [{ x: cx - 200, y: 400 }, { x: cx + 200, y: 400 }]
                ]
            },
            // Level 13: Multiple diagonal ramps
            {
                bx: cx - 350, by: 50, tx: cx + 300, ty: this.height - 150, tw: 100, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 250, y: 200 }, { x: cx, y: 300 }],
                    [{ x: cx + 250, y: 350 }, { x: cx - 50, y: 450 }],
                    [{ x: cx - 250, y: 600 }, { x: cx + 150, y: 550 }]
                ]
            },
            // Level 14: Vertical Plinko
            {
                bx: cx, by: 50, tx: cx, ty: this.height - 100, tw: 120, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 100, y: 200 }, { x: cx + 50, y: 220 }],
                    [{ x: cx + 100, y: 400 }, { x: cx - 50, y: 420 }],
                    [{ x: cx - 100, y: 600 }, { x: cx + 50, y: 620 }]
                ]
            },
            // Level 15: Target behind a huge wall
            {
                bx: cx - 400, by: 50, tx: cx + 200, ty: this.height - 150, tw: 80, th: 80, type: 'box', obstacles: [
                    [{ x: cx, y: 0 }, { x: cx, y: this.height - 200 }]
                ]
            },
            // Level 16: Two thin towers and a small target
            {
                bx: cx - 300, by: 50, tx: cx + 300, ty: this.height - 150, tw: 60, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 100, y: 300 }, { x: cx - 100, y: this.height }],
                    [{ x: cx + 100, y: 200 }, { x: cx + 100, y: this.height }]
                ]
            },
            // Level 17: U-Turn required
            {
                bx: cx - 200, by: 200, tx: cx - 300, ty: 50, tw: 100, th: 80, type: 'box', obstacles: [
                    [{ x: cx - 100, y: 0 }, { x: cx - 100, y: 400 }],
                    [{ x: cx - 400, y: 400 }, { x: cx - 100, y: 400 }],
                    [{ x: cx - 400, y: 0 }, { x: cx - 400, y: 200 }]
                ]
            },
            // Level 18: Zone target suspended mid-air
            {
                bx: cx - 400, by: 100, tx: cx + 200, ty: 200, tw: 100, th: 100, type: 'zone', obstacles: [
                    [{ x: cx, y: 0 }, { x: cx, y: 400 }],
                    [{ x: cx + 100, y: 400 }, { x: cx + 400, y: 400 }]
                ]
            },
            // Level 19: Extremely narrow shaft
            {
                bx: cx, by: 50, tx: cx, ty: this.height - 150, tw: 80, th: 100, type: 'box', obstacles: [
                    [{ x: cx - 50, y: 200 }, { x: cx - 50, y: this.height - 300 }],
                    [{ x: cx + 50, y: 200 }, { x: cx + 50, y: this.height - 300 }]
                ]
            },
            // Level 20: The Ultimate Challenge
            {
                bx: cx - 400, by: 50, tx: cx + 300, ty: cy - 100, tw: 70, th: 70, type: 'box', obstacles: [
                    [{ x: cx - 200, y: 0 }, { x: cx - 200, y: cy + 100 }],
                    [{ x: cx, y: this.height }, { x: cx, y: cy - 100 }],
                    [{ x: cx + 200, y: 0 }, { x: cx + 200, y: cy + 100 }]
                ]
            }
        ];

        // Ensure we don't go out of bounds
        let levelData = levels[Math.min(index, levels.length -1)];
console.log(`DATA: `, levelData);
console.log(`LEVEL: `, levels);

        this.ball = new Ball(levelData.bx, levelData.by, 20);
        this.target = new Target(levelData.tx, levelData.ty, levelData.tw, levelData.th, levelData.type);

        // Agregar algunos estáticos predefinidos si los hubiera (obstáculos)
        if (levelData.obstacles) {
            for (let obs of levelData.obstacles) {
                let shape = new RigidShape(obs);
                this.rigidBodies.push(shape); // Already marked isStatic = true in constructor
            }
        }

        this.levelCompleted = false;
    }

    resize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
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
        this.canvas.addEventListener('touchend', this.stopDrawingTouch.bind(this));
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

        // Validar tamaño mínimo para convetirse en objeto físico
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

        let body = new RigidShape(simplified);
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

            // Colisión muy básica con el suelo (borde inferior del canvas)
            if (body.maxY > this.height) {
                // Resolver colisión empujando hacia arriba
                let overlap = body.maxY - this.height;
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

            // Ball Floor Collision
            if (this.ball.pos.y + this.ball.radius > this.height) {
                this.ball.pos.y = this.height - this.ball.radius;
                // Fake restitution in verlet
                let velY = this.ball.pos.y - this.ball.oldPos.y;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.y = this.ball.pos.y + velY * this.physicsConfig.floorRestitution;
                this.ball.oldPos.x = this.ball.pos.x - velX * this.physicsConfig.friction;
            }

            // Ball Wall collisions (Sides + TOP)
            if (this.ball.pos.x - this.ball.radius < 0) {
                this.ball.pos.x = this.ball.radius;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.x = this.ball.pos.x + velX * 0.5;
            } else if (this.ball.pos.x + this.ball.radius > this.width) {
                this.ball.pos.x = this.width - this.ball.radius;
                let velX = this.ball.pos.x - this.ball.oldPos.x;
                this.ball.oldPos.x = this.ball.pos.x + velX * 0.5;
            }
            if (this.ball.pos.y - this.ball.radius < 0) {
                this.ball.pos.y = this.ball.radius;
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
        } else if (this.ball) {
            // Fall condition: ball falls off screen without hitting target
            if (this.ball.pos.y > this.height + 100) {
                this.levelCompleted = true;
                this.showFeedback();
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
	const nivelActual = this.currentLevelIndex -10
        title.innerText = `¡Nivel ${nivelActual} EXPERTO Superado!`;
} else {
	const nivelActual = this.currentLevelIndex
        title.innerText = `¡Nivel ${nivelActual} PRO Superado!`;
}


        rewardModal.classList.remove('hidden');

        const nextBtn = document.getElementById('next-btn');
        nextBtn.onclick = () => {
            rewardModal.classList.add('hidden');
            this.currentLevelIndex++;
            // Wrap around if finishing expert mode or handle win screen, optionally
            if (this.currentLevelIndex > 20) {
console.log(FIN);
                this.currentLevelIndex = 0; // restart or handle final win screen later
            }
            this.loadLevel(this.currentLevelIndex - 1);
        };
    }

    // -- RENDERIZADO VISUAL --

    render() {
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Estilos Naïve Typography / Drawing
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this.brushStyle.width;

        // Render Target
        if (this.target) this.target.render(this.ctx);

        // Trazos ya completados (Objetos físicos)
        this.ctx.strokeStyle = this.brushStyle.color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';

        for (let body of this.rigidBodies) {
            body.render(this.ctx, this.brushStyle);
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
