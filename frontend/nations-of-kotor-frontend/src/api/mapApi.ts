const API_BASE = import.meta.env.VITE_HTTP_API_URL;
import type { EntityRequest } from "../types";

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

export async function createEntity(payload: EntityRequest) {
  const res = await fetch(`${API_BASE}/map/entity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchEntities() {
  const res = await fetch(`${API_BASE}/entities`);
  if (!res.ok) throw new Error("Failed to fetch entities");
  const data = await res.json();
  return data.entities;
}
