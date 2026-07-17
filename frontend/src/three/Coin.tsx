import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Float } from "@react-three/drei";
import * as THREE from "three";

function CoinMesh() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.rotation.y += dt * 0.7;
    const s = typeof window !== "undefined" ? window.scrollY : 0;
    ref.current.rotation.x = 0.32 + Math.sin(s * 0.0012) * 0.18;
  });

  return (
    <Float speed={1.2} rotationIntensity={0} floatIntensity={0.6}>
      <group ref={ref} rotation={[0.32, 0, 0]} scale={1.15}>
        {/* coin body — flat faces point along +/-Z */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.3, 1.3, 0.16, 80]} />
          <meshStandardMaterial color="#2775CA" metalness={0.65} roughness={0.25} />
        </mesh>
        {/* outer rim */}
        <mesh>
          <torusGeometry args={[1.3, 0.07, 20, 80]} />
          <meshStandardMaterial color="#5aa0e6" metalness={0.85} roughness={0.18} />
        </mesh>
        {/* inner ring on front face */}
        <mesh position={[0, 0, 0.085]}>
          <torusGeometry args={[1.0, 0.04, 16, 80]} />
          <meshStandardMaterial color="#9cc8f2" metalness={0.85} roughness={0.18} />
        </mesh>
        <Text position={[0, 0.12, 0.12]} fontSize={0.95} color="#ffffff" anchorX="center" anchorY="middle">
          $
        </Text>
        <Text
          position={[0, -0.55, 0.12]}
          fontSize={0.2}
          color="#dbeaff"
          letterSpacing={0.18}
          anchorX="center"
          anchorY="middle"
        >
          USDC
        </Text>
      </group>
    </Float>
  );
}

export function Coin() {
  return (
    <div className="coin-wrap">
      <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <pointLight position={[-4, -2, 2]} intensity={0.8} color="#2bd9a6" />
        <CoinMesh />
      </Canvas>
    </div>
  );
}
