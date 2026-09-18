'use client';

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useChatStore } from '@/store/useChatStore';
import { CAMERA_Y, CAMERA_Z } from '@/lib/constants';

const PITCH_LIMIT = (80 * Math.PI) / 180; // ±80° vertical clamp

/**
 * FPS-style look-around camera rig using the Pointer Lock API directly.
 *
 * - Camera position is fixed at the user's seat (no WASD movement).
 * - Mouse movement rotates yaw (horizontal) and pitch (vertical).
 * - Pitch is clamped to ±80° so the camera can't flip upside down.
 * - Pointer lock is released when the chat input is focused.
 * - Store is kept in sync with lock state.
 *
 * Re-verified (round 5 perf pass): yaw/pitch live ONLY in useRef below and are
 * applied to camera.quaternion inside useFrame. The mousemove handler never
 * calls setState/Zustand — so mouse movement causes zero React re-renders.
 * The only Zustand write here (setPointerLocked) fires on pointerlockchange,
 * not per-frame. This was not the cause of the 8-12fps drop (see the glass
 * material `transmission` fix in RoundTable.tsx for the actual root cause).
 */
export default function CameraRig() {
  const { camera, gl } = useThree();
  const setPointerLocked = useChatStore((s) => s.setPointerLocked);
  const isChatFocused = useChatStore((s) => s.isChatFocused);

  const yaw = useRef(0);
  const pitch = useRef(0); // level view at character face height (no downward tilt)

  // Fix camera at the user's seat position
  useEffect(() => {
    camera.position.set(0, CAMERA_Y, CAMERA_Z);
  }, [camera]);

  // Track pointer lock changes
  useEffect(() => {
    const canvas = gl.domElement;

    const onLockChange = () => {
      const locked = document.pointerLockElement === canvas;
      setPointerLocked(locked);
    };

    document.addEventListener('pointerlockchange', onLockChange);
    return () => document.removeEventListener('pointerlockchange', onLockChange);
  }, [gl.domElement, setPointerLocked]);

  // Request pointer lock on canvas click (only when chat is not focused)
  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (!isChatFocused && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    };

    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [gl.domElement, isChatFocused]);

  // Mouse move handler for FPS look
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;

      const sensitivity = 0.002;
      yaw.current -= e.movementX * sensitivity;
      pitch.current -= e.movementY * sensitivity;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -PITCH_LIMIT, PITCH_LIMIT);
    };

    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, [gl.domElement]);

  // Apply yaw + pitch to camera every frame
  useFrame(() => {
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  });

  return null;
}
