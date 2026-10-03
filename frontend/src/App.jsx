import React, { useState, useEffect } from 'react';
import api from './api';

const cleanText = (text) => {
  if (!text) return "";
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  // Remove Markdown bold/italic (**, *, __, _)
  text = text.replace(/\*\*/g, '');
  text = text.replace(/\*/g, '');
  text = text.replace(/__/g, '');
  text = text.replace(/_/g, '');
  return text;
};

function App() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeDraft, setActiveDraft] = useState(null);

  // Fetch emails on load
  useEffect(() => {
    fetchEmails();
    fetchPrompts();
    fetchDrafts();

    // Auto-refresh emails every 3 seconds to detect backend changes
    const pollInterval = setInterval(() => {
      fetchEmails();
    }, 3000);

    // Cleanup on unmount
    return () => clearInterval(pollInterval);
  }, []);

  const fetchEmails = async () => {
    try {
      const res = await api.get('/emails');
      setEmails(res.data);
    } catch (err) {
      console.error("Error fetching emails", err);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await api.get('/prompts');
      setPrompts(res.data);
    } catch (err) {
      console.error("Error fetching prompts", err);
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await api.get('/drafts');
      setDrafts(res.data);
    } catch (err) {
      console.error("Error fetching drafts", err);
    }
  };

  const handleProcess = async () => {
    setLoading(true);
    try {
      await api.post('/process');

      // Poll for updates every 2 seconds for 1 minute
      await fetchEmails();
      const pollInterval = setInterval(fetchEmails, 2000);
      setTimeout(() => {
        clearInterval(pollInterval);
        setLoading(false);
      }, 60000); // 1 minute = 60000ms

    } catch (err) {
      console.error("Error processing inbox", err);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white font-sans text-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-lg">📧</span>
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Email Agent</h1>
              <p className="text-xs text-slate-400">AI-Powered Productivity</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'inbox' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>📥</span> Inbox
            </button>
            <button
              onClick={() => setActiveTab('brain')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'brain' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>🧠</span> Prompt Config
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'drafts' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span>📝</span> Drafts
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="text-xs text-slate-500">
            <p>Mock Inbox Loaded</p>
            <p>{emails.length} emails available</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'inbox' && (
          <InboxView
            emails={emails}
            selectedEmail={selectedEmail}
            onSelectEmail={setSelectedEmail}
            onProcess={handleProcess}
            loading={loading}
            onDraftReply={(email) => {
              const newDraft = {
                id: Date.now().toString(),
                email_id: email.id,
                to: email.sender,
                subject: `Re: ${email.subject}`,
                body: "",
                saved_at: new Date().toISOString()
              };
              setActiveDraft(newDraft);
              setActiveTab('drafts');
            }}
          />
        )}
        {activeTab === 'brain' && (
          <BrainView prompts={prompts} onUpdate={fetchPrompts} />
        )}
        {activeTab === 'drafts' && (
          <DraftsView
            drafts={drafts}
            onUpdate={fetchDrafts}
            activeDraft={activeDraft}
            setActiveDraft={setActiveDraft}
            emails={emails}
          />
        )}
      </div>
    </div>
  );
}

