import { createI18n } from '@packman/ui'
import { messages, SUPPORTED_LOCALES, DEFAULT_LOCALE, type AdminLocale } from './messages'

export const { LocaleProvider, useLocale, useT, getLocale, translate } = createI18n<AdminLocale>({
  messages,
  defaultLocale: DEFAULT_LOCALE,
  storageKey: 'packman-admin-locale',
  supported: SUPPORTED_LOCALES,
})
