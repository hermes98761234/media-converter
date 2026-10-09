import { useEffect, useState } from 'react'
import { tr, type T } from './i18n'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import ImageTab from './components/ImageTab'
import VideoTab from './components/VideoTab'

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const t: T = (s, ...a) => tr(settings.lang, s, ...a)
  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }))

  useEffect(() => saveSettings(settings), [settings])
  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') delete root.dataset.theme
    else root.dataset.theme = settings.theme
    root.lang = settings.lang
  }, [settings.theme, settings.lang])

  return (
    <div className="app">
      <header className="toolbar">
        <span className="brand">{t('Media converter')}</span>
        <nav className="tabs" role="tablist">
          {(['images', 'video'] as const).map((id) => (
            <button key={id} role="tab" aria-selected={settings.tab === id} className={settings.tab === id ? 'tab active' : 'tab'} onClick={() => update({ tab: id })}>
              {id === 'images' ? t('Images') : t('Video & audio')}
            </button>
          ))}
        </nav>
        <span className="spacer" />
        <select aria-label={t('Theme')} value={settings.theme} onChange={(e) => update({ theme: e.target.value as Settings['theme'] })}>
          <option value="auto">{t('System')}</option>
          <option value="light">{t('Light')}</option>
          <option value="dark">{t('Dark')}</option>
        </select>
        <select aria-label={t('Language')} value={settings.lang} onChange={(e) => update({ lang: e.target.value as Settings['lang'] })}>
          <option value="en">English</option>
          <option value="uk">Українська</option>
        </select>
      </header>
      {/* Both tabs stay mounted so a running conversion survives a tab switch. */}
      <div hidden={settings.tab !== 'images'}>
        <ImageTab options={settings.image} onOptions={(image) => update({ image })} t={t} />
      </div>
      <div hidden={settings.tab !== 'video'}>
        <VideoTab options={settings.media} onOptions={(media) => update({ media })} t={t} />
      </div>
      <p className="hint foot">
        {t('Resize, compress and convert images, video and audio. Everything stays in your browser.')} {t('Files never leave your device.')}{' '}
        <a href="https://github.com/hermes98761234/media-converter">{t('Source on GitHub')}</a>
      </p>
    </div>
  )
}
