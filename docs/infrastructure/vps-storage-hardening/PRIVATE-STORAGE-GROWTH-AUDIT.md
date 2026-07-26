# Private Storage Growth Audit

Audit mode: production read-only. No file was deleted, moved, archived, opened
for content inspection, or copied.

## Identity and size

- Volume: `mykinlegacy_private_storage`
- Host path: `/var/lib/docker/volumes/mykinlegacy_private_storage/_data`
- Application mount: `/app/.local-storage-production`
- Current allocated size: 6,715,260,928 bytes.
- Initial logical file bytes: 6,708,737,148 bytes.
- Final logical file bytes: 6,708,737,148 bytes.
- Net logical growth: 0 bytes.
- Files created in the gate window: 0.
- Total files: 4,212.
- Temporary `.tmp`, `.temp`, or `.part` files: 0.

## Content classification

| Extension | Files | Logical bytes | Classification |
| --- | ---: | ---: | --- |
| PNG | 2,776 | 3,277,694,613 | CUSTOMER_DELIVERABLE / ACTIVE_ORDER_ASSET |
| ZIP | 359 | 2,277,759,851 | CUSTOMER_DELIVERABLE / BUSINESS_REQUIRED |
| PDF | 1,077 | 1,153,282,684 | CUSTOMER_DELIVERABLE / BUSINESS_REQUIRED |

The single dominant top-level directory consumes 6,715,256,832 allocated bytes.
Its identifier is redacted in evidence because directory names may be tied to
orders. No cache, log, backup, or temporary-generation subtree was identified by
name or extension. Existing assets remain BUSINESS_REQUIRED unless order-level
retention rules prove otherwise.

## Largest objects

The twenty largest files are ZIP deliverables. Sanitized path hashes were used
instead of order/customer identifiers. The largest three are 10,168,632,
10,103,131, and 10,103,069 bytes; the remaining leading objects are about
6.84 MB each.

There are 80 repeated-size groups. Equal size alone is not proof of duplicate
content, so these are `DUPLICATE_CANDIDATE` only. No hashing-based deletion or
movement was performed.

## Decision

Private-storage growth is explained and controlled: zero new bytes and zero new
files in the window. All existing data is protected as BUSINESS_REQUIRED,
CUSTOMER_DELIVERABLE, ACTIVE_ORDER_ASSET, or UNKNOWN_DEPENDENCY. Archival or
cleanup is not approved.

