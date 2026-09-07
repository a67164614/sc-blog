#!/usr/bin/env bash

set -euo pipefail

grep -q 'title: "Sc 的个人博客"' src/config/siteConfig.ts

if grep -q 'title: "Firefly"' src/config/siteConfig.ts; then
	echo 'default title must not remain Firefly' >&2
	exit 1
fi

if grep -q 'subtitle: "Demo site"' src/config/siteConfig.ts; then
	echo 'default subtitle must not remain Demo site' >&2
	exit 1
fi
