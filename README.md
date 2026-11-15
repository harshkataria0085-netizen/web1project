# PrepPilot: AI Career and Placement Preparation Platform

PrepPilot helps college students prepare for placements in one place. A student can find which careers suit them, follow a step-by-step roadmap, check their resume against a job role, and practise interviews one question at a time with AI feedback.

It is a full-stack web app built with **Vue 3** and **Node.js**. Everything runs free on your own computer: no paid services, no API keys and no cloud database. The AI features use a small language model that runs locally through **Ollama**.

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Where the AI is used](#where-the-ai-is-used)
4. [Requirements](#requirements)
5. [Getting started](#getting-started)
6. [Project structure](#project-structure)
7. [Sitemap and wireframes](#sitemap-and-wireframes)
8. [API reference](#api-reference)
9. [How the career recommendation works](#how-the-career-recommendation-works)
10. [Manual test cases](#manual-test-cases)
11. [Troubleshooting](#troubleshooting)
12. [Limitations](#limitations)
13. [Future scope](#future-scope)
14. [AI assistance](#ai-assistance)

## Features

| Feature | What the student does | What happens |
|---|---|---|
| **Career Guide** | Selects skills, interest, experience level and career goal | The server scores 6 careers and shows the top 3 with a match percentage. The AI explains why they fit. Each career has a "View roadmap" button. |
| **Roadmaps** | Picks a career and clicks topics on a map | A side panel shows what the topic is and a free learning link. Topics can be marked done, with a progress bar saved in the browser. |
| **Resume Check** | Chooses a job role and pastes resume text | The server shows the skill match percentage with found and missing skills. The AI gives 3 improvement tips. |
| **Mock Interview** | Chooses a topic and number of questions | Questions come one at a time. After each answer the AI gives a score out of 10 and feedback. A summary is shown at the end. |

There are 6 roadmaps (Frontend, Full-Stack, Data Analyst, Software Engineer, AI/ML Engineer, Python Developer) with 72 topics in total.

## Tech stack

| Part | Technology |
|---|---|
| Front end | HTML5 (semantic tags), CSS3 (flexbox, grid, responsive), JavaScript, Vue 3 |
| Back end | Node.js built-in `http` module (no npm packages) |
| Data | JSON file (`data.json`) |
| Client-server communication | Fetch API with JSON |
| AI | Ollama running the `llama3.2:1b` model locally |
| Browser storage | `localStorage` for roadmap progress |

## Where the AI is used

The server calls the local model through one function, `askAI()` in `server.js`.

| Place | What the AI does |
|---|---|
| Career Guide | Explains why the top careers fit the student and what to learn first |
| Resume Check | Writes 3 practical tips to improve the resume |
| Mock Interview (question) | Writes a new question on the chosen topic that has not been asked before |
| Mock Interview (answer) | Gives a score out of 10, one good point and one improvement |

**What is not AI:** the career ranking, the skill-match percentage and the roadmaps are ordinary code and data.

**Without Ollama** the app still works. Questions come from the built-in bank in `data.json`, and feedback becomes a basic check based on answer length.

## Requirements

- Windows, macOS or Linux
- [Node.js](https://nodejs.org) 18 or newer (LTS recommended)
- A web browser (Chrome, Edge or Firefox)
- Internet connection the first time the page opens, to load Vue from a CDN
- Optional, for real AI: [Ollama](https://ollama.com) (the model is about 1.3 GB)

## Getting started

1. Clone the repository and open the folder:
   ```bash
   git clone https://github.com/<your-username>/<your-repo>.git
   cd <your-repo>
   ```
2. Optional, for the AI features. Install Ollama, then run once:
   ```bash
   ollama pull llama3.2:1b
   ```
   Make sure Ollama is running in the background (it normally starts automatically after installation).
3. Start the server:
   ```bash
   node server.js
   ```
   You should see: `PrepPilot running at http://localhost:3000`
4. Open **http://localhost:3000** in your browser.
5. Press `Ctrl + C` in the terminal to stop the server.

There is nothing to install with npm. The first AI reply can take 20 to 40 seconds while the model loads; later replies are faster.

## Project structure

```
.
|-- server.js          Node server: API routes, career scoring, skill check, calls the local AI
|-- data.json          Roadmaps, career info, resume job roles, interview question bank, form options
|-- README.md
`-- public/
    |-- index.html     Page structure (Vue template, semantic HTML)
    |-- style.css      Styling and responsive layout
    `-- script.js      Vue app: tabs, roadmap clicks, forms, fetch calls
```

## Sitemap and wireframes

```
PrepPilot
 |- Home           hero, feature cards, how it works
 |- Career Guide   skills + interest + experience + goal -> top 3 careers -> View roadmap
 |- Roadmaps       choose path -> click topic -> side panel -> mark done
 |- Resume Check   role + resume text -> skill match + AI tips
 `- Interview      choose topic + count -> one question at a time -> AI feedback -> summary
```

**Career Guide**
```
[P PrepPilot]                 Home | Career Guide | Roadmaps | Resume | Interview
-----------------------------------------------------------------------------
 Your skills:  (Python) (SQL) (HTML) (Excel) ...   <- click to select
 Interest [ AI v ]   Experience [ Beginner v ]   Goal [ IT job v ]
 [ Find my careers ]
 ---------------------------------------------------------------------------
 Student profile: Skills / Interest / Experience / Goal
 AI recommended career paths
  1  Data Analyst            70% match   Required skills: (SQL)(Python)(Excel)...
     [ View roadmap -> ]
  2  Python Developer        62% match
  3  AI / ML Engineer        53% match
 AI advice: ...
```

**Roadmap**
```
 (Frontend) (Full-Stack) (Data Analyst) (Software Eng.) (AI/ML) (Python)
 [ Title + description ]            [ progress bar 25% ]
          [ HTML ]---+                  +---[ CSS ]
                     [ 1 Web Basics ]
          [ Git ]----+
                          :
 Click a topic -> panel slides in from the right: explanation, free link, Mark as done
```

## API reference

| Method | URL | Purpose |
|---|---|---|
| GET | `/api/roadmaps` | All roadmaps with stages and topics |
| GET | `/api/options` | Choices for the Career Guide form |
| GET | `/api/jobs` | Job roles for the Resume Check dropdown |
| POST | `/api/careers` | Body `{skills, interest, level, goal}`. Returns the top 3 careers and AI advice |
| POST | `/api/resume` | Body `{resume, jobId}`. Returns skill match, found and missing skills, tips |
| POST | `/api/next-question` | Body `{topic, asked}`. Returns the next interview question |
| POST | `/api/answer` | Body `{question, answer}`. Returns score and feedback |

Bad input returns HTTP 400 with a JSON body such as `{ "error": "Please choose your interest" }`.

## How the career recommendation works

In `server.js` (route `/api/careers`) every career gets a score out of 100:

| Part | Points | Rule |
|---|---|---|
| Skills | 50 | Share of the career's key skills the student selected |
| Interest | 30 | Full points if the career matches the chosen interest |
| Career goal | 10 | Full points if the career suits the chosen goal |
| Experience level | 10 | Full points if the career's difficulty matches the student's level, fewer as the gap grows |

The three highest scores are shown. The weights can be changed in `server.js`.

Example: skills Python, C, SQL, interest AI, beginner, goal IT job gives Data Analyst 70%, Python Developer 62% and AI/ML Engineer 53%.

## Manual test cases

| # | Test | Expected result |
|---|---|---|
| 1 | Career Guide with the example profile above | Data Analyst, Python Developer and AI/ML Engineer are shown |
| 2 | Career Guide without choosing an interest | Error message is shown |
| 3 | Click "View roadmap" on a recommended career | The matching roadmap opens |
| 4 | Click a roadmap topic, then press Esc | Panel opens, then closes |
| 5 | Mark topics as done and refresh the page | Progress bar keeps its value |
| 6 | Resume Check: "Use sample resume", then "Check my resume" | Found and missing skills are listed |
| 7 | Resume Check with very short text | Error message is shown |
| 8 | Interview with 3 questions | Questions appear one at a time, summary shows an average |
| 9 | Stop Ollama and repeat tests 1, 6 and 8 | App still works and shows basic feedback |
| 10 | Resize the window to phone width | Layout stays readable |

## Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot find module '...server.js'` | The terminal is in the wrong folder. `cd` into the folder that contains `server.js`. |
| `EADDRINUSE` / port 3000 busy | An old server is still running. Press `Ctrl + C` in its terminal, or change `3000` at the bottom of `server.js`. |
| Page looks old after an update | Hard refresh with `Ctrl + Shift + R`. |
| Page is blank | Vue loads from a CDN, so connect to the internet once. To work offline, download the Vue file into `public/` and change the `src` in `index.html`. |
| "Cannot reach the server" | The server is not running. Run `node server.js`. |
| "Local AI is not running" | Start Ollama and run `ollama pull llama3.2:1b`, then try again. |
| AI is very slow | Close other heavy programs. The first reply is always the slowest. |

## Limitations

- The AI model is small, so its feedback can be generic and its scores can vary between runs. Treat it as guidance, not a grade.
- Skill matching uses a fixed list of skills, and the resume check looks for exact words.
- The interview bank has 18 built-in questions. Fresh questions need Ollama.
- Progress is stored only in the browser. There are no user accounts.
- Roadmap links point to free external sites that may change.
- Tested manually; there are no automated tests in this version.

## Future scope

- User accounts and a real database
- Upload a PDF resume and read it automatically
- More roadmaps and a larger question bank
- Save interview scores over time and show progress charts

## AI assistance

AI tools were used to help write the code and documentation for this project. The code was run and tested manually. The app itself also uses a local AI model (Ollama, `llama3.2:1b`) as described in [Where the AI is used](#where-the-ai-is-used).
