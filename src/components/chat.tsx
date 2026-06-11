
'use client'

import { useChat } from '@ai-sdk/react'
import type { Message } from '@ai-sdk/react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Bot, User, Loader2, CheckCircle2, Terminal, RefreshCw, History, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuthWall } from './auth-wall'
import { ModeToggle } from './mode-toggle'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const AUTO_OPEN_MODEL_VALUE = '__venice_open_default__'
const AUTO_MODEL_VALUE = '__venice_default__'
const MODEL_PREFERENCE_KEY = 'todoist-agent-model'
const HISTORY_LIMIT = 20
const MESSAGE_LIMIT = 80

type SavedThread = {
    id: string
    title: string
    createdAt: string
    updatedAt: string
    model: string
    messages: Message[]
}

type VeniceModelOption = {
    id: string
    name: string
    description: string
    contextTokens: number | null
    modelSource: string | null
    isOpenSource: boolean
    traits: string[]
    isDefault: boolean
    isOpenDefault: boolean
    supportsFunctionCalling: boolean
    supportsReasoning: boolean
    supportsVision: boolean
}

const fallbackModels: VeniceModelOption[] = [
    {
        id: 'llama-3.3-70b',
        name: 'Llama 3.3 70B',
        description: 'Fallback model used when the live Venice model catalog is unavailable.',
        contextTokens: null,
        modelSource: null,
        isOpenSource: true,
        traits: [],
        isDefault: false,
        isOpenDefault: true,
        supportsFunctionCalling: true,
        supportsReasoning: false,
        supportsVision: false,
    },
    {
        id: 'venice-uncensored',
        name: 'Venice Uncensored',
        description: 'Fallback Venice model used when the live model catalog is unavailable.',
        contextTokens: null,
        modelSource: null,
        isOpenSource: true,
        traits: [],
        isDefault: false,
        isOpenDefault: false,
        supportsFunctionCalling: false,
        supportsReasoning: false,
        supportsVision: false,
    },
]

