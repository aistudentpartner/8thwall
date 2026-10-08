import type {BackendModule} from 'i18next'

const LazyImportPlugin: BackendModule = {
  type: 'backend',
  init: () => {},
  read: async (language, namespace, callback) => {
    try {
      const translations = await import(`./${language}/${namespace}.json`)
      callback(null, translations)
    } catch (error) {
      // Let i18next fall back when a namespace is not translated yet.
      callback(error, false)
    }
  },
}

export default LazyImportPlugin
