'use client'

import { useEffect, useRef } from 'react'
import { Renderer, Program, Mesh, Triangle, Color } from 'ogl'

// Silk WebGL fragment shader -- animated silk-noise cloth pattern.
// React Bits'ning kanonik Silk background naqshi. Butun sahifa uchun
// fixed inset-0 wrapper ichida ishlatiladi.

interface SilkProps {
  speed?: number
  scale?: number
  color?: string
  noiseIntensity?: number
  rotation?: number
}

const vertex = /* glsl */ `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

const fragment = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec2  uResolution;
uniform float uSpeed;
uniform float uScale;
uniform vec3  uColor;
uniform float uNoise;
uniform float uRot;

float rand(vec2 co) { return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 rotate(vec2 v, float a) {
  float s = sin(a); float c = cos(a);
  return mat2(c, -s, s, c) * v;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) - 0.5;
  uv.x *= uResolution.x / uResolution.y;
  uv = rotate(uv, uRot);

  float t = uTime * 0.15 * uSpeed;
  float k = uScale * 2.0;

  // Silk-like folds: superimposed sine waves with slow phase drift.
  float f1 = sin(uv.x * k * 3.0 + t * 1.8);
  float f2 = sin((uv.x + uv.y) * k * 4.2 + t * 1.2);
  float f3 = sin((uv.x - uv.y) * k * 5.4 + t * 0.9);
  float pattern = 0.5 + 0.5 * (f1 * 0.35 + f2 * 0.35 + f3 * 0.30);

  // Subtle grain over the folds -- keeps flat regions from looking static.
  float n = (rand(uv * 800.0 + t) - 0.5) * uNoise * 0.06;

  // Amplitude yumshaq: 0.85 baza + 0.35 pattern variance -- yorug'
  // "halo" oralig'i o'rniga silliq gradient. Grain ham 0.5 koeffitsient
  // bilan tanho contrast.
  vec3 col = uColor * (0.85 + pattern * 0.35 + n * 0.5);
  gl_FragColor = vec4(col, 1.0);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const c = new Color(hex)
  return [c.r, c.g, c.b]
}

export default function Silk({
  speed = 6.2,
  scale = 0.7,
  color = '#140547',
  noiseIntensity = 1.5,
  rotation = 1.3,
}: SilkProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // WebGL supported? Fallback: keep solid fon.
    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: false })
    } catch {
      container.style.background = color
      return
    }
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 1)
    container.appendChild(gl.canvas)
    ;(gl.canvas as HTMLCanvasElement).style.width = '100%'
    ;(gl.canvas as HTMLCanvasElement).style.height = '100%'
    ;(gl.canvas as HTMLCanvasElement).style.display = 'block'

    const [r, g, b] = hexToRgb(color)

    const geometry = new Triangle(gl)
    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uTime:       { value: 0 },
        uResolution: { value: [1, 1] },
        uSpeed:      { value: speed },
        uScale:      { value: scale },
        uColor:      { value: [r, g, b] },
        uNoise:      { value: noiseIntensity },
        uRot:        { value: rotation },
      },
    })
    const mesh = new Mesh(gl, { geometry, program })

    function resize() {
      const w = container?.clientWidth ?? window.innerWidth
      const h = container?.clientHeight ?? window.innerHeight
      renderer.setSize(w, h)
      program.uniforms.uResolution.value = [w * renderer.dpr, h * renderer.dpr]
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    let raf = 0
    let cancelled = false
    const start = performance.now()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const tick = () => {
      if (cancelled) return
      // Reduced motion: render bir marta va qotib qoladi.
      program.uniforms.uTime.value = reduced ? 0 : (performance.now() - start) / 1000
      renderer.render({ scene: mesh })
      if (!reduced) raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      // Ehtiyot bilan canvas'ni olib tashlash
      try { container.removeChild(gl.canvas) } catch { /* noop */ }
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) ext.loseContext()
    }
  }, [speed, scale, color, noiseIntensity, rotation])

  return <div ref={containerRef} style={{ width: '100%', height: '100%', background: color }} />
}
