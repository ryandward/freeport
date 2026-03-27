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

Identity collection infrastructure is being added to core Linux
packages. `systemd` now has a `birthDate` field in its user records.
Installers are being patched to collect date of birth during setup.
D-Bus interfaces are being proposed to expose this data to
applications.

This is not about parental controls. It is identity infrastructure
at the system level. Your server does not have a birthday. Your
build farm does not have a birthday. But if these fields ship in the
packages you install, the data pipeline exists whether you use it or
not. Once the field is there, it can be collected, subpoenaed, sold,
or breached.

The legal pressure is coming from California's AB 1043 (effective
January 2027), Colorado's SB 26-051, and Brazil's Lei 15.211. These
laws require operating systems to provide real time age bracket APIs.
In response, core open source projects have started adding this
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

freeport is not a fork. Forking systemd or any other core project is
not sustainable. Nobody is going to maintain a parallel copy of millions
of lines of code just to remove a handful of fields. Forks fall behind
upstream within days and die.

freeport patches individual packages. Your distro stays your distro.
Your package manager stays your package manager. You swap one package
with a clean rebuild and everything else is untouched. The patch is
the minimum diff needed to remove the identity collection code. That
is all that changes.

1. **Watches** upstream projects for new identity collection code every
   4 hours, automated, across GitHub and Arch GitLab. Findings are
   posted to [issue #1](https://github.com/ryandward/freeport/issues/1)
   automatically by CI. Watch that issue to stay informed.
2. **Patches** affected packages to remove identity collection fields
   without touching anything else
3. **Builds** clean packages identical to your distro's without the
   added identity infrastructure
4. **Verifies** that built packages contain zero identity collection
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

Add the freeport repo to pacman. Patched packages are signed and
published automatically whenever upstream ships a new version.

```bash
# import the freeport signing key
sudo pacman-key --recv-keys B06E95AC8D45885FE6451B669D64B2DDC464B011 --keyserver keyserver.ubuntu.com
sudo pacman-key --lsign-key B06E95AC8D45885FE6451B669D64B2DDC464B011
```

Add this to `/etc/pacman.conf` **above** `[core]` so freeport packages
take priority over the official ones:

```ini
[freeport]
Server = https://github.com/ryandward/freeport/releases/download/repo
```

Then update and install the protection hook:

```bash
sudo pacman -Syu freeport-hook
```

The `freeport-hook` package installs a pacman hook that scans every
package before it gets installed. If a package contains identity
collection code, the transaction is blocked and you get told about
it. This protects you even for packages freeport doesn't rebuild yet.

Patched packages replace the official ones automatically. When Arch
ships a new version, freeport rebuilds with the patch applied and
publishes the update. You get it through normal `pacman -Syu`.

### Build from source

If you prefer to build yourself:

```bash
git clone https://github.com/ryandward/freeport.git
cd freeport/distros/arch/systemd
makepkg -si
```

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

Each patch is the minimum diff to remove identity collection fields.
Nothing more.

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

These fields have no business in system-level packages. A headless
server, a container, a build machine, an embedded device. None of
these have a user who needs a birthday recorded. But the packages
ship the same code to every machine. If the field exists in the
binary, the collection capability is there whether you asked for it
or not.

The legal pressure is not going away. systemd merged the birthDate
field and the community forced a revert PR within days. But the
revert was closed, not merged. The field is still in the codebase.
The next attempt will be quieter.

freeport exists to make sure that data never exists on your machine
in the first place.

## Distros that have refused

- [Garuda Linux](https://linuxiac.com/garuda-linux-says-no-to-age-verification-outside-legal-requirement/)
  publicly stated they will not implement age verification outside legal
  requirement
- Artix, Alpine, antiX are systemd-free, not affected by the userdb change
- Void Linux, Devuan, OpenBSD have stated opposition

## Related projects

- [AntiSurv/oss-anti-surveillance](https://github.com/AntiSurv/oss-anti-surveillance)
  documentation project tracking every identity collection implementation
  across the Linux stack. Good intelligence source, no patches.
- [BryanLunduke/DoesItAgeVerify](https://github.com/BryanLunduke/DoesItAgeVerify)
  tracks which operating systems have implemented identity collection.
  Documentation only.
- [Ageless Linux](https://agelesslinux.org/) is a Debian based distro in
  deliberate noncompliance with AB 1043. Political statement, not a
  patch project.
- [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd)
  reference implementation of the `org.freedesktop.AgeVerification1`
  D-Bus daemon. Know what you are fighting.

## License

MIT