function InboxView({ emails, selectedEmail, onSelectEmail, onProcess, loading, onDraftReply }) {
  const [chatQuery, setChatQuery] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Reset chat when email changes
  useEffect(() => {
    setChatHistory([]);
    setChatQuery('');
  }, [selectedEmail?.id]);

  const handleChat = async () => {
    if (!chatQuery.trim()) return;

    const query = chatQuery;
    setChatQuery('');
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    setChatLoading(true);

    try {
      const res = await api.post('/chat', {
        query: query,
        email_id: selectedEmail?.id || null
      });
      setChatHistory(prev => [...prev, { role: 'agent', content: res.data.response }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'agent', content: "Error processing request." }]);
    }
    setChatLoading(false);
  };

  return (
    <div className="flex w-full h-full">
      {/* Email List Column */}
      <div className="w-[400px] border-r border-gray-200 flex flex-col bg-white">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Inbox</h2>
            <span className="text-sm text-gray-500">{emails.filter(e => !e.read).length} unread</span>
          </div>
          <button
            onClick={onProcess}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-70 flex justify-center items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">↻</span> Processing...
              </>
            ) : (
              <>
                <span>⚡</span> Process Inbox
              </>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
          {emails.map(email => (
            <div
              key={email.id}
              onClick={() => onSelectEmail(email)}
              className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md ${selectedEmail?.id === email.id
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-gray-900 truncate pr-2">{email.sender}</h3>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(email.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="text-sm font-medium text-gray-800 mb-1 truncate">{cleanText(email.subject)}</div>
              <div className="text-xs text-gray-500 line-clamp-2 mb-3">{cleanText(email.body)}</div>

              <div className="flex flex-wrap gap-2">
                {email.category && (
                  <Badge category={email.category} />
                )}
                {email.action_items && email.action_items.length > 0 && (
                  <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">
                    {email.action_items.length} tasks
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Email Detail Column */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {selectedEmail ? (
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-8">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => onSelectEmail(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to Inbox Assistant"
                  >
                    <span className="text-xl">←</span>
                  </button>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight flex-1">{selectedEmail.subject}</h1>
                  {selectedEmail.category && <Badge category={selectedEmail.category} size="lg" />}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-500 pb-6 border-b border-gray-100">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 text-base">{selectedEmail.sender}</span>
                    <span>{selectedEmail.sender.toLowerCase()}</span>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => onDraftReply(selectedEmail)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <span>✍️</span> Draft Reply
                    </button>
                    <button className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-700 font-medium transition-colors">Forward</button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="text-gray-800 whitespace-pre-wrap mb-8 leading-relaxed text-base">
                {cleanText(selectedEmail.body)}
              </div>

              {/* Action Items */}
              {selectedEmail.action_items && selectedEmail.action_items.length > 0 && (
                <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-xl">
                  <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                    <span>✅</span> Action Items
                  </h3>
                  <div className="space-y-3">
                    {selectedEmail.action_items.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-start bg-white/50 p-3 rounded-lg border border-amber-100">
                        <input type="checkbox" className="mt-1 rounded text-amber-600 focus:ring-amber-500" />
                        <div>
                          <div className="font-medium text-gray-900">{item.task}</div>
                          {item.deadline && (
                            <div className="text-xs text-amber-700 mt-1 font-medium">Due: {item.deadline}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Section */}
              <div className="mt-auto pt-6 border-t border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <span>🤖</span> AI Assistant
                </h3>
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {chatHistory.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-2xl ${msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                        }`}>
                        <div className="whitespace-pre-wrap">{cleanText(msg.content)}</div>
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-50 text-gray-500 p-4 rounded-2xl rounded-bl-none italic">
                        Thinking...
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    placeholder="Ask about this email, draft a reply..."
                    className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                  />
                  <button
                    onClick={handleChat}
                    disabled={chatLoading || !chatQuery.trim()}
                    className="bg-blue-600 text-white px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50/30">
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-4xl">
                🧠
              </div>
              <h2 className="text-xl font-bold text-gray-700 mb-2">Inbox Assistant</h2>
              <p className="text-gray-500 max-w-md mb-8">
                Ask questions about your entire inbox, like "What are my deadlines?" or "Show me urgent emails".
              </p>
            </div>

            {/* Inbox Chat Section */}
            <div className="p-8 border-t border-gray-100 bg-white">
              <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                      }`}>
                      <div className="whitespace-pre-wrap">{cleanText(msg.content)}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-50 text-gray-500 p-4 rounded-2xl rounded-bl-none italic">
                      Thinking...
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={chatQuery}
                  onChange={(e) => setChatQuery(e.target.value)}
                  placeholder="Ask about your inbox..."
                  className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && handleChat()}
                />
                <button
                  onClick={handleChat}
                  disabled={chatLoading || !chatQuery.trim()}
                  className="bg-blue-600 text-white px-6 rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ category, size = 'sm' }) {
  const styles = {
    'To-Do': 'bg-green-100 text-green-700 border-green-300',
    'Newsletter': 'bg-purple-100 text-purple-700 border-purple-300',
    'Spam': 'bg-red-100 text-red-700 border-red-300',
    'Important': 'bg-orange-100 text-orange-700 border-orange-300',
  };

  const defaultStyle = 'bg-blue-100 text-blue-700 border-blue-300';
  const style = styles[category] || defaultStyle;
  const sizeClass = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`${sizeClass} font-bold rounded-full border ${style}`}>
      {category}
    </span>
  );
}

function DraftsView({ drafts, onUpdate, activeDraft, setActiveDraft, emails }) {
  const [editingDraft, setEditingDraft] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (activeDraft) {
      setEditingDraft(activeDraft);
    }
  }, [activeDraft]);

  const handleSave = async () => {
    if (!editingDraft) return;
    try {
      if (drafts.find(d => d.id === editingDraft.id)) {
        await api.put(`/drafts/${editingDraft.id}`, editingDraft);
      } else {
        await api.post('/drafts', editingDraft);
      }
      await onUpdate();
      setActiveDraft(null);
      setEditingDraft(null);
    } catch (err) {
      console.error("Error saving draft", err);
    }
  };

  const handleGenerate = async () => {
    if (!editingDraft?.email_id) return;
    setGenerating(true);
    try {
      const res = await api.post('/drafts/generate', {
        email_id: editingDraft.email_id,
        instructions: instructions
      });
      setEditingDraft(prev => ({ ...prev, body: res.data.draft_body }));
    } catch (err) {
      console.error("Error generating draft", err);
    }
    setGenerating(false);
  };

  const handleDelete = async () => {
    if (!editingDraft || !window.confirm('Are you sure you want to delete this draft?')) return;
    try {
      await api.delete(`/drafts/${editingDraft.id}`);
      await onUpdate();
      setActiveDraft(null);
      setEditingDraft(null);
    } catch (err) {
      console.error("Error deleting draft", err);
    }
  };

  return (
    <div className="flex w-full h-full bg-gray-50">
      {/* Draft List */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Drafts</h2>
          <button
            onClick={() => {
              const newDraft = {
                id: Date.now().toString(),
                to: "",
                subject: "",
                body: "",
                saved_at: new Date().toISOString()
              };
              setEditingDraft(newDraft);
              setActiveDraft(null);
            }}
            className="mt-4 w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          >
            + New Draft
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {drafts.map(draft => (
            <div
              key={draft.id}
              onClick={() => setEditingDraft(draft)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${editingDraft?.id === draft.id
                ? 'bg-blue-50 border-blue-500 shadow-sm'
                : 'bg-white border-gray-200 hover:border-blue-300'
                }`}
            >
              <div className="font-semibold text-gray-900 truncate">{draft.subject || "(No Subject)"}</div>
              <div className="text-xs text-gray-500 truncate">To: {draft.to || "(No Recipient)"}</div>
              <div className="text-xs text-gray-400 mt-2">
                {new Date(draft.saved_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {editingDraft ? (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Draft</h2>
                <div className="flex gap-3">
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setEditingDraft(null)}
                    className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                  >
                    Save Draft
                  </button>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
                  <input
                    type="text"
                    value={editingDraft.to}
                    onChange={e => setEditingDraft(prev => ({ ...prev, to: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    placeholder="recipient@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    value={editingDraft.subject}
                    onChange={e => setEditingDraft(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                    placeholder="Subject line"
                  />
                </div>
              </div>

              {/* AI Generation */}
              {editingDraft.email_id && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">✨</span>
                    <h3 className="font-bold text-purple-900">AI Writer</h3>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={instructions}
                      onChange={e => setInstructions(e.target.value)}
                      placeholder="E.g., Accept the meeting and ask for an agenda..."
                      className="flex-1 p-2 bg-white border border-purple-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                      {generating ? "Generating..." : "Generate"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <textarea
                  value={editingDraft.body}
                  onChange={e => setEditingDraft(prev => ({ ...prev, body: e.target.value }))}
                  className="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none resize-none font-mono text-sm leading-relaxed"
                  placeholder="Write your email here..."
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-3xl">
              📝
            </div>
            <p className="text-lg font-medium text-gray-500">Select a draft to edit</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

function BrainView({ prompts, onUpdate }) {
  return (
    <div className="flex-1 bg-gray-50 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Prompt Brain</h2>
          <p className="text-gray-500">Configure the intelligence behind your agent.</p>
        </div>

        <div className="grid gap-6">
          {prompts.map(prompt => (
            <div key={prompt.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{prompt.name}</h3>
                  <p className="text-sm text-gray-500">{prompt.description}</p>
                </div>
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-full uppercase tracking-wide">
                  {prompt.id}
                </span>
              </div>
              <textarea
                className="w-full h-40 p-4 border border-gray-200 rounded-lg font-mono text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all outline-none resize-none"
                defaultValue={prompt.template}
                onBlur={async (e) => {
                  if (e.target.value !== prompt.template) {
                    await api.put(`/prompts/${prompt.id}`, { ...prompt, template: e.target.value });
                    onUpdate();
                  }
                }}
              />
              <div className="mt-3 flex justify-end">
                <span className="text-xs text-gray-400">Changes save automatically on blur</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
