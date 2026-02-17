# PWA Conversion Plan: Todoist Agent

## Current State Assessment

**PWA readiness: None.** The application has zero PWA features implemented today:
- No web app manifest
- No service worker
- No caching strategies
- No PWA meta tags
- No installability
- No offline support
- Default "Create Next App" metadata still in place

The application is a **Next.js 16.1.6 App Router** single-page AI chat interface that manages Todoist tasks and Google Calendar events through a conversational UI. It uses React 19, Shadcn/UI, TailwindCSS 4, and the Vercel AI SDK for streaming chat.

---

## Phase 1: Core PWA Foundation (Installable App)

These changes make the app installable on any device without altering any existing functionality or design.

### 1.1 Web App Manifest

Create `/public/manifest.json`:

```json
{
  "name": "Todoist Agent - AI Life Planner",
  "short_name": "Todoist Agent",
  "description": "AI-powered proactive life planner for Todoist and Google Calendar",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#0a0a0a",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    }
  ]
}
```

**Notes:**
- `background_color` and `theme_color` match the dark theme (`oklch(0.145 0 0)` ≈ `#0a0a0a`) since `defaultTheme` is `"dark"`
- `display: "standalone"` removes browser chrome for a native feel
- `"orientation": "any"` since the chat UI works in both portrait and landscape

### 1.2 App Icons

Generate PNG icons from the existing `logo.svg` (currently 10MB — needs optimization regardless):

```
/public/icons/
├── icon-192x192.png        (standard icon)
├── icon-512x512.png        (standard icon)
├── icon-maskable-192x192.png  (maskable for Android adaptive icons)
├── icon-maskable-512x512.png  (maskable for Android adaptive icons)
└── apple-touch-icon.png    (180x180, for iOS)
```

**Approach:** Use a tool like `sharp` or an online generator (e.g., realfavicongenerator.net) to produce all sizes from the existing SVG. The maskable variants need safe-zone padding (the icon content within the inner 80% circle).

### 1.3 Update Layout Metadata

Update `src/app/layout.tsx` to include proper metadata and manifest link:

```typescript
export const metadata: Metadata = {
  title: "Todoist Agent",
  description: "AI-powered proactive life planner for Todoist and Google Calendar",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Todoist Agent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};
```

**Impact on existing app:** None. This only adds metadata to `<head>`. No visual or functional changes.

### 1.4 Service Worker (Basic)

Install `next-pwa` (or the maintained fork `@ducanh2912/next-pwa`) to handle service worker generation automatically with Next.js:

```bash
npm install @ducanh2912/next-pwa
```

Update `next.config.ts`:

```typescript
import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  /* existing config options */
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
```

**What this does:**
- Auto-generates a service worker at build time
- Precaches the app shell (HTML, CSS, JS bundles)
- Enables the install prompt on supported browsers
- Disabled in development to avoid caching issues

**Impact on existing app:** None visible. The app works identically but is now installable and loads the shell from cache on repeat visits.

### 1.5 Add Apple Touch Icon Link

Add to the `<head>` section in layout (Next.js handles this via the metadata API, but an explicit link is safest for older iOS):

