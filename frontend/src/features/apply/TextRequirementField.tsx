import type { DocumentRequirement } from '@/api/types'
import { Field } from '@/ui/Field'
import { Textarea } from '@/ui/Textarea'

interface TextRequirementFieldProps {
  requirement: DocumentRequirement
  value: string
  onChange: (value: string) => void
  error?: string
}

export function TextRequirementField({ requirement, value, onChange, error }: TextRequirementFieldProps) {
  return (
    <Field label={requirement.label} required={requirement.required} error={error} id={`field-${requirement.key}`}>
      {(props) => <Textarea {...props} value={value} onChange={(event) => onChange(event.target.value)} />}
    </Field>
  )
}
