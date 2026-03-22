use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::process::Command;

#[derive(Parser)]
#[command(name = "freeport")]
#[command(about = "Manage freeport patch sets and builds")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check upstream repos for age verification changes
    Watch,
    /// List tracked packages and their patch status
    Status,
    /// Build a package for a given distro
    Build {
        /// Target distro (e.g. arch, debian)
        distro: String,
        /// Package name
        package: String,
    },
    /// Attempt to rebase patches against a new upstream version
    Rebase {
        /// Target distro
        distro: String,
        /// Package name
        package: String,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Watch => watch(),
        Commands::Status => status(),
        Commands::Build { distro, package } => build(&distro, &package),
        Commands::Rebase { distro, package } => rebase(&distro, &package),
    }
}

fn repo_root() -> Result<PathBuf> {
    let output = Command::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .context("failed to find git root")?;
    let path = String::from_utf8(output.stdout)?.trim().to_string();
    Ok(PathBuf::from(path))
}

fn watch() -> Result<()> {
    let targets = [
        ("systemd/systemd", vec!["birthDate", "birth_date", "ageGroup", "age_group"]),
        ("flatpak/xdg-desktop-portal", vec!["age verification", "parental", "AgeVerification"]),
        ("freedesktop/accountsservice", vec!["birth", "age verification"]),
    ];

    println!("checking upstream repositories...\n");

    for (repo, keywords) in &targets {
        println!("  {repo}");
        for kw in keywords {
            let output = Command::new("gh")
                .args([
                    "api", "search/issues",
                    "-f", &format!("q=repo:{repo} is:pr {kw}"),
                    "-f", "sort=updated",
                    "-f", "per_page=5",
                    "--jq", ".items[] | \"    #\\(.number) [\\(.state)] \\(.title)\"",
                ])
                .output();

            match output {
                Ok(o) => {
                    let text = String::from_utf8_lossy(&o.stdout);
                    if !text.trim().is_empty() {
                        print!("{text}");
                    }
                }
                Err(e) => eprintln!("    error querying {repo}: {e}"),
            }
        }
        println!();
    }

    Ok(())
}

fn status() -> Result<()> {
    let root = repo_root()?;
    let distros_dir = root.join("distros");

    if !distros_dir.exists() {
        println!("no distros directory found");
        return Ok(());
    }

    for distro in std::fs::read_dir(&distros_dir)? {
        let distro = distro?;
        if !distro.file_type()?.is_dir() {
            continue;
        }
        let distro_name = distro.file_name();
        println!("{}:", distro_name.to_string_lossy());

        for pkg in std::fs::read_dir(distro.path())? {
            let pkg = pkg?;
            if !pkg.file_type()?.is_dir() {
                continue;
            }
            let pkg_name = pkg.file_name();
            let patches_dir = pkg.path().join("patches");
            let patch_count = if patches_dir.exists() {
                std::fs::read_dir(&patches_dir)?
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path()
                            .extension()
                            .is_some_and(|ext| ext == "patch" || ext == "diff")
                    })
                    .count()
            } else {
                0
            };

            let has_pkgbuild = pkg.path().join("PKGBUILD").exists();
            let build_ready = if has_pkgbuild { "ready" } else { "no build script" };

            println!(
                "  {}: {} patch(es), {build_ready}",
                pkg_name.to_string_lossy(),
                patch_count
            );
        }
    }

    Ok(())
}

fn build(distro: &str, package: &str) -> Result<()> {
    let root = repo_root()?;
    let pkg_dir = root.join("distros").join(distro).join(package);

    if !pkg_dir.exists() {
        anyhow::bail!("package directory not found: {}", pkg_dir.display());
    }

    match distro {
        "arch" => {
            println!("building {package} for arch...");
            let status = Command::new("makepkg")
                .args(["-s", "--noconfirm"])
                .current_dir(&pkg_dir)
                .status()
                .context("failed to run makepkg")?;

            if !status.success() {
                anyhow::bail!("makepkg failed with exit code {status}");
            }
            println!("build complete");
        }
        other => {
            anyhow::bail!("build not yet implemented for distro: {other}");
        }
    }

    Ok(())
}

fn rebase(distro: &str, package: &str) -> Result<()> {
    let root = repo_root()?;
    let patches_dir = root.join("distros").join(distro).join(package).join("patches");

    if !patches_dir.exists() {
        anyhow::bail!("patches directory not found: {}", patches_dir.display());
    }

    let patches: Vec<_> = std::fs::read_dir(&patches_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .is_some_and(|ext| ext == "patch" || ext == "diff")
        })
        .collect();

    if patches.is_empty() {
        println!("no patches to rebase for {distro}/{package}");
        return Ok(());
    }

    println!(
        "found {} patch(es) for {distro}/{package}",
        patches.len()
    );
    println!("rebase logic not yet implemented, run manually:");
    for p in &patches {
        println!("  patch -Np1 --dry-run < {}", p.path().display());
    }

    Ok(())
}
