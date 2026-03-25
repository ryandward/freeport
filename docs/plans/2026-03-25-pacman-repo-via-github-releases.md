# Pacman Repo via GitHub Releases

**Goal:** Arch users add freeport to pacman.conf and get patched packages through `pacman -Syu`. When systemd v261 ships with the birthdate code, freeport's auto-rebuild patches it, signs it, and publishes it. No manual intervention.

**Architecture:** A pinned GitHub Release (tag: `repo`) holds the package files, signatures, and repo database. Pacman downloads directly from the release assets. This is how LizardByte and archzfs do it. The dashboard stays on GitHub Pages as-is, completely separate.

**Signing key:** `B06E95AC8D45885FE6451B669D64B2DDC464B011` (already on keyservers, secrets set in repo)

**pacman.conf entry:**
```ini
[freeport]
Server = https://github.com/ryandward/freeport/releases/download/repo
```

**Key constraints discovered during review:**
- Pacman fetches `freeport.db`, not `freeport.db.tar.gz`. `repo-add` creates `freeport.db` as a symlink. GitHub Releases can't host symlinks. Must dereference symlinks into real file copies before uploading.
- CI produces `.pkg.tar.zst` files (Arch default). Globs must not assume `.xz`.
- `gh` CLI is not in `archlinux:latest`. Must install `github-cli` explicitly.
- Passphrase must be piped via stdin (`--passphrase-fd 0`), not interpolated into shell strings.
- Both build workflows can run concurrently. Need a `concurrency` group to prevent race conditions on the release.

---

### Task 1: Recreate the GitHub Release

The previous release was deleted. Recreate it from the locally signed packages.

**Precondition:** Signed packages exist at `/tmp/freeport-repo/`.

- [ ] **Step 1: Verify local packages and signatures exist**

```bash
ls /tmp/freeport-repo/*.pkg.tar.xz /tmp/freeport-repo/*.sig /tmp/freeport-repo/freeport.db.tar.gz
```

