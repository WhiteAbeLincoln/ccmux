{
  description = "ccmux";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    crane.url = "github:ipetkov/crane";
    rust-overlay = {
      url = "github:oxalica/rust-overlay";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    crane,
    rust-overlay,
    flake-utils,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (
      system: let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [(import rust-overlay)];
        };

        rustToolchainFor = p:
          (p.rust-bin.fromRustupToolchainFile ./rust-toolchain.toml).override {
            extensions = ["rust-src"];
          };
        craneLib = (crane.mkLib pkgs).overrideToolchain rustToolchainFor;
        src = craneLib.cleanCargoSource ./.;

        commonArgs = {
          inherit src;
          strictDeps = true;
        };

        cargoArtifacts = craneLib.buildDepsOnly commonArgs;

        cclog-server = craneLib.buildPackage (commonArgs
          // {
            inherit cargoArtifacts;
          });

        rodney = pkgs.buildGoModule {
          pname = "rodney";
          version = "0.4.0";

          src = pkgs.fetchFromGitHub {
            owner = "simonw";
            repo = "rodney";
            rev = "9e7ae93900bcb5316d02623706bc8861feec836f";
            hash = "sha256-/iGsaMfK8zeUkTXwU63mAAb4VpsllG87EH8ycoFZs5k=";
          };

          vendorHash = "sha256-h4U43W3hLoF+p25/jNRaW8okeEzAZQEmKtwB5l4kGW4=";

          # Tests require a running Chrome instance
          doCheck = false;

          # Remove --single-process flag that crashes on macOS
          # https://github.com/simonw/rodney/issues/9
          postPatch = ''
            substituteInPlace main.go \
              --replace-fail 'Set("single-process").' ""
          '';
        };
      in {
        checks = {
          crate = cclog-server;

          clippy = craneLib.cargoClippy (commonArgs
            // {
              inherit cargoArtifacts;
              cargoClippyExtraArgs = "--all-targets -- --deny warnings";
            });

          fmt = craneLib.cargoFmt {
            inherit src;
          };

          tests = craneLib.cargoNextest (commonArgs
            // {
              inherit cargoArtifacts;
            });
        };

        packages.default = cclog-server;

        devShells.default = craneLib.devShell {
          checks = self.checks.${system};
          # TODO: move to the web-server app
          packages = [pkgs.bun rodney];
        };
      }
    );
}
