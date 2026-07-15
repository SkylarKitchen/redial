# ISSUES

Open issues labeled `ready-for-agent`:

<issues-json>

!`gh issue list --state open --label ready-for-agent --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`

</issues-json>

The list above is pre-filtered to issues a maintainer has marked AFK-ready.

# TASK

Analyze the open issues and build a dependency graph. For each issue, determine whether it **blocks** or **is blocked by** any other open issue.

An issue B is **blocked by** issue A if:

- B requires code or infrastructure that A introduces
- B and A modify overlapping files or modules, making concurrent work likely to produce merge conflicts (use `src/overlay/DIRECTORY.md` to reason about which files an issue will touch)
- B's requirements depend on a decision or API shape that A will establish

An issue is **unblocked** if it has zero blocking dependencies on other open issues.

For each unblocked issue, assign a branch name using the format `sandcastle/issue-{id}-{slug}`.

# OUTPUT

Output your plan as a JSON object wrapped in `<plan>` tags:

<plan>
{"issues": [{"id": "42", "title": "Fix shadow editor rounding", "branch": "sandcastle/issue-42-fix-shadow-editor-rounding"}]}
</plan>

Include only unblocked issues. If every issue is blocked, include the single best candidate (the one with the fewest or weakest dependencies). If the issue list is empty, output `<plan>{"issues": []}</plan>`.
