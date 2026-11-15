// Front end logic using Vue 3. It talks to the Node server using fetch().
const sampleResume = `Riya Sharma - riya@iilm.edu
Education: B.Tech Computer Science, IILM University
Skills: HTML, CSS, JavaScript, Git, Python
Projects:
1. Portfolio website with a responsive layout, hosted on GitHub Pages.
2. Todo app in JavaScript that saves data using fetch and JSON.
Led a team of 3 in a college hackathon.`;

// helper: send JSON to the server and read the JSON reply
async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

Vue.createApp({
  data() {
    return {
      tab: 'home',
      menu: [
        { id: 'home', label: 'Home' },
        { id: 'career', label: 'Career Guide' },
        { id: 'roadmap', label: 'Roadmaps' },
        { id: 'resume', label: 'Resume Check' },
        { id: 'interview', label: 'Interview' },
      ],
      error: '',
      loading: false,

      // career guide
      options: { skillOptions: [], interests: [], goals: [], levels: [] },
      profile: { skills: [], interest: '', level: 'beginner', goal: 'job' },
      career: null,

      // roadmaps
      roadmaps: [],
      current: 'frontend',
      selected: null, // the topic whose panel is open
      done: JSON.parse(localStorage.getItem('preppilot-done') || '{}'),

      // resume check
      jobs: [],
      jobId: '',
      resume: '',
      result: null,

      // interview (one question at a time)
      ivTopics: [
        { id: 'web', icon: '\u{1F310}', label: 'Web development', desc: 'HTML, CSS, JavaScript, APIs, databases' },
        { id: 'cs', icon: '\u{1F9E0}', label: 'CS and DSA', desc: 'Data structures, OS, networks, DBMS' },
        { id: 'hr', icon: '\u{1F91D}', label: 'HR and behavioural', desc: 'Tell me about yourself, teamwork, goals' },
        { id: 'mix', icon: '\u{1F3B2}', label: 'Mixed', desc: 'A bit of everything, like a real interview' },
      ],
      iv: { step: 'setup', topic: '', total: 5, index: 1, question: '', aiQ: false, answer: '', feedback: null, results: [], asked: [], loading: false },
    };
  },

  computed: {
    currentRoadmap() {
      return this.roadmaps.find((r) => r.id === this.current);
    },
    totalTopics() {
      return this.roadmaps.reduce((sum, r) => sum + r.stages.reduce((n, s) => n + s.topics.length, 0), 0);
    },
    topicCount() {
      return this.currentRoadmap.stages.reduce((n, s) => n + s.topics.length, 0);
    },
    doneCount() {
      let count = 0;
      this.currentRoadmap.stages.forEach((stage, si) => {
        stage.topics.forEach((t, ti) => {
          if (this.done[this.keyOf(si, ti)]) count++;
        });
      });
      return count;
    },
    percent() {
      return Math.round((this.doneCount / this.topicCount) * 100);
    },
    averageScore() {
      const scores = this.iv.results.map((r) => r.score);
      return scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : 0;
    },
  },

  async mounted() {
    // runs once when the page opens: load data from the server
    try {
      this.roadmaps = await (await fetch('/api/roadmaps')).json();
      this.jobs = await (await fetch('/api/jobs')).json();
      this.options = await (await fetch('/api/options')).json();
    } catch (err) {
      this.error = 'Cannot reach the server. Is it running? (node server.js)';
    }
    // press Escape to close the topic panel
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.selected = null;
    });
  },

  methods: {
    go(tab) {
      this.tab = tab;
      this.selected = null;
      this.error = '';
      window.scrollTo(0, 0);
    },

    // ----- career guide -----
    toggleSkill(id) {
      const at = this.profile.skills.indexOf(id);
      if (at === -1) this.profile.skills.push(id);
      else this.profile.skills.splice(at, 1);
    },
    // turn an id like 'power bi' into its label 'Power BI'
    labelOf(list, id) {
      const found = list.find((x) => x.id === id);
      return found ? found.label : id;
    },
    skillLabel(id) {
      return this.labelOf(this.options.skillOptions, id);
    },
    async findCareers() {
      this.error = '';
      this.career = null;
      this.loading = true;
      try {
        const data = await postJson('/api/careers', this.profile);
        // keep a readable copy of the profile to show above the results
        data.profile = {
          skills: this.profile.skills.map((id) => this.skillLabel(id)).join(', ') || 'None selected',
          interest: this.labelOf(this.options.interests, this.profile.interest),
          level: this.labelOf(this.options.levels, this.profile.level),
          goal: this.labelOf(this.options.goals, this.profile.goal),
        };
        this.career = data;
      } catch (err) {
        this.error = err.message === 'Failed to fetch' ? 'Cannot reach the server. Is it running? (node server.js)' : err.message;
      }
      this.loading = false;
    },
    // from a recommended career, jump to its roadmap
    openRoadmap(id) {
      this.go('roadmap');
      this.current = id;
    },

    // ----- roadmap -----
    keyOf(stageIndex, topicIndex) {
      return this.current + '-' + stageIndex + '-' + topicIndex;
    },
    // topics on the left side (parity 0) or right side (parity 1) of the map
    sideTopics(stage, parity) {
      return stage.topics.map((t, i) => ({ ...t, i })).filter((t) => t.i % 2 === parity);
    },
    openTopic(stage, si, t) {
      this.selected = { key: this.keyOf(si, t.i), stage: stage.title, stageNo: si + 1, topic: t };
    },
    toggleDone(key) {
      this.done[key] = !this.done[key];
      localStorage.setItem('preppilot-done', JSON.stringify(this.done));
    },

    // ----- resume -----
    useSample() {
      this.resume = sampleResume;
    },
    async checkResume() {
      this.error = '';
      this.result = null;
      this.loading = true;
      try {
        this.result = await postJson('/api/resume', { resume: this.resume, jobId: this.jobId });
      } catch (err) {
        this.error = err.message === 'Failed to fetch' ? 'Cannot reach the server. Is it running? (node server.js)' : err.message;
      }
      this.loading = false;
    },

    // ----- interview -----
    async startInterview() {
      this.iv.step = 'ask';
      this.iv.index = 1;
      this.iv.results = [];
      this.iv.asked = [];
      await this.loadQuestion();
    },
    async loadQuestion() {
      this.iv.question = '';
      this.iv.answer = '';
      this.iv.feedback = null;
      try {
        const data = await postJson('/api/next-question', { topic: this.iv.topic, asked: this.iv.asked });
        this.iv.question = data.question;
        this.iv.aiQ = data.aiUsed;
        this.iv.asked.push(data.question);
      } catch (err) {
        this.error = err.message;
      }
    },
    async submitAnswer() {
      this.error = '';
      this.iv.loading = true;
      try {
        this.iv.feedback = await postJson('/api/answer', { question: this.iv.question, answer: this.iv.answer });
        this.iv.results.push({ question: this.iv.question, score: this.iv.feedback.score, feedback: this.iv.feedback.feedback });
      } catch (err) {
        this.error = err.message;
      }
      this.iv.loading = false;
    },
    async nextQuestion() {
      if (this.iv.index >= this.iv.total) {
        this.iv.step = 'summary';
        return;
      }
      this.iv.index++;
      await this.loadQuestion();
    },
  },
}).mount('#app');
