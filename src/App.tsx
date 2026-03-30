/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'motion/react';
import { 
  Ghost, Cat, Moon, Sun, Star, Bird, Lamp, Search, 
  HelpCircle, RefreshCw, Trophy, Volume2, Map,
  Fish, Anchor, Waves, Rocket, Orbit, Telescope
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types & Data ---

interface HiddenObject {
  id: string;
  name: string;
  icon: React.ReactNode;
  x: number; // percentage
  y: number; // percentage
  color: string;
  animation?: any;
}

interface Level {
  id: string;
  title: string;
  description: string;
  bgGradient: string;
  objects: HiddenObject[];
}

const LEVELS: Level[] = [
  {
    id: 'forest',
    title: 'الغابة الغامضة',
    description: 'ابحث عن أصدقاء الغابة في الليل!',
    bgGradient: 'radial-gradient(circle at center, #0a1a0a 0%, #000 100%)',
    objects: [
      { id: 'f1', name: 'بومة', icon: <Bird size={48} />, x: 20, y: 30, color: 'text-amber-200', animation: { y: [0, -10, 0] } },
      { id: 'f2', name: 'قطة', icon: <Cat size={48} />, x: 75, y: 25, color: 'text-gray-400', animation: { rotate: [0, 5, -5, 0] } },
      { id: 'f3', name: 'فانوس', icon: <Lamp size={48} />, x: 45, y: 75, color: 'text-yellow-400', animation: { scale: [1, 1.1, 1] } },
      { id: 'f4', name: 'شبح طيب', icon: <Ghost size={48} />, x: 65, y: 55, color: 'text-purple-200', animation: { x: [0, 15, 0] } },
    ]
  },
  {
    id: 'space',
    title: 'الفضاء الخارجي',
    description: 'اكتشف الكواكب والنجوم البعيدة!',
    bgGradient: 'radial-gradient(circle at center, #0a0a1a 0%, #000 100%)',
    objects: [
      { id: 's1', name: 'صاروخ', icon: <Rocket size={48} />, x: 30, y: 20, color: 'text-red-400', animation: { y: [0, -20, 0], x: [0, 10, 0] } },
      { id: 's2', name: 'كوكب', icon: <Orbit size={48} />, x: 80, y: 40, color: 'text-blue-400', animation: { rotate: 360 } },
      { id: 's3', name: 'نجمة كبيرة', icon: <Star size={56} />, x: 15, y: 70, color: 'text-yellow-200', animation: { scale: [1, 1.3, 1] } },
      { id: 's4', name: 'تلسكوب', icon: <Telescope size={48} />, x: 60, y: 80, color: 'text-slate-300' },
    ]
  },
  {
    id: 'ocean',
    title: 'أعماق البحار',
    description: 'ماذا يختبئ تحت الأمواج الزرقاء؟',
    bgGradient: 'radial-gradient(circle at center, #051a2a 0%, #000 100%)',
    objects: [
      { id: 'o1', name: 'سمكة', icon: <Fish size={48} />, x: 25, y: 40, color: 'text-orange-400', animation: { x: [-20, 20, -20] } },
      { id: 'o2', name: 'مرساة', icon: <Anchor size={48} />, x: 70, y: 75, color: 'text-slate-500' },
      { id: 'o3', name: 'أمواج', icon: <Waves size={48} />, x: 50, y: 20, color: 'text-cyan-300', animation: { x: [-10, 10, -10] } },
      { id: 'o4', name: 'كنز', icon: <Star size={48} className="fill-yellow-500" />, x: 85, y: 30, color: 'text-yellow-500', animation: { scale: [1, 1.2, 1] } },
    ]
  }
];

// --- Components ---

export default function App() {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [foundObjects, setFoundObjects] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'level-complete' | 'all-complete'>('start');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const currentLevel = LEVELS[currentLevelIdx];

  // Smooth flashlight movement
  const flashlightX = useMotionValue(0);
  const flashlightY = useMotionValue(0);
  const smoothX = useSpring(flashlightX, { damping: 30, stiffness: 200 });
  const smoothY = useSpring(flashlightY, { damping: 30, stiffness: 200 });

  // --- TTS Logic ---

  const speakName = async (name: string) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `قل بوضوح وحماس للأطفال: ${name}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioData = Uint8Array.from(atob(base64Audio), c => c.charCodeAt(0)).buffer;
        const audioBuffer = await audioContextRef.current.decodeAudioData(audioData);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsSpeaking(false);
        source.start();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
    }
  };

  // --- Handlers ---

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current || gameState !== 'playing') return;
    const rect = containerRef.current.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    setMousePos({ x, y });
    flashlightX.set(x);
    flashlightY.set(y);
  };

  const checkDiscovery = (obj: HiddenObject) => {
    if (gameState !== 'playing') return;
    if (!foundObjects.includes(obj.id)) {
      setFoundObjects(prev => {
        const newFound = [...prev, obj.id];
        if (newFound.length === currentLevel.objects.length) {
          setTimeout(() => {
            if (currentLevelIdx === LEVELS.length - 1) {
              setGameState('all-complete');
            } else {
              setGameState('level-complete');
            }
          }, 1000);
        }
        return newFound;
      });
      speakName(obj.name);
    }
  };

  const nextLevel = () => {
    setFoundObjects([]);
    setCurrentLevelIdx(prev => prev + 1);
    setGameState('playing');
  };

  const restartGame = () => {
    setFoundObjects([]);
    setCurrentLevelIdx(0);
    setGameState('start');
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-sans select-none text-right" dir="rtl">
      <AnimatePresence mode="wait">
        {/* --- Start Screen --- */}
        {gameState === 'start' && (
          <motion.div 
            key="start"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-[#050505] text-white p-6"
          >
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="mb-8 flex flex-col items-center"
            >
              <div className="w-32 h-32 bg-yellow-400 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(250,204,21,0.4)] mb-6">
                <Search size={64} className="text-black" />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-tighter">كشاف المغامرات</h1>
              <p className="text-xl md:text-2xl text-slate-400 max-w-md text-center leading-relaxed">
                استخدم كشافك السحري لتجد الأشياء المخبأة في الظلام!
              </p>
            </motion.div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-3xl">
              {LEVELS.map((level, idx) => (
                <button
                  key={level.id}
                  onClick={() => {
                    setCurrentLevelIdx(idx);
                    setGameState('playing');
                  }}
                  className="group relative overflow-hidden rounded-2xl p-6 bg-white/5 border border-white/10 hover:border-yellow-400/50 transition-all text-right"
                >
                  <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Map size={40} className="text-yellow-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-1">{level.title}</h3>
                  <p className="text-sm text-slate-400">{level.description}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* --- Playing Screen --- */}
        {gameState === 'playing' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full h-full cursor-none touch-none"
            style={{ background: currentLevel.bgGradient }}
            onMouseMove={handleMouseMove}
            onTouchMove={handleMouseMove}
          >
            {/* Objects Layer */}
            <div className="absolute inset-0">
              {currentLevel.objects.map((obj) => (
                <motion.div
                  key={obj.id}
                  animate={obj.animation ? obj.animation : {}}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${obj.color} transition-opacity duration-1000`}
                  style={{ 
                    left: `${obj.x}%`, 
                    top: `${obj.y}%`,
                    opacity: foundObjects.includes(obj.id) ? 1 : 0.05
                  }}
                >
                  <div className="relative group">
                    {obj.icon}
                    {foundObjects.includes(obj.id) && (
                      <motion.div 
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                      >
                        {obj.name}
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Flashlight Mask */}
            <motion.div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(circle 140px at ${mousePos.x}px ${mousePos.y}px, transparent 0%, rgba(0,0,0,0.98) 100%)`
              }}
            />

            {/* Triggers */}
            {currentLevel.objects.map((obj) => (
              <div
                key={`trigger-${obj.id}`}
                className="absolute w-32 h-32 transform -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${obj.x}%`, top: `${obj.y}%` }}
                onMouseEnter={() => checkDiscovery(obj)}
                onTouchStart={() => checkDiscovery(obj)}
              />
            ))}

            {/* HUD */}
            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
              <div className="bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-white/10 shadow-2xl">
                <div className="flex items-center gap-4 mb-3">
                  <div className="p-2 bg-yellow-400 rounded-lg">
                    <Search size={20} className="text-black" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg leading-none">{currentLevel.title}</h2>
                    <p className="text-slate-400 text-xs mt-1">ابحث عن جميع العناصر!</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {currentLevel.objects.map(obj => (
                    <motion.div 
                      key={`status-${obj.id}`}
                      animate={{ scale: foundObjects.includes(obj.id) ? [1, 1.2, 1] : 1 }}
                      className={`w-10 h-2 rounded-full transition-colors duration-500 ${foundObjects.includes(obj.id) ? 'bg-yellow-400' : 'bg-white/10'}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 pointer-events-auto">
                <button 
                  onClick={restartGame}
                  className="bg-white/5 hover:bg-white/10 text-white p-4 rounded-2xl backdrop-blur-md border border-white/10 transition-all"
                >
                  <RefreshCw size={24} />
                </button>
              </div>
            </div>

            {/* Visual Flashlight Ring */}
            <motion.div
              className="absolute pointer-events-none border border-white/10 rounded-full shadow-[0_0_100px_rgba(255,255,255,0.05)]"
              style={{
                width: 280,
                height: 280,
                x: smoothX,
                y: smoothY,
                translateX: -140,
                translateY: -140,
              }}
            >
              <div className="absolute inset-0 rounded-full border-2 border-white/5 animate-pulse" />
            </motion.div>

            {/* Speaking Indicator */}
            {isSpeaking && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-yellow-400 text-black px-6 py-3 rounded-full font-bold shadow-xl"
              >
                <Volume2 size={20} className="animate-bounce" />
                <span>استمع جيداً!</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* --- Level Complete Screen --- */}
        {gameState === 'level-complete' && (
          <motion.div 
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/90 backdrop-blur-md text-white p-6 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.5, repeat: 3 }}
              className="mb-6"
            >
              <Trophy size={100} className="text-yellow-400 mx-auto" />
            </motion.div>
            <h2 className="text-4xl font-bold mb-2">رائع جداً!</h2>
            <p className="text-xl text-slate-400 mb-8">لقد اكتشفت كل أسرار {currentLevel.title}</p>
            <button 
              onClick={nextLevel}
              className="bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-4 px-12 rounded-2xl text-2xl transition-all shadow-lg"
            >
              المستوى التالي
            </button>
          </motion.div>
        )}

        {/* --- All Complete Screen --- */}
        {gameState === 'all-complete' && (
          <motion.div 
            key="all-complete"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-yellow-400 text-black p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12 }}
              className="mb-8"
            >
              <Star size={120} className="fill-black mx-auto" />
            </motion.div>
            <h2 className="text-5xl font-black mb-4">بطل الاستكشاف!</h2>
            <p className="text-2xl font-medium mb-12 max-w-md">
              لقد أنهيت جميع المستويات بنجاح. أنت تمتلك أقوى كشاف في العالم!
            </p>
            <button 
              onClick={restartGame}
              className="bg-black text-white font-bold py-4 px-12 rounded-2xl text-2xl hover:scale-105 transition-transform shadow-2xl"
            >
              العب مرة أخرى
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
