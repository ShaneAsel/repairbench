import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Edges, Line, OrbitControls } from "@react-three/drei";
import { Box3, Color, Group, MathUtils, Mesh, Vector3 } from "three";
import { Eye, Focus, Maximize2, RotateCcw, Route, ScanLine } from "lucide-react";
import { componentById } from "../../devices/bedslinger/components";
import { useRepairBenchStore } from "../../store/repairbench-store";
import type { ComponentId } from "../../domain/types";

type PartProps = {
  id: ComponentId;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color: string;
  geometry: React.ReactNode;
  metalness?: number;
  roughness?: number;
};

function SemanticPart({ id, position, rotation, scale, color, geometry, metalness = 0.38, roughness = 0.5 }: PartProps) {
  const viewer = useRepairBenchStore((state) => state.viewer);
  const setSelection = useRepairBenchStore((state) => state.setHumanSelection);
  const setHovered = useRepairBenchStore((state) => state.setHoveredComponent);
  const selected = viewer.humanSelectedComponentId === id;
  const agentHighlighted = viewer.agentHighlightedComponentIds.includes(id);
  const pathHighlighted =
    (viewer.activeMotionPathId === "y_powertrain" && ["y_stepper", "y_drive_pulley", "y_belt", "bed_carriage", "bed"].includes(id)) ||
    (viewer.activeMotionPathId === "y_belt_loop" && ["y_drive_pulley", "y_belt", "y_idler"].includes(id));
  const hovered = viewer.hoveredComponentId === id;
  const isolatedAway = viewer.isolatedComponentId !== null && viewer.isolatedComponentId !== id;
  const outline = selected ? "#4b8dff" : agentHighlighted || pathHighlighted ? (viewer.agentEmphasis === "warning" ? "#f97316" : "#f4b340") : hovered ? "#a8b4c0" : null;
  const base = useMemo(() => new Color(color), [color]);

  return (
    <mesh
      castShadow
      receiveShadow
      position={position}
      rotation={rotation}
      scale={scale}
      onClick={(event) => {
        event.stopPropagation();
        setSelection(id);
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
        setHovered(id);
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
        setHovered(null);
      }}
    >
      {geometry}
      <meshStandardMaterial
        color={base}
        metalness={metalness}
        roughness={roughness}
        transparent={isolatedAway}
        opacity={isolatedAway ? 0.12 : 1}
        emissive={outline ?? "#000000"}
        emissiveIntensity={outline ? (selected ? 0.17 : 0.22) : 0}
      />
      {outline && !isolatedAway && <Edges color={outline} threshold={15} lineWidth={selected ? 2.2 : 1.6} />}
    </mesh>
  );
}

const box = (args: [number, number, number]) => <boxGeometry args={args} />;
const cylinder = (args: [number, number, number, number?]) => <cylinderGeometry args={args} />;

function BedAssembly() {
  const ref = useRef<Group>(null);
  const motion = useRepairBenchStore((state) => state.viewer.activeMotionPresetId);
  useFrame(({ clock }, delta) => {
    if (!ref.current) return;
    const target = motion === "y_bed_travel" || motion === "endstop_trigger" ? Math.sin(clock.elapsedTime * 1.25) * (motion === "endstop_trigger" ? 2.6 : 1.9) : 0;
    ref.current.position.z = MathUtils.damp(ref.current.position.z, target, 5, delta);
  });

  return (
    <group ref={ref}>
      <SemanticPart id="bed_carriage" position={[0, 1.03, 0]} color="#606966" geometry={box([4.9, 0.22, 4.8])} />
      <SemanticPart id="bed" position={[0, 1.3, 0]} color="#252b2a" geometry={box([5.3, 0.18, 5.15])} roughness={0.72} />
      <SemanticPart id="bed" position={[0, 1.41, 0]} color="#39403d" geometry={box([4.75, 0.05, 4.6])} roughness={0.82} />
    </group>
  );
}

