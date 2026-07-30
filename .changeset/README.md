# Changesets

Every pull request that changes the installed application should include a
changeset:

```sh
npm run changeset
```

Choose `patch`, `minor`, or `major`, then write a user-facing summary. Changes
that do not affect a release (documentation, tests, or CI-only changes) do not
need a changeset.

Do not edit the version in `package.json` manually. The release workflow
collects changesets into a version pull request and keeps `package.json`,
`package-lock.json`, `CHANGELOG.md`, the Git tag, and the packaged application
version aligned.
