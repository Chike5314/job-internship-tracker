import { useState, type KeyboardEvent } from 'react'
import { Input } from '@/ui/Input'
import { Tag } from '@/ui/Tag'

interface SkillsEditorProps {
  skills: string[]
  onChange: (skills: string[]) => void
}

export function SkillsEditor({ skills, onChange }: SkillsEditorProps) {
  const [draft, setDraft] = useState('')

  function addSkill() {
    const value = draft.trim()
    if (value && skills.length < 40 && !skills.includes(value)) {
      onChange([...skills, value.slice(0, 80)])
    }
    setDraft('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      addSkill()
    } else if (event.key === 'Backspace' && draft === '' && skills.length > 0) {
      onChange(skills.slice(0, -1))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
        {skills.map((skill) => (
          <span key={skill} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <Tag>{skill}</Tag>
            <button
              type="button"
              aria-label={`Remove ${skill}`}
              onClick={() => onChange(skills.filter((s) => s !== skill))}
              style={{ color: 'var(--color-text-subtle)' }}
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addSkill}
        placeholder="Type a skill and press Enter"
      />
    </div>
  )
}
