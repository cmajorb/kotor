export type EntityCategory = "BUILDING" | "UNIT" | "RESOURCE";

export interface EntityDefinition {
  id: string;
  name: string;
  type: EntityCategory;
  width: number;
  height: number;
  price: number;
  buildTime: number;
  image: string;
  description?: string;
  stats?: Record<string, number>;
}

export interface Entity {
  regionId: string;
  entityKey: string;
  entityDefinition: EntityDefinition;
  x: number;
  y: number;
  ownerId?: string;
  params: EntityParams;
}

export interface EntityRequest {
  regionId: string;
  entityKey: string;
  entityDefinitionId: string;
  x: number;
  y: number;
  ownerId?: string;
  params: EntityParams;
}

export interface EntityParams {
    constructionStatus?: "UNDER_CONSTRUCTION" | "COMPLETE";
    startedAt?: number;
    endsAt?: number;
}

export interface Task {
  id: string;
  entity: EntityRequest;
  type: "build" | "generate" | "move";
  status: "IN_PROGRESS" | "COMPLETE";
}


export interface GetEntitiesResponse {
  entities: EntityDefinition[];
}