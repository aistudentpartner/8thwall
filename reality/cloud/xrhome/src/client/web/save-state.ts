import React from 'react'

const clientId = typeof crypto !== 'undefined' ? crypto.randomUUID() : ''
let queue = Promise.resolve()
let pending = 0
const dirtyScenes = new Set<string>()
const failedWrites = new Map<string, () => Promise<unknown>>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
const status = () => (failedWrites.size ? 'failed' : pending || dirtyScenes.size ? 'saving' : 'saved')
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
const markSceneDirty = (appKey: string, dirty: boolean) => {
  if (dirty) dirtyScenes.add(appKey)
  else dirtyScenes.delete(appKey)
  notify()
}
const enqueueFileWrite = <T,>(key: string, write: () => Promise<T>): Promise<T> => {
  pending++
  notify()
  const work = queue.then(write)
  queue = work.then(() => {
    failedWrites.delete(key)
  }, () => {
    failedWrites.set(key, write)
  }).finally(() => { pending--; notify() })
  return work
}
const retryFileWrites = () => {
  for (const [key, write] of failedWrites) enqueueFileWrite(key, write).catch(() => {})
}
const useSaveStatus = () => React.useSyncExternalStore(subscribe, status)
const hasUnsavedChanges = () => status() !== 'saved'

export {clientId, enqueueFileWrite, markSceneDirty, useSaveStatus, retryFileWrites, hasUnsavedChanges}
