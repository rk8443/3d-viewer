import { useRef, useEffect } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ViewportGizmo } from "three-viewport-gizmo";
import { PointCloudData } from "../lib/point-cloud";

export type ViewPreset = "iso" | "front" | "back" | "left" | "right" | "top" | "bottom";

export interface ViewController {
  fit: () => void;
  setView: (preset: ViewPreset) => void;
}

interface PointCloudCanvasProps {
  data: PointCloudData | null;
  pointSize: number;
  colorMode: "height" | "intensity" | "uniform";
  heightRange?: [number, number];
  clipEnabled?: boolean;
  heightMap?: "linear" | "equalized";
  onReady?: (ctrl: ViewController) => void;
}

// ---------------------------------------------------------------------------
// Height color map (unchanged from prior version)
// ---------------------------------------------------------------------------
function buildZQuantileTable(data: PointCloudData, zLo: number, zHi: number): Float32Array {
  const n = data.pointCount;
  const maxSamples = 4000;
  const stride = Math.max(1, Math.floor(n / maxSamples));
  const buf: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const z = data.positions[i * 3 + 2];
    if (z >= zLo && z <= zHi) buf.push(z);
  }
  if (buf.length < 2) return new Float32Array([zLo, zHi]);
  buf.sort((a, b) => a - b);
  return Float32Array.from(buf);
}

function quantileOf(table: Float32Array, z: number): number {
  let lo = 0;
  let hi = table.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (table[mid] < z) lo = mid + 1;
    else hi = mid;
  }
  return lo / (table.length - 1);
}

