"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, useGLTF, useTexture } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { getContrastColor } from "@/lib/branding";
import { WORLD_WIDTH, WORLD_DEPTH, END_ZONE_WORLD, toWorldX, toWorldZ } from "./coordinates";
import { CameraRig, type CameraEvent } from "./CameraRig";

export type { CameraEvent };

// Stadium-sky HDRI (CC0, Poly Haven: "Kloofendal 48d Partly Cloudy Puresky",
// https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) drives PBR
// ambient lighting via drei's <Environment>, which loads it with three's own
// RGBELoader and sets scene.environment — no new npm dependency, since
// @react-three/drei already ships that loader internally. It's lighting
// only (background=false below), not a visible sky dome.
const HDRI_URL = "/hdri/stadium_sky_1k.hdr";

// Real turf photo + normal map (CC0, Poly Haven "Leafy Grass":
// https://polyhaven.com/a/leafy_grass) for the field surface, tiled many
// times across the field so it reads as individual blades up close instead
// of one stretched photo. The existing per-game canvas texture (team
// colors, yard lines, numbers) becomes a transparent decal layered a hair
// above this turf, the way broadcast field graphics are actually
// composited over real turf rather than replacing it.
const GRASS_DIFFUSE_URL = "/textures/grass/grass_diffuse_1k.jpg";
const GRASS_NORMAL_URL = "/textures/grass/grass_normal_1k.jpg";
useTexture.preload(GRASS_DIFFUSE_URL);
useTexture.preload(GRASS_NORMAL_URL);

// A real rigged, skinned, animated humanoid model stands in for the old
// hand-built capsule rig — "CesiumMan", a Khronos glTF sample asset (CC-BY
// 4.0, © Cesium; see README for the attribution this license requires).
// It's generic and ships with exactly one walk-cycle animation, which is
// the tradeoff of a free asset over a licensed/custom football rig: there's
// no throw/kick/catch/handoff-specific mocap, so those moments just play
// the same walk cycle rather than a dedicated pose.
const PLAYER_MODEL_URL = "/models/player.glb";
useGLTF.preload(PLAYER_MODEL_URL);

// The model's authored scale and default facing direction don't match our
// world units or forward-facing convention. PLAYER_MODEL_LOCAL_HEIGHT is
// measured directly from the model's glTF position accessor (its own local
// bind-pose bounding box, read straight from the file) rather than computed
// at runtime via THREE.Box3 — Box3.setFromObject doesn't reliably measure a
// SkinnedMesh's true extent (it ignores skin/bone deformation), which
// previously made every player render several times too large. PLAYER_YAW_OFFSET
// is a manual correction if the model ends up facing the wrong way — nudge
// it by increments of Math.PI / 2 if so.
const PLAYER_TARGET_HEIGHT = 1.8;
const PLAYER_MODEL_LOCAL_HEIGHT = 1.5065;
const PLAYER_SCALE = PLAYER_TARGET_HEIGHT / PLAYER_MODEL_LOCAL_HEIGHT;
const PLAYER_YAW_OFFSET = 0;