function Pulley({ id, position }: { id: "y_drive_pulley" | "y_idler"; position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  const motion = useRepairBenchStore((state) => state.viewer.activeMotionPresetId);
  useFrame((_, delta) => {
    if (ref.current && motion === "y_pulley_rotation") ref.current.rotation.z += delta * 3.5;
  });
  return (
    <group ref={ref}>
      <SemanticPart id={id} position={position} rotation={[Math.PI / 2, 0, 0]} color={id === "y_drive_pulley" ? "#b47c28" : "#78817d"} geometry={cylinder([0.3, 0.3, 0.34, 24])} metalness={0.72} roughness={0.3} />
    </group>
  );
}

const focusPositions: Partial<Record<ComponentId, [number, number, number]>> = {
  bed: [0, 1.3, 0], bed_carriage: [0, 1, 0], y_rail: [1.5, 0.75, 0], y_belt: [0, 0.68, 0],
  y_stepper: [0, 0.8, 3.55], y_drive_pulley: [0, 0.8, 3.12], y_idler: [0, 0.8, -3.2], y_endstop: [-2.25, 0.9, -3],
  toolhead: [0, 4.25, 2], hotend: [0, 3.6, 2], nozzle: [0, 3.18, 2], extruder: [-2.55, 5.25, 2],
  z_stepper: [-3.1, 0.7, 2], z_leadscrew: [-3.1, 3, 2], x_rail: [0, 4.85, 2], gantry: [0, 3, 2], frame: [0, 0, 0],
};

function CameraRig() {
  const { camera } = useThree();
  const focusId = useRepairBenchStore((state) => state.viewer.focusedComponentId);
  const resetNonce = useRepairBenchStore((state) => state.viewer.cameraResetNonce);
  const controls = useRef<any>(null);
  const desiredPosition = useRef(new Vector3(8.8, 7.4, 9.5));
  const desiredTarget = useRef(new Vector3(0, 2.1, 0));
  const animating = useRef(true);

  useEffect(() => {
    if (focusId && focusPositions[focusId]) {
      const target = new Vector3(...focusPositions[focusId]!);
      desiredTarget.current.copy(target);
      desiredPosition.current.copy(target).add(new Vector3(4.2, 3.1, 4.6));
      animating.current = true;
    }
  }, [focusId]);

  useEffect(() => {
    desiredPosition.current.set(8.8, 7.4, 9.5);
    desiredTarget.current.set(0, 2.1, 0);
    animating.current = true;
  }, [resetNonce]);

  useFrame((_, delta) => {
    if (!animating.current || !controls.current) return;
    camera.position.lerp(desiredPosition.current, 1 - Math.exp(-delta * 4.8));
    controls.current.target.lerp(desiredTarget.current, 1 - Math.exp(-delta * 4.8));
    controls.current.update();
    if (camera.position.distanceTo(desiredPosition.current) < 0.02 && controls.current.target.distanceTo(desiredTarget.current) < 0.02) animating.current = false;
  });

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={22} maxPolarAngle={Math.PI * 0.49} target={[0, 2.1, 0]} />;
}

function MotionPath() {
  const path = useRepairBenchStore((state) => state.viewer.activeMotionPathId);
  if (!path) return null;
  const points = path === "y_powertrain"
    ? [[0, 0.9, 3.55], [0, 1.05, 3.05], [0, 1.07, 1.7], [0, 1.65, 0], [0, 1.7, -1.6]]
    : [[0, 1.02, 3.05], [0, 1.02, 0], [0, 1.02, -3.15]];
  return <Line points={points as [number, number, number][]} color="#f3ad3d" lineWidth={2.2} dashed dashScale={4} dashSize={0.22} gapSize={0.14} />;
}

function PrinterScene() {
  const clearSelection = useRepairBenchStore((state) => state.setHumanSelection);
  return (
    <>
      <color attach="background" args={["#e8ece9"]} />
      <fog attach="fog" args={["#e8ece9", 15, 27]} />
      <ambientLight intensity={1.1} />
      <directionalLight position={[6, 11, 8]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-8, 6, -4]} intensity={0.65} color="#b8d0e8" />

      <group onPointerMissed={() => clearSelection(null)}>
        {/* Base and gantry */}
        <SemanticPart id="frame" position={[-3.25, 0.22, 0]} color="#29302e" geometry={box([0.42, 0.44, 7.2])} />
        <SemanticPart id="frame" position={[3.25, 0.22, 0]} color="#29302e" geometry={box([0.42, 0.44, 7.2])} />
        <SemanticPart id="frame" position={[0, 0.22, 3.35]} color="#29302e" geometry={box([6.8, 0.44, 0.5])} />
        <SemanticPart id="frame" position={[0, 0.22, -3.35]} color="#29302e" geometry={box([6.8, 0.44, 0.5])} />
        <SemanticPart id="gantry" position={[-3.05, 3, 2]} color="#343c39" geometry={box([0.48, 5.8, 0.5])} />
        <SemanticPart id="gantry" position={[3.05, 3, 2]} color="#343c39" geometry={box([0.48, 5.8, 0.5])} />
        <SemanticPart id="gantry" position={[0, 5.72, 2]} color="#343c39" geometry={box([6.55, 0.48, 0.5])} />
        <SemanticPart id="x_rail" position={[0, 4.82, 2]} color="#202625" geometry={box([6.15, 0.44, 0.45])} />

        {/* Y system */}
        <SemanticPart id="y_rail" position={[-1.55, 0.7, 0]} color="#8b9490" geometry={box([0.18, 0.18, 6.4])} metalness={0.82} roughness={0.25} />
        <SemanticPart id="y_rail" position={[1.55, 0.7, 0]} color="#8b9490" geometry={box([0.18, 0.18, 6.4])} metalness={0.82} roughness={0.25} />
        <SemanticPart id="y_belt" position={[0, 0.75, 0]} color="#202322" geometry={box([0.12, 0.1, 6.2])} roughness={0.86} />
        <SemanticPart id="y_stepper" position={[0, 0.77, 3.62]} color="#353b39" geometry={box([1.12, 1.08, 0.92])} metalness={0.55} />
        <Pulley id="y_drive_pulley" position={[0, 0.86, 3.05]} />
        <Pulley id="y_idler" position={[0, 0.86, -3.08]} />
        <SemanticPart id="y_endstop" position={[-2.18, 0.85, -3.02]} color="#d99b36" geometry={box([0.48, 0.38, 0.35])} roughness={0.55} />
        <BedAssembly />

        {/* Z and toolhead */}
        <SemanticPart id="z_stepper" position={[-3.05, 0.72, 2]} color="#343a38" geometry={box([1, 0.95, 0.94])} />
        <SemanticPart id="z_leadscrew" position={[-3.05, 3.18, 2]} color="#9aa39f" geometry={cylinder([0.08, 0.08, 4.2, 18])} metalness={0.88} roughness={0.2} />
        <SemanticPart id="toolhead" position={[0, 4.3, 1.68]} color="#444d49" geometry={box([1.25, 1.15, 0.95])} />
        <SemanticPart id="part_cooling_fan" position={[0.43, 4.3, 1.14]} rotation={[Math.PI / 2, 0, 0]} color="#1f2423" geometry={cylinder([0.37, 0.37, 0.16, 24])} roughness={0.8} />
        <SemanticPart id="hotend_fan" position={[-0.32, 4.35, 1.14]} rotation={[Math.PI / 2, 0, 0]} color="#242a28" geometry={cylinder([0.33, 0.33, 0.16, 24])} roughness={0.8} />
        <SemanticPart id="hotend" position={[0, 3.65, 2]} color="#9a6b2e" geometry={cylinder([0.2, 0.3, 0.6, 20])} metalness={0.65} />
        <SemanticPart id="nozzle" position={[0, 3.23, 2]} color="#c88b35" geometry={<coneGeometry args={[0.16, 0.34, 20]} />} metalness={0.72} roughness={0.28} />
        <SemanticPart id="extruder" position={[-2.5, 5.15, 2]} color="#4a5350" geometry={box([1, 0.78, 0.86])} />
        <SemanticPart id="extruder_gear" position={[-2.5, 5.12, 1.53]} rotation={[Math.PI / 2, 0, 0]} color="#b88942" geometry={cylinder([0.2, 0.2, 0.12, 20])} metalness={0.75} />
        <SemanticPart id="bowden_tube" position={[-1.2, 5.2, 1.9]} rotation={[0, 0, Math.PI / 2]} color="#d4ded7" geometry={cylinder([0.055, 0.055, 2.45, 12])} metalness={0.05} roughness={0.4} />
        <SemanticPart id="filament" position={[-1.2, 5.2, 1.9]} rotation={[0, 0, Math.PI / 2]} color="#478ad7" geometry={cylinder([0.026, 0.026, 2.6, 10])} metalness={0} roughness={0.75} />
      </group>

      <MotionPath />
      <ContactShadows position={[0, -0.02, 0]} opacity={0.28} scale={15} blur={2.8} far={10} />
      <gridHelper args={[22, 22, "#c9cfcb", "#d9dedb"]} position={[0, 0, 0]} />
      <CameraRig />
    </>
  );
}

