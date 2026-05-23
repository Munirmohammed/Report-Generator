const axios = require("axios");
require("dotenv").config();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const API_KEY = process.env.GEMINI_API_KEY;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function summarizeCommits(repoName, commits, retryCount = 0) {
  if (commits.length === 0) return null;

  const commitMessages = commits.map(c => `- ${c.commit.message}`).join("\n");
  
  const prompt = `
    Analyze the following Git commit messages from the past week for the project "${repoName}" and synthesize them into a descriptive, professional bulleted list for a weekly progress report.
    
    Guidelines:
    - Use PLAIN TEXT ONLY. No markdown bold (**) or italics (*).
    - Focus on impact and specific technical/functional achievements.
    - Provide enough detail to understand what was improved or implemented (e.g., mention specific technologies, protocols, or security measures).
    - Each bullet should be a complete, meaningful sentence that explains the "how" or "why".
    - Group similar commits into single, comprehensive points.
    - Maintain a professional, executive summary style.
    - STRICT FORMAT: Use exactly "Project Name: [ProjectName]" as the header and "-" for bullets. Do not use asterisks (*), bold (**), or headers (##).
    
    Example Style:
    Project Name: Topup
    - Improved service reliability by implementing an automatic fallback to Ethiotelecom when an operator is not specified.
    - Enhanced authentication security and system stability by refining device verification and removing incomplete email notification logic.
    - Expanded payment management functionality with a new endpoint to delete default payment methods.

    Commits:
    ${commitMessages}
    
    Output Format:
    Project Name: ${repoName}
    - [Descriptive Bullet 1]
    - [Descriptive Bullet 2]
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
