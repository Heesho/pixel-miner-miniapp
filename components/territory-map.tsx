"use client";

import { useState, useEffect, useRef } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

// 83 RISK-style territories
const RISK_REGIONS = [
  { id: 'NA1', name: 'Alaska', lat: 64, lon: -150 },
  { id: 'NA2', name: 'Yukon', lat: 65, lon: -135 },
  { id: 'NA3', name: 'Nunavut', lat: 70, lon: -95 },
  { id: 'NA4', name: 'Greenland', lat: 72, lon: -40 },
  { id: 'NA5', name: 'Cascadia', lat: 50, lon: -122 },
  { id: 'NA6', name: 'Alberta', lat: 55, lon: -115 },
  { id: 'NA7', name: 'Manitoba', lat: 55, lon: -98 },
  { id: 'NA8', name: 'Ontario', lat: 52, lon: -85 },
  { id: 'NA9', name: 'Quebec', lat: 53, lon: -70 },
  { id: 'NA10', name: 'Maritimes', lat: 46, lon: -63 },
  { id: 'NA11', name: 'California', lat: 37, lon: -120 },
  { id: 'NA12', name: 'Great Basin', lat: 40, lon: -112 },
  { id: 'NA13', name: 'Heartland', lat: 40, lon: -92 },
  { id: 'NA14', name: 'Dixie', lat: 33, lon: -88 },
  { id: 'NA15', name: 'New England', lat: 42, lon: -75 },
  { id: 'NA16', name: 'Mexico', lat: 24, lon: -102 },
  { id: 'NA17', name: 'Caribbean', lat: 18, lon: -75 },
  { id: 'SA1', name: 'Gran Colombia', lat: 5, lon: -74 },
  { id: 'SA2', name: 'Amazonas', lat: -3, lon: -60 },
  { id: 'SA3', name: 'Guiana', lat: 5, lon: -55 },
  { id: 'SA4', name: 'Andes', lat: -10, lon: -76 },
  { id: 'SA5', name: 'Altiplano', lat: -17, lon: -65 },
  { id: 'SA6', name: 'Mato Grosso', lat: -15, lon: -55 },
  { id: 'SA7', name: 'Sertão', lat: -10, lon: -40 },
  { id: 'SA8', name: 'Pampas', lat: -34, lon: -60 },
  { id: 'SA9', name: 'Patagonia', lat: -45, lon: -70 },
  { id: 'SA10', name: 'Tierra del Fuego', lat: -54, lon: -68 },
  { id: 'EU1', name: 'Iceland', lat: 65, lon: -18 },
  { id: 'EU2', name: 'Hibernia', lat: 53, lon: -8 },
  { id: 'EU3', name: 'Albion', lat: 54, lon: -2 },
  { id: 'EU4', name: 'Scandinavia', lat: 62, lon: 10 },
  { id: 'EU5', name: 'Lapland', lat: 68, lon: 25 },
  { id: 'EU6', name: 'Iberia', lat: 40, lon: -4 },
  { id: 'EU7', name: 'Gaul', lat: 47, lon: 2 },
  { id: 'EU8', name: 'Rhine', lat: 51, lon: 9 },
  { id: 'EU9', name: 'Italia', lat: 42, lon: 13 },
  { id: 'EU10', name: 'Polonia', lat: 52, lon: 20 },
  { id: 'EU11', name: 'Danubia', lat: 47, lon: 18 },
  { id: 'EU12', name: 'Balkans', lat: 42, lon: 22 },
  { id: 'EU13', name: 'Baltica', lat: 57, lon: 26 },
  { id: 'EU14', name: 'Muscovy', lat: 56, lon: 37 },
  { id: 'EU15', name: 'Crimea', lat: 46, lon: 34 },
  { id: 'AF1', name: 'Maghreb', lat: 32, lon: 0 },
  { id: 'AF2', name: 'Tripolitania', lat: 28, lon: 15 },
  { id: 'AF3', name: 'Aegyptus', lat: 27, lon: 30 },
  { id: 'AF4', name: 'Sahara', lat: 20, lon: 0 },
  { id: 'AF5', name: 'Sahel', lat: 15, lon: 15 },
  { id: 'AF6', name: 'Nubia', lat: 15, lon: 32 },
  { id: 'AF7', name: 'Abyssinia', lat: 8, lon: 38 },
  { id: 'AF8', name: 'Gold Coast', lat: 8, lon: -5 },
  { id: 'AF9', name: 'Kongo', lat: -2, lon: 22 },
  { id: 'AF10', name: 'Tanganyika', lat: -6, lon: 35 },
  { id: 'AF11', name: 'Angola', lat: -12, lon: 18 },
  { id: 'AF12', name: 'Zambezia', lat: -18, lon: 30 },
  { id: 'AF13', name: 'Kalahari', lat: -24, lon: 22 },
  { id: 'AF14', name: 'Cape', lat: -30, lon: 24 },
  { id: 'AS1', name: 'Anatolia', lat: 39, lon: 35 },
  { id: 'AS2', name: 'Levant', lat: 33, lon: 37 },
  { id: 'AS3', name: 'Arabia', lat: 24, lon: 45 },
  { id: 'AS4', name: 'Mesopotamia', lat: 33, lon: 44 },
  { id: 'AS5', name: 'Persia', lat: 32, lon: 53 },
  { id: 'AS6', name: 'Turkestan', lat: 42, lon: 65 },
  { id: 'AS7', name: 'Pamir', lat: 38, lon: 70 },
  { id: 'AS8', name: 'Indus', lat: 28, lon: 70 },
  { id: 'AS9', name: 'Hindustan', lat: 22, lon: 78 },
  { id: 'AS10', name: 'Bengal', lat: 24, lon: 90 },
  { id: 'AS11', name: 'Deccan', lat: 15, lon: 78 },
  { id: 'AS12', name: 'Tibet', lat: 32, lon: 88 },
  { id: 'AS13', name: 'Xian', lat: 40, lon: 90 },
  { id: 'AS14', name: 'Cathay', lat: 36, lon: 110 },
  { id: 'AS15', name: 'Manchuria', lat: 45, lon: 125 },
  { id: 'AS16', name: 'Gobi', lat: 46, lon: 105 },
  { id: 'AS17', name: 'Siberia West', lat: 60, lon: 75 },
  { id: 'AS18', name: 'Siberia Central', lat: 62, lon: 100 },
  { id: 'AS19', name: 'Siberia East', lat: 64, lon: 130 },
  { id: 'AS20', name: 'Kamchatka', lat: 58, lon: 160 },
  { id: 'AS21', name: 'Amur', lat: 50, lon: 135 },
  { id: 'AS22', name: 'Korea', lat: 38, lon: 127 },
  { id: 'AS23', name: 'Japan', lat: 36, lon: 138 },
  { id: 'AS24', name: 'Indochina', lat: 18, lon: 105 },
  { id: 'AS25', name: 'Malaya', lat: 5, lon: 102 },
  { id: 'AU1', name: 'Nusantara', lat: -2, lon: 115 },
  { id: 'AU2', name: 'Philippines', lat: 13, lon: 122 },
  { id: 'AU3', name: 'Papua', lat: -5, lon: 140 },
  { id: 'AU4', name: 'Pilbara', lat: -24, lon: 120 },
  { id: 'AU5', name: 'Outback', lat: -25, lon: 133 },
  { id: 'AU6', name: 'Queensland', lat: -22, lon: 145 },
  { id: 'AU7', name: 'New South Wales', lat: -32, lon: 147 },
  { id: 'AU8', name: 'Zealandia', lat: -42, lon: 172 }
];

