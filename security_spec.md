# Security Specification - Geometric Balance AI

## Data Invariants
1. A Task must have a valid `ownerId` which is the UID of the creator.
2. A Task can only be read or modified by its `ownerId` or users in its `collaborators` list.
3. Comments can only be added to tasks that the user has access to.
4. User profiles can only be modified by the owner of that profile.
5. `ownerId` and `createdAt` are immutable after task creation.

## The "Dirty Dozen" Payloads (Deny List)
1. **Identity Spoofing**: Attempt to create a task with an `ownerId` that isn't the current user.
2. **Unauthorized Access**: Attempt to read a task where the current user is neither owner nor collaborator.
3. **Ghost Update**: Attempt to update a task's `ownerId` to hijack ownership.
4. **ID Poisoning**: Attempt to create a task with a document identifier that is 2KB of junk characters.
5. **Schema Breach**: Attempt to write an invalid priority string (e.g., "critical").
6. **Immutable Violation**: Attempt to change a task's `createdAt` timestamp after creation.
7. **PII Leak**: Attempt to read another user's private settings from the `users` collection.
8. **Comment Injection**: Attempt to comment on a task without being an owner or collaborator.
9. **Large Payload Attack**: Attempt to write a 1MB string into a task's `text` field.
10. **State Shortcut**: Attempt to modify the `completed` status without having edit permissions.
11. **Collaborator Escalation**: Attempt to add yourself as a collaborator to a task you don't own.
12. **System Field Hijacking**: Attempt to manually set the `summary` field (AI field) if we want to restrict it (optional, but good to think about).

## Red Team Audit Table
| Collection | Identity Spoofing | State Shortcutting | Resource Poisoning |
| :--- | :--- | :--- | :--- |
| `users` | Blocked via `userId == request.auth.uid` | N/A | Blocked via `.size()` checks |
| `tasks` | Blocked via `incoming().ownerId == auth.uid` | Blocked via role gates | Blocked via `.size()` and `isValidId()` |
| `comments` | Blocked via `incoming().userId == auth.uid` | N/A | Blocked via `.size()` |
