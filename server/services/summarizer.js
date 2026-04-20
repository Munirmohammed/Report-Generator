const axios = require("axios");
require("dotenv").config();

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent";
const API_KEY = process.env.GEMINI_API_KEY;

async function summarizeCommits(repoName, commits) {
  if (commits.length === 0) return null;

  const commitMessages = commits.map(c => `- ${c.commit.message}`).join("\n");
  
    const prompt = `
    Analyze the following Git commit messages from the past week for the project "${repoName}" and synthesize them into a concise, professional bulleted list for a weekly progress report.
    
    Guidelines:
    - Use PLAIN TEXT ONLY. No markdown bold (**) or italics (*).
    - Focus on impact and what the work achieved.
    - Group similar commits.
    - Use a professional, executive summary style.
    - Output format:
      Project Name:
      - bullet 1
      - bullet 2
    
    Commits:
    ${commitMessages}
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
    console.error("Gemini API Error:", error.response?.data || error.message);
    return `${repoName}:\n- (Error summarizing commits: ${error.message})`;
  }
}

module.exports = { summarizeCommits };
