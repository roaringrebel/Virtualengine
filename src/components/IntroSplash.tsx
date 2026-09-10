import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, X, Sparkles } from 'lucide-react';

interface IntroSplashProps {
  onComplete: () => void;
}

export const IntroSplash: React.FC<IntroSplashProps> = ({ onComplete }) => {
  const [isFading, setIsFading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasCompletedRef = useRef(false);

  const handleFinish = () => {
    if (hasCompletedRef.current) return;
    hasCompletedRef.current = true;
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 450);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleFinish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration || 4.1;
    const pct = Math.min(100, Math.round((current / duration) * 100));
    setVideoProgress(pct);

    // Auto-advance slightly before hard cut to ensure smooth transition
    if (current >= duration - 0.15) {
      handleFinish();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center select-none transition-all duration-500 ${
        isFading ? 'opacity-0 scale-[0.99] pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Background Blueprint Grid matching the intro video styling */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,#E2E8F0_1px,transparent_1px),linear-gradient(to_bottom,#E2E8F0_1px,transparent_1px)] bg-[size:4rem_4rem]" 
      />

      {/* Top Header / Skip Button Bar */}
      <div className="absolute top-0 inset-x-0 p-4 md:p-6 flex items-center justify-between z-20 pointer-events-auto">
        <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>BHARAT AEROTWIN // SYSTEM INITIALIZATION</span>
        </div>

        <button
          onClick={handleFinish}
          className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 hover:bg-[#F97316] text-white text-[11px] font-bold font-mono tracking-wider transition-all duration-200 shadow-md hover:shadow-lg cursor-pointer transform hover:scale-105"
          title="Skip Intro (Esc / Space / Enter)"
        >
          <span>SKIP INTRO</span>
          <kbd className="px-1 py-0.2 rounded bg-white/20 text-[9px] font-sans">ESC</kbd>
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Central Cropped Video Presentation */}
      <div className="relative z-10 w-full h-full max-w-7xl max-h-[90vh] flex items-center justify-center p-2 md:p-6">
        <video
          ref={videoRef}
          src="/intro_video.mp4"
          className="w-full h-full object-contain rounded-lg drop-shadow-sm"
          autoPlay
          playsInline
          muted
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleFinish}
          onClick={handleFinish}
        />
      </div>

      {/* Bottom Minimal Progress Bar */}
      <div className="absolute bottom-0 inset-x-0 h-1 bg-slate-100">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-100 ease-out"
          style={{ width: `${videoProgress}%` }}
        />
      </div>
    </div>
  );
};

export default IntroSplash;
