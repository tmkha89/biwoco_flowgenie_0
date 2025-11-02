import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';
import { WorkflowStatus, ExecutionStepStatus } from '../interfaces/workflow.interface';

@Injectable()
export class ExecutionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    workflowId: number;
    userId: number;
    status?: WorkflowStatus;
    triggerData?: Prisma.InputJsonValue;
  }) {
    return this.prisma.execution.create({
      data: {
        workflowId: data.workflowId,
        userId: data.userId,
        status: (data.status || WorkflowStatus.PENDING) as any,
        triggerData: data.triggerData,
      },
      include: {
        workflow: {
          include: {
            actions: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        executionSteps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            action: true,
          },
        },
      },
    });
  }

  async findById(id: number) {
    return this.prisma.execution.findUnique({
      where: { id },
      include: {
        workflow: {
          include: {
            trigger: true,
            actions: {
              orderBy: {
                order: 'asc',
              },
            },
          },
        },
        executionSteps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            action: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  async findByWorkflowId(workflowId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    return this.prisma.execution.findMany({
      where: { workflowId },
      include: {
        executionSteps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            action: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  async findByUserId(userId: number, options?: {
    limit?: number;
    offset?: number;
  }) {
    return this.prisma.execution.findMany({
      where: { userId },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
          },
        },
        executionSteps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            action: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  async update(id: number, data: {
    status?: WorkflowStatus;
    result?: Prisma.InputJsonValue;
    error?: string;
    startedAt?: Date;
    completedAt?: Date;
  }) {
    return this.prisma.execution.update({
      where: { id },
      data,
      include: {
        executionSteps: {
          orderBy: {
            order: 'asc',
          },
          include: {
            action: true,
          },
        },
      },
    });
  }

  async createExecutionStep(data: {
    executionId: number;
    actionId: number;
    order: number;
    status?: ExecutionStepStatus;
    input?: Prisma.InputJsonValue;
  }) {
    return this.prisma.executionStep.create({
      data: {
        executionId: data.executionId,
        actionId: data.actionId,
        order: data.order,
        status: (data.status || ExecutionStepStatus.PENDING) as any,
        input: data.input,
      },
      include: {
        action: true,
      },
    });
  }

  async updateExecutionStep(id: number, data: {
    status?: ExecutionStepStatus;
    output?: Prisma.InputJsonValue;
    error?: string;
    retryCount?: number;
    startedAt?: Date;
    completedAt?: Date;
  }) {
    return this.prisma.executionStep.update({
      where: { id },
      data,
      include: {
        action: true,
      },
    });
  }

  async findExecutionStepById(id: number) {
    return this.prisma.executionStep.findUnique({
      where: { id },
      include: {
        action: true,
        execution: true,
      },
    });
  }
}

