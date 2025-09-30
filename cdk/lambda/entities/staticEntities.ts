import { EntityDefinition } from "./types";

export const STATIC_ENTITY_DEFINITIONS: EntityDefinition[] = [
  {
    id: "house",
    name: "House",
    type: "BUILDING",
    width: 2,
    height: 2,
    price: 100,
    buildTime: 30,
    image: "https://placehold.co/100x100?text=House",
    description: "Provides housing for your population."
  },
  {
    id: "barracks",
    name: "Barracks",
    type: "BUILDING",
    width: 3,
    height: 3,
    price: 250,
    buildTime: 60,
    image: "https://placehold.co/100x100?text=Barracks",
    description: "Trains basic military units."
  },
  {
    id: "soldier",
    name: "Soldier",
    type: "UNIT",
    width: 1,
    height: 1,
    price: 50,
    buildTime: 20,
    image: "https://placehold.co/100x100?text=Soldier",
    description: "Basic infantry unit with moderate attack power.",
    stats: { health: 100, attack: 10 }
  }
];
