
import { TodoistApi } from '@doist/todoist-api-typescript'
import type {
    AddTaskArgs as TodoistAddTaskArgs,
    UpdateTaskArgs as TodoistUpdateTaskArgs,
} from '@doist/todoist-api-typescript'

const getTodoistClient = () => {
    const token = process.env.TODOIST_API_TOKEN
    if (!token) {
        throw new Error('TODOIST_API_TOKEN is not set')
    }
    return new TodoistApi(token)
}

export const getTasks = async (filter?: string) => {
    try {
        const todoist = getTodoistClient()
        if (filter) {
            const response = await todoist.getTasksByFilter({ query: filter })
            return response.results
        }
        const response = await todoist.getTasks()
        // Check if response is array (older versions) or object (newer versions)
        // Based on types, it's an object with results
        return 'results' in response ? response.results : response
    } catch (error) {
        console.error('Error fetching tasks:', error)
        throw error
    }
}

export const getProjects = async () => {
    try {
        const todoist = getTodoistClient()
        const response = await todoist.getProjects()
        return response.results
    } catch (error) {
        console.error('Error fetching projects:', error)
        throw error
    }
}

export const addProject = async (name: string) => {
    try {
        const todoist = getTodoistClient()
        const project = await todoist.addProject({ name })
        return project
    } catch (error) {
        console.error('Error adding project:', error)
        throw error
    }
}

type TaskDuration = {
    amount: number
    unit: 'minute' | 'day'
}

type AddTaskArgs = {
    content: string
    description?: string
    dueString?: string
    dueLang?: string
    priority?: number
    projectId?: string
    sectionId?: string
    parentId?: string
    order?: number
    labels?: string[]
    duration?: TaskDuration
}

export const addTask = async (args: AddTaskArgs) => {
    try {
        const todoist = getTodoistClient()
        const baseTaskArgs = {
            content: args.content,
            description: args.description,
            dueString: args.dueString,
            dueLang: args.dueLang,
            priority: args.priority,
            projectId: args.projectId,
            sectionId: args.sectionId,
            parentId: args.parentId,
            order: args.order,
            labels: args.labels,
        } satisfies TodoistAddTaskArgs
        const taskArgs: TodoistAddTaskArgs = args.duration
            ? {
                ...baseTaskArgs,
                duration: args.duration.amount,
                durationUnit: args.duration.unit,
            }
            : baseTaskArgs
        const task = await todoist.addTask(taskArgs)
        return task
    } catch (error) {
        console.error('Error adding task:', error)
        throw error
    }
}

type AddCommentArgs = {
    taskId: string
    content: string
    attachment?: {
        fileName?: string
        fileUrl: string
        fileType?: string
        resourceType?: string
    }
}

export const addComment = async (args: AddCommentArgs) => {
    try {
        const todoist = getTodoistClient()
        const comment = await todoist.addComment({
            taskId: args.taskId,
            content: args.content,
            attachment: args.attachment,
        })
        return comment
    } catch (error) {
        console.error('Error adding comment:', error)
        throw error
    }
}

export const getTask = async (id: string) => {
    try {
        const todoist = getTodoistClient()
        const task = await todoist.getTask(id)
        return task
    } catch (error) {
        console.error('Error getting task:', error)
        throw error
    }
}

type UpdateTaskArgs = {
    content?: string
    description?: string
    dueString?: string
    priority?: number
    labels?: string[]
    duration?: TaskDuration | null
}

export const updateTask = async (id: string, args: UpdateTaskArgs) => {
    try {
        const todoist = getTodoistClient()
        const { duration, ...rest } = args
        const sdkArgs: Record<string, unknown> = { ...rest }
        if (duration !== undefined) {
            // null clears the duration; object sets it
            sdkArgs.duration = duration === null ? null : duration.amount
            sdkArgs.durationUnit = duration === null ? null : duration.unit
        }
        const isSuccess = await todoist.updateTask(id, sdkArgs as unknown as TodoistUpdateTaskArgs)
        return isSuccess
    } catch (error) {
        console.error('Error updating task:', error)
        throw error
    }
}

export const moveTask = async (id: string, projectId: string) => {
    try {
        const todoist = getTodoistClient()
        const isSuccess = await todoist.moveTask(id, { projectId })
        return isSuccess
    } catch (error) {
        console.error('Error moving task:', error)
        throw error
    }
}

export const closeTask = async (id: string) => {
    try {
        const todoist = getTodoistClient()
        const isSuccess = await todoist.closeTask(id)
        return isSuccess
    } catch (error) {
        console.error('Error closing task:', error)
        throw error
    }
}
