<p align="center">
  <img src="logo.svg" width="256" alt="freeport">
</p>

# freeport

**[https://ryandward.github.io/freeport](https://ryandward.github.io/freeport/)**

**freeport is not an operating system.** Laws like California's AB 1043
target operating system distributors. This is not one. This is a project
for people who believe your computer shouldn't willingly hand over your
most precious cargo, your information, to analytics companies and the
government. Patches are maintained here and shared freely. That is all
this project does.

## I need your help

Right now this is a one person project. I can write patches for Arch and
I can keep the watcher running, but this needs to grow beyond one person
to cover every distro, every package manager, and every upstream project
that is being pressured to add identity collection to the stack.

If you know how pacman, apt, dnf, portage, or xbps works internally, I
need you. If you package for Debian, Fedora, Void, Gentoo, or anything
else, I need you. If you are a lawyer who understands AB 1043 or its
equivalents, I need you. If you just want to help watch upstream and
flag new threats, I need you.

Open an issue. Start a discussion. Tell me what you know. This project
is only as strong as the people who show up.

## What is happening

"Age verification" is not about age. It is a delivery mechanism for
identity infrastructure. Once your operating system stores your birth
date, that data can be collected, subpoenaed, sold, breached, and used
to build a profile of who you are and what you should be allowed to do.
Today they ask for your birthday. Tomorrow they know who you are.

California's AB 1043 (effective January 2027) requires operating systems
to provide real time age bracket APIs. Colorado and Brazil have similar
laws. In response, core open source projects have started adding this
infrastructure:

### Core infrastructure

| Project | What was added | Current state |
|---------|---------------|---------------|
| **systemd** | `birthDate` field in userdb user records, `--birth-date` flag in homectl | [PR #40954](https://github.com/systemd/systemd/pull/40954) merged to main. [Revert PR #41179](https://github.com/systemd/systemd/pull/41179) was closed, not merged. The code is still in the codebase. |
| **xdg-desktop-portal** | ParentalControls portal with `QueryAgeBracket` D-Bus method | [PR #1922](https://github.com/flatpak/xdg-desktop-portal/pull/1922) open, draft |
| **accountsservice** | `BirthDate` property with polkit-gated `GetBirthDate` and `SetBirthDate` methods | [MR #176](https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176) open |

### Distribution and desktop integrations

| Project | What was added | Current state |
|---------|---------------|---------------|
| **Calamares** | Birth date field in user creation, writes to AccountsService and systemd userdb | [PR #2499](https://codeberg.org/Calamares/calamares/pulls/2499) draft. European project (Netherlands) receiving US law compliance PRs from the same author as systemd PR. Used by Manjaro, EndeavourOS, Garuda, KDE neon. Thread locked after pushback. |
| **archinstall** | Required birth date field during user creation (same author as systemd PR) | [PR #4290](https://github.com/archlinux/archinstall/pull/4290) open |
| **elementary OS settings** | Age declaration UI in user account creation | [Issue #260](https://github.com/elementary/settings-useraccounts/issues/260), [PR #270](https://github.com/elementary/settings-useraccounts/pull/270) open. Author is the elementary OS founder. |
| **elementary OS portals** | Account portal exposing user information to applications | [Issue #173](https://github.com/elementary/portals/issues/173), [PR #180](https://github.com/elementary/portals/pull/180) open |
| **Ubuntu desktop provisioning** | birthDate in user provisioning, BirthDate written to AccountsService | [PR #1326](https://github.com/canonical/ubuntu-desktop-provision/pull/1326), [PR #1338](https://github.com/canonical/ubuntu-desktop-provision/pull/1338), [PR #1339](https://github.com/canonical/ubuntu-desktop-provision/pull/1339) all closed after backlash |
| **pacman** | `agerequirement` field in PKGBUILDs | [MR #353](https://gitlab.archlinux.org/pacman/pacman/-/merge_requests/353) satirical, from the pacman maintainer. We are watching for real attempts. |

### Reference implementations

| Project | What it does | Link |
|---------|-------------|------|
| **ageverifyd** | Reference daemon implementing `org.freedesktop.AgeVerification1` D-Bus interface. Stores age brackets, exposes `SetAge`, `SetDateOfBirth`, `GetAgeBracket` methods. | [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd) |

### Beyond Linux

| Project | What is happening | Link |
|---------|------------------|------|
| **MidnightBSD** | BSD-side implementation: DOB storage in installer, `aged`/`agectl` helper tools, package manager ACLs | [Mailing list post](https://lists.freedesktop.org/archives/xdg/2026-March/014777.html) |

## What freeport does

freeport is an overlay package repository. It takes the same packages
your distribution already ships, removes every piece of age verification
code, and gives you clean builds. Nothing else changes.

1. **Watches** upstream projects for new age verification code every 4
   hours, automated, across GitHub and Arch GitLab. Findings are posted
   to [issue #1](https://github.com/ryandward/freeport/issues/1)
   automatically by CI. Watch that issue to stay informed.
2. **Patches** affected packages to remove the age verification code
   without touching anything else
3. **Builds** clean packages identical to your distro's minus the
   surveillance infrastructure
4. **Verifies** that built packages contain zero age verification
   strings before publishing

## Preserving your toolchain

Patching individual packages is only half the problem. The package
manager itself could become a vector if maintainers are pressured to add
compliance checks at the distribution level. pacman, apt, dnf, and every
other package manager in the ecosystem needs to stay clean.

We are working on toolchain level protections but this is hard to get
right without breaking things. If you have ideas or experience with
package manager internals, open an issue.

## How to use it

### Arch Linux

Build the patched packages yourself:

```
git clone https://github.com/ryandward/freeport.git
cd freeport/distros/arch/systemd
makepkg -si
```

This builds systemd from the official Arch sources with the freeport
patch applied. The resulting package is a drop-in replacement for the
official one.

### Other distros

The repo is organized by distro. Each one gets its own packaging scripts
and patch sets:

```
distros/
  arch/
    systemd/
      PKGBUILD
      patches/
    xdg-desktop-portal/
      patches/
  debian/
  fedora/
  void/
```

If you package for another distro, open a PR. The patches are standard
unified diffs that apply to upstream source. The packaging around them
is distro-specific.

## What the patches do (and do not do)

Each patch is the minimum diff to remove age verification. Nothing more.

The systemd patch removes:

- The `birthDate` field from the user record struct
- The `--birth-date` flag from `homectl`
- The JSON dispatch, parsing, and display code for birth dates
- The pre-epoch date parsing path (only existed for birth dates)
- All associated test cases and documentation

It does **not** touch general date/time parsing, any other user record
fields, or any other systemd functionality.

## Contributing

- **Report a new package**: open an issue with a link to the upstream
  commit or PR
- **Add a distro**: create a directory under `distros/` with packaging
  scripts, open a PR
- **Write a patch**: write a removal patch, submit it

## Why

Every surveillance system in history started with something reasonable.
Age verification is the reasonable thing this time. But the
infrastructure it requires is not a parental control. It is a data
collection pipeline bolted onto the lowest layer of your computer.

The upstream projects know this. systemd merged a birthDate field and the
community forced a revert PR within days. But the revert was closed, not
merged. The field is still in the codebase. The legal pressure is not
going away, and the next attempt will be quieter.

If that data exists on your machine, it is one subpoena, one breach, or
one policy change away from being used against you. freeport exists to
make sure that data never exists in the first place.

## Related projects

- [AntiSurv/oss-anti-surveillance](https://github.com/AntiSurv/oss-anti-surveillance) --
  documentation project tracking every age verification implementation
  across the Linux stack. Good intelligence source, no patches.
- [BryanLunduke/DoesItAgeVerify](https://github.com/BryanLunduke/DoesItAgeVerify) --
  tracks which operating systems have implemented age verification.
  704 stars. Documentation only.
- [Ageless Linux](https://agelesslinux.org/) -- Debian based distro in
  deliberate noncompliance with AB 1043. Political statement, not a
  patch project.
- [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd) --
  reference implementation of the `org.freedesktop.AgeVerification1`
  D-Bus daemon. Know what you are fighting.

## License

MIT
