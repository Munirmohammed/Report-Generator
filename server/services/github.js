const { Octokit } = require("octokit");
require("dotenv").config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getCommits(owner, repo, since, until) {
  try {
    console.log(`Checking activity for ${repo}...`);
    
    // 1. Identify active branches via events
    const events = await octokit.paginate("GET /repos/{owner}/{repo}/events", {
      owner,
      repo,
      per_page: 100
    });

    const activeBranches = new Set();
    const startDate = new Date(since);
    const endDate = new Date(until);

    for (const event of events) {
      const eventDate = new Date(event.created_at);
      if (eventDate >= startDate && eventDate <= endDate) {
        if (event.type === "PushEvent") {
          const branch = event.payload.ref.replace("refs/heads/", "");
          activeBranches.add(branch);
        }
      } else if (eventDate < startDate) {
        // Events are ordered by date (newest first), so we can stop once we pass the date range
        break;
      }
    }

    // Always check the default branch as a baseline, and add any active branches found
    // To get the default branch, we can quickly fetch repo details if needed, 
    // but typically we can just add 'main' or 'master' if activeBranches is empty.
    // Or better, if activeBranches is empty, we still try the default branch commits.
    if (activeBranches.size === 0) {
      // If no push events, just check the default branch for any commits in range
      // (sometimes events might be sparse or not captured for certain actions)
      activeBranches.add(undefined); // undefined sha means default branch
    }

    const uniqueCommits = new Map();

    // 2. Fetch commits for each active branch
    for (const sha of activeBranches) {
      const commits = await octokit.paginate("GET /repos/{owner}/{repo}/commits", {
        owner,
        repo,
        sha,
        since,
        until,
        author: process.env.GITHUB_USERNAME,
      });

      for (const commit of commits) {
        if (!uniqueCommits.has(commit.sha)) {
          uniqueCommits.set(commit.sha, commit);
        }
      }
    }

    return Array.from(uniqueCommits.values());
  } catch (error) {
    console.error(`Error fetching commits for ${repo}:`, error.message);
    return [];
  }
}

async function listAllRepos() {
  try {
    // Use paginate to get ALL repositories
    const repos = await octokit.paginate("GET /user/repos", {
      visibility: "all",
      affiliation: "owner,collaborator",
      sort: "updated",
      per_page: 100
    });
    return repos.map(r => ({ name: r.name, owner: r.owner.login }));
  } catch (error) {
    console.error("Error listing repos:", error.message);
    return [];
  }
}

module.exports = { getCommits, listAllRepos };
