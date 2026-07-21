import { el } from '../core/domRefs.js';

let particleAnimId = null;
let particles = [];

export function runParticles(type) {
  const canvas = el.particleCanvas;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const color = type === 'win' ? ['#5DE8A0', '#4BBEFF', '#FFD94A'] : ['#FF5C5C', '#A78BFA', '#1A1A2E'];
  particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    vx: (Math.random() - 0.5) * 3,
    vy: Math.random() * 3 + 1,
    r: Math.random() * 6 + 2,
    color: color[Math.floor(Math.random() * color.length)],
    opacity: 1,
    rot: Math.random() * 360,
    rSpeed: (Math.random() - 0.5) * 4,
  }));

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.rot += p.rSpeed;
      if (p.y > canvas.height + 10) { p.y = -10; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
      ctx.restore();
    });
    particleAnimId = requestAnimationFrame(loop);
  }
  if (particleAnimId) cancelAnimationFrame(particleAnimId);
  loop();
  setTimeout(stopParticles, 4000);
}

export function stopParticles() {
  if (particleAnimId) { cancelAnimationFrame(particleAnimId); particleAnimId = null; }
  const ctx = el.particleCanvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, el.particleCanvas.width, el.particleCanvas.height);
  particles = [];
}
