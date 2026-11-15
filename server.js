// PrepPilot server. Uses only built-in Node.js modules, so there is nothing to install.
const http = require('http');
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
const MODEL = 'llama3.2:1b'; // small free model that runs on a normal laptop (see README)

// Send a JSON reply to the browser
function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// Read the JSON body of a POST request
function readBody(req, callback) {
  let text = '';
  req.on('data', (chunk) => (text += chunk));
  req.on('end', () => {
    try {
      callback(JSON.parse(text || '{}'));
    } catch (err) {
      callback(null);
    }
  });
}

// Ask the local AI model (Ollama). If it is not running, return null.
async function askAI(prompt) {
  try {
    const reply = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: prompt, stream: false }),
      signal: AbortSignal.timeout(90000),
    });
    const result = await reply.json();
    return result.response || null; // null if the model is missing or gave nothing
  } catch (err) {
    return null;
  }
}

// Check which skills of the job appear in the resume
function checkSkills(resumeText, job) {
  // split the resume into lowercase words, keeping characters like + # .
  const words = resumeText
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .map((w) => w.replace(/\.+$/, ''));
  const text = resumeText.toLowerCase();

  const found = [];
  const missing = [];
  for (const skill of job.skills) {
    // one-word skills must match a whole word, so "java" does not match "javascript"
    const present = skill.includes(' ') ? text.includes(skill) : words.includes(skill);
    if (present) found.push(skill);
    else missing.push(skill);
  }
  const score = Math.round((found.length / job.skills.length) * 100);
  return { score, found, missing };
}

