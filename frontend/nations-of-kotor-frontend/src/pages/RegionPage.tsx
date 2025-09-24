import { useState } from "react";
import BuildMenu from "../components/BuildMenu";
import RegionMap from "../components/RegionMap";
import type { EntityOption } from "../types";

const ENTITY_OPTIONS: EntityOption[] = [
    {
        id: "house",
        name: "House",
        width: 2,
        height: 2,
        price: 100,
        type: "BUILDING",
        image: "https://placehold.co/100x100/A0A0A0/ffffff?text=House",
    },
    {
        id: "barracks",
        name: "Barracks",
        width: 3,
        height: 3,
        price: 250,
        type: "BUILDING",
        image: "https://placehold.co/100x100/A0A0A0/ffffff?text=Barracks",
    },
    {
        id: "castle",
        name: "Castle",
        width: 4,
        height: 5,
        price: 2500,
        type: "BUILDING",
        image: "https://placehold.co/100x100/A0A0A0/ffffff?text=Castle",
    },
    {
        id: "soldier",
        name: "Soldier",
        width: 1,
        height: 1,
        price: 50,
        type: "UNIT",
        image: "https://placehold.co/100x100/A0A0A0/ffffff?text=Soldier",
    },
];

export default function RegionPage({ regionId }: { regionId: string }) {
    const [selectedEntity, setSelectedEntity] = useState<EntityOption | null>(null);

    const buildings = ENTITY_OPTIONS.filter((e) => e.type === "BUILDING");
    const units = ENTITY_OPTIONS.filter((e) => e.type === "UNIT");

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
