<p align="center">
  <img src="logo.svg" width="256" alt="freeport">
</p>

# freeport

**[https://ryandward.github.io/freeport](https://ryandward.github.io/freeport/)**

Linux is not a person. It does not have a birthday.

Asking your operating system to store a birth date is like asking a
bridge to carry a passport. Linux runs server farms, HPC clusters,
containers, CI pipelines, embedded controllers, and network
appliances. Somebody decided that all of these machines need a
`birthDate` field in their system packages. freeport keeps track of
who.

## The problem

Legislation in multiple US states and Brazil requires operating
systems to collect user birth dates and expose age brackets through
a real time API. In response, `birthDate` fields, D-Bus interfaces,
and installer prompts are being added to core open source packages
like systemd, accountsservice, and xdg-desktop-portal.

| State | Bill | Status |
|-------|------|--------|
| California | AB 1043 | Enacted, effective Jan 1, 2027 |
| Colorado | SB 26-051 | Passed Senate, in House committee |
| Louisiana | HB 570 | Enacted, effective July 1, 2026 |
| Utah | SB 142 | Enacted |
| New York | S8102A | Pending |
| Illinois | HB 3304, HB 4140, SB 2037 | Pending |
| Federal | KOSA, ASAA | Pending |
| Brazil | Lei 15.211 | Enacted |

These bills share a common template (the ICMEC "Digital Age Assurance
Act") and none contain exemptions for open source, non-commercial
software, or infrastructure deployments. The [TBOTE Project](https://www.reddit.com/r/linux/comments/1rtd51g/update_i_pulled_irs_filings_for_the_org_that/)
has documented through IRS filings, Senate lobbying disclosures, and
state ethics records that Meta funded the advocacy group pushing these
bills nationally while writing the legislation to exclude social media
platforms from its own requirements.
([findings repo](https://github.com/upper-up/meta-lobbying-and-other-findings))

This code ships to every machine that installs these packages. Your
Kubernetes nodes get the same `birthDate` field as a laptop. The law
targets consumer operating systems but the code lands in
infrastructure.

## What we do

freeport tracks the politics, the projects, the money, and the people
behind identity collection code in Linux.

Every 4 hours we scan upstream for new identity collection code across
GitHub, GitLab, and Codeberg. Findings go to
[issue #1](https://github.com/ryandward/freeport/issues/1).

## The pacman repo is gone

freeport used to publish patched Arch packages through a pacman repo.
That is over and the repo has been taken down.

Not all of those packages were clean. The patch stopped applying at
systemd 261, the nightly rebuild skipped it without failing, and
nothing checked the result. Every systemd build from 261-1 on, from
late June through October 4, shipped with the `birthDate` code still
in it. The 260 builds were patched. `freeport-hook` never worked
either. It did not inspect the packages it claimed to scan.

If you added the repo, delete the `[freeport]` section from
`/etc/pacman.conf`, then:

```bash
sudo pacman -R freeport-hook
sudo pacman-key --delete B06E95AC8D45885FE6451B669D64B2DDC464B011
sudo pacman -Syu $(pacman -Qqn | grep '^systemd')
```

The last line puts you back on Arch's own systemd build.

The [patch](https://github.com/ryandward/freeport/blob/20e949f85048d81dd5a2aa9ccb0a3286ae550ac2/distros/arch/systemd/patches/0001-revert-birthdate-userdb.patch)
is still in the git history. It applies up to systemd 260.2.

## What we are tracking

### Core packages

| Project | What was added | Status |
|---------|---------------|--------|
| **systemd** | `birthDate` in userdb records, `--birth-date` in homectl | [Merged](https://github.com/systemd/systemd/pull/40954). [Revert](https://github.com/systemd/systemd/pull/41179) was closed. |
| **xdg-desktop-portal** | `QueryAgeBracket` D-Bus method | [Draft](https://github.com/flatpak/xdg-desktop-portal/pull/1922) |
| **xdg-specs** | Age verification signal specification | [Closed](https://gitlab.freedesktop.org/xdg/xdg-specs/-/merge_requests/113) after community pushback |
| **accountsservice** | `BirthDate` property with polkit-gated get/set | [Open](https://gitlab.freedesktop.org/accountsservice/accountsservice/-/merge_requests/176) |
| **Ubuntu D-Bus proposal** | `org.freedesktop.AgeVerification1` with SetAge, SetDateOfBirth, GetAgeBracket | [Proposed](https://lists.ubuntu.com/archives/ubuntu-devel/2026-March/043510.html) on ubuntu-devel. Technical blueprint for distro compliance. |

### Installers and desktops

| Project | What was added | Status |
|---------|---------------|--------|
| **Calamares** | Birth date field, writes to AccountsService and userdb | [Draft](https://codeberg.org/Calamares/calamares/pulls/2499). European project getting US compliance PRs. Locked. |
| **archinstall** | Required birth date during user creation | [Open](https://github.com/archlinux/archinstall/pull/4290) |
| **elementary OS** | Birth date UI and account portal | [Settings](https://github.com/elementary/settings-useraccounts/pull/270), [Portals](https://github.com/elementary/portals/pull/180) |
| **Ubuntu** | birthDate in desktop provisioning | [Closed](https://github.com/canonical/ubuntu-desktop-provision/pull/1326) after backlash |
| **ageverifyd** | Reference D-Bus daemon for `org.freedesktop.AgeVerification1` | [Repo](https://github.com/outerheaven199X/ageverifyd) |
| **MidnightBSD** | DOB in installer, `aged`/`agectl` tools | [Mailing list](https://lists.freedesktop.org/archives/xdg/2026-March/014777.html) |

## Distro responses

**Complying:** Fedora (project leader [confirmed compliance](https://lunduke.substack.com/p/slackware-says-no-to-age-verification)),
Ubuntu (reviewing with legal), elementary OS (following Ubuntu),
Pop!_OS (considering minimal changes)

**Refusing:** Slackware, Garuda Linux, Adenix, Omarchy,
MidnightBSD (banned CA residents from desktop use)

**Systemd-free (not affected):** Artix, Alpine, antiX, Void, Devuan

**Silent:** Arch, SUSE, NixOS, Linux Mint

## Help wanted

This is a one person project. I need lawyers who understand AB 1043.
I need people who want to watch upstream and flag new threats.

Open an issue. Start a discussion.

## Related

- [TBOTE Project](https://www.reddit.com/r/linux/comments/1rtd51g/update_i_pulled_irs_filings_for_the_org_that/)
  pulled IRS 990s, Senate lobbying disclosures, state ethics records,
  and campaign finance data to document the lobbying operation behind
  these bills.
  [Findings repo](https://github.com/upper-up/meta-lobbying-and-other-findings).
- [AntiSurv/oss-anti-surveillance](https://github.com/AntiSurv/oss-anti-surveillance)
  tracks identity collection across the Linux stack.
- [BryanLunduke/DoesItAgeVerify](https://github.com/BryanLunduke/DoesItAgeVerify)
  tracks which operating systems have implemented identity collection.
- [Ageless Linux](https://agelesslinux.org/) is a Debian distro in
  deliberate noncompliance with AB 1043.
- [outerheaven199X/ageverifyd](https://github.com/outerheaven199X/ageverifyd)
  reference `org.freedesktop.AgeVerification1` daemon.

## License

MIT