```html
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

This can be done via the `icons` field in the Next.js `Metadata` object:

```typescript
icons: {
  apple: "/icons/apple-touch-icon.png",
},
```

---

## Phase 2: Caching Strategy (Performance)

These changes improve load performance and provide basic offline resilience without changing any functionality.

### 2.1 Runtime Caching Rules

Configure `next-pwa` with Workbox runtime caching for different resource types:

```typescript
runtimeCaching: [
  {
    // Cache page navigations (HTML)
    urlPattern: /^https?:\/\/.*\/$/,
    handler: "NetworkFirst",
    options: {
      cacheName: "pages",
      expiration: { maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 },
    },
  },
  {
    // Cache static assets (JS, CSS, fonts)
    urlPattern: /\/_next\/static\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "static-assets",
      expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    // Cache images
    urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
    handler: "CacheFirst",
    options: {
      cacheName: "images",
      expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
    },
  },
  {
    // Cache Google Fonts
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: "google-fonts",
      expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
    },
  },
  {
    // API calls - network first with fallback
    urlPattern: /\/api\/.*/i,
    handler: "NetworkFirst",
    options: {
      cacheName: "api-cache",
      expiration: { maxEntries: 16, maxAgeSeconds: 5 * 60 },
      networkTimeoutSeconds: 10,
    },
  },
],
```

**Strategy rationale:**
- **Static assets** (`CacheFirst`): Hashed filenames from Next.js build, safe to cache aggressively
- **Pages** (`NetworkFirst`): Always try to get fresh HTML, fall back to cache
- **API** (`NetworkFirst`): Chat responses need to be live, but cached responses provide graceful degradation
- **Fonts/Images** (`CacheFirst`): Rarely change, safe to cache long-term

### 2.2 Offline Fallback Page

Create a simple offline fallback page at `/public/offline.html` or as a Next.js page at `/src/app/offline/page.tsx`:

```tsx
// src/app/offline/page.tsx
export default function OfflinePage() {
  return (
    <div className="flex items-center justify-center h-screen bg-background text-foreground">
      <div className="text-center px-6">
        <h1 className="text-2xl font-bold mb-4">You're offline</h1>
        <p className="text-muted-foreground mb-6">
          Todoist Agent requires an internet connection for AI chat and task management.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
```

Configure `next-pwa` to serve this as the fallback:

```typescript
fallbacks: {
  document: "/offline",
},
```

**Impact:** Users who lose connectivity see a styled fallback page instead of the browser's default offline error.

---

## Phase 3: Enhanced PWA Features (New Value)

These are optional features that **leverage PWA capabilities** to add value beyond what a regular web app provides. None of these alter existing functionality.

### 3.1 Install Prompt UI

Add a custom install banner/button so users discover they can install the app:

```tsx
// src/components/install-prompt.tsx
'use client'
import { useState, useEffect } from 'react'

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="..."> {/* Non-intrusive banner matching existing design */}
      <p>Install Todoist Agent for quick access</p>
      <button onClick={handleInstall}>Install</button>
      <button onClick={() => setShowPrompt(false)}>Dismiss</button>
    </div>
  )
}
```

**Value:** Users get one-tap access from their home screen/dock/taskbar without going through the browser.

### 3.2 Push Notifications (Future Consideration)

PWA enables push notifications, which would be valuable for this app:

- **Task reminders:** "You have 3 overdue tasks"
- **Daily planning prompt:** "Good morning! Ready to plan your day?"
- **Calendar conflict alerts:** "Your 2pm meeting conflicts with a task deadline"

**Implementation requires:**
1. A push notification server (e.g., web-push library on the backend)
2. User opt-in UI for notification permissions
3. A backend endpoint to send notifications (could be a Next.js API route)
4. Service worker `push` event handler

**This is the highest-value PWA feature for a task management app** but requires backend infrastructure beyond the current scope. Recommended as a future phase.

### 3.3 Background Sync (Future Consideration)

If offline task creation is ever added (Phase 4 below), the Background Sync API can queue actions taken offline and replay them when connectivity returns:

```javascript
// In service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncPendingTasks());
  }
});
```

**Value:** Users could add tasks to Todoist even without connectivity. The tasks sync when they come back online.

### 3.4 Shortcuts (Quick Actions from Home Screen)

Add to `manifest.json`:

```json
"shortcuts": [
  {
    "name": "Plan My Day",
    "short_name": "Plan Day",
    "description": "Start a planning session with your AI assistant",
    "url": "/?action=plan-day",
    "icons": [{ "src": "/icons/shortcut-plan.png", "sizes": "96x96" }]
  },
  {
    "name": "Add Task",
    "short_name": "Add Task",
    "description": "Quickly add a new task",
    "url": "/?action=add-task",
    "icons": [{ "src": "/icons/shortcut-task.png", "sizes": "96x96" }]
  }
]
```

Then handle the `action` query parameter in the chat component to auto-populate the input or trigger a suggestion.

**Value:** Long-press on the app icon shows quick actions — directly maps to the existing `defaultSuggestions` in the chat UI.

### 3.5 Share Target

Add to `manifest.json`:

```json
"share_target": {
  "action": "/?shared=true",
  "method": "GET",
  "params": {
    "title": "title",
    "text": "text",
    "url": "url"
  }
}
```

**Value:** Users can share text/links from other apps directly into Todoist Agent's chat, e.g., share an article URL and say "Create a task to read this later."

---

## Phase 4: Offline Task Management (Advanced, Future)

This phase adds actual offline functionality. It's more complex and should only be pursued after Phases 1-3 are stable.

### 4.1 IndexedDB Task Cache

Use Dexie.js or idb to cache task and project data locally:

```typescript
// src/lib/offline-store.ts
import Dexie from 'dexie'

