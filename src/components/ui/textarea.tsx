import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  onChange,
  ...props
}: React.ComponentProps<"textarea">) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [])

  React.useEffect(() => {
    adjustHeight()
  }, [props.value, adjustHeight])

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      data-slot="textarea"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none resize-none max-h-[200px] overflow-y-auto disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      onChange={(e) => {
        onChange?.(e)
        adjustHeight()
      }}
      {...props}
    />
  )
}

export { Textarea }
