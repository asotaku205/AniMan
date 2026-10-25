/**
 * Phát hạt 3D (Phase 5): mỗi lớp là một THREE.Points với shader riêng
 * (kích thước + độ mờ từng hạt, mặt nạ theo hình hạt). Vị trí hạt tính
 * lại từ thời gian timeline mỗi khung hình nên tua tới lui vẫn đúng.
 * Hình hạt: 0 chấm tròn · 1 sao 4 cánh · 2 vệt dài dọc · 3 ảnh tự tải
 * (uMap, màu hạt nhân với ảnh). Góc xoay từng hạt qua aAngle.
 */

import * as THREE from "three";
import {
  layerParticles,
  layerTexture,
  particleStateAt,
  type EffectFormula,
  type EffectLayer,
  type ParticleSpec,
} from "./effectFormula";

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute float aAngle;
attribute vec3 aColor;
varying float vAlpha;
varying float vAngle;
varying vec3 vColor;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vAngle = aAngle;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (240.0 / max(0.1, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying float vAlpha;
varying float vAngle;
varying vec3 vColor;
uniform float uTexture;
uniform sampler2D uMap;
void main() {
  // Xoay quanh tâm hạt trước khi vẽ hình.
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vAngle);
  float s = sin(vAngle);
  uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
  if (uTexture > 2.5) {
    vec4 tex = texture2D(uMap, uv + 0.5);
    gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
    return;
  }
  float d = length(uv);
  float mask;
  if (uTexture > 0.5 && uTexture < 1.5) {
    // Sao 4 cánh: tròn mềm nhân với 4 búp theo |cos 2θ|.
    float lobes = abs(cos(2.0 * atan(uv.y, uv.x)));
    mask = smoothstep(0.5, 0.05, d) * (0.25 + 0.75 * lobes);
  } else if (uTexture > 1.5) {
    // Vệt dài dọc (xoay theo góc hạt, mặc định đứng dọc).
    mask = smoothstep(0.5, 0.08, length(vec2(uv.x * 3.0, uv.y)));
  } else {
    mask = smoothstep(0.5, 0.1, d);
  }
  gl_FragColor = vec4(vColor, mask * vAlpha);
}`;

// Ảnh 1x1 trắng dùng khi lớp không có ảnh tự tải (tránh sampler rỗng).
const WHITE_TEX = (() => {
  const tex = new THREE.DataTexture(
    new Uint8Array([255, 255, 255, 255]),
    1,
    1,
  );
  tex.needsUpdate = true;
  return tex;
})();

interface LayerPoints {
  points: THREE.Points;
  specs: ParticleSpec[];
  layer: EffectLayer;
  geo: THREE.BufferGeometry;
  customTex: THREE.Texture | null;
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
      geo.setAttribute("aAngle", new THREE.BufferAttribute(new Float32Array(n), 1));
      const texKind = layerTexture(layer);
      let customTex: THREE.Texture | null = null;
      let texCode = 0;
      if (texKind === "star") texCode = 1;
      else if (texKind === "streak") texCode = 2;
      else if (texKind === "custom") {
        texCode = 3;
        if (layer.textureDataUrl) {
          customTex = new THREE.TextureLoader().load(layer.textureDataUrl);
        }
      }
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTexture: { value: texCode },
          uMap: { value: customTex ?? WHITE_TEX },
        },
        transparent: true,
        depthWrite: false,
        blending: layer.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      this.group.add(points);
      this.layers.push({ points, specs, layer, geo, customTex });
    });
  }

  update(localSec: number, burst: boolean, eventDuration: number): void {
    for (const L of this.layers) {
      const pos = L.geo.getAttribute("position") as THREE.BufferAttribute;
      const col = L.geo.getAttribute("aColor") as THREE.BufferAttribute;
      const size = L.geo.getAttribute("aSize") as THREE.BufferAttribute;
      const alpha = L.geo.getAttribute("aAlpha") as THREE.BufferAttribute;
      const angle = L.geo.getAttribute("aAngle") as THREE.BufferAttribute;
      L.specs.forEach((spec, i) => {
        const st = particleStateAt(spec, L.layer, localSec, burst, eventDuration);
        if (!st) {
          pos.setXYZ(i, 0, 0, 0);
          alpha.setX(i, 0);
          size.setX(i, 0);
          angle.setX(i, 0);
          return;
        }
        pos.setXYZ(i, st.pos[0], st.pos[1], st.pos[2]);
        col.setXYZ(i, st.color[0], st.color[1], st.color[2]);
        size.setX(i, st.size);
        alpha.setX(i, st.alpha);
        angle.setX(i, st.angle);
      });
      pos.needsUpdate = true;
      col.needsUpdate = true;
      size.needsUpdate = true;
      alpha.needsUpdate = true;
      angle.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const L of this.layers) {
      if (L.customTex) L.customTex.dispose();
    }
    this.group.traverse((obj) => {
      const p = obj as THREE.Points;
      if (p.isPoints) {
        p.geometry.dispose();
        (p.material as THREE.Material).dispose();
      }
    });
  }
}
