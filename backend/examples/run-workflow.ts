/**
 * Example script to run a workflow definition end-to-end
 * 
 * Usage:
 *   npm install -g ts-node
 *   ts-node examples/run-workflow.ts
 * 
 * Or compile and run:
 *   npm run build
 *   node dist/examples/run-workflow.js
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { WorkflowService } from '../src/workflows/workflow.service';
import { ExecutionService } from '../src/workflows/execution.service';
import * as fs from 'fs';
import * as path from 'path';

interface WorkflowDefinition {
  name: string;
  description?: string;
  enabled: boolean;
  trigger: {
    type: string;
    config: Record<string, any>;
  };
  actions: Array<{
    id: number;
    type: string;
    name: string;
    order: number;
    config: Record<string, any>;
    nextActionId?: number;
    parentActionId?: number;
    retryConfig?: {
      attempts: number;
      backoff: {
        type: 'fixed' | 'exponential';
        delay: number;
      };
    };
  }>;
}

async function bootstrap() {
  console.log('🚀 Starting workflow execution demo...\n');

  // Create NestJS application
  const app = await NestFactory.createApplicationContext(AppModule);
  const workflowService = app.get(WorkflowService);
  const executionService = app.get(ExecutionService);

  // Load workflow definition
  const workflowFile = process.argv[2] || 'demo-workflow-simple.json';
  const workflowPath = path.join(__dirname, workflowFile);
  
  if (!fs.existsSync(workflowPath)) {
    console.error(`❌ Workflow file not found: ${workflowPath}`);
    process.exit(1);
  }

  const workflowDef: WorkflowDefinition = JSON.parse(fs.readFileSync(workflowPath, 'utf-8'));
  console.log(`📋 Loaded workflow: ${workflowDef.name}`);
  console.log(`   Description: ${workflowDef.description || 'N/A'}`);
  console.log(`   Actions: ${workflowDef.actions.length}\n`);

  try {
    // Create workflow (assuming userId = 1 for demo)
    console.log('📝 Creating workflow...');
    const workflow = await workflowService.create(1, {
      name: workflowDef.name,
      description: workflowDef.description,
      enabled: workflowDef.enabled,
      trigger: {
        type: workflowDef.trigger.type as any, // Cast to match TriggerType enum
        config: workflowDef.trigger.config,
      },
      actions: workflowDef.actions.map((action) => ({
        type: action.type,
        name: action.name,
        config: action.config,
        order: action.order,
        retryConfig: action.retryConfig
          ? {
              type: action.retryConfig.backoff?.type || 'fixed',
              delay: action.retryConfig.backoff?.delay || 1000,
            }
          : undefined,
      })),
    });
    console.log(`✅ Workflow created with ID: ${workflow.id}\n`);

    // Trigger workflow execution
    console.log('▶️  Triggering workflow execution...');
    const triggerData = {
      userId: 123,
      apiKey: 'demo-api-key',
      email: 'demo@example.com',
    };

    const execution = await workflowService.trigger(workflow.id, 1, triggerData);
    console.log(`✅ Execution started with ID: ${execution.id}`);
    console.log(`   Status: ${execution.status}\n`);

    // Wait for execution to complete (polling)
    console.log('⏳ Waiting for execution to complete...');
    let maxWaitTime = 60000; // 60 seconds
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const updatedExecution = await executionService.findById(execution.id, 1);

      console.log(`   Status: ${updatedExecution.status}`);

      if (updatedExecution.status === 'completed') {
        console.log('\n✅ Execution completed successfully!');
        console.log(`\n📊 Execution Results:`);
        console.log(JSON.stringify(updatedExecution.result, null, 2));
        break;
      } else if (updatedExecution.status === 'failed') {
        console.log('\n❌ Execution failed!');
        console.log(`   Error: ${updatedExecution.error}`);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (Date.now() - startTime >= maxWaitTime) {
      console.log('\n⏱️  Execution timeout - still running');
    }

    // Show execution steps
    const finalExecution = await executionService.findById(execution.id, 1);
    console.log(`\n📋 Execution Steps:`);
    finalExecution.executionSteps.forEach((step: any, index: number) => {
      console.log(`   ${index + 1}. ${step.action.name} - ${step.status}`);
      if (step.error) {
        console.log(`      Error: ${step.error}`);
      }
    });

    console.log('\n✨ Demo completed!');

    // Clean up (optional - comment out to keep workflow)
    // console.log('\n🧹 Cleaning up...');
    // await workflowService.delete(workflow.id, 1);
    // console.log('✅ Workflow deleted');

    await app.close();
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await app.close();
    process.exit(1);
  }
}

// Run the demo
bootstrap().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

