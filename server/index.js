const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cron = require("node-cron");
const { getCommits, listAllRepos } = require("./services/github");
const { summarizeCommits } = require("./services/summarizer");
const { sendReportEmail } = require("./services/email");
const { getDb, saveDb } = require("./services/db");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// REPO ROUTES
app.get("/api/repos", (req, res) => {
  const db = getDb();
  res.json(db.repos);
});

app.post("/api/repos", (req, res) => {
  const { name, owner } = req.body;
  const db = getDb();
  if (db.repos.find(r => r.name === name)) {
    return res.status(400).json({ error: "Repo already exists" });
  }
  db.repos.push({ name, owner });
  saveDb(db);
  res.json(db.repos);
});

app.delete("/api/repos/:name", (req, res) => {
  const db = getDb();
  db.repos = db.repos.filter(r => r.name !== req.params.name);
  saveDb(db);
  res.json(db.repos);
});

app.get("/api/github/repos", async (req, res) => {
  const repos = await listAllRepos();
  res.json(repos);
});

// REPORT ROUTES
app.get("/api/reports", (req, res) => {
  const db = getDb();
  res.json(db.reports);
});

app.get("/api/reports/latest-draft", (req, res) => {
  const db = getDb();
  const draft = db.reports.find(r => r.status === "draft");
  res.json(draft || null);
});

async function generateFullReport(startDate, endDate) {
  const db = getDb();
  const since = new Date(startDate).toISOString();
  const until = new Date(endDate).toISOString();

  let combinedReport = "";
  for (const repo of db.repos) {
    const commits = await getCommits(repo.owner, repo.name, since, until);
    if (commits.length > 0) {
      const summary = await summarizeCommits(repo.name, commits);
      if (summary) {
        combinedReport += summary + "\n\n";
      }
    }
  }

  return combinedReport.trim() || "No activity found for the selected period.";
}

app.post("/api/reports/generate", async (req, res) => {
  const { startDate, endDate } = req.body;
  try {
    const content = await generateFullReport(startDate, endDate);
    const db = getDb();
    const newReport = {
      id: Date.now(),
      content,
      status: "draft",
      startDate,
      endDate,
      createdAt: new Date().toISOString(),
    };
    
    // Replace old draft if exists
    db.reports = db.reports.filter(r => r.status !== "draft");
    db.reports.push(newReport);
    saveDb(db);
    
    res.json(newReport);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/reports/save-draft", (req, res) => {
  const { id, content } = req.body;
  const db = getDb();
  const report = db.reports.find(r => r.id === id);
  if (report) {
    report.content = content;
    saveDb(db);
  }
  res.json({ success: true });
});

app.post("/api/reports/send", async (req, res) => {
  const { content, isTest, id } = req.body;
  const result = await axiosErrorHandling(async () => await sendReportEmail(content, isTest));
  
  if (result.success) {
    const db = getDb();
    const report = db.reports.find(r => r.id === id);
    if (report) {
      report.status = "sent";
      report.sentAt = new Date().toISOString();
      report.isTest = isTest; // Track if it was a test send
      saveDb(db);
    }
  }
  
  res.json(result);
});

// Helper for generic error handling if needed
async function axiosErrorHandling(fn) {
  try {
    return await fn();
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// AUTOMATION: Every Monday at 10:00 AM
cron.schedule("0 10 * * 1", async () => {
  console.log("Running weekly automation job...");
  const today = new Date();
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);
  
  const content = await generateFullReport(lastWeek.toISOString(), today.toISOString());
  if (content) {
    const db = getDb();
    const newReport = {
      id: Date.now(),
      content,
      status: "draft",
      startDate: lastWeek.toISOString(),
      endDate: today.toISOString(),
      createdAt: new Date().toISOString(),
      type: "automatic"
    };
    db.reports = db.reports.filter(r => r.status !== "draft");
    db.reports.push(newReport);
    saveDb(db);
    console.log("Weekly draft generated.");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
