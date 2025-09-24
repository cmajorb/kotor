import { useEffect, useState } from "react";
import { getRegion, createEntity } from "../api/mapApi";
import { GameWebSocket } from "../api/websocket";
import type { Entity, EntityOption } from "../types";

interface RegionMapProps {
    regionId: string;
    selectedEntity: EntityOption | null;
}

export default function RegionMap({ regionId, selectedEntity }: RegionMapProps) {
    const [entities, setEntities] = useState<Entity[]>([]);
    const [socket, setSocket] = useState<GameWebSocket | null>(null);
    const [hoverTile, setHoverTile] = useState<{ x: number; y: number } | null>(null);

    const gridSize = 30;
    const tileSize = 28;

    /** Initial Fetch */
    useEffect(() => {
        getRegion(regionId)
            .then((items: any[]) => {
                const normalized: Entity[] = (items || []).map((it) => ({
                    entityKey: it.entityKey ?? it.SK ?? `${it.entityType}#${it.x}_${it.y}`,
                    entityType: it.entityType ?? it.type,
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

    /** WebSocket Setup */
    const handleSocketMessage = (message: any) => {
        const { action, entity, changeType } = message;

        if (action === "ENTITY_UPDATED") {
            setEntities((prev) => {
                if (changeType === "INSERT") return [...prev, entity];
                if (changeType === "MODIFY") return prev.map((e) => (e.entityKey === entity.entityKey ? entity : e));
                if (changeType === "REMOVE") return prev.filter((e) => e.entityKey !== entity.entityKey);
                return prev;
            });
        }
    };

    useEffect(() => {
        if (socket) socket.close();

        const ws = new GameWebSocket(handleSocketMessage);
        setSocket(ws);

        ws.socket.onopen = () => {
            ws.send("SUBSCRIBE_REGION", { regionId });
        };

        return () => {
            ws.close();
        };
    }, [regionId]);

    /** Helpers */
    const getEntitiesAt = (x: number, y: number) =>
        entities.filter(
            (e) => x >= e.x && x < e.x + e.width && y >= e.y && y < e.y + e.height
        );

    const handleTileClick = (x: number, y: number) => {
        if (!selectedEntity) return;

        // Check for collision
        const isOccupied = entities.some(
            (e) =>
                x + selectedEntity.width > e.x &&
                x < e.x + e.width &&
                y + selectedEntity.height > e.y &&
                y < e.y + e.height
        );

        if (isOccupied) {
            alert("Cannot place here — tiles are occupied!");
            return;
        }

        // Send to backend
        createEntity({
            regionId,
            entityType: selectedEntity.type,
            x,
            y,
            width: selectedEntity.width,
            height: selectedEntity.height,
            ownerId: "mock-user", // TODO: Replace later
            data: { type: selectedEntity.name },
        })
            .then(() => console.log("Entity placed successfully"))
            .catch((err) => console.error("Failed to place entity:", err));
    };

    const gap = 2;
    const gridWidth = (gridSize * tileSize + (gridSize - 1) * gap);
    const gridHeight = gridSize * tileSize + (gridSize - 1) * gap;

    return (
        <div
            className="flex-shrink-0"
            style={{
                width: gridWidth,
                height: gridHeight,
            }}
        >
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(${gridSize}, ${tileSize}px)`,
                    gridAutoRows: `${tileSize}px`,
                    gap: `${gap}px`,
                    width: gridWidth,
                    height: gridHeight,
                }}
            >
                {Array.from({ length: gridSize * gridSize }).map((_, index) => {
                    const x = index % gridSize;
                    const y = Math.floor(index / gridSize);
                    const tileEntities = getEntitiesAt(x, y);
                    const hasEntities = tileEntities.length > 0;

                    const isHover =
                        selectedEntity &&
                        hoverTile &&
                        x >= hoverTile.x &&
                        x < hoverTile.x + selectedEntity.width &&
                        y >= hoverTile.y &&
                        y < hoverTile.y + selectedEntity.height;

                    return (
                        <div
                            key={`${x}-${y}`}
                            onMouseEnter={() => setHoverTile({ x, y })}
                            onMouseLeave={() => setHoverTile(null)}
                            onClick={() => handleTileClick(x, y)}
                            style={{
                                width: tileSize,
                                height: tileSize,
                                position: "relative",
                                backgroundColor: isHover
                                    ? "rgba(0, 0, 255, 0.3)"
                                    : hasEntities
                                        ? "#ffe4b5"
                                        : "#a8d5ba",
                                border: "1px solid rgba(0,0,0,0.08)",
                                boxSizing: "border-box",
                                overflow: "hidden",
                                cursor: selectedEntity ? "pointer" : "default",
                            }}
                        >
                            {tileEntities.map((e) => {
                                const isTopLeft = e.x === x && e.y === y;
                                return isTopLeft ? (
                                    <div
                                        key={e.entityKey}
                                        style={{
                                            position: "absolute",
                                            width: tileSize * e.width + (e.width - 1) * 2,
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
    );
}
