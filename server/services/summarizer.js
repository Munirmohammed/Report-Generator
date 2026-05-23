const axios = require("axios");
require("dotenv").config();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const API_KEY = process.env.GEMINI_API_KEY;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function summarizeCommits(repoName, commits, retryCount = 0) {
  if (commits.length === 0) return null;

  const commitCount = commits.length;
  const minBullets = Math.max(commitCount - 1, 1);
  const commitMessages = commits.map((c, i) => `[${i + 1}] ${c.commit.message}`).join("\n\n");

  const prompt = `
    You are writing a detailed weekly engineering progress report for the project "${repoName}".

    There are ${commitCount} commits listed below. You MUST produce AT LEAST ${minBullets} bullet points — one per commit at minimum, only combining two if they are literally the same small fix.

    RULES (follow every one strictly):
    - PLAIN TEXT ONLY. No asterisks (*), no bold (**), no markdown headers (##).
    - Each bullet MUST be 2 to 4 sentences long. Never one sentence only.
    - In every bullet: name the SPECIFIC component, endpoint, module, library, algorithm, or database table involved. Never be vague.
    - Structure every bullet as: (1) what was built/changed, (2) how it technically works or what mechanism was used, (3) why it matters or what problem it solves.
    - DO NOT merge unrelated commits. If a commit touches authentication and another touches payments, those are two separate bullets.
    - DO NOT write filler phrases like "various improvements", "minor fixes", "code cleanup", or "general updates".
    - Start each bullet with a strong past-tense action verb: Implemented, Built, Introduced, Engineered, Designed, Developed, Deployed, Integrated, Refactored, Enforced, Migrated, Extended, Secured, Optimized, Automated, Established, etc.
    - STRICT FORMAT: header is exactly "Project Name: ${repoName}" and each item starts with "- ".

    Example of the required depth (one bullet shown):
    - Implemented a three-step customer registration flow integrated with the Ethiopian SMS gateway (ewdoapi.vas.et), introducing a custom E.164 phone number normalizer that auto-strips leading zeros and country-code prefixes to prevent duplicate accounts, and enforcing a bcrypt-hashed four-digit PIN as the second authentication factor during transaction creation.

    Commits to analyze (${commitCount} total — produce ${minBullets}+ bullets):
    ${commitMessages}

    Output:
    Project Name: ${repoName}
    - [Bullet 1 — 2-4 sentences]
    - [Bullet 2 — 2-4 sentences]
    ... (minimum ${minBullets} bullets, more is better)
  `;

  try {
    const response = await axios.post(GEMINI_API_URL, {
      contents: [{ parts: [{ text: prompt }] }]
    }, {
      headers: {
        'X-goog-api-key': API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const result = response.data.candidates[0].content.parts[0].text;
    // Strip any remaining asterisks just in case the AI includes them
    return result.replace(/\*+/g, '').trim();
  } catch (error) {
    if (error.response?.status === 503 && retryCount < 2) {
      console.log(`Gemini busy (503) for ${repoName}, retrying in 2s...`);
      await sleep(2000);
      return summarizeCommits(repoName, commits, retryCount + 1);
    }
    console.error("Gemini API Error:", error.response?.data || error.message);
    return `${repoName}:\n- (Error summarizing commits: ${error.message})`;
  }
}

module.exports = { summarizeCommits };
