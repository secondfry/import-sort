# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [7.1.0] - 2021-05-11
### Added
- If `IMPORT_SORT_DEBUG` environment variable is set, then 
  some debugging information will be printed.
  Currently prints out result of `babelLoadPartialOptions` and
  result of `babelLoadOptions`.

### Changed
- `jsx` plugin now added only for `['.jsx', '.tsx']` files.
- Some fallbacks in code were enforced, probably
  highlighting already present bugs.
