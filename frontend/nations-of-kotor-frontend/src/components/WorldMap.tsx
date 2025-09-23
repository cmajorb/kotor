// src/components/WorldMap.tsx
import { useEffect, useState } from "react";
import { getRegions } from "../api/mapApi";
import { useNavigate } from "react-router-dom";

interface Region {
  regionId: string;
  x: number;
  y: number;
  name: string;
}

export default function WorldMap() {
  const [regions, setRegions] = useState<Region[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    getRegions().then(setRegions).catch(console.error);
  }, []);

  const handleClick = (regionId: string) => {
    navigate(`/region/${encodeURIComponent(regionId)}`);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">World Map</h1>
      <div className="grid grid-cols-10 gap-1">
        {regions.map((r) => (
          <div
            key={r.regionId}
            onClick={() => handleClick(r.regionId)}
            className="w-16 h-16 flex items-center justify-center bg-blue-200 border border-blue-400 hover:bg-blue-300 cursor-pointer text-xs"
          >
            {r.name}
          </div>
        ))}
      </div>
    </div>
  );
}
