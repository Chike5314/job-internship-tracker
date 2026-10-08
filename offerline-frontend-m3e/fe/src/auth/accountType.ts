// The only value this phase ever writes. `custom:accountType` also accepts
// 'company', but recruiter sign-up is a later phase; nothing here infers
// or defaults this value, every sign-up call states it explicitly.
export type AccountType = 'individual' | 'company'
