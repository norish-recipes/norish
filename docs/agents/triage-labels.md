# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding string from this table.

## Where the string goes

The strings are identical across every surface, so a ticket keeps its role when it moves between them.

- **Local tickets** (`.scratch/**`, the default tracker) — a `Status:` line near the top of the file:

  ```markdown
  # Drain the replay queue on reconnect

  Status: ready-for-agent
  ```

  Change the role by editing that line. One role at a time; a ticket with no `Status:` line is untriaged.

- **Community GitHub issues** — applied as GitHub labels (`gh issue edit <n> --add-label ready-for-agent`). Create the label once if the repo doesn't have it yet.

- **Linear** (`GEZ`) — these are not set up as Linear labels today, and skills don't file there by default (see `issue-tracker.md`). If that changes, add them as Linear labels with these exact names so the vocabulary stays 1:1.

Edit the right-hand column to match whatever vocabulary you actually use.
