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

The bills, and where each one stands, are on the
[tracker](https://ryandward.github.io/freeport/#laws).

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

Every 4 hours we check every change we track against GitHub, GitLab,
and Codeberg, and record what moved. The result is the
[tracker](https://ryandward.github.io/freeport/).

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

Everything we track is a small file under [`data/`](data/): one per
project, one per change proposed to a project, and one per bill. The
[tracker](https://ryandward.github.io/freeport/) is built from those
files. To add something, see [CONTRIBUTING.md](CONTRIBUTING.md).

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
