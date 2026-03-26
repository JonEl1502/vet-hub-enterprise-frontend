import React, { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';

const TILE_SIZE = 256;
const OSM = 'https://tile.openstreetmap.org';
// Default centre: Nairobi
const DEFAULT_LAT = -1.286389;
const DEFAULT_LNG = 36.817223;

function latlngToFrac(lat: number, lng: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function fracToLatLng(x: number, y: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lng };
}

interface ClickableMapProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
}

const ClickableMap: React.FC<ClickableMapProps> = ({
  lat,
  lng,
  onPick,
  height = 220,
}) => {
  const [viewLat, setViewLat] = useState(lat ?? DEFAULT_LAT);
  const [viewLng, setViewLng] = useState(lng ?? DEFAULT_LNG);
  const [zoom, setZoom] = useState(14);

  // Sync view centre when the selected point changes externally (e.g. "Use My Location")
  useEffect(() => {
    if (lat != null && lng != null) {
      setViewLat(lat);
      setViewLng(lng);
    }
  }, [lat, lng]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - rect.left - rect.width / 2) / TILE_SIZE;
    const dy = (e.clientY - rect.top - rect.height / 2) / TILE_SIZE;
    const center = latlngToFrac(viewLat, viewLng, zoom);
    const { lat: nLat, lng: nLng } = fracToLatLng(center.x + dx, center.y + dy, zoom);
    const rLat = Math.round(nLat * 1e6) / 1e6;
    const rLng = Math.round(nLng * 1e6) / 1e6;
    setViewLat(rLat);
    setViewLng(rLng);
    onPick(rLat, rLng);
  };

  // Build 3×3 tile grid centred on viewLat/viewLng
  const center = latlngToFrac(viewLat, viewLng, zoom);
  const cx = Math.floor(center.x);
  const cy = Math.floor(center.y);
  const offX = center.x - cx; // fraction within centre tile (0–1)
  const offY = center.y - cy;
  const maxTile = Math.pow(2, zoom) - 1;

  const tiles: React.ReactNode[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 0 || ty < 0 || tx > maxTile || ty > maxTile) continue;
      tiles.push(
        <img
          key={`${dx},${dy}`}
          src={`${OSM}/${zoom}/${tx}/${ty}.png`}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: `calc(50% + ${(dx - offX) * TILE_SIZE}px)`,
            top: `calc(50% + ${(dy - offY) * TILE_SIZE}px)`,
            width: TILE_SIZE,
            height: TILE_SIZE,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />,
      );
    }
  }

  return (
    <div
      className="border border-slate-200 dark:border-zinc-700"
      style={{ position: 'relative', height, borderRadius: 12, overflow: 'hidden' }}
    >
      {/* Tile layer — click target */}
      <div
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: 'crosshair' }}
        onClick={handleClick}
      >
        {tiles}
      </div>

      {/* Pin — shown at the exact selected point (container centre) */}
      {lat != null && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 10,
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))',
          }}
        >
          <MapPin size={30} className="text-red-500 fill-red-500" />
        </div>
      )}

      {/* "Click to drop pin" hint when no point selected */}
      {lat == null && (
        <div
          className="absolute inset-x-0 bottom-3 flex justify-center pointer-events-none"
          style={{ zIndex: 10 }}
        >
          <span className="bg-black/60 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
            Click map to drop pin
          </span>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setZoom(z => Math.min(18, z + 1))}
          className="w-7 h-7 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg flex items-center justify-center text-pine dark:text-zinc-200 font-black text-base hover:bg-slate-50 shadow-sm leading-none"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom(z => Math.max(2, z - 1))}
          className="w-7 h-7 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg flex items-center justify-center text-pine dark:text-zinc-200 font-black text-base hover:bg-slate-50 shadow-sm leading-none"
        >
          −
        </button>
      </div>

      {/* OSM attribution */}
      <div
        className="absolute bottom-1 left-1 z-20 text-[9px] text-slate-600 dark:text-zinc-400"
        style={{
          background: 'rgba(255,255,255,0.7)',
          padding: '1px 4px',
          borderRadius: 3,
          lineHeight: 1.5,
        }}
      >
        © OpenStreetMap
      </div>
    </div>
  );
};

export default ClickableMap;
