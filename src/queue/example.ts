/**
 * Example usage of the Task Queue system
 */

import { TaskQueue } from './task-queue';
import { Task, TaskStatus, TestType } from '../models/types';

async function demonstrateTaskQueue() {
  console.log('=== Task Queue System Demo ===\n');

  const taskQueue = new TaskQueue();

  try {
    // Initialize the queue system
    console.log('1. Initializing task queue...');
    await taskQueue.initialize();
    console.log('✅ Task queue initialized successfully\n');

    // Create sample tasks
    const sampleTasks: Task[] = [
      {
        id: 'task-001',
        title: 'Implement user authentication',
        description: 'Create login and registration functionality',
        priority: 10,
        dependencies: [],
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        deadline: new Date(Date.now() + 86400000) // 1 day from now
      },
      {
        id: 'task-002',
        title: 'Create user dashboard',
        description: 'Build React dashboard for user management',
        priority: 5,
        dependencies: ['task-001'],
        status: TaskStatus.PENDING,
        createdAt: new Date(),
        deadline: new Date(Date.now() + 172800000) // 2 days from now
      },
      {
        id: 'task-003',
        title: 'Add unit tests',
        description: 'Write comprehensive unit tests for auth module',
        priority: 3,
        dependencies: ['task-001'],
        status: TaskStatus.PENDING,
        createdAt: new Date()
      }
    ];

    // Add tasks to queue
    console.log('2. Adding tasks to queue...');
    for (const task of sampleTasks) {
      const jobId = await taskQueue.addTask(task);
      console.log(`   ✅ Added task "${task.title}" (Job ID: ${jobId})`);
    }
    console.log();

    // Get queue statistics
    console.log('3. Queue statistics:');
    const stats = await taskQueue.getStats();
    console.log(`   - Waiting: ${stats.waiting}`);
    console.log(`   - Active: ${stats.active}`);
    console.log(`   - Completed: ${stats.completed}`);
    console.log(`   - Failed: ${stats.failed}\n`);

    // Simulate agent getting tasks
    console.log('4. Simulating agent task processing...');
    
    // Agent 1 gets next task
    const agent1Task = await taskQueue.getNextTask('agent-001');
    if (agent1Task) {
      console.log(`   🤖 Agent-001 received task: "${agent1Task.title}"`);
      
      // Simulate task completion
      setTimeout(async () => {
        const workResult = {
          taskId: agent1Task.id,
          agentId: 'agent-001',
          codeChanges: [
            {
              filePath: '/src/auth/login.ts',
              action: 'CREATE' as const,
              content: 'export const login = async (email: string, password: string) => { /* implementation */ };'
            }
          ],
          testResults: {
            testType: TestType.UNIT,
            passed: true,
            totalTests: 5,
            passedTests: 5,
            failedTests: 0,
            executionTime: 2500,
            details: [
              {
                name: 'should authenticate valid user',
                passed: true,
                duration: 500
              }
            ]
          },
          completionTime: new Date()
        };

        try {
          await taskQueue.completeTask(agent1Task.id, workResult);
          console.log(`   ✅ Agent-001 completed task: "${agent1Task.title}"`);
          
          // Show updated stats
          const updatedStats = await taskQueue.getStats();
          console.log(`   📊 Updated stats - Completed: ${updatedStats.completed}, Waiting: ${updatedStats.waiting}`);
        } catch (error) {
          console.error(`   ❌ Failed to complete task: ${error}`);
        }
      }, 1000);
    }

    // Agent 2 gets next task
    const agent2Task = await taskQueue.getNextTask('agent-002');
    if (agent2Task) {
      console.log(`   🤖 Agent-002 received task: "${agent2Task.title}"`);
    } else {
      console.log(`   🤖 Agent-002 found no available tasks`);
    }

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Show all tasks
    console.log('\n5. All tasks in queue:');
    const allTasks = await taskQueue.getAllTasks();
    allTasks.forEach(({ task, status, jobId }) => {
      console.log(`   - ${task.title} (${status}) [Job: ${jobId}]`);
    });

    // Cleanup
    console.log('\n6. Cleaning up...');
    await taskQueue.cleanup();
    await taskQueue.close();
    console.log('✅ Task queue closed successfully');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateTaskQueue().catch(console.error);
}

export { demonstrateTaskQueue };