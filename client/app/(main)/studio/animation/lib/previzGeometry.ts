/** Hình học previz dùng chung giữa sân khấu và bộ dựng phim. */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { PrevizObjectKind } from "./previz";

export interface CharacterParts {
  root: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  head: THREE.Group;
  torso: THREE.Group;
}

const makeMat = (color: string, roughness = 0.78) =>
  new THREE.MeshStandardMaterial({ color, roughness });

/** Mannequin hoạt hình bo tròn, có mặt, tóc, quần áo và giày. */
export function buildPrevizCharacter(color: string, height: number): CharacterParts {
  const h = Math.max(0.5, height);
  const shirt = makeMat(color);
  const skin = makeMat("#e7b99c");
  const pants = makeMat("#30354a");
  const shoes = makeMat("#25222b");
  const hair = makeMat("#30242b");
  const eye = new THREE.MeshBasicMaterial({ color: "#211a1c" });
  const root = new THREE.Group();
  const legLen = h * 0.43;
  const torsoH = h * 0.34;
  const headR = h * 0.09;
  const limbR = h * 0.052;
  const legR = h * 0.067;

  const capsuleLimb = (radius: number, length: number, material: THREE.Material) => {
    const pivot = new THREE.Group();
    const geometry = new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 5, 12);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -length / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    return pivot;
  };

  const legL = capsuleLimb(legR, legLen, pants);
  legL.position.set(-h * 0.075, legLen, 0);
  const legRPart = capsuleLimb(legR, legLen, pants);
  legRPart.position.set(h * 0.075, legLen, 0);
  for (const [x, material] of [[-h * 0.075, shoes], [h * 0.075, shoes]] as const) {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(h * 0.075, 14, 10), material);
    shoe.scale.set(1.12, 0.52, 1.5);
    shoe.position.set(x, h * 0.035, h * 0.025);
    shoe.castShadow = true;
    root.add(shoe);
  }

  const torso = new THREE.Group();
  torso.position.y = legLen;
  const torsoMesh = new THREE.Mesh(
    new RoundedBoxGeometry(h * 0.34, torsoH, h * 0.22, 4, h * 0.065),
    shirt,
  );
  torsoMesh.position.y = torsoH / 2;
  torsoMesh.castShadow = true;
  torsoMesh.receiveShadow = true;
  torso.add(torsoMesh);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.045, h * 0.05, h * 0.09, 12), skin);
  neck.position.y = torsoH + h * 0.035;
  neck.castShadow = true;
  torso.add(neck);

  const armLen = h * 0.31;
  const armL = capsuleLimb(limbR, armLen, shirt);
  armL.position.set(-h * 0.22, torsoH * 0.88, 0);
  const armR = capsuleLimb(limbR, armLen, shirt);
  armR.position.set(h * 0.22, torsoH * 0.88, 0);
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(h * 0.055, 12, 10), skin);
    hand.position.y = -armLen + h * 0.025;
    hand.castShadow = true;
    arm.add(hand);
  }
  torso.add(armL, armR);

  const head = new THREE.Group();
  head.position.y = torsoH + h * 0.07;
  const face = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), skin);
  face.castShadow = true;
  head.add(face);
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(headR * 1.04, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    hair,
  );
  hairCap.position.y = headR * 0.04;
  hairCap.castShadow = true;
  head.add(hairCap);
  for (const x of [-headR * 0.34, headR * 0.34]) {
    const eyeMesh = new THREE.Mesh(new THREE.SphereGeometry(h * 0.012, 8, 6), eye);
    eyeMesh.position.set(x, headR * 0.02, headR * 0.91);
    head.add(eyeMesh);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(h * 0.014, 8, 6), skin);
  nose.position.set(0, -headR * 0.12, headR * 0.99);
  head.add(nose);
  torso.add(head);

  root.add(legL, legRPart, torso);
  return { root, armL, armR, legL, legR: legRPart, head, torso };
}

/** Đạo cụ bo cạnh và cây nhiều tầng thay cho các khối nguyên thủy trơn. */
export function buildPrevizProp(
  kind: PrevizObjectKind,
  color: string,
  size: number,
  name = "",
): THREE.Object3D {
  const mat = makeMat(color, 0.84);
  if (kind === "cylinder" && /cây|tree/i.test(name)) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.07, size * 0.1, size * 0.52, 9),
      makeMat("#705039"),
    );
    trunk.position.y = size * 0.26;
    trunk.castShadow = true;
    tree.add(trunk);
    for (const [y, radius, shade] of [
      [0.52, 0.34, 1],
      [0.72, 0.28, 0.93],
      [0.88, 0.2, 0.86],
    ] as const) {
      const foliage = new THREE.Color(color);
      foliage.offsetHSL(0, 0, (y - 0.52) * 0.18);
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(size * radius, 1),
        new THREE.MeshStandardMaterial({ color: foliage, roughness: 0.9 }),
      );
      crown.scale.y = shade;
      crown.position.y = size * y;
      crown.castShadow = true;
      crown.receiveShadow = true;
      tree.add(crown);
    }
    return tree;
  }
  if (kind === "cylinder") {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(size * 0.38, size * 0.42, size, 12),
      mat,
    );
    mesh.position.y = size / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  if (kind === "box" && /bàn|table|desk/i.test(name)) {
    const table = new THREE.Group();
    const top = new THREE.Mesh(
      new RoundedBoxGeometry(size, size * 0.14, size * 0.72, 3, Math.min(size * 0.06, 0.06)),
      mat,
    );
    top.position.y = size * 0.76;
    top.castShadow = true;
    top.receiveShadow = true;
    table.add(top);
    const legMat = makeMat("#5a4331");
    for (const x of [-1, 1]) for (const z of [-1, 1]) {
      const leg = new THREE.Mesh(
        new RoundedBoxGeometry(size * 0.09, size * 0.68, size * 0.09, 2, size * 0.025),
        legMat,
      );
      leg.position.set(x * size * 0.4, size * 0.36, z * size * 0.27);
      leg.castShadow = true;
      table.add(leg);
    }
    return table;
  }
  if (kind === "box" && /ghế|bench/i.test(name)) {
    const bench = new THREE.Group();
    const seat = new THREE.Mesh(
      new RoundedBoxGeometry(size * 1.8, size * 0.16, size * 0.56, 3, Math.min(size * 0.06, 0.06)),
      mat,
    );
    seat.position.y = size * 0.5;
    seat.castShadow = true;
    bench.add(seat);
    for (const x of [-1, 1]) {
      const leg = new THREE.Mesh(
        new RoundedBoxGeometry(size * 0.12, size * 0.48, size * 0.14, 2, size * 0.03),
        makeMat("#4e3b2e"),
      );
      leg.position.set(x * size * 0.66, size * 0.24, 0);
      leg.castShadow = true;
      bench.add(leg);
    }
    return bench;
  }
  if (kind === "box" && /đá|rock|boulder/i.test(name)) {
    const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(size * 0.64, 1), mat);
    rock.scale.set(1.2, 0.78, 0.95);
    rock.position.y = size * 0.42;
    rock.castShadow = true;
    rock.receiveShadow = true;
    return rock;
  }
  const width = kind === "wall" ? size * 3 : size;
  const height = kind === "wall" ? size * 2.2 : size;
  const depth = kind === "wall" ? 0.15 : size;
  const mesh = new THREE.Mesh(
    new RoundedBoxGeometry(
      width,
      height,
      depth,
      3,
      Math.min(size * 0.06, depth * 0.4, height * 0.4, width * 0.4),
    ),
    mat,
  );
  mesh.position.y = height / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
