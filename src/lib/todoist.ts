
import { TodoistApi } from '@doist/todoist-api-typescript'

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
        return []
    }
}

export const getProjects = async () => {
    try {
        const todoist = getTodoistClient()
        // v6 getProjects returns GetProjectsResponse or array? type definiton says GetProjectsResponse in v6.4.0? 
        // Let's assume response.results or response.
        const response: any = await todoist.getProjects()
        return response.results ? response.results : response
    } catch (error) {
        console.error('Error fetching projects:', error)
        return []
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
        const task = await todoist.addTask({
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
            duration: args.duration,
        })
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
        const isSuccess = await todoist.updateTask(id, args)
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
