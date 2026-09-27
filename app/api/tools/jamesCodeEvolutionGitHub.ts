type EvolutionFile = { path: string; content: string };
type ApplyInput = { proposalId?: string | null; files: EvolutionFile[]; goal: string };

function token() {
  const value = process.env.GITHUB_TOKEN;
  if (!value) throw new Error("GITHUB_TOKEN belum dikonfigurasi di server.");
  return value;
}

function repository() {
  return process.env.GITHUB_REPOSITORY || "jameshanah007-blip/ruangkita-ai";
}

function branchName() {
  return "james/evolution-" + Date.now().toString(36);
}

async function github(path: string, init?: RequestInit) {
  const response = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      Authorization: "Bearer " + token(),
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) {
    throw new Error("GitHub API " + response.status + ": " + (data?.message || text.slice(0, 500)));
  }
  return data;
}

export async function createJamesEvolutionPullRequest(input: ApplyInput) {
  const repo = repository();
  const branch = branchName();
  const [owner, name] = repo.split("/");
  if (!owner || !name) throw new Error("GITHUB_REPOSITORY tidak valid.");

  const ref = await github("/repos/" + owner + "/" + name + "/git/ref/heads/main");
  const baseSha = ref.object?.sha;
  if (!baseSha) throw new Error("SHA branch main tidak ditemukan.");

  await github("/repos/" + owner + "/" + name + "/git/refs", {
    method: "POST",
    body: JSON.stringify({ ref: "refs/heads/" + branch, sha: baseSha }),
  });

  const changed: Array<{ path: string; commitSha: string }> = [];

  try {
    for (const file of input.files) {
      const apiPath = encodeURIComponent(file.path).replace(/%2F/g, "/");
      const existing = await github(
        "/repos/" + owner + "/" + name + "/contents/" + apiPath + "?ref=" + encodeURIComponent(branch)
      );

      const result = await github(
        "/repos/" + owner + "/" + name + "/contents/" + apiPath,
        {
          method: "PUT",
          body: JSON.stringify({
            message: "feat: James evolution - " + input.goal.slice(0, 80),
            content: Buffer.from(file.content, "utf8").toString("base64"),
            branch,
            sha: existing.sha,
          }),
        }
      );

      changed.push({ path: file.path, commitSha: result.commit?.sha || "" });
    }

    const pr = await github("/repos/" + owner + "/" + name + "/pulls", {
      method: "POST",
      body: JSON.stringify({
        title: "James Evolution: " + input.goal.slice(0, 90),
        head: branch,
        base: "main",
        draft: true,
        body: [
          "## James Code Evolution",
          "",
          "Proposal ID: " + (input.proposalId || "n/a"),
          "",
          "James generated this change from a verified Omanto evolution request.",
          "",
          "### Safety",
          "- Draft PR only; never auto-merges into main.",
          "- CI must pass before review.",
          "- Changes are restricted to the approved evolution proposal.",
          "",
          "### Changed files",
          ...changed.map((item) => "- " + item.path),
        ].join("\n"),
      }),
    });

    return {
      branch,
      pullRequestNumber: pr.number,
      pullRequestUrl: pr.html_url,
      changed,
    };
  } catch (error) {
    try {
      await github("/repos/" + owner + "/" + name + "/git/refs/heads/" + encodeURIComponent(branch), {
        method: "DELETE",
      });
    } catch {}
    throw error;
  }
}
