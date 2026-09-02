# Cursor collections

Opt in to any supported list using `GET /inventory?pagination=cursor`. Page size is fixed at 10, including when a caller supplies another `limit`. Requests without cursor mode retain their existing contracts for integrations and catalog selectors.

```json
{
  "data": [],
  "total": 26,
  "pageInfo": {
    "pageSize": 10,
    "total": 26,
    "from": 1,
    "to": 10,
    "page": 1,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "nextCursor": "opaque signed token",
    "previousCursor": null
  }
}
```

Pass the returned `nextCursor` or `previousCursor` as `cursor` on the same URL and with the same filters. Omit it or use `cursor=start` to return to the first page. Cursors expire after one hour and are signed with the application's JWT secret. Invalid, expired or mismatched cursors return HTTP 400 with `code: INVALID_CURSOR`.

Cursor scope includes tenant, branch, caller, endpoint, all-branches selection and query parameters. Changing search, sort or filters requires restarting at the first page. Existing authentication, tenant routing and permission checks remain authoritative.

## Search and sorting

- `_sort`: validated property name; defaults to the collection's stable date/id field.
- `_order`: `asc` or `desc`; defaults to `desc`.
- `_search`: case-insensitive search, maximum 512 characters.
- `_filters`: JSON array of `{ "field": "category", "op": "eq", "value": "Hair" }`. Operators: `eq`, `in`, `gte`, `lte`, `contains`. At most 20 filters and 100 values per `in` filter.
- `collection`: named nested row array, e.g. `/reports/staff?pagination=cursor&collection=staff` or `/dashboard?pagination=cursor&collection=todaysAppointments`.

Date/string/number ordering uses the row ID as a tie-breaker and keeps null values last. Deleting the anchor row does not invalidate a server cursor. Report totals and other non-selected collections remain complete. Platform list responses include collection-wide `summary` indicators independently of the current search/filter/page.

## Implementation and frontend

`CursorPaginationInterceptor` establishes per-request AsyncLocalStorage state. `cursorQueryRows` applies SQL keyset boundaries and a look-ahead row to supported entity queries (inventory, services, employees, packages and invoices), retaining their tenant and branch constraints. Computed lists, joined reports and platform collections use the reusable array keyset adapter after their scoped service query; they currently materialize the collection on the backend. Cursor mode bypasses legacy offset windows and hard caps on supported collections.

The frontend's shared `Table` automatically displays ten rows with `CursorPagination`. Remote lists provide `useRemoteCursor` controls, which reset on filters/branch changes, abort stale requests and recover expired cursors. Computed reports and editable matrices use `useLocalCursor`. `getCursorCollection` follows server cursors when a complete collection is necessary for exports, cross-row reports, charts or summaries; those screens then paginate their visible rows locally. This preserves complete totals without silently truncating reports.

Landing comparison tables explicitly use `pagination={false}`. Printable HTML invoice/voucher documents preserve their complete line items.

## Verification

Run `npm test -- --runInBand` and `npm run build`. With disposable provisioned client1/client2 tenants and a platform administrator in a test database, run `TEST_ADMIN_PASSWORD=<demo-password> node scripts/test-cursor-pagination.cjs`. Set `TEST_API_URL=http://127.0.0.1:3000/api/backend` to test through the frontend proxy. The script creates and removes only its own inventory fixtures and tests 10/10/6 windows, tied values, reverse navigation, removed anchors, forged tokens, tenant/branch/filter scope, report metadata and platform summaries.
