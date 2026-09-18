'use client';

import dynamic from 'next/dynamic';
import ChatBar from '@/components/ui/ChatBar';
import HUD from '@/components/ui/HUD';
import PointerLockOverlay from '@/components/ui/PointerLockOverlay';
import QuestionOverlay from '@/components/ui/QuestionOverlay';
import ChatHistoryPanel from '@/components/ui/ChatHistoryPanel';

// Dynamically import Scene to avoid SSR issues with Three.js/WebGL
const Scene = dynamic(() => import('@/components/scene/Scene'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a14]">
      <p className="text-[#E8D8B6] font-parchment text-xl italic tracking-wide">Gathering at the roundtable…</p>
    </div>
  ),
});

export default function Home() {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a14]">
      {/* 3D Canvas fills the entire viewport */}
      <div className="absolute inset-0">
        <Scene />
      </div>

      {/* 2D UI overlay layer */}
      <PointerLockOverlay />
      <HUD />
      <ChatBar />
      <QuestionOverlay />
      <ChatHistoryPanel />
    </main>
  );
}
