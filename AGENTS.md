<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent activity dashboard

The user wants concise, live visibility into agent work. When coordinating work in this project, report real task starts, meaningful milestones, and completion with `node tools/agent-dashboard/report.mjs ID NAME MODEL STATUS SUMMARY`. See `tools/agent-dashboard/README.md`. Use stable IDs, actual model names when known, and only public task summaries. Do not invent progress, token counts, or agent activity, or include credentials or private reasoning. Keep reporting lightweight; no periodic agent wakeups are needed. The local dashboard starts with `npm run agents:dashboard`.
