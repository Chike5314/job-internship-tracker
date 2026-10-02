import { useState } from 'react'
import type { Profile } from '@/api/types'
import { DEGREE_LEVEL_LABEL, type DegreeLevel } from '@/api/enums'
import { Button } from '@/ui/Button'
import { Field } from '@/ui/Field'
import { Input } from '@/ui/Input'
import { Select } from '@/ui/Select'
import { SkillsEditor } from './SkillsEditor'
import { useUpdateProfile } from './useProfile'

const DEGREE_LEVELS: DegreeLevel[] = ['HND', 'BACHELORS', 'MASTERS', 'DOCTORATE', 'OTHER']

export function ProfileForm({ profile }: { profile: Profile }) {
  const [fullName, setFullName] = useState(profile.fullName)
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [skills, setSkills] = useState(profile.skills ?? [])
  const [schoolName, setSchoolName] = useState(profile.academicInfo?.schoolName ?? '')
  const [fieldOfStudy, setFieldOfStudy] = useState(profile.academicInfo?.fieldOfStudy ?? '')
  const [degreeLevel, setDegreeLevel] = useState(profile.academicInfo?.degreeLevel ?? '')
  const [saved, setSaved] = useState(false)

  const update = useUpdateProfile()

  async function onSave() {
    setSaved(false)
    await update.mutateAsync({
      fullName,
      phone,
      skills,
      academicInfo: { schoolName, fieldOfStudy, ...(degreeLevel ? { degreeLevel } : {}) },
    })
    setSaved(true)
  }

  return (
    <div className="glass-dense" style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)' }}>
      <Field label="Full name">
        {(props) => <Input {...props} value={fullName} onChange={(event) => setFullName(event.target.value)} />}
      </Field>

      <Field label="Phone">
        {(props) => <Input {...props} value={phone} onChange={(event) => setPhone(event.target.value)} />}
      </Field>

      <Field label="Skills">{() => <SkillsEditor skills={skills} onChange={setSkills} />}</Field>

      <fieldset style={{ border: 'none', padding: 0, display: 'grid', gap: 'var(--space-3)' }}>
        <legend className="t-eyebrow" style={{ textTransform: 'uppercase', marginBottom: 'var(--space-2)' }}>
          Studies
        </legend>
        <p className="t-caption" style={{ color: 'var(--color-text-subtle)' }}>
          Postings that require these details will ask for them.
        </p>
        <Field label="School">
          {(props) => <Input {...props} value={schoolName} onChange={(event) => setSchoolName(event.target.value)} />}
        </Field>
        <Field label="Field of study">
          {(props) => (
            <Input {...props} value={fieldOfStudy} onChange={(event) => setFieldOfStudy(event.target.value)} />
          )}
        </Field>
        <Field label="Degree level">
          {(props) => (
            <Select
              {...props}
              placeholder="Select"
              value={degreeLevel}
              onChange={(event) => setDegreeLevel(event.target.value)}
              options={DEGREE_LEVELS.map((level) => ({ value: level, label: DEGREE_LEVEL_LABEL[level] }))}
            />
          )}
        </Field>
      </fieldset>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <Button variant="primary" loading={update.isPending} onClick={onSave}>
          Save
        </Button>
        {saved && (
          <span className="t-body-sm" style={{ color: 'var(--color-feedback-ok-text)' }}>
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
