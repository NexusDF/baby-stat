import * as THREE from 'three'

const TERM_MM = 514

export function visualScale(mm) {
  const ratio = Math.min(1, Math.max(mm, 1) / TERM_MM)
  return 0.4 + 0.6 * Math.pow(ratio, 0.55)
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function lerp(from, to, t) {
  return from + (to - from) * t
}

function smoothstep(t) {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

function skinMaterial(week) {
  const t = smoothstep((week - 4) / 36)
  const color = new THREE.Color('#ee9aa6').lerp(new THREE.Color('#f0b8ad'), t)
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: lerp(0.68, 0.55, t),
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.7,
    sheen: 0.72,
    sheenRoughness: 0.42,
    sheenColor: new THREE.Color('#ffe8e1'),
    envMapIntensity: 0.42,
  })
}

function featureMaterial(base) {
  return new THREE.MeshPhysicalMaterial({
    color: base.clone().offsetHSL(-0.008, 0.08, -0.16),
    roughness: 0.58,
    metalness: 0,
    sheen: 0.3,
    sheenColor: new THREE.Color('#f0c8c0'),
    envMapIntensity: 0.3,
  })
}

function framesAlong(curve, segments) {
  const normals = []
  const binormals = []
  const ref = new THREE.Vector3(0, 0, 1)
  const fallback = new THREE.Vector3(0, 1, 0)
  for (let i = 0; i <= segments; i++) {
    const tangent = curve.getTangentAt(i / segments).normalize()
    const normal = new THREE.Vector3().crossVectors(tangent, ref)
    if (normal.lengthSq() < 1e-8) normal.crossVectors(tangent, fallback)
    normal.normalize()
    const binormal = new THREE.Vector3().crossVectors(tangent, normal).normalize()
    normals.push(normal)
    binormals.push(binormal)
  }
  return { normals, binormals }
}

function createVaryingTube(curve, radiusAt, tubularSegments, radialSegments) {
  const frames = framesAlong(curve, tubularSegments)
  const positions = []
  const normals = []
  const uvs = []
  const indices = []

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const center = curve.getPointAt(u)
    const normal = frames.normals[i]
    const binormal = frames.binormals[i]
    const radius = radiusAt(u)
    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2
      const cos = -Math.cos(v)
      const sin = Math.sin(v)
      const nx = cos * normal.x + sin * binormal.x
      const ny = cos * normal.y + sin * binormal.y
      const nz = cos * normal.z + sin * binormal.z
      normals.push(nx, ny, nz)
      positions.push(center.x + radius * nx, center.y + radius * ny, center.z + radius * nz)
      uvs.push(u, j / radialSegments)
    }
  }

  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * (radialSegments + 1) + j
      const b = (i + 1) * (radialSegments + 1) + j
      const c = (i + 1) * (radialSegments + 1) + (j + 1)
      const d = i * (radialSegments + 1) + (j + 1)
      indices.push(a, b, d, b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  return geometry
}

function addSphere(group, geometry, material, position, scale) {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.copy(position)
  if (typeof scale === 'number') mesh.scale.setScalar(scale)
  else mesh.scale.set(scale.x, scale.y, scale.z)
  group.add(mesh)
  return mesh
}

function finish(inner, geometries, materials) {
  inner.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(inner)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  inner.position.sub(center)
  const wrapper = new THREE.Group()
  wrapper.add(inner)
  const maxDim = Math.max(size.x, size.y, size.z, 0.001)
  wrapper.scale.setScalar(1.52 / maxDim)
  wrapper.userData.geometries = [...geometries]
  wrapper.userData.materials = materials
  return wrapper
}

function buildDisc(week) {
  const geometries = new Set()
  const skin = skinMaterial(week)
  const sphere = new THREE.SphereGeometry(1, 48, 32)
  geometries.add(sphere)
  const inner = new THREE.Group()
  const disc = addSphere(inner, sphere, skin, new THREE.Vector3(), {
    x: 0.72,
    y: week === 4 ? 0.2 : 0.3,
    z: 0.56,
  })
  disc.rotation.z = 0.4
  if (week === 5) {
    addSphere(inner, sphere, skin, new THREE.Vector3(0.16, 0.08, 0.1), 0.18)
  }
  return finish(inner, geometries, [skin])
}

