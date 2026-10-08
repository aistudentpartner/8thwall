import React from 'react'
import {HelmetProvider} from 'react-helmet-async'
import {Router, Route, Switch, Redirect, Prompt} from 'react-router-dom'
import type {History} from 'history'
import '../i18n/i18n'
import {WebHomePage} from './home-page'
import {useTranslation} from 'react-i18next'
import {useSaveStatus, retryFileWrites, hasUnsavedChanges} from './save-state'
import withTranslationLoaded from '../i18n/with-translations-loaded'
import {UiThemeProvider} from '../ui/theme'
import {Brand8QaContextProvider} from '../brand8/brand8-qa-context'
import {ErrorBoundary} from '../common/error-boundary'
import {CaughtErrorPage} from '../desktop/caught-error-page'
import {LOCAL_STUDIO_PATH_FORMAT} from '../desktop/desktop-paths'
const LocalStudioPage = React.lazy(() => import('../desktop/local-studio-page'))
const Notice = () => {
  const {t} = useTranslation('browser-studio')
  const status = useSaveStatus()
  React.useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  return <div className='web-notice'>
    <span>{t('editor.notice')}</span>
    <span role='status'>{t(`save.${status}`)}</span>
    {status === 'failed' && <button type='button' onClick={retryFileWrites}>{t('save.retry')}</button>}
    <Prompt when={status !== 'saved'} message={t('save.leave')} />
  </div>
}
const App = withTranslationLoaded(({history}: {history: History}) => (
  <HelmetProvider><Router history={history}>
    <UiThemeProvider mode='dark'><Brand8QaContextProvider>
      <ErrorBoundary fallback={CaughtErrorPage}>
        <React.Suspense fallback={<p>正在載入工作室…</p>}>
          <Switch>
            <Route path={LOCAL_STUDIO_PATH_FORMAT}><Notice /><LocalStudioPage /></Route>
            <Route path='/home' component={WebHomePage} />
            <Redirect to='/home' />
          </Switch>
        </React.Suspense>
      </ErrorBoundary>
    </Brand8QaContextProvider></UiThemeProvider>
  </Router></HelmetProvider>
))
export default App
