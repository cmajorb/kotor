const API_BASE = import.meta.env.VITE_HTTP_API_URL;

export async function getRegions() {
//   const res = await fetch(`${API_BASE}/map/regions`);
//   if (!res.ok) throw new Error(`Failed to fetch regions: ${res.status}`);
//   return res.json();
return [
  { "regionId": "REGION#0", "x": 0, "y": 0, "name": "Central Plains" },
  { "regionId": "REGION#1", "x": 0, "y": 1, "name": "Northern Mountains" }
];
}

export async function getRegion(regionId: string) {
  const encoded = encodeURIComponent(regionId);
  const res = await fetch(`${API_BASE}/map?regionId=${encoded}`);
  if (!res.ok) throw new Error(`Failed to fetch region: ${res.status}`);
  return res.json();
}