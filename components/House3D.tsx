"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ITEMS } from "@/lib/items";

/** [너비, 높이, 깊이, 색상, dx, dy, dz, (선택) rotZ] */
type Box = [number, number, number, string, number, number, number, number?];

interface ModelSpec {
  pos: [number, number]; // x, z
  rotY?: number;
  /** 바닥에서 띄우는 높이 (벽에 거는 무기용) */
  lift?: number;
  boxes: Box[];
}

/** 무기 공통 골격: [손잡이, 자루, 날] 색상만 바꿔요 */
function weaponBoxes(blade: string, guard = "#ffd54f"): Box[] {
  return [
    [0.09, 0.3, 0.09, "#5d4037", 0, 0.15, 0],
    [0.3, 0.07, 0.1, guard, 0, 0.33, 0],
    [0.17, 0.72, 0.05, blade, 0, 0.72, 0],
  ];
}

const MODELS: Record<string, ModelSpec> = {
  // ── 집 안 ──
  sofa: { pos: [-4.2, -2.8], boxes: [[1.6, 0.5, 0.8, "#7e57c2", 0, 0.25, 0], [1.6, 0.55, 0.25, "#9575cd", 0, 0.7, -0.28], [0.25, 0.35, 0.8, "#9575cd", -0.68, 0.62, 0], [0.25, 0.35, 0.8, "#9575cd", 0.68, 0.62, 0]] },
  tv: { pos: [-2.1, -3.5], boxes: [[0.5, 0.35, 0.3, "#37474f", 0, 0.17, 0], [1.3, 0.85, 0.12, "#263238", 0, 0.8, 0], [1.1, 0.62, 0.06, "#81d4fa", 0, 0.8, 0.08]] },
  fridge: { pos: [-0.5, -3.4], boxes: [[0.85, 1.5, 0.7, "#eceff1", 0, 0.75, 0], [0.85, 0.06, 0.72, "#b0bec5", 0, 1.05, 0], [0.08, 0.4, 0.06, "#78909c", 0.32, 0.85, 0.37]] },
  bed: { pos: [-4.6, -0.4], rotY: 0.3, boxes: [[1.7, 0.32, 1.05, "#ef5350", 0, 0.3, 0], [0.55, 0.16, 0.85, "#ffffff", -0.5, 0.52, 0], [1.75, 0.55, 0.14, "#8d6e63", 0, 0.35, -0.55]] },
  desk: { pos: [-2.5, -0.7], boxes: [[1.3, 0.09, 0.7, "#8d6e63", 0, 0.62, 0], [0.1, 0.6, 0.6, "#6d4c41", -0.55, 0.3, 0], [0.1, 0.6, 0.6, "#6d4c41", 0.55, 0.3, 0], [0.28, 0.35, 0.4, "#e53935", -0.3, 0.84, 0], [0.26, 0.28, 0.38, "#1e88e5", 0.05, 0.8, 0]] },
  chair: { pos: [-3.3, -1.7], rotY: -0.5, boxes: [[0.55, 0.09, 0.55, "#a1887f", 0, 0.42, 0], [0.55, 0.6, 0.09, "#a1887f", 0, 0.75, -0.24], [0.08, 0.42, 0.08, "#6d4c41", -0.2, 0.21, -0.2], [0.08, 0.42, 0.08, "#6d4c41", 0.2, 0.21, -0.2], [0.08, 0.42, 0.08, "#6d4c41", -0.2, 0.21, 0.2], [0.08, 0.42, 0.08, "#6d4c41", 0.2, 0.21, 0.2]] },
  carpet: { pos: [-2.9, -1.9], boxes: [[1.9, 0.06, 1.3, "#e53935", 0, 0.03, 0], [1.5, 0.07, 0.9, "#ffb300", 0, 0.035, 0]] },
  plant: { pos: [-0.6, -4.1], boxes: [[0.42, 0.36, 0.42, "#795548", 0, 0.18, 0], [0.58, 0.52, 0.58, "#43a047", 0, 0.62, 0]] },
  lamp: { pos: [-0.7, -1.2], boxes: [[0.4, 0.08, 0.4, "#6d4c41", 0, 0.04, 0], [0.11, 1.0, 0.11, "#6d4c41", 0, 0.55, 0], [0.52, 0.42, 0.52, "#ffeb3b", 0, 1.25, 0]] },
  piano: { pos: [-4.5, 1.1], rotY: 0.9, boxes: [[1.4, 0.68, 0.6, "#212121", 0, 0.42, 0], [1.2, 0.09, 0.28, "#fafafa", 0, 0.68, 0.3], [1.35, 0.55, 0.5, "#212121", 0, 1.0, -0.08]] },
  aquarium: { pos: [-1.7, 1.0], boxes: [[1.15, 0.35, 0.55, "#37474f", 0, 0.17, 0], [1.25, 0.72, 0.62, "#4fc3f7", 0, 0.72, 0], [0.3, 0.18, 0.2, "#ff9800", -0.2, 0.65, 0]] },
  clock: { pos: [-3.1, -4.55], boxes: [[0.55, 0.75, 0.1, "#8d6e63", 0, 2.1, 0], [0.42, 0.5, 0.06, "#ffffff", 0, 2.15, 0.06]] },
  // ── 진열장 ──
  torch: { pos: [-5.35, -4.5], boxes: [[0.11, 0.65, 0.11, "#6d4c41", 0, 1.9, 0], [0.24, 0.32, 0.24, "#ff9800", 0, 2.35, 0]] },
  woodblock: { pos: [-1.15, -4.5], boxes: [[0.72, 0.72, 0.72, "#a1887f", 0, 1.95, 0], [0.74, 0.12, 0.74, "#8d6e63", 0, 2.32, 0]] },
  fishing: { pos: [-5.4, -1.6], boxes: [[0.09, 1.25, 0.09, "#6d4c41", 0, 1.5, 0, 0.45], [0.5, 0.09, 0.09, "#6d4c41", 0.18, 2.05, 0]] },
  pickaxe: { pos: [-0.35, 0.4], boxes: [[0.75, 0.38, 0.75, "#9e9e9e", 0, 0.19, 0], [0.1, 0.95, 0.1, "#8d6e63", 0, 0.85, 0, 0.35], [0.78, 0.13, 0.13, "#4dd0e1", 0, 1.3, 0]] },
  diamond: { pos: [-5.3, 0.9], boxes: [[0.75, 0.42, 0.75, "#ffd54f", 0, 0.21, 0], [0.55, 0.55, 0.55, "#4dd0e1", 0, 0.7, 0]] },
  dragonegg: { pos: [-5.3, -3.2], boxes: [[0.7, 0.4, 0.7, "#37474f", 0, 0.2, 0], [0.52, 0.68, 0.52, "#4a148c", 0, 0.74, 0], [0.54, 0.14, 0.54, "#7b1fa2", 0, 0.95, 0]] },
  // ── 마당 ──
  flower: { pos: [2.4, 3.2], boxes: [[0.95, 0.14, 0.95, "#66bb4a", 0, 0.07, 0], [0.2, 0.3, 0.2, "#ec407a", -0.25, 0.28, -0.2], [0.2, 0.3, 0.2, "#ffeb3b", 0.22, 0.28, 0.18], [0.2, 0.3, 0.2, "#ab47bc", 0.05, 0.28, -0.3]] },
  mailbox: { pos: [4.9, 3.6], boxes: [[0.12, 0.75, 0.12, "#6d4c41", 0, 0.37, 0], [0.58, 0.45, 0.42, "#e53935", 0, 0.95, 0], [0.2, 0.28, 0.06, "#ffd54f", 0.3, 1.25, 0]] },
  stoneblock: { pos: [1.5, 0.4], boxes: [[0.85, 0.62, 0.85, "#9e9e9e", 0, 0.31, 0], [0.6, 0.4, 0.6, "#bdbdbd", 0.1, 0.8, 0.05]] },
  tree: { pos: [4.3, -0.8], boxes: [[0.38, 1.15, 0.38, "#6d4c41", 0, 0.57, 0], [1.55, 1.15, 1.55, "#43a047", 0, 1.7, 0], [1.1, 0.8, 1.1, "#66bb4a", 0, 2.55, 0]] },
  tent: { pos: [2.7, 1.4], rotY: -0.4, boxes: [[1.5, 0.95, 1.25, "#ff7043", 0, 0.47, 0], [1.6, 0.16, 0.34, "#f4511e", 0, 1.0, 0], [0.6, 0.65, 0.06, "#4e342e", 0, 0.35, 0.64]] },
  enchant: { pos: [4.7, 2.0], boxes: [[0.95, 0.78, 0.95, "#5d4037", 0, 0.39, 0], [0.62, 0.14, 0.46, "#f5f5f5", 0, 0.88, 0], [0.16, 0.3, 0.16, "#4dd0e1", -0.55, 0.55, 0.3], [0.16, 0.3, 0.16, "#4dd0e1", 0.55, 0.55, -0.3]] },
  // ── 무기 벽 (뒷벽에 걸기) ──
  woodsword: { pos: [-5.75, -4.52], lift: 1.05, boxes: weaponBoxes("#a1887f") },
  stonesword: { pos: [-5.28, -4.52], lift: 1.05, boxes: weaponBoxes("#9e9e9e") },
  woodbow: { pos: [-4.81, -4.52], lift: 1.05, boxes: [[0.08, 0.95, 0.08, "#8d6e63", 0, 0.5, 0], [0.04, 0.9, 0.04, "#f5f5f5", 0.12, 0.5, 0], [0.3, 0.05, 0.05, "#a1887f", 0.05, 0.55, 0]] },
  ironsword: { pos: [-4.34, -4.52], lift: 1.05, boxes: weaponBoxes("#cfd8dc") },
  ironaxe: { pos: [-3.87, -4.52], lift: 1.05, boxes: [[0.09, 0.85, 0.09, "#6d4c41", 0, 0.42, 0], [0.4, 0.34, 0.06, "#b0bec5", 0.12, 0.78, 0]] },
  goldbow: { pos: [-3.4, -4.52], lift: 1.05, boxes: [[0.08, 0.95, 0.08, "#ffd54f", 0, 0.5, 0], [0.04, 0.9, 0.04, "#ffffff", 0.12, 0.5, 0], [0.3, 0.05, 0.05, "#ffb300", 0.05, 0.55, 0]] },
  diasword: { pos: [-2.93, -4.52], lift: 1.05, boxes: weaponBoxes("#4dd0e1", "#ffd54f") },
  trident: { pos: [-2.46, -4.52], lift: 1.05, boxes: [[0.08, 0.85, 0.08, "#26a69a", 0, 0.42, 0], [0.07, 0.3, 0.07, "#4dd0e1", -0.14, 0.95, 0], [0.07, 0.38, 0.07, "#4dd0e1", 0, 1.0, 0], [0.07, 0.3, 0.07, "#4dd0e1", 0.14, 0.95, 0]] },
  netherite: { pos: [-1.99, -4.52], lift: 1.05, boxes: weaponBoxes("#4e342e", "#e53935") },
  magicwand: { pos: [-1.52, -4.52], lift: 1.05, boxes: [[0.08, 0.8, 0.08, "#6a1b9a", 0, 0.4, 0], [0.24, 0.24, 0.24, "#ffee58", 0, 0.92, 0]] },
  dragonslayer: { pos: [-1.05, -4.52], lift: 1.05, boxes: weaponBoxes("#66bb4a", "#e53935") },
  excalibur: { pos: [-0.58, -4.52], lift: 1.05, boxes: weaponBoxes("#fff59d", "#ffb300") },
};