function createThreadId() {
    return `thread-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function getChatHistoryKey(accessCode: string) {
    let hash = 0
    for (let i = 0; i < accessCode.length; i += 1) {
        hash = Math.imul(31, hash) + accessCode.charCodeAt(i) | 0
    }

    return `todoist-agent-chat-history:${Math.abs(hash).toString(36)}`
}

function reviveMessages(messages: Message[]) {
    return messages.map((message) => ({
        ...message,
        createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    }))
}

function parseThreads(rawHistory: string | null): SavedThread[] {
    if (!rawHistory) return []

    try {
        const parsed = JSON.parse(rawHistory)
        if (!Array.isArray(parsed)) return []

        return parsed
            .filter((thread): thread is SavedThread => (
                typeof thread?.id === 'string'
                && typeof thread?.title === 'string'
                && Array.isArray(thread?.messages)
            ))
            .map((thread) => ({
                ...thread,
                messages: reviveMessages(thread.messages),
            }))
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, HISTORY_LIMIT)
    } catch (error) {
        console.error('Unable to parse saved chat history:', error)
        return []
    }
}

function titleFromMessages(messages: Message[]) {
    const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim())
    if (!firstUserMessage) return 'New chat'

    const title = firstUserMessage.content.replace(/\s+/g, ' ').trim()
    return title.length > 48 ? `${title.slice(0, 45)}...` : title
}

function formatThreadTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''

    return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function Chat() {
    const searchParams = useSearchParams()
    const [selectedModel, setSelectedModel] = useState(process.env.NEXT_PUBLIC_DEFAULT_MODEL || AUTO_OPEN_MODEL_VALUE)
    const [accessCode, setAccessCode] = useState<string | null>(null)
    const [dynamicSuggestions, setDynamicSuggestions] = useState<any[]>([])
    const [models, setModels] = useState<VeniceModelOption[]>(fallbackModels)
    const [defaultModelId, setDefaultModelId] = useState<string | null>(null)
    const [openDefaultModelId, setOpenDefaultModelId] = useState<string | null>(null)
    const [modelsUpdatedAt, setModelsUpdatedAt] = useState<string | null>(null)
    const [isRefreshingModels, setIsRefreshingModels] = useState(false)
    const [modelError, setModelError] = useState<string | null>(null)
    const [historyKey, setHistoryKey] = useState<string | null>(null)
    const [threads, setThreads] = useState<SavedThread[]>([])
    const [activeThreadId, setActiveThreadId] = useState(() => createThreadId())
    const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(true)

    // @ts-ignore
    const { messages, setMessages, input, setInput, handleInputChange, handleSubmit, isLoading, error, reload } = useChat({
        body: {
            model: selectedModel
        },
        headers: {
            'Authorization': `Bearer ${accessCode}`
        },
        onResponse: (response) => {
            console.log('Received response:', response.status, response.statusText);
            if (response.status === 401) {
                // If unauthorized, clear code to re-trigger AuthWall
                setAccessCode(null)
                localStorage.removeItem('todoist-agent-auth')
            }
        },
        onFinish: (message) => {
            console.log('Chat finished:', message);
        },
        onError: (error) => {
            console.error('Chat error:', error);
        }
    })

    const messagesViewportRef = useRef<HTMLDivElement>(null)
    const isPinnedToBottomRef = useRef(true)

    // Check for auth code on mount
    useEffect(() => {
        const savedCode = localStorage.getItem('todoist-agent-auth')
        if (savedCode) {
            setAccessCode(savedCode)
        }

        const savedModel = localStorage.getItem(MODEL_PREFERENCE_KEY)
        if (savedModel) {
            setSelectedModel(savedModel)
        }
    }, [])

    useEffect(() => {
        localStorage.setItem(MODEL_PREFERENCE_KEY, selectedModel)
    }, [selectedModel])

    useEffect(() => {
        if (!accessCode) return

        const nextHistoryKey = getChatHistoryKey(accessCode)
        const nextThreads = parseThreads(localStorage.getItem(nextHistoryKey))
        const latestThread = nextThreads[0]

        setHistoryKey(nextHistoryKey)
        setThreads(nextThreads)
        setHasLoadedHistory(true)

        if (latestThread) {
            setActiveThreadId(latestThread.id)
            setSelectedModel(latestThread.model || process.env.NEXT_PUBLIC_DEFAULT_MODEL || AUTO_OPEN_MODEL_VALUE)
            setMessages(latestThread.messages)
        } else {
            setActiveThreadId(createThreadId())
            setMessages([])
        }
    }, [accessCode, setMessages])

    useEffect(() => {
        if (!historyKey || !hasLoadedHistory || messages.length === 0) return

        const now = new Date().toISOString()
        setThreads((previousThreads) => {
            const existingThread = previousThreads.find((thread) => thread.id === activeThreadId)
            const nextThread: SavedThread = {
                id: activeThreadId,
                title: titleFromMessages(messages),
                createdAt: existingThread?.createdAt || now,
                updatedAt: now,
                model: selectedModel,
                messages: messages.slice(-MESSAGE_LIMIT),
            }

            return [
                nextThread,
                ...previousThreads.filter((thread) => thread.id !== activeThreadId),
            ].slice(0, HISTORY_LIMIT)
        })
    }, [activeThreadId, hasLoadedHistory, historyKey, messages, selectedModel])

    useEffect(() => {
        if (!historyKey || !hasLoadedHistory) return

        localStorage.setItem(historyKey, JSON.stringify(threads))
    }, [hasLoadedHistory, historyKey, threads])

    const refreshModels = useCallback(async () => {
        if (!accessCode) return

        setIsRefreshingModels(true)
        setModelError(null)

        try {
            const response = await fetch('/api/venice-models', {
                headers: {
                    Authorization: `Bearer ${accessCode}`,
                },
            })

            if (response.status === 401) {
                setAccessCode(null)
                localStorage.removeItem('todoist-agent-auth')
                return
            }

            if (!response.ok) {
                throw new Error(`Unable to load Venice models (${response.status})`)
            }

            const data = await response.json()
            if (!Array.isArray(data.models) || data.models.length === 0) {
                throw new Error('Venice returned no text models')
            }

            setModels(data.models)
            setDefaultModelId(data.defaultModelId || null)
            setOpenDefaultModelId(data.openDefaultModelId || null)
            setModelsUpdatedAt(data.updatedAt || null)
        } catch (error) {
            console.error('Model refresh failed:', error)
            setModelError(error instanceof Error ? error.message : 'Unable to load Venice models')
        } finally {
            setIsRefreshingModels(false)
        }
    }, [accessCode])

    useEffect(() => {
        refreshModels()
        const refreshInterval = window.setInterval(refreshModels, 60 * 60 * 1000)

        return () => window.clearInterval(refreshInterval)
    }, [refreshModels])

    // Handle PWA shortcut actions from manifest
    useEffect(() => {
        const action = searchParams.get('action')
        if (!action || !accessCode) return

        const actionMap: Record<string, string> = {
            'plan-day': 'Plan my day',
            'add-task': 'Add a task',
        }

        const prompt = actionMap[action]
        if (prompt && messages.length === 0) {
            setInput(prompt)
        }
    }, [searchParams, accessCode, messages.length, setInput])

    const updatePinnedToBottom = useCallback(() => {
        const viewport = messagesViewportRef.current
        if (!viewport) return

        const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
        isPinnedToBottomRef.current = distanceFromBottom < 96
    }, [])

    const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        const viewport = messagesViewportRef.current
        if (!viewport) return

        viewport.scrollTo({
            top: viewport.scrollHeight,
            behavior,
        })
    }, [])

    const submitMessage = useCallback((event: React.FormEvent<HTMLFormElement>) => {
        isPinnedToBottomRef.current = true
        handleSubmit(event)
    }, [handleSubmit])

    // Auto-scroll to bottom while the user is following the latest message.
    useEffect(() => {
        if (!isPinnedToBottomRef.current) return

        const animationFrame = window.requestAnimationFrame(() => {
            scrollMessagesToBottom(isLoading ? 'auto' : 'smooth')
        })

        return () => window.cancelAnimationFrame(animationFrame)
    }, [messages, isLoading, scrollMessagesToBottom])


    // Effect to listen for suggestActions tool calls
    useEffect(() => {
        if (!messages.length) return

        const lastMessage = messages[messages.length - 1]
        if (lastMessage.role !== 'assistant') return

        // Check for suggestActions tool call
        // @ts-ignore
        const toolCalls = lastMessage.toolInvocations || []
        const suggestActionCall = toolCalls.find((t: any) => t.toolName === 'suggestActions' && t.state === 'result')

        if (suggestActionCall) {
            const actions = suggestActionCall.args.actions
            if (actions && Array.isArray(actions)) {
                setDynamicSuggestions(actions.map((a: any) => ({
                    label: a.label,
                    action: a.action,
                    icon: getIconForType(a.type)
                })))
            }
        }
    }, [messages])

    const getIconForType = (type: string) => {
        switch (type) {
            case 'calendar': return <Bot className="w-4 h-4" />
            case 'task': return <CheckCircle2 className="w-4 h-4" />
            case 'plan': return <Terminal className="w-4 h-4" />
            case 'search': return <Loader2 className="w-4 h-4" />
            default: return <Send className="w-4 h-4" />
        }
    }

    // If not authenticated, show AuthWall
    if (!accessCode) {
        return <AuthWall onAuthenticated={setAccessCode} />
    }

    const defaultSuggestions = [
        { label: "Plan my day", action: "Plan my day", icon: <CheckCircle2 className="w-4 h-4" /> },
        { label: "Add task", action: "Add a task to buy milk", icon: <Send className="w-4 h-4" /> },
        { label: "Check calendar", action: "What do I have today?", icon: <Bot className="w-4 h-4" /> },
        { label: "My tasks", action: "Show my main tasks for today", icon: <Terminal className="w-4 h-4" /> },
        { label: "Overdue", action: "Show overdue tasks", icon: <Loader2 className="w-4 h-4" /> },
    ]


    const currentSuggestions = dynamicSuggestions.length > 0 ? dynamicSuggestions : defaultSuggestions

    const startNewThread = () => {
        isPinnedToBottomRef.current = true
        setActiveThreadId(createThreadId())
        setMessages([])
        setInput('')
        setDynamicSuggestions([])
    }

    const loadThread = (thread: SavedThread) => {
        isPinnedToBottomRef.current = true
        setActiveThreadId(thread.id)
        setSelectedModel(thread.model || AUTO_OPEN_MODEL_VALUE)
        setMessages(reviveMessages(thread.messages))
        setInput('')
        setDynamicSuggestions([])
    }

    const deleteThread = (threadId: string) => {
        setThreads((previousThreads) => {
            const nextThreads = previousThreads.filter((thread) => thread.id !== threadId)

            if (threadId === activeThreadId) {
                const nextActiveThread = nextThreads[0]
                isPinnedToBottomRef.current = true
                if (nextActiveThread) {
                    setActiveThreadId(nextActiveThread.id)
                    setSelectedModel(nextActiveThread.model || AUTO_OPEN_MODEL_VALUE)
                    setMessages(reviveMessages(nextActiveThread.messages))
                } else {
                    setActiveThreadId(createThreadId())
                    setMessages([])
                }
            }

            return nextThreads
        })
    }

    const handleSuggestionClick = (action: string) => {
        setInput(action)
    }

    const selectedModelIsAvailable = selectedModel === AUTO_MODEL_VALUE || selectedModel === AUTO_OPEN_MODEL_VALUE || models.some((model) => model.id === selectedModel)
    const defaultModelName = models.find((model) => model.id === defaultModelId)?.name || defaultModelId
    const openDefaultModelName = models.find((model) => model.id === openDefaultModelId)?.name || openDefaultModelId
    const modelStatusText = modelError
        ? modelError
        : modelsUpdatedAt
            ? `Updated ${new Date(modelsUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Live Venice models'

    return (
        <Card className="flex flex-col h-full w-full border-0 rounded-none shadow-none bg-background">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => setIsHistoryOpen((open) => !open)}
                            aria-label="Toggle chat history"
                            title="Chat history"
                        >
                            <History className="w-4 h-4" />
                        </Button>
                        <div className="relative w-8 h-8">
                            <Image
                                src="/logo.svg"
                                alt="Todoist Agent Logo"
                                fill
                                className="object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                            />
                        </div>
                        <span className="font-bold text-lg tracking-tight">Todoist Agent</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-2 text-xs"
                            onClick={startNewThread}
                        >
                            <Plus className="w-4 h-4" />
                            New
                        </Button>
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger className="w-[220px] h-8 text-xs">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="max-w-[340px]">
                                <SelectItem value={AUTO_OPEN_MODEL_VALUE} className="text-xs">
                                    <div className="flex flex-col">
                                        <span>Auto: Best open model</span>
                                        {openDefaultModelName && (
                                            <span className="text-[10px] text-muted-foreground">
                                                Currently {openDefaultModelName}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                                <SelectItem value={AUTO_MODEL_VALUE} className="text-xs">
                                    <div className="flex flex-col">
                                        <span>Auto: Venice default</span>
                                        {defaultModelName && (
                                            <span className="text-[10px] text-muted-foreground">
                                                Currently {defaultModelName}
                                            </span>
                                        )}
                                    </div>
                                </SelectItem>
                                {!selectedModelIsAvailable && (
                                    <SelectItem value={selectedModel} className="text-xs">
                                        Saved model: {selectedModel}
                                    </SelectItem>
                                )}
                                {models.map((model) => (
                                    <SelectItem key={model.id} value={model.id} className="text-xs">
                                        <div className="flex flex-col">
                                            <span>
                                                {model.name}
                                                {model.isDefault ? ' · Venice default' : ''}
                                                {model.isOpenDefault && !model.isDefault ? ' · open default' : ''}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {[
                                                    model.isOpenSource ? 'open' : null,
                                                    model.supportsReasoning ? 'reasoning' : null,
                                                    model.supportsFunctionCalling ? 'tools' : null,
                                                    model.supportsVision ? 'vision' : null,
                                                    model.contextTokens ? `${model.contextTokens.toLocaleString()} ctx` : null,
                                                ].filter(Boolean).join(' · ') || model.id}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={refreshModels}
                            disabled={isRefreshingModels}
                            title={modelStatusText}
                            aria-label="Refresh Venice models"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshingModels ? 'animate-spin' : ''}`} />
                        </Button>
                        <ModeToggle />
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden p-0 relative">
                <div className="flex h-full min-h-0">
                    {isHistoryOpen && (
                        <aside className="absolute inset-y-0 left-0 z-20 flex w-72 shrink-0 flex-col border-r bg-background shadow-lg md:relative md:shadow-none md:bg-muted/20">
                            <div className="flex items-center justify-between border-b px-3 py-2">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <MessageSquare className="w-4 h-4" />
                                    History
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={startNewThread}
                                    aria-label="Start new chat"
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            <ScrollArea className="flex-1">
                                <div className="flex flex-col gap-1 p-2">
                                    {threads.length === 0 && (
                                        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                                            No saved chats yet.
                                        </div>
                                    )}
                                    {threads.map((thread) => (
                                        <div
                                            key={thread.id}
                                            className={`group flex items-start gap-1 rounded-md px-2 py-2 ${thread.id === activeThreadId ? 'bg-muted' : 'hover:bg-muted/60'}`}
                                        >
                                            <button
                                                type="button"
                                                className="min-w-0 flex-1 text-left"
                                                onClick={() => loadThread(thread)}
                                            >
                                                <div className="truncate text-xs font-medium text-foreground">
                                                    {thread.title}
                                                </div>
                                                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                                    {formatThreadTime(thread.updatedAt)}
                                                </div>
                                            </button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                                                onClick={() => deleteThread(thread.id)}
                                                aria-label={`Delete ${thread.title}`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </aside>
                    )}
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                        <div
                            ref={messagesViewportRef}
                            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
                            onScroll={updatePinnedToBottom}
                            aria-label="Chat messages"
                        >
                    <div className="flex flex-col gap-4 pb-4">
                        {messages.length === 0 && (
                            <div className="text-center text-muted-foreground mt-20 px-6">
                                <Avatar className="h-16 w-16 mx-auto mb-4 bg-primary/10">
                                    <AvatarFallback className="bg-transparent"><Bot className="w-8 h-8 text-primary" /></AvatarFallback>
                                </Avatar>
                                <h3 className="font-semibold text-lg mb-2">How can I help you today?</h3>
                                <p className="text-sm">I can manage your Todoist tasks and check your Google Calendar.</p>
                            </div>
                        )}
                        {messages.map((m: any) => (
                            <div
                                key={m.id}
                                className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback className={m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}>
                                        {m.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </AvatarFallback>
                                </Avatar>
                                <div className={`flex flex-col gap-2 w-full max-w-full ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    {/* Text Content */}
                                    {/* Text Content */}
                                    {m.content && (
                                        <div
                                            className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${m.role === 'user'
                                                ? 'bg-primary text-primary-foreground ml-auto max-w-[85%]'
                                                : 'bg-muted/50 text-foreground w-full max-w-full'
                                                }`}
                                        >
                                            {m.role === 'user' ? (
                                                <div className="whitespace-pre-wrap">{m.content}</div>
                                            ) : (
                                                <div className="prose prose-neutral dark:prose-invert max-w-none text-sm
                                                        prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent
                                                        prose-table:border-collapse prose-table:border prose-table:border-border
                                                        prose-th:border prose-th:border-border prose-th:bg-muted/50 prose-th:p-2
                                                        prose-td:border prose-td:border-border prose-td:p-2
                                                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            // Custom table styling
                                                            table: ({ node, ...props }) => (
                                                                <div className="my-4 w-full overflow-y-auto rounded-lg border border-border">
                                                                    <table className="w-full text-left" {...props} />
                                                                </div>
                                                            ),
                                                            thead: ({ node, ...props }) => (
                                                                <thead className="bg-muted/50 text-muted-foreground" {...props} />
                                                            ),
                                                            th: ({ node, ...props }) => (
                                                                <th className="px-4 py-2 font-medium" {...props} />
                                                            ),
                                                            td: ({ node, ...props }) => (
                                                                <td className="border-t border-border px-4 py-2" {...props} />
                                                            ),
                                                            // Custom link styling
                                                            a: ({ node, ...props }) => (
                                                                <a className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...props} />
                                                            ),
                                                            // Custom code block styling
                                                            code: ({ node, className, children, ...props }) => {
                                                                const match = /language-(\w+)/.exec(className || '')
                                                                // @ts-ignore
                                                                const isInline = !match && !String(children).includes('\n')

                                                                if (isInline) {
                                                                    return (
                                                                        <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold" {...props}>
                                                                            {children}
                                                                        </code>
                                                                    )
                                                                }

                                                                return (
                                                                    <div className="relative my-4 overflow-hidden rounded-lg border bg-zinc-950 dark:bg-zinc-900">
                                                                        <div className="flex items-center justify-between px-4 py-2 text-xs text-zinc-50 border-b border-zinc-700 bg-zinc-800/50">
                                                                            <span>{match?.[1] || 'text'}</span>
                                                                        </div>
                                                                        <div className="p-4 overflow-x-auto">
                                                                            <code className={`font-mono text-xs text-zinc-50 ${className}`} {...props}>
                                                                                {children}
                                                                            </code>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            },
                                                            ul: ({ node, ...props }) => (
                                                                <ul className="my-2 ml-6 list-disc [&>li]:mt-1" {...props} />
                                                            ),
                                                            ol: ({ node, ...props }) => (
                                                                <ol className="my-2 ml-6 list-decimal [&>li]:mt-1" {...props} />
                                                            ),
                                                            li: ({ node, ...props }) => (
                                                                <li className="" {...props} />
                                                            ),
                                                        }}
                                                    >
                                                        {m.content}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Tool Invocations */}
                                    {m.toolInvocations?.map((toolInvocation: any) => {
                                        const toolCallId = toolInvocation.toolCallId;
                                        const isComplete = toolInvocation.state === 'result';
                                        const isError = toolInvocation.state === 'result' && !toolInvocation.result; // Basic error check

                                        return (
                                            <div key={toolCallId} className="bg-muted/30 rounded-lg p-3 text-xs border border-border/50 w-full animate-in fade-in zoom-in-95 duration-200">
                                                <div className="flex items-center gap-2 font-medium text-muted-foreground">
                                                    {isComplete ? (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                                                    ) : (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                                    )}
                                                    <span>
                                                        {isComplete ? 'Completed:' : 'Processing:'} {toolInvocation.toolName}
                                                    </span>
                                                </div>

                                                {!isComplete && (
                                                    <div className="mt-2 text-muted-foreground bg-background/50 p-2 rounded border border-border/30 font-mono text-[10px] show-on-hover">
                                                        {JSON.stringify(toolInvocation.args)}
                                                    </div>
                                                )}

                                                {isComplete && (
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1">
                                                            <Terminal className="w-3 h-3" />
                                                            View Result
                                                        </summary>
                                                        <div className="mt-2 bg-background/50 p-2 rounded border border-border/30 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                            {JSON.stringify(toolInvocation.result, null, 2)}
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Loading Indicator */}
                        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                            <div className="flex gap-3">
                                <Avatar className="h-8 w-8 shrink-0">
                                    <AvatarFallback className="bg-muted"><Bot className="w-4 h-4" /></AvatarFallback>
                                </Avatar>
                                <div className="bg-muted rounded-lg p-3 text-sm flex items-center gap-2 w-fit">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span className="animate-pulse">Thinking...</span>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="flex gap-3 justify-center">
                                <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-full border border-destructive/20 flex items-center gap-2">
                                    <span className="font-semibold">Error:</span> {error.message}
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => reload()}>
                                        <Terminal className="w-3 h-3" />
                                        <span className="sr-only">Retry</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                        </div>
                        <CardFooter className="shrink-0 p-4 border-t bg-background/50 backdrop-blur-sm flex flex-col gap-3">
                            {/* Suggested Actions - Scrollable list above input */}
                            <div className="w-full overflow-x-auto pb-2 scrollbar-hide flex gap-2">
                                {currentSuggestions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSuggestionClick(action.action)}
                                        className="flex items-center gap-2 whitespace-nowrap bg-background border border-border/50 hover:bg-muted/50 transition-colors rounded-full px-3 py-1.5 text-xs text-muted-foreground shadow-sm hover:text-foreground"
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            <form onSubmit={submitMessage} className="flex w-full gap-2 items-end">
                                <Textarea
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder="Type a message..."
                                    className="flex-1 min-h-[44px]"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            e.currentTarget.form?.requestSubmit()
                                        }
                                    }}
                                />
                                <Button type="submit" size="icon" disabled={isLoading} className="h-11 w-11 shrink-0">
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </Button>
                            </form>
                        </CardFooter>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
