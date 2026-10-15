# No Seeds sign-in email setup

Prepared October 15, 2026. This is a founder setup guide, not evidence that SMTP or DNS has been configured.

Supabase's development sender currently allows only two messages per hour and restricts recipients. Connect custom SMTP before inviting beta members. See [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 1. Verify a sending subdomain in Resend

In the founder's Resend account, open Domains → Add domain. Use **auth.noseedsdatingsite.com**, choose a region, and enable sending only. Keep receiving disabled. Use manual DNS setup; do not authorize an automatic GoDaddy connection that could change existing records.

The subdomain isolates sign-in mail from the website and any existing mailbox. No Seeds can send as **no-reply@auth.noseedsdatingsite.com** once verified; this does not create an inbox.

## 2. Add only the new DNS records at GoDaddy

Open GoDaddy → My Products → noseedsdatingsite.com → DNS → DNS Records → Add New Record. Keep the existing website, www, MX, SPF and verification records. Copy the records shown for the new domain in Resend; the table below gives GoDaddy's relative Host/Name format.

| Type | GoDaddy Host/Name | Value | Priority / TTL |
|---|---|---|---|
| TXT (DKIM) | `resend._domainkey.auth` | Exact DKIM public-key value generated in Resend | Default TTL, or 600 seconds |
| TXT (SPF) | `send.auth` | Exact SPF value shown in Resend; commonly `v=spf1 include:amazonses.com ~all` | Default TTL, or 600 seconds |
| MX (return path) | `send.auth` | Exact region-specific destination shown in Resend; for example `feedback-smtp.us-east-1.amazonses.com` when that is the selected region | Copy Resend priority (usually 10); default TTL or 600 seconds |

GoDaddy appends `noseedsdatingsite.com` automatically. Do not paste the full domain into Host and accidentally duplicate it. The DKIM key and regional MX endpoint must come from the founder's Resend dashboard; they cannot be inferred from the app repository. If Resend shows different record names, follow those generated names with the base domain removed.

If an exact host already has a conflicting record, stop and resolve it with the domain owner. Never add a second SPF record at the same hostname. Do not replace root `@` MX/SPF, Render A/CNAME, `www`, or any existing GoDaddy record. If Resend requests a DMARC record, add it only at a new, unused host after checking the existing parent DMARC policy; do not overwrite a policy to get verification to pass.

Return to Resend → Domains → Verify DNS Records and wait for **Verified**. [Resend's GoDaddy guide](https://resend.com/docs/guides/dns/godaddy) explains the provider-specific fields.

## 3. Connect Supabase SMTP

Create a Resend API key restricted to sending for this domain if that scope is available. The founder should enter the key directly into Supabase, never into chat or the frontend. In Supabase project `btnrophnyfuwnqzwiooh`, open Authentication → Email (under Notifications) → SMTP Settings and enable custom SMTP:

| Field | Value |
|---|---|
| Sender email | `no-reply@auth.noseedsdatingsite.com` |
| Sender name | `No Seeds` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | The Resend API key |

Save only after the sending domain is verified. The key belongs in Supabase SMTP settings; Render remains a static site with no environment variables. See [Resend's Supabase SMTP instructions](https://resend.com/docs/send-with-supabase-smtp).

Disable click/open tracking for authentication mail in the sender settings so sign-in URLs are not rewritten. Keep the Supabase magic-link template's confirmation link intact. In Supabase Authentication → Rate Limits, review the custom SMTP default (currently 30 emails/hour) and set the email limit within the verified Resend account's hourly/daily capacity and expected beta traffic. Keep the per-address resend interval and abuse protections enabled.

## 4. Verify delivery and redirects before invitations

Site URL must be `https://noseedsdatingsite.com`. Keep the primary, www and Render callback URLs allowlisted as needed. From the primary app, request a fresh sign-in link to a founder-controlled Gmail address, then a controlled address at another provider. Check delivery, spam placement, and the message's original headers for SPF/DKIM/DMARC results. Open the link in the browser where sign-in began and confirm it returns to the primary app with the correct saved-account screen. Test an expired/used link shows a recoverable error and a new link works. Use authorized test accounts; do not approve real member profiles for this check.

Check Resend delivery events and Supabase Auth logs for successful sends and rejected/rate-limited messages, without copying confirmation tokens or credentials into logs. Delivery acceptance does not prove inbox placement. Record the test time, provider and outcome before widening beta invitations.

No GoDaddy records were changed by preparing this guide. Actual sender verification, SMTP credential entry and end-to-end delivery remain founder setup steps until recorded as completed.
