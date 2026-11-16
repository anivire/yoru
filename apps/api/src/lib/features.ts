import { FEATURE_SOURCES, type FeatureId } from '@yoru/shared'
import { getSetting, setSetting } from './settings'
import { setSourceEnabled, sourceEnabled } from './sources'

export function featureEnabled(id: FeatureId): boolean {
  const value = getSetting(`feature.${id}.enabled`)
  if (value === null) return sourceEnabled(FEATURE_SOURCES[id])
  return value === 'true' && sourceEnabled(FEATURE_SOURCES[id])
}

export function setFeatureEnabled(id: FeatureId, enabled: boolean) {
  setSetting(`feature.${id}.enabled`, enabled ? 'true' : 'false')
  if (enabled) setSourceEnabled(FEATURE_SOURCES[id], true)
}
