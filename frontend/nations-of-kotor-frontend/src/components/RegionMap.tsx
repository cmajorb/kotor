import { useEffect, useState } from "react";
import { getRegion, createEntity } from "../api/mapApi";
import { GameWebSocket } from "../api/websocket";
import type { Entity, EntityDefinition, EntityRequest } from "../types";

const API_BASE = import.meta.env.VITE_HTTP_API_URL;

interface RegionMapProps {
    regionId: string;
    selectedEntity: EntityDefinition | null;
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
                    regionId: it.entityKey,
                    entityKey: it.entityKey,
                    entityDefinition: it.entityDefinition,
                    x: Number(it.x),
                    y: Number(it.y),
                    ownerId: it.ownerId,
                    params: it.params,
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
            (e) => x >= e.x && x < e.x + e.entityDefinition.width && y >= e.y && y < e.y + e.entityDefinition.height
        );

    const handleTileClick = async (x: number, y: number) => {
        if (!selectedEntity) return;

        const isOccupied = entities.some(
            (e) =>
                x + selectedEntity.width > e.x &&
                x < e.x + e.entityDefinition.width &&
                y + selectedEntity.height > e.y &&
                y < e.y + e.entityDefinition.height
        );

        if (isOccupied) {
            alert("Cannot place here — tiles are occupied!");
            return;
        }

        try {


            const now = Math.floor(Date.now() / 1000);
            // TODO: Set params in backend
            const entityRequest = {
                regionId,
                entityDefinitionId: selectedEntity.id,
                x,
                y,
                ownerId: "mock-user",
                params: {
                    constructionStatus: "UNDER_CONSTRUCTION",
                    startedAt: now
                }
            } as EntityRequest;

            // 1. Create the entity in a "CONSTRUCTING" state
            const { entityKey: newEntityKey, regionId: newRegionId } = await createEntity(entityRequest);
            entityRequest.entityKey = newEntityKey;
            entityRequest.regionId = newRegionId;

            // 2. Start the construction task
            const taskResponse = await fetch(`${API_BASE}/create-task`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entityRequest)
            });

            const { taskId, endsAt } = await taskResponse.json();
            console.log("Entity placed successfully with taskId", taskId, endsAt);

        } catch (err) {
            console.error("Failed to place entity:", err);
        }
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
                    const y = Math.floor(index / gridSize)
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
                                        ? ""
                                        : "#a8d5ba",
                                border: "1px solid rgba(0,0,0,0.08)",
                                boxSizing: "border-box",
                                // overflow: "hidden",
                                cursor: selectedEntity ? "pointer" : "default",
                            }}
                        >
                            {tileEntities.map((e) => {
                                const isTopLeft = e.x === x && e.y === y;
                                if (!isTopLeft) return null;

                                const isConstructing = e.params?.constructionStatus === "UNDER_CONSTRUCTION";
                                const now = Math.floor(Date.now() / 1000);
                                const progress = isConstructing && e.params.startedAt && e.params.endsAt
                                    ? Math.min(1, (now - e.params.startedAt) / (e.params.endsAt - e.params.startedAt))
                                    : 1;

                                return (
                                    <div
                                        key={e.entityKey}
                                        style={{
                                            position: "absolute",
                                            width: tileSize * e.entityDefinition.width + (e.entityDefinition.width - 1) * 2,
                                            height: tileSize * e.entityDefinition.height + (e.entityDefinition.height - 1) * 2,
                                            backgroundColor: isConstructing
                                                ? "rgba(218, 60, 2, 0.6)" // orange for under construction
                                                : "rgba(255, 200, 150, 0.85)",
                                            border: "2px solid #cc8a00",
                                            borderRadius: 4,
                                            textAlign: "center",
                                            fontSize: 14,
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            pointerEvents: "none",
                                            // overflow: "hidden",
                                        }}
                                    >
                                        <img
                                            // src={tileEntities[0].params?.image}
                                            // alt={tileEntities[0].params?.name}
                                            src={isConstructing ? e.entityDefinition.mapIconConstruction : e.entityDefinition.mapIcon}
                                            style={{
                                                width: tileSize * tileEntities[0].entityDefinition.width + (tileEntities[0].entityDefinition.width - 1) * 2,
                                                height: tileSize * tileEntities[0].entityDefinition.height + (tileEntities[0].entityDefinition.height - 1) * 2,
                                                position: "absolute",
                                                top: 0,
                                                left: 0,
                                                objectFit: "cover",
                                            }}
                                        />
                                        {/* {e.params?.name}

                                        {isConstructing && (
                                            <div
                                                style={{
                                                    position: "absolute",
                                                    bottom: 0,
                                                    left: 0,
                                                    width: "100%",
                                                    height: "6px",
                                                    backgroundColor: "#333",
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: `${progress * 100}%`,
                                                        height: "100%",
                                                        backgroundColor: "#4ade80", // green progress bar
                                                        transition: "width 1s linear",
                                                    }}
                                                />
                                            </div>
                                        )} */}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
