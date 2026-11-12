import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";
/** Clone materials as well as the skeleton: cached GLTF materials remain untouched. */
export function prepareModel(source: THREE.Object3D) {
  const model = clone(source);
  const materials = new Map<THREE.Material, THREE.Material>();
  model.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const mesh = o as THREE.Mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const opaque = (source: THREE.Material) => {
      let m = materials.get(source);
      if (!m) {
        m = source.clone();
        m.transparent = false;
        m.opacity = 1;
        m.alphaTest = 0;
        m.depthWrite = true;
        m.depthTest = true;
        m.side = THREE.FrontSide;
        m.needsUpdate = true;
        materials.set(source, m);
      }
      return m;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(opaque)
      : opaque(mesh.material);
  });
  model.updateMatrixWorld(true);
  model.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const m = o as THREE.SkinnedMesh;
      m.skeleton.update();
      m.computeBoundingBox();
    }
  });
  const bounds = new THREE.Box3().setFromObject(model);
  return { model, bounds };
}
