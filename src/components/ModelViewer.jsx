import React, { Suspense, useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF, Stage } from '@react-three/drei'

function Model({ src, rotation, scale, mouse }) {
  const { scene } = useGLTF(src)
  const groupRef = useRef()

  useFrame(() => {
    if (!groupRef.current) return
    const targetX = mouse?.current ? mouse.current.y * 0.25 : 0
    const targetZ = mouse?.current ? mouse.current.x * 0.25 : 0
    groupRef.current.rotation.x += (rotation[0] + targetX - groupRef.current.rotation.x) * 0.06
    groupRef.current.rotation.z += (rotation[2] + targetZ - groupRef.current.rotation.z) * 0.06
  })

  return (
    <group ref={groupRef} rotation={rotation} scale={scale}>
      <primitive object={scene} />
    </group>
  )
}

function ModelHint({ visible }) {
  const [opacity, setOpacity] = useState(1)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setOpacity(0)
      setTimeout(() => setHidden(true), 400)
    }, 10000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!visible) {
      setOpacity(0)
      setTimeout(() => setHidden(true), 400)
    }
  }, [visible])

  if (hidden) return null

  return (
    <>
      <style>{`
        @keyframes hintPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
      `}</style>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none', zIndex: 10,
        opacity, transition: 'opacity 0.4s ease',
      }}>
        <div style={{
          borderRadius: '999px', padding: '8px 20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          color: '#334155', fontSize: '14px', fontWeight: 700, letterSpacing: '0.06em',
          animation: 'hintPulse 1.8s ease-in-out infinite', whiteSpace: 'nowrap',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16l-4-4 4-4M17 8l4 4-4 4M3 12h18"/>
          </svg>
          drag to rotate
        </div>
      </div>
    </>
  )
}

/**
 * Props:
 *   src        – path to .glb file (e.g. "/QDUntitled37_compressed_v2.glb")
 *   rotation   – [x, y, z] initial rotation in radians
 *   scale      – [x, y, z] scale
 *   camera     – { position, fov }
 *   environment – Stage environment name
 *   intensity  – Stage intensity
 */
export default function ModelViewer({
  src,
  rotation = [Math.PI / 2, 0, 0],
  scale = [1.5, 1.5, 1.5],
  camera = { position: [2, 0.5, 6], fov: 38 },
  environment = 'city',
  intensity = 0.6,
}) {
  const containerRef = useRef()
  const mouseRef = useRef(null)
  const [hint, setHint] = useState(true)

  const trackMouse = {
    onMouseMove: (e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
        y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
      }
    },
    onMouseLeave: () => { mouseRef.current = null },
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div
        ref={containerRef}
        className="h-full w-full"
        style={{ position: 'relative', transition: 'transform .22s ease', transformOrigin: 'center bottom' }}
        onPointerEnter={() => containerRef.current && (containerRef.current.style.transform = 'scale(1.06)')}
        onPointerLeave={() => containerRef.current && (containerRef.current.style.transform = 'scale(1)')}
        onPointerMove={() => setHint(false)}
        {...trackMouse}
      >
        <Canvas shadows camera={camera}>
          <Suspense fallback={null}>
            <Stage
              environment={environment}
              intensity={intensity}
              contactShadow={{ opacity: 0.5, blur: 2 }}
              center={{ disableY: false }}
            >
              <Model src={src} scale={scale} rotation={rotation} mouse={mouseRef} />
            </Stage>
          </Suspense>
          <OrbitControls enableZoom={false} autoRotate />
        </Canvas>
        <ModelHint visible={hint} />
      </div>
    </div>
  )
}
