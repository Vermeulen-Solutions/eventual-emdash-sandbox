import { nativeEditorText, resolveLanguage } from './native-messages';

export function editorText(value: string, locale = 'en'): string {
  const lang = resolveLanguage(locale);
  if (lang === 'en') return value;
  if (value.startsWith('Use a different ')) {
    const name = value.slice(16);
    const translatedName = nativeEditorText(name[0]!.toUpperCase() + name.slice(1), locale);
    if (lang === 'fr') return 'Autre ' + translatedName.toLowerCase();
    if (lang === 'de') return 'Anderen ' + translatedName.toLowerCase() + ' wählen';
    if (lang === 'nl') return 'Andere ' + translatedName.toLowerCase() + ' kiezen';
    if (lang === 'es') return 'Otro ' + translatedName.toLowerCase();
  }
  return nativeEditorText(value, locale);
}
