"use client";

import { useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { WHEEL_SPIN_DURATION } from "./timings";

const WHEEL_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#D97706",
  "#DC2626", "#DB2777", "#0891B2", "#0D9488",
  "#8B5CF6", "#6366F1", "#3B82F6", "#F59E0B",
];

interface SpinningWheelProps {
  names: string[];
  isSpinning: boolean;
  onSpinComplete: (winner: string, index: number) => void;
  rotation: number;
}

export default function SpinningWheel({
  names,
  isSpinning,
  onSpinComplete,
  rotation,
}: SpinningWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const previousIsSpinningRef = useRef(isSpinning);
  const [spinState, setSpinState] = useState({
    easingCurve: [0.33, 0, 0.15, 1] as [number, number, number, number],
    currentRotation: 0,
    animating: false,
  });

  useEffect(() => {
    const updateDimensions = () => {
      const size = Math.min(window.innerWidth - 100, window.innerHeight - 300, 600);
      setDimensions({ width: Math.max(size, 200), height: Math.max(size, 200) });
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || names.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const radius = Math.max(dimensions.width / 2 - 10, 20);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    const anglePerSegment = (2 * Math.PI) / names.length;

    names.forEach((name, index) => {
      const startAngle = index * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;
      const color = WHEEL_COLORS[index % WHEEL_COLORS.length];

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(startAngle + anglePerSegment / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(14, dimensions.width / 30)}px Arial`;
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      const maxLength = 12;
      const displayName = name.length > maxLength ? name.substring(0, maxLength - 3) + "..." : name;
      ctx.fillText(displayName, radius * 0.65, 0);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(centerX, centerY, 25, 0, 2 * Math.PI);
    ctx.fillStyle = "#2c3e50";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.stroke();
  }, [names, dimensions]);

  useEffect(() => {
    if (isSpinning && !previousIsSpinningRef.current) {
      const x1 = 0.25 + Math.random() * 0.1;
      const y1 = 0.9 + Math.random() * 0.08;
      const x2 = 0.65 + Math.random() * 0.1;
      const y2 = 0.98 + Math.random() * 0.015;
      // Responding to isSpinning prop transition — setState is intentional here
      setSpinState({ // eslint-disable-line react-hooks/set-state-in-effect
        easingCurve: [x1, y1, x2, y2],
        currentRotation: rotation,
        animating: true,
      });
    }

    if (!isSpinning && previousIsSpinningRef.current) {
      const normalizedRotation = ((rotation % 360) + 360) % 360;
      const segmentAngle = 360 / names.length;
      const pointerAngle = 270;
      const angleAtPointer = (pointerAngle - normalizedRotation + 360) % 360;
      const winningIndex = Math.floor(angleAtPointer / segmentAngle) % names.length;
      if (names[winningIndex]) {
        onSpinComplete(names[winningIndex], winningIndex);
      }
    }

    previousIsSpinningRef.current = isSpinning;
  }, [isSpinning, rotation, names, onSpinComplete]);

  return (
    <div className="relative flex items-center justify-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10" style={{ marginTop: "-20px" }}>
        <svg width="40" height="40" viewBox="0 0 40 40" className="drop-shadow-lg">
          <polygon points="20,40 0,0 40,0" fill="#ef4444" />
        </svg>
      </div>

      <motion.div
        animate={{ rotate: spinState.currentRotation }}
        transition={{
          duration: spinState.animating ? WHEEL_SPIN_DURATION : 0,
          ease: spinState.animating ? spinState.easingCurve : "linear",
        }}
        onAnimationComplete={() => {
          setSpinState((prev) => ({ ...prev, animating: false }));
        }}
        className="drop-shadow-2xl"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="rounded-full"
        />
      </motion.div>
    </div>
  );
}
