// CI supplies the version from package.json after checking driver.json.
const { GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: event, GITHUB_REF: ref, GITHUB_SHA: sha, IMAGE_VERSION: version } = process.env;
const fail = (message) => {
  console.error(message);
  process.exit(1);
};
if (!repository || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(repository)) fail("Invalid repository");
const image = `ghcr.io/${repository.toLowerCase()}`;
if (event === "push" && ref?.startsWith("refs/tags/v")) {
  const tag = ref.slice("refs/tags/v".length);
  // Deliberately exclude build metadata (+ is not a valid Docker tag character).
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/.test(tag) || tag !== version) fail("Release tag must match package.json version (without build metadata)");
  console.log(`${image}:${tag}`);
  if (!tag.includes("-")) console.log(`${image}:latest`);
} else if (event === "workflow_dispatch" && ref?.startsWith("refs/heads/") && /^[a-f0-9]{12,40}$/.test(sha || "")) {
  // The workflow additionally restricts manual publishing to the default branch.
  console.log(`${image}:dev-${sha.slice(0, 12)}`);
} else {
  fail("This event/ref is not allowed to publish");
}
