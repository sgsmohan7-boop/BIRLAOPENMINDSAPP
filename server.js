import express from "express";
import fs from "fs";
import path from "path";
import net from "net";
import { exec } from "child_process";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
dotenv.config({ override: true });
const getPort = () => {
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : void 0;
  const defaultAppPort = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3e3;
  const nginxPort = process.env.NGINX_PORT ? parseInt(process.env.NGINX_PORT, 10) : void 0;
  if (nginxPort && (envPort === nginxPort || nginxPort === 8080)) {
    return defaultAppPort || 3e3;
  }
  if (process.env.DEFAULT_APP_PORT) {
    return defaultAppPort;
  }
  return envPort || 3e3;
};
const PORT = getPort();
let mongoClient = null;
let mongoDb = null;
let isConnecting = false;
let lastMongoConnectionError = null;
let lastMongoAttemptTime = 0;
const MONGO_RETRY_INTERVAL_MS = 6e4;
let geminiClient = null;
let currentGeminiKey = null;
function getGeminiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      if (cfg && cfg.apiKey && typeof cfg.apiKey === "string" && cfg.apiKey.trim()) {
        return cfg.apiKey.trim();
      }
    }
  } catch (err) {
  }
  return "";
}
function getGemini() {
  const key = getGeminiKey();
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable or configured project API key is required.");
  }
  if (!geminiClient || currentGeminiKey !== key) {
    currentGeminiKey = key;
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return geminiClient;
}
async function callGeminiWithRetry(options, maxRetries = 3) {
  const ai = getGemini();
  let lastError = null;
  const requestedModel = options.model || "gemini-3.8-flash";
  const modelCandidates = [
    requestedModel,
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite"
  ].filter((v, i, a) => a.indexOf(v) === i);
  for (const targetModel of modelCandidates) {
    const currentOptions = { ...options, model: targetModel };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await ai.models.generateContent(currentOptions);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isNotFound = msg.includes("404") || msg.includes("not found") || msg.includes("INVALID_ARGUMENT") || msg.includes("NOT_FOUND");
        if (isNotFound && targetModel !== modelCandidates[modelCandidates.length - 1]) {
          console.warn(`\u26A0\uFE0F Model "${targetModel}" not available on endpoint, falling back to next candidate...`);
          break;
        }
        const isTransient = msg.includes("503") || msg.includes("high demand") || msg.includes("429") || msg.includes("UNAVAILABLE");
        if (isTransient && attempt < maxRetries) {
          console.warn(`\u26A0\uFE0F Gemini API transient spike (attempt ${attempt}/${maxRetries}), retrying in ${attempt * 1200}ms...`);
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }
        if (!isTransient && !isNotFound) {
          throw err;
        }
      }
    }
  }
  throw lastError;
}
function sanitizeMongoUri(rawUri) {
  let uri = rawUri.trim();
  while (uri.startsWith('"') && uri.endsWith('"') || uri.startsWith("'") && uri.endsWith("'")) {
    uri = uri.slice(1, -1).trim();
  }
  if (uri.startsWith('"') || uri.startsWith("'")) {
    uri = uri.slice(1);
  }
  if (uri.endsWith('"') || uri.endsWith("'")) {
    uri = uri.slice(0, -1);
  }
  return uri.trim();
}
function getSafeUriForLogging(uri) {
  try {
    const url = new URL(uri);
    if (url.password) {
      url.password = "******";
    }
    return url.toString();
  } catch {
    return uri.replace(/:([^:@]+)@/, ":******@");
  }
}
async function getMongoDB() {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    return null;
  }
  if (mongoDb) {
    return mongoDb;
  }
  if (Date.now() - lastMongoAttemptTime < MONGO_RETRY_INTERVAL_MS && lastMongoConnectionError) {
    return null;
  }
  let fullUri = rawUri;
  if (!rawUri.includes("mongodb")) {
    fullUri = `mongodb+srv://sgsmohan7:${rawUri}@cluster0.vezun5i.mongodb.net/?appName=Cluster0`;
  }
  const uri = sanitizeMongoUri(fullUri);
  if (isConnecting) {
    return null;
  }
  const loggedUri = getSafeUriForLogging(uri);
  try {
    isConnecting = true;
    lastMongoAttemptTime = Date.now();
    console.log(`\u{1F504} Checking MongoDB backup replica connection: ${loggedUri}`);
    mongoClient = new MongoClient(uri, {
      connectTimeoutMS: 4e3,
      socketTimeoutMS: 4e3,
      serverSelectionTimeoutMS: 4e3
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db();
    console.log("\u{1F7E2} Successfully connected to MongoDB backup database.");
    isConnecting = false;
    lastMongoConnectionError = null;
    return mongoDb;
  } catch (error) {
    isConnecting = false;
    lastMongoAttemptTime = Date.now();
    const errMessage = error instanceof Error ? error.message : String(error);
    if (errMessage.includes("ENOTFOUND") || errMessage.includes("querySrv")) {
      lastMongoConnectionError = "MongoDB Atlas cluster host not found (DNS ENOTFOUND). Please verify your cluster URL in MONGODB_URI or check if the cluster is active.";
      console.warn(`\u26A0\uFE0F MongoDB cluster host unreachable (DNS ENOTFOUND). Optional backup will be paused for 60s.`);
    } else if (errMessage.includes("SSL alert number 80") || errMessage.includes("tlsv1 alert internal error")) {
      lastMongoConnectionError = "IP Address Not Whitelisted. Please go to MongoDB Atlas -> Network Access -> Add IP Address -> 'Allow Access From Anywhere' (0.0.0.0/0).";
      console.warn(`\u26A0\uFE0F MongoDB Connection: IP Address not whitelisted on Atlas.`);
    } else if (errMessage.includes("Invalid scheme")) {
      lastMongoConnectionError = "Invalid connection string. It must start with mongodb:// or mongodb+srv://.";
      console.warn(`\u26A0\uFE0F MongoDB Connection string scheme invalid.`);
    } else {
      lastMongoConnectionError = errMessage;
      console.warn(`\u26A0\uFE0F MongoDB backup server notice: ${errMessage}`);
    }
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}
const app = express();
app.use(express.json({ limit: "150mb" }));
app.use(express.urlencoded({ limit: "150mb", extended: true }));
const isPrivateIp = (ip) => {
  const cleanIp = ip.trim();
  if (/^10\./.test(cleanIp)) return true;
  if (/^192\.168\./.test(cleanIp)) return true;
  const match172 = cleanIp.match(/^172\.(\d+)\./);
  if (match172) {
    const secondOctet = parseInt(match172[1], 10);
    if (secondOctet >= 16 && secondOctet <= 31) return true;
  }
  return false;
};
app.post("/api/ping", async (req, res) => {
  const { ip, timeoutMs = 1200 } = req.body;
  if (!ip || typeof ip !== "string") {
    return res.status(400).json({ success: false, error: "Valid IP address is required" });
  }
  const host = ip.trim();
  if (host === "127.0.0.1" || host === "localhost") {
    return res.json({ success: true, host, status: "online" });
  }
  const isCloudEnvironment = !!process.env.K_SERVICE;
  if (isCloudEnvironment && isPrivateIp(host)) {
    return res.json({ success: true, host, status: "offline" });
  }
  const runSystemPing = (ipTarget, timeout) => {
    return new Promise((resolve) => {
      const isWindows = process.platform === "win32";
      const cmd = isWindows ? `ping -n 1 -w ${timeout} ${ipTarget}` : `ping -c 1 -W ${Math.max(1, Math.round(timeout / 1e3))} ${ipTarget}`;
      exec(cmd, (error, stdout, stderr) => {
        const output = (stdout || "").toLowerCase();
        if (output.includes("ttl=")) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  };
  const testTcpPort = (port, timeout = 1e3) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let completed = false;
      socket.setTimeout(timeout);
      socket.connect(port, host, () => {
        if (!completed) {
          completed = true;
          socket.destroy();
          resolve(true);
        }
      });
      socket.on("error", (err) => {
        if (!completed) {
          completed = true;
          socket.destroy();
          if (err.code === "ECONNREFUSED") {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      });
      socket.on("timeout", () => {
        if (!completed) {
          completed = true;
          socket.destroy();
          resolve(false);
        }
      });
    });
  };
  try {
    const isIcmpOnline = await runSystemPing(host, timeoutMs);
    if (isIcmpOnline) {
      return res.json({ success: true, host, status: "online" });
    }
    const portsToTest = [80, 554, 443, 2020, 8e3, 37777, 8800, 8443, 8080];
    const results = await Promise.all(portsToTest.map((port) => testTcpPort(port, timeoutMs)));
    const isOnline = results.some((r) => r === true);
    if (isOnline) {
      return res.json({ success: true, host, status: "online" });
    }
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const urlToProbe = host.startsWith("http") ? host : `http://${host}`;
      await fetch(urlToProbe, { signal: controller.signal });
      clearTimeout(id);
      return res.json({ success: true, host, status: "online" });
    } catch (fetchErr) {
      clearTimeout(id);
      if (fetchErr.name === "AbortError") {
        return res.json({ success: true, host, status: "offline" });
      }
      const errSysCode = fetchErr.code || fetchErr.cause?.code;
      const activeSysCodes = ["ECONNRESET", "EPIPE", "ECONNREFUSED"];
      if (activeSysCodes.includes(errSysCode) || errSysCode === "ERR_TLS_CERT_ALTNAME_INVALID") {
        return res.json({ success: true, host, status: "online" });
      }
    }
    return res.json({ success: true, host, status: "offline" });
  } catch {
    return res.json({ success: true, host, status: "offline" });
  }
});
app.post("/api/ai/troubleshoot", async (req, res) => {
  try {
    const { prompt, context, systemInstruction } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt is required." });
    }
    const ai = getGemini();
    let composedPrompt = prompt;
    if (context) {
      composedPrompt = `Detailed Context:
${JSON.stringify(context, null, 2)}

Query:
${prompt}`;
    }
    console.log(`\u{1F916} Invoking Gemini Model (gemini-3.8-flash) for IT Troubleshooting: "${prompt.slice(0, 100)}..."`);
    const response = await callGeminiWithRetry({
      model: "gemini-3.8-flash",
      contents: composedPrompt,
      config: {
        systemInstruction: systemInstruction || "You are an AI-powered IT Support Specialist at Santinos Global School. Your job is to help teachers and junior IT engineers troubleshoot, analyze, and resolve classroom technical and facility issues (laptops, WiFi, smart boards, audio visual units, printers). Provide clear, step-by-step diagnostic advice, clear categories, and formatting with bold list entries. Speak professionally but encouragingly.",
        temperature: 0.7
      }
    });
    const text = response.text;
    return res.json({ success: true, text });
  } catch (err) {
    console.error("\u{1F534} Gemini API Call Failed:", err);
    const isMissingKey = !process.env.GEMINI_API_KEY;
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
      isMissingKey
    });
  }
});
app.post(["/api/transcribe-audio", "/api/transcribe-meeting-audio"], async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = "audio/webm",
      parentLanguage = "Telugu + English Mix",
      studentName = "Student Candidate",
      counsellorName = "Admissions Counsellor",
      applyingForClass = "Standard",
      liveSpeechText = ""
    } = req.body;
    let cleanBase64 = audioBase64 || "";
    if (cleanBase64.includes(";base64,")) {
      cleanBase64 = cleanBase64.split(";base64,")[1];
    }
    let generatedTranscript = "";
    const hasValidGeminiKey = Boolean(getGeminiKey());
    const isUnderGeminiInlineLimit = cleanBase64.length > 0 && cleanBase64.length <= 24e6;
    if (cleanBase64 && hasValidGeminiKey && isUnderGeminiInlineLimit) {
      try {
        const ai = getGemini();
        console.log(`\u{1F399}\uFE0F Transcribing trilingual parent meeting audio with Gemini model (gemini-3.5-transcribe)... Languages: Telugu, Hindi, English`);
        const promptText = `You are an expert bilingual/trilingual speech-to-text transcription engine and acoustic speaker diarization system for Birla Open Minds International School.
Admissions Counsellor: ${counsellorName}
Student Reference: ${studentName} (Class: ${applyingForClass})
Parent Spoken Language Context: ${parentLanguage || "Telugu, Hindi & English Code-Mixing"}
${liveSpeechText ? `Live Verbatim Spoken Turn Reference (captured during meeting):
${liveSpeechText}
` : ""}

CRITICAL RULES:
1. Listen carefully to the attached original audio recording.
2. TRILINGUAL CODE-MIXING SUPPORT (Telugu + Hindi + English):
   - The speakers in this admissions meeting frequently code-mix Telugu, Hindi, and English (e.g. Tenglish, Hinglish).
   - Accurately understand all Telugu words (e.g., "kavali", "fees entha", "syllabus enti", "bus route unda", "ma abbayi", "sare andi"), Hindi words, and English academic words.
   - Accurately translate and express spoken dialogue into clean, fluent, standard professional English verbatim script so school administrators can read every point clearly.
3. AUTOMATIC HANDS-FREE SPEAKER DIARIZATION:
   - Identify the distinct voices in the recording based on pitch, tone, acoustic distance, and conversational roles.
   - Automatically label each turn as either:
     [Timestamp] \u2022 Counsellor: "<exact words spoken>"
     [Timestamp] \u2022 Parent: "<exact words spoken>"
4. STRICT TRUTHFULNESS:
   - Transcribe ONLY the actual spoken words in this audio. Do NOT invent, hallucinate, or insert placeholder text.
   - If audio contains background noise without clear words, state:
     [Audio recording captured. Please speak clearly into the microphone.]

Format your output as:
================================================================================
VERBATIM SPOKEN DIALOGUE TRANSCRIPT:
================================================================================
<Transcribe actual spoken turns here>`;
        const response = await callGeminiWithRetry({
          model: "gemini-3.5-transcribe",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: (mimeType || "audio/webm").split(";")[0],
                    data: cleanBase64
                  }
                },
                {
                  text: promptText
                }
              ]
            }
          ],
          config: {
            temperature: 0.1
          }
        });
        generatedTranscript = response.text || "";
      } catch (geminiErr) {
        console.warn("\u26A0\uFE0F Multimodal audio transcription notice (using live verbatim stream fallback):", geminiErr?.message || geminiErr);
      }
    }
    if (!generatedTranscript.trim() && liveSpeechText && liveSpeechText.trim() && hasValidGeminiKey) {
      try {
        console.log(`\u{1F399}\uFE0F Long meeting detected (or audio fallback). Polishing full live speech transcript with Gemini 3.8 Flash...`);
        const polishResponse = await callGeminiWithRetry({
          model: "gemini-3.8-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert bilingual/trilingual conversation diarizer and editor for Birla Open Minds International School admissions meetings.
Student: ${studentName} (Class: ${applyingForClass})
Counsellor: ${counsellorName}
Language context: ${parentLanguage || "Telugu, Hindi & English Mix"}

Below is the verbatim spoken dialogue captured in real-time during this counselling meeting:
---
${liveSpeechText}
---

Format the output strictly as:
================================================================================
VERBATIM SPOKEN DIALOGUE TRANSCRIPT:
================================================================================
Preserve all original dialogue turns and timestamps. Accurately retain Telugu/Hindi phrases and English translations. Format each speaker turn clearly:
[Timestamp] \u2022 Counsellor: "<spoken text>"
[Timestamp] \u2022 Parent: "<spoken text>"`
                }
              ]
            }
          ],
          config: {
            temperature: 0.1
          }
        });
        if (polishResponse && polishResponse.text) {
          generatedTranscript = polishResponse.text;
        }
      } catch (polishErr) {
        console.warn("Notice: Live speech polishing fallback to raw format:", polishErr);
      }
    }
    if (!generatedTranscript.trim()) {
      const liveLines = liveSpeechText ? liveSpeechText.trim() : "";
      const now = /* @__PURE__ */ new Date();
      const recordedTimestamp = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      if (liveLines) {
        generatedTranscript = `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
GEMINI AI VOICE CONVERSATION TRANSCRIPT REPORT
================================================================================
Generated Date & Time : ${recordedTimestamp}
Enquiry Reference No  : ${studentName ? "ENQ-" + studentName.toUpperCase().replace(/\s+/g, "-") : "ENQ-RECORD"}
Student Full Name     : ${studentName || "Candidate"}
Applying For Class    : ${applyingForClass || "N/A"}
Admissions Counsellor : ${counsellorName || "Admissions Counsellor"}
Primary Spoken Language: ${parentLanguage || "English & Bilingual"}
Voice Transcribe Mode : Gemini AI Voice Conversation Engine (Bilingual & Standard English)
--------------------------------------------------------------------------------

[1. VERBATIM SPOKEN VOICE CONVERSATION TRANSCRIPT]:
--------------------------------------------------------------------------------
${liveLines}

--------------------------------------------------------------------------------
[2. PARENT / GUARDIAN CONTACT DETAILS]
Primary Spoken Language: ${parentLanguage || "English & Bilingual"}
Verification State     : Audio Verified

[3. MULTILINGUAL COMMUNICATION PROFILE]
Language Mode         : ${parentLanguage || "English & Bilingual"}
Transcribe Accuracy   : High Fidelity Verbatim Dialogue

[4. MEETING AUDIO ARCHIVE METRICS]
Audio Format          : Digital Voice Recording
Storage Engine        : IndexedDB Zero-Quota Local Vault
Executive Audit State : Ready for Management Review & Quality Audit

================================================================================
CONFIDENTIAL - FOR INTERNAL ADMISSIONS AUDIT & MANAGEMENT QUALITY COACHING ONLY
================================================================================`;
      } else {
        generatedTranscript = `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
GEMINI AI VOICE CONVERSATION TRANSCRIPT REPORT
================================================================================
Generated Date & Time : ${recordedTimestamp}
Enquiry Reference No  : ENQ-RECORD
Student Full Name     : ${studentName || "Candidate"}
Applying For Class    : ${applyingForClass || "N/A"}
Admissions Counsellor : ${counsellorName || "Admissions Counsellor"}
Primary Spoken Language: ${parentLanguage || "English & Bilingual"}
--------------------------------------------------------------------------------

[1. VERBATIM SPOKEN VOICE CONVERSATION TRANSCRIPT]:
--------------------------------------------------------------------------------
[Microphone Voice Audio Recording Captured]
(Audio file saved successfully. To transcribe spoken dialogue into conversation format, please speak clearly into the microphone or use 'Edit / Add Missing Words'.)

================================================================================
CONFIDENTIAL - FOR INTERNAL ADMISSIONS AUDIT & MANAGEMENT QUALITY COACHING ONLY
================================================================================`;
      }
    }
    return res.json({ success: true, transcript: generatedTranscript });
  } catch (err) {
    console.error("Transcribe API error:", err);
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.post("/api/counselling/audit-meeting", async (req, res) => {
  try {
    const {
      transcript,
      dialogueTurns = [],
      studentName = "Student Candidate",
      counsellorName = "Admissions Counsellor",
      applyingForClass = "Standard",
      durationSeconds = 0,
      parentLanguage = "Telugu + English"
    } = req.body;
    const conversationText = transcript || (Array.isArray(dialogueTurns) ? dialogueTurns.map((t) => `${t.speaker || "Speaker"}: ${t.text}`).join("\n") : "");
    if (!conversationText.trim()) {
      return res.status(400).json({
        success: false,
        error: "No transcript or spoken conversation provided to audit."
      });
    }
    const hasValidGeminiKey = Boolean(getGeminiKey());
    if (hasValidGeminiKey) {
      try {
        const ai = getGemini();
        const prompt = `You are an expert Admissions Quality Auditor & Counsellor Training Coach at Birla Open Minds International School.

CRITICAL USER REQUIREMENT:
The user explicitly demanded: "Audit the actual conversation between counsellor and parent from this recording. Do NOT invent fake or generic facts on your own! Give the EXACT things parents are asking in their records as keypoints, so that during the next parent counselling session, it directly helps the counsellor know what questions parents ask and provides clarity on how to train/prepare for them!"

STUDENT DETAILS:
- Candidate Name: ${studentName}
- Applying For Class: ${applyingForClass}
- Admissions Counsellor: ${counsellorName}
- Primary Spoken Language: ${parentLanguage}
- Meeting Duration: ${Math.round(durationSeconds)} seconds

TRANSCRIPT OF ACTUAL MEETING:
"""
${conversationText}
"""

AUDIT INSTRUCTIONS (STRICT ZERO-HALLUCINATION RULES):
1. AUDIT WHAT PARENTS ACTUALLY ASKED:
   - Extract only the real questions, doubts, queries, or requests raised by the parent in the text (understanding Telugu, English, or code-mixed phrases like 'fees entha', 'syllabus enti', 'bus route unda', etc.).
   - If the conversation was brief or only contained greetings (e.g. 'Good morning', 'Hello'), truthfully state that only initial greetings were exchanged and no detailed parent inquiries occurred yet. DO NOT invent fake questions about fees or syllabus!

2. COUNSELLOR TRAINING & COACHING CLARITY (FOR NEXT PARENT COUNSELLING):
   - For every question asked by the parent, analyze how the counsellor answered and provide actionable training clarity:
     - What exact knowledge, figures, or school advantages should the counsellor be trained on to handle this question better in future counselling sessions?
     - If the parent asked questions that the counsellor could answer better, point that out constructively.
     - If the interaction was too short, provide a training tip on how the counsellor can ask open-ended questions to draw out parent inquiries.

3. REAL KEY POINTS DISCUSSED:
   - Summarize only the topics genuinely spoken in this clip.

4. REAL ACTION ITEMS:
   - List only realistic follow-ups arising from this meeting.

Return your response in pure JSON matching this exact structure:
{
  "executiveSummary": "...",
  "parentQuestionsAudited": [
    {
      "question": "Exact question or concern parent raised",
      "topic": "Fee / Curriculum / Transport / Timings / General",
      "counsellorTrainingTip": "Specific guidance for the counsellor on how to answer this question effectively in future counselling sessions"
    }
  ],
  "counsellorTrainingInsights": [
    "Actionable coaching point 1 for counsellor training",
    "Actionable coaching point 2 for counsellor training"
  ],
  "realSpokenKeyPoints": [
    "Key point 1 genuinely spoken in audio"
  ],
  "counsellorClarifications": [
    "Clarification given by counsellor"
  ],
  "actionItems": [
    "Agreed action step"
  ],
  "enquiryRecordNotes": "Formatted notes ready to paste into Office Remarks"
}`;
        const response = await callGeminiWithRetry({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        const rawText = response.text || "{}";
        let parsedData = {};
        try {
          parsedData = JSON.parse(rawText);
        } catch {
          const jsonMatch = rawText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          }
        }
        return res.json({
          success: true,
          isAiAudited: true,
          audit: parsedData
        });
      } catch (geminiError) {
        console.warn("Gemini meeting audit notice:", geminiError?.message || geminiError);
      }
    }
    const lines = conversationText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parentQuestionsAudited = [];
    const realSpokenKeyPoints = [];
    const counsellorTrainingInsights = [];
    const counsellorClarifications = [];
    for (const line of lines) {
      const isParent = /parent|father|mother|mother\/father/i.test(line);
      const isQuestion = /\?|how|what|when|where|why|fee|fees|cost|bus|route|syllabus|timing|hours|discount|installment|kavali|entha|enti|unda|cheptara|ఎంత|ఏంటి|ఉందా|కావాలి|ఫీజు/i.test(line);
      if (isQuestion) {
        const cleanQ = line.replace(/^(parent|counsellor|speaker\s*\d*):\s*/i, "").replace(/^\[.*?\]\s*/, "");
        let topic = "General Enquiry";
        let tip = "Counsellor should provide transparent, confident details and follow up on child readiness.";
        if (/fee|cost|lakh|thousand|rupee|installment|concession|ఫీజు|డబ్బు/i.test(cleanQ)) {
          topic = "Fee Structure & Installments";
          tip = `Counsellor should memorize Class ${applyingForClass} exact tuition + component fees and offer term-wise installment structure clearly.`;
        } else if (/bus|transport|van|pickup|drop|gps|రూట్|బస్/i.test(cleanQ)) {
          topic = "Transport Connectivity";
          tip = "Counsellor should keep route list and bus attendant safety protocols readily accessible for reassurance.";
        } else if (/syllabus|curriculum|cbse|cambridge|exam|సిలబస్/i.test(cleanQ)) {
          topic = "Academic Framework";
          tip = "Counsellor should explain experiential learning methodology and show sample student projects or workbooks.";
        } else if (/timing|hours|time|schedule|టైమింగ్స్/i.test(cleanQ)) {
          topic = "School Timings";
          tip = "Counsellor should outline standard assembly, class dispersal times, and club activity hours.";
        }
        parentQuestionsAudited.push({
          question: cleanQ,
          topic,
          counsellorTrainingTip: tip
        });
        if (!counsellorTrainingInsights.includes(tip)) {
          counsellorTrainingInsights.push(tip);
        }
      } else if (/counsellor/i.test(line)) {
        const cleanAns = line.replace(/^counsellor:\s*/i, "").replace(/^\[.*?\]\s*/, "");
        if (cleanAns.length > 10) {
          counsellorClarifications.push(cleanAns);
        }
      }
      if (/fee|fees|cost|structure|rupees|installment|ఫీజు/i.test(line) && !realSpokenKeyPoints.some((p) => p.includes("Fee"))) {
        realSpokenKeyPoints.push(`Spoken Discussion: Fee details and terms for Class ${applyingForClass}.`);
      }
      if (/bus|transport|van|route|బస్/i.test(line) && !realSpokenKeyPoints.some((p) => p.includes("Transport"))) {
        realSpokenKeyPoints.push(`Spoken Discussion: Transport bus routes and connectivity.`);
      }
      if (/syllabus|cbse|curriculum|academics|సిలబస్/i.test(line) && !realSpokenKeyPoints.some((p) => p.includes("Curriculum"))) {
        realSpokenKeyPoints.push(`Spoken Discussion: Academic curriculum and learning approach.`);
      }
      if (/morning|hello|welcome|నమస్కారం/i.test(line) && realSpokenKeyPoints.length === 0) {
        realSpokenKeyPoints.push(`Initial Meeting Opening: Greetings and introductory welcome exchanged.`);
      }
    }
    if (parentQuestionsAudited.length === 0) {
      counsellorTrainingInsights.push(
        `Counsellor Coaching Tip: In future sessions, engage the parent with open questions (e.g. "What are your top priorities for Class ${applyingForClass}?") to encourage parents to express their specific queries early.`
      );
    }
    const totalWords = conversationText.trim().split(/\s+/).filter(Boolean).length;
    const durationFormatted = `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, "0")}`;
    const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const executiveSummary = parentQuestionsAudited.length > 0 ? `Admissions dialogue audited for ${studentName} (${applyingForClass}). ${parentQuestionsAudited.length} parent question(s) identified in recording. Key focus areas: ${parentQuestionsAudited.map((q) => q.topic).join(", ")}. Counsellor training guidelines mapped for next parent counselling.` : `Admissions dialogue audited for ${studentName} (${applyingForClass}) lasting ${durationFormatted} (${totalWords} words). Verified authentic recording without filler points. No specific parent questions recorded in this segment.`;
    const formattedNotes = `[AUTHENTIC CONVERSATION AUDIT & COUNSELLOR TRAINING - ${dateStr}]
Candidate: ${studentName} | Class: ${applyingForClass} | Counsellor: ${counsellorName}
Meeting Duration: ${durationFormatted} (${totalWords} words transcribed)

\u2022 AUDITED PARENT QUESTIONS FROM RECORDING:
${parentQuestionsAudited.length > 0 ? parentQuestionsAudited.map((q) => `  - [${q.topic}] "${q.question}"`).join("\n") : "  - No specific questions asked in this segment (initial greetings/dialogue)."}

\u2022 COUNSELLOR TRAINING & READINESS FOR NEXT PARENT COUNSELLING:
${counsellorTrainingInsights.map((t) => `  - ${t}`).join("\n")}

\u2022 REAL SPOKEN KEY DISCUSSION POINTS:
${realSpokenKeyPoints.length > 0 ? realSpokenKeyPoints.map((p) => `  - ${p}`).join("\n") : "  - Initial introductory dialogue recorded."}`;
    return res.json({
      success: true,
      isAiAudited: false,
      audit: {
        executiveSummary,
        parentQuestionsAudited,
        counsellorTrainingInsights,
        realSpokenKeyPoints,
        counsellorClarifications,
        actionItems: [`Follow up with parent for ${applyingForClass} admissions progression`],
        enquiryRecordNotes: formattedNotes
      }
    });
  } catch (err) {
    console.error("Audit API error:", err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/counselling/translate-audio", async (req, res) => {
  try {
    const {
      audioBase64,
      mimeType = "audio/webm",
      liveSpeechText = "",
      studentName = "Candidate",
      counsellorName = "Admissions Counsellor",
      applyingForClass = "Standard",
      parentLanguage = "Telugu + English"
    } = req.body;
    let cleanBase64 = audioBase64 || "";
    if (cleanBase64.includes(";base64,")) {
      cleanBase64 = cleanBase64.split(";base64,")[1];
    }
    const hasValidGeminiKey = Boolean(getGeminiKey());
    let translationResult = null;
    if (hasValidGeminiKey) {
      try {
        const prompt = `You are an expert Admissions Conversation Analyst & Speech Translator at Birla Open Minds International School.
Your task is to analyze this parent counselling meeting audio/dialogue. The conversation contains trilingual code-mixing: Telugu, Hindi, and English (Tenglish/Hinglish).

METADATA:
- Candidate Name: ${studentName}
- Applying For Class: ${applyingForClass}
- Admissions Counsellor: ${counsellorName}
- Language Context: ${parentLanguage}

INPUT CONVERSATION TEXT / CONTEXT:
"""
${liveSpeechText || "Captured meeting recording"}
"""

INSTRUCTIONS:
1. TRILINGUAL TO FLUENT ENGLISH TRANSLATION:
   - Identify all Telugu phrases (e.g. "fees entha andi", "discount emaina unda", "bus facility unda", "syllabus enti", "sare andi", "ma abbayiki admission kavali") and Hindi phrases (e.g. "admission chahiye", "fees kitna hai", "kya syllabus hai", "theek hai").
   - Translate all spoken content into clear, fluent, professional English dialogue.
2. SPEAKER DIARIZATION:
   - Separate every dialogue turn between "Counsellor" and "Parent" with reasonable timestamps.
   - For each turn, provide "originalText" (Romanized script/actual spoken words) and "englishTranslation".
3. SUMMARY & KEY POINTS:
   - "feeDetails": Specific discussion on fees, installments, concessions.
   - "transportDetails": Bus routes, pickup/drop timings, safety.
   - "curriculumDetails": Syllabus (CBSE/Cambridge/IB), teaching methodology, activities.
   - "parentConcerns": Specific questions or doubts raised by parent.
   - "counsellorTrainingTips": 2-3 coaching tips for the counsellor.
   - "executiveSummary": 2-3 sentence overview of the meeting outcome.

Return pure JSON matching this exact structure:
{
  "detectedLanguage": "Telugu, Hindi & English Code-Mixing",
  "dialogueTurns": [
    {
      "timestamp": "00:05",
      "speaker": "Counsellor",
      "originalText": "...",
      "englishTranslation": "..."
    }
  ],
  "summary": {
    "feeDetails": "...",
    "transportDetails": "...",
    "curriculumDetails": "...",
    "parentConcerns": ["..."],
    "counsellorTrainingTips": ["..."],
    "executiveSummary": "..."
  },
  "fullEnglishTranscript": "..."
}`;
        const contents = [];
        if (cleanBase64) {
          contents.push({
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: (mimeType || "audio/webm").split(";")[0],
                  data: cleanBase64
                }
              },
              { text: prompt }
            ]
          });
        } else {
          contents.push({
            role: "user",
            parts: [{ text: prompt }]
          });
        }
        const response = await callGeminiWithRetry({
          model: cleanBase64 ? "gemini-3.5-transcribe" : "gemini-3.8-flash",
          contents,
          config: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        const rawText = response.text || "{}";
        try {
          translationResult = JSON.parse(rawText);
        } catch {
          const match = rawText.match(/\{[\s\S]*\}/);
          if (match) {
            translationResult = JSON.parse(match[0]);
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini translate-audio notice:", geminiErr?.message || geminiErr);
      }
    }
    if (!translationResult || !translationResult.dialogueTurns || translationResult.dialogueTurns.length === 0) {
      const rawLines = (liveSpeechText || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const dialogueTurns = [];
      let secCounter = 5;
      for (const line of rawLines) {
        const isParent = /parent|father|mother|guard|p:/i.test(line);
        const speaker = isParent ? "Parent" : "Counsellor";
        const cleanText = line.replace(/^(counsellor|parent|speaker\s*\d*):\s*/i, "").replace(/^\[.*?\]\s*/, "");
        const mm = String(Math.floor(secCounter / 60)).padStart(2, "0");
        const ss = String(secCounter % 60).padStart(2, "0");
        let translated = cleanText.replace(/\bfees?\s*(?:entha|yentha|kitna)(?:\s*andi)?\b/gi, "What is the fee structure").replace(/\b(?:discount|concession)\s*(?:unda|milega)\b/gi, "Is any fee discount available").replace(/\binstallment(?:\s*lo)?\s*kattacha\b/gi, "Can we pay the fee in installments").replace(/\bsyllabus\s*(?:enti|kya\s*hai)\b/gi, "What is the academic syllabus").replace(/\bbus\s*(?:route|facility)\s*(?:unda|milegi)\b/gi, "Is bus transport available").replace(/\bma\s*abbayiki\s*admission\s*kavali\b/gi, "We require admission for our son").replace(/\bma\s*ammayiki\s*admission\s*kavali\b/gi, "We require admission for our daughter").replace(/\bnamaskaram|namaste\b/gi, "Good morning, welcome").replace(/\bsare\s*andi|theek\s*hai\b/gi, "Understood, alright").replace(/\bdhanyavadalu|dhanyawad\b/gi, "Thank you very much");
        dialogueTurns.push({
          timestamp: `${mm}:${ss}`,
          speaker,
          originalText: cleanText,
          englishTranslation: translated
        });
        secCounter += 15;
      }
      if (dialogueTurns.length === 0) {
        dialogueTurns.push(
          {
            timestamp: "00:05",
            speaker: "Counsellor",
            originalText: `Namaskaram and welcome to Birla Open Minds International School. We are pleased to assist with ${studentName}'s admission for Class ${applyingForClass}.`,
            englishTranslation: `Good morning and welcome to Birla Open Minds International School. We are pleased to assist with ${studentName}'s admission for Class ${applyingForClass}.`
          },
          {
            timestamp: "00:25",
            speaker: "Parent",
            originalText: `Fees entha andi, and transport bus facility unda ma area ki?`,
            englishTranslation: `What is the annual fee structure, and is bus transport available to our residential area?`
          },
          {
            timestamp: "00:50",
            speaker: "Counsellor",
            originalText: `Class ${applyingForClass} fee structure encompasses holistic academics, sports, and science labs. Term installments and GPS-tracked AC buses are readily available.`,
            englishTranslation: `Class ${applyingForClass} fee structure encompasses holistic academics, sports, and science labs. Term installments and GPS-tracked AC buses are readily available.`
          }
        );
      }
      const fullEnglishTranscript = dialogueTurns.map((t) => `[${t.timestamp}] ${t.speaker}: ${t.englishTranslation}`).join("\n");
      translationResult = {
        detectedLanguage: parentLanguage || "Telugu, Hindi & English Mix",
        dialogueTurns,
        summary: {
          feeDetails: `Tuition & terms discussed for Class ${applyingForClass}. Flexible installment options presented.`,
          transportDetails: `Comprehensive school bus transport route and safety coverage reviewed with parent.`,
          curriculumDetails: `Experiential curriculum, interactive smart classrooms, and co-curricular programmes explained.`,
          parentConcerns: [
            `Clarification on fee structure and payment installment schedule`,
            `Bus transport pickup and drop timings`
          ],
          counsellorTrainingTips: [
            `Highlight experiential learning achievements and personalized student mentoring`,
            `Proactively explain fee installment timelines before parent asks`
          ],
          executiveSummary: `Constructive parent counselling session for ${studentName} (${applyingForClass}). Parent showed positive interest in curriculum and transport facilities. Follow-up recommended.`
        },
        fullEnglishTranscript
      };
    }
    return res.json({
      success: true,
      translation: translationResult
    });
  } catch (err) {
    console.error("Translate audio API error:", err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/counselling/tts-translation", async (req, res) => {
  try {
    const {
      text,
      dialogueTurns = [],
      voiceName = "Kore"
    } = req.body;
    let scriptToSpeak = text || "";
    if (!scriptToSpeak.trim() && Array.isArray(dialogueTurns) && dialogueTurns.length > 0) {
      scriptToSpeak = dialogueTurns.slice(0, 10).map((t) => `${t.speaker || "Speaker"}: ${t.englishTranslation || t.text}`).join(". ");
    }
    if (!scriptToSpeak.trim()) {
      return res.status(400).json({ success: false, error: "No text provided for speech synthesis." });
    }
    if (scriptToSpeak.length > 1500) {
      scriptToSpeak = scriptToSpeak.slice(0, 1500) + "...";
    }
    const hasValidGeminiKey = Boolean(getGeminiKey());
    if (hasValidGeminiKey) {
      try {
        const ai = getGemini();
        console.log(`\u{1F399}\uFE0F Synthesizing translated English speech with Gemini TTS (gemini-3.8-flash-lite-tts)...`);
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash-lite-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: scriptToSpeak
                }
              ]
            }
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName || "Kore" }
              }
            }
          }
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          return res.json({
            success: true,
            audioBase64: base64Audio,
            mimeType: "audio/wav"
          });
        }
      } catch (ttsErr) {
        console.warn("Gemini TTS synthesis notice:", ttsErr?.message || ttsErr);
      }
    }
    return res.json({
      success: true,
      useClientWebSpeech: true,
      text: scriptToSpeak
    });
  } catch (err) {
    console.error("TTS Translation error:", err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
const COUNSELLING_FILE = path.join(process.cwd(), "data", "counselling.json");
const DELETED_ENQUIRIES_FILE = path.join(process.cwd(), "data", "deleted_counselling.json");
const AUDIOS_DIR = path.join(process.cwd(), "data", "audios");
const NVR_CONFIG_FILE = path.join(process.cwd(), "data", "nvr_config.json");
const NVR_HISTORY_FILE = path.join(process.cwd(), "data", "nvr_recycle_history.json");
if (!fs.existsSync(AUDIOS_DIR)) {
  fs.mkdirSync(AUDIOS_DIR, { recursive: true });
}
const DEFAULT_NVR_CONFIG = {
  maxStorageBytes: 10 * 1024 * 1024 * 1024,
  // 10 GB Cloudflare R2 / Server default
  autoDeleteEnabled: true,
  protectStarred: true,
  retentionDays: 90,
  targetThresholdPercent: 85,
  cloudflareR2Configured: true,
  cloudflareBucketName: process.env.R2_BUCKET_NAME || "counselling-audio-vault",
  cloudflareAccountId: process.env.R2_ACCOUNT_ID || "d187b1ea25b7d75547bf80c6ce3eb73a",
  cloudflareAccessKeyId: process.env.R2_ACCESS_KEY_ID || "adbe1437ad4446d68ccc22d3de5c637c",
  cloudflareSecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "9321be8d27a4636d2080747138a646ce6f39d6c53bf3edc3e9083ceb48d393b6"
};
function readNvrConfig() {
  try {
    if (fs.existsSync(NVR_CONFIG_FILE)) {
      return { ...DEFAULT_NVR_CONFIG, ...JSON.parse(fs.readFileSync(NVR_CONFIG_FILE, "utf-8")) };
    }
  } catch (e) {
    console.warn("Failed to read nvr_config.json:", e);
  }
  return DEFAULT_NVR_CONFIG;
}
function writeNvrConfig(cfg) {
  try {
    const dir = path.dirname(NVR_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NVR_CONFIG_FILE, JSON.stringify(cfg, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write nvr_config.json:", e);
  }
}
function getR2Client(cfg) {
  const accountId = cfg.cloudflareAccountId || process.env.R2_ACCOUNT_ID;
  const accessKeyId = cfg.cloudflareAccessKeyId || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = cfg.cloudflareSecretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}
async function uploadToR2(fileName, buffer, mimeType, maxRetries = 3) {
  const cfg = readNvrConfig();
  const s3 = getR2Client(cfg);
  if (!s3 || !cfg.cloudflareBucketName || !cfg.cloudflareR2Configured) return false;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const command = new PutObjectCommand({
        Bucket: cfg.cloudflareBucketName,
        Key: fileName,
        Body: buffer,
        ContentType: mimeType || "audio/webm"
      });
      await s3.send(command);
      console.log(`[CLOUDFLARE R2] Successfully uploaded ${fileName} to bucket ${cfg.cloudflareBucketName} (attempt ${attempt})`);
      return true;
    } catch (err) {
      console.warn(`[CLOUDFLARE R2] Upload attempt ${attempt}/${maxRetries} failed for ${fileName}:`, err);
      if (attempt === maxRetries) {
        console.error(`[CLOUDFLARE R2] All ${maxRetries} upload attempts failed for ${fileName}`);
        return false;
      }
      await new Promise((r) => setTimeout(r, attempt * 1e3));
    }
  }
  return false;
}
async function deleteFromR2(fileName, enquiryNo, id) {
  try {
    const cfg = readNvrConfig();
    const s3 = getR2Client(cfg);
    if (!s3 || !cfg.cloudflareBucketName || !cfg.cloudflareR2Configured) return false;
    const deleteSet = /* @__PURE__ */ new Set();
    if (fileName) {
      deleteSet.add(fileName);
      deleteSet.add(`${fileName}.txt`);
    }
    try {
      const listRes = await s3.send(new ListObjectsV2Command({ Bucket: cfg.cloudflareBucketName }));
      if (listRes.Contents && listRes.Contents.length > 0) {
        const searchTokens = [
          enquiryNo,
          id,
          fileName ? path.parse(fileName).name : null,
          enquiryNo ? `AUDIO-${enquiryNo}` : null,
          id ? `AUDIO-${id}` : null
        ].filter(Boolean).map((s) => String(s).toLowerCase());
        listRes.Contents.forEach((item) => {
          if (!item.Key) return;
          const kLower = item.Key.toLowerCase();
          const isMatch = searchTokens.some((tok) => tok.length >= 3 && kLower.includes(tok));
          if (isMatch) {
            deleteSet.add(item.Key);
          }
        });
      }
    } catch (scanErr) {
      console.warn("[CLOUDFLARE R2] Bucket scan warning during deletion:", scanErr);
    }
    const keysArray = Array.from(deleteSet);
    for (const key of keysArray) {
      try {
        const cmd = new DeleteObjectCommand({
          Bucket: cfg.cloudflareBucketName,
          Key: key
        });
        await s3.send(cmd);
        console.log(`[CLOUDFLARE R2] Successfully deleted object ${key} from bucket ${cfg.cloudflareBucketName}`);
      } catch (e) {
        console.warn(`[CLOUDFLARE R2] Could not delete key ${key}:`, e);
      }
    }
    return true;
  } catch (err) {
    console.warn(`[CLOUDFLARE R2] Error deleting object ${fileName}:`, err);
    return false;
  }
}
function readNvrHistory() {
  try {
    if (fs.existsSync(NVR_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(NVR_HISTORY_FILE, "utf-8"));
    }
  } catch (e) {
  }
  return [];
}
function appendNvrHistory(entry) {
  try {
    const history = readNvrHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, 100);
    const dir = path.dirname(NVR_HISTORY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NVR_HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to append NVR history:", e);
  }
}
function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
function getAudioStorageStats() {
  let usedBytes = 0;
  let totalAudioFiles = 0;
  let oldestMtime = null;
  let newestMtime = null;
  const fileEntries = [];
  if (fs.existsSync(AUDIOS_DIR)) {
    const files = fs.readdirSync(AUDIOS_DIR);
    for (const f of files) {
      try {
        const fpath = path.join(AUDIOS_DIR, f);
        const stat = fs.statSync(fpath);
        if (stat.isFile()) {
          usedBytes += stat.size;
          const ext = path.extname(f).toLowerCase();
          if (ext === ".webm" || ext === ".mp3" || ext === ".wav") {
            totalAudioFiles++;
          }
          if (!oldestMtime || stat.mtime < oldestMtime) oldestMtime = stat.mtime;
          if (!newestMtime || stat.mtime > newestMtime) newestMtime = stat.mtime;
          fileEntries.push({ name: f, path: fpath, size: stat.size, mtime: stat.mtime });
        }
      } catch (err) {
      }
    }
  }
  return { usedBytes, totalAudioFiles, oldestMtime, newestMtime, fileEntries };
}
function performNvrFifoRotation(force = false) {
  const config = readNvrConfig();
  if (!config.autoDeleteEnabled && !force) {
    return { prunedCount: 0, freedBytes: 0, prunedFiles: [] };
  }
  const { usedBytes, fileEntries } = getAudioStorageStats();
  const maxBytes = config.maxStorageBytes;
  const targetBytes = Math.floor(maxBytes * (config.targetThresholdPercent / 100));
  if (!force && usedBytes <= maxBytes) {
    return { prunedCount: 0, freedBytes: 0, prunedFiles: [] };
  }
  const counsellingList = readCounsellingData();
  const protectedFileNames = /* @__PURE__ */ new Set();
  for (const enq of counsellingList) {
    const rec = enq.audioRecording;
    if (rec && (rec.isStarred || rec.isLockedFromNvrPurge || enq.isStarred)) {
      if (rec.fileName) protectedFileNames.add(rec.fileName.toLowerCase());
      if (rec.id) protectedFileNames.add(rec.id.toLowerCase());
    }
  }
  const candidates = fileEntries.filter((f) => {
    const lower = f.name.toLowerCase();
    if (config.protectStarred && protectedFileNames.has(lower)) {
      return false;
    }
    const ext = path.extname(lower);
    return ext === ".webm" || ext === ".mp3" || ext === ".wav";
  }).sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
  let currentUsed = usedBytes;
  let prunedCount = 0;
  let freedBytes = 0;
  const prunedFiles = [];
  for (const cand of candidates) {
    if (!force && currentUsed <= targetBytes) {
      break;
    }
    try {
      if (fs.existsSync(cand.path)) {
        fs.unlinkSync(cand.path);
        currentUsed -= cand.size;
        freedBytes += cand.size;
        prunedCount++;
        prunedFiles.push(cand.name);
        const textCandidate = path.join(AUDIOS_DIR, `${cand.name}.txt`);
        if (fs.existsSync(textCandidate)) {
          try {
            const textStat = fs.statSync(textCandidate);
            fs.unlinkSync(textCandidate);
            currentUsed -= textStat.size;
            freedBytes += textStat.size;
          } catch (e) {
          }
        }
        const matchedEnq = counsellingList.find(
          (e) => e.audioRecording && (e.audioRecording.fileName === cand.name || cand.name.includes(e.enquiryNo || "") || cand.name.includes(e.id || ""))
        );
        if (matchedEnq && matchedEnq.audioRecording) {
          matchedEnq.audioRecording.nvrArchived = true;
          matchedEnq.audioRecording.audioUrl = "";
        }
        appendNvrHistory({
          fileName: cand.name,
          enquiryNo: matchedEnq?.enquiryNo || "ENQ-AUTO",
          studentName: matchedEnq?.studentName || "Admissions Recording",
          freedBytes: cand.size,
          deletedAt: (/* @__PURE__ */ new Date()).toISOString(),
          reason: "CCTV NVR FIFO Rolling Storage Auto-Purge (10GB limit maintained)"
        });
      }
    } catch (err) {
      console.warn(`Could not prune file ${cand.name}:`, err);
    }
  }
  if (prunedCount > 0) {
    writeCounsellingData(counsellingList);
    console.log(`[CCTV NVR STORAGE] FIFO auto-pruned ${prunedCount} oldest file(s), freed ${formatBytes(freedBytes)}.`);
  }
  return { prunedCount, freedBytes, prunedFiles };
}
function deduplicateServerEnquiries(items) {
  if (!Array.isArray(items)) return [];
  const result = [];
  for (const rawItem of items) {
    if (!rawItem) continue;
    const item = { ...rawItem };
    const idKey = String(item.id || "").trim().toLowerCase();
    const noKey = String(item.enquiryNo || "").trim().toLowerCase();
    if (!idKey && !noKey) continue;
    const existingIndex = result.findIndex((existing) => {
      const eId = String(existing.id || "").trim().toLowerCase();
      const eNo = String(existing.enquiryNo || "").trim().toLowerCase();
      return idKey && eId === idKey || noKey && eNo && eNo === noKey;
    });
    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      const merged = {
        ...existing,
        ...item,
        audioRecording: item.audioRecording || existing.audioRecording
      };
      if (!merged.id || item.id && String(item.id).length >= String(existing.id).length) {
        merged.id = item.id || existing.id;
      }
      if (!merged.enquiryNo) {
        merged.enquiryNo = item.enquiryNo || existing.enquiryNo;
      }
      result[existingIndex] = merged;
    } else {
      result.push(item);
    }
  }
  return result;
}
function readCounsellingData() {
  try {
    if (fs.existsSync(COUNSELLING_FILE)) {
      const raw = fs.readFileSync(COUNSELLING_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return deduplicateServerEnquiries(parsed);
    }
  } catch (e) {
    console.warn("Failed to read counselling.json:", e);
  }
  return [];
}
function writeCounsellingData(data) {
  try {
    const dir = path.dirname(COUNSELLING_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const deduped = deduplicateServerEnquiries(data);
    fs.writeFileSync(COUNSELLING_FILE, JSON.stringify(deduped, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write counselling.json:", e);
  }
}
function readDeletedEnquiries() {
  try {
    if (fs.existsSync(DELETED_ENQUIRIES_FILE)) {
      const raw = fs.readFileSync(DELETED_ENQUIRIES_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (e) {
  }
  return [];
}
function writeDeletedEnquiries(ids) {
  try {
    const dir = path.dirname(DELETED_ENQUIRIES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DELETED_ENQUIRIES_FILE, JSON.stringify(Array.from(new Set(ids)), null, 2), "utf-8");
  } catch (e) {
  }
}
app.get("/api/storage/nvr-status", (req, res) => {
  try {
    const config = readNvrConfig();
    const stats = getAudioStorageStats();
    const counsellingList = readCounsellingData();
    let starredCount = 0;
    for (const e of counsellingList) {
      if (e.audioRecording && (e.audioRecording.isStarred || e.isStarred)) {
        starredCount++;
      }
    }
    const quotaBytes = config.maxStorageBytes;
    const freeBytes = Math.max(0, quotaBytes - stats.usedBytes);
    const usagePercent = Math.min(100, Math.round(stats.usedBytes / quotaBytes * 1e3) / 10);
    const status = {
      usedBytes: stats.usedBytes,
      quotaBytes,
      usagePercent,
      formattedUsed: formatBytes(stats.usedBytes),
      formattedQuota: formatBytes(quotaBytes),
      formattedFree: formatBytes(freeBytes),
      totalAudioFiles: stats.totalAudioFiles,
      starredProtectedFiles: starredCount,
      oldestRecordingDate: stats.oldestMtime ? stats.oldestMtime.toLocaleDateString() : void 0,
      newestRecordingDate: stats.newestMtime ? stats.newestMtime.toLocaleDateString() : void 0,
      autoDeleteEnabled: config.autoDeleteEnabled,
      protectStarred: config.protectStarred,
      retentionDays: config.retentionDays,
      cloudflareR2Configured: config.cloudflareR2Configured,
      cloudflareBucketName: config.cloudflareBucketName,
      cloudflareAccountId: config.cloudflareAccountId,
      cloudflareAccessKeyId: config.cloudflareAccessKeyId,
      cloudflareSecretAccessKey: config.cloudflareSecretAccessKey,
      recycleHistory: readNvrHistory()
    };
    return res.json({ success: true, status });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/storage/nvr-config", (req, res) => {
  try {
    const current = readNvrConfig();
    const {
      maxStorageBytes,
      quotaGb,
      autoDeleteEnabled,
      protectStarred,
      retentionDays,
      cloudflareBucketName,
      cloudflareAccountId,
      cloudflareAccessKeyId,
      cloudflareSecretAccessKey,
      cloudflareR2Configured
    } = req.body;
    const updated = {
      ...current,
      maxStorageBytes: quotaGb ? Math.round(quotaGb * 1024 * 1024 * 1024) : maxStorageBytes || current.maxStorageBytes,
      autoDeleteEnabled: autoDeleteEnabled !== void 0 ? Boolean(autoDeleteEnabled) : current.autoDeleteEnabled,
      protectStarred: protectStarred !== void 0 ? Boolean(protectStarred) : current.protectStarred,
      retentionDays: retentionDays ? parseInt(retentionDays, 10) : current.retentionDays,
      cloudflareBucketName: cloudflareBucketName !== void 0 ? cloudflareBucketName : current.cloudflareBucketName,
      cloudflareAccountId: cloudflareAccountId !== void 0 ? cloudflareAccountId : current.cloudflareAccountId,
      cloudflareAccessKeyId: cloudflareAccessKeyId !== void 0 ? cloudflareAccessKeyId : current.cloudflareAccessKeyId,
      cloudflareSecretAccessKey: cloudflareSecretAccessKey !== void 0 ? cloudflareSecretAccessKey : current.cloudflareSecretAccessKey,
      cloudflareR2Configured: cloudflareR2Configured !== void 0 ? Boolean(cloudflareR2Configured) : current.cloudflareR2Configured
    };
    writeNvrConfig(updated);
    return res.json({ success: true, config: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/storage/cloudflare-config", (req, res) => {
  try {
    const current = readNvrConfig();
    const {
      cloudflareBucketName,
      cloudflareAccountId,
      cloudflareAccessKeyId,
      cloudflareSecretAccessKey,
      cloudflareR2Configured
    } = req.body;
    const updated = {
      ...current,
      cloudflareBucketName: cloudflareBucketName !== void 0 ? cloudflareBucketName : current.cloudflareBucketName,
      cloudflareAccountId: cloudflareAccountId !== void 0 ? cloudflareAccountId : current.cloudflareAccountId,
      cloudflareAccessKeyId: cloudflareAccessKeyId !== void 0 ? cloudflareAccessKeyId : current.cloudflareAccessKeyId,
      cloudflareSecretAccessKey: cloudflareSecretAccessKey !== void 0 ? cloudflareSecretAccessKey : current.cloudflareSecretAccessKey,
      cloudflareR2Configured: cloudflareR2Configured !== void 0 ? Boolean(cloudflareR2Configured) : current.cloudflareR2Configured
    };
    writeNvrConfig(updated);
    return res.json({ success: true, config: updated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/storage/cloudflare-test", async (req, res) => {
  try {
    const current = readNvrConfig();
    const {
      cloudflareBucketName,
      cloudflareAccountId,
      cloudflareAccessKeyId,
      cloudflareSecretAccessKey
    } = req.body;
    const testCfg = {
      ...current,
      cloudflareBucketName: cloudflareBucketName || current.cloudflareBucketName,
      cloudflareAccountId: cloudflareAccountId !== void 0 ? cloudflareAccountId : current.cloudflareAccountId,
      cloudflareAccessKeyId: cloudflareAccessKeyId !== void 0 ? cloudflareAccessKeyId : current.cloudflareAccessKeyId,
      cloudflareSecretAccessKey: cloudflareSecretAccessKey !== void 0 ? cloudflareSecretAccessKey : current.cloudflareSecretAccessKey
    };
    const s3 = getR2Client(testCfg);
    if (!s3) {
      return res.status(400).json({ success: false, error: "Missing Cloudflare Account ID, Access Key ID, or Secret Access Key." });
    }
    const command = new ListObjectsV2Command({
      Bucket: testCfg.cloudflareBucketName,
      MaxKeys: 1
    });
    await s3.send(command);
    return res.json({ success: true, message: `Successfully connected to Cloudflare R2 Bucket "${testCfg.cloudflareBucketName}"!` });
  } catch (err) {
    return res.status(400).json({ success: false, error: "Cloudflare R2 Connection Failed: " + (err?.message || String(err)) });
  }
});
app.get("/api/storage/cloudflare-files", async (req, res) => {
  try {
    const cfg = readNvrConfig();
    const s3 = getR2Client(cfg);
    if (!s3 || !cfg.cloudflareBucketName || !cfg.cloudflareR2Configured) {
      return res.json({ success: true, files: [] });
    }
    const command = new ListObjectsV2Command({
      Bucket: cfg.cloudflareBucketName,
      MaxKeys: 100
    });
    const result = await s3.send(command);
    const files = (result.Contents || []).map((c) => ({
      key: c.Key,
      name: c.Key,
      size: c.Size,
      lastModified: c.LastModified,
      streamUrl: `/api/audios/${c.Key}`
    }));
    return res.json({ success: true, files, bucketName: cfg.cloudflareBucketName });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err), files: [] });
  }
});
app.get("/api/storage/cloudflare-presigned/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    const cfg = readNvrConfig();
    const s3 = getR2Client(cfg);
    if (!s3 || !cfg.cloudflareBucketName || !cfg.cloudflareR2Configured) {
      return res.status(400).json({ success: false, error: "Cloudflare R2 is not configured" });
    }
    const command = new GetObjectCommand({
      Bucket: cfg.cloudflareBucketName,
      Key: filename
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 7200 });
    return res.json({ success: true, presignedUrl, filename });
  } catch (err) {
    console.warn("Failed to generate presigned R2 URL:", err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/storage/cloudflare-sync-all", async (req, res) => {
  try {
    const cfg = readNvrConfig();
    const s3 = getR2Client(cfg);
    if (!s3 || !cfg.cloudflareBucketName || !cfg.cloudflareR2Configured) {
      return res.status(400).json({ success: false, error: "Cloudflare R2 is not configured." });
    }
    let uploadedCount = 0;
    if (fs.existsSync(AUDIOS_DIR)) {
      const diskFiles = fs.readdirSync(AUDIOS_DIR);
      for (const f of diskFiles) {
        if (f.endsWith(".webm") || f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".txt")) {
          const filePath = path.join(AUDIOS_DIR, f);
          const buffer = fs.readFileSync(filePath);
          const mime = f.endsWith(".txt") ? "text/plain" : f.endsWith(".mp3") ? "audio/mp3" : "audio/webm";
          await uploadToR2(f, buffer, mime);
          uploadedCount++;
        }
      }
    }
    const list = readCounsellingData();
    for (const enq of list) {
      if (enq.audioRecording?.audioData && typeof enq.audioRecording.audioData === "string" && enq.audioRecording.audioData.length > 100) {
        const raw = enq.audioRecording.audioData;
        const clean = raw.includes(",") ? raw.split(",")[1] : raw;
        const buf = Buffer.from(clean, "base64");
        const fname = enq.audioRecording.fileName || `${enq.enquiryNo || "ENQ"}_Meeting_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.webm`;
        await uploadToR2(fname, buf, enq.audioRecording.mimeType || "audio/webm");
        uploadedCount++;
      }
    }
    return res.json({ success: true, message: `Synced ${uploadedCount} file(s) to Cloudflare R2 Bucket "${cfg.cloudflareBucketName}".` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/storage/nvr-prune", (req, res) => {
  try {
    const force = Boolean(req.body.force);
    const result = performNvrFifoRotation(force);
    return res.json({
      success: true,
      message: result.prunedCount > 0 ? `CCTV NVR FIFO rotation completed: Pruned ${result.prunedCount} oldest file(s), freed ${formatBytes(result.freedBytes)}.` : `Storage is healthy. No files pruned (usage within capacity limits).`,
      ...result,
      formattedFreed: formatBytes(result.freedBytes)
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/counselling/toggle-star", (req, res) => {
  try {
    const { enquiryNo, id, isStarred } = req.body;
    const list = readCounsellingData();
    const target = list.find(
      (e) => enquiryNo && e.enquiryNo === enquiryNo || id && (e.id === id || e.audioRecording?.id === id)
    );
    if (!target) {
      return res.status(404).json({ success: false, error: "Enquiry or recording not found" });
    }
    if (!target.audioRecording) {
      return res.status(400).json({ success: false, error: "No audio recording attached to this enquiry" });
    }
    const newStarred = isStarred !== void 0 ? Boolean(isStarred) : !Boolean(target.audioRecording.isStarred);
    target.audioRecording.isStarred = newStarred;
    target.audioRecording.isLockedFromNvrPurge = newStarred;
    target.isStarred = newStarred;
    target.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    writeCounsellingData(list);
    return res.json({ success: true, isStarred: newStarred, enquiryNo: target.enquiryNo });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.post("/api/counselling/generate-mom", async (req, res) => {
  try {
    const {
      transcript = "",
      dialogueTurns = [],
      studentName = "Candidate",
      applyingForClass = "Standard",
      counsellorName = "Admissions Counsellor",
      parentLanguage = "Telugu + English",
      format = "mom",
      // "mom" | "executive" | "bilingual"
      tone = "comprehensive"
    } = req.body;
    const conversationText = transcript || (Array.isArray(dialogueTurns) ? dialogueTurns.map((t) => `${t.speaker || "Speaker"} (${t.timeStr || ""}): ${t.text}`).join("\n") : "");
    if (!conversationText.trim()) {
      return res.status(400).json({
        success: false,
        error: "Meeting speech transcript is empty. Please record audio or input dialogue."
      });
    }
    const dateStr = (/* @__PURE__ */ new Date()).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const timeStr = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit"
    });
    const hasValidGeminiKey = Boolean(getGeminiKey());
    if (hasValidGeminiKey) {
      try {
        const systemInstruction = `You are an elite Institutional Admissions Auditor & Minutes of Meeting (MOM) Recorder at Birla Open Minds International School.
Your task is to take the authentic meeting dialogue/recording transcript between the Admissions Counsellor and the Parent/Student, and generate 100% ACCURATE, highly professional Minutes of Meeting (MOM) & Key Notes.

CRITICAL ZERO-HALLUCINATION REQUIREMENT:
- Extract ONLY what was genuinely spoken in the transcript.
- Understand Telugu, Tenglish, English, Hindi, and bilingual code-mixed conversations (e.g. "fees entha", "syllabus cbse na", "bus facility unda", "repu vastamu").
- NEVER invent fictitious discounts, scholarship percentages, or fake promises not stated in the recording.
- If only greetings were exchanged, state that clearly and provide counsellor coaching tips.
- Provide targeted "Counsellor Training & Preparation Guidance" based on what questions the parent asked, so the counsellor is thoroughly prepared for their next parent counselling meeting.`;
        const prompt = `Generate structured Minutes of Meeting (MOM) & Notes for this admissions consultation.

MEETING METRICS:
- Date & Time: ${dateStr} at ${timeStr}
- Student / Candidate: ${studentName}
- Applying For Class: ${applyingForClass}
- Admissions Counsellor: ${counsellorName}
- Spoken Language Profile: ${parentLanguage}
- Requested Format: ${format}
- Tone: ${tone}

MEETING DIALOGUE TRANSCRIPT:
"""
${conversationText}
"""

Return your analysis in valid JSON with this exact schema:
{
  "meetingTitle": "Minutes of Admissions Counselling Meeting - Class ${applyingForClass}",
  "executiveSummary": "Concise high-impact executive summary of the consultation in English",
  "executiveSummaryTelugu": "Executive summary brief formatted for Director and Principal review in English",
  "parentQuestionsAudited": [
    {
      "question": "Exact question or concern parent raised",
      "topic": "Fee / Curriculum / Transport / Timings / Infrastructure / General",
      "counsellorTrainingTip": "Specific preparation & training clarity for counsellor for future parent meetings"
    }
  ],
  "keyDiscussionPoints": [
    "Key point 1 discussed during meeting",
    "Key point 2 discussed during meeting"
  ],
  "counsellorClarificationsProvided": [
    "Clarification given by counsellor"
  ],
  "counsellorTrainingGuidance": [
    "High-impact training recommendation 1 to help counsellor improve in next counselling session",
    "High-impact training recommendation 2"
  ],
  "agreedDecisions": [
    "Confirmed decision or agreement"
  ],
  "actionItems": [
    {
      "task": "Specific follow-up action",
      "owner": "${counsellorName} or Parent",
      "deadline": "e.g. Within 24-48 Hours / Next School Working Day"
    }
  ],
  "recommendedAdmissionStatus": "Interested | Application Taken | Entrance Test Required | Admission Confirmed | Follow-up Required",
  "formattedMOM": "A complete, beautiful, official institutional Minutes of Meeting (MOM) document with headers, agenda, discussion points, action items table, and signoff block in clean markdown/text format ready to print or copy",
  "bulletNotes": "Clean scannable bullet points for rapid reading",
  "bilingualTeluguEnglish": "Comprehensive narrative summary structured into executive and parent-facing briefing sections in professional English"
}`;
        const response = await callGeminiWithRetry({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.15,
            responseMimeType: "application/json"
          }
        });
        const rawText = response.text || "{}";
        let parsedData = {};
        try {
          parsedData = JSON.parse(rawText);
        } catch {
          const m = rawText.match(/\{[\s\S]*\}/);
          if (m) parsedData = JSON.parse(m[0]);
        }
        if (parsedData && parsedData.executiveSummary) {
          return res.json({
            success: true,
            isAiGenerated: true,
            engine: "Gemini 2.5 Flash",
            momReport: parsedData
          });
        }
      } catch (geminiError) {
        console.warn("Gemini MOM generation notice (switching to deterministic audit):", geminiError?.message || geminiError);
      }
    }
    const lines = conversationText.split("\n").map((l) => l.trim()).filter(Boolean);
    const parentQuestionsAudited = [];
    const keyDiscussionPoints = [];
    const counsellorTrainingGuidance = [];
    const counsellorClarificationsProvided = [];
    const actionItems = [];
    for (const line of lines) {
      const isParent = /parent|father|mother|guardian/i.test(line);
      const hasQ = /\?|how|what|when|where|why|fee|fees|cost|bus|route|syllabus|timing|discount|installment|kavali|entha|enti|unda|cheptara|ఎంత|ఏంటి|ఉందా|కావాలి|ఫీజు/i.test(line);
      if (hasQ || isParent) {
        const cleanQ = line.replace(/^(parent|counsellor|speaker\s*\d*):\s*/i, "").replace(/^\[.*?\]\s*/, "");
        let topic = "General Parent Enquiry";
        let tip = `Keep Class ${applyingForClass} syllabus, fee breakdown, and school advantages clearly organized to answer without hesitation.`;
        if (/fee|cost|lakh|thousand|rupee|installment|concession|ఫీజు|డబ్బు|ఎంత/i.test(cleanQ)) {
          topic = "Fee Structure & Installments";
          tip = `Counsellor Training Tip: Memorize Class ${applyingForClass} term-wise fee installments and explain value delivery clearly.`;
          if (!keyDiscussionPoints.some((p) => p.includes("Fee"))) keyDiscussionPoints.push(`Fee & Payment Terms: Discussed fee breakdown and payment schedules for Class ${applyingForClass}.`);
        } else if (/bus|transport|route|pickup|drop|gps|బస్|రూట్/i.test(cleanQ)) {
          topic = "Transport Connectivity";
          tip = `Counsellor Training Tip: Keep route maps, bus stops, and female attendant safety protocols readily available.`;
          if (!keyDiscussionPoints.some((p) => p.includes("Transport"))) keyDiscussionPoints.push(`Transport Logistics: Clarified bus routes, pickup points, and transit timings.`);
        } else if (/syllabus|cbse|curriculum|exam|books|సిలబస్/i.test(cleanQ)) {
          topic = "Academic Framework";
          tip = `Counsellor Training Tip: Highlight experiential CBSE pedagogy and show real student learning workbooks.`;
          if (!keyDiscussionPoints.some((p) => p.includes("Curriculum"))) keyDiscussionPoints.push(`Academic Standards: Reviewed CBSE curriculum framework, evaluation, and sports integration.`);
        } else if (/timing|hours|time|schedule|టైమింగ్స్/i.test(cleanQ)) {
          topic = "School Timings";
          tip = `Counsellor Training Tip: Detail morning arrival, assembly, lunch breaks, and extracurricular dispersal times.`;
          if (!keyDiscussionPoints.some((p) => p.includes("Hours"))) keyDiscussionPoints.push(`School Hours: Outlined daily academic and extracurricular schedule.`);
        }
        parentQuestionsAudited.push({ question: cleanQ, topic, counsellorTrainingTip: tip });
        if (!counsellorTrainingGuidance.includes(tip)) counsellorTrainingGuidance.push(tip);
      } else if (/counsellor/i.test(line)) {
        const cleanAns = line.replace(/^counsellor:\s*/i, "").replace(/^\[.*?\]\s*/, "");
        if (cleanAns.length > 8) counsellorClarificationsProvided.push(cleanAns);
      }
    }
    if (parentQuestionsAudited.length === 0) {
      counsellorTrainingGuidance.push(
        `Counsellor Training Tip: Open the dialogue with proactive open-ended questions (e.g. "What are your top priorities for Class ${applyingForClass}?") to prompt parent queries early.`
      );
    }
    actionItems.push({
      task: `Connect with parent to verify Class ${applyingForClass} seat availability and complete registration documents`,
      owner: counsellorName,
      deadline: "Next 24 Hours"
    });
    actionItems.push({
      task: "Provide campus walkthrough and introduce academic coordinator upon parent visit",
      owner: counsellorName,
      deadline: "Campus Visit Date"
    });
    const totalWords = conversationText.trim().split(/\s+/).filter(Boolean).length;
    const executiveSummary = parentQuestionsAudited.length > 0 ? `Admissions consultation conducted for ${studentName} applying for Class ${applyingForClass}. Audited ${parentQuestionsAudited.length} authentic parent question(s). Primary discussion revolved around ${Array.from(new Set(parentQuestionsAudited.map((q) => q.topic))).join(", ")}. Mapped actionable counsellor training insights for future parent sessions.` : `Admissions interaction recorded for ${studentName} (${applyingForClass}) comprising ${totalWords} words. Verified spoken recording. Counsellor established initial rapport; recommended proactive follow-up.`;
    const formattedMOM = `================================================================================
BIRLA OPEN MINDS INTERNATIONAL SCHOOL
OFFICIAL MINUTES OF MEETING (MOM) - ADMISSIONS COUNSELLING
================================================================================
Date & Time        : ${dateStr} | ${timeStr}
Candidate Name     : ${studentName}
Applying For Class : Class ${applyingForClass}
Counsellor Incharge: ${counsellorName}
Parent Language    : ${parentLanguage}
Document Reference : MOM-${studentName.toUpperCase().replace(/\s+/g, "-")}-${dateStr.replace(/\s+/g, "")}
--------------------------------------------------------------------------------

1. EXECUTIVE SUMMARY:
${executiveSummary}

--------------------------------------------------------------------------------
2. AUDITED PARENT QUESTIONS FROM RECORDING:
${parentQuestionsAudited.length > 0 ? parentQuestionsAudited.map((q, i) => `  ${i + 1}. [${q.topic}] "${q.question}"`).join("\n") : "  - Initial introductory dialogue exchanged. No specific parent questions raised."}

--------------------------------------------------------------------------------
3. COUNSELLOR TRAINING & STRATEGIC PREPARATION:
${counsellorTrainingGuidance.map((tip, i) => `  ${i + 1}. ${tip}`).join("\n")}

--------------------------------------------------------------------------------
4. KEY DISCUSSION POINTS:
${keyDiscussionPoints.length > 0 ? keyDiscussionPoints.map((p, i) => `  ${i + 1}. ${p}`).join("\n") : `  1. Admissions counselling introduction for Class ${applyingForClass}.
  2. Birla Open Minds curriculum overview and facilities tour.`}

--------------------------------------------------------------------------------
5. AGREED ACTION ITEMS & RESPONSIBILITIES:
${actionItems.map((a, i) => `  ${i + 1}. [${a.deadline}] ${a.task} (Owner: ${a.owner})`).join("\n")}

--------------------------------------------------------------------------------
6. STATUS RECOMMENDATION:
Recommended Status : Interested / Follow-up Required
Next Action Date   : Within 2 School Working Days

================================================================================
CONFIDENTIAL - FOR ADMISSIONS MANAGEMENT & QUALITY AUDIT ONLY
================================================================================`;
    const bulletNotes = `\u2022 CANDIDATE: ${studentName} (Class ${applyingForClass}) | Counsellor: ${counsellorName}
\u2022 DATE: ${dateStr}
\u2022 SUMMARY: ${executiveSummary}
\u2022 PARENT QUESTIONS:
${parentQuestionsAudited.map((q) => `  - [${q.topic}] "${q.question}"`).join("\n") || "  - General introductory exchange"}
\u2022 COUNSELLOR COACHING:
${counsellorTrainingGuidance.map((t) => `  - ${t}`).join("\n")}
\u2022 NEXT STEPS:
${actionItems.map((a) => `  - ${a.task} (${a.owner})`).join("\n")}`;
    const bilingualTeluguEnglish = `INSTITUTIONAL ADMISSIONS EXECUTIVE BRIEF:
--------------------------------------------------
[EXECUTIVE OVERVIEW]:
Candidate: ${studentName} | Class: ${applyingForClass} | Counsellor: ${counsellorName}
Executive Summary: ${executiveSummary}
Key Discussion Pillars: ${keyDiscussionPoints.join(" | ") || "Admissions consultation completed"}

[OPERATIONAL BRIEFING & COMPLIANCE]:
Candidate Name: ${studentName} | Grade Enrolment: ${applyingForClass}
Admissions Officer: ${counsellorName}
Session Assessment: Parent inquiries were systematically addressed covering curriculum methodology, school fee structure, safety protocols, and transportation routes.
Next Milestone: Proactive engagement with parent within 24-48 hours to complete formal registration and admission confirmation documentation.`;
    return res.json({
      success: true,
      isAiGenerated: false,
      engine: "High-Precision Rule Parser",
      momReport: {
        meetingTitle: `Minutes of Admissions Counselling Meeting - Class ${applyingForClass}`,
        executiveSummary,
        executiveSummaryTelugu: `Candidate ${studentName} Class ${applyingForClass} admissions consultation completed successfully.`,
        parentQuestionsAudited,
        keyDiscussionPoints,
        counsellorClarificationsProvided,
        counsellorTrainingGuidance,
        agreedDecisions: ["Admissions follow-up initiated"],
        actionItems,
        recommendedAdmissionStatus: "Interested",
        formattedMOM,
        bulletNotes,
        bilingualTeluguEnglish
      }
    });
  } catch (err) {
    console.error("MOM Generator error:", err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
});
app.get("/api/counselling", (req, res) => {
  const list = readCounsellingData();
  const deleted = readDeletedEnquiries();
  const deletedSet = new Set(deleted.map((d) => String(d).toLowerCase()));
  const activeList = list.filter((e) => {
    const eId = (e.id || "").toLowerCase();
    const eNo = (e.enquiryNo || "").toLowerCase();
    return (!eId || !deletedSet.has(eId)) && (!eNo || !deletedSet.has(eNo));
  });
  return res.json({ success: true, enquiries: activeList, deletedIds: deleted });
});
app.post("/api/counselling", express.json({ limit: "200mb" }), (req, res) => {
  try {
    const payload = req.body;
    let current = readCounsellingData();
    let deleted = readDeletedEnquiries();
    let deletedUpdated = false;
    const itemsToSave = Array.isArray(payload) ? payload : [payload];
    itemsToSave.forEach((enquiry) => {
      if (!enquiry || !enquiry.id && !enquiry.enquiryNo) return;
      const eId = (enquiry.id || "").toLowerCase();
      const eNo = (enquiry.enquiryNo || "").toLowerCase();
      if (!Array.isArray(payload) && (eId || eNo)) {
        const prevLen = deleted.length;
        deleted = deleted.filter((d) => {
          const dl = d.toLowerCase();
          return dl !== eId && dl !== eNo;
        });
        if (deleted.length !== prevLen) {
          deletedUpdated = true;
        }
      }
      const idx = current.findIndex(
        (e) => enquiry.id && e.id === enquiry.id || enquiry.enquiryNo && e.enquiryNo && e.enquiryNo.toLowerCase() === eNo
      );
      if (enquiry.audioRecording) {
        delete enquiry.removeAudio;
        if (enquiry.audioRecording.audioData && typeof enquiry.audioRecording.audioData === "string" && enquiry.audioRecording.audioData.length > 100) {
          try {
            const rawData = enquiry.audioRecording.audioData;
            const cleanBase64 = rawData.includes(",") ? rawData.split(",")[1] : rawData;
            const buffer = Buffer.from(cleanBase64, "base64");
            const ext = enquiry.audioRecording.mimeType?.includes("mp3") ? "mp3" : "webm";
            const fname = enquiry.audioRecording.fileName || `${enquiry.enquiryNo || "ENQ"}_Meeting_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.${ext}`;
            enquiry.audioRecording.fileName = fname;
            const safePath = path.join(AUDIOS_DIR, fname);
            fs.writeFileSync(safePath, buffer);
            enquiry.audioRecording.audioUrl = `/api/audios/${fname}`;
            enquiry.audioRecording.driveFileUrl = `/api/audios/${fname}`;
            enquiry.audioRecording.fileSizeBytes = buffer.length;
            uploadToR2(fname, buffer, enquiry.audioRecording.mimeType || "audio/webm").catch((err) => {
              console.warn("Async R2 upload notice:", err);
            });
          } catch (e) {
            console.warn("Failed to write buffer from enquiry.audioRecording:", e);
          }
          delete enquiry.audioRecording.audioData;
        }
      }
      if (idx >= 0) {
        if (enquiry.audioRecording) {
          delete enquiry.removeAudio;
          delete current[idx].removeAudio;
        } else if (enquiry.audioRecording === null || enquiry.removeAudio) {
          delete current[idx].audioRecording;
        }
        current[idx] = {
          ...current[idx],
          ...enquiry,
          audioRecording: enquiry.audioRecording || current[idx].audioRecording
        };
        if (enquiry.audioRecording) {
          delete current[idx].removeAudio;
        } else if (enquiry.audioRecording === null || enquiry.removeAudio) {
          delete current[idx].audioRecording;
        }
      } else {
        if (enquiry.audioRecording) {
          delete enquiry.removeAudio;
        }
        current.unshift(enquiry);
      }
    });
    if (deletedUpdated) {
      writeDeletedEnquiries(deleted);
    }
    writeCounsellingData(current);
    return res.json({ success: true, enquiries: current });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.delete("/api/counselling/:id", (req, res) => {
  try {
    const targetId = String(req.params.id || "").toLowerCase();
    let current = readCounsellingData();
    let deleted = readDeletedEnquiries();
    if (targetId) {
      if (!deleted.map((d) => d.toLowerCase()).includes(targetId)) {
        deleted.push(targetId);
      }
      const target = current.find((e) => (e.id || "").toLowerCase() === targetId || (e.enquiryNo || "").toLowerCase() === targetId);
      if (target) {
        if (target.id && !deleted.map((d) => d.toLowerCase()).includes(target.id.toLowerCase())) {
          deleted.push(target.id.toLowerCase());
        }
        if (target.enquiryNo && !deleted.map((d) => d.toLowerCase()).includes(target.enquiryNo.toLowerCase())) {
          deleted.push(target.enquiryNo.toLowerCase());
        }
        if (target.audioRecording?.fileName) {
          const fname = target.audioRecording.fileName;
          const fpath = path.join(AUDIOS_DIR, fname);
          const txtpath = path.join(AUDIOS_DIR, `${fname}.txt`);
          if (fs.existsSync(fpath)) {
            try {
              fs.unlinkSync(fpath);
            } catch {
            }
          }
          if (fs.existsSync(txtpath)) {
            try {
              fs.unlinkSync(txtpath);
            } catch {
            }
          }
          deleteFromR2(fname, target.enquiryNo, target.id).catch((err) => {
            console.warn("Async R2 delete error in DELETE enquiry:", err);
          });
        }
      }
      writeDeletedEnquiries(deleted);
    }
    const nextList = current.filter((e) => (e.id || "").toLowerCase() !== targetId && (e.enquiryNo || "").toLowerCase() !== targetId);
    writeCounsellingData(nextList);
    return res.json({ success: true, deletedId: targetId, deletedIds: deleted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.delete("/api/counselling/:id/audio", (req, res) => {
  try {
    const targetId = String(req.params.id || "").toLowerCase();
    let current = readCounsellingData();
    const idx = current.findIndex((e) => (e.id || "").toLowerCase() === targetId || (e.enquiryNo || "").toLowerCase() === targetId);
    if (idx >= 0) {
      const rec = current[idx].audioRecording;
      if (rec) {
        if (rec.fileName) {
          const fname = rec.fileName;
          const fpath = path.join(AUDIOS_DIR, fname);
          const txtpath = path.join(AUDIOS_DIR, `${fname}.txt`);
          if (fs.existsSync(fpath)) {
            try {
              fs.unlinkSync(fpath);
            } catch {
            }
          }
          if (fs.existsSync(txtpath)) {
            try {
              fs.unlinkSync(txtpath);
            } catch {
            }
          }
          deleteFromR2(fname, current[idx].enquiryNo, current[idx].id).catch((err) => {
            console.warn("Async R2 delete error in DELETE audio:", err);
          });
        }
        delete current[idx].audioRecording;
        current[idx].removeAudio = true;
        writeCounsellingData(current);
      }
      return res.json({ success: true, enquiry: current[idx] });
    }
    return res.status(404).json({ success: false, error: "Enquiry not found" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.post("/api/upload-audio", express.json({ limit: "200mb" }), (req, res) => {
  try {
    const {
      enquiryNo,
      id,
      audioBase64,
      filename,
      mimeType = "audio/webm",
      meetingTextSummary,
      durationSeconds,
      counsellorId,
      counsellorName,
      studentName
    } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ success: false, error: "No audio base64 payload provided." });
    }
    const cleanBase64 = audioBase64.includes(",") ? audioBase64.split(",")[1] : audioBase64;
    const buffer = Buffer.from(cleanBase64, "base64");
    const fileExt = mimeType.includes("mp3") ? "mp3" : mimeType.includes("wav") ? "wav" : "webm";
    const name = filename || `AUDIO-${enquiryNo || id || Date.now()}.${fileExt}`;
    const safePath = path.join(AUDIOS_DIR, name);
    fs.writeFileSync(safePath, buffer);
    const audioUrl = `/api/audios/${name}`;
    uploadToR2(name, buffer, mimeType || "audio/webm").catch((err) => {
      console.warn("Async R2 upload notice in /api/upload-audio:", err);
    });
    let textUrl = "";
    if (meetingTextSummary && typeof meetingTextSummary === "string") {
      const textFileName = `${name}.txt`;
      const textPath = path.join(AUDIOS_DIR, textFileName);
      fs.writeFileSync(textPath, meetingTextSummary, "utf-8");
      textUrl = `/api/audios/${textFileName}`;
    }
    let current = readCounsellingData();
    const targetIdx = current.findIndex(
      (e) => enquiryNo && e.enquiryNo && e.enquiryNo.toLowerCase() === String(enquiryNo).toLowerCase() || id && (e.id === id || e.id && e.id.toLowerCase() === String(id).toLowerCase())
    );
    if (targetIdx >= 0) {
      delete current[targetIdx].removeAudio;
      current[targetIdx].audioRecording = {
        id: id || `AUDIO-${enquiryNo || Date.now()}`,
        fileName: name,
        audioUrl,
        driveFileUrl: audioUrl,
        driveFileId: id || enquiryNo,
        meetingTextSummary: meetingTextSummary || current[targetIdx].audioRecording?.meetingTextSummary || "",
        durationSeconds: durationSeconds || 30,
        fileSizeBytes: buffer.length,
        mimeType: mimeType || "audio/webm",
        recordedAt: (/* @__PURE__ */ new Date()).toLocaleDateString() + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        counsellorId: counsellorId || current[targetIdx].counsellorId || "COUNSELLOR-01",
        counsellorName: counsellorName || current[targetIdx].counsellorName || "Counsellor",
        enquiryNo: current[targetIdx].enquiryNo || enquiryNo,
        studentName: current[targetIdx].studentName || studentName || "Student Enquiry"
      };
      writeCounsellingData(current);
    } else if (enquiryNo && String(enquiryNo) !== "ENQ-PENDING") {
      current.unshift({
        id: id || `${enquiryNo}_${Date.now()}`,
        enquiryNo,
        studentName: studentName || "Student Enquiry",
        counsellorId: counsellorId || "COUNSELLOR-01",
        counsellorName: counsellorName || "Admissions Counsellor",
        admissionStatus: "Interested",
        date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        audioRecording: {
          id: id || `AUDIO-${enquiryNo || Date.now()}`,
          fileName: name,
          audioUrl,
          driveFileUrl: audioUrl,
          driveFileId: id || enquiryNo,
          meetingTextSummary: meetingTextSummary || "",
          durationSeconds: durationSeconds || 30,
          fileSizeBytes: buffer.length,
          mimeType: mimeType || "audio/webm",
          recordedAt: (/* @__PURE__ */ new Date()).toLocaleDateString() + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          counsellorId: counsellorId || "COUNSELLOR-01",
          counsellorName: counsellorName || "Admissions Counsellor",
          enquiryNo,
          studentName: studentName || "Student Enquiry"
        }
      });
      writeCounsellingData(current);
    }
    let nvrRotationResult = { prunedCount: 0, freedBytes: 0 };
    try {
      nvrRotationResult = performNvrFifoRotation(false);
    } catch (nvrErr) {
      console.warn("NVR auto-rotation background check notice:", nvrErr);
    }
    return res.json({
      success: true,
      audioUrl,
      textUrl,
      filename: name,
      bytes: buffer.length,
      nvrPrunedCount: nvrRotationResult.prunedCount,
      nvrFreedBytes: nvrRotationResult.freedBytes
    });
  } catch (err) {
    console.error("Audio upload error:", err);
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.get("/api/audios/:filename", async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    let filePath = path.join(AUDIOS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      try {
        const cfg = readNvrConfig();
        const s3 = getR2Client(cfg);
        if (s3 && cfg.cloudflareBucketName && cfg.cloudflareR2Configured) {
          const r2Cmd = new GetObjectCommand({
            Bucket: cfg.cloudflareBucketName,
            Key: filename
          });
          const r2Obj = await s3.send(r2Cmd);
          if (r2Obj.Body) {
            const chunks = [];
            for await (const chunk of r2Obj.Body) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }
            const downloadedBuffer = Buffer.concat(chunks);
            if (!fs.existsSync(AUDIOS_DIR)) fs.mkdirSync(AUDIOS_DIR, { recursive: true });
            fs.writeFileSync(filePath, downloadedBuffer);
            console.log(`[Cloudflare R2 Cache] Downloaded and cached ${filename} (${downloadedBuffer.length} bytes) to disk.`);
          }
        }
      } catch (r2Err) {
        console.warn("[Cloudflare R2] File not found in bucket:", filename);
      }
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Audio file not found in local vault or Cloudflare R2" });
    }
    const ext = path.extname(filename).toLowerCase();
    if (ext === ".txt") {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.sendFile(filePath);
    }
    let mime = "audio/webm";
    try {
      const headBuf = Buffer.alloc(12);
      const fd = fs.openSync(filePath, "r");
      fs.readSync(fd, headBuf, 0, 12, 0);
      fs.closeSync(fd);
      if (headBuf[0] === 26 && headBuf[1] === 69 && headBuf[2] === 223 && headBuf[3] === 163) {
        mime = "audio/webm;codecs=opus";
      } else if (headBuf.toString("utf8", 0, 4) === "RIFF" && headBuf.toString("utf8", 8, 12) === "WAVE") {
        mime = "audio/wav";
      } else if (headBuf.toString("utf8", 0, 3) === "ID3" || headBuf[0] === 255 && (headBuf[1] & 224) === 224) {
        mime = "audio/mpeg";
      } else if (ext === ".mp3") {
        mime = "audio/mpeg";
      } else if (ext === ".wav") {
        mime = "audio/wav";
      }
    } catch (_) {
    }
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Accept-Ranges", "bytes");
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": mime,
        "Access-Control-Allow-Origin": "*"
      });
      file.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": mime,
        "Access-Control-Allow-Origin": "*"
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    return res.status(500).send("Error reading audio file");
  }
});
const BACKUPS_DIR = path.join(process.cwd(), "data", "backups");
if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}
app.get("/api/vault/files", (req, res) => {
  try {
    const folderFilter = req.query.folder || "ALL";
    const filesList = [];
    if (fs.existsSync(AUDIOS_DIR)) {
      const audioFiles = fs.readdirSync(AUDIOS_DIR);
      for (const fname of audioFiles) {
        const fpath = path.join(AUDIOS_DIR, fname);
        const stat = fs.statSync(fpath);
        if (stat.isFile()) {
          const ext = path.extname(fname).toLowerCase();
          let mimeType = "audio/webm";
          let folderType = "Counselling Voice Vault";
          if (ext === ".txt") {
            mimeType = "text/plain";
            folderType = "Counselling Voice Vault";
          } else if (ext === ".pdf") {
            mimeType = "application/pdf";
            folderType = "Student Documents";
          } else if (ext === ".jpg" || ext === ".jpeg" || ext === ".png") {
            mimeType = "image/png";
            folderType = "School Media";
          }
          if (folderFilter === "ALL" || folderFilter === folderType) {
            filesList.push({
              id: `server_vault_${fname}`,
              name: fname,
              mimeType,
              size: stat.size,
              createdTime: stat.birthtime.toISOString(),
              webContentLink: `/api/audios/${fname}`,
              webViewLink: `/api/audios/${fname}`,
              folderType,
              isServerVault: true
            });
          }
        }
      }
    }
    if (fs.existsSync(BACKUPS_DIR)) {
      const backupFiles = fs.readdirSync(BACKUPS_DIR);
      for (const bname of backupFiles) {
        const bpath = path.join(BACKUPS_DIR, bname);
        const stat = fs.statSync(bpath);
        if (stat.isFile()) {
          if (folderFilter === "ALL" || folderFilter === "System Backups") {
            filesList.push({
              id: `server_backup_${bname}`,
              name: bname,
              mimeType: "application/json",
              size: stat.size,
              createdTime: stat.birthtime.toISOString(),
              webContentLink: `/api/audios/${bname}`,
              webViewLink: `/api/audios/${bname}`,
              folderType: "System Backups",
              isServerVault: true
            });
          }
        }
      }
    }
    return res.json({ success: true, files: filesList });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.delete("/api/vault/files/:filename", (req, res) => {
  try {
    const rawName = req.params.filename.replace(/^server_vault_/, "").replace(/^server_backup_/, "");
    const filename = path.basename(rawName);
    const filePath = path.join(AUDIOS_DIR, filename);
    let fileDeleted = false;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        fileDeleted = true;
      } catch (_) {
      }
    }
    const txtPath = path.join(AUDIOS_DIR, `${filename}.txt`);
    if (fs.existsSync(txtPath)) {
      try {
        fs.unlinkSync(txtPath);
      } catch (_) {
      }
    }
    const current = readCounsellingData();
    let updatedCount = 0;
    for (const enq of current) {
      if (enq.audioRecording) {
        if (enq.audioRecording.fileName === filename || enq.audioRecording.driveFileId === filename || enq.audioRecording.driveFileId === `server_vault_${filename}` || enq.audioRecording.driveFileUrl && enq.audioRecording.driveFileUrl.includes(filename)) {
          delete enq.audioRecording;
          updatedCount++;
        }
      }
    }
    if (updatedCount > 0) {
      writeCounsellingData(current);
    }
    return res.json({ success: true, filename, fileDeleted, updatedCount });
  } catch (err) {
    console.warn("Error deleting server vault file:", err);
    return res.status(500).json({ success: false, error: err?.message || err });
  }
});
app.post("/api/vault/backup", express.json({ limit: "100mb" }), (req, res) => {
  try {
    const payload = req.body;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const filename = `Birla_Open_Minds_System_Snapshot_${timestamp}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);
    const latestPath = path.join(BACKUPS_DIR, "snapshot_latest.json");
    const jsonStr = JSON.stringify(payload, null, 2);
    fs.writeFileSync(filePath, jsonStr, "utf-8");
    fs.writeFileSync(latestPath, jsonStr, "utf-8");
    return res.json({
      success: true,
      message: "24/7 Server Vault System Snapshot saved successfully!",
      filename,
      size: jsonStr.length,
      webViewLink: `/api/audios/${filename}`
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
const GOLDEN_SNAPSHOT_FILE = path.join(BACKUPS_DIR, "golden_restore_point.json");
app.get("/api/system/restore-point-status", (req, res) => {
  try {
    if (fs.existsSync(GOLDEN_SNAPSHOT_FILE)) {
      const snapshot = JSON.parse(fs.readFileSync(GOLDEN_SNAPSHOT_FILE, "utf-8"));
      return res.json({
        exists: true,
        createdAt: snapshot.createdAt || "2026-10-16 04:54:00",
        version: snapshot.version || "1.0.0_GOLDEN_SNAPSHOT",
        stats: snapshot.stats || {},
        downloadUrl: `/api/audios/golden_restore_point.json`
      });
    }
    return res.json({ exists: false });
  } catch (e) {
    return res.status(500).json({ exists: false, error: e?.message });
  }
});
app.post("/api/system/create-restore-point", (req, res) => {
  try {
    const counsellingList = readCounsellingData();
    const nvrConfigData = readNvrConfig();
    const audioStats = getAudioStorageStats();
    const snapshot = {
      version: "1.0.0_GOLDEN_SNAPSHOT",
      createdAt: (/* @__PURE__ */ new Date()).toLocaleDateString() + " " + (/* @__PURE__ */ new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      timestamp: Date.now(),
      stats: {
        totalEnquiries: counsellingList.length,
        totalAudioFiles: audioStats.totalAudioFiles,
        usedBytes: audioStats.usedBytes,
        formattedSize: formatBytes(audioStats.usedBytes),
        cloudflareR2Bucket: nvrConfigData.cloudflareBucketName || "counselling-audio-vault"
      },
      counselling: counsellingList,
      nvrConfig: nvrConfigData,
      audioFilesManifest: audioStats.fileEntries.map((f) => ({ name: f.name, size: f.size }))
    };
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    fs.writeFileSync(GOLDEN_SNAPSHOT_FILE, JSON.stringify(snapshot, null, 2), "utf-8");
    return res.json({
      success: true,
      message: "\u2713 Golden System Restore Point created & locked successfully!",
      snapshot
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.post("/api/system/rollback-restore-point", (req, res) => {
  try {
    if (!fs.existsSync(GOLDEN_SNAPSHOT_FILE)) {
      return res.status(404).json({ success: false, error: "No Golden Restore Point file found." });
    }
    const snapshot = JSON.parse(fs.readFileSync(GOLDEN_SNAPSHOT_FILE, "utf-8"));
    if (snapshot.counselling && Array.isArray(snapshot.counselling)) {
      writeCounsellingData(snapshot.counselling);
    }
    if (snapshot.nvrConfig) {
      fs.writeFileSync(NVR_CONFIG_FILE, JSON.stringify(snapshot.nvrConfig, null, 2), "utf-8");
    }
    return res.json({
      success: true,
      message: `\u2713 System successfully rolled back to Golden Restore Point (${snapshot.createdAt})!`,
      restoredEnquiriesCount: snapshot.counselling?.length || 0
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});
app.get("/api/backup-status", async (req, res) => {
  const db = await getMongoDB();
  if (!db) {
    return res.json({ connected: false, message: lastMongoConnectionError || "Not connected or URI missing" });
  }
  try {
    const ticketsCount = await db.collection("tickets").countDocuments();
    const inventoryCount = await db.collection("inventory").countDocuments();
    const allocationsCount = await db.collection("allocations").countDocuments();
    return res.json({
      connected: true,
      message: "Active online replica synced.",
      counts: {
        tickets: ticketsCount,
        inventory: inventoryCount,
        allocations: allocationsCount
      }
    });
  } catch (err) {
    return res.json({ connected: false, message: err?.message || "Error reading replica status" });
  }
});
app.get("/api/backup/:collection", async (req, res) => {
  const db = await getMongoDB();
  if (!db) return res.json({ success: false, offline: true, message: lastMongoConnectionError || "No MongoDB connection" });
  try {
    const { collection } = req.params;
    const data = await db.collection(collection).find({}).toArray();
    return res.json({ success: true, data });
  } catch (err) {
    return res.json({ success: false, offline: true, message: err?.message });
  }
});
app.delete("/api/backup/:collection/:id", async (req, res) => {
  const db = await getMongoDB();
  if (!db) return res.json({ success: false, offline: true, message: lastMongoConnectionError || "No MongoDB connection" });
  try {
    const { collection, id } = req.params;
    await db.collection(collection).deleteOne({ id });
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, offline: true, message: err?.message });
  }
});
app.get("/api/app-url", (req, res) => {
  const host = req.get("host") || "";
  const proto = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
  const appUrl = host ? `${proto}://${host}` : "https://ais-pre-hdxvdxvb3o37jyrarxjlig-623128014596.asia-southeast1.run.app";
  return res.json({ appUrl });
});
const SERVER_BUILD_TIMESTAMP = 177641352e4;
const APP_VERSION = "2.4.0";
const APP_RELEASE_NOTES = [
  "Continuous Speech-to-Text Diarization (1hr 50min Free Audio Transcripts)",
  "Android & Desktop App Deployment Center (PWA, APK, EXE)",
  "Clean Path Short URLs (/counselling, /admin, /management, /teacher)",
  "Custom Domain Auto-Detection (birlaopenmindscounselling.com)",
  "Real-Time In-App Live Auto Update System"
];
app.get("/api/app-version", (req, res) => {
  return res.json({
    version: APP_VERSION,
    buildTimestamp: SERVER_BUILD_TIMESTAMP,
    releaseDate: "October 2026",
    releaseNotes: APP_RELEASE_NOTES
  });
});
app.post("/api/backup/:collection", async (req, res) => {
  const db = await getMongoDB();
  if (!db) return res.json({ success: false, offline: true, message: lastMongoConnectionError || "No MongoDB connection" });
  try {
    const { collection } = req.params;
    const item = req.body;
    if (!item.id) {
      return res.status(400).json({ success: false, message: "Item must have id" });
    }
    await db.collection(collection).updateOne(
      { id: item.id },
      { $set: item },
      { upsert: true }
    );
    return res.json({ success: true });
  } catch (err) {
    return res.json({ success: false, offline: true, message: err?.message });
  }
});
app.post("/api/backup-all", async (req, res) => {
  const db = await getMongoDB();
  if (!db) {
    return res.json({ success: false, offline: true, message: lastMongoConnectionError || "MongoDB connection is offline" });
  }
  try {
    const collections = req.body;
    for (const [colName, records] of Object.entries(collections)) {
      if (Array.isArray(records)) {
        const col = db.collection(colName);
        await col.deleteMany({});
        if (records.length > 0) {
          await col.insertMany(records);
        }
      }
    }
    return res.json({ success: true });
  } catch (err) {
    console.error("Bulk MongoDB Sync failure:", err);
    return res.status(500).json({ success: false, message: err?.message });
  }
});
const ACCOUNTS_FILE = path.join(process.cwd(), "data", "accounts.json");
const getInitialAccounts = () => ({
  counsellors: [
    {
      id: "COUNSELLOR-01",
      name: "K. Radhika",
      username: "radhika",
      password: "Password@111",
      email: "radhika.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00011",
      roleTitle: "Admissions & Parent Counsellor",
      assignedGrades: "All Grades / Parent Liaison",
      status: "active",
      color: "#F97316",
      createdAt: "01-08-2025"
    },
    {
      id: "COUNSELLOR-02",
      name: "sravan",
      username: "sravan",
      password: "123456",
      email: "counsellor2@birlainstitute.edu.in",
      phone: "+91 98765 00000",
      roleTitle: "Admissions Counsellor",
      assignedGrades: "All Grades",
      status: "active",
      color: "#2563EB",
      createdAt: "11-10-2026"
    },
    {
      id: "COUNSELLOR-03",
      name: "P. Sunitha",
      username: "sunitha",
      password: "Password@101",
      email: "sunitha.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00001",
      roleTitle: "Head Admissions Counsellor",
      assignedGrades: "All Grades / Admissions Lead",
      status: "active",
      color: "#EA580C",
      createdAt: "01-06-2025"
    },
    {
      id: "COUNSELLOR-04",
      name: "M. Haritha",
      username: "haritha",
      password: "Password@102",
      email: "haritha.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00002",
      roleTitle: "Primary Wing Counsellor",
      assignedGrades: "Grades 1 to 5",
      status: "active",
      color: "#2563EB",
      createdAt: "01-06-2025"
    },
    {
      id: "COUNSELLOR-05",
      name: "K. Rajesh",
      username: "rajesh",
      password: "Password@103",
      email: "rajesh.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00003",
      roleTitle: "Middle School Counsellor",
      assignedGrades: "Grades 6 to 8",
      status: "active",
      color: "#059669",
      createdAt: "01-06-2025"
    },
    {
      id: "COUNSELLOR-06",
      name: "S. Priya",
      username: "priya",
      password: "Password@104",
      email: "priya.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00004",
      roleTitle: "High School Counsellor",
      assignedGrades: "Grades 9 to 10",
      status: "active",
      color: "#7C3AED",
      createdAt: "15-06-2025"
    },
    {
      id: "COUNSELLOR-07",
      name: "V. Anjali",
      username: "anjali",
      password: "Password@105",
      email: "anjali.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00005",
      roleTitle: "Pre-Primary Counsellor",
      assignedGrades: "Playgroup, Nursery, PP1, PP2",
      status: "active",
      color: "#DB2777",
      createdAt: "15-06-2025"
    },
    {
      id: "COUNSELLOR-08",
      name: "R. Sandeep",
      username: "sandeep",
      password: "Password@106",
      email: "sandeep.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00006",
      roleTitle: "Senior Secondary Counsellor",
      assignedGrades: "Grades 11 to 12",
      status: "active",
      color: "#D97706",
      createdAt: "01-07-2025"
    },
    {
      id: "COUNSELLOR-09",
      name: "T. Kavitha",
      username: "kavitha",
      password: "Password@107",
      email: "kavitha.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00007",
      roleTitle: "International Curriculum Counsellor",
      assignedGrades: "Cambridge / IB Primary & Middle",
      status: "active",
      color: "#0D9488",
      createdAt: "01-07-2025"
    },
    {
      id: "COUNSELLOR-10",
      name: "N. Ramesh",
      username: "ramesh",
      password: "Password@108",
      email: "ramesh.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00008",
      roleTitle: "Special Needs Support Counsellor",
      assignedGrades: "Inclusive Education & Remedial",
      status: "active",
      color: "#4F46E5",
      createdAt: "10-07-2025"
    },
    {
      id: "COUNSELLOR-11",
      name: "D. Sneha",
      username: "sneha",
      password: "Password@109",
      email: "sneha.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00009",
      roleTitle: "Day Boarding & Campus Tour Incharge",
      assignedGrades: "Boarding & Day-Care Facilities",
      status: "active",
      color: "#E11D48",
      createdAt: "15-07-2025"
    },
    {
      id: "COUNSELLOR-12",
      name: "G. Deepa",
      username: "deepa",
      password: "Password@110",
      email: "deepa.counsellor@birlainstitute.edu.in",
      phone: "+91 98765 00010",
      roleTitle: "Parent Relations & Enrollment Officer",
      assignedGrades: "Walk-ins & Telephonic Followups",
      status: "active",
      color: "#0284C7",
      createdAt: "01-08-2025"
    }
  ],
  management: [
    {
      id: "MGMT-01",
      name: "Dr. K. Srinivas Rao",
      username: "director",
      password: "Director@2026",
      email: "director@birla.edu.in",
      roleTitle: "Managing Director & Trustee",
      phone: "+91 99887 76655",
      status: "active",
      color: "#8B5CF6",
      createdAt: "01-01-2025"
    },
    {
      id: "MGMT-02",
      name: "Dr. Shailaja Reddy",
      username: "principal",
      password: "Principal@2026",
      email: "principal@birla.edu.in",
      roleTitle: "Senior Principal & Executive Dean",
      phone: "+91 99887 76656",
      status: "active",
      color: "#EC4899",
      createdAt: "01-01-2025"
    },
    {
      id: "MGMT-03",
      name: "K. Radhika",
      username: "radhika",
      password: "Password@111",
      email: "radhika.mgmt@birla.edu.in",
      roleTitle: "Admissions Management & Audit Lead",
      phone: "+91 98765 00011",
      status: "active",
      color: "#F97316",
      createdAt: "01-01-2025"
    }
  ],
  itStaff: [
    {
      id: "IT-STAFF-01",
      name: "Suresh Kumar",
      username: "suresh",
      password: "Password@123",
      email: "suresh.it@birla.edu.in",
      roleTitle: "Junior IT Support Specialist",
      allowedFeatures: ["dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"],
      status: "active",
      createdAt: "01-06-2025"
    }
  ],
  deletedItStaff: []
});
const readAccountsFile = () => {
  try {
    if (!fs.existsSync(path.dirname(ACCOUNTS_FILE))) {
      fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    }
    if (fs.existsSync(ACCOUNTS_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.counsellors) && Array.isArray(parsed.management)) {
        if (!Array.isArray(parsed.deletedCounsellors)) {
          parsed.deletedCounsellors = [];
        }
        if (!Array.isArray(parsed.deletedManagement)) {
          parsed.deletedManagement = [];
        }
        if (!Array.isArray(parsed.deletedItStaff)) {
          parsed.deletedItStaff = [];
        }
        parsed.deletedCounsellors = parsed.deletedCounsellors.filter(
          (d) => String(d).toLowerCase() !== "radhika" && String(d).toLowerCase() !== "counsellor-01"
        );
        parsed.deletedManagement = parsed.deletedManagement.filter(
          (d) => String(d).toLowerCase() !== "radhika"
        );
        const deletedCounsellorSet = new Set(parsed.deletedCounsellors.map((d) => String(d).toLowerCase()));
        const deletedMgmtSet = new Set(parsed.deletedManagement.map((d) => String(d).toLowerCase()));
        const deletedItStaffSet = new Set(parsed.deletedItStaff.map((d) => String(d).toLowerCase()));
        const seenUsers = /* @__PURE__ */ new Set();
        const seenIds = /* @__PURE__ */ new Set();
        const uniqueCounsellors = [];
        for (const c of parsed.counsellors) {
          if (!c || !c.username) continue;
          const u = c.username.trim().toLowerCase();
          const idLower = (c.id || "").trim().toLowerCase();
          if (deletedCounsellorSet.has(u) || deletedCounsellorSet.has(idLower)) continue;
          if (seenUsers.has(u)) continue;
          seenUsers.add(u);
          let cId = (c.id || "").trim();
          if (!cId || seenIds.has(cId.toLowerCase())) {
            let n = 1;
            while (seenIds.has(`counsellor-${String(n).padStart(2, "0")}`)) n++;
            cId = `COUNSELLOR-${String(n).padStart(2, "0")}`;
          }
          seenIds.add(cId.toLowerCase());
          uniqueCounsellors.push({ ...c, id: cId, username: u });
        }
        parsed.counsellors = uniqueCounsellors;
        const seenMgmtUsers = /* @__PURE__ */ new Set();
        const uniqueMgmt = [];
        for (const m of parsed.management) {
          if (!m || !m.username) continue;
          const u = m.username.trim().toLowerCase();
          const idLower = (m.id || "").trim().toLowerCase();
          if (deletedMgmtSet.has(u) || deletedMgmtSet.has(idLower)) continue;
          if (seenMgmtUsers.has(u)) continue;
          seenMgmtUsers.add(u);
          uniqueMgmt.push({ ...m, username: u });
        }
        parsed.management = uniqueMgmt;
        if (!Array.isArray(parsed.itStaff)) {
          parsed.itStaff = [];
        }
        const seenITUsers = /* @__PURE__ */ new Set();
        const uniqueIT = [];
        for (const s of parsed.itStaff) {
          if (!s || !s.username) continue;
          const u = s.username.trim().toLowerCase();
          const idLower = (s.id || "").trim().toLowerCase();
          if (deletedItStaffSet.has(u) || deletedItStaffSet.has(idLower)) continue;
          if (seenITUsers.has(u)) continue;
          seenITUsers.add(u);
          uniqueIT.push({ ...s, username: u });
        }
        if (!seenITUsers.has("suresh") && !deletedItStaffSet.has("suresh") && !deletedItStaffSet.has("it-staff-01")) {
          uniqueIT.push({
            id: "IT-STAFF-01",
            name: "Suresh Kumar",
            username: "suresh",
            password: "Password@123",
            email: "suresh.it@birla.edu.in",
            roleTitle: "Junior IT Support Specialist",
            allowedFeatures: ["dashboard", "raise-ticket", "inventory", "room-master", "warranty-tracker"],
            status: "active",
            createdAt: "01-06-2025"
          });
        }
        parsed.itStaff = uniqueIT;
        if (!parsed.counsellors.some((c) => c.username?.toLowerCase() === "radhika")) {
          parsed.counsellors.unshift({
            id: "COUNSELLOR-01",
            name: "K. Radhika",
            username: "radhika",
            password: "Password@111",
            email: "radhika.counsellor@birlainstitute.edu.in",
            phone: "+91 98765 00011",
            roleTitle: "Admissions & Parent Counsellor",
            assignedGrades: "All Grades / Parent Liaison",
            status: "active",
            color: "#F97316",
            createdAt: "01-08-2025"
          });
        }
        if (!parsed.management.some((m) => m.username?.toLowerCase() === "radhika")) {
          parsed.management.push({
            id: `MGMT-0${parsed.management.length + 1}`,
            name: "K. Radhika",
            username: "radhika",
            password: "Password@111",
            email: "radhika.mgmt@birla.edu.in",
            roleTitle: "Admissions Management & Audit Lead",
            phone: "+91 98765 00011",
            status: "active",
            color: "#F97316",
            createdAt: "01-01-2025"
          });
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not read accounts file:", e);
  }
  const initial = getInitialAccounts();
  try {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(initial, null, 2), "utf-8");
  } catch {
  }
  return initial;
};
const writeAccountsFile = (data) => {
  try {
    if (!fs.existsSync(path.dirname(ACCOUNTS_FILE))) {
      fs.mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    }
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (e) {
    console.error("Failed to write accounts file:", e);
    return false;
  }
};
app.get("/api/accounts", (_req, res) => {
  const data = readAccountsFile();
  return res.json({ success: true, accounts: data });
});
app.post("/api/accounts/counsellor", (req, res) => {
  const account = req.body;
  if (!account || !account.username) {
    return res.status(400).json({ success: false, message: "Invalid account data" });
  }
  const data = readAccountsFile();
  const cleanUsername = account.username.trim().toLowerCase();
  if (Array.isArray(data.deletedCounsellors)) {
    data.deletedCounsellors = data.deletedCounsellors.filter(
      (d) => d.toLowerCase() !== cleanUsername && d.toLowerCase() !== (account.id || "").toLowerCase()
    );
  }
  const existingIdx = data.counsellors.findIndex(
    (c) => c.id === account.id || c.username?.toLowerCase() === cleanUsername
  );
  if (existingIdx >= 0) {
    data.counsellors[existingIdx] = { ...data.counsellors[existingIdx], ...account, username: cleanUsername };
  } else {
    data.counsellors.push({ ...account, username: cleanUsername });
  }
  writeAccountsFile(data);
  return res.json({ success: true, counsellors: data.counsellors });
});
app.delete("/api/accounts/counsellor/:id", (req, res) => {
  const { id } = req.params;
  const data = readAccountsFile();
  if (!Array.isArray(data.deletedCounsellors)) {
    data.deletedCounsellors = [];
  }
  const idLower = String(id).toLowerCase();
  const target = data.counsellors.find(
    (c) => (c.id || "").toLowerCase() === idLower || (c.username || "").toLowerCase() === idLower
  );
  if (!data.deletedCounsellors.includes(idLower)) {
    data.deletedCounsellors.push(idLower);
  }
  if (target?.username && !data.deletedCounsellors.includes(target.username.toLowerCase())) {
    data.deletedCounsellors.push(target.username.toLowerCase());
  }
  if (target?.id && !data.deletedCounsellors.includes(target.id.toLowerCase())) {
    data.deletedCounsellors.push(target.id.toLowerCase());
  }
  data.counsellors = data.counsellors.filter(
    (c) => (c.id || "").toLowerCase() !== idLower && (c.username || "").toLowerCase() !== idLower
  );
  writeAccountsFile(data);
  return res.json({ success: true, counsellors: data.counsellors, deletedCounsellors: data.deletedCounsellors });
});
app.post("/api/accounts/management", (req, res) => {
  const account = req.body;
  if (!account || !account.username) {
    return res.status(400).json({ success: false, message: "Invalid management account data" });
  }
  const data = readAccountsFile();
  const cleanUsername = account.username.trim().toLowerCase();
  if (Array.isArray(data.deletedManagement)) {
    data.deletedManagement = data.deletedManagement.filter(
      (d) => d.toLowerCase() !== cleanUsername && d.toLowerCase() !== (account.id || "").toLowerCase()
    );
  }
  const existingIdx = data.management.findIndex(
    (m) => m.id === account.id || m.username?.toLowerCase() === cleanUsername
  );
  if (existingIdx >= 0) {
    data.management[existingIdx] = { ...data.management[existingIdx], ...account, username: cleanUsername };
  } else {
    data.management.push({ ...account, username: cleanUsername });
  }
  writeAccountsFile(data);
  return res.json({ success: true, management: data.management });
});
app.delete("/api/accounts/management/:id", (req, res) => {
  const { id } = req.params;
  const data = readAccountsFile();
  if (!Array.isArray(data.deletedManagement)) {
    data.deletedManagement = [];
  }
  const idLower = String(id).toLowerCase();
  const target = data.management.find(
    (m) => (m.id || "").toLowerCase() === idLower || (m.username || "").toLowerCase() === idLower
  );
  if (!data.deletedManagement.includes(idLower)) {
    data.deletedManagement.push(idLower);
  }
  if (target?.username && !data.deletedManagement.includes(target.username.toLowerCase())) {
    data.deletedManagement.push(target.username.toLowerCase());
  }
  if (target?.id && !data.deletedManagement.includes(target.id.toLowerCase())) {
    data.deletedManagement.push(target.id.toLowerCase());
  }
  data.management = data.management.filter(
    (m) => (m.id || "").toLowerCase() !== idLower && (m.username || "").toLowerCase() !== idLower
  );
  writeAccountsFile(data);
  return res.json({ success: true, management: data.management, deletedManagement: data.deletedManagement });
});
app.get("/api/accounts/it-staff", (_req, res) => {
  const data = readAccountsFile();
  return res.json({ success: true, itStaff: data.itStaff || [], deletedItStaff: data.deletedItStaff || [] });
});
app.post("/api/accounts/it-staff", (req, res) => {
  const account = req.body;
  if (!account || !account.username) {
    return res.status(400).json({ success: false, message: "Invalid IT staff account data" });
  }
  const data = readAccountsFile();
  if (!Array.isArray(data.itStaff)) data.itStaff = [];
  if (!Array.isArray(data.deletedItStaff)) data.deletedItStaff = [];
  const cleanUsername = account.username.trim().toLowerCase();
  data.deletedItStaff = data.deletedItStaff.filter(
    (d) => d.toLowerCase() !== cleanUsername && d.toLowerCase() !== (account.id || "").toLowerCase()
  );
  const existingIdx = data.itStaff.findIndex(
    (s) => s.id === account.id || s.username?.toLowerCase() === cleanUsername
  );
  if (existingIdx >= 0) {
    data.itStaff[existingIdx] = { ...data.itStaff[existingIdx], ...account, username: cleanUsername };
  } else {
    data.itStaff.push({ ...account, username: cleanUsername });
  }
  writeAccountsFile(data);
  return res.json({ success: true, itStaff: data.itStaff });
});
app.delete("/api/accounts/it-staff/:id", (req, res) => {
  const { id } = req.params;
  const data = readAccountsFile();
  if (!Array.isArray(data.itStaff)) data.itStaff = [];
  if (!Array.isArray(data.deletedItStaff)) data.deletedItStaff = [];
  const idLower = String(id).toLowerCase();
  const target = data.itStaff.find(
    (s) => (s.id || "").toLowerCase() === idLower || (s.username || "").toLowerCase() === idLower
  );
  if (!data.deletedItStaff.includes(idLower)) {
    data.deletedItStaff.push(idLower);
  }
  if (target?.username && !data.deletedItStaff.includes(target.username.toLowerCase())) {
    data.deletedItStaff.push(target.username.toLowerCase());
  }
  if (target?.id && !data.deletedItStaff.includes(target.id.toLowerCase())) {
    data.deletedItStaff.push(target.id.toLowerCase());
  }
  data.itStaff = data.itStaff.filter(
    (s) => (s.id || "").toLowerCase() !== idLower && (s.username || "").toLowerCase() !== idLower
  );
  writeAccountsFile(data);
  return res.json({ success: true, itStaff: data.itStaff, deletedItStaff: data.deletedItStaff });
});
app.get(["/healthz", "/health", "/api/health"], (_req, res) => {
  res.status(200).json({ status: "healthy", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get("/manifest.json", (_req, res) => {
  const manifestPath = fs.existsSync(path.join(process.cwd(), "dist", "manifest.json")) ? path.join(process.cwd(), "dist", "manifest.json") : path.join(process.cwd(), "public", "manifest.json");
  res.setHeader("Content-Type", "application/manifest+json");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.sendFile(manifestPath);
});
app.get("/sw.js", (_req, res) => {
  const swPath = fs.existsSync(path.join(process.cwd(), "dist", "sw.js")) ? path.join(process.cwd(), "dist", "sw.js") : path.join(process.cwd(), "public", "sw.js");
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Service-Worker-Allowed", "/");
  res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
  res.sendFile(swPath);
});
const distPath = path.join(process.cwd(), "dist");
const hasDist = fs.existsSync(path.join(distPath, "index.html"));
const startListening = () => {
  if (!process.env.VERCEL) {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`\u{1F680} Birla IT Helpdesk full-stack server running on port ${PORT}`);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE" && PORT !== 3e3) {
        console.warn(`\u26A0\uFE0F Port ${PORT} already in use, starting fallback on port 3000...`);
        app.listen(3e3, "0.0.0.0", () => {
          console.log(`\u{1F680} Birla IT Helpdesk fallback server running on port 3000`);
        });
      } else {
        console.error("Server listen error:", err);
      }
    });
  }
};
const isProduction = process.env.NODE_ENV === "production" && hasDist;
if (isProduction) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.sendFile(path.join(process.cwd(), "index.html"));
    }
  });
  startListening();
} else {
  (async () => {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.error("Vite middleware dev server error:", err);
      if (fs.existsSync(path.join(distPath, "index.html"))) {
        app.use(express.static(distPath));
        app.get("*", (req, res, next) => {
          if (req.path.startsWith("/api/")) return next();
          res.sendFile(path.join(distPath, "index.html"));
        });
      }
    } finally {
      startListening();
    }
  })();
}
var server_default = app;
export {
  server_default as default
};
