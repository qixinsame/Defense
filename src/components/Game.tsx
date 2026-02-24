import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crosshair, Play, Pause } from 'lucide-react';

// --- Types & Constants ---

type Language = 'ZH' | 'EN';
type GameState = 'MENU' | 'PLAYING' | 'WAVE_COMPLETE' | 'GAME_OVER' | 'VICTORY';

interface Point {
  x: number;
  y: number;
}

interface Entity extends Point {
  id: number;
  vx: number;
  vy: number;
  color: string;
  dead: boolean;
}

interface Enemy extends Entity {
  targetIndex: number; // 0-5 for cities, 6-8 for towers
  speed: number;
  trail: Point[];
}

interface Interceptor extends Entity {
  target: Point;
  speed: number;
  trail: Point[];
  originTowerIndex: number;
}

interface Explosion extends Point {
  id: number;
  radius: number;
  maxRadius: number;
  growthRate: number;
  life: number; // 0 to 1
  color: string;
}

interface Particle extends Entity {
  life: number;
  maxLife: number;
  size: number;
}

interface FloatingText extends Point {
  id: number;
  text: string;
  life: number;
  color: string;
  vy: number;
}

interface Tower {
  x: number;
  y: number;
  ammo: number;
  maxAmmo: number;
  alive: boolean;
}

interface City {
  x: number;
  y: number;
  alive: boolean;
}

const TEXTS = {
  ZH: {
    title: "齐欣地球卫士",
    start: "开始任务",
    score: "得分",
    wave: "波次",
    ammo: "弹药",
    gameOver: "防线崩溃",
    victory: "防御成功",
    restart: "重新部署",
    nextWave: "下一波次",
    waveClear: "波次完成",
    bonus: "弹药奖励",
    total: "总分",
    instruction: "点击屏幕发射拦截导弹。利用爆炸连锁反应摧毁敌人。保护世界地标。",
    endless: "无尽模式",
    citiesLost: "地标全灭",
    finalScore: "最终得分",
  },
  EN: {
    title: "Qi Xin Earth Guardian",
    start: "START MISSION",
    score: "SCORE",
    wave: "WAVE",
    ammo: "AMMO",
    gameOver: "DEFENSE BREACHED",
    victory: "MISSION ACCOMPLISHED",
    restart: "REDEPLOY",
    nextWave: "NEXT WAVE",
    waveClear: "WAVE CLEARED",
    bonus: "AMMO BONUS",
    total: "TOTAL",
    instruction: "Tap to intercept. Use explosion chains. Protect the landmarks.",
    endless: "ENDLESS MODE",
    citiesLost: "ALL LANDMARKS LOST",
    finalScore: "FINAL SCORE",
  }
};

const COLORS = {
  bg: '#050510',
  primary: '#00f3ff', // Cyan
  secondary: '#ff00ff', // Magenta
  danger: '#ff2a2a', // Red
  warning: '#ffaa00', // Orange
  success: '#00ff66', // Green
  text: '#ffffff',
  grid: 'rgba(0, 243, 255, 0.1)',
};

// --- Helper Functions ---

const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;
const distance = (p1: Point, p2: Point) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const drawMissile = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, color: string, scale: number = 1) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2); // Adjust so 0 is up/forward
    ctx.scale(scale, scale);

    // Body
    ctx.fillStyle = '#eee';
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Nose cone
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.quadraticCurveTo(0, -15, 4, -5);
    ctx.fill();

    // Fins
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4, 5); ctx.lineTo(-8, 10); ctx.lineTo(-4, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, 5); ctx.lineTo(8, 10); ctx.lineTo(4, 8);
    ctx.fill();

    // Window
    ctx.fillStyle = '#0ff';
    ctx.beginPath();
    ctx.arc(0, -2, 2, 0, Math.PI * 2);
    ctx.fill();

    // Thruster flame
    ctx.fillStyle = '#fa0';
    ctx.beginPath();
    ctx.moveTo(-2, 10);
    ctx.lineTo(0, 15 + Math.random() * 5);
    ctx.lineTo(2, 10);
    ctx.fill();

    ctx.restore();
};

