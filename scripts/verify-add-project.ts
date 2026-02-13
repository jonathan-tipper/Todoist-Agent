
import dotenv from 'dotenv'
import path from 'path'
import { addProject } from '../src/lib/todoist'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const verifyAddProject = async () => {
    const projectName = `Test Project ${Date.now()}`
    console.log(`Attempting to create project: ${projectName}`)

    try {
        const project = await addProject(projectName)
        console.log('Successfully created project:')
        console.log(`ID: ${project.id}`)
        console.log(`Name: ${project.name}`)

        if (project.name === projectName) {
            console.log('✅ Verification Passed')
        } else {
            console.error('❌ Verification Failed: Project name mismatch')
        }
    } catch (error) {
        console.error('❌ Verification Failed:', error)
    }
}

verifyAddProject()
