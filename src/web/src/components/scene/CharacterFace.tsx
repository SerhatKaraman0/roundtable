'use client';

import { useLayoutEffect, useState } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { PortraitCrop } from '@/types';

// Portrait plate: taller than wide so a headshot fills it instead of a landscape slice.
const FACE_WIDTH_FACTOR = 1.7;
const FACE_HEIGHT_FACTOR = 2.25;
const FACE_Z_FACTOR = 1.5;
const FACE_TEXTURE_MAX = 512;

interface CharacterFaceProps {
  headRadius: number;
  portraitSrc: string;
  portraitCrop: PortraitCrop;
  faceWidth?: number;
  faceHeight?: number;
}

function sourceSize(img: TexImageSource): { width: number; height: number } | null {
  if ('width' in img && 'height' in img && img.width && img.height) {
    return { width: img.width, height: img.height };
  }
  return null;
}

function cropFaceTexture(
  source: THREE.Texture,
  crop: PortraitCrop,
  planeAspect: number,
): THREE.CanvasTexture | null {
  const size = sourceSize(source.image);
  if (!size) return null;

  const { width: imgW, height: imgH } = size;
  let cropW = THREE.MathUtils.clamp(crop.width, 0.05, 1) * imgW;
  let cropH = cropW / planeAspect;

  if (cropH > imgH) {
    cropH = imgH;
    cropW = cropH * planeAspect;
  }
  if (cropW > imgW) {
    cropW = imgW;
    cropH = cropW / planeAspect;
  }

  const sx = THREE.MathUtils.clamp(crop.cx * imgW - cropW / 2, 0, imgW - cropW);
  const sy = THREE.MathUtils.clamp(crop.cy * imgH - cropH / 2, 0, imgH - cropH);

  const outW = Math.max(1, Math.round(Math.min(FACE_TEXTURE_MAX, cropW)));
  const outH = Math.max(1, Math.round(outW / planeAspect));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(source.image as CanvasImageSource, sx, sy, cropW, cropH, 0, 0, outW, outH);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * CharacterFace — a portrait-aspect plate on the character's head, filled
 * with a canvas-cropped headshot so the photo maps 1:1 onto the plane.
 */
export default function CharacterFace({
  headRadius,
  portraitSrc,
  portraitCrop,
  faceWidth = headRadius * FACE_WIDTH_FACTOR,
  faceHeight = headRadius * FACE_HEIGHT_FACTOR,
}: CharacterFaceProps) {
  const source = useTexture(portraitSrc);
  const [faceMap, setFaceMap] = useState<THREE.CanvasTexture | null>(null);
  const faceZ = headRadius * FACE_Z_FACTOR;
  const faceY = -headRadius * 0.7;
  const planeAspect = faceWidth / faceHeight;

  useLayoutEffect(() => {
    const tex = cropFaceTexture(source, portraitCrop, planeAspect);
    if (!tex) return;
    setFaceMap(tex);
    return () => {
      tex.dispose();
    };
  }, [source, portraitCrop, planeAspect]);

  if (!faceMap) return null;

  return (
    <mesh position={[0, faceY, faceZ]} raycast={() => null}>
      <planeGeometry args={[faceWidth, faceHeight]} />
      <meshBasicMaterial
        color="white"
        map={faceMap}
        side={THREE.FrontSide}
        toneMapped={false}
        transparent={false}
        opacity={1}
      />
    </mesh>
  );
}