function buildColors(
  data: PointCloudData,
  colorMode: "height" | "intensity" | "uniform",
  heightRange?: [number, number],
  heightMap: "linear" | "equalized" = "equalized",
): Float32Array {
  const colors = new Float32Array(data.pointCount * 3);
  const color = new THREE.Color();
  const { min, max } = data.boundingBox;
  const [zLo, zHi] = heightRange ?? [min[2], max[2]];
  const zSpan = zHi - zLo;

  const qTable =
    colorMode === "height" && heightMap === "equalized"
      ? buildZQuantileTable(data, zLo, zHi)
      : null;

  for (let i = 0; i < data.pointCount; i++) {
    if (colorMode === "height") {
      const z = data.positions[i * 3 + 2];
      let t: number;
      if (z <= zLo) t = 0;
      else if (z >= zHi) t = 1;
      else if (qTable) t = quantileOf(qTable, z);
      else t = zSpan === 0 ? 0.5 : (z - zLo) / zSpan;
      color.setHSL(0.7 - t * 0.7, 1.0, 0.5);
    } else if (colorMode === "intensity" && data.intensities) {
      const v = data.intensities[i];
      color.setRGB(v, v, v);
    } else {
      color.setHex(0x00e5ff);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  return colors;
}

// ---------------------------------------------------------------------------
// Labeled-axes helper
// ---------------------------------------------------------------------------
// Picks a "nice" tick step (1, 2, 5 × 10^n) so we land on round numbers.
function niceStep(span: number, targetTicks = 8): number {
  if (span <= 0) return 1;
  const raw = span / targetTicks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  return step * mag;
}

// Format tick label compactly. Big numbers get scientific, small ones get
// trimmed decimals.
function fmtTick(v: number, step: number): string {
  if (Math.abs(v) < step * 1e-3) return "0";
  const abs = Math.abs(v);
  if (abs >= 10000 || abs < 0.01) return v.toExponential(1).replace("e+", "e").replace("e-0", "e-");
  const decimals = step >= 10 ? 0 : step >= 1 ? 1 : step >= 0.1 ? 2 : 3;
  return v.toFixed(decimals);
}

// Build a transparent sprite of `text` in white with a black outline so it
// stays legible on any background (dark voids, rainbow cloud, white surfaces).
// The returned sprite carries its native canvas aspect ratio in userData.aspect
// so the animation loop can rescale it each frame for constant screen size.
function makeLabelSprite(text: string, pxHeight: number, bold = true): THREE.Sprite {
  const fontPx = 44;
  const weight = bold ? "bold" : "500";
  const font = `${weight} ${fontPx}px ui-monospace, "SF Mono", Consolas, monospace`;
  const padX = 6;
  const padY = 4;
  const strokePx = Math.max(3, Math.round(fontPx * 0.13));

  // Measure first
  const measureCanvas = document.createElement("canvas");
  const mctx = measureCanvas.getContext("2d")!;
  mctx.font = font;
  const textW = Math.ceil(mctx.measureText(text).width);

  const canvas = document.createElement("canvas");
  canvas.width = textW + padX * 2 + strokePx * 2;
  canvas.height = Math.ceil(fontPx * 1.3) + padY * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // No background fill — fully transparent canvas.
  // Dark stroke first, white fill on top — classic readable-anywhere combo.
  ctx.lineWidth = strokePx;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const sprite = new THREE.Sprite(mat);
  const aspect = canvas.width / canvas.height;
  sprite.userData.aspect = aspect;
  sprite.userData.baseHeight = pxHeight; // initial world-space height (recomputed per frame)
  sprite.scale.set(pxHeight * aspect, pxHeight, 1);
  sprite.renderOrder = 999;
  return sprite;
}

interface AxesObjects {
  group: THREE.Group;
  labels: THREE.Sprite[]; // every text sprite, so the animate loop can rescale them
  dispose: () => void;
}

// Build full labeled axes that span [0..size.x] x [0..size.y] x [0..size.z].
// Each axis: colored main line + black tick segments + numeric labels +
// an axis-letter label at the far end.
function buildLabeledAxes(size: THREE.Vector3, worldMin: THREE.Vector3): AxesObjects {
  const group = new THREE.Group();
  const labels: THREE.Sprite[] = [];
  const disposables: Array<{ dispose: () => void }> = [];

  // Reference size for tick & label sizing — diagonal of the data box.
  const ref = Math.max(size.length(), 1);
  const tickLen = ref * 0.012;
  const labelHeight = ref * 0.022; // world units, matches data scale
  const axisLetterHeight = ref * 0.04;

  const axisDefs: Array<{
    name: "X" | "Y" | "Z";
    color: number;
    dir: THREE.Vector3;
    length: number;
    worldStart: number;
    tickDir1: THREE.Vector3;
    tickDir2: THREE.Vector3;
  }> = [
    {
      name: "X",
      color: 0xff5577,
      dir: new THREE.Vector3(1, 0, 0),
      length: size.x,
      worldStart: worldMin.x,
      tickDir1: new THREE.Vector3(0, -1, 0),
      tickDir2: new THREE.Vector3(0, -1, 0),
    },
    {
      name: "Y",
      color: 0x55cc77,
      dir: new THREE.Vector3(0, 1, 0),
      length: size.y,
      worldStart: worldMin.y,
      tickDir1: new THREE.Vector3(-1, 0, 0),
      tickDir2: new THREE.Vector3(-1, 0, 0),
    },
    {
      name: "Z",
      color: 0x6699ff,
      dir: new THREE.Vector3(0, 0, 1),
      length: size.z,
      worldStart: worldMin.z,
      tickDir1: new THREE.Vector3(1, 0, 0),
      tickDir2: new THREE.Vector3(1, 0, 0),
    },
  ];

  for (const ax of axisDefs) {
    if (ax.length <= 0) continue;

    // Main axis line — bright color
    const mainGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      ax.dir.clone().multiplyScalar(ax.length),
    ]);
    const mainMat = new THREE.LineBasicMaterial({ color: ax.color, transparent: true, opacity: 0.95 });
    const mainLine = new THREE.Line(mainGeo, mainMat);
    group.add(mainLine);
    disposables.push(mainGeo, mainMat);

    // Tick marks at "nice" intervals — placed at geometry positions
    // 0, step, 2*step, … <= length. Labels show worldStart + i*step.
    const step = niceStep(ax.length, 8);
    const tickPoints: number[] = [];
    const nTicks = Math.floor(ax.length / step + 0.5);

    for (let i = 0; i <= nTicks; i++) {
      const t = i * step;
      if (t > ax.length + step * 0.01) break;
      const base = ax.dir.clone().multiplyScalar(t);
      const tickEnd = base.clone().addScaledVector(ax.tickDir1, tickLen);
      tickPoints.push(base.x, base.y, base.z, tickEnd.x, tickEnd.y, tickEnd.z);

      // Skip the "0" label on X and Y so they don't pile on top of each other
      // at the origin. Keep Z's "0" since it's offset along +X.
      const worldVal = ax.worldStart + t;
      if (i === 0 && ax.name !== "Z") continue;

      const label = makeLabelSprite(fmtTick(worldVal, step), labelHeight, false);
      label.position.copy(base).addScaledVector(ax.tickDir2, tickLen * 2.5);
      group.add(label);
      labels.push(label);
      disposables.push(label.material as THREE.SpriteMaterial, (label.material as THREE.SpriteMaterial).map!);
    }

    if (tickPoints.length > 0) {
      const tickGeo = new THREE.BufferGeometry();
      tickGeo.setAttribute("position", new THREE.Float32BufferAttribute(tickPoints, 3));
      const tickMat = new THREE.LineBasicMaterial({ color: ax.color, transparent: true, opacity: 0.85 });
      const tickLines = new THREE.LineSegments(tickGeo, tickMat);
      group.add(tickLines);
      disposables.push(tickGeo, tickMat);
    }

    // Axis-letter label at the far end ("X", "Y", "Z")
    const letter = makeLabelSprite(ax.name, axisLetterHeight, true);
    letter.userData.role = "letter";
    letter.position.copy(ax.dir.clone().multiplyScalar(ax.length + tickLen * 4));
    group.add(letter);
    labels.push(letter);
    disposables.push(letter.material as THREE.SpriteMaterial, (letter.material as THREE.SpriteMaterial).map!);
  }

  return {
    group,
    labels,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

export function PointCloudCanvas({ data, pointSize, colorMode, heightRange, clipEnabled, heightMap, onReady }: PointCloudCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const gizmoRef = useRef<ViewportGizmo | null>(null);
  const pointsRef = useRef<THREE.Points | null>(null);
  // Offset applied to world Z when packing geometry. Geometry Z = world Z - this value.
  // Used to translate the height-clip slider from world coords to geometry coords.
  const zOffsetRef = useRef<number>(0);
  // Center of the data bounding box in geometry coords (== size/2 since we
  // anchor min to origin). Used as the orbit target.
  const boxCenterRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const axesRef = useRef<AxesObjects | null>(null);
  const labelsRef = useRef<THREE.Sprite[]>([]);
  const clipUniformRef = useRef<{ value: THREE.Vector2 } | null>(null);
  const frameRef = useRef<number>(0);
  const mountedRef = useRef(false);

  const fitView = useRef<() => void>(() => {});
  const setView = useRef<(p: ViewPreset) => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mountedRef.current) return;
    mountedRef.current = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x080d14);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 200000);
    camera.up.set(0, 0, 1);
    camera.position.set(40, -40, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controlsRef.current = controls;

    const gizmo = new ViewportGizmo(camera, renderer, {
      type: "cube",
      size: 110,
      placement: "bottom-right",
      offset: { right: 12, bottom: 12 },
      background: { enabled: true, color: 0x1a2230, opacity: 0.85, hover: { color: 0x2a3850, opacity: 1 } },
      corners: { enabled: true, color: 0x3a4860 },
      font: { family: "ui-monospace, monospace", weight: 600 },
    });
    gizmo.attachControls(controls);
    gizmoRef.current = gizmo;

    fitView.current = () => {
      const geo = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
      if (!geo || !geo.boundingSphere) return;
      const radius = geo.boundingSphere.radius || 20;
      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius / Math.sin(fov / 2)) * 1.05;
      const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
      if (dir.lengthSq() === 0) dir.set(1, -1, 0.8).normalize();
      controls.target.copy(boxCenterRef.current);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      camera.near = Math.max(0.01, radius / 10000);
      camera.far = Math.max(20000, radius * 50);
      camera.updateProjectionMatrix();
      controls.update();
      gizmo.update();
    };

    setView.current = (preset: ViewPreset) => {
      const geo = pointsRef.current?.geometry as THREE.BufferGeometry | undefined;
      const radius = (geo?.boundingSphere?.radius ?? 0) > 0 ? geo!.boundingSphere!.radius : 20;
      const fov = (camera.fov * Math.PI) / 180;
      const dist = (radius / Math.sin(fov / 2)) * 1.05;
      const dirs: Record<ViewPreset, [number, number, number]> = {
        iso: [1, -1, 0.9],
        front: [0, -1, 0],
        back: [0, 1, 0],
        left: [-1, 0, 0],
        right: [1, 0, 0],
        top: [0, 0, 1],
        bottom: [0, 0, -1],
      };
      const [x, y, z] = dirs[preset];
      const dir = new THREE.Vector3(x, y, z).normalize();
      controls.target.copy(boxCenterRef.current);
      camera.position.copy(controls.target).addScaledVector(dir, dist);
      camera.lookAt(controls.target);
      controls.update();
      gizmo.update();
    };

    // Per-frame: rescale every label sprite so it occupies roughly the same
    // screen-space height regardless of camera distance. Sprites that are
    // close still look small, sprites that are far still look big — exactly
    // the opposite of perspective shrinkage. Net effect: labels are always
    // readable and the axis "scales" with the view.
    //
    // The target is `screenHeight` of vertical screen pixels at the rendered
    // height. We compute the world-units-per-pixel at the sprite's depth
    // (perspective camera) and multiply.
    const SCREEN_PIXEL_HEIGHT = 18; // tick labels
    const SCREEN_PIXEL_HEIGHT_LETTER = 32; // axis letter
    const tmpVec = new THREE.Vector3();
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate);
      controls.update();

      const sprites = labelsRef.current;
      if (sprites.length > 0 && rendererRef.current) {
        const rendererSize = new THREE.Vector2();
        rendererRef.current.getSize(rendererSize);
        const vFov = (camera.fov * Math.PI) / 180;
        for (const sp of sprites) {
          tmpVec.setFromMatrixPosition(sp.matrixWorld);
          const dist = camera.position.distanceTo(tmpVec);
          // World units per screen pixel at this depth.
          const worldPerPixel = (2 * Math.tan(vFov / 2) * dist) / rendererSize.y;
          const isLetter = sp.userData.baseHeight && sp.userData.baseHeight > (axesRef.current ? 0 : 0)
            ? false
            : false;
          // Detect letter vs tick via stored baseHeight ratio: letter is bigger.
          const target =
            sp.userData.role === "letter" ? SCREEN_PIXEL_HEIGHT_LETTER : SCREEN_PIXEL_HEIGHT;
          const worldH = target * worldPerPixel;
          const aspect = sp.userData.aspect ?? 1;
          sp.scale.set(worldH * aspect, worldH, 1);
          void isLetter;
        }
      }

      renderer.render(scene, camera);
      gizmo.render();
    };
    animate();

    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      gizmo.update();
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
      gizmo.dispose();
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Rebuild geometry + axes whenever the dataset changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Tear down old points + axes
    if (pointsRef.current) {
      (pointsRef.current.geometry as THREE.BufferGeometry).dispose();
      (pointsRef.current.material as THREE.PointsMaterial).dispose();
      scene.remove(pointsRef.current);
      pointsRef.current = null;
    }
    if (axesRef.current) {
      scene.remove(axesRef.current.group);
      axesRef.current.dispose();
      axesRef.current = null;
    }
    labelsRef.current = [];

    if (!data) return;

    // Copy positions for the GPU; do NOT mutate data.positions (other code
    // paths read world-space Z from it).
    const positions = new Float32Array(data.positions);
    const { min, max } = data.boundingBox;
    const sizeX = max[0] - min[0];
    const sizeY = max[1] - min[1];
    const sizeZ = max[2] - min[2];

    // Anchor the cloud so its min corner sits exactly at (0, 0, 0):
    //   geometry = world - min
    // This is what the user asked for ("starts from 0,0,0") and lets the
    // labeled axes display real world coordinates as `min + geometryT`.
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] -= min[0];
      positions[i + 1] -= min[1];
      positions[i + 2] -= min[2];
    }
    zOffsetRef.current = min[2];
    boxCenterRef.current.set(sizeX / 2, sizeY / 2, sizeZ / 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const colors = buildColors(data, colorMode, heightRange, heightMap);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    const clipUniform = { value: new THREE.Vector2(-1e9, 1e9) };
    clipUniformRef.current = clipUniform;
    const mat = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      sizeAttenuation: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uClipZ = clipUniform;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvZ = position.z;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec2 uClipZ;\nvarying float vZ;",
        )
        .replace(
          "#include <clipping_planes_fragment>",
          "if (vZ < uClipZ.x || vZ > uClipZ.y) discard;\n#include <clipping_planes_fragment>",
        );
    };

    const points = new THREE.Points(geo, mat);
    scene.add(points);
    pointsRef.current = points;

    // Labeled axes spanning the whole data extent, anchored at the origin.
    const axes = buildLabeledAxes(
      new THREE.Vector3(sizeX, sizeY, sizeZ),
      new THREE.Vector3(min[0], min[1], min[2]),
    );
    scene.add(axes.group);
    axesRef.current = axes;
    labelsRef.current = axes.labels;

    fitView.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Translate the world-space slider into geometry-space for the GPU clip.
  useEffect(() => {
    const u = clipUniformRef.current;
    if (!u) return;
    if (clipEnabled && heightRange) {
      const off = zOffsetRef.current;
      u.value.set(heightRange[0] - off, heightRange[1] - off);
    } else {
      u.value.set(-1e9, 1e9);
    }
  }, [clipEnabled, heightRange?.[0], heightRange?.[1], data]);

  // Re-color in place when color settings change.
  useEffect(() => {
    const points = pointsRef.current;
    if (!points || !data) return;
    const colors = buildColors(data, colorMode, heightRange, heightMap);
    const attr = (points.geometry as THREE.BufferGeometry).getAttribute("color") as THREE.BufferAttribute;
    attr.array.set(colors);
    attr.needsUpdate = true;
  }, [data, colorMode, heightMap, heightRange?.[0], heightRange?.[1]]);

  useEffect(() => {
    if (!pointsRef.current) return;
    (pointsRef.current.material as THREE.PointsMaterial).size = pointSize;
  }, [pointSize]);

  useEffect(() => {
    if (!onReady) return;
    onReady({
      fit: () => fitView.current(),
      setView: (p) => setView.current(p),
    });
  }, [onReady]);

  return <div ref={containerRef} className="w-full h-full" />;
}
