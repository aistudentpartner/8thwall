import React from 'react'
import {useHistory} from 'react-router-dom'
import {useTranslation} from 'react-i18next'

import {FloatingTray} from '../ui/components/floating-tray'
import {FloatingIconButton} from '../ui/components/floating-icon-button'
import {useSceneContext} from './scene-context'
import {HOME_PATH} from '../desktop/desktop-paths'
import {FloatingTrayButton} from '../ui/components/floating-tray-button'
import {FileActionsContext} from '../editor/files/file-actions-context'
import {useMaybeLocalSyncContext} from './local-sync-context'

const FloatingNavigation: React.FC = () => {
  const {t} = useTranslation(['common', 'cloud-studio-pages'])
  const ctx = useSceneContext()
  const history = useHistory()
  const {onUploadStart} = React.useContext(FileActionsContext)
  const sync = useMaybeLocalSyncContext()
  return (
    <FloatingTray nonInteractive={ctx.isDraggingGizmo}>
      <FloatingIconButton
        a8='click;studio;navigation-menu-button'
        text={t('button.home', {ns: 'common'})}
        stroke='home'
        onClick={() => history.push(HOME_PATH)}
      />
      <FloatingTrayButton
        id='studio-import-model'
        color='purple'
        isDisabled={!!sync && sync.fileSyncStatus !== 'active'}
        onClick={() => onUploadStart('assets')}
      >
        <span style={{whiteSpace: 'nowrap'}}>
          {t('model_import.button', {ns: 'cloud-studio-pages'})}
        </span>
      </FloatingTrayButton>
    </FloatingTray>
  )
}

export {
  FloatingNavigation,
}