interface TeamVisual {
  abbreviation: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface PlayerMotion {
  key: string;
  startX: number; // 0-1000 field space, same convention as the rest of LiveGamePlayer
  startY: number; // 0-300
  endX: number;
  endY: number;
  color: string;
  ring: string;
  isTackler?: boolean;
  isCarrier?: boolean;
  // True for whichever player is actually holding the ball when the play
  // dies — the ball carrier on a run/return, or the QB on a sack — so they
  // (not just the tackler) go down when the play ends in a tackle.
  isBallHandler?: boolean;
  // Plays a kicking-leg swing instead of a running stride (field goal/XP
  // kicker, punter).
  isKicker?: boolean;
  // Plays a throwing motion instead of a running stride (the QB on a pass).
  isPasser?: boolean;
  // Extends the ball forward for the exchange instead of a running stride
  // (the QB on a run/touchdown, handing off to the RB).
  isHandingOff?: boolean;
  // Reaches up to make the catch late in the play (the pass's actual target).
  isReceiver?: boolean;
  // A route break: the player runs straight toward (viaX, viaY) first, then
  // cuts to (endX, endY) — an L-shaped route instead of a straight lerp.
  viaX?: number;
  viaY?: number;
  // A missed tackle: this player's own motion finishes (and falls) at this
  // fraction of the play's overall duration instead of the full length —
  // he lunges for the carrier and comes up empty well before the real
  // tackle happens at the actual end spot.
  earlyFallProgress?: number;
}

export type MotionKind = "pass" | "run" | "sack" | "kick" | "straight";

export interface Field3DProps {
  home: TeamVisual;
  away: TeamVisual;
  playIndex: number;
  kind: MotionKind;
  isKickAttempt: boolean;
  scoredThisPlay: boolean;
  kickMissed: boolean;
  motionDurationMs: number;
  ballFromX: number; // 0-1000
  ballToX: number;
  ballToY: number; // 0-300, usually 150 except a missed kick's lateral miss
  lineOfScrimmageX: number | null;
  firstDownX: number | null;
  players: PlayerMotion[];
  ballCarrierRides: boolean; // true for run/return plays — a runner mesh rides the ball's own path
  // What this play's outcome looks like to a camera — purely descriptive
  // (see CameraRig), computed by the caller from real play-resolution data.
  cameraEvent: CameraEvent;
}

// Builds the static turf — mow stripes, yard lines/numbers, hash marks — as a
// single canvas texture. Cheap to render (one plane) and redrawn only when a
// team's colors change, unlike per-line 3D geometry.
function useFieldTexture(home: TeamVisual, away: TeamVisual) {
  const homeLabel = home.abbreviation;
  const awayLabel = away.abbreviation;
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new THREE.CanvasTexture(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const endZoneW = (END_ZONE_WORLD / WORLD_WIDTH) * w;
    const fieldW = w - endZoneW * 2;

    // No turf fill here — the canvas starts transparent and this texture
    // becomes a markings-only decal over the real grass mesh (see
    // FieldTurf). Mow stripes are a touch more opaque than before since
    // they no longer sit on top of a painted color gradient for contrast.
    for (let i = 0; i < 10; i++) {
      if (i % 2 !== 0) continue;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(endZoneW + (i * fieldW) / 10, 0, fieldW / 10, h);
    }

    ctx.fillStyle = home.secondaryColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, endZoneW, h);
    ctx.fillStyle = away.secondaryColor;
    ctx.fillRect(w - endZoneW, 0, endZoneW, h);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(endZoneW / 2, h / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.font = `900 ${endZoneW * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = getContrastColor(home.secondaryColor);
    ctx.globalAlpha = 0.45;
    ctx.fillText(homeLabel, 0, 0);
    ctx.restore();

    ctx.save();
    ctx.translate(w - endZoneW / 2, h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.font = `900 ${endZoneW * 0.34}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = getContrastColor(away.secondaryColor);
    ctx.globalAlpha = 0.45;
    ctx.fillText(awayLabel, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 3;
    ctx.font = `bold ${h * 0.09}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let yard = 10; yard < 100; yard += 10) {
      const x = endZoneW + (yard / 100) * fieldW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
      const label = String(yard <= 50 ? yard : 100 - yard);
      ctx.fillText(label, x, h * 0.17);
      ctx.fillText(label, x, h * 0.98);
    }

    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    for (let yard = 5; yard < 100; yard += 5) {
      if (yard % 10 === 0) continue;
      const x = endZoneW + (yard / 100) * fieldW;
      ctx.beginPath();
      ctx.moveTo(x, h * 0.32);
      ctx.lineTo(x, h * 0.36);
      ctx.moveTo(x, h * 0.64);
      ctx.lineTo(x, h * 0.68);
      ctx.stroke();
    }

    return new THREE.CanvasTexture(canvas);
  }, [home.secondaryColor, away.secondaryColor, homeLabel, awayLabel]);
}

// The actual turf surface: a real grass photo + normal map, tiled densely
// so directional/HDRI light picks out individual blades instead of one
// flat-shaded color.
function FieldTurf() {
  const [diffuse, normal] = useTexture([GRASS_DIFFUSE_URL, GRASS_NORMAL_URL]);
  useMemo(() => {
    for (const t of [diffuse, normal]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(WORLD_WIDTH / 3, WORLD_DEPTH / 3);
      t.anisotropy = 4;
    }
  }, [diffuse, normal]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[WORLD_WIDTH, WORLD_DEPTH]} />
      <meshStandardMaterial map={diffuse} normalMap={normal} normalScale={new THREE.Vector2(0.6, 0.6)} roughness={0.95} />
    </mesh>
  );
}

// Markings only (team colors, yard lines, numbers, mow stripes) as a
// transparent decal a hair above the turf mesh — see useFieldTexture.
function FieldGround({ home, away }: { home: TeamVisual; away: TeamVisual }) {
  const texture = useFieldTexture(home, away);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
      <planeGeometry args={[WORLD_WIDTH, WORLD_DEPTH]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={0.95} />
    </mesh>
  );
}

function FieldLine({ x, color }: { x: number; color: string }) {
  return (
    <mesh position={[toWorldX(x), 0.06, 0]}>
      <boxGeometry args={[0.15, 0.02, WORLD_DEPTH]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

function Goalpost({ x }: { x: number }) {
  const worldX = toWorldX(x);
  const poleColor = "#facc15";
  return (
    <group position={[worldX, 0, 0]}>
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.09, 0.09, 3, 10]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 3.6, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.8, -3.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.8, 3.5]}>
        <cylinderGeometry args={[0.06, 0.06, 3.4, 8]} />
        <meshStandardMaterial color={poleColor} metalness={0.4} roughness={0.4} />
      </mesh>
    </group>
  );
}

// A real skinned, rigged player model (see PLAYER_MODEL_URL above), tinted
// per team and driven by its single walk-cycle clip while moving. Position
// is still hand-animated every frame from a per-mesh progress ref (not
// React state) — useFrame keeps 22 moving players cheap — only the *body*
// rendering changed from hand-built primitives to a real animated mesh.
function PlayerMesh({
  motion,
  durationMs,
  playIndex,
  fallOnImpact,
}: {
  motion: PlayerMotion;
  durationMs: number;
  playIndex: number;
  fallOnImpact: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const startedAt = useRef(0);
  const fallen = useRef(false);

  const { scene, animations } = useGLTF(PLAYER_MODEL_URL);
  // Each of the 22 players on screen needs its own independent skeleton and
  // animation state — SkeletonUtils.clone (not Object3D.clone, which doesn't
  // handle bone bindings) gives every instance its own rig while still
  // sharing the underlying geometry/animation data.
  const clonedScene = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);
  const walkClip = animations[0] ?? null;
  // The mixer/action live in a ref (not a variable captured from the useGLTF
  // hook) purely so useFrame below is free to mutate playback state every
  // frame — the lint rule that caught the earlier useThree()/camera mutation
  // applies the same way to hook-returned animation objects.
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);

  useEffect(() => {
    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const source = Array.isArray(child.material) ? child.material[0] : child.material;
      const tinted = source.clone();
      if (tinted instanceof THREE.MeshStandardMaterial || tinted instanceof THREE.MeshPhysicalMaterial) {
        tinted.color.set(motion.color);
      }
      child.material = tinted;
      child.castShadow = true;
      child.receiveShadow = true;
    });
  }, [clonedScene, motion.color]);

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;
    if (walkClip) mixer.clipAction(walkClip).reset().play();
    return () => {
      mixer.stopAllAction();
      mixerRef.current = null;
    };
  }, [clonedScene, walkClip]);

  const start = useMemo(
    () => new THREE.Vector3(toWorldX(motion.startX), 0, toWorldZ(motion.startY)),
    [motion.startX, motion.startY]
  );
  const end = useMemo(
    () => new THREE.Vector3(toWorldX(motion.endX), 0, toWorldZ(motion.endY)),
    [motion.endX, motion.endY]
  );
  const via = useMemo(
    () =>
      motion.viaX !== undefined && motion.viaY !== undefined
        ? new THREE.Vector3(toWorldX(motion.viaX), 0, toWorldZ(motion.viaY))
        : null,
    [motion.viaX, motion.viaY]
  );

  const posAt = (t: number) => {
    if (!via) return new THREE.Vector3().lerpVectors(start, end, t);
    // Quadratic Bezier through the route's break point — a rounded cut
    // rather than a straight lerp or a sharp corner.
    const a = new THREE.Vector3().lerpVectors(start, via, t);
    const b = new THREE.Vector3().lerpVectors(via, end, t);
    return a.lerp(b, t);
  };

  // A missed-tackle defender's own motion runs on a truncated clock — he
  // lunges, arrives, and falls at his earlyFallProgress fraction of the
  // play's real duration instead of running the full length like everyone
  // else still in pursuit or blocking.
  const effectiveDurationMs =
    motion.earlyFallProgress !== undefined ? durationMs * motion.earlyFallProgress : durationMs;
  const effectiveFallOnImpact = fallOnImpact || motion.earlyFallProgress !== undefined;

  useFrame((state, delta) => {
    if (startedAt.current === 0) startedAt.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startedAt.current) * 1000;
    const progress = Math.max(0, Math.min(1, elapsedMs / effectiveDurationMs));
    const eased = 1 - Math.pow(1 - progress, 2);
    const g = groupRef.current;
    if (!g) return;
    const pos = posAt(eased);
    g.position.x = pos.x;
    g.position.z = pos.z;

    const moving = progress < 1;
    if (moving && motion.isCarrier) {
      const nextPos = posAt(Math.min(1, eased + 0.02));
      const dx = nextPos.x - pos.x;
      const dz = nextPos.z - pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const juke = Math.sin(state.clock.elapsedTime * 6) * 0.5;
      g.position.x += (-dz / len) * juke;
      g.position.z += (dx / len) * juke;
    }
    const bob = moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * 0.12 : 0;
    g.position.y = bob;

    const mixer = mixerRef.current;
    if (mixer && walkClip) {
      const action = mixer.existingAction(walkClip);
      if (action) {
        action.paused = !moving || fallen.current;
        action.timeScale = motion.isCarrier ? 1.35 : 1.1;
      }
      mixer.update(delta);
    }

    const body = bodyRef.current;
    if (body) {
      if (moving) {
        const nextPos = posAt(Math.min(1, eased + 0.05));
        body.rotation.y = Math.atan2(nextPos.x - pos.x, nextPos.z - pos.z) + PLAYER_YAW_OFFSET;
      } else if (effectiveFallOnImpact && !fallen.current) {
        fallen.current = true;
      }
      if (fallen.current) {
        body.rotation.x = THREE.MathUtils.lerp(body.rotation.x, Math.PI / 2.1, 0.25);
        g.position.y = THREE.MathUtils.lerp(g.position.y, 0.3, 0.25);
      }
    }
  });

  return (
    <group ref={groupRef} position={start} key={`${motion.key}-${playIndex}`}>
      <group ref={bodyRef} scale={PLAYER_SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

// The ball: airborne with a real parabolic arc for passes/kicks, or carried
// near hand-height for runs/returns (where a separate runner mesh also rides
// this same path).
function Ball({
  from,
  to,
  toY,
  durationMs,
  kind,
  playIndex,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  toY: number;
  durationMs: number;
  kind: MotionKind;
  playIndex: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const shadowRef = useRef<THREE.Mesh>(null);
  const startedAt = useRef(0);
  const start = useMemo(() => new THREE.Vector3(toWorldX(from.x), 1.1, toWorldZ(from.y)), [from.x, from.y]);
  const end = useMemo(() => new THREE.Vector3(toWorldX(to.x), 1.1, toWorldZ(toY)), [to.x, toY]);
  const airborne = kind === "pass" || kind === "kick";
  const peakHeight = airborne ? Math.min(14, 3 + start.distanceTo(end) * 0.35) : 1.4;
  // A real spiral: the ball's long axis points along its actual direction of
  // travel (not just an arbitrary spin), tilted flat so it "spins" nose-first
  // like a real thrown football rather than tumbling end over end.
  const yawQuat = useMemo(() => {
    const yaw = Math.atan2(end.x - start.x, end.z - start.z);
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  }, [start, end]);
  const tiltQuat = useMemo(() => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2), []);
  const spinAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const spinQuat = useMemo(() => new THREE.Quaternion(), []);
  const orientation = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state) => {
    if (startedAt.current === 0) startedAt.current = state.clock.elapsedTime;
    const elapsedMs = (state.clock.elapsedTime - startedAt.current) * 1000;
    const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
    const g = ref.current;
    if (!g) return;
    g.position.lerpVectors(start, end, progress);
    const arc = Math.sin(progress * Math.PI) * peakHeight;
    g.position.y = start.y + arc;

    // A ball a few inches wide is nearly impossible to read as "in the air"
    // against a broadcast-distance field, especially in a still frame — real
    // sports broadcasts solve this with a ground shadow that shrinks and
    // fades as the object climbs. Keep the shadow tracking the ball's x/z
    // but pinned to the turf, so the gap between ball and shadow is the
    // visual cue for height.
    if (airborne && shadowRef.current) {
      shadowRef.current.position.x = g.position.x;
      shadowRef.current.position.z = g.position.z;
      const heightFrac = THREE.MathUtils.clamp(arc / peakHeight, 0, 1);
      const shrink = 1 - heightFrac * 0.6;
      shadowRef.current.scale.setScalar(shrink);
      const material = shadowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.35 * (1 - heightFrac * 0.7);
    }

    if (airborne) {
      const spinSpeed = kind === "pass" ? 16 : 10;
      spinQuat.setFromAxisAngle(spinAxis, state.clock.elapsedTime * spinSpeed);
      orientation.copy(yawQuat).multiply(tiltQuat).multiply(spinQuat);
      g.quaternion.copy(orientation);
    } else {
      g.rotation.x += kind === "sack" ? 0 : 0.25;
      g.rotation.z = progress * 3;
    }
  });

  return (
    <>
      {airborne && (
        <mesh ref={shadowRef} position={[start.x, 0.03, start.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.55, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      <group ref={ref} position={start} key={`ball-${playIndex}`}>
        <mesh castShadow>
          <capsuleGeometry args={[0.28, 0.4, 4, 8]} />
          <meshStandardMaterial color="#A0522D" roughness={0.4} emissive="#3a1a08" emissiveIntensity={0.3} />
        </mesh>
      </group>
    </>
  );
}

export function Field3D({
  home,
  away,
  playIndex,
  kind,
  isKickAttempt,
  scoredThisPlay,
  kickMissed,
  motionDurationMs,
  ballFromX,
  ballToX,
  ballToY,
  lineOfScrimmageX,
  firstDownX,
  players,
  ballCarrierRides,
  cameraEvent,
}: Field3DProps) {
  return (
    <div className="relative aspect-[10/4] w-full overflow-hidden rounded-lg border border-border-line bg-black shadow-[0_35px_60px_-15px_rgba(0,0,0,0.75)]">
      <Canvas shadows camera={{ position: [0, 12, 14], fov: 42 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#03130a"]} />
          <fog attach="fog" args={["#03130a", 60, 130]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[20, 30, 10]}
            intensity={1.4}
            castShadow
            shadow-mapSize={[2048, 2048]}
            shadow-camera-left={-65}
            shadow-camera-right={65}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
            shadow-camera-near={1}
            shadow-camera-far={100}
          />
          <pointLight position={[-30, 20, 0]} intensity={0.4} color="#bcd7ff" />
          <pointLight position={[30, 20, 0]} intensity={0.4} color="#bcd7ff" />

          {/* Stadium-sky HDRI drives PBR ambient/reflection lighting only
              (no visible sky dome) — see HDRI_URL above. Grouped with
              FieldTurf in one Suspense boundary since both load real
              texture assets, unlike the always-ready canvas decal. */}
          <Suspense fallback={null}>
            <Environment files={HDRI_URL} background={false} />
            <FieldTurf />
          </Suspense>
          <FieldGround home={home} away={away} />
          <Goalpost x={-2} />
          <Goalpost x={1002} />

          {lineOfScrimmageX !== null && <FieldLine x={lineOfScrimmageX} color="#60a5fa" />}
          {firstDownX !== null && <FieldLine x={firstDownX} color="#facc15" />}

          {/* Only the player meshes suspend (loading the shared glTF model)
              — scoped narrowly so the field/lights/goalposts still render
              immediately instead of the whole scene going blank while it
              loads, the way an earlier full-scene Suspense boundary once did. */}
          <Suspense fallback={null}>
          {players.map((p) => {
            // Tacklers go down on any run/sack; the man who actually had the
            // ball (runner or sacked QB) goes down too — unless he just
            // scored, in which case he stays on his feet in the end zone.
            const fallOnImpact =
              kind === "sack"
                ? Boolean(p.isTackler) || Boolean(p.isBallHandler)
                : kind === "run"
                  ? Boolean(p.isTackler) || (Boolean(p.isBallHandler) && !scoredThisPlay)
                  : false;
            return (
              <PlayerMesh
                key={`${p.key}-${playIndex}`}
                motion={p}
                durationMs={motionDurationMs}
                playIndex={playIndex}
                fallOnImpact={fallOnImpact}
              />
            );
          })}
          {ballCarrierRides && (
            <PlayerMesh
              key={`carrier-${playIndex}`}
              motion={{
                key: "carrier",
                startX: ballFromX,
                startY: 150,
                endX: ballToX,
                endY: ballToY,
                color: "#eab308",
                ring: "#1f2937",
                isCarrier: true,
                isBallHandler: true,
              }}
              durationMs={motionDurationMs}
              playIndex={playIndex}
              fallOnImpact={!scoredThisPlay}
            />
          )}
          </Suspense>

          <Ball
            from={{ x: ballFromX, y: 150 }}
            to={{ x: isKickAttempt ? ballToX : ballToX, y: ballToY }}
            toY={ballToY}
            durationMs={motionDurationMs}
            kind={kind}
            playIndex={playIndex}
          />

          {scoredThisPlay && <pointLight position={[toWorldX(ballToX), 8, 0]} intensity={2.2} color="#f5a623" distance={30} />}
          {kickMissed && <pointLight position={[toWorldX(ballToX), 4, toWorldZ(ballToY)]} intensity={1.4} color="#f87171" distance={20} />}

        <CameraRig
          fromX={ballFromX}
          toX={ballToX}
          toY={ballToY}
          durationMs={motionDurationMs}
          playIndex={playIndex}
          event={cameraEvent}
        />
      </Canvas>
    </div>
  );
}