const drawLandmark = (ctx: CanvasRenderingContext2D, x: number, y: number, index: number, alive: boolean, color: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = alive ? color : '#333';
    ctx.strokeStyle = alive ? color : '#333';
    ctx.lineWidth = 2;
    
    if (!alive) {
        // Ruins
        ctx.fillRect(-15, -5, 30, 5);
        ctx.restore();
        return;
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    switch (index) {
        case 0: // Statue of Liberty (New York)
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(10, 0); // Base
            ctx.lineTo(5, -25); ctx.lineTo(-5, -25); // Body
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(5, -20); ctx.lineTo(12, -35); // Arm
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(12, -37, 2, 0, Math.PI * 2); // Torch
            ctx.fill();
            ctx.beginPath(); // Crown spikes
            ctx.moveTo(-3, -25); ctx.lineTo(-5, -30);
            ctx.moveTo(0, -25); ctx.lineTo(0, -32);
            ctx.moveTo(3, -25); ctx.lineTo(5, -30);
            ctx.stroke();
            break;
        case 1: // Eiffel Tower (Paris)
            ctx.beginPath();
            ctx.moveTo(-12, 0); ctx.lineTo(0, -40); ctx.lineTo(12, 0); // A-frame
            ctx.moveTo(-8, -12); ctx.lineTo(8, -12); // Platform 1
            ctx.moveTo(-4, -25); ctx.lineTo(4, -25); // Platform 2
            ctx.stroke();
            break;
        case 2: // Oriental Pearl (Shanghai)
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(-2, -10); // Left leg
            ctx.moveTo(10, 0); ctx.lineTo(2, -10); // Right leg
            ctx.moveTo(0, 0); ctx.lineTo(0, -10); // Center leg
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -15, 6, 0, Math.PI * 2); // Lower sphere
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -21); ctx.lineTo(0, -30); // Shaft
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(0, -33, 4, 0, Math.PI * 2); // Upper sphere
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -37); ctx.lineTo(0, -45); // Antenna
            ctx.stroke();
            break;
        case 3: // Canton Tower (Guangzhou)
            ctx.beginPath();
            ctx.moveTo(-8, 0); 
            ctx.quadraticCurveTo(-2, -20, -8, -45); // Left curve
            ctx.moveTo(8, 0); 
            ctx.quadraticCurveTo(2, -20, 8, -45); // Right curve
            ctx.stroke();
            // Lattice
            ctx.beginPath();
            ctx.moveTo(-6, -10); ctx.lineTo(6, -15);
            ctx.moveTo(-4, -25); ctx.lineTo(4, -30);
            ctx.moveTo(6, -10); ctx.lineTo(-6, -15);
            ctx.moveTo(4, -25); ctx.lineTo(-4, -30);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, -45); ctx.lineTo(0, -50); // Antenna
            ctx.stroke();
            break;
        case 4: // Space Needle (Seattle)
            ctx.beginPath();
            ctx.moveTo(-8, 0); ctx.lineTo(-2, -30); // Left leg
            ctx.moveTo(8, 0); ctx.lineTo(2, -30); // Right leg
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(0, -32, 10, 3, 0, 0, Math.PI * 2); // Saucer
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, -32); ctx.lineTo(0, -45); // Needle
            ctx.stroke();
            break;
        case 5: // Bank of China (Hong Kong)
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(-10, -40); // Left
            ctx.lineTo(0, -50); // Top
            ctx.lineTo(10, -30); // Right slope top
            ctx.lineTo(10, 0); // Right
            ctx.lineTo(-10, 0); // Bottom
            ctx.stroke();
            // X patterns
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(10, -30);
            ctx.moveTo(10, -10); ctx.lineTo(-10, -30);
            ctx.moveTo(-10, -30); ctx.lineTo(0, -40);
            ctx.stroke();
            break;
        default:
            ctx.fillRect(-10, -20, 20, 20);
    }
    
    ctx.shadowBlur = 0;
    ctx.restore();
};

// --- Main Component ---

