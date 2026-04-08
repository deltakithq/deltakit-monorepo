# Create Debian Service User with Home Directory, No Password

This sample exercises the main rendering paths that the manual timing test cares about:

- Headings and paragraphs
- Bash code fences with Prism highlighting
- A simple table

```bash
sudo useradd \
  --system \
  --create-home \
  --home-dir /srv/example \
  --shell /usr/sbin/nologin \
  example
```

| Name | Type |
|------|------|
| id | string |
| role | enum |

Use this file as a portable fixture for local and CI timing checks.
