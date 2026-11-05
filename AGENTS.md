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
- Public booking and status changes go only through SECURITY DEFINER RPCs (`create_booking_request`, `get_available_slots`, `change_appointment_status`); clients have no direct insert/update on appointments so price, status and conflicts stay server-controlled.
- Double-booking is prevented by the gist exclusion constraint on appointments (pendente/confirmado), not by app code.
- Media bucket is private (workspace blocks public buckets); store object paths and render via signed URLs (`useMediaUrl`).
- Money is integer cents; times are timestamptz shown in the business timezone via helpers in src/lib/detailhub.ts.