export default function TinaNovaDefense() {
  // --- React State for UI ---
  const [lang, setLang] = useState<Language>('ZH');
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [score, setScore] = useState(0);
  const [wave, setWave] = useState(1);
  const [towers, setTowers] = useState<Tower[]>([
    { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
    { x: 0, y: 0, ammo: 40, maxAmmo: 40, alive: true },
    { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
  ]);
  const [cities, setCities] = useState<City[]>(Array(6).fill({ x: 0, y: 0, alive: true }));
  const [shake, setShake] = useState(0);
  const [waveBonus, setWaveBonus] = useState(0);

  // --- Mutable Game State (Refs) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef(0);
  const waveRef = useRef(1);
  const gameStateRef = useRef<GameState>('MENU'); // Ref for loop logic
  
  // Game Entities Refs
  const enemiesRef = useRef<Enemy[]>([]);
  const interceptorsRef = useRef<Interceptor[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  // Game Objects Refs (Synced with State)
  const towersRef = useRef<Tower[]>([
    { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
    { x: 0, y: 0, ammo: 40, maxAmmo: 40, alive: true },
    { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
  ]);
  const citiesRef = useRef<City[]>(Array(6).fill({ x: 0, y: 0, alive: true }));

  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const isWaveClearingRef = useRef(false);
  const isEndlessModeRef = useRef(false);

  // --- Game Loop Logic ---

  const initGame = useCallback(() => {
    setScore(0);
    scoreRef.current = 0;
    setWave(1);
    waveRef.current = 1;
    isEndlessModeRef.current = false;
    
    const initialTowers = [
      { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
      { x: 0, y: 0, ammo: 40, maxAmmo: 40, alive: true },
      { x: 0, y: 0, ammo: 20, maxAmmo: 20, alive: true },
    ];
    setTowers(initialTowers);
    towersRef.current = JSON.parse(JSON.stringify(initialTowers)); // Deep copy

    const initialCities = Array(6).fill({ x: 0, y: 0, alive: true });
    setCities(initialCities);
    citiesRef.current = JSON.parse(JSON.stringify(initialCities));

    enemiesRef.current = [];
    interceptorsRef.current = [];
    explosionsRef.current = [];
    particlesRef.current = [];
    floatingTextsRef.current = [];
    isWaveClearingRef.current = false;
    
    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
    lastTimeRef.current = performance.now();
  }, []);

  const nextWave = useCallback(() => {
    // Repair towers and refill ammo
    const newTowers = towersRef.current.map(t => ({ ...t, alive: true, ammo: t.maxAmmo }));
    towersRef.current = newTowers;
    setTowers(newTowers);

    setWave(w => {
      const newWave = w + 1;
      waveRef.current = newWave;
      return newWave;
    });
    
    isWaveClearingRef.current = false;
    setGameState('PLAYING');
    gameStateRef.current = 'PLAYING';
    lastTimeRef.current = performance.now();
  }, []);

  const triggerShake = (intensity: number = 10) => {
    setShake(intensity);
    if (navigator.vibrate) navigator.vibrate(intensity * 10);
    setTimeout(() => setShake(0), 300);
  };

  const spawnExplosion = (x: number, y: number, color: string = COLORS.primary) => {
    explosionsRef.current.push({
      id: Math.random(),
      x,
      y,
      radius: 0,
      maxRadius: 60,
      growthRate: 4,
      life: 1.0,
      color,
    });
  };

  const spawnParticles = (x: number, y: number, count: number, color: string) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomRange(1, 4);
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 1.0,
        color,
        dead: false,
        size: randomRange(1, 3)
      });
    }
  };

  const addScore = (amount: number, x: number, y: number) => {
    scoreRef.current += amount;
    setScore(scoreRef.current);
    floatingTextsRef.current.push({
      id: Math.random(),
      x,
      y,
      text: `+${amount}`,
      life: 1.0,
      color: COLORS.success,
      vy: -1
    });
  };

  // --- The Heart of the Game: update() ---
  const update = useCallback((time: number) => {
    const dt = time - lastTimeRef.current;
    // Cap dt to prevent huge jumps if tab was inactive
    const safeDt = Math.min(dt, 50); 
    lastTimeRef.current = time;

    const canvas = canvasRef.current;
    if (!canvas) {
        requestRef.current = requestAnimationFrame((t) => update(t));
        return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        requestRef.current = requestAnimationFrame((t) => update(t));
        return;
    }

    const width = canvas.width;
    const height = canvas.height;

    // If paused (WAVE_COMPLETE, VICTORY, MENU, GAME_OVER), we skip game logic updates
    // BUT we still draw the last state so it serves as a background.
    // We might want to animate particles/explosions still? 
    // The user asked for "pause state", implying everything freezes or just no new logic.
    // Let's freeze logic but allow drawing.
    
    const isPaused = gameStateRef.current !== 'PLAYING';

    const groundY = height - 40;
    const towerY = groundY - 20;
    const cityY = groundY - 10;

    // Positions
    const towerPositions = [
        { x: width * 0.1, y: towerY },
        { x: width * 0.5, y: towerY },
        { x: width * 0.9, y: towerY }
    ];
    const cityPositions = [
        width * 0.2, width * 0.3, width * 0.4,
        width * 0.6, width * 0.7, width * 0.8
    ].map(x => ({ x, y: cityY }));

    if (!isPaused) {
        // --- Spawning Enemies ---
        if (!isWaveClearingRef.current) {
            const waveDifficulty = waveRef.current;
            const spawnRate = Math.max(500, 2000 - (waveDifficulty * 150));
            const speedBase = 1 + (waveDifficulty * 0.2);

            if (time - spawnTimerRef.current > spawnRate) {
                spawnTimerRef.current = time;
                
                // Use refs for alive check
                const aliveCities = citiesRef.current.map((c, i) => c.alive ? i : -1).filter(i => i !== -1);
                const aliveTowers = towersRef.current.map((t, i) => t.alive ? i + 6 : -1).filter(i => i !== -1);
                const possibleTargets = [...aliveCities, ...aliveTowers];

                if (possibleTargets.length > 0) {
                    const targetIdx = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
                    let tx = 0, ty = 0;
                    if (targetIdx < 6) {
                        tx = cityPositions[targetIdx].x;
                        ty = cityPositions[targetIdx].y;
                    } else {
                        tx = towerPositions[targetIdx - 6].x;
                        ty = towerPositions[targetIdx - 6].y;
                    }

                    const startX = Math.random() * width;
                    const startY = -20;
                    const angle = Math.atan2(ty - startY, tx - startX);
                    
                    enemiesRef.current.push({
                        id: Math.random(),
                        x: startX,
                        y: startY,
                        vx: Math.cos(angle) * speedBase,
                        vy: Math.sin(angle) * speedBase,
                        targetIndex: targetIdx,
                        speed: speedBase,
                        color: COLORS.danger,
                        dead: false,
                        trail: []
                    });
                }
            }
        }

        // --- Check Wave Clear ---
        const targetScore = waveRef.current * 200;
        if (scoreRef.current >= targetScore && !isWaveClearingRef.current) {
            isWaveClearingRef.current = true;
        }

        if (isWaveClearingRef.current && enemiesRef.current.length === 0 && explosionsRef.current.length === 0) {
            let bonus = 0;
            towersRef.current.forEach(t => {
                if (t.alive) bonus += t.ammo * 5;
            });
            setWaveBonus(bonus);
            addScore(bonus, width/2, height/2);
            
            if (scoreRef.current >= 1000 && gameStateRef.current !== 'VICTORY' && !isEndlessModeRef.current) {
                setTimeout(() => {
                    setGameState('VICTORY');
                    gameStateRef.current = 'VICTORY';
                }, 2000);
            } else {
                setTimeout(() => {
                    setGameState('WAVE_COMPLETE');
                    gameStateRef.current = 'WAVE_COMPLETE';
                }, 2000);
            }
            isWaveClearingRef.current = false;
        }

        // --- Update Entities ---
        
        interceptorsRef.current.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.trail.push({x: p.x, y: p.y});
            if (p.trail.length > 10) p.trail.shift();
            if (distance(p, p.target) < p.speed) {
                p.dead = true;
                spawnExplosion(p.target.x, p.target.y, COLORS.primary);
            }
        });

        explosionsRef.current.forEach(e => {
            if (e.radius < e.maxRadius) {
                e.radius += e.growthRate;
            } else {
                e.life -= 0.05;
            }
        });

        enemiesRef.current.forEach(e => {
            e.x += e.vx;
            e.y += e.vy;
            e.trail.push({x: e.x, y: e.y});
            if (e.trail.length > 15) e.trail.shift();

            for (const exp of explosionsRef.current) {
                if (distance(e, exp) < exp.radius) {
                    e.dead = true;
                    addScore(20, e.x, e.y);
                    spawnParticles(e.x, e.y, 10, COLORS.danger);
                    spawnExplosion(e.x, e.y, COLORS.secondary);
                    break;
                }
            }

            if (!e.dead && e.y >= groundY - 5) {
                e.dead = true;
                spawnExplosion(e.x, e.y, COLORS.warning);
                spawnParticles(e.x, e.y, 15, COLORS.warning);
                triggerShake(5);

                if (e.targetIndex < 6) {
                    const cityIdx = e.targetIndex;
                    if (citiesRef.current[cityIdx].alive) {
                        citiesRef.current[cityIdx].alive = false;
                        setCities([...citiesRef.current]); // Sync to state
                        triggerShake(20);
                        
                        if (citiesRef.current.every(c => !c.alive)) {
                            setGameState('GAME_OVER');
                            gameStateRef.current = 'GAME_OVER';
                        }
                    }
                } else {
                    const towerIdx = e.targetIndex - 6;
                    if (towersRef.current[towerIdx].alive) {
                        towersRef.current[towerIdx].alive = false;
                        towersRef.current[towerIdx].ammo = 0;
                        setTowers([...towersRef.current]); // Sync to state
                        triggerShake(20);
                    }
                }
            }
        });

        particlesRef.current.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 0.02;
            if (p.life <= 0) p.dead = true;
        });

        floatingTextsRef.current.forEach(t => {
            t.y += t.vy;
            t.life -= 0.015;
        });

        // Cleanup Dead Entities
        interceptorsRef.current = interceptorsRef.current.filter(p => !p.dead);
        enemiesRef.current = enemiesRef.current.filter(e => !e.dead);
        explosionsRef.current = explosionsRef.current.filter(e => e.life > 0);
        particlesRef.current = particlesRef.current.filter(p => !p.dead);
        floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);
    }

    // --- Drawing ---
    ctx.fillStyle = '#050510'; // Deep space blue/black
    ctx.fillRect(0, 0, width, height);

    // Draw Stars
    // We can use a pseudo-random generator based on index to keep stars static without storing them
    // Or just store them in a ref once. Let's store them in a ref for performance.
    if (particlesRef.current.length === 0 && gameStateRef.current === 'MENU') {
        // Initialize some stars if not present (hacky place but works for init)
    }
    
    // Draw Static Stars (Procedural)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 100; i++) {
        const x = (Math.sin(i * 123.45) * 0.5 + 0.5) * width;
        const y = (Math.cos(i * 678.90) * 0.5 + 0.5) * (height - 100); // Keep above ground
        const size = (Math.sin(i) + 2) * 0.5;
        const opacity = (Math.sin(time * 0.001 + i) + 1) * 0.4 + 0.1; // Twinkle
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Moon (Top Right)
    ctx.save();
    const moonX = width - 80;
    const moonY = 80;
    const moonRadius = 40;
    ctx.fillStyle = '#feffdf';
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#feffdf';
    ctx.beginPath();
    ctx.arc(moonX, moonY, moonRadius, -Math.PI * 0.5, Math.PI * 0.5, false); // Half circle
    ctx.quadraticCurveTo(moonX - 20, moonY, moonX, moonY - moonRadius); // Inner curve
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x += 50) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y < height; y += 50) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    // Ground
    ctx.fillStyle = '#0a0a20';
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // Cities (Use Ref)
    cityPositions.forEach((pos, i) => {
        drawLandmark(ctx, pos.x, pos.y, i, citiesRef.current[i].alive, COLORS.primary);
    });

    // Towers (Use Ref)
    towerPositions.forEach((pos, i) => {
        const tower = towersRef.current[i];
        if (tower.alive) {
            ctx.fillStyle = tower.ammo > 0 ? COLORS.success : COLORS.danger;
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 20, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(pos.x - 5, pos.y - 30, 10, 20);
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 20, Math.PI, 0);
            ctx.fill();
        }
    });

    // Enemies
    enemiesRef.current.forEach(e => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = e.color;
        
        // Trail
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 2;
        if (e.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(e.trail[0].x, e.trail[0].y);
            for (let i = 1; i < e.trail.length; i++) ctx.lineTo(e.trail[i].x, e.trail[i].y);
            ctx.stroke();
        }

        // Draw Cartoon Missile
        const angle = Math.atan2(e.vy, e.vx);
        drawMissile(ctx, e.x, e.y, angle, e.color, 1.5);
        
        ctx.shadowBlur = 0;
    });

    // Interceptors
    interceptorsRef.current.forEach(e => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.primary;

        // Trail
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 2;
        if (e.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(e.trail[0].x, e.trail[0].y);
            for (let i = 1; i < e.trail.length; i++) ctx.lineTo(e.trail[i].x, e.trail[i].y);
            ctx.stroke();
        }

        // Draw Cartoon Missile
        const angle = Math.atan2(e.vy, e.vx);
        drawMissile(ctx, e.x, e.y, angle, COLORS.primary, 1.0);
        
        // Target Marker
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 1;
        const size = 5;
        ctx.beginPath();
        ctx.moveTo(e.target.x - size, e.target.y - size);
        ctx.lineTo(e.target.x + size, e.target.y + size);
        ctx.moveTo(e.target.x + size, e.target.y - size);
        ctx.lineTo(e.target.x - size, e.target.y + size);
        ctx.stroke();
        ctx.shadowBlur = 0;
    });

    // Explosions
    explosionsRef.current.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = e.life;
        ctx.shadowBlur = 20;
        ctx.shadowColor = e.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
    });

    // Particles
    particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // Floating Text
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    floatingTextsRef.current.forEach(t => {
        ctx.fillStyle = t.color;
        ctx.globalAlpha = t.life;
        ctx.fillText(t.text, t.x, t.y);
        ctx.globalAlpha = 1.0;
    });

    requestRef.current = requestAnimationFrame(() => update(performance.now()));
  }, []); // Empty dependency array! Stable loop.

  // --- Input Handling ---

  const handleInput = (clientX: number, clientY: number) => {
    if (gameStateRef.current !== 'PLAYING') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const towerY = height - 60;
    const towerPositions = [
        { x: width * 0.1, y: towerY, idx: 0 },
        { x: width * 0.5, y: towerY, idx: 1 },
        { x: width * 0.9, y: towerY, idx: 2 }
    ];

    let nearestTower = -1;
    let minDist = Infinity;

    towerPositions.forEach(t => {
        const d = Math.sqrt(Math.pow(t.x - x, 2) + Math.pow(t.y - y, 2));
        // Check Ref for ammo/alive
        if (d < minDist && towersRef.current[t.idx].alive && towersRef.current[t.idx].ammo > 0) {
            minDist = d;
            nearestTower = t.idx;
        }
    });

    if (nearestTower !== -1) {
        const tPos = towerPositions[nearestTower];
        const speed = 15;
        const angle = Math.atan2(y - tPos.y, x - tPos.x);
        
        interceptorsRef.current.push({
            id: Math.random(),
            x: tPos.x,
            y: tPos.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            target: { x, y },
            speed,
            trail: [],
            originTowerIndex: nearestTower,
            color: COLORS.primary,
            dead: false
        });

        // Decrease ammo in Ref AND State
        towersRef.current[nearestTower].ammo--;
        setTowers([...towersRef.current]);
    }
  };

  // --- Effects ---

  useEffect(() => {
    requestRef.current = requestAnimationFrame((t) => update(t));
    return () => cancelAnimationFrame(requestRef.current);
  }, [update]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
        if (canvasRef.current) {
            // We want high DPI support
            const dpr = window.devicePixelRatio || 1;
            // Actually, for this game, let's keep it simple 1:1 pixel mapping for performance/simplicity
            // or just set width/height to window inner.
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
        }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  // --- Render Helpers ---

  const t = TEXTS[lang];

  return (
    <div className={`relative w-full h-screen overflow-hidden bg-black select-none ${shake > 0 ? 'animate-shake' : ''}`}
         style={{ animation: shake > 0 ? `shake ${0.3}s cubic-bezier(.36,.07,.19,.97) both` : 'none' }}>
      
      {/* CSS for Shake */}
      <style>{`
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
        .text-glow { text-shadow: 0 0 10px currentColor; }
      `}</style>

      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onMouseDown={(e) => handleInput(e.clientX, e.clientY)}
        onTouchStart={(e) => {
            // Multitouch support
            for (let i = 0; i < e.changedTouches.length; i++) {
                handleInput(e.changedTouches[i].clientX, e.changedTouches[i].clientY);
            }
        }}
      />

      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start pointer-events-none z-10">
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-cyan-400">
                <Crosshair className="w-5 h-5" />
                <span className="font-mono text-2xl font-bold text-glow">{score} / 1000</span>
            </div>
            <div className="text-xs text-cyan-400/60 font-mono tracking-widest">{t.score}</div>
        </div>

        <div className="flex flex-col items-center">
            <div className="text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-white to-cyan-400 tracking-tighter">
                {t.wave} {wave}
            </div>
        </div>

        <button 
            onClick={() => setLang(l => l === 'ZH' ? 'EN' : 'ZH')}
            className="pointer-events-auto px-3 py-1 border border-cyan-500/30 bg-black/50 text-cyan-400 text-xs font-mono hover:bg-cyan-500/20 transition-colors rounded"
        >
            {lang}
        </button>
        
        {/* Pause Button */}
        <button 
            onClick={() => {
                if (gameState === 'PLAYING') {
                    setGameState('PAUSED');
                    gameStateRef.current = 'PAUSED';
                } else if (gameState === 'PAUSED') {
                    setGameState('PLAYING');
                    gameStateRef.current = 'PLAYING';
                }
            }}
            className="pointer-events-auto ml-2 px-3 py-1 border border-cyan-500/30 bg-black/50 text-cyan-400 hover:bg-cyan-500/20 transition-colors rounded"
        >
            {gameState === 'PAUSED' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </button>
      </div>

      {/* Ammo Panel (Bottom) */}
      <div className="absolute bottom-4 left-0 w-full flex justify-between px-[10%] pointer-events-none z-10">
        {towers.map((tower, i) => (
            <div key={i} className={`flex flex-col items-center gap-2 transition-opacity ${tower.alive ? 'opacity-100' : 'opacity-30 grayscale'}`}>
                <div className="flex gap-0.5">
                    {/* Visual Ammo Matrix - simplified to bars for performance/clarity */}
                    <div className="flex flex-col-reverse gap-0.5 h-16 w-4 bg-gray-900/80 border border-gray-700 rounded overflow-hidden relative">
                        <div 
                            className={`w-full transition-all duration-300 ${tower.ammo === 0 ? 'bg-red-500' : 'bg-cyan-400'}`}
                            style={{ height: `${(tower.ammo / tower.maxAmmo) * 100}%` }}
                        />
                        {/* Grid overlay */}
                        <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzhhYWGMYAEYB8RmROaABADeOQ8CXl/xfgAAAABJRU5ErkJggg==')] opacity-20"></div>
                    </div>
                </div>
                <div className={`text-xs font-mono font-bold ${tower.ammo === 0 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                    {tower.ammo > 0 ? tower.ammo : 'EMPTY'}
                </div>
            </div>
        ))}
      </div>

      {/* Overlays / Menus */}
      <AnimatePresence>
        {gameState === 'MENU' && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden"
            >
                {/* Star Wars Style Background */}
                <div className="absolute inset-0 bg-black">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black"></div>
                    {/* Stars */}
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(white 1px, transparent 1px)', backgroundSize: '50px 50px', opacity: 0.5 }}></div>
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(white 2px, transparent 2px)', backgroundSize: '120px 120px', opacity: 0.3 }}></div>
                </div>

                <div className="relative text-center max-w-md p-8 border border-cyan-500/30 bg-black/80 rounded-2xl shadow-[0_0_50px_rgba(0,243,255,0.2)] backdrop-blur-md">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 mb-2 italic tracking-tighter" style={{ textShadow: '0 0 20px rgba(255, 200, 0, 0.5)' }}>
                        {t.title}
                    </h1>
                    <p className="text-cyan-200/70 mb-8 font-mono text-sm">{t.instruction}</p>
                    <button 
                        onClick={initGame}
                        className="group relative px-8 py-3 bg-cyan-500/10 border border-cyan-400 text-cyan-400 font-bold tracking-widest hover:bg-cyan-400 hover:text-black transition-all duration-300 overflow-hidden"
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <Play className="w-4 h-4" /> {t.start}
                        </span>
                        <div className="absolute inset-0 bg-cyan-400 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    </button>
                </div>
            </motion.div>
        )}

        {gameState === 'PAUSED' && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
            >
                <div className="text-center p-8 border border-cyan-500/30 bg-black/90 rounded-xl">
                    <h2 className="text-4xl font-bold text-cyan-400 mb-8 tracking-widest">{t.pause}</h2>
                    <div className="flex flex-col gap-4">
                        <button 
                            onClick={() => {
                                setGameState('PLAYING');
                                gameStateRef.current = 'PLAYING';
                            }}
                            className="px-8 py-3 bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors rounded"
                        >
                            {t.resume}
                        </button>
                        <button 
                            onClick={() => {
                                setGameState('MENU');
                                gameStateRef.current = 'MENU';
                            }}
                            className="px-8 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-colors font-bold rounded"
                        >
                            {t.quit}
                        </button>
                    </div>
                </div>
            </motion.div>
        )}

        {gameState === 'WAVE_COMPLETE' && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50"
            >
                <div className="text-center p-8 border-y-2 border-cyan-500 bg-black/90 w-full max-w-lg">
                    <h2 className="text-4xl font-bold text-cyan-400 mb-4 tracking-widest">{t.waveClear}</h2>
                    <div className="flex justify-center items-center gap-4 mb-8 text-xl font-mono">
                        <span className="text-gray-400">{t.bonus}:</span>
                        <span className="text-green-400">+{waveBonus}</span>
                    </div>
                    <button 
                        onClick={nextWave}
                        className="px-8 py-3 bg-cyan-500 text-black font-bold hover:bg-cyan-400 transition-colors rounded-full"
                    >
                        {t.nextWave}
                    </button>
                </div>
            </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-red-900/20 backdrop-blur-md z-50"
            >
                <div className="text-center">
                    <h2 className="text-6xl font-black text-red-500 mb-2 tracking-tighter animate-pulse">{t.gameOver}</h2>
                    <p className="text-red-300/80 mb-8 font-mono">{t.citiesLost}</p>
                    <div className="text-2xl font-mono text-white mb-8">
                        {t.finalScore}: <span className="text-cyan-400">{score}</span>
                    </div>
                    <button 
                        onClick={initGame}
                        className="px-8 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-colors font-bold tracking-widest"
                    >
                        {t.restart}
                    </button>
                </div>
            </motion.div>
        )}

        {gameState === 'VICTORY' && (
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex items-center justify-center bg-cyan-900/20 backdrop-blur-md z-50"
            >
                <div className="text-center">
                    <h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-4 tracking-tighter">
                        {t.victory}
                    </h2>
                    <div className="text-2xl font-mono text-white mb-8">
                        {t.finalScore}: <span className="text-cyan-400">{score}</span>
                    </div>
                    <div className="flex gap-4 justify-center">
                        <button 
                            onClick={initGame}
                            className="px-6 py-3 border border-cyan-500 text-cyan-500 hover:bg-cyan-500 hover:text-black transition-colors font-bold"
                        >
                            {t.restart}
                        </button>
                        <button 
                            onClick={() => {
                                setGameState('PLAYING');
                                gameStateRef.current = 'PLAYING';
                                isEndlessModeRef.current = true;
                                // Endless mode logic: just continue
                                nextWave(); // Start next wave immediately
                            }}
                            className="px-6 py-3 bg-cyan-500 text-black hover:bg-cyan-400 transition-colors font-bold"
                        >
                            {t.endless}
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
