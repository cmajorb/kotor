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
    menuIcon: "https://placehold.co/100x100?text=House",
    mapIcon: "https://pics.craiyon.com/2023-11-30/dDNyf1iHSHeLo7vvNnJwHg.webp",
    mapIconConstruction: "https://cdn-icons-png.flaticon.com/512/248/248144.png",
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
    menuIcon: "https://placehold.co/100x100?text=Barracks",
    mapIcon: "https://pics.craiyon.com/2023-11-30/dDNyf1iHSHeLo7vvNnJwHg.webp",
    mapIconConstruction: "https://cdn-icons-png.flaticon.com/512/248/248144.png",
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
    menuIcon: "https://placehold.co/100x100?text=Soldier",
    mapIcon: "https://pics.craiyon.com/2023-11-30/dDNyf1iHSHeLo7vvNnJwHg.webp",
    mapIconConstruction: "https://cdn-icons-png.flaticon.com/512/248/248144.png",
    description: "Basic infantry unit with moderate attack power.",
    stats: { health: 100, attack: 10 }
  }
];
