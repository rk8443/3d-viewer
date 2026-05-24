import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Small rainbow-colored dotted globe for the empty viewport state.
 * - Fibonacci-lattice sphere (~1800 points) so the dots are evenly spaced.
 * - Per-vertex HSL rainbow so each axis tumble reveals new color.
 * - Tumbles on both X and Y so the rotation reads as "all directions".
 * - Transparent canvas — sits over the page background.
 */
export function EmptyStateGlobe({ size = 280 }: { size?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(size, size);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    // Fibonacci-lattice sphere — uniform spacing, no polar clustering.
    const POINTS = 1800;
    const positions = new Float32Array(POINTS * 3);
    const colors = new Float32Array(POINTS * 3);
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const c = new THREE.Color();
    for (let i = 0; i < POINTS; i++) {
      const y = 1 - (i / (POINTS - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = GOLDEN * i;
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      // Rainbow hue along the y axis (latitude); full saturation, mid lightness.
      c.setHSL((y + 1) / 2, 0.95, 0.6);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // Tumble on multiple axes so rotation reads as "all directions".
      points.rotation.y = t * 0.35;
      points.rotation.x = Math.sin(t * 0.2) * 0.6;
      points.rotation.z = Math.cos(t * 0.15) * 0.25;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