type Territory = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  x?: number;
  y?: number;
  baseColor: string;
  owner: string | null;
  price: number;
  multiplier: number;
};

type Dot = {
  nx: number;
  ny: number;
  regionId: string;
  baseColor: string;
};

type TerritoryMapProps = {
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  onHoverIndex: (index: number | null) => void;
  territories: Map<string, Territory>;
  ownedTerritories: Set<string>;
  animatingSlots?: {
    priceJump: Set<number>;
    multiplierChange: Set<number>;
  };
};

export function TerritoryMap({
  selectedIndex,
  onSelectIndex,
  onHoverIndex,
  territories,
  ownedTerritories,
  animatingSlots
}: TerritoryMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dots, setDots] = useState<Dot[]>([]);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [lastMouseY, setLastMouseY] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drawMetrics, setDrawMetrics] = useState<any>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastPinchDistanceRef = useRef<number | null>(null);

  // Initialize map data
  useEffect(() => {
    const loadMapData = async () => {
      try {
        const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
        const worldData: Topology = await response.json();
        const countries = worldData.objects.countries as GeometryCollection;
        const geoData = feature(worldData, countries);

        // Filter out Antarctica
        geoData.features = geoData.features.filter((f: any) => f.id !== "010");

        processMapData(geoData);
      } catch (err) {
        console.error("Map Load Error", err);
      }
    };

    loadMapData();
  }, []);

  const processMapData = (geoData: any) => {
    const w = 360;
    const h = 180;
    const buffer = document.createElement('canvas');
    buffer.width = w;
    buffer.height = h;
    const bctx = buffer.getContext('2d');
    if (!bctx) return;

    const projection = d3.geoEquirectangular().fitSize([w, h], geoData);
    const pathGenerator = d3.geoPath(projection, bctx);

    // Draw land mask
    bctx.fillStyle = '#111';
    bctx.fillRect(0, 0, w, h);
    bctx.fillStyle = 'white';
    bctx.beginPath();
    pathGenerator(geoData);
    bctx.fill();

    // Calculate territory centers
    const centers = RISK_REGIONS.map(r => {
      const c = projection([r.lon, r.lat]) || [0, 0];
      return { ...r, x: c[0], y: c[1] };
    });

    // Sample dots from land
    const imgData = bctx.getImageData(0, 0, w, h).data;
    const newDots: Dot[] = [];
    const dotSpacing = 3;

    for (let y = 0; y < h; y += dotSpacing) {
      for (let x = 0; x < w; x += dotSpacing) {
        const i = (y * w + x) * 4;
        if (imgData[i] > 100) {
          // Find closest territory
          let closest = centers[0];
          let minDist = Infinity;

          centers.forEach(c => {
            const d = (x - c.x) ** 2 + (y - c.y) ** 2;
            if (d < minDist) {
              minDist = d;
              closest = c;
            }
          });

          const territory = territories.get(closest.id);
          if (territory) {
            newDots.push({
              nx: x / w,
              ny: y / h,
              regionId: closest.id,
              baseColor: territory.baseColor
            });
          }
        }
      }
    }

    setDots(newDots);
  };

  // Render loop
  useEffect(() => {
    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = container.clientWidth;
      const h = container.clientHeight;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      // Clear with ocean color
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);

      // Calculate map bounds with zoom
      const mapAspect = 2;
      const canvasAspect = w / h;

      let baseW, baseH;
      if (canvasAspect > mapAspect) {
        baseH = h;
        baseW = baseH * mapAspect;
      } else {
        baseW = w;
        baseH = baseW / mapAspect;
      }

      const drawW = baseW * zoom;
      const drawH = baseH * zoom;

      const padding = 100 * zoom;
      const maxPanX = Math.max(0, (drawW - w) / 2) + padding;
      const maxPanY = Math.max(0, (drawH - h) / 2) + padding;

      const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, panX));
      const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, panY));

      const centerX = w / 2 + clampedPanX;
      const centerY = h / 2 + clampedPanY;

      const offsetX = centerX - drawW / 2;
      const offsetY = centerY - drawH / 2;

      // Draw dots
      dots.forEach(dot => {
        const dx = offsetX + dot.nx * drawW;
        const dy = offsetY + dot.ny * drawH;

        if (dx < -5 || dx > w + 5 || dy < -5 || dy > h + 5) return;

        const territory = territories.get(dot.regionId);
        if (!territory) return;

        const isHovered = hoveredId === dot.regionId;
        const selectedTerritoryId = selectedIndex !== null ? Array.from(territories.values())[selectedIndex]?.id : null;
        const isSelected = selectedTerritoryId === dot.regionId;
        const isOwned = ownedTerritories.has(dot.regionId);

        // Get territory index for animation
        const territoryIndex = Array.from(territories.keys()).indexOf(dot.regionId);
        const isPriceJumping = animatingSlots?.priceJump.has(territoryIndex) ?? false;
        const isMultiplierChanging = animatingSlots?.multiplierChange.has(territoryIndex) ?? false;

        let size = 1.5 * zoom;
        if (size < 1.5) size = 1.5;

        let color = dot.baseColor;

        // Animation overrides (highest priority)
        if (isPriceJumping) {
          // Flash bright white/red for conquest
          color = '#ff3333'; // Bright red
          size *= 1.8;
          ctx.shadowColor = '#ff3333';
          ctx.shadowBlur = 20;
        } else if (isMultiplierChanging) {
          // Pulse green for multiplier change
          color = '#39FF14';
          size *= 1.6;
          ctx.shadowColor = '#39FF14';
          ctx.shadowBlur = 25;
        }
        // State overrides (lower priority)
        else if (isOwned) {
          color = '#39FF14'; // Neon green
        } else if (isHovered) {
          color = '#fff';
          size *= 1.3;
        } else if (isSelected) {
          color = '#39FF14';
          size *= 1.5;
          ctx.shadowColor = '#39FF14';
          ctx.shadowBlur = 15;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(dx, dy, size, 0, Math.PI * 2);
        ctx.fill();
      });

      setDrawMetrics({ drawW, drawH, offsetX, offsetY });
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [dots, zoom, panX, panY, hoveredId, selectedIndex, territories, ownedTerritories, animatingSlots]);

  // Mouse/touch handlers
  const handleMove = (x: number, y: number) => {
    if (!drawMetrics) return;

    if (!isDragging) {
      const { drawW, drawH, offsetX, offsetY } = drawMetrics;
      let foundId: string | null = null;
      const nx = (x - offsetX) / drawW;
      const ny = (y - offsetY) / drawH;
      const minDist = 0.02 / zoom;

      if (nx > 0 && nx < 1 && ny > 0 && ny < 1) {
        for (let d of dots) {
          if (Math.abs(d.nx - nx) > minDist) continue;
          const dist = Math.sqrt((d.nx - nx) ** 2 + (d.ny - ny) ** 2);
          if (dist < minDist) {
            foundId = d.regionId;
            break;
          }
        }
      }

      if (hoveredId !== foundId) {
        setHoveredId(foundId);
        onHoverIndex(foundId ? Array.from(territories.keys()).indexOf(foundId) : null);
      }
    }

    if (isDragging) {
      const dx = x - lastMouseX;
      const dy = y - lastMouseY;
      setPanX(prev => prev + dx);
      setPanY(prev => prev + dy);
      setLastMouseX(x);
      setLastMouseY(y);
    }
  };

  const handleStart = (x: number, y: number) => {
    setIsDragging(true);
    setLastMouseX(x);
    setLastMouseY(y);
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (hoveredId) {
      const index = Array.from(territories.keys()).indexOf(hoveredId);
      onSelectIndex(index);
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(1, Math.min(5, prev - e.deltaY * 0.001)));
  };

  // Add wheel event listener with passive: false
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0a0a0a] overflow-hidden"
      style={{
        touchAction: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        style={{
          imageRendering: 'pixelated',
          touchAction: 'none',
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleStart(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.clientX - rect.left, e.clientY - rect.top);
        }}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => {
          // CRITICAL: Prevent all default touch behaviors
          e.preventDefault();
          e.stopPropagation();

          if (e.touches.length === 2) {
            // Pinch zoom start
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) +
              Math.pow(touch2.clientY - touch1.clientY, 2)
            );
            lastPinchDistanceRef.current = distance;
          } else if (e.touches.length === 1) {
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.touches[0];
            handleStart(touch.clientX - rect.left, touch.clientY - rect.top);
          }
        }}
        onTouchMove={(e) => {
          // CRITICAL: Prevent all default touch behaviors
          e.preventDefault();
          e.stopPropagation();

          if (e.touches.length === 2) {
            // Pinch zoom
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const distance = Math.sqrt(
              Math.pow(touch2.clientX - touch1.clientX, 2) +
              Math.pow(touch2.clientY - touch1.clientY, 2)
            );

            if (lastPinchDistanceRef.current) {
              const delta = distance - lastPinchDistanceRef.current;
              setZoom(prev => Math.max(1, Math.min(5, prev + delta * 0.01)));
            }

            lastPinchDistanceRef.current = distance;
          } else if (e.touches.length === 1) {
            const rect = e.currentTarget.getBoundingClientRect();
            const touch = e.touches[0];
            handleMove(touch.clientX - rect.left, touch.clientY - rect.top);
          }
        }}
        onTouchEnd={(e) => {
          // Prevent default to stop any lingering behaviors
          e.preventDefault();
          e.stopPropagation();

          if (e.touches.length < 2) {
            lastPinchDistanceRef.current = null;
          }
          if (e.touches.length === 0) {
            handleEnd();
          }
        }}
      />

      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-10"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 0, 0, 0.2))',
          backgroundSize: '100% 4px'
        }}
      />
    </div>
  );
}

export { RISK_REGIONS };
