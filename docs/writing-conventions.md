# Writing conventions for this project

These apply to every document and artifact produced for Offerline: the SRS, UI
copy, landing page text, design mockups, diagrams and slide content. They also
apply to code comments.

## 1. No em dashes

Use commas, colons, parentheses, or restructure the sentence.

## 2. State what the system does, not what it declines to do

Write requirements and feature copy positively.

- Yes: "A CV is attached to each application individually."
- No: "The system shall treat the CV as part of the application rather than the
  profile, and shall not designate any CV as a profile default."

## 3. Do not frame a feature against an alternative that was only discussed in chat

If a reader never expected the alternative, mentioning it is confusing rather
than clarifying. Phrases like "rather than X", "instead of Y" and "shall not do
Z" almost always signal this problem. A fresh reader has no idea that X was ever
on the table, so the comparison reads as if X were the normal thing to do.

This applies most strongly to UI copy, landing pages and marketing surfaces,
where design deliberations have no place at all.

## 4. Keep rationale out of the artifact

Design reasoning belongs in conversation, or in the detailed internal copy of the
SRS. It does not belong in the submission copy of the SRS, in the interface, or
in anything a user reads.

The exception: genuine user facing behaviour that improves the experience should
still be stated plainly. "Earlier CVs are offered for reuse, newest first, with
the label you gave them" is a feature a user benefits from knowing. That stays.

## 5. Practical test before writing any user facing line

Would somebody who has never read the design discussion understand this line, and
would they have expected anything different? If the line only makes sense to
someone who sat through the discussion, cut it or rewrite it.

## Note on code comments

Comments in this repository explain why a decision was taken, not what the line
does. They are written for a maintainer who has the SRS beside them, so they
refer to requirement identifiers such as FR-5.2 rather than restating the rule.
