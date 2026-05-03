import { createI18n } from '@packman/ui'
import { messages, SUPPORTED_LOCALES, DEFAULT_LOCALE, type WebLocale } from './messages'

export const { LocaleProvider, useLocale, useT, getLocale, translate } = createI18n<WebLocale>({
  messages,
  defaultLocale: DEFAULT_LOCALE,
  storageKey: 'packman-locale',
  supported: SUPPORTED_LOCALES,
})
