<p align="center">
  <img src="logo.svg" width="256" alt="freeport">
</p>

# freeport

**[https://ryandward.github.io/freeport](https://ryandward.github.io/freeport/)**

**freeport is not an operating system.** It is a patching project.
Laws like California's AB 1043 target operating system distributors.
This is not one. Patches are maintained here and shared freely. That
is all this project does.

## What is happening

New laws in California (AB 1043), Colorado (SB 26-051), and Brazil
(Lei 15.211) require operating systems to provide real time age
bracket APIs. In response, identity collection fields are being added
to core Linux packages.

`systemd` now has a `birthDate` field baked into its user records.
Installers are being patched to collect date of birth during account
setup. D-Bus interfaces are being proposed to expose this data to
applications.

Linux is not a person. It is infrastructure. It runs server farms,
containers, HPC clusters, embedded controllers, CI pipelines, and
network appliances. None of these have a birthday. But the packages
ship the same code to every machine. If the field exists in the
binary, the collection capability is there whether you use it or not.

### Core infrastructure

| Project | What was added | Current state |
|---------|---------------|---------------|
| **systemd** | `birthDate` field in userdb user records, `--birth-date` flag in homectl | [PR #40954](https://github.com/systemd/systemd/pull/40954) merged to main. [Revert PR #41179](https://github.com/systemd/systemd/pull/41179) was closed, not merged. The code is still in the codebase. |
| **xdg-desktop-portal** | ParentalControls portal with `QueryAgeBracket` D-Bus method | [PR #1922](https://github.com/flatpak/xdg-desktop-portal/pull/1922) open, draft |
| **accountsservice** | `BirthDate` property with polkit-gated `GetBirthDate` and `SetBirthDate` methods | [MR #176](https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176) open |

### Distribution and desktop integrations

| Project | What was added | Current state |
|---------|---------------|---------------|
| **Calamares** | Birth date field in user creation, writes to AccountsService and systemd userdb | [PR #2499](https://codeberg.org/Calamares/calamares/pulls/2499) draft. European project (Netherlands) receiving US law compliance PRs. Used by Manjaro, EndeavourOS, Garuda, KDE neon. Thread locked after pushback. |
| **archinstall** | Required birth date field during user creation | [PR #4290](https://github.com/archlinux/archinstall/pull/4290) open |
| **elementary OS settings** | Birth date UI in account creation | [Issue #260](https://github.com/elementary/settings-useraccounts/issues/260), [PR #270](https://github.com/elementary/settings-useraccounts/pull/270) open |
| **elementary OS portals** | Account portal exposing user information to applications | [Issue #173](https://github.com/elementary/portals/issues/173), [PR #180](https://github.com/elementary/portals/pull/180) open |
| **Ubuntu desktop provisioning** | birthDate in user provisioning | [PR #1326](https://github.com/canonical/ubuntu-desktop-provision/pull/1326), [PR #1338](https://github.com/canonical/ubuntu-desktop-provision/pull/1338), [PR #1339](https://github.com/canonical/ubuntu-desktop-provision/pull/1339) all closed after backlash |
| **pacman** | `agerequirement` field in PKGBUILDs | [MR #353](https://gitlab.archlinux.org/pacman/pacman/-/merge_requests/353) satirical, from the pacman maintainer |

### Reference implementations

| Project | What it does | Link |
|---------|-------------|------|
| **ageverifyd** | Reference daemon implementing `org.freedesktop.AgeVerification1` D-Bus interface | [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd) |

### Beyond Linux

| Project | What is happening | Link |
|---------|------------------|------|
| **MidnightBSD** | DOB storage in installer, `aged`/`agectl` helper tools, package manager ACLs | [Mailing list post](https://lists.freedesktop.org/archives/xdg/2026-March/014777.html) |

## What freeport does

freeport is not a fork. Forking systemd is not sustainable. Nobody is
going to maintain a parallel copy of millions of lines of code to
remove a handful of fields.

freeport patches individual packages. Your distro stays your distro.
You swap one package with a clean rebuild and everything else is
untouched. The patch is the minimum diff needed to remove the identity
collection fields. That is all that changes.

1. **Watches** upstream projects for new identity collection code
   every 4 hours across GitHub, GitLab, and Codeberg. Findings are
   posted to [issue #1](https://github.com/ryandward/freeport/issues/1)
   automatically.
2. **Patches** affected packages to remove identity collection fields
   without touching anything else.
3. **Builds** clean packages identical to your distro's without the
   added identity infrastructure.
4. **Verifies** that built packages contain zero identity collection
   strings before publishing.

## How to use it

### Arch Linux

Add the freeport repo to pacman. Patched packages are signed and
published automatically whenever upstream ships a new version.

```bash
sudo pacman-key --recv-keys B06E95AC8D45885FE6451B669D64B2DDC464B011 --keyserver keyserver.ubuntu.com
sudo pacman-key --lsign-key B06E95AC8D45885FE6451B669D64B2DDC464B011
```

Add this to `/etc/pacman.conf` **above** `[core]` so freeport packages
take priority:

```ini
[freeport]
Server = https://github.com/ryandward/freeport/releases/download/repo
```

Then update and install the protection hook:

```bash
sudo pacman -Syu freeport-hook
```

`freeport-hook` is a pacman hook that scans every package before it
gets installed. If a package contains identity collection code, the
transaction is blocked. This protects you even for packages freeport
does not rebuild yet.

When Arch ships a new upstream version, freeport rebuilds it with
the patch applied and publishes the update. You get it through
normal `pacman -Syu`.

### Build from source

```bash
git clone https://github.com/ryandward/freeport.git
cd freeport/distros/arch/systemd
makepkg -si
```

### Other distros

The repo is organized by distro. Each one gets its own packaging
scripts and patch sets:

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

If you package for another distro, open a PR. The patches are
standard unified diffs that apply to upstream source. The packaging
around them is distro-specific.

## What the patches do (and do not do)

Each patch is the minimum diff to remove identity collection fields.
Nothing more.

The systemd patch removes:

- The `birthDate` field from the user record struct
- The `--birth-date` flag from `homectl`
- The JSON dispatch, parsing, and display code for birth dates
- The pre-epoch date parsing path (only existed for birth dates)
- All associated test cases and documentation

It does **not** touch general date/time parsing, any other user
record fields, or any other systemd functionality.

## Preserving your toolchain

Patching individual packages is only half the problem. The package
manager itself could become a vector if maintainers are pressured to
add compliance checks at the distribution level. pacman, apt, dnf,
and every other package manager in the ecosystem needs to stay clean.

If you have ideas or experience with package manager internals, open
an issue.

## I need your help

Right now this is a one person project. I can write patches for Arch
and I can keep the watcher running, but this needs to grow beyond one
person to cover every distro, every package manager, and every
upstream project that is being pressured to add identity collection
to the stack.

If you know how pacman, apt, dnf, portage, or xbps works internally,
I need you. If you package for Debian, Fedora, Void, Gentoo, or
anything else, I need you. If you are a lawyer who understands
AB 1043 or its equivalents, I need you. If you just want to help
watch upstream and flag new threats, I need you.

Open an issue. Start a discussion. Tell me what you know.

## Distros that have refused

- [Garuda Linux](https://linuxiac.com/garuda-linux-says-no-to-age-verification-outside-legal-requirement/)
  publicly stated they will not implement outside legal requirement
- Artix, Alpine, antiX are systemd-free, not affected by the userdb change
- Void Linux, Devuan, OpenBSD have stated opposition

## Related projects

- [AntiSurv/oss-anti-surveillance](https://github.com/AntiSurv/oss-anti-surveillance)
  tracks every identity collection implementation across the Linux
  stack. Good intelligence source, no patches.
- [BryanLunduke/DoesItAgeVerify](https://github.com/BryanLunduke/DoesItAgeVerify)
  tracks which operating systems have implemented identity collection.
  Documentation only.
- [Ageless Linux](https://agelesslinux.org/) is a Debian based distro
  in deliberate noncompliance with AB 1043. Political statement, not
  a patch project.
- [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd)
  reference implementation of the `org.freedesktop.AgeVerification1`
  D-Bus daemon. Know what you are fighting.

## License

MIT
