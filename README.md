# Notify Microsoft Teams

Posts an Adaptive Card to a Microsoft Teams channel from a GitHub workflow, through a Teams **Workflows** webhook. It replaces `notify-campfire-basecamp`.

Office 365 connector webhooks in Teams were retired in May 2026; Workflows webhooks are the supported replacement.

## Set up the webhook

1. In Teams, open the channel → **⋯** → **Workflows** → **Send webhook alerts to a channel**, and save it.
2. Copy the webhook URL. The URL is the credential (its `sig` query parameter signs requests), so store it only as a GitHub secret.
3. In Power Automate, add a co-owner to the flow. A flow belongs to the person who created it and stops working if they leave without a co-owner.
4. Optional: a flow made from the template adds a footer naming its creator. To drop it, copy the flow in the Power Automate portal (**Save as**) and use the copy's URL.

## Usage

```yaml
- name: Notify Teams
  if: always()
  uses: bigblueanalytics/notify-teams@v1
  with:
    webhook_url: ${{ secrets.TEAMS_GITHUB_ALERTS_WEBHOOK_URL }}
    status: ${{ needs.deploy.result }}
    title: "🐍 API deploy: occam-app-api → pre"
    facts: |
      ${{ github.ref_type }}: ${{ github.ref_name }}
      Triggered by: ${{ github.actor }}
    links: |
      Vulnerabilities report | ${{ needs.deploy.outputs.TRIVY_REPORT_URL }}
```

| Input | Required | Description |
| --- | --- | --- |
| `webhook_url` | yes | Workflows webhook URL, from a secret. |
| `title` | yes | Card headline. Plain text. |
| `status` | no | `success`, `failure`, `cancelled`, `skipped` or `info` (default). Sets the header colour and icon. `needs.<job>.result` and `job.status` work as-is. |
| `message` | no | Body text. Basic Markdown renders (`**bold**`, `[link](url)`, lists). HTML does not: Teams shows it as text. |
| `facts` | no | `Key: value` lines, rendered as a fact list. Lines with an empty value are dropped, so optional outputs can be listed unconditionally. |
| `links` | no | `Label \| URL` lines, rendered as buttons. Lines with an empty URL are dropped. |
| `run_link` | no | `true` (default) adds a **View run** button. |

The step fails if Teams rejects the message. HTTP 429 (Teams throttles above 4 requests/s per webhook) and 5xx responses are retried with backoff. Messages post as the Workflows bot, so the bot name and icon cannot be customised.

## Development

No runtime dependencies: the runner's Node 24 provides `fetch`, so there is no `dist/` to rebuild. Run `node --test`.

Releases are tagged `v1.x.y`, and the moving `v1` tag points at the latest one.
