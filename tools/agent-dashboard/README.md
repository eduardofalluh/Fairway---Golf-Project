# Fairway agent dashboard

A small local dashboard with no dependencies. It listens only on this computer and polls real, explicitly reported updates every two seconds. It does not read private reasoning, Codex logs, credentials, or infer progress percentages.

Start with `node server.mjs` and open http://localhost:5174.

Report a milestone from the coordinator or a working agent:

```sh
node report.mjs coordinator Coordinator 'Current session' working 'Checking the deployed search flow'
```

Arguments are ID, display name, model, status (`working`, `completed`, `blocked`, or `idle`), and a short public task summary. Reuse the ID to update that agent. Append a report when work starts, a meaningful milestone occurs, or work finishes. No heartbeat or token counter is invented. Updates remain in local `activity.jsonl`, which is excluded from Git.

This dashboard only follows agents whose milestones are reported through this helper; it is not an automatic monitor of every Codex task. If reporting stops, timestamps show the last report. If the server stops, the page shows a disconnected state.
