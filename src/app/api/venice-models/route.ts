type VeniceModel = {
    id: string
    object: string
    owned_by: string
    type: string
    created?: number
    model_spec?: {
        name?: string
        description?: string
        availableContextTokens?: number
        modelSource?: string
        offline?: boolean
        traits?: string[]
        capabilities?: {
            supportsFunctionCalling?: boolean
            supportsReasoning?: boolean
            supportsVision?: boolean
        }
    }
}

const VENICE_API_BASE = 'https://api.venice.ai/api/v1'

function unauthorized() {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
}

export async function GET(req: Request) {
    if (!process.env.VENICE_API_KEY) {
        return new Response(JSON.stringify({ error: 'Configuration Error: VENICE_API_KEY missing' }), { status: 500 })
    }

    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${process.env.ACCESS_CODE}`) {
        return unauthorized()
    }

    try {
        const headers = {
            Authorization: `Bearer ${process.env.VENICE_API_KEY}`,
        }

        const [modelsResponse, traitsResponse] = await Promise.all([
            fetch(`${VENICE_API_BASE}/models?type=text`, {
                headers,
                next: { revalidate: 60 * 60 },
            }),
            fetch(`${VENICE_API_BASE}/models/traits?type=text`, {
                headers,
                next: { revalidate: 15 * 60 },
            }),
        ])

        if (!modelsResponse.ok) {
            throw new Error(`Venice models request failed: ${modelsResponse.status} ${modelsResponse.statusText}`)
        }

        const modelsPayload = await modelsResponse.json()
        const traitsPayload = traitsResponse.ok ? await traitsResponse.json() : { data: {} }
        const defaultModelId = typeof traitsPayload.data?.default === 'string' ? traitsPayload.data.default : null

        const availableModels = (Array.isArray(modelsPayload.data) ? modelsPayload.data : [])
            .filter((model: VeniceModel) => model.type === 'text' && !model.model_spec?.offline)

        const openModels = availableModels.filter((model: VeniceModel) => Boolean(model.model_spec?.modelSource))
        const defaultModel = availableModels.find((model: VeniceModel) => model.id === defaultModelId)
        const newestOpenModel = [...openModels].sort((a, b) => (b.created || 0) - (a.created || 0))[0]
        const openDefaultModelId = defaultModel?.model_spec?.modelSource ? defaultModel.id : newestOpenModel?.id || defaultModelId

        const models = availableModels
            .map((model: VeniceModel) => ({
                id: model.id,
                name: model.model_spec?.name || model.id,
                description: model.model_spec?.description || '',
                contextTokens: model.model_spec?.availableContextTokens || null,
                modelSource: model.model_spec?.modelSource || null,
                isOpenSource: Boolean(model.model_spec?.modelSource),
                traits: model.model_spec?.traits || [],
                isDefault: model.id === defaultModelId,
                isOpenDefault: model.id === openDefaultModelId,
                supportsFunctionCalling: Boolean(model.model_spec?.capabilities?.supportsFunctionCalling),
                supportsReasoning: Boolean(model.model_spec?.capabilities?.supportsReasoning),
                supportsVision: Boolean(model.model_spec?.capabilities?.supportsVision),
            }))
            .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))

        return Response.json({
            defaultModelId,
            openDefaultModelId,
            models,
            updatedAt: new Date().toISOString(),
        })
    } catch (error) {
        console.error('Venice models API error:', error)
        return new Response(JSON.stringify({ error: 'Failed to fetch Venice models' }), { status: 502 })
    }
}
