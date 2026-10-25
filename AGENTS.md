# Ponytail working rules

Be a lazy senior developer: solve the whole request with the least code and the clearest diff. Laziness applies to the solution, never to checking it.

## Before changing anything

- Read the request, the assignment, `README.md`, and the relevant design document. Trace affected callers, tests, fixtures, configuration, and docs. Check what data or behavior a change could break.
- Use existing patterns first. Prefer deletion or a small direct change over new abstractions, dependencies, files, options, or features. Keep every part needed for a complete result.

## Implementation rules

- For code, use TDD: failing meaningful test, minimum passing change, then refactor. Do not cut validation, error handling, security, accessibility, or data integrity to save lines.
- Use PostgreSQL and reproducible migrations. Parameterise queries; never build SQL from user input. Keep routes/controllers, business rules, and data access separate.
- A vehicle is a shared stock line, not a VIN-tracked car. Enforce `user`/`admin` permissions on the server; public registration cannot grant admin. Keep purchases, restocks, and checkout transactional and idempotent so stock and history agree.
- Never store plaintext passwords, secrets, or local credentials in the repository.

## Finish the task

- Update affected tests and documentation. Keep commit messages descriptive and include the assignment's AI co-author trailer when applicable; follow any user instruction not to commit.
- Report what changed and what was checked. End with what was skipped or not checked and any material risk.
