import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: number;
    name: string;
    description?: string;
    enabled?: boolean;
    trigger: {
      type: string;
      config: Prisma.InputJsonValue;
      positionX?: number;
      positionY?: number;
    };
    actions: Array<{
      type: string;
      name: string;
      config: Prisma.InputJsonValue;
      order: number;
      positionX?: number;
      positionY?: number;
      retryConfig?: Prisma.InputJsonValue;
    }>;
  }) {
    return this.prisma.workflow.create({
      data: {
        userId: data.userId,
        name: data.name,
        description: data.description,
        enabled: data.enabled ?? true,
        trigger: {
          create: {
            type: data.trigger.type,
            config: data.trigger.config,
            positionX: data.trigger.positionX,
            positionY: data.trigger.positionY,
          },
        },
        actions: {
          create: data.actions.map((action) => ({
            type: action.type,
            name: action.name,
            config: action.config,
            order: action.order,
            positionX: action.positionX,
            positionY: action.positionY,
            retryConfig: action.retryConfig,
          })),
        },
      },
      include: {
        trigger: true,
        actions: {
          orderBy: {
            order: 'asc',
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

  async findById(id: number) {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        trigger: true,
        actions: {
          orderBy: {
            order: 'asc',
          },
          include: {
            nextAction: true,
            parentAction: true,
            childActions: true,
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

  async findByUserId(userId: number, options?: { enabled?: boolean }) {
    return this.prisma.workflow.findMany({
      where: {
        userId,
        ...(options?.enabled !== undefined && { enabled: options.enabled }),
      },
      include: {
        trigger: true,
        actions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async update(
    id: number,
    data: {
      name?: string;
      description?: string;
      enabled?: boolean;
    },
  ) {
    return this.prisma.workflow.update({
      where: { id },
      data,
      include: {
        trigger: true,
        actions: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async delete(id: number) {
    return this.prisma.workflow.delete({
      where: { id },
    });
  }
}