function emojiSprite(emoji: string): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "92px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, 64, 70);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.95, 0.95, 1);
  return sprite;
}

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, rotZ = 0): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const isGlass = color === "#4fc3f7";
  const mat = new THREE.MeshLambertMaterial({ color, transparent: isGlass, opacity: isGlass ? 0.55 : 1 });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (rotZ) m.rotation.z = rotZ;
  return m;
}

function buildPlot(scene: THREE.Scene) {
  // 땅: 잔디 + 흙
  scene.add(box(13, 0.5, 13, "#5fae3f", 0, -0.25, 0));
  scene.add(box(13, 1.1, 13, "#8a5a2b", 0, -1.05, 0));
  // 집 바닥 (나무)
  scene.add(box(6.4, 0.18, 6.4, "#b07a3f", -2.9, 0.09, -1.6));
  // 뒷벽 + 옆벽
  for (let x = 0; x < 7; x++) for (let y = 0; y < 3; y++) scene.add(box(0.92, 0.92, 0.3, y === 1 && (x === 2 || x === 5) ? "#a5d6f7" : "#a9742f", -5.85 + x * 0.95, 0.65 + y * 0.95, -4.85));
  for (let z = 0; z < 6; z++) for (let y = 0; y < 3; y++) scene.add(box(0.3, 0.92, 0.92, "#a9742f", -6.05, 0.65 + y * 0.95, -3.9 + z * 0.95));
  for (let z = 0; z < 6; z++) for (let y = 0; y < 3; y++) if (z > 1) scene.add(box(0.3, 0.92, 0.92, "#a9742f", 0.25, 0.65 + y * 0.95, -3.9 + z * 0.95));
  // 지붕 (계단식 블록)
  scene.add(box(7.6, 0.35, 7.6, "#a33b2e", -2.9, 3.35, -1.6));
  scene.add(box(6.2, 0.35, 6.2, "#b54436", -2.9, 3.7, -1.6));
  scene.add(box(4.6, 0.35, 4.6, "#a33b2e", -2.9, 4.05, -1.6));
  scene.add(box(3.0, 0.35, 3.0, "#b54436", -2.9, 4.4, -1.6));
  // 울타리 (마당 앞)
  for (let x = 0; x < 6; x++) {
    scene.add(box(0.14, 0.6, 0.14, "#d7ccc8", 1.2 + x * 0.95, 0.3, 4.6));
    scene.add(box(0.14, 0.6, 0.14, "#d7ccc8", 1.2 + x * 0.95, 0.3, -2.2 + x * 0 + 6.8));
  }
  // 구름
  const cloud = new THREE.Group();
  cloud.add(box(2.2, 0.5, 1.2, "#ffffff", 0, 0, 0));
  cloud.add(box(1.4, 0.5, 1.0, "#ffffff", 1.4, 0.1, 0.2));
  cloud.position.set(3.5, 6.2, -3);
  scene.add(cloud);
  const cloud2 = cloud.clone();
  cloud2.position.set(-4, 7, 2.5);
  cloud2.scale.setScalar(0.7);
  scene.add(cloud2);
}

