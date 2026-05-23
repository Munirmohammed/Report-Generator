import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [repos, setRepos] = useState([]);
  const [reports, setReports] = useState([]);
  const [currentDraft, setCurrentDraft] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isTest, setIsTest] = useState(true);

  // Manual generator state
  const [genStep, setGenStep] = useState(1);
  const [previewData, setPreviewData] = useState([]);
  const [selectedShas, setSelectedShas] = useState({});
  const [genStartDate, setGenStartDate] = useState('');
  const [genEndDate, setGenEndDate] = useState('');

  useEffect(() => {
    fetchRepos();
    fetchReports();
    fetchLatestDraft();
  }, []);

  const fetchRepos = async () => {
    const res = await axios.get(`${API_BASE}/repos`);
    setRepos(res.data);
  };

  const fetchReports = async () => {
    const res = await axios.get(`${API_BASE}/reports`);
    setReports(res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  };

  const fetchLatestDraft = async () => {
    const res = await axios.get(`${API_BASE}/reports/latest-draft`);
    setCurrentDraft(res.data);
  };

  const handlePreviewCommits = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const startDate = formData.get('startDate');
    const endDate = formData.get('endDate');
    setGenStartDate(startDate);
    setGenEndDate(endDate);
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/commits/preview`, { startDate, endDate });
      const data = res.data;
      if (data.length === 0) {
        alert("No commits found in this date range.");
        return;
      }
      setPreviewData(data);
      const initial = {};
      data.forEach(({ repo, commits }) => { initial[repo] = commits.map(c => c.sha); });
      setSelectedShas(initial);
      setGenStep(2);
    } catch (err) {
      alert("Error fetching commits: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromSelected = async () => {
    const totalSelected = Object.values(selectedShas).reduce((s, v) => s + v.length, 0);
    if (totalSelected === 0) { alert("No commits selected."); return; }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/reports/generate`, {
        startDate: genStartDate,
        endDate: genEndDate,
        selectedCommits: Object.fromEntries(
          Object.entries(selectedShas).map(([repo, shas]) => [repo, shas])
        )
      });
      setCurrentDraft(res.data);
      setActiveTab('dashboard');
      setGenStep(1);
      setPreviewData([]);
    } catch (err) {
      alert("Error generating report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSha = (repo, sha) => {
    setSelectedShas(prev => {
      const cur = prev[repo] || [];
      return { ...prev, [repo]: cur.includes(sha) ? cur.filter(s => s !== sha) : [...cur, sha] };
    });
  };

  const selectAll = (repo, commits) => setSelectedShas(prev => ({ ...prev, [repo]: commits.map(c => c.sha) }));
  const selectNone = (repo) => setSelectedShas(prev => ({ ...prev, [repo]: [] }));

  const handleSaveDraft = async () => {
    if (!currentDraft) return;
    await axios.post(`${API_BASE}/reports/save-draft`, { 
      id: currentDraft.id, 
      content: currentDraft.content 
    });
    alert("Draft saved!");
  };

  const handleSendReport = async () => {
    if (!currentDraft) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/reports/send`, {
        id: currentDraft.id,
        content: currentDraft.content,
        isTest
      });
      if (res.data.success) {
        alert(`Report sent to ${isTest ? 'Test Email' : 'Brook & CCs'}`);
        if (!isTest) {
          fetchLatestDraft();
          fetchReports();
        }
      } else {
        alert("Failed to send: " + res.data.error);
      }
    } catch (err) {
      alert("Error sending report: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="sidebar">
        <h1>Report Gen</h1>
        <div className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</div>
        <div className={`nav-item ${activeTab === 'manual' ? 'active' : ''}`} onClick={() => setActiveTab('manual')}>Manual Generator</div>
        <div className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>Projects</div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>History</div>
      </div>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <div>
            <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2>Weekly Draft</h2>
                <p className="text-muted">Review and refine your weekly summary</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input type="checkbox" checked={isTest} onChange={(e) => setIsTest(e.target.checked)} />
                  Send as Test
                </label>
                <button onClick={handleSendReport} disabled={!currentDraft || loading}>
                  {loading ? 'Sending...' : 'Send Report'}
                </button>
              </div>
            </header>

            {currentDraft ? (
              <div className="card">
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span className="status-badge draft">Draft</span>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Period: {new Date(currentDraft.startDate).toLocaleDateString()} - {new Date(currentDraft.endDate).toLocaleDateString()}</span>
                </div>
                <textarea 
                  value={currentDraft.content} 
                  onChange={(e) => setCurrentDraft({...currentDraft, content: e.target.value})}
                />
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="secondary" onClick={handleSaveDraft}>Save Changes</button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                <p>No active draft. Use the Manual Generator to create one or wait for the automatic Monday check.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manual' && (
          <div>
            {genStep === 1 && (
              <div>
                <h2 style={{ marginBottom: '1rem' }}>Manual Generator</h2>
                <div className="card">
                  <form onSubmit={handlePreviewCommits} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>Start Date</label>
                      <input type="date" name="startDate" required style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem' }}>End Date</label>
                      <input type="date" name="endDate" required style={{ width: '100%' }} />
                    </div>
                    <button type="submit" disabled={loading}>
                      {loading ? 'Fetching Commits...' : 'Preview Commits'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {genStep === 2 && (() => {
              const totalSelected = Object.values(selectedShas).reduce((s, v) => s + v.length, 0);
              const totalCommits = previewData.reduce((s, r) => s + r.commits.length, 0);
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h2>Select Commits</h2>
                    <button className="secondary" onClick={() => setGenStep(1)}>Back</button>
                  </div>
                  <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                    {totalCommits} commits found across {previewData.length} project{previewData.length !== 1 ? 's' : ''}. Uncheck any you want excluded from the report.
                  </p>

                  {previewData.map(({ repo, commits }) => (
                    <div key={repo} className="card" style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <strong style={{ fontSize: '1rem' }}>{repo}</strong>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                            {(selectedShas[repo] || []).length}/{commits.length} selected
                          </span>
                          <button className="secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }} onClick={() => selectAll(repo, commits)}>All</button>
                          <button className="secondary" style={{ padding: '2px 10px', fontSize: '0.75rem' }} onClick={() => selectNone(repo)}>None</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {commits.map(commit => (
                          <label key={commit.sha} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem 0.6rem', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', userSelect: 'none' }}>
                            <input
                              type="checkbox"
                              checked={(selectedShas[repo] || []).includes(commit.sha)}
                              onChange={() => toggleSha(repo, commit.sha)}
                              style={{ marginTop: '3px', flexShrink: 0 }}
                            />
                            <div>
                              <div style={{ fontSize: '0.875rem', lineHeight: '1.4' }}>{commit.message}</div>
                              <div className="text-muted" style={{ fontSize: '0.72rem', marginTop: '2px' }}>
                                {commit.sha.slice(0, 7)} &middot; {new Date(commit.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={handleGenerateFromSelected}
                    disabled={loading || totalSelected === 0}
                    style={{ width: '100%', marginTop: '0.5rem' }}
                  >
                    {loading ? 'Generating...' : `Generate Report from ${totalSelected} Commit${totalSelected !== 1 ? 's' : ''}`}
                  </button>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'projects' && (
          <ProjectsView repos={repos} fetchRepos={fetchRepos} />
        )}

        {activeTab === 'history' && (
          <div>
            <h2>Sent Reports</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {reports.filter(r => r.status === 'sent').map(report => (
                <div key={report.id} className="card" style={{ padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong>{new Date(report.sentAt).toLocaleString()}</strong>
                    <span className="status-badge sent">Sent</span>
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: '#cbd5e1' }}>{report.content}</pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
};

const ProjectsView = ({ repos, fetchRepos }) => {
  const [allRepos, setAllRepos] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchGithubRepos = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/github/repos`);
      setAllRepos(res.data);
    } catch (err) {
      alert("Error fetching GitHub repos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const addRepo = async (repo) => {
    await axios.post(`${API_BASE}/repos`, repo);
    fetchRepos();
  };

  const removeRepo = async (name) => {
    await axios.delete(`${API_BASE}/repos/${name}`);
    fetchRepos();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>Tracked Projects</h2>
        <button onClick={fetchGithubRepos}>{loading ? 'Fetching...' : 'Add Project From GitHub'}</button>
      </div>

      <div className="repo-grid">
        {repos.map(repo => (
          <div key={repo.name} className="repo-card">
            <div>
              <div style={{ fontWeight: 600 }}>{repo.name}</div>
              <div className="text-muted" style={{ fontSize: '0.8rem' }}>{repo.owner}</div>
            </div>
            <button className="secondary" style={{ color: '#ef4444' }} onClick={() => removeRepo(repo.name)}>Remove</button>
          </div>
        ))}
      </div>

      {allRepos.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3>Available Repositories</h3>
          <div className="repo-grid" style={{ marginTop: '1rem' }}>
            {allRepos.filter(ar => !repos.find(r => r.name === ar.name)).map(repo => (
              <div key={repo.name} className="repo-card">
                <div>
                  <div style={{ fontWeight: 600 }}>{repo.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>{repo.owner}</div>
                </div>
                <button className="secondary" onClick={() => addRepo(repo)}>Add</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
