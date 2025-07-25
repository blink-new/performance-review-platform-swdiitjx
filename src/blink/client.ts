import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: 'performance-review-platform-swdiitjx',
  authRequired: false
})

export default blink