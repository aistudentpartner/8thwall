import {assert} from 'chai'
import {
  enqueueFileWrite, markSceneDirty, hasUnsavedChanges, retryFileWrites,
} from '../src/client/web/save-state'

const tick = () => new Promise<void>(resolve => setImmediate(resolve))

describe('browser durable write queue', () => {
  it('keeps the leave-page guard active during scene debounce', () => {
    markSceneDirty('test', true)
    assert.isTrue(hasUnsavedChanges())
    markSceneDirty('test', false)
    assert.isFalse(hasUnsavedChanges())
  })

  it('serializes rapid writes so an old response cannot overwrite a newer scene', async () => {
    const order: number[] = []
    let finish: () => void
    const first = enqueueFileWrite('test/scene', async () => {
      await new Promise<void>(resolve => { finish = resolve })
      order.push(1)
    })
    const second = enqueueFileWrite('test/scene', async () => { order.push(2) })
    await tick()
    assert.isTrue(hasUnsavedChanges())
    assert.deepEqual(order, [])
    finish()
    await Promise.all([first, second])
    await tick()
    assert.deepEqual(order, [1, 2])
    assert.isFalse(hasUnsavedChanges())
  })

  it('retains a failed write and retries the exact content', async () => {
    let attempts = 0
    let saved = ''
    await enqueueFileWrite('test/retry', async () => {
      if (++attempts === 1) throw new Error('offline')
      saved = '繁體中文場景'
    }).catch(() => {})
    await tick()
    assert.isTrue(hasUnsavedChanges())
    retryFileWrites()
    await tick()
    assert.equal(attempts, 2)
    assert.equal(saved, '繁體中文場景')
    assert.isFalse(hasUnsavedChanges())
  })

  it('supersedes a failed old write when the latest scene is saved', async () => {
    await enqueueFileWrite('test/newer', async () => { throw new Error('offline') }).catch(() => {})
    await enqueueFileWrite('test/newer', async () => 'latest scene')
    await tick()
    assert.isFalse(hasUnsavedChanges())
  })
})
