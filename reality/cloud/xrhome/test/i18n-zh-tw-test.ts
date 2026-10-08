import {assert} from 'chai'
import fs from 'fs'
import path from 'path'
import i18next from 'i18next'

import {chooseDefaultLanguage} from '../src/client/i18n/choose-default-language'
import {getSupportedLocale8wOptions} from '../src/shared/i18n/i18n-locales'
import {setBuildIfMock, resetAllFlags} from './buildif-mock'

const localeRoot = path.join(__dirname, '../src/client/i18n')
const namespaces = fs.readdirSync(path.join(localeRoot, 'en-US'))
  .filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''))
const readLocale = (locale: string, namespace: string): Record<string, string> => JSON.parse(
  fs.readFileSync(path.join(localeRoot, locale, `${namespace}.json`), 'utf8')
)
const completeNamespaces = [
  'common', 'cloud-studio-pages', 'studio-desktop-pages', 'caught-error-page', 'browser-studio',
]

describe('Traditional Chinese locale', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const mockBrowser = (languages: string[], search = '', saved: string | null = null) => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {location: {search}, navigator: {languages}},
    })
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {getItem: () => saved},
    })
  }

  beforeEach(() => {
    setBuildIfMock()
    resetAllFlags()
  })

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
    if (originalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalStorage)
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage')
    }
  })

  it('offers Traditional Chinese in production settings', () => {
    assert.deepInclude(getSupportedLocale8wOptions(), {
      value: 'zh-TW', content: '繁體中文（臺灣）',
    })
  })

  it('recognizes Taiwan, Hong Kong, Macao and Traditional script browser languages', () => {
    ['zh-TW', 'zh-tw', 'zh-Hant', 'zh-Hant-TW', 'zh-Hant-HK', 'zh-HK', 'zh-MO']
      .forEach((locale) => {
        mockBrowser([locale])
        assert.equal(chooseDefaultLanguage(), 'zh-TW', locale)
      })
  })

  it('does not reinterpret an explicitly Simplified Chinese locale as Traditional', () => {
    mockBrowser(['zh-Hans-CN', 'zh-CN', 'ja-JP'])
    assert.equal(chooseDefaultLanguage(), 'ja-JP')
  })

  it('respects the order of browser language preferences', () => {
    mockBrowser(['ja-JP', 'zh-Hant'])
    assert.equal(chooseDefaultLanguage(), 'ja-JP')
  })

  it('gives the URL priority over saved settings and the browser', () => {
    mockBrowser(['ja-JP'], '?lang=zh-TW', 'en-US')
    assert.equal(chooseDefaultLanguage(), 'zh-TW')
  })

  it('honors an explicit saved language', () => {
    mockBrowser(['zh-TW'], '', 'en-US')
    assert.equal(chooseDefaultLanguage(), 'en-US')
  })

  it('ignores invalid URL values without breaking a saved choice', () => {
    mockBrowser(['en-US'], '?lang=../../missing', 'zh-TW')
    assert.equal(chooseDefaultLanguage(), 'zh-TW')
  })

  it('works when localStorage is blocked', () => {
    mockBrowser(['zh-Hant'])
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => { throw new Error('Storage blocked') },
    })
    assert.equal(chooseDefaultLanguage(), 'zh-TW')
  })

  it('retains the English fallback without a browser', () => {
    Reflect.deleteProperty(globalThis, 'window')
    assert.equal(chooseDefaultLanguage(), 'en-US')
  })

  it('has loadable resources for every namespace and preserves placeholders and markup', () => {
    const patterns = [/\{\{.*?\}\}/g, /<\/?[^>]+>/g]
    namespaces.forEach((namespace) => {
      const source = readLocale('en-US', namespace)
      const translated = readLocale('zh-TW', namespace)
      if (completeNamespaces.includes(namespace)) {
        assert.sameMembers(Object.keys(translated), Object.keys(source), namespace)
      }
      Object.entries(translated).forEach(([key, value]) => {
        const label = `${namespace}:${key}`
        assert.property(source, key, label)
        assert.isString(value, label)
        assert.isNotEmpty(value.trim(), label)
        patterns.forEach((pattern) => {
          assert.deepEqual(
            (value.match(pattern) || []).sort(),
            (source[key].match(pattern) || []).sort(),
            label
          )
        })
      })
    })
  })

  it('renders Chinese plurals, interpolation, switching and English fallback', async () => {
    const resources = Object.fromEntries(['en-US', 'zh-TW'].map(locale => [
      locale, Object.fromEntries(namespaces.map(namespace => [
        namespace, readLocale(locale, namespace),
      ])),
    ]))
    const instance = i18next.createInstance()
    await instance.init({
      lng: 'zh-TW', fallbackLng: 'en-US', resources, ns: namespaces, defaultNS: 'common',
    })
    assert.equal(instance.t('button.save'), '儲存')
    for (const count of [0, 1, 2, 10]) {
      assert.equal(instance.t('cloud-studio-pages:tree_hierarchy_search_results.results_length', {
        count,
      }), `${count} 筆結果`)
    }
    const releaseKey = Object.keys(resources['en-US']['cloud-studio-pages'])
      .find(key => resources['en-US']['cloud-studio-pages'][key] === 'Runtime Version: {{version}}')
    assert.equal(instance.t(`cloud-studio-pages:${releaseKey}`, {version: '1.2.3'}),
      '執行環境版本：1.2.3')
    const [fallbackKey, fallbackValue] = Object.entries(resources['en-US']['studio-tooltips'])[0]
    assert.equal(instance.t(`studio-tooltips:${fallbackKey}`), fallbackValue)
    await instance.changeLanguage('en-US')
    assert.equal(instance.t('button.save'), 'Save')
    await instance.changeLanguage('zh-TW')
    assert.equal(instance.t('button.save'), '儲存')
  })
})
