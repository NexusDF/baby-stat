import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { buildFetus, disposeFetus, visualScale } from './fetusModel.js'

function makeShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 8, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(92, 48, 44, 0.28)')
  gradient.addColorStop(1, 'rgba(92, 48, 44, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

export function createStage(host, { onInteract, onFail } = {}) {
  const canvas = document.createElement('canvas')
  canvas.setAttribute('role', 'img')
  canvas.style.touchAction = 'none'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.display = 'block'
  host.appendChild(canvas)

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    onFail?.()
    return null
  }
  if (!renderer.getContext()) {
    renderer.dispose()
    onFail?.()
    return null
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1

  const scene = new THREE.Scene()
  scene.environmentIntensity = 0.32
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envMap
  pmrem.dispose()

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
  camera.position.set(1.15, 0.22, 3.85)

  scene.add(new THREE.HemisphereLight(0xfff3ee, 0xecc8be, 1.05))
  const key = new THREE.DirectionalLight(0xfff6f2, 2.05)
  key.position.set(2.2, 3.5, 2.4)
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xffc8cc, 0.7)
  fill.position.set(-2.8, 0.6, 2.2)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(0xfffaf8, 1.25)
  rim.position.set(-1.2, 2.4, -3.4)
  scene.add(rim)

  const shadowTex = makeShadowTexture()
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  scene.add(shadow)

  const holder = new THREE.Group()
  scene.add(holder)

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const controls = new OrbitControls(camera, canvas)
  controls.enablePan = false
  controls.enableDamping = !reduceMotion
  controls.dampingFactor = 0.08
  controls.rotateSpeed = 0.7
  controls.minDistance = 2.55
  controls.maxDistance = 6.4
  controls.minPolarAngle = Math.PI * 0.28
  controls.maxPolarAngle = Math.PI * 0.7
  controls.target.set(0, -0.02, 0)
  controls.autoRotate = !reduceMotion
  controls.autoRotateSpeed = 0.5
  controls.update()

  canvas.addEventListener('pointerdown', () => onInteract?.(), { once: true })

  let fetus = null
  let grow = 1
  let targetGrow = 1
  let snapped = false
  let alive = true

  function resize() {
    const width = host.clientWidth
    const height = host.clientHeight
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
  }

  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  function tick(now) {
    if (!alive) return
    const elapsed = now / 1000
    grow += (targetGrow - grow) * (reduceMotion ? 1 : 0.14)
    holder.scale.setScalar(grow)
    holder.position.y = reduceMotion ? 0 : Math.sin(elapsed * 0.85) * 0.028
    shadow.position.y = -0.8 * grow
    shadow.scale.setScalar(Math.max(0.42, grow))
    controls.update()
    renderer.render(scene, camera)
  }

  renderer.setAnimationLoop(tick)

  return {
    setWeek(week, spanMm) {
      if (fetus) {
        holder.remove(fetus)
        disposeFetus(fetus)
      }
      fetus = buildFetus(week)
      holder.add(fetus)
      targetGrow = visualScale(spanMm)
      if (!snapped) {
        grow = targetGrow
        holder.scale.setScalar(grow)
        snapped = true
      }
      canvas.setAttribute(
        'aria-label',
        `Стилизованная трёхмерная модель на ${week}-й неделе беременности. Можно вращать пальцем или мышью.`,
      )
    },
    dispose() {
      alive = false
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.dispose()
      if (fetus) disposeFetus(fetus)
      envMap.dispose()
      shadow.geometry.dispose()
      shadow.material.map?.dispose()
      shadow.material.dispose()
      renderer.dispose()
      canvas.remove()
    },
  }
}
