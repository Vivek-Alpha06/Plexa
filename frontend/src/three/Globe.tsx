import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { REGIONS, type Region } from "../data/regions";

// Realistic earth textures from the three.js example assets (reliable + CORS-enabled).
const TEX = {
  day: "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
  normal: "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
  specular: "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
};

function latLngToVec3(lat: number, lng: number, r: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

function Marker({
  region,
  globe,
  onHover,
}: {
  region: Region;
  globe: React.MutableRefObject<THREE.Mesh | null>;
  onHover: (id: string | null) => void;
}) {
  const pos = latLngToVec3(region.lat, region.lng, 1.46);
  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.022, 16, 16]} />
        <meshBasicMaterial color="#ffd24a" />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color="#2bd9a6" transparent opacity={0.35} />
      </mesh>
      <Html
        center
        distanceFactor={7}
        occlude={globe.current ? [globe as React.MutableRefObject<THREE.Object3D>] : undefined}
      >
        <div
          className="globe-label"
          onPointerEnter={() => onHover(region.id)}
          onPointerLeave={() => onHover(null)}
        >
          <b>{region.term}</b>
          <span>{region.country}</span>
        </div>
      </Html>
    </group>
  );
}

function Earth({ onHover }: { onHover: (id: string | null) => void }) {
  const group = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Mesh>(null);
  const [day, normal, specular] = useTexture([TEX.day, TEX.normal, TEX.specular]);

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.06;
  });

  return (
    <group ref={group} rotation={[0.4, 0, 0.12]}>
      <mesh ref={globe}>
        <sphereGeometry args={[1.4, 128, 128]} />
        <meshPhongMaterial
          map={day}
          normalMap={normal}
          specularMap={specular}
          specular={"#5a738c"}
          shininess={15}
        />
      </mesh>
      {REGIONS.map((r) => (
        <Marker key={r.id} region={r} globe={globe} onHover={onHover} />
      ))}
    </group>
  );
}

function Scene({ onHover }: { onHover: (id: string | null) => void }) {
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[5, 3, 5]} intensity={1.5} color="#fff7e8" />
      <directionalLight position={[-5, -2, -3]} intensity={0.35} color="#2bd9a6" />

      {/* atmosphere rim glow */}
      <mesh>
        <sphereGeometry args={[1.56, 64, 64]} />
        <meshBasicMaterial color="#5bb8ff" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>

      <Suspense fallback={null}>
        <Earth onHover={onHover} />
      </Suspense>
    </>
  );
}

export function Globe() {
  const [hover, setHover] = useState<string | null>(null);
  const active = REGIONS.find((r) => r.id === hover);
  return (
    <div className="globe-wrap">
      <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 2]}>
        <Scene onHover={setHover} />
      </Canvas>
      <div className={`globe-tip ${active ? "show" : ""}`}>
        {active && (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}>
              <span className="pill green">{active.term}</span>
              <span className="faint">{active.country}</span>
            </div>
            <div className="stat" style={{ fontSize: 22 }}>
              {active.stat}
            </div>
            <div className="faint">{active.statLabel}</div>
          </>
        )}
      </div>
    </div>
  );
}
