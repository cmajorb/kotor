export interface Entity {
  entityKey: string;
  entityType: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ownerId?: string;
  data?: any;
}

export interface EntityOption {
  id: string;
  name: string;
  width: number;
  height: number;
  price: number;
  type: "BUILDING" | "UNIT";
  image: string;
}
