
import { Chat } from '@/components/chat'

export default function Home() {
  return (
    <main className="flex h-screen w-full flex-col bg-background overflow-hidden">
      <div className="flex-none z-10 w-full items-center justify-between border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="flex items-center gap-2 font-mono text-sm max-w-7xl mx-auto px-4 w-full">
          <span className="font-semibold">Todoist Agent</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Alpha</span>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative w-full">
        <Chat />
      </div>
    </main>
  )
}