function profile(week) {
  const t = smoothstep((week - 6) / 34)
  return {
    week,
    t,
    headR: lerp(0.4, 0.27, smoothstep((week - 6) / 20)),
    start: lerp(2.28, 1.7, t),
    sweep: lerp(3.2, 2.0, t),
    arc: lerp(0.48, 0.62, t),
    body: lerp(0.72, 1, smoothstep((week - 6) / 16)),
    fat: smoothstep((week - 22) / 14),
    face: smoothstep((week - 11) / 7),
  }
}

function radiusAt(u, p) {
  const base = lerp(0.085, 0.15, p.body) * (1 + p.fat * 0.2)
  const envelope = 0.74 + 0.26 * Math.sin(Math.PI * clamp(u, 0, 1))
  const belly = 1 + p.fat * 0.38 * Math.exp(-(((u - 0.56) / 0.16) ** 2))
  return base * envelope * belly
}

function spineCurve(p) {
  const points = []
  const steps = 22
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const angle = p.start - p.sweep * u
    const radius = p.arc * (0.94 + 0.06 * Math.cos((u - 0.2) * Math.PI))
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      Math.sin(u * Math.PI) * 0.035,
    ))
  }
  return new THREE.CatmullRomCurve3(points)
}

function inward(point) {
  const vector = new THREE.Vector3(-point.x, -point.y, 0)
  if (vector.lengthSq() < 1e-6) vector.set(0, -1, 0)
  return vector.normalize()
}

function addLimb(group, sphere, material, geometries, points, radius, tip) {
  const curve = new THREE.CatmullRomCurve3(points)
  const geometry = new THREE.TubeGeometry(curve, 16, radius, 12, false)
  geometries.add(geometry)
  group.add(new THREE.Mesh(geometry, material))
  addSphere(group, sphere, material, points[0], radius * 1.05)
  const end = points[points.length - 1]
  if (tip === 'foot') {
    addSphere(group, sphere, material, end, { x: radius * 2.3, y: radius * 1.15, z: radius * 1.45 })
  } else {
    addSphere(group, sphere, material, end, { x: radius * 1.55, y: radius * 1.9, z: radius * 1.15 })
  }
}

function addLimbs(group, sphere, material, geometries, curve, p) {
  const grow = lerp(0.4, 1, smoothstep((p.week - 8) / 16))
  const armRadius = lerp(0.03, 0.048, p.t) * (1 + p.fat * 0.3)
  const legRadius = armRadius * 1.18

  for (const sign of [1, -1]) {
    const side = new THREE.Vector3(0, 0, sign)
    const shoulder = curve.getPointAt(0.22)
    const shoulderIn = inward(shoulder)
    const shoulderRadius = radiusAt(0.22, p)
    const root = shoulder.clone().addScaledVector(side, shoulderRadius * 0.95)
    const elbow = root.clone()
      .addScaledVector(shoulderIn, 0.28 * grow)
      .add(new THREE.Vector3(0, -0.05 * grow, sign * 0.03))
    const cheek = curve.getPointAt(0.08)
    const hand = cheek.clone()
      .addScaledVector(side, shoulderRadius * 0.7)
      .addScaledVector(inward(cheek), 0.04)
    addLimb(group, sphere, material, geometries, [root, elbow, hand], armRadius, 'hand')

    const hipPoint = curve.getPointAt(0.78)
    const hipIn = inward(hipPoint)
    const hipRadius = radiusAt(0.78, p)
    const hip = hipPoint.clone().addScaledVector(side, hipRadius * 0.92)
    const knee = hip.clone()
      .addScaledVector(hipIn, 0.32 * grow)
      .add(new THREE.Vector3(0, 0.08 * grow, sign * 0.04))
    const belly = curve.getPointAt(0.5)
    const foot = belly.clone()
      .addScaledVector(side, hipRadius * 0.65)
      .add(new THREE.Vector3(0.02, -0.05 * grow, sign * 0.02))
    addLimb(group, sphere, material, geometries, [hip, knee, foot], legRadius, 'foot')
  }
}

function addBuds(group, sphere, material, curve, p) {
  const amount = smoothstep((p.week - 5) / 3)
  const spots = [
    { u: 0.24, z: 1 },
    { u: 0.24, z: -1 },
    { u: 0.74, z: 1 },
    { u: 0.74, z: -1 },
  ]
  for (const spot of spots) {
    const point = curve.getPointAt(spot.u)
    const radius = radiusAt(spot.u, p)
    const position = point.clone()
      .add(new THREE.Vector3(0, 0, spot.z * radius * 0.9))
      .addScaledVector(inward(point), radius * 0.2)
    addSphere(group, sphere, material, position, radius * lerp(0.45, 0.85, amount))
  }
}