// ---------- API routes ----------
async function handleApi(req, res, url) {
  // GET /api/jobs  (used by the resume check dropdown)
  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    return sendJson(res, 200, data.jobs);
  }

  // GET /api/roadmaps
  if (req.method === 'GET' && url.pathname === '/api/roadmaps') {
    return sendJson(res, 200, data.roadmaps);
  }

  // POST /api/next-question  { topic: 'web' | 'cs' | 'hr' | 'mix', asked: [...] }
  if (req.method === 'POST' && url.pathname === '/api/next-question') {
    return readBody(req, async (body) => {
      if (!body) return sendJson(res, 400, { error: 'Bad JSON' });
      const asked = Array.isArray(body.asked) ? body.asked : [];
      let topic = body.topic;
      const keys = Object.keys(data.questions);
      if (topic === 'mix') topic = keys[Math.floor(Math.random() * keys.length)];
      if (!data.questions[topic]) return sendJson(res, 400, { error: 'Unknown topic' });

      // 1) try to get a fresh question from the local AI
      const about = { web: 'web development (HTML, CSS, JavaScript, Node.js, databases)', cs: 'computer science fundamentals and data structures', hr: 'HR and behavioural questions' };
      const prompt = 'Write ONE new interview question for a fresher applying for a job, about ' + about[topic] +
        '. Do not repeat these: ' + asked.join(' | ') + '. Reply with only the question.';
      let aiQuestion = await askAI(prompt);
      if (aiQuestion) {
        aiQuestion = aiQuestion.split('\n')[0].replace(/^[\d.\s"*-]+/, '').replace(/"$/, '').trim();
        if (aiQuestion.endsWith('?') && aiQuestion.length > 15 && aiQuestion.length < 250 && !asked.includes(aiQuestion)) {
          return sendJson(res, 200, { question: aiQuestion, aiUsed: true });
        }
      }

      // 2) fallback: pick a question from data.json that was not asked yet
      const bank = data.questions[topic];
      const fresh = bank.filter((q) => !asked.includes(q));
      const list = fresh.length > 0 ? fresh : bank;
      sendJson(res, 200, { question: list[Math.floor(Math.random() * list.length)], aiUsed: false });
    });
  }

  // GET /api/options  (the choices shown in the Career Guide form)
  if (req.method === 'GET' && url.pathname === '/api/options') {
    return sendJson(res, 200, data.profile);
  }

  // POST /api/careers  { skills: [...], interest, level, goal }
  if (req.method === 'POST' && url.pathname === '/api/careers') {
    return readBody(req, async (body) => {
      if (!body) return sendJson(res, 400, { error: 'Bad JSON' });
      const skills = Array.isArray(body.skills) ? body.skills : [];
      const interest = data.profile.interests.find((i) => i.id === body.interest);
      if (!interest) return sendJson(res, 400, { error: 'Please choose your interest' });
      const levelNo = ['beginner', 'intermediate', 'advanced'].indexOf(body.level) + 1 || 1; // 1, 2 or 3

      // Give every career a score out of 100: skills 50 + interest 30 + goal 10 + experience level 10
      const scored = data.roadmaps.map((r) => {
        const matched = r.skills.filter((s) => skills.includes(s));
        const missing = r.skills.filter((s) => !skills.includes(s));
        const skillPoints = 50 * (matched.length / r.skills.length);
        const interestPoints = r.interests.includes(body.interest) ? 30 : 0;
        const goalPoints = r.goals.includes(body.goal) ? 10 : 0;
        const levelPoints = Math.max(0, 10 - Math.abs(r.difficulty - levelNo) * 5);

        const reasons = ['You already have ' + matched.length + ' of the ' + r.skills.length + ' key skills.'];
        if (interestPoints) reasons.push('It matches your interest in ' + interest.label.toLowerCase() + '.');
        if (goalPoints) reasons.push('It suits your career goal.');

        return {
          id: r.id, title: r.title, about: r.about, skills: r.skills, matched, missing,
          score: Math.round(skillPoints + interestPoints + goalPoints + levelPoints),
          why: reasons.join(' '),
        };
      });
      const top3 = scored.sort((a, b) => b.score - a.score).slice(0, 3);

      // AI part: explain the recommendation in simple words
      const prompt =
        'You are a friendly career counsellor for a college student. ' +
        'Student skills: ' + (skills.join(', ') || 'none yet') + '. Interest: ' + interest.label + '. Experience: ' + body.level + '. ' +
        'Recommended careers: ' + top3.map((c) => c.title).join(', ') + '. ' +
        'In 3 short sentences, say why these fit this student and what to learn first.';
      const aiText = await askAI(prompt);

      const first = top3[0];
      const basic = 'Your best match is ' + first.title + '. ' +
        (first.missing.length ? 'Start by learning: ' + first.missing.slice(0, 3).join(', ') + '. ' : 'You already have all the key skills. ') +
        'Open its roadmap to see the steps. (Local AI is not running, so this is a basic suggestion.)';

      sendJson(res, 200, { careers: top3, aiUsed: aiText !== null, advice: aiText || basic });
    });
  }

  // POST /api/resume  { resume, jobId }
  if (req.method === 'POST' && url.pathname === '/api/resume') {
    return readBody(req, async (body) => {
      if (!body) return sendJson(res, 400, { error: 'Bad JSON' });
      const job = data.jobs.find((j) => j.id === Number(body.jobId));
      if (!job) return sendJson(res, 400, { error: 'Please choose a job role' });
      if (!body.resume || body.resume.trim().length < 30) {
        return sendJson(res, 400, { error: 'Please paste your resume (at least 30 characters)' });
      }

      const result = checkSkills(body.resume, job);

      // AI part: ask the local model for advice
      const prompt =
        'You are a friendly placement coach for a college student. ' +
        'The student wants to apply for: ' + job.title + '. ' +
        'Their resume:\n' + body.resume + '\n\n' +
        'Skills the job needs that are missing: ' + (result.missing.join(', ') || 'none') + '.\n' +
        'Give exactly 3 short, practical tips to improve this resume.';
      const aiText = await askAI(prompt);

      result.aiUsed = aiText !== null;
      result.advice = aiText || 'Local AI is not running, so here are basic tips: add the missing skills if you know them, describe 2 projects, and add numbers (for example "reduced load time by 30%").';
      sendJson(res, 200, result);
    });
  }

  // POST /api/answer  { question, answer }
  if (req.method === 'POST' && url.pathname === '/api/answer') {
    return readBody(req, async (body) => {
      if (!body || !body.answer || body.answer.trim().length < 5) {
        return sendJson(res, 400, { error: 'Please write your answer first' });
      }
      const prompt =
        'You are an interview coach. Interview question: "' + body.question + '"\n' +
        'Student answer: "' + body.answer + '"\n' +
        'Reply in exactly this format:\nScore: <number from 1 to 10>\nGood: <one sentence>\nImprove: <one sentence>';
      const aiText = await askAI(prompt);

      // basic score from answer length, used if the AI is off or gives no number
      const wordCount = body.answer.trim().split(/\s+/).length;
      let score = wordCount < 15 ? 3 : wordCount < 30 ? 5 : wordCount < 60 ? 7 : 8;

      if (aiText) {
        const match = aiText.match(/score:\s*(\d+(\.\d+)?)/i);
        if (match) score = Math.min(10, Number(match[1]));
        return sendJson(res, 200, { aiUsed: true, score: score, feedback: aiText });
      }
      const basic = 'Local AI is not running, so this is a basic check. Your answer has ' + wordCount + ' words. ' +
        (wordCount < 30 ? 'It is quite short; try 40 to 100 words and add an example.' : 'The length is good; make sure you gave an example.');
      sendJson(res, 200, { aiUsed: false, score: score, feedback: basic });
    });
  }

  sendJson(res, 404, { error: 'Unknown API route' });
}

// ---------- Serve the website files from /public ----------
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };

function serveFile(res, url) {
  const name = url.pathname === '/' ? 'index.html' : url.pathname;
  const filePath = path.join(__dirname, 'public', path.basename(name)); // basename stops ../ tricks
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'text/plain' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) handleApi(req, res, url);
  else serveFile(res, url);
});

server.listen(3000, () => console.log('PrepPilot running at http://localhost:3000'));
