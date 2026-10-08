import {clientId} from './save-state'

import type {LocalSyncHandler} from '../../shared/desktop/electron-api'

const subscribeToProject = (appKey: string, handler: LocalSyncHandler) => {
  const stream = new EventSource(`/api/project/events?${new URLSearchParams({appKey, clientId})}`)
  stream.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data)
      if (message.appKey === appKey) handler(message)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Invalid project event', error)
    }
  }
  return () => stream.close()
}

export {subscribeToProject}
