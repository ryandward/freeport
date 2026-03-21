# freeport

Linux packages that pass without inspection.

Age verification infrastructure is being built into core Linux packages.
systemd gained a birthDate field in userdb. xdg-desktop-portal has an age range
portal in review. accountsservice is adding birth date storage. California's
AB 1043 takes effect January 2027 and demands that operating systems provide
real time age bracket APIs.

freeport maintains patched builds of affected packages with all age verification
code removed. Arch Linux is supported first. The build system is designed to
support any distro that ships the affected packages.

This is not a fork of any distribution. Add the repo, get clean packages,
keep using your system exactly as before.

## What gets patched

| Package | What we strip | Status |
|---------|--------------|--------|
| systemd | birthDate field in userdb JSON user records | Tracking upstream |
| xdg-desktop-portal | Age range portal API (PR #1922) | Tracking upstream |
| accountsservice | Birth date storage (MR #176) | Tracking upstream |

The patch surface is small and targeted. We are not modifying unrelated
functionality. Each patch set is the minimum diff needed to remove age
verification without breaking anything else.

## Using freeport on Arch

Add the repo above `[core]` in `/etc/pacman.conf`:

```
[freeport]
SigLevel = Required
Server = https://pkg.freeport.dev/$arch
```

Import the signing key:

```
pacman-key --recv-keys <KEY_ID>
pacman-key --lsign-key <KEY_ID>
```

Then update:

```
pacman -Syu
```

Affected packages will be replaced by freeport builds on the next upgrade.

## How it works

Upstream sources are pulled using `asp` (Arch Build System). Patch sets are
applied in a clean chroot using `makechrootpkg`. Built packages are signed and
published to the repository.

A CI pipeline watches upstream for new releases. When a new version lands,
the pipeline attempts to rebase our patches. If the rebase is clean, the new
package is built and published automatically. If it fails, a maintainer is
notified.

## Adding a distro

The build system is not Arch specific. Each distro gets a directory under
`distros/` with its own packaging scripts and patch sets. If you maintain
packages for another distro and want to contribute, open a PR.

```
distros/
  arch/
    systemd/
      PKGBUILD
      patches/
    xdg-desktop-portal/
      PKGBUILD
      patches/
  debian/
  fedora/
  void/
```

## Contributing

Open an issue or PR. If you package for a distro we do not cover yet, we want
to hear from you. If you have found another package shipping age verification
infrastructure, file an issue with a link to the upstream commit or PR.

## Why

An operating system should run software. It should not ask how old you are.
These changes are being introduced under legal pressure from state and national
governments. The fact that systemd reverted the birthDate field after backlash
shows that the upstream projects do not want this either. But the legal pressure
is not going away, and the next attempt may stick.

freeport exists so that when that happens, you have somewhere to get clean
packages the same day.

## License

MIT
