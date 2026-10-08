import React from 'react'

const StartupReady = () => {
  React.useEffect(() => {window.dispatchEvent(new Event('studio-ready'))}, [])
  return null
}

const StartupError = ({error}: {error: Error}) => {
  // Also release the static loading panel when React displays a caught error.
  return <main style={{padding: 32, color: '#fff', background: '#171721'}}>
    <StartupReady />
    <h1>工作室載入失敗</h1>
    <pre style={{whiteSpace: 'pre-wrap'}}>{error.stack || error.message}</pre>
    <button type='button' onClick={() => window.location.reload()}>重新載入</button>
  </main>
}

export {StartupReady, StartupError}
