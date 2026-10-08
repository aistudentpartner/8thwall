import {LOCALE_URL_PARAM_NAME, LOCALE_COOKIE_NAME} from '../../shared/i18n/i18n-constants'
import {
  FALLBACK_LOCALE,
  getSupportedLocales8w,
  validLocaleOrNull,
} from '../../shared/i18n/i18n-locales'

const getLocaleFromUrlParams = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return validLocaleOrNull(urlParams.get(LOCALE_URL_PARAM_NAME))
}

const getLocaleFromLocalStorage = () => {
  try {
    return validLocaleOrNull(localStorage.getItem(LOCALE_COOKIE_NAME))
  } catch (e) {
    return null
  }
}

const getLocaleFromPreferredLang = () => {
  const preferredLanguages = window.navigator.languages

  // Find the first prefix match if it's a locale code without country, e.g. "ja"
  if (preferredLanguages) {
    for (let i = 0; i < preferredLanguages.length; i++) {
      const preferredLanguage = preferredLanguages[i].toLowerCase()
      // Traditional Chinese browsers may report a script or region rather than zh-TW.
      // Do not treat explicitly Simplified Chinese (zh-Hans / zh-CN) as a match.
      if (/^zh-(hant(?:-|$)|(?:tw|hk|mo)(?:-|$))/.test(preferredLanguage)) {
        return 'zh-TW'
      }
      const foundSupportedLocale = getSupportedLocales8w().find(
        supportedLocale => supportedLocale.toLowerCase().startsWith(preferredLanguage)
      )
      if (foundSupportedLocale) {
        return foundSupportedLocale
      }
    }
  }

  return null
}

const chooseDefaultLanguage = () => {
  if (typeof window === 'undefined') {
    return FALLBACK_LOCALE
  }

  return getLocaleFromUrlParams() ||
    getLocaleFromLocalStorage() ||
    getLocaleFromPreferredLang() ||
    FALLBACK_LOCALE
}

export {
  chooseDefaultLanguage,
}
