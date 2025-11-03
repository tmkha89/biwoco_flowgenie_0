import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Helper service for managing action relationships in workflows
 * 
 * Note: Action relationships (nextActionId, parentActionId) need to be set
 * after actions are created because they reference other actions in the same workflow.
 */
@Injectable()
export class WorkflowRelationshipHelper {
  private readonly logger = new Logger(WorkflowRelationshipHelper.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update action relationships after all actions are created
   * 
   * @param workflowId - The workflow ID
   * @param actionRelationships - Map of actionId -> { nextActionId?, parentActionId? }
   */
  async updateActionRelationships(
    workflowId: number,
    actionRelationships: Map<number, { nextActionId?: number; parentActionId?: number }>,
  ): Promise<void> {
    this.logger.log(`Updating ${actionRelationships.size} action relationships for workflow ${workflowId}`);
    const updates = [];

    for (const [actionId, relationships] of actionRelationships.entries()) {
      const updateData: any = {};
      if (relationships.nextActionId !== undefined) {
        updateData.nextActionId = relationships.nextActionId;
        this.logger.debug(`Action ${actionId}: nextActionId=${relationships.nextActionId}`);
      }
      if (relationships.parentActionId !== undefined) {
        updateData.parentActionId = relationships.parentActionId;
        this.logger.debug(`Action ${actionId}: parentActionId=${relationships.parentActionId}`);
      }

      if (Object.keys(updateData).length > 0) {
        updates.push(
          this.prisma.action.update({
            where: { id: actionId },
            data: updateData,
          }),
        );
        this.logger.debug(`Queued update for action ${actionId}: ${JSON.stringify(updateData)}`);
      }
    }

    this.logger.debug(`Executing ${updates.length} relationship updates in parallel`);
    await Promise.all(updates);
    this.logger.log(`Successfully updated ${updates.length} action relationships for workflow ${workflowId}`);
  }

  /**
   * Build action relationships from workflow definition
   * 
   * @param actions - Actions from workflow definition (with temporary IDs)
   * @param createdActions - Created actions from database (with real IDs)
   * @returns Map of real actionId -> relationships
   */
  buildActionRelationships(
    actions: Array<{ id: number; order: number; nextActionId?: number; parentActionId?: number }>,
    createdActions: Array<{ id: number; order: number }>,
  ): Map<number, { nextActionId?: number; parentActionId?: number }> {
    const relationshipMap = new Map<number, { nextActionId?: number; parentActionId?: number }>();

    // Map temporary IDs to real IDs by order
    const tempIdToRealId = new Map<number, number>();
    createdActions.sort((a, b) => a.order - b.order);
    actions.sort((a, b) => a.order - b.order);

    for (let i = 0; i < actions.length && i < createdActions.length; i++) {
      tempIdToRealId.set(actions[i].id, createdActions[i].id);
    }

    // Build relationships using real IDs
    for (const action of actions) {
      const realActionId = tempIdToRealId.get(action.id);
      if (!realActionId) continue;

      const relationships: { nextActionId?: number; parentActionId?: number } = {};

      if (action.nextActionId !== undefined && action.nextActionId !== null) {
        const realNextActionId = tempIdToRealId.get(action.nextActionId);
        if (realNextActionId) {
          relationships.nextActionId = realNextActionId;
        }
      }

      if (action.parentActionId !== undefined && action.parentActionId !== null) {
        const realParentActionId = tempIdToRealId.get(action.parentActionId);
        if (realParentActionId) {
          relationships.parentActionId = realParentActionId;
        }
      }

      if (Object.keys(relationships).length > 0) {
        relationshipMap.set(realActionId, relationships);
      }
    }

    return relationshipMap;
  }
}

