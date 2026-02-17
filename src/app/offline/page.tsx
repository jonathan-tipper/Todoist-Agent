"use client";

import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="text-center px-6 max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-3">You&apos;re offline</h1>
        <p className="text-muted-foreground mb-6">
          Todoist Agent requires an internet connection to chat with your AI
          assistant and manage your tasks.
        </p>
        <Button onClick={() => window.location.reload()} size="lg">
          Try again
        </Button>
      </div>
    </div>
  );
}