export default function House3D({ inventory }: { inventory: Record<string, number> }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const invKey = JSON.stringify(inventory);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const inv: Record<string, number> = JSON.parse(invKey);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#87ceeb");
    scene.fog = new THREE.Fog("#87ceeb", 30, 60);

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight, 0.1, 200);
    camera.position.set(11, 9.5, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-1, 0.8, 0);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minDistance = 7;
    controls.maxDistance = 30;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.9;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      if (idleTimer) clearTimeout(idleTimer);
    });
    controls.addEventListener("end", () => {
      idleTimer = setTimeout(() => (controls.autoRotate = true), 5000);
    });

    scene.add(new THREE.HemisphereLight("#ffffff", "#5fae3f", 1.05));
    const sun = new THREE.DirectionalLight("#fff8e1", 1.6);
    sun.position.set(8, 14, 6);
    scene.add(sun);

    buildPlot(scene);

    // 모은 물건 배치
    for (const item of ITEMS) {
      if ((inv[item.id] ?? 0) <= 0) continue;
      const spec = MODELS[item.id];
      if (!spec) continue;
      const g = new THREE.Group();
      let topY = 0;
      for (const [w, h, d, c, dx, dy, dz, rz] of spec.boxes) {
        g.add(box(w, h, d, c, dx, dy, dz, rz ?? 0));
        topY = Math.max(topY, dy + h / 2);
      }
      const sprite = emojiSprite(item.emoji);
      sprite.position.set(0, topY + 0.75, 0);
      g.add(sprite);
      g.position.set(spec.pos[0], 0.18 + (spec.lift ?? 0), spec.pos[1]);
      if (spec.rotY) g.rotation.y = spec.rotY;
      scene.add(g);
    }

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      if (!mount.clientWidth) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      if (idleTimer) clearTimeout(idleTimer);
      controls.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    };
  }, [invKey]);

  return (
    <div>
      <div ref={mountRef} className="h-[440px] w-full overflow-hidden rounded-lg border-4 border-[#3e2723] bg-[#87ceeb]" />
      <p className="mt-1 text-center text-sm font-bold text-[#2e5b1e]">🖱️ 드래그하면 집이 돌아가요! 손을 떼면 잠시 뒤 자동으로 천천히 돌아요</p>
    </div>
  );
}
