<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Multi-tenant: every tenant row carries business_id and RLS uses `is_business_member()`; never trust client-supplied tenant checks.
- Public booking passes through a server function verifying Turnstile and a signed visitor credential, then service-role-only SECURITY DEFINER RPCs; availability stays public and status changes require membership, keeping price/status/conflicts server-controlled.
- Booking rate counters are persisted atomically per verified browser credential, not IP; hosting has no documented trusted IP header, so cookie reset remains an explicit limitation.
- Preserve declared booking identity on each appointment separately from the customer record so anonymous submissions cannot rewrite existing customer names.
- Shared query failure UI must distinguish errors from empty results and offer retry so failures do not hide records.
- Double-booking is prevented by the gist exclusion constraint on appointments (pendente/confirmado), not by app code.
- Media bucket is private (workspace blocks public buckets); store object paths and render via signed URLs (`useMediaUrl`).
- Money is integer cents; times are timestamptz shown in the business timezone via helpers in src/lib/detailhub.ts.
