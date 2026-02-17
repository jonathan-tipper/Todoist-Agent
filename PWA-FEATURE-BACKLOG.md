# PWA Feature Backlog

Future enhancements to expand PWA capabilities beyond the core foundation.

## Phase 3: Enhanced PWA Features (Deferred)

These features leverage PWA capabilities to add value and discoverability. They are not critical for the app to function as a PWA but would enhance user experience.

### 3.1 Install Prompt UI

Add a custom install banner/button so users discover they can install the app.

**Implementation:**
- Create a new `src/components/install-prompt.tsx` component
- Listen for `beforeinstallprompt` event
- Display a non-intrusive banner (matching existing design) with Install/Dismiss buttons
- Handle user choice and clear the prompt

**Files to create/modify:**
- `src/components/install-prompt.tsx` — New component
- `src/app/layout.tsx` — Add `<InstallPrompt />` to root layout

**Value:** Users get one-tap access from home screen/dock/taskbar without going through the browser.

**Priority:** Medium — Improves discoverability but the browser also shows an install prompt automatically.

---

### 3.2 Push Notifications (Future Consideration)

PWA enables push notifications, which would be valuable for this app:

**Use cases:**
- Task reminders: "You have 3 overdue tasks"
- Daily planning prompt: "Good morning! Ready to plan your day?"
- Calendar conflict alerts: "Your 2pm meeting conflicts with a task deadline"

**Implementation requires:**
1. Backend push notification server (e.g., `web-push` library)
2. User opt-in UI for notification permissions
3. Backend endpoint to send notifications (Next.js API route)
4. Service worker `push` event handler

**Files to create/modify:**
- `src/app/api/notifications/subscribe.ts` — API route to subscribe to push
- `src/app/api/notifications/send.ts` — API route to send push notifications
- `src/components/notification-settings.tsx` — UI for permission opt-in
- Service worker config update in `next.config.ts` for push handler

**Value:** Highest-value PWA feature for a task management app. Drives engagement and timely user actions.

**Priority:** High (recommended for next phase) — Requires backend infrastructure but delivers significant value.

---

### 3.3 Background Sync (Future Consideration)

If offline task creation is added (Phase 4), the Background Sync API can queue actions taken offline and replay them when connectivity returns.

**How it works:**
- User creates/updates/closes tasks while offline
- Action is queued in IndexedDB with `pendingActions` table
- When connection returns, service worker's `sync` event fires
- Queued actions replay to Todoist API
- UI shows sync status and handles conflicts

**Implementation:**
```javascript
// In service worker
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(syncPendingTasks());
  }
});
```

**Files to create/modify:**
- Service worker configuration in `next.config.ts`
- `src/lib/offline-store.ts` — Dexie.js setup for pending actions table
- `src/lib/sync-handler.ts` — Logic to replay queued actions
- UI updates to show sync status

**Value:** Users can add tasks to Todoist even without connectivity. Tasks sync when back online.

**Priority:** Medium-High — Requires Phase 4 (offline storage) first. Increases reliability.

---

### 3.4 Share Target ✅ (COMPLETED)

~~Add to `manifest.json`:~~

~~```json~~
~~"share_target": {~~
  ~~"action": "/?shared=true",~~
  ~~"method": "GET",~~
  ~~"params": {~~
    ~~"title": "title",~~
    ~~"text": "text",~~
    ~~"url": "url"~~
  ~~}~~
~~}~~
~~```~~

~~**Value:** Users can share text/links from other apps directly into Todoist Agent's chat.~~

**Status:** Deferred — Can be implemented but lower priority than install prompt and push notifications.

---

### 3.5 Shortcuts (Quick Actions) ✅ (COMPLETED)

Already implemented in Phase 2 commit. Users can tap home screen shortcuts for:
- "Plan My Day" — Opens chat with `?action=plan-day` query param
- "Add Task" — Opens chat with `?action=add-task` query param

Handled in `src/components/chat.tsx` to auto-populate suggestions.

---

## Phase 4: Offline Task Management (Advanced, Future)

Full offline capability with local task caching and sync. Significant undertaking; should be pursued after Phases 1-3 are stable.

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

**Files to create:**
- `src/lib/offline-store.ts` — Dexie database schema
- `package.json` — Add `dexie` dependency

---

### 4.2 Offline Action Queue

When offline, queue task operations (add, update, close) to `pendingActions` and sync when back online.

**Related to:** 3.3 Background Sync (depends on this).

**Files to create/modify:**
- `src/lib/queue-manager.ts` — Queue operations and sync logic
- `src/app/api/tasks/sync.ts` — API endpoint to replay queued actions

---

### 4.3 Read-Only Offline Mode

Display cached tasks and calendar events when offline, with a clear "offline" indicator in the UI.

**Files to create/modify:**
- `src/components/offline-indicator.tsx` — Visual offline status badge
- `src/app/page.tsx` — Conditionally show cached data when offline
- `src/lib/offline-context.tsx` — Context to track online/offline state

---

## Implementation Priority

| Phase | Feature | Effort | Impact | Depends On |
|-------|---------|--------|--------|-----------|
| **3.1** | Install Prompt | Low | Medium | Phase 1+2 |
| **3.2** | Push Notifications | High | High | Backend setup |
| **3.3** | Background Sync | Medium | High | Phase 4.1 |
| **3.4** | Share Target | Low | Low | Phase 1+2 |
| **3.5** | Shortcuts | ✅ Done | Medium | Phase 1+2 |
| **4.1** | IndexedDB Cache | Medium | High | Dexie.js |
| **4.2** | Action Queue | Medium | High | Phase 4.1 |
| **4.3** | Offline Mode UI | Low | Medium | Phase 4.1 + 4.2 |

## Next Steps

1. **Short term (next iteration):** Implement 3.1 (Install Prompt) — quick win for discoverability
2. **Medium term:** Set up 3.2 (Push Notifications) backend infrastructure for engagement
3. **Long term:** Pursue Phase 4 (Offline Task Management) for full offline resilience

---

**Note:** This backlog is maintained separately from the core PWA plan to keep the implementation-complete phase 1+2 documented separately from future work.
