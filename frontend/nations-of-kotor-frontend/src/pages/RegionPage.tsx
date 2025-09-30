import { useEffect, useState } from "react";
import BuildMenu from "../components/BuildMenu";
import RegionMap from "../components/RegionMap";
import type { EntityDefinition } from "../types";
import { fetchEntities } from "../api/mapApi";



export default function RegionPage({ regionId }: { regionId: string }) {
    const [selectedEntity, setSelectedEntity] = useState<EntityDefinition | null>(null);
    const [entities, setEntities] = useState<EntityDefinition[]>([]);

    useEffect(() => {
        fetchEntities().then(setEntities).catch(console.error);
    }, []);
    const buildings = entities.filter((e) => e.type === "BUILDING");
    const units = entities.filter((e) => e.type === "UNIT");

    return (
        <div className="flex w-full h-screen p-4 gap-4 bg-gray-900 text-white">
            <div className="flex-1 flex items-center justify-center relative">
                <RegionMap regionId={regionId} selectedEntity={selectedEntity} />
            </div>

            <BuildMenu
                buildings={buildings}
                units={units}
                selectedEntity={selectedEntity}
                onSelect={setSelectedEntity}
                onCancel={() => setSelectedEntity(null)}
            />
        </div>
    );
}
