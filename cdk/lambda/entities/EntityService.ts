import { STATIC_ENTITY_DEFINITIONS } from "./staticEntities";
import { EntityDefinition, EntityRequest, Entity } from "./types";

// In the future, you can fetch from DynamoDB here
export class EntityService {
  static async getAllEntities(): Promise<EntityDefinition[]> {
    // Example: If DynamoDB is integrated later, swap this code
    return STATIC_ENTITY_DEFINITIONS;
  }

  static async getEntityById(id: string): Promise<EntityDefinition | null> {
    const entities = await this.getAllEntities();
    return entities.find((e) => e.id === id) || null;
  }

  static mapEntityRequestToEntity(
    req: EntityRequest,
    definitionMap: Map<string, EntityDefinition>
  ): Entity {
    const entityDefinition = definitionMap.get(req.entityDefinitionId);

    if (!entityDefinition) {
      throw new Error(`Entity definition not found for ID: ${req.entityDefinitionId}`);
    }

    return {
      regionId: req.regionId,
      entityKey: req.entityKey,
      entityDefinition,
      x: req.x,
      y: req.y,
      ownerId: req.ownerId,
      params: req.params,
    };
  }
}
