
'use client'

import { useChat } from '@ai-sdk/react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Bot, User, Loader2, CheckCircle2, Terminal } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AuthWall } from './auth-wall'
import { ModeToggle } from './mode-toggle'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Chat() {
    const searchParams = useSearchParams()
    const [selectedModel, setSelectedModel] = useState(process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'llama-3.3-70b')
    const [accessCode, setAccessCode] = useState<string | null>(null)
    const [dynamicSuggestions, setDynamicSuggestions] = useState<any[]>([])

    // @ts-ignore
    const { messages, input, setInput, handleInputChange, handleSubmit, isLoading, error, reload } = useChat({
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

    const scrollRef = useRef<HTMLDivElement>(null)

    // Check for auth code on mount
    useEffect(() => {
        const savedCode = localStorage.getItem('todoist-agent-auth')
        if (savedCode) {
            setAccessCode(savedCode)
        }
    }, [])

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

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [messages, isLoading])


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

    const handleSuggestionClick = (action: string) => {
        setInput(action)
    }

    const models = [
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
        { id: 'deepseek-v3.2', name: 'DeepSeek V3.2' },
        { id: 'openai-gpt-52', name: 'GPT 5.2 (Venice)' },
        { id: 'venice-uncensored', name: 'Venice Uncensored' },
        { id: 'claude-sonnet-45', name: 'Claude Sonnet 4.5' },
        { id: 'claude-opus-45', name: 'Claude Opus 4.5' },
        { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
        { id: 'grok-41-fast', name: 'Grok 4.1 Fast' },
        { id: 'hermes-3-llama-3.1-405b', name: 'Hermes 3 (Llama 3.1 405B)' },
        { id: 'mistral-31-24b', name: 'Mistral 3.1 24B' },
        { id: 'qwen3-235b-a22b-instruct-2507', name: 'Qwen 3 235B Instruct' },
        { id: 'zai-org-glm-4.7', name: 'GLM 4.7' },
        // Others
        { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'google-gemma-3-27b-it', name: 'Gemma 3 27B' },
        { id: 'grok-code-fast-1', name: 'Grok Code Fast 1' },
        { id: 'kimi-k2-5', name: 'Kimi K2.5' },
        { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking' },
        { id: 'llama-3.2-3b', name: 'Llama 3.2 3B' },
        { id: 'minimax-m21', name: 'Minimax M2.1' },
        { id: 'minimax-m25', name: 'Minimax M2.5' },
        { id: 'openai-gpt-52-codex', name: 'GPT 5.2 Codex' },
        { id: 'openai-gpt-oss-120b', name: 'GPT OSS 120B' },
        { id: 'qwen3-235b-a22b-thinking-2507', name: 'Qwen 3 235B Thinking' },
        { id: 'qwen3-4b', name: 'Qwen 3 4B' },
        { id: 'qwen3-coder-480b-a35b-instruct', name: 'Qwen 3 Coder 480B' },
        { id: 'qwen3-next-80b', name: 'Qwen 3 Next 80B' },
        { id: 'qwen3-vl-235b-a22b', name: 'Qwen 3 VL 235B' },
        { id: 'zai-org-glm-4.7-flash', name: 'GLM 4.7 Flash' },
        { id: 'zai-org-glm-5', name: 'GLM 5' },
    ]

    return (
        <Card className="flex flex-col h-full w-full border-0 rounded-none shadow-none bg-background">
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
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
                        <Select value={selectedModel} onValueChange={setSelectedModel}>
                            <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                                {models.map((model) => (
                                    <SelectItem key={model.id} value={model.id} className="text-xs">
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <ModeToggle />
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0 relative">
                <ScrollArea className="h-full p-4">
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
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>


            </CardContent>
            <CardFooter className="p-4 border-t bg-background/50 backdrop-blur-sm flex flex-col gap-3">
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

                <form onSubmit={handleSubmit} className="flex w-full gap-2 items-end">
                    <Textarea
                        value={input}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        className="flex-1 min-h-[44px]"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
                            }
                        }}
                    />
                    <Button type="submit" size="icon" disabled={isLoading} className="h-11 w-11 shrink-0">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                </form>
            </CardFooter>
        </Card>
    )
}
