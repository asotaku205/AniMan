/**
 * Phát hạt 3D (Phase 5): mỗi lớp là một THREE.Points với shader riêng
 * (kích thước + độ mờ từng hạt, mặt nạ tròn mềm). Vị trí hạt tính lại
 * từ thời gian timeline mỗi khung hình nên tua tới lui vẫn đúng.
 */

import * as THREE from "three";
import {
  layerParticles,
  particleStateAt,
  type EffectFormula,
  type EffectLayer,
  type ParticleSpec,
} from "./effectFormula";

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (240.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float mask = smoothstep(0.5, 0.1, d);
  gl_FragColor = vec4(vColor, mask * vAlpha);
}`;

interface LayerPoints {
  points: THREE.Points;
  specs: ParticleSpec[];
  layer: EffectLayer;
  geo: THREE.BufferGeometry;
}

export class EffectPoints {
  group = new THREE.Group();
  private layers: LayerPoints[] = [];

  constructor(formula: EffectFormula) {
    formula.layers.forEach((layer, li) => {
      const specs = layerParticles(layer, formula.seed, li);
      const n = specs.length;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: layer.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      this.group.add(points);
      this.layers.push({ points, specs, layer, geo });
    });
  }

  update(localSec: number, burst: boolean, eventDuration: number): void {
    for (const L of this.layers) {
      const pos = L.geo.getAttribute("position") as THREE.BufferAttribute;
      const col = L.geo.getAttribute("aColor") as THREE.BufferAttribute;
      const size = L.geo.getAttribute("aSize") as THREE.BufferAttribute;
      const alpha = L.geo.getAttribute("aAlpha") as THREE.BufferAttribute;
      L.specs.forEach((spec, i) => {
        const st = particleStateAt(spec, L.layer, localSec, burst, eventDuration);
        if (!st) {
          pos.setXYZ(i, 0, 0, 0);
          alpha.setX(i, 0);
          size.setX(i, 0);
          return;
        }
        pos.setXYZ(i, st.pos[0], st.pos[1], st.pos[2]);
        col.setXYZ(i, st.color[0], st.color[1], st.color[2]);
        size.setX(i, st.size);
        alpha.setX(i, st.alpha);
      });
      pos.needsUpdate = true;
      col.needsUpdate = true;
      size.needsUpdate = true;
      alpha.needsUpdate = true;
    }
  }

  dispose(): void {
    this.group.traverse((obj) => {
      const p = obj as THREE.Points;
      if (p.isPoints) {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      }
    });
  }
}