const db = new Dexie('todoist-agent-cache')
db.version(1).stores({
  tasks: 'id, projectId, due, priority',
  projects: 'id, name',
  pendingActions: '++id, type, timestamp',
})
```

### 4.2 Offline Action Queue

When offline, queue task operations (add, update, close) to `pendingActions` and sync when back online.

### 4.3 Read-Only Offline Mode

Display cached tasks and calendar events when offline, with a clear "offline" indicator in the UI.

---

## Implementation Summary & Priority Order

| Phase | What | Effort | Impact | Changes Existing Code? |
|-------|------|--------|--------|----------------------|
| **1.1** | Web App Manifest | Low | High (installable) | No |
| **1.2** | App Icons | Low | High (required for install) | No |
| **1.3** | Layout Metadata | Low | Medium (SEO, mobile) | Metadata only |
| **1.4** | Service Worker (next-pwa) | Low | High (caching, installable) | `next.config.ts` only |
| **1.5** | Apple Touch Icon | Low | Low (iOS polish) | Metadata only |
| **2.1** | Runtime Caching | Low | Medium (performance) | Config only |
| **2.2** | Offline Fallback | Low | Medium (UX) | New page, no changes |
| **3.1** | Install Prompt | Low | Medium (discoverability) | New component, optional |
| **3.4** | Shortcuts | Low | Medium (convenience) | Manifest + query params |
| **3.5** | Share Target | Low | Medium (integration) | Manifest + query params |
| **3.2** | Push Notifications | High | High (engagement) | Backend + frontend |
| **3.3** | Background Sync | High | High (reliability) | Service worker + storage |
| **4.x** | Offline Task Mgmt | High | High (resilience) | Storage layer + UI changes |

---

## Files Modified (Phase 1 + 2 — Core PWA)

| File | Change |
|------|--------|
| `public/manifest.json` | **New** — Web app manifest |
| `public/icons/*` | **New** — Generated icon set |
| `src/app/layout.tsx` | **Modified** — Metadata + viewport exports |
| `next.config.ts` | **Modified** — Wrap with `withPWA` |
| `package.json` | **Modified** — Add `@ducanh2912/next-pwa` dependency |
| `src/app/offline/page.tsx` | **New** — Offline fallback page |
| `.gitignore` | **Modified** — Add generated SW files (`sw.js`, `workbox-*.js`, `sw.js.map`) |

**No existing components, styles, or functionality are modified.** The chat UI, auth flow, API routes, theme system, and all Shadcn components remain untouched.

---

## Key Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Service worker caches stale API responses | Use `NetworkFirst` for `/api/*` with short TTL |
| Cached auth token causes stale sessions | Auth is in `localStorage`, not SW cache — unaffected |
| SW interferes with SSE streaming | Streaming responses bypass SW cache by default (POST requests aren't cached by Workbox) |
| `next-pwa` compatibility with Next.js 16 | Verify `@ducanh2912/next-pwa` supports Next.js 16; fall back to manual SW if needed |
| 10MB `logo.svg` causes slow precaching | Optimize/replace before PWA — exclude from precache via `publicExcludes` config |
| Theme color mismatch (dark/light) | Use `themeColor` array in viewport metadata for media query support |

---

## Lighthouse PWA Checklist (Phase 1+2 completion)

After implementing Phases 1 and 2, the app should pass all Lighthouse PWA audits:

- [x] Has a `<meta name="viewport">` tag with `width` or `initial-scale`
- [x] Has a valid web app manifest with required fields
- [x] Registers a service worker that controls page and `start_url`
- [x] Configured for a custom splash screen (manifest `icons` + `background_color` + `theme_color` + `name`)
- [x] Sets a theme color for the address bar
- [x] Content is sized correctly for the viewport
- [x] Provides a valid `apple-touch-icon`
- [x] Responds with a 200 when offline (offline fallback page)
- [x] Maskable icon provided
