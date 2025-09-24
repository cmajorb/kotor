// src/components/RegionMap.tsx
import { useState, useEffect } from "react";
import { GameWebSocket } from "../api/websocket";

import { getRegion } from "../api/mapApi";

interface Entity {
    entityKey: string;
    entityType: string;
    x: number;
    y: number;
    width: number;
    height: number;
    ownerId?: string;
    data?: any;
}

export default function RegionMap({ regionId }: { regionId: string }) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [socket, setSocket] = useState<GameWebSocket | null>(null);

    const gridSize = 30; // 30x30
    const tileSize = 28; // px per tile (adjust if you want bigger/smaller)

    // Initial fetch
    useEffect(() => {
        getRegion(regionId).then(setEntities).catch(console.error);
    }, [regionId]);

    
  // Handle incoming WebSocket messages
  const handleSocketMessage = (message: any) => {
    const { action, entity, changeType } = message;

    if (action === "ENTITY_UPDATED") {
        console.log("Entity update received:", message);
      setEntities((prev) => {
        if (changeType === "INSERT") {
          return [...prev, entity];
        } else if (changeType === "MODIFY") {
          return prev.map((e) =>
            e.entityKey === entity.entityKey ? entity : e
          );
        } else if (changeType === "REMOVE") {
          return prev.filter((e) => e.entityKey !== entity.entityKey);
        }
        return prev;
      });
    }
  };

     // Open WebSocket connection when region changes
  useEffect(() => {
    // Clean up old socket if it exists
    if (socket) {
      socket.close();
    }

    const ws = new GameWebSocket(handleSocketMessage);
    setSocket(ws);

    ws.socket.onopen = () => {
      console.log("WebSocket connected, subscribing to region:", regionId);
      ws.send("SUBSCRIBE_REGION", { regionId });
    };

    return () => {
      ws.close();
    };
  }, [regionId]);

//   useEffect(() => {
//   const ws = new GameWebSocket((msg) => {
//     if (msg.type === "REGION_UPDATE") {
//       setEntities(prev => {
//         // Merge or replace entity
//         return [...prev.filter(e => e.entityKey !== msg.entity.entityKey), msg.entity];
//       });
//     }
//   });

//   return () => ws.close();
// }, [regionId]);

    useEffect(() => {
        getRegion(regionId)
            .then((items: any[]) => {
                // Defensive: coerce x/y to numbers and normalize shape
                const normalized: Entity[] = (items || []).map((it) => ({
                    entityKey: it.entityKey ?? it.SK ?? `${it.entityType}#${it.x}_${it.y}`,
                    entityType: it.entityType ?? it.type ?? it.entityType,
                    x: Number(it.x),
                    y: Number(it.y),
                    width: Number(it.width ?? 1),
                    height: Number(it.height ?? 1),
                    ownerId: it.ownerId ?? it.owner,
                    data: it.data ?? it,
                }));
                setEntities(normalized);
            })
            .catch((err) => {
                console.error("Failed to fetch region:", err);
                setEntities([]);
            });
    }, [regionId]);

    const getEntitiesAt = (x: number, y: number) =>
        entities.filter((e) =>
            x >= e.x && x < e.x + e.width &&
            y >= e.y && y < e.y + e.height
        );

    const gridWidth = gridSize * tileSize;
    const gridHeight = gridSize * tileSize;

    return (
        <div className="p-4">
            <h2 className="text-xl mb-4">Region: {regionId}</h2>

            <div
                className="border border-gray-300 overflow-auto"
                style={{
                    width: Math.min(gridWidth + 8, window.innerWidth - 48),
                    height: Math.min(gridHeight + 8, window.innerHeight - 160),
                }}
            >
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: `repeat(${gridSize}, ${tileSize}px)`,
                        gridAutoRows: `${tileSize}px`,
                        gap: "2px",
                        width: gridWidth,
                        height: gridHeight,
                        boxSizing: "content-box",
                    }}
                >
                    {Array.from({ length: gridSize * gridSize }).map((_, index) => {
                        const x = index % gridSize;
                        const y = Math.floor(index / gridSize);
                        const tileEntities = getEntitiesAt(x, y);
                        const hasEntities = tileEntities.length > 0;

                        return (
                            <div
                                key={`${x}-${y}`}
                                style={{
                                    width: tileSize,
                                    height: tileSize,
                                    position: "relative",
                                    backgroundColor: hasEntities ? "#ffe4b5" : "#a8d5ba",
                                    border: "1px solid rgba(0,0,0,0.08)",
                                    boxSizing: "border-box",
                                    overflow: "hidden",
                                }}
                                title={`x:${x} y:${y} — ${hasEntities ? `${tileEntities.length} entity(s)` : "empty"}`}
                            >
                                {/* Optional small coords */}
                                <div
                                    style={{
                                        position: "absolute",
                                        top: 1,
                                        left: 2,
                                        fontSize: 9,
                                        color: "rgba(0,0,0,0.45)",
                                    }}
                                >
                                    {x},{y}
                                </div>

                                {/* Render entities stacked inside the tile */}
                                {tileEntities.map((e) => {
                                    const isTopLeft = e.x === x && e.y === y;
                                    return isTopLeft ? (
                                        <div
                                            key={e.entityKey}
                                            style={{
                                                position: "absolute",
                                                width: tileSize * e.width + (e.width - 1) * 2, // account for grid gap
                                                height: tileSize * e.height + (e.height - 1) * 2,
                                                backgroundColor: "rgba(255, 200, 150, 0.85)",
                                                border: "2px solid #cc8a00",
                                                borderRadius: 4,
                                                textAlign: "center",
                                                fontSize: 14,
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                pointerEvents: "none",
                                            }}
                                        >
                                            {e.entityType === "BUILDING" ? "🏰" : "⚔️"} {e.data?.type ?? ""}
                                        </div>
                                    ) : null;
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="mt-3 text-sm">
                <span className="inline-block mr-4">
                    <span className="inline-block w-3 h-3 mr-1" style={{ background: "#a8d5ba" }} /> empty tile
                </span>
                <span className="inline-block mr-4">
                    <span className="inline-block w-3 h-3 mr-1" style={{ background: "#ffe4b5" }} /> occupied tile
                </span>
            </div>
        </div>
    );
}