- [ ] **Step 2: Dereference symlinks (GitHub Releases can't host them)**

```bash
cd /tmp/freeport-repo
for link in freeport.db freeport.files freeport.db.sig freeport.files.sig; do
  if [ -L "$link" ]; then
    target=$(readlink "$link")
    rm "$link"
    cp "$target" "$link"
  fi
done
```

- [ ] **Step 3: Create the release and upload all files**

```bash
cd /tmp/freeport-repo
gh release create repo \
  freeport.db freeport.db.sig \
  freeport.db.tar.gz freeport.db.tar.gz.sig \
  freeport.files freeport.files.sig \
  freeport.files.tar.gz freeport.files.tar.gz.sig \
  *.pkg.tar.xz *.pkg.tar.xz.sig \
  --repo ryandward/freeport \
  --title "freeport pacman repository" \
  --notes "Signed Arch packages with age verification code removed. See README for setup." \
  --latest=false
```

- [ ] **Step 4: Verify pacman's actual request URL works**

```bash
curl -fIL https://github.com/ryandward/freeport/releases/download/repo/freeport.db
```

Expected: HTTP 200 (this is what pacman fetches, not freeport.db.tar.gz).

---

### Task 2: Rewrite build-arch.yml

Replace the broken publish step with one that actually works. Also fix missing dependencies and add concurrency control.

**Files:**
- Modify: `.github/workflows/build-arch.yml`

- [ ] **Step 1: Add `github-cli` to build dependencies**

```yaml
      - name: install build dependencies
        run: |
          pacman -Syu --noconfirm base-devel devtools git github-cli
```

- [ ] **Step 2: Add concurrency group**

At the job level:
```yaml
concurrency:
  group: freeport-repo-publish
  cancel-in-progress: false
```

- [ ] **Step 3: Replace the "sign packages and publish repo" step**

```yaml
      - name: sign packages and publish repo
        shell: bash
        env:
          GPG_PASSPHRASE: ${{ secrets.GPG_PASSPHRASE }}
          GPG_PRIVATE_KEY: ${{ secrets.GPG_PRIVATE_KEY }}
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # import freeport signing key into builder's keyring
          echo "$GPG_PRIVATE_KEY" | su builder -c "gpg --batch --import"

          pkg="distros/arch/${{ inputs.package }}"
          mkdir -p /tmp/repo

          # collect built packages, skip .sig files
          for f in ${pkg}/*.pkg.tar.*; do
            case "$f" in *.sig) continue ;; esac
            [ -f "$f" ] && cp "$f" /tmp/repo/
          done

          chown -R builder:builder /tmp/repo
          cd /tmp/repo

          # sign each package
          for f in *.pkg.tar.*; do
            [ -f "$f" ] || continue
            echo "$GPG_PASSPHRASE" | su builder -c \
              "gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --detach-sign '$f'"
          done

          # fetch existing database so repo-add appends rather than replacing
          gh release download repo -p "freeport.db.tar.gz" -p "freeport.files.tar.gz" \
            --repo ryandward/freeport --dir . 2>/dev/null || true

          # build repo database (unsigned, we sign manually)
          # remove .sig files first so repo-add doesn't choke on them
          mkdir -p /tmp/sigs
          mv *.sig /tmp/sigs/ 2>/dev/null || true
          su builder -c "repo-add freeport.db.tar.gz *.pkg.tar.*"
          mv /tmp/sigs/*.sig . 2>/dev/null || true

          # sign the database files
          for db in freeport.db.tar.gz freeport.files.tar.gz; do
            [ -f "$db" ] || continue
            echo "$GPG_PASSPHRASE" | su builder -c \
              "gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --detach-sign '$db'"
          done

          # dereference symlinks (GitHub Releases can't host them)
          for link in freeport.db freeport.files; do
            if [ -L "$link" ]; then
              target=$(readlink "$link")
              rm "$link"
              cp "$target" "$link"
            fi
            # also copy the .sig for the dereferenced name
            if [ -f "${link}.tar.gz.sig" ] && [ ! -f "${link}.sig" ]; then
              cp "${link}.tar.gz.sig" "${link}.sig"
            fi
          done

          # upload everything to the release
          for f in *; do
            [ -f "$f" ] || continue
            gh release upload repo "$f" --repo ryandward/freeport --clobber
          done
```

- [ ] **Step 4: Remove the artifact upload step** (the release is the artifact now)

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/build-arch.yml
git commit -m "build-arch: fix signing, publish to GitHub Releases properly"
```

---

### Task 3: Rewrite auto-rebuild.yml

Same fixes as Task 2, adapted for multiple packages.

**Files:**
- Modify: `.github/workflows/auto-rebuild.yml`

- [ ] **Step 1: Add `github-cli` to tool install**

```bash
pacman -S --noconfirm --needed base-devel devtools git jq github-cli
```

- [ ] **Step 2: Add concurrency group**

```yaml
concurrency:
  group: freeport-repo-publish
  cancel-in-progress: false
```

- [ ] **Step 3: Replace the publish step**

Same logic as Task 2 Step 3 with two differences: collect packages from all tracked dirs, and import GPG key + download existing database.

```bash
# import freeport signing key into builder's keyring
echo "$GPG_PRIVATE_KEY" | su builder -c "gpg --batch --import"

# collect packages from all tracked dirs
for pkg in $TRACKED_PACKAGES; do
  for f in distros/arch/${pkg}/*.pkg.tar.*; do
    case "$f" in *.sig) continue ;; esac
    [ -f "$f" ] && cp "$f" /tmp/repo/
  done
done

# fetch existing database so repo-add appends
gh release download repo -p "freeport.db.tar.gz" -p "freeport.files.tar.gz" \
  --repo ryandward/freeport --dir /tmp/repo 2>/dev/null || true
```

Rest of signing, repo-add, symlink dereferencing, and upload is identical to Task 2.

- [ ] **Step 4: Commit**

---

### Task 4: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Verify the Server URL is correct**

Should be:
```
Server = https://github.com/ryandward/freeport/releases/download/repo
```

Check with: `grep "Server =" README.md`

- [ ] **Step 2: Update if needed, commit**

---

### Task 5: Test end-to-end

- [ ] **Step 1: Verify pacman can fetch the database (using the URL pacman actually requests)**

```bash
curl -fL https://github.com/ryandward/freeport/releases/download/repo/freeport.db -o /tmp/test-freeport.db
file /tmp/test-freeport.db
```

Expected: gzip compressed data (it's a tar.gz despite the name).

- [ ] **Step 2: Verify signature**

```bash
curl -fL https://github.com/ryandward/freeport/releases/download/repo/freeport.db.sig -o /tmp/test-freeport.db.sig
gpg --verify /tmp/test-freeport.db.sig /tmp/test-freeport.db
```

Expected: Good signature from B06E95AC8D45885FE6451B669D64B2DDC464B011.

- [ ] **Step 3: Test pacman sync**

Add to `/etc/pacman.conf` above `[core]`:
```ini
[freeport]
Server = https://github.com/ryandward/freeport/releases/download/repo
```

```bash
sudo pacman -Sy
pacman -Sl freeport
```

Expected: Lists systemd packages from freeport repo.

- [ ] **Step 4: Trigger a CI build and verify it publishes**

```bash
gh workflow run build-arch.yml -f package=systemd
# wait for completion
gh release view repo --json assets --jq '.assets[].name'
```

Expected: All steps green. Release assets include freeport.db, freeport.db.sig, freeport.db.tar.gz, freeport.db.tar.gz.sig, freeport.files, freeport.files.sig, all package files and their signatures.

- [ ] **Step 5: Verify dashboard is unaffected**

```bash
curl -fI https://ryandward.github.io/freeport/
```

Expected: HTTP 200. Dashboard unchanged.
