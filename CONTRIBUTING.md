# Contributing to freeport

## Reporting a new package

If you find a package that has merged or is merging age verification
infrastructure, open an issue with:

1. The package name
2. A link to the upstream commit, PR, or merge request
3. Which distros ship the package

## Adding patches for an existing package

Each package lives under `distros/<distro>/<package>/patches/`. Patches should
be the minimum diff to remove age verification. Do not bundle unrelated changes.

Test your patches by building in a clean chroot before submitting.

For Arch:

```
makechrootpkg -c -r /var/lib/makechrootpkg
```

## Adding a new distro

Create a directory under `distros/` with the distro name. Include whatever
packaging scripts are standard for that distro (PKGBUILD for Arch, debian/
directory for Debian, spec file for Fedora, template for Void, etc).

Open a PR. Describe how you tested the build.

## Code style

There is no style guide yet. Write clearly. Do not over-engineer.
