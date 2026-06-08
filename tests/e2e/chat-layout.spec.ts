import { expect, test, type Page } from '@playwright/test'

const accessCode = 'ui-test'

type SeedMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

type SeedThread = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  model: string
  messages: SeedMessage[]
}

async function mockModels(page: Page) {
  await page.route('**/api/venice-models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        defaultModelId: 'llama-3.3-70b',
        openDefaultModelId: 'llama-3.3-70b',
        updatedAt: '2026-06-08T16:00:00.000Z',
        models: [
          {
            id: 'llama-3.3-70b',
            name: 'Llama 3.3 70B',
            description: 'Test model',
            contextTokens: 131_072,
            modelSource: 'meta',
            isOpenSource: true,
            traits: [],
            isDefault: true,
            isOpenDefault: true,
            supportsFunctionCalling: true,
            supportsReasoning: false,
            supportsVision: false,
          },
        ],
      }),
    })
  })
}

async function seedSession(page: Page, threads: SeedThread[]) {
  await page.addInitScript(({ code, seededThreads }) => {
    function keyFor(value: string) {
      let hash = 0

      for (let i = 0; i < value.length; i += 1) {
        hash = Math.imul(31, hash) + value.charCodeAt(i) | 0
      }

      return `todoist-agent-chat-history:${Math.abs(hash).toString(36)}`
    }

    localStorage.clear()
    localStorage.setItem('todoist-agent-auth', code)
    localStorage.setItem('todoist-agent-model', 'llama-3.3-70b')
    localStorage.setItem(keyFor(code), JSON.stringify(seededThreads))
  }, { code: accessCode, seededThreads: threads })
}

function longThread(): SeedThread {
  const now = new Date('2026-06-08T16:00:00.000Z').toISOString()
  const messages: SeedMessage[] = []

  for (let i = 1; i <= 44; i += 1) {
    messages.push({
      id: `u-${i}`,
      role: 'user',
      content: `Mobile scroll reproduction message ${i}: please summarize a long planning thread with enough content to force overflow.`,
      createdAt: now,
    })
    messages.push({
      id: `a-${i}`,
      role: 'assistant',
      content: `Assistant response ${i}.\n\n- First action item for a busy day.\n- Second action item with more explanatory text that wraps over multiple lines on a narrow viewport.\n- Third action item so the conversation becomes tall enough to require reliable scrolling.`,
      createdAt: now,
    })
  }

  return {
    id: 'thread-long',
    title: 'Long mobile scroll reproduction',
    createdAt: now,
    updatedAt: now,
    model: 'llama-3.3-70b',
    messages,
  }
}

function wideThread(): SeedThread {
  const now = new Date('2026-06-08T16:00:00.000Z').toISOString()

  return {
    id: 'thread-wide',
    title: 'Wide markdown overflow reproduction',
    createdAt: now,
    updatedAt: now,
    model: 'llama-3.3-70b',
    messages: [
      {
        id: 'u-wide',
        role: 'user',
        content: 'Show me a wide planning table',
        createdAt: now,
      },
      {
        id: 'a-wide',
        role: 'assistant',
        createdAt: now,
        content: 'Here is a wide planning table:\n\n| Time | Task | Notes | Project | Labels | Priority | Duration | Dependencies | Risk | Follow-up |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n| 09:00 | Review extremely long overdue task title that should not break the viewport or hide the input | This cell deliberately contains a lot of text | Work | focus,review,planning | P1 | 90 min | Calendar availability and Todoist task IDs | High | Reschedule if conflict |\n\n```json\n{"aVeryLongPropertyNameThatShouldScrollHorizontally":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\n```',
      },
    ],
  }
}

async function loadChat(page: Page, threads: SeedThread[]) {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockModels(page)
  await seedSession(page, threads)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Toggle chat history' })).toBeVisible()
}

test('mobile starts with history closed and the composer is not covered', async ({ page }) => {
  await loadChat(page, [])

  await expect(page.locator('aside')).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Type a message...' })).toBeInViewport()

  const hitTarget = await page.getByRole('textbox', { name: 'Type a message...' }).evaluate((textarea) => {
    const rect = textarea.getBoundingClientRect()
    const element = document
      .elementsFromPoint(rect.left + 12, rect.top + rect.height / 2)
      .find((candidate) => candidate.tagName.toLowerCase() !== 'nextjs-portal')

    return element?.tagName.toLowerCase()
  })

  expect(hitTarget).toBe('textarea')
})

test('mobile header does not create horizontal overflow', async ({ page }) => {
  await loadChat(page, [])

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  const clippedControls = await page.locator('[data-slot="card-title"] button, [data-slot="card-title"] [role="combobox"]').evaluateAll((elements) => (
    elements
      .map((element) => {
        const rect = element.getBoundingClientRect()

        return {
          label: element.getAttribute('aria-label') || element.textContent?.trim() || element.getAttribute('role') || element.tagName,
          left: rect.left,
          right: rect.right,
          visible: rect.width > 0 && rect.height > 0,
        }
      })
      .filter((control) => control.visible && (control.left < 0 || control.right > window.innerWidth))
  ))

  expect(overflow).toBeLessThanOrEqual(0)
  expect(clippedControls).toEqual([])
})

test('long mobile conversations keep the composer visible and messages scroll internally', async ({ page }) => {
  await loadChat(page, [longThread()])

  const composerBox = await page.getByRole('textbox', { name: 'Type a message...' }).boundingBox()
  expect(composerBox).not.toBeNull()
  expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(844)

  const messageViewport = page.locator('[data-slot="scroll-area-viewport"]').last()
  const viewportMetrics = await messageViewport.evaluate((viewport) => ({
    clientHeight: viewport.clientHeight,
    scrollHeight: viewport.scrollHeight,
    scrollTop: viewport.scrollTop,
  }))

  expect(viewportMetrics.clientHeight).toBeLessThan(844)
  expect(viewportMetrics.scrollHeight).toBeGreaterThan(viewportMetrics.clientHeight + 200)

  await messageViewport.hover()
  await page.mouse.wheel(0, -600)

  const afterWheel = await messageViewport.evaluate((viewport) => viewport.scrollTop)
  expect(afterWheel).toBeLessThan(viewportMetrics.scrollTop)
})

test('wide markdown scrolls inside the message without page-level overflow', async ({ page }) => {
  await loadChat(page, [wideThread()])

  const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(pageOverflow).toBeLessThanOrEqual(0)

  const tableMetrics = await page.locator('table').evaluate((table) => {
    const wrapper = table.parentElement

    return {
      wrapperOverflowX: wrapper ? getComputedStyle(wrapper).overflowX : '',
      wrapperClientWidth: wrapper?.clientWidth ?? 0,
      tableScrollWidth: table.scrollWidth,
    }
  })

  expect(tableMetrics.wrapperOverflowX).toMatch(/auto|scroll/)
  expect(tableMetrics.tableScrollWidth).toBeGreaterThan(tableMetrics.wrapperClientWidth)
})
