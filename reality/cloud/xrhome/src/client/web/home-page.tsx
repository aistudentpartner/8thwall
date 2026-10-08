import React from 'react'
import {useHistory} from 'react-router-dom'
import {useQuery, useQueryClient} from '@tanstack/react-query'
import {useTranslation} from 'react-i18next'
import {listProjects, initializeLocal, deleteProject, extractApiError} from '../studio/local-sync-api'
import {useLocaleChange} from '../user/use-locale'
import {getSupportedLocale8wOptions} from '../../shared/i18n/i18n-locales'
import {getLocalStudioPath} from '../desktop/desktop-paths'

const WebHomePage = () => {
  const {t} = useTranslation('browser-studio')
  const history = useHistory()
  const [locale, setLocale] = useLocaleChange()
  const queryClient = useQueryClient()
  const projects = useQuery({queryKey: ['listProjects'], queryFn: listProjects})
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [deleting, setDeleting] = React.useState<string | null>(null)
  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError('')
    try {
      const result = await initializeLocal(name.trim(), 'default', null)
      await queryClient.invalidateQueries({queryKey: ['listProjects']})
      history.push(getLocalStudioPath(result.appKey))
    } catch (err) { setError(await extractApiError(err)) } finally { setBusy(false) }
  }
  const remove = async (appKey: string) => {
    setBusy(true)
    setError('')
    try {
      await deleteProject(appKey)
      setDeleting(null)
      await queryClient.invalidateQueries({queryKey: ['listProjects']})
    } catch (err) { setError(await extractApiError(err)) } finally { setBusy(false) }
  }
  const entries = Object.entries(projects.data?.projectByAppKey || {})
    .sort(([, a], [, b]) => (b.accessedAt || 0) - (a.accessedAt || 0))
  return (
    <main className='web-home'>
      <label className='web-language'>{t('language')}
        <select value={locale} onChange={event => setLocale(event.target.value)}>
          {getSupportedLocale8wOptions().map(option => (
            <option key={option.value} value={option.value}>{option.content}</option>
          ))}
        </select>
      </label>
      <p className='web-eyebrow'>8TH WALL · STUDIO</p>
      <h1>{t('home.title')}</h1>
      <p className='web-intro'>{t('home.intro')}</p>
      <form className='web-create' onSubmit={create}>
        <label htmlFor='project-name'>{t('project.name')}</label>
        <div><input id='project-name' value={name} maxLength={80} required
          onChange={event => setName(event.target.value)} placeholder={t('project.placeholder')} />
          <button type='submit' disabled={busy || !name.trim()}>{t(busy ? 'working' : 'project.create')}</button></div>
      </form>
      {(error || projects.isError) && <p role='alert'>{error || t('project.load_error')}</p>}
      <h2>{t('project.list')}</h2>
      {projects.isLoading && <p role='status'>{t('loading')}</p>}
      {!projects.isLoading && !entries.length && <p className='web-empty'>{t('project.empty')}</p>}
      <div className='web-projects'>
        {entries.map(([id, project]) => (
          <article key={id} className='web-project'>
            <h3>{project.location}</h3><p>{t('project.template')}</p>
            {deleting === id ? <div>
              <p>{t('project.delete_warning')}</p>
              <button type='button' disabled={busy} onClick={() => remove(id)}>{t('project.confirm_delete')}</button>
              <button type='button' disabled={busy} onClick={() => setDeleting(null)}>{t('cancel')}</button>
            </div> : <div>
              <button type='button' onClick={() => history.push(getLocalStudioPath(id))}>{t('project.open')}</button>
              <button type='button' className='web-secondary' onClick={() => setDeleting(id)}>{t('project.delete')}</button>
            </div>}
          </article>
        ))}
      </div>
      <p className='web-note'>{t('home.limitations')}</p>
    </main>
  )
}
export {WebHomePage}
