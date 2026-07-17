import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  targetAlpha: number;
}

export function Atmosphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false });

  // Scroll parallax for different background layers
  const { scrollY } = useScroll();
  const yRings = useTransform(scrollY, [0, 1000], [0, -120]);
  const yParticles = useTransform(scrollY, [0, 1000], [0, -60]);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const particleCount = 65;
    const connectionDist = 110;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          radius: Math.random() * 1.5 + 0.8,
          alpha: Math.random() * 0.5 + 0.1,
          targetAlpha: Math.random() * 0.6 + 0.2,
        });
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 0.8;
      // Node color adapts to theme so particles stay visible in light mode.
      const light = document.documentElement.getAttribute("data-theme") === "light";
      const nodeRGB = light ? "15, 23, 42" : "255, 255, 255";
      const nodeMul = light ? 0.45 : 0.75;

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < connectionDist) {
            const alpha = (1 - dist / connectionDist) * 0.12 * p1.alpha * p2.alpha;
            ctx.strokeStyle = `rgba(52, 211, 153, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }

        // Draw connections to mouse if active
        if (mouse.active) {
          const dx = p1.x - mouse.x;
          const dy = p1.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDist * 1.5) {
            const alpha = (1 - dist / (connectionDist * 1.5)) * 0.18 * p1.alpha;
            ctx.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      // Draw individual particle nodes
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Smoothly fade alpha to target
        p.alpha += (p.targetAlpha - p.alpha) * 0.02;
        if (Math.abs(p.alpha - p.targetAlpha) < 0.05) {
          p.targetAlpha = Math.random() * 0.7 + 0.1;
        }

        // Apply velocities
        p.x += p.vx;
        p.y += p.vy;

        // Bounce or wrap bounds
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        ctx.fillStyle = `rgba(${nodeRGB}, ${p.alpha * nodeMul})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Subtle outer node halo for a few larger particles
        if (i % 6 === 0) {
          ctx.fillStyle = `rgba(52, 211, 153, ${p.alpha * 0.15})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const animate = () => {
      drawParticles();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [reducedMotion, mouse]);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    setMouse({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  };

  const handlePointerLeave = () => {
    setMouse(prev => ({ ...prev, active: false }));
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "auto", // Captures pointer movements for interactive glow
        overflow: "hidden",
        backgroundColor: "var(--bg)",
      }}
    >
      {/* 1. Animated Canvas Particles Layer */}
      {!reducedMotion && (
        <motion.canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset: 0,
            y: yParticles,
            pointerEvents: "none",
          }}
        />
      )}

      {/* 2. Rotating Concentric Rings (SVG Orbits) */}
      <motion.div
        style={{
          position: "absolute",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "900px",
          height: "900px",
          pointerEvents: "none",
          y: yRings,
          opacity: 0.18,
        }}
      >
        <svg
          viewBox="0 0 400 400"
          width="100%"
          height="100%"
          style={{ overflow: "visible" }}
        >
          {/* Inner orbit */}
          <circle
            cx="200"
            cy="200"
            r="100"
            fill="none"
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="0.8"
            strokeDasharray="4 8"
            className="spin-cw"
          />
          {/* Middle orbit */}
          <circle
            cx="200"
            cy="200"
            r="160"
            fill="none"
            stroke="rgba(52, 211, 153, 0.15)"
            strokeWidth="1"
            strokeDasharray="15 15"
            className="spin-ccw"
          />
          {/* Outer orbit */}
          <circle
            cx="200"
            cy="200"
            r="230"
            fill="none"
            stroke="rgba(125, 211, 252, 0.12)"
            strokeWidth="0.8"
            strokeDasharray="50 10 10 10"
            className="spin-cw"
          />
          {/* Tiny node trackers spinning on orbit paths */}
          <circle
            cx="200"
            cy="100"
            r="3"
            fill="#34d399"
            className="spin-cw"
            style={{ transformOrigin: "200px 200px", filter: "drop-shadow(0 0 6px #34d399)" }}
          />
          <circle
            cx="360"
            cy="200"
            r="2.5"
            fill="#7dd3fc"
            className="spin-ccw"
            style={{ transformOrigin: "200px 200px", filter: "drop-shadow(0 0 6px #7dd3fc)" }}
          />
        </svg>
      </motion.div>

      {/* 3. Static Grid Layer */}
      <div className="bg-grid" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />

      {/* 4. Fine Noise Overlay */}
      <div className="bg-noise" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
    </div>
  );
}
