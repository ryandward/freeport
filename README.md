<p align="center">
  <img src="logo.svg" width="256" alt="freeport">
</p>

# freeport

**freeport is not an operating system.** This matters because laws like
California's AB 1043 target "operating system distributors" and require
them to collect user ages and provide identity APIs. freeport is not
subject to those laws. We are a coalition of maintainers who believe your
computer shouldn't willingly hand over your most precious cargo, your
information, to analytics companies and the government. We maintain
patches. We share them freely. That is all we do.

"Age verification" is not about age. It is a delivery mechanism for
identity infrastructure. Once your operating system stores your birth date,
that data can be collected, subpoenaed, sold, breached, and used to build
a profile of who you are and what you should be allowed to do. Today they
ask for your birthday. Tomorrow they know who you are.

We strip that infrastructure out of Linux packages before it reaches your
system. If you maintain packages for any Linux distribution and you do not
want your users surveilled, you belong here.

freeport is an overlay package repository. It takes the same packages your
distribution already ships, removes every piece of age verification code,
and gives you clean builds. You add one line to your package manager config
and keep using your system exactly as before. Nothing else changes.

## What is happening

California's AB 1043 (effective January 2027) requires operating systems to
provide real time age bracket APIs. Colorado and Brazil have similar laws.

In response, core open source projects have started adding age verification
infrastructure:

| Project | What was added | Current state |
|---------|---------------|---------------|
| **systemd** | `birthDate` field in userdb user records, `--birth-date` flag in homectl, date parsing for pre-epoch birth dates | Merged to main, not yet in a stable release |
| **xdg-desktop-portal** | ParentalControls portal with `QueryAgeBracket` D-Bus method that reports user age ranges to applications | Draft PR #1922, not yet merged |
| **accountsservice** | Birth date storage in user account records | MR #176, in progress |
| **archinstall** | Required birth date field during user creation (by the same author as the systemd PR) | PR #4290, open |

freeport tracks all of these. When they ship in a release, we have patches
ready.

## What freeport does

1. **Watches** upstream projects for age verification code (every 4 hours,
   automated, across GitHub and Arch GitLab)
2. **Patches** affected packages to remove the age verification code without
   touching anything else
3. **Builds** clean packages that are identical to your distro's packages
   minus the surveillance infrastructure
4. **Verifies** that built packages contain zero age verification strings
   before publishing

## Preserving your toolchain

Patching individual packages is only half the problem. The other half is
making sure your package manager itself stays clean. pacman, apt, dnf,
and every other package manager in the ecosystem could become a vector for
age verification if maintainers are pressured to add compliance checks at
the distribution level.

We are working on toolchain level protections (pacman hooks, build
verification, install time scanning) but this is hard to get right without
breaking things. If you have ideas or experience with package manager
internals, open an issue. We need help thinking through this.

## How to use it

### Arch Linux

freeport is not yet hosting a live package repository. Right now you can
build the patched packages yourself:

```
git clone https://github.com/ryandward/freeport.git
cd freeport/distros/arch/systemd
makepkg -si
```

This builds systemd from the official Arch sources with the freeport patch
applied. The patch removes the birthDate field and all associated code. The
resulting package is a drop-in replacement for the official one.

When the package repo is live, usage will be:

```
# Add to /etc/pacman.conf above [core]:
[freeport]
SigLevel = Required
Server = https://pkg.freeport.dev/$arch

# Then update:
pacman -Syu
```

### Other distros

freeport is designed to support any distribution. The repo is organized by
distro, and each one gets its own packaging scripts and patch sets:

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

If you package for another distro, open a PR. The patches in `patches/` are
standard unified diffs that apply to upstream source. The packaging around
them is distro-specific.

## What the patches do (and do not do)

The systemd patch removes 11 files worth of age verification code:

- The `birthDate` field from the user record struct
- The `--birth-date` flag from `homectl`
- The JSON dispatch, parsing, and display code for birth dates
- The pre-epoch date parsing path (only existed for birth dates)
- All associated test cases and documentation

It does **not** touch:

- General date/time parsing (sysupdate "best before" markers still work)
- Any other user record fields (realName, email, location, etc)
- Any other systemd functionality

Each patch is the minimum diff to remove age verification. Nothing more.

## How we track upstream

An automated watcher runs every 4 hours and scans:

- **Targeted repos**: systemd, xdg-desktop-portal, accountsservice,
  archinstall, Ubuntu desktop provisioning, GNOME components, pacman
- **Specific contributors**: authors of previous age verification PRs
- **Broad search**: any PR on GitHub mentioning age verification + linux
- **Arch GitLab**: pacman and related projects

New findings are posted automatically to
[issue #1](https://github.com/ryandward/freeport/issues/1). These are
generated by CI, not written by hand. Watch that issue to get notified
the moment something moves upstream.

## I need your help

I am one person. I can write patches for Arch and I can keep the watcher
running, but I cannot do this alone across every distro, every package
manager, and every upstream project that is being pressured to add identity
collection to the stack.

If you know how pacman, apt, dnf, portage, or xbps works internally, I
need you. If you package for Debian, Fedora, Void, Gentoo, or anything
else, I need you. If you are a lawyer who understands AB 1043 or its
equivalents, I need you. If you just want to help watch upstream and
flag new threats, I need you.

Open an issue. Start a discussion. Tell me what you know. This project
is only as strong as the people who show up.

## Contributing

- **Report a new package**: if you find age verification code landing in a
  package we do not track, open an issue with a link to the upstream commit
  or PR
- **Add a distro**: create a directory under `distros/` with packaging
  scripts for your distribution, open a PR
- **Write a patch**: if a tracked package merges new age verification code,
  write a removal patch and submit it

## Why

Every surveillance system in history started with something reasonable.
Age verification is the reasonable thing this time. But the infrastructure
it requires (birth dates stored in system daemons, age bracket APIs
accessible to any application via D-Bus) is not a parental control. It is
a data collection pipeline bolted onto the lowest layer of your computer.

The upstream projects know this. systemd merged a birthDate field and the
community forced a revert PR within days. But the revert was closed, not
merged. The field is still in the codebase. The legal pressure is not going
away, and the next attempt will be quieter.

Your operating system should not be able to tell applications who you are.
If that data exists on your machine, it is one subpoena, one breach, or one
policy change away from being used against you.

freeport exists to make sure that data never exists in the first place.

## License

MIT
