
import { config } from 'dotenv';
import { resolve } from 'path';
import { addTask, addComment, closeTask } from '../src/lib/todoist';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

async function verifyFeatures() {
    console.log('Starting verification of advanced Todoist features...');

    try {
        // 1. Create Parent Task
        console.log('Creating parent task...');
        const parentTask = await addTask({
            content: 'Test Parent Task (Agent Verification)',
            priority: 4,
            dueString: 'today',
            description: 'This is a parent task created by the verification script.',
        });
        console.log(`Parent Task Created: ID ${parentTask.id}`);

        // 2. Create Subtask
        console.log('Creating subtask...');
        const subtask = await addTask({
            content: 'Test Subtask',
            parentId: parentTask.id,
            priority: 1,
        });
        console.log(`Subtask Created: ID ${subtask.id}, ParentID: ${subtask.parentId}`);

        if (subtask.parentId !== parentTask.id) {
            throw new Error('Subtask parentId functionality failed!');
        }

        // 3. Add Comment to Parent
        console.log('Adding comment to parent task...');
        const comment = await addComment({
            taskId: parentTask.id,
            content: 'This is a test comment.',
        });
        console.log(`Comment Added: ID ${comment.id}, Content: "${comment.content}"`);

        // Cleanup
        console.log('Cleaning up (closing tasks)...');
        await closeTask(parentTask.id);
        await closeTask(subtask.id);
        console.log('Verification Successful!');

    } catch (error) {
        console.error('Verification Failed:', error);
        process.exit(1);
    }
}

verifyFeatures();
