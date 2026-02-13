
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Lock } from 'lucide-react'

interface AuthWallProps {
    onAuthenticated: (code: string) => void
}

export function AuthWall({ onAuthenticated }: AuthWallProps) {
    const [code, setCode] = useState('')
    const [error, setError] = useState(false)

    // Check for existing session
    useEffect(() => {
        const savedCode = localStorage.getItem('todoist-agent-auth')
        if (savedCode) {
            onAuthenticated(savedCode)
        }
    }, [onAuthenticated])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (code.length > 0) {
            // In a real app we'd verify against a hash, but for personal alpha
            // we'll just optimistically set it or let the first API call fail.
            // However, to be "nice", let's just pass it up.
            localStorage.setItem('todoist-agent-auth', code)
            onAuthenticated(code)
        } else {
            setError(true)
        }
    }

    return (
        <Card className="w-[350px] mx-auto mt-20 shadow-xl">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Authentication Required
                </CardTitle>
                <CardDescription>Enter your access code to continue.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent>
                    <div className="grid w-full items-center gap-4">
                        <div className="flex flex-col space-y-1.5">
                            <Input
                                id="code"
                                type="password"
                                placeholder="Access Code"
                                value={code}
                                onChange={(e) => {
                                    setCode(e.target.value)
                                    setError(false)
                                }}
                                className={error ? "border-red-500" : ""}
                            />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button type="submit" className="w-full">Unlock</Button>
                </CardFooter>
            </form>
        </Card>
    )
}
