<p align="center">
  <img src="logo.svg" width="256" alt="freeport">
</p>

# freeport

**[https://ryandward.github.io/freeport](https://ryandward.github.io/freeport/)**

Linux is not a person. It does not have a birthday.

Linux runs server farms, HPC clusters, containers, CI pipelines,
embedded controllers, and network appliances. Somebody decided that
all of these machines need a `birthDate` field in their system
packages. We remove it.

## The problem

New legislation (California AB 1043, Colorado SB 26-051, Brazil Lei
15.211) requires operating systems to report user age brackets through
a real time API. In response, `birthDate` fields, D-Bus interfaces,
and installer prompts are being added to core open source packages
like systemd, accountsservice, and xdg-desktop-portal.

This code ships to every machine that installs these packages. Your
Kubernetes nodes get the same `birthDate` field as a laptop. The law
targets consumer operating systems but the code lands in
infrastructure.

## What we do

freeport patches individual packages to remove identity collection
fields, then rebuilds them. Your distro stays your distro. You swap
one package. Everything else is untouched.

We are not a fork. We do not maintain a parallel copy of systemd. We
carry the minimum diff to remove the identity fields, and we apply it
on top of whatever your distro ships.

Every 4 hours we scan upstream for new identity collection code across
GitHub, GitLab, and Codeberg. Findings go to
[issue #1](https://github.com/ryandward/freeport/issues/1). Built
packages are verified to contain zero identity collection strings
before publishing.

## Use it

### Arch Linux

```bash
sudo pacman-key --recv-keys B06E95AC8D45885FE6451B669D64B2DDC464B011 --keyserver keyserver.ubuntu.com
sudo pacman-key --lsign-key B06E95AC8D45885FE6451B669D64B2DDC464B011
```

Add to `/etc/pacman.conf` above `[core]`:

```ini
[freeport]
Server = https://github.com/ryandward/freeport/releases/download/repo
```

```bash
sudo pacman -Syu freeport-hook
```

`freeport-hook` scans every package before installation and blocks
anything containing identity collection code. When Arch ships a new
upstream version, freeport rebuilds it clean and publishes the update
through the same repo.

### Build from source

```bash
git clone https://github.com/ryandward/freeport.git
cd freeport/distros/arch/systemd
makepkg -si
```

### Other distros

Patches are standard unified diffs against upstream source. The
packaging around them is distro-specific. If you package for Debian,
Fedora, Void, Gentoo, or anything else, open a PR.

## What we are tracking

### Core packages

| Project | What was added | Status |
|---------|---------------|--------|
| **systemd** | `birthDate` in userdb records, `--birth-date` in homectl | [Merged](https://github.com/systemd/systemd/pull/40954). [Revert](https://github.com/systemd/systemd/pull/41179) was closed. |
| **xdg-desktop-portal** | `QueryAgeBracket` D-Bus method | [Draft](https://github.com/flatpak/xdg-desktop-portal/pull/1922) |
| **accountsservice** | `BirthDate` property with polkit-gated get/set | [Open](https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176) |

### Installers and desktops

| Project | What was added | Status |
|---------|---------------|--------|
| **Calamares** | Birth date field, writes to AccountsService and userdb | [Draft](https://codeberg.org/Calamares/calamares/pulls/2499). European project getting US compliance PRs. Locked. |
| **archinstall** | Required birth date during user creation | [Open](https://github.com/archlinux/archinstall/pull/4290) |
| **elementary OS** | Birth date UI and account portal | [Settings](https://github.com/elementary/settings-useraccounts/pull/270), [Portals](https://github.com/elementary/portals/pull/180) |
| **Ubuntu** | birthDate in desktop provisioning | [Closed](https://github.com/canonical/ubuntu-desktop-provision/pull/1326) after backlash |
| **ageverifyd** | Reference D-Bus daemon for `org.freedesktop.AgeVerification1` | [Repo](https://github.com/outerheaven199X/ageverifyd) |
| **MidnightBSD** | DOB in installer, `aged`/`agectl` tools | [Mailing list](https://lists.freedesktop.org/archives/xdg/2026-March/014777.html) |

## The systemd patch

The patch removes:

- `birthDate` field from the user record struct
- `--birth-date` flag from `homectl`
- JSON dispatch, parsing, and display code for birth dates
- Pre-epoch date parsing path (only existed for birth dates)
- Associated test cases and documentation

Nothing else is touched. No other user record fields, no general
date/time parsing, no other systemd functionality.

## Distros that have refused

- [Garuda Linux](https://linuxiac.com/garuda-linux-says-no-to-age-verification-outside-legal-requirement/)
  will not implement outside legal requirement
- Artix, Alpine, antiX are systemd-free
- Void Linux, Devuan, OpenBSD have stated opposition

## Help wanted

This is a one person project. I need people who know package manager
internals. I need people who package for distros other than Arch. I
need lawyers who understand AB 1043. I need people who want to watch
upstream and flag new threats.

Open an issue. Start a discussion.

## Related

- [AntiSurv/oss-anti-surveillance](https://github.com/AntiSurv/oss-anti-surveillance)
  tracks identity collection across the Linux stack. No patches.
- [BryanLunduke/DoesItAgeVerify](https://github.com/BryanLunduke/DoesItAgeVerify)
  tracks which operating systems have implemented identity collection.
- [Ageless Linux](https://agelesslinux.org/) is a Debian distro in
  deliberate noncompliance with AB 1043.
- [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd)
  reference `org.freedesktop.AgeVerification1` daemon.

## License

MIT