function addTail(group, material, geometries, curve, p) {
  const end = curve.getPointAt(1)
  const tangent = curve.getTangentAt(1).normalize()
  const length = lerp(0.34, 0.08, (p.week - 6) / 2)
  const rootRadius = radiusAt(1, p) * 0.8
  const tail = new THREE.CatmullRomCurve3([
    end,
    end.clone().addScaledVector(tangent, length * 0.55).add(new THREE.Vector3(0, -0.03, 0)),
    end.clone().addScaledVector(tangent, length),
  ])
  const geometry = createVaryingTube(tail, (u) => rootRadius * (1 - u * 0.86), 14, 10)
  geometries.add(geometry)
  group.add(new THREE.Mesh(geometry, material))
}

function addFace(group, sphere, materials, headCenter, headR, tangent, p) {
  const faceDir = new THREE.Vector3(-headCenter.x, -headCenter.y, 0)
  if (faceDir.lengthSq() < 1e-6) faceDir.set(0, -1, 0)
  faceDir.normalize()
  faceDir.add(new THREE.Vector3(tangent.x * -0.15, -0.2, 0.9))
  faceDir.normalize()

  const up = new THREE.Vector3(0, 1, 0)
  const side = new THREE.Vector3().crossVectors(faceDir, up)
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0)
  side.normalize()
  const eyeUp = new THREE.Vector3().crossVectors(side, faceDir).normalize()

  const nose = addSphere(
    group,
    sphere,
    materials.skin,
    headCenter.clone().addScaledVector(faceDir, headR * 0.96),
    headR * 0.075 * Math.max(p.face, 0.35),
  )
  nose.visible = p.face > 0.15

  if (p.week < 15) return

  for (const sign of [-1, 1]) {
    addSphere(
      group,
      sphere,
      materials.feature,
      headCenter.clone()
        .addScaledVector(faceDir, headR * 0.84)
        .addScaledVector(eyeUp, headR * 0.16)
        .addScaledVector(side, headR * 0.28 * sign),
      { x: headR * 0.065, y: headR * 0.028, z: headR * 0.05 },
    )
    addSphere(
      group,
      sphere,
      materials.skin,
      headCenter.clone()
        .addScaledVector(side, headR * 0.96 * sign)
        .addScaledVector(eyeUp, -headR * 0.02),
      { x: headR * 0.055, y: headR * 0.11, z: headR * 0.035 },
    )
  }
}

function buildCurled(week) {
  const geometries = new Set()
  const skin = skinMaterial(week)
  const feature = featureMaterial(skin.color)
  const materials = { skin, feature }
  const sphere = new THREE.SphereGeometry(1, 56, 40)
  geometries.add(sphere)

  const p = profile(week)
  const curve = spineCurve(p)
  const inner = new THREE.Group()
  inner.rotation.y = 0.5

  const body = createVaryingTube(curve, (u) => radiusAt(u, p), 56, 18)
  geometries.add(body)
  inner.add(new THREE.Mesh(body, skin))
  addSphere(inner, sphere, skin, curve.getPointAt(0), radiusAt(0, p))
  addSphere(inner, sphere, skin, curve.getPointAt(1), radiusAt(1, p))

  const neckU = 0.045
  const neck = curve.getPointAt(neckU)
  const tangent = curve.getTangentAt(neckU).normalize()
  const headCenter = neck.clone().addScaledVector(tangent, -p.headR * 0.62)
  const head = addSphere(inner, sphere, skin, headCenter, {
    x: p.headR * 0.96,
    y: p.headR * lerp(1.08, 1.02, p.t),
    z: p.headR * (0.94 + p.fat * 0.08),
  })
  head.rotation.z = 0.25

  if (week < 8) addTail(inner, skin, geometries, curve, p)
  if (week < 8) addBuds(inner, sphere, skin, curve, p)
  else addLimbs(inner, sphere, skin, geometries, curve, p)
  addFace(inner, sphere, materials, headCenter, p.headR, tangent, p)

  return finish(inner, geometries, [skin, feature])
}

export function buildFetus(week) {
  const safe = Math.min(40, Math.max(4, Math.round(week)))
  if (safe <= 5) return buildDisc(safe)
  return buildCurled(safe)
}

export function disposeFetus(root) {
  if (!root) return
  for (const geometry of root.userData.geometries ?? []) geometry.dispose()
  for (const material of root.userData.materials ?? []) material.dispose()
}
