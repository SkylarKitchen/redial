# TASK

Merge the following branches into the current branch:

{{BRANCHES}}

For each branch:

1. Run `git merge <branch> --no-edit`
2. If there are merge conflicts, resolve them intelligently by reading both sides and choosing the correct resolution
3. After resolving conflicts, run the gates in order, fail-fast:
   - `npm run typecheck`
   - `npm test`
   - `npm run lint`
4. If gates fail, fix the issues before proceeding to the next branch

After all branches are merged, make a single commit summarizing the merge (prefix `sandcastle:`).

# DO NOT CLOSE ISSUES

Leave all issues open. A human reviews the merged branch and closes issues manually after QA. For each branch that was merged:

1. Leave a comment on its issue summarizing what shipped, but do NOT run `gh issue close`.
2. Move it out of the agent queue so the next planning cycle doesn't re-pick it:
   `gh issue edit <N> --remove-label ready-for-agent --add-label ready-for-human`

Here are the issues whose branches were merged:

{{ISSUES}}

Once you've merged everything you can, output <promise>COMPLETE</promise>.