export function PrinterViewer() {
  const viewer = useRepairBenchStore((state) => state.viewer);
  const resetCamera = useRepairBenchStore((state) => state.resetCamera);
  const setIsolation = useRepairBenchStore((state) => state.setIsolation);
  const clearHighlights = useRepairBenchStore((state) => state.clearAgentHighlights);
  const selected = viewer.humanSelectedComponentId ? componentById[viewer.humanSelectedComponentId] : null;
  const hovered = viewer.hoveredComponentId ? componentById[viewer.hoveredComponentId] : null;

  return (
    <div className="viewer-wrap">
      <div className="viewer-topline">
        <div><span className="viewer-kicker">Interactive device model</span><strong>{hovered?.name ?? selected?.name ?? "Y-axis diagnostic workspace"}</strong></div>
        <div className="viewer-toolbar">
          <button title="Reset camera" onClick={resetCamera}><RotateCcw size={15} /></button>
          <button title={viewer.isolatedComponentId ? "Show all components" : "Isolate selected component"} disabled={!selected} onClick={() => setIsolation(viewer.isolatedComponentId ? null : selected!.id)}><ScanLine size={15} /></button>
          <button title="Clear agent emphasis" disabled={viewer.agentHighlightedComponentIds.length === 0} onClick={clearHighlights}><Eye size={15} /></button>
        </div>
      </div>
      <Canvas shadows camera={{ position: [8.8, 7.4, 9.5], fov: 42, near: 0.1, far: 100 }} dpr={[1, 1.7]} gl={{ antialias: true }}>
        <PrinterScene />
      </Canvas>
      <div className="viewer-legend">
        <span><i className="legend-blue" /> Your selection</span>
        <span><i className="legend-amber" /> Agent emphasis</span>
      </div>
      <div className="viewer-hint"><Maximize2 size={13} /> Drag to orbit · Scroll to zoom · Click a component</div>
      {viewer.activeMotionPathId && <div className="motion-badge"><Route size={14} /> Motion path: {viewer.activeMotionPathId === "y_powertrain" ? "Stepper → pulley → belt → carriage → bed" : "Drive pulley → belt → idler"}</div>}
      {viewer.focusedComponentId && <div className="focus-badge"><Focus size={13} /> Agent camera focus</div>}
    </div>
  );
}
