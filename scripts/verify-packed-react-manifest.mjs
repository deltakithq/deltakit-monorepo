import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const reactPackageDir = path.join(repoRoot, "packages", "react");
const reactManifestPath = path.join(reactPackageDir, "package.json");

const reactManifest = JSON.parse(readFileSync(reactManifestPath, "utf8"));
const sourceSpecifier = reactManifest.dependencies?.["@deltakit/core"];

if (!sourceSpecifier) {
	throw new Error("packages/react/package.json is missing @deltakit/core");
}

if (!sourceSpecifier.startsWith("workspace:")) {
	throw new Error(
		`Expected @deltakit/core to use workspace: protocol, got "${sourceSpecifier}"`,
	);
}

const expectedPackedSpecifier = sourceSpecifier.slice("workspace:".length);
const tempDir = mkdtempSync(path.join(tmpdir(), "deltakit-react-pack-"));

try {
	execFileSync("pnpm", ["pack", "--pack-destination", tempDir], {
		cwd: reactPackageDir,
		stdio: "pipe",
	});

	const tarballName = readdirSync(tempDir).find((entry) => entry.endsWith(".tgz"));

	if (!tarballName) {
		throw new Error("pnpm pack did not create a tarball");
	}

	const packedManifestRaw = execFileSync(
		"tar",
		["-xOf", path.join(tempDir, tarballName), "package/package.json"],
		{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
	);
	const packedManifest = JSON.parse(packedManifestRaw);
	const packedSpecifier = packedManifest.dependencies?.["@deltakit/core"];

	if (packedSpecifier !== expectedPackedSpecifier) {
		throw new Error(
			[
				"Packed @deltakit/react manifest has the wrong @deltakit/core dependency.",
				`Expected: ${expectedPackedSpecifier}`,
				`Received: ${packedSpecifier ?? "(missing)"}`,
			].join("\n"),
		);
	}

	if (String(packedSpecifier).startsWith("workspace:")) {
		throw new Error(
			`Packed manifest still contains a workspace protocol dependency: ${packedSpecifier}`,
		);
	}

	console.log(
		`Verified packed @deltakit/react manifest: @deltakit/core -> ${packedSpecifier}`,
	);
} finally {
	rmSync(tempDir, { force: true, recursive: true });
}
