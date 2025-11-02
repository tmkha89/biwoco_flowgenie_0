import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { TriggerWorkflowDto } from './dto/trigger-workflow.dto';
import { WorkflowResponseDto, ExecutionResponseDto } from './dto/workflow-response.dto';
import { plainToInstance } from 'class-transformer';

/**
 * @openapi
 * tags:
 *   - name: Workflows
 *     description: Workflow management and execution endpoints
 */
@Controller('workflows')
@UseGuards(JwtAuthGuard)
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService,
  ) {}

  /**
   * @openapi
   * /workflows:
   *   post:
   *     summary: Create a new workflow
   *     description: Creates a new workflow with a trigger and one or more actions
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateWorkflow'
   *           example:
   *             name: "Email Notification Workflow"
   *             description: "Sends email when user signs up"
   *             enabled: true
   *             trigger:
   *               type: "manual"
   *               config: {}
   *             actions:
   *               - type: "example_action"
   *                 name: "Send Welcome Email"
   *                 config:
   *                   to: "{{user.email}}"
   *                   subject: "Welcome!"
   *                 order: 0
   *                 retryConfig:
   *                   type: "exponential"
   *                   delay: 2000
   *     responses:
   *       201:
   *         description: Workflow created successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WorkflowResponse'
   *       400:
   *         description: Invalid input data
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   */
  @Post()
  async create(
    @CurrentUser('id') userId: number,
    @Body() createDto: CreateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.create(userId, createDto);
    return plainToInstance(WorkflowResponseDto, workflow, { excludeExtraneousValues: true });
  }

  /**
   * @openapi
   * /workflows:
   *   get:
   *     summary: Get all workflows for the current user
   *     description: Returns a list of all workflows belonging to the authenticated user
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: enabled
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Filter by enabled status
   *         required: false
   *     responses:
   *       200:
   *         description: List of workflows
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/WorkflowResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   */
  @Get()
  async findAll(
    @CurrentUser('id') userId: number,
    @Query('enabled') enabled?: string,
  ): Promise<WorkflowResponseDto[]> {
    const workflows = await this.workflowService.findByUserId(userId, {
      enabled: enabled !== undefined ? enabled === 'true' : undefined,
    });
    return workflows.map((workflow) =>
      plainToInstance(WorkflowResponseDto, workflow, { excludeExtraneousValues: true }),
    );
  }

  /**
   * @openapi
   * /workflows/{id}:
   *   get:
   *     summary: Get a workflow by ID
   *     description: Returns details of a specific workflow
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     responses:
   *       200:
   *         description: Workflow details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WorkflowResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Workflow not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Get(':id')
  async findOne(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.findById(id, userId);
    return plainToInstance(WorkflowResponseDto, workflow, { excludeExtraneousValues: true });
  }

  /**
   * @openapi
   * /workflows/{id}:
   *   put:
   *     summary: Update a workflow
   *     description: Updates workflow name, description, enabled status, trigger, and/or actions
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateWorkflow'
   *           example:
   *             name: "Updated Workflow Name"
   *             description: "Updated description"
   *             enabled: true
   *             trigger:
   *               type: "manual"
   *               config: {}
   *             actions:
   *               - type: "http_request"
   *                 name: "Updated Action"
   *                 config:
   *                   url: "https://api.example.com"
   *                   method: "GET"
   *                 order: 0
   *     responses:
   *       200:
   *         description: Workflow updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/WorkflowResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Workflow not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Put(':id')
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.update(id, userId, updateDto);
    return plainToInstance(WorkflowResponseDto, workflow, { excludeExtraneousValues: true });
  }

  /**
   * @openapi
   * /workflows/{id}:
   *   delete:
   *     summary: Delete a workflow
   *     description: Deletes a workflow and all associated triggers and actions
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     responses:
   *       200:
   *         description: Workflow deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Workflow deleted successfully"
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Workflow not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Delete(':id')
  async remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.workflowService.delete(id, userId);
    return { message: 'Workflow deleted successfully' };
  }

  /**
   * @openapi
   * /workflows/{id}/trigger:
   *   post:
   *     summary: Trigger a workflow execution
   *     description: Manually triggers a workflow to execute with optional trigger data
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/TriggerWorkflow'
   *     responses:
   *       201:
   *         description: Workflow execution started
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ExecutionResponse'
   *       400:
   *         description: Workflow is disabled or invalid
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Workflow not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Post(':id/trigger')
  async trigger(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() triggerDto: TriggerWorkflowDto,
  ): Promise<ExecutionResponseDto> {
    const execution = await this.workflowService.trigger(id, userId, triggerDto.triggerData);
    return plainToInstance(ExecutionResponseDto, execution, { excludeExtraneousValues: true });
  }

  /**
   * @openapi
   * /workflows/{id}/executions:
   *   get:
   *     summary: Get execution history for a workflow
   *     description: Returns execution history for a specific workflow
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Workflow ID
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Maximum number of executions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of executions to skip
   *     responses:
   *       200:
   *         description: List of executions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ExecutionResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Workflow not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Get(':id/executions')
  async getExecutions(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ExecutionResponseDto[]> {
    // Verify workflow belongs to user
    await this.workflowService.findById(id, userId);

    const executions = await this.executionService.findByWorkflowId(id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return executions.map((execution) =>
      plainToInstance(ExecutionResponseDto, execution, { excludeExtraneousValues: true }),
    );
  }

  /**
   * @openapi
   * /workflows/executions/history:
   *   get:
   *     summary: Get execution history for all workflows
   *     description: Returns execution history for all workflows belonging to the authenticated user
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *         description: Maximum number of executions to return
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           default: 0
   *         description: Number of executions to skip
   *     responses:
   *       200:
   *         description: List of executions
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/ExecutionResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   */
  @Get('executions/history')
  async getExecutionHistory(
    @CurrentUser('id') userId: number,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ExecutionResponseDto[]> {
    const executions = await this.executionService.findByUserId(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });

    return executions.map((execution) =>
      plainToInstance(ExecutionResponseDto, execution, { excludeExtraneousValues: true }),
    );
  }

  /**
   * @openapi
   * /workflows/executions/{executionId}:
   *   get:
   *     summary: Get execution details
   *     description: Returns detailed information about a specific workflow execution
   *     tags:
   *       - Workflows
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: executionId
   *         required: true
   *         schema:
   *           type: integer
   *         description: Execution ID
   *     responses:
   *       200:
   *         description: Execution details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ExecutionResponse'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *       404:
   *         description: Execution not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  @Get('executions/:executionId')
  async getExecution(
    @CurrentUser('id') userId: number,
    @Param('executionId', ParseIntPipe) executionId: number,
  ): Promise<ExecutionResponseDto> {
    const execution = await this.executionService.findById(executionId, userId);
    return plainToInstance(ExecutionResponseDto, execution, { excludeExtraneousValues: true });
  }
}
