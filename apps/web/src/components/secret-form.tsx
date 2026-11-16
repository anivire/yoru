import { Button, Input } from '@yoru/ui'
import { RiKey2Fill } from '@remixicon/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export function SecretForm({
  placeholder,
  isSet,
  fromEnv = false,
  onSave,
  onClear,
  pending,
}: {
  placeholder: string
  isSet: boolean
  fromEnv?: boolean
  onSave: (v: string) => void
  onClear: () => void
  pending: boolean
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [editing, setEditing] = useState(false)
  if (isSet && !editing) {
    return (
      <div className="flex gap-2">
        <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg bg-success-soft px-3 text-[0.8125rem] text-success">
          <RiKey2Fill className="size-3.5 shrink-0" />
          {fromEnv ? <span className="shrink-0 font-medium">{t('admin.secret.setEnv')}</span> : null}
          <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-mono text-lg leading-none tracking-[0.15em]" title={t('admin.secret.set')}>
            {"•".repeat(128)}
          </span>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(true)}>
          {t('admin.secret.replace')}
        </Button>
        {fromEnv ? null : (
          <Button type="button" size="sm" variant="ghost" onClick={onClear} loading={pending}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    )
  }
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
        setValue('')
        setEditing(false)
      }}
    >
      <Input
        type="password"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        autoFocus={editing}
        className="h-8 text-[0.8125rem]"
      />
      <Button type="submit" size="sm" variant="secondary" disabled={!value.trim()} loading={pending}>
        {t('common.save')}
      </Button>
      {editing ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setValue('')
            setEditing(false)
          }}
        >
          {t('common.cancel')}
        </Button>
      ) : null}
    </form>
  )
}
