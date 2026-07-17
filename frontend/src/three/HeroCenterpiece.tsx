import { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Icosahedron, Line } from "@react-three/drei";
import * as THREE from "three";

/* A self-contained "protocol network" orb: a rotating wireframe icosphere with
   emissive nodes distributed over its surface, a spiral thread linking them, and
   gentle pointer parallax. No external textures — the bright mass sits on the
   periphery so the hero headline stays readable over the (dark) center. */

const R = 1.55;

// Fibonacci-sphere node positions — evenly scattered points on the shell.
function fibSphere(n: number, r: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - y * y);
    const th = golden * i;
    pts.push([Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r]);
  }
  return pts;
}

function Node({ position, phase }: { position: [number, number, number]; phase: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + phase);
    if (ref.current) {
      const s = 0.9 + pulse * 0.6;
      ref.current.scale.setScalar(s);
    }
    if (mat.current) mat.current.emissiveIntensity = 1.2 + pulse * 2.2;
  });
  const color = phase % 2 > 1 ? "#7dd3fc" : "#34d399";
  return (
    <mesh ref={ref} position={position}>
      <sphereGeometry args={[0.045, 16, 16]} />
      <meshStandardMaterial
        ref={mat}
        color={color}
        emissive={color}
        emissiveIntensity={2}
        toneMapped={false}
      />
    </mesh>
  );
}

function Orb() {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });

  const nodes = useMemo(() => fibSphere(30, R), []);
  const spiral = useMemo(() => fibSphere(120, R * 1.002), []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.12;
    // ease the whole assembly toward the cursor for a parallax tilt
    g.rotation.x += (pointer.current.y * 0.22 - g.rotation.x) * 0.04;
    g.rotation.z += (-pointer.current.x * 0.14 - g.rotation.z) * 0.04;
  });

  return (
    <group ref={group}>
      {/* structural wireframe shells */}
      <Icosahedron args={[R, 1]}>
        <meshBasicMaterial color="#34d399" wireframe transparent opacity={0.16} />
      </Icosahedron>
      <Icosahedron args={[R * 1.28, 0]}>
        <meshBasicMaterial color="#7dd3fc" wireframe transparent opacity={0.08} />
      </Icosahedron>

      {/* thread linking the scattered nodes into a single spiral filament */}
      <Line points={spiral} color="#34d399" lineWidth={0.7} transparent opacity={0.22} />

      {/* emissive network nodes */}
      {nodes.map((p, i) => (
        <Node key={i} position={p} phase={i * 1.7} />
      ))}
    </group>
  );
}

export function HeroCenterpiece() {
  return (
    <Canvas
      className="hero-orb"
      camera={{ position: [0, 0, 5.2], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ alpha: true, antialias: true }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[3, 2, 4]} intensity={1.4} color="#34d399" />
      <pointLight position={[-4, -2, 2]} intensity={0.8} color="#7dd3fc" />
      <Orb />
    </Canvas>
  );
}
