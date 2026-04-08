
import OpenAI from "openai";
import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * GROQ CLIENT INITIALIZATION
 * Groq provides high-speed Llama 3 models with a generous free tier.
 */
const getGroqClient = () => {
  const key = String(
    process.env.GROQ_API_KEY || 
    (import.meta as any).env?.VITE_GROQ_API_KEY || 
    ""
  );
  
  if (!key || key.length < 5) {
    console.error("Groq API Key is missing. Please set GROQ_API_KEY in your environment.");
    throw new Error("AUTHORIZATION_REQUIRED");
  }

  return new OpenAI({
    apiKey: key,
    dangerouslyAllowBrowser: true,
    baseURL: "https://api.groq.com/openai/v1"
  });
};

// Helper to hash strings for cache keys
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

const getCache = async (collection: string, key: string) => {
  try {
    const cacheRef = doc(db, "ai_cache", `${collection}_${hashString(key)}`);
    const snap = await getDoc(cacheRef);
    if (snap.exists()) {
      const data = snap.data();
      const isExpired = (Date.now() - data.timestamp) > (7 * 24 * 60 * 60 * 1000);
      if (!isExpired) return data.response;
    }
  } catch (e) {
    console.warn("Cache read fault:", e);
  }
  return null;
};

const setCache = async (collection: string, key: string, response: any) => {
  try {
    const cacheRef = doc(db, "ai_cache", `${collection}_${hashString(key)}`);
    await setDoc(cacheRef, {
      response,
      timestamp: Date.now(),
      originalKey: key.substring(0, 100)
    });
  } catch (e) {
    console.warn("Cache write fault:", e);
  }
};

const handleAIError = (error: any) => {
  const errorMsg = String(error?.message || "Connectivity interruption.");
  const msg = errorMsg.toUpperCase();
  
  if (msg.includes("API_KEY") || msg.includes("401")) {
    throw new Error("AUTHORIZATION_REQUIRED");
  }
  if (msg.includes("RATE_LIMIT") || msg.includes("429")) {
    throw new Error("GROQ_LIMIT_EXCEEDED: Free tier limit reached. Please wait a minute or upgrade your key.");
  }
  throw new Error(`AI_NODE_FAULT: ${errorMsg}`);
};

/** 
 * MCQ SYNTHESIS NODE (Llama 3.3 70B)
 */
export const generateMCQs = async (
  topic: string, 
  count: number = 10, 
  program: string = 'Diploma', 
  council: string = 'General', 
  subject?: string, 
  fileData?: { data: string, mimeType: string }, 
  difficulty: string = 'Medium',
  unit?: string,
  language: 'ENG' | 'NEP' = 'ENG'
) => {
  const cacheKey = `groq_mcqs_${topic}_${count}_${program}_${council}_${subject}_${difficulty}_${language}`;
  const cached = await getCache("mcqs", cacheKey);
  if (cached && !fileData) return cached;

  const groq = getGroqClient();
  
  try {
    const systemPrompt = `You are a professional medical/engineering examiner for Nepalese Councils (${council}). Generate ${count} high-yield MCQs.
    Difficulty: ${difficulty}.
    Language: ${language === 'NEP' ? 'Nepali (Unicode)' : 'English'}.
    Return ONLY a JSON array of objects.
    Schema: [{"question": "...", "options": ["A", "B", "C", "D"], "correctAnswer": 0, "explanation": "..."}]`;

    const userPrompt = fileData 
      ? `Analyze the attached context and generate ${count} questions based on it. Topic: ${topic}.`
      : `Generate ${count} questions about: ${topic}. Program: ${program}. Subject: ${subject || 'General'}. Unit: ${unit || 'N/A'}.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    // If there's an image, use Llama 3.2 Vision
    const model = fileData?.mimeType.startsWith('image/') ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";
    
    if (fileData?.mimeType.startsWith('image/')) {
      messages[1].content = [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: fileData.data } }
      ];
    }

    const completion = await groq.chat.completions.create({
      messages,
      model,
      response_format: { type: "json_object" },
      temperature: 0.7
    });

    const content = completion.choices[0].message.content;
    const result = JSON.parse(content || "{}");
    const mcqs = Array.isArray(result) ? result : (result.mcqs || result.questions || result.data || []);
    
    if (mcqs.length > 0) {
      if (!fileData) await setCache("mcqs", cacheKey, mcqs);
      return mcqs;
    }
    throw new Error("Empty AI response.");
  } catch (e) {
    throw handleAIError(e);
  }
};

/** 
 * AI TUTOR RESPONSE NODE (Llama 3.3 70B)
 */
export const getTutorResponse = async (
  query: string, 
  history: { role: 'user' | 'model', content: string }[] = [],
  context?: { program: string, council: string }
) => {
  const cacheKey = `groq_tutor_${query}_${context?.program}_${context?.council}`;
  if (history.length === 0) {
    const cached = await getCache("tutor", cacheKey);
    if (cached) return cached;
  }

  const groq = getGroqClient();
  try {
    const systemInstruction = `You are a specialized academic tutor for Nepalese Educational Councils (NPC, NMC, NNC, NHPC, NEC). 
    Support English and Nepali. Be concise, professional, and accurate. 
    Current Context: ${context?.council} - ${context?.program}.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user' as any, content: m.content })),
        { role: "user", content: query }
      ],
      model: "llama-3.3-70b-versatile",
    });

    const result = { text: String(completion.choices[0].message.content || ""), node: 'llama-3.3-70b' };
    if (history.length === 0) await setCache("tutor", cacheKey, result);
    return result;
  } catch (e) {
    throw handleAIError(e);
  }
};

/**
 * IMAGE ANALYSIS (Llama 3.2 Vision)
 */
export const analyzeAcademicImage = async (base64Image: string, mimeType: string, query: string) => {
  const groq = getGroqClient();
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Academic Analysis Request: ${query}` },
            { type: "image_url", image_url: { url: base64Image } }
          ]
        }
      ],
      model: "llama-3.2-11b-vision-preview",
    });
    return String(completion.choices[0].message.content || "");
  } catch (e) {
    throw handleAIError(e);
  }
};

/**
 * AUDIO BRIEFING (Browser Native TTS - Free)
 */
export const generateAudioBriefing = async (text: string) => {
  return text;
};

// Helper for UI to trigger native TTS
export const speakText = (text: string, onEnd?: () => void) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.onend = onEnd || null;
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes('Google') && v.lang.includes('en')) || voices[0];
  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
};

/**
 * NEWS FETCH (Static/Mock since Groq doesn't have Search Grounding for free)
 */
export const fetchLiveCouncilNews = async () => {
  return [
    { 
      title: "Council Update Node", 
      content: "Official notices are synchronized daily. Please check the respective council websites (NMC/NPC/NNC) for the latest PDF bulletins.", 
      date: new Date().toLocaleDateString(), 
      citations: [] 
    }
  ];
};

/**
 * STUDY PLAN GENERATION
 */
export const generateStudyPlan = async (objective: string) => {
  const groq = getGroqClient();
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Generate a structured study plan in JSON format: {assessment, academicObjective, interventions: [], expectedOutcome}" },
        { role: "user", content: `Objective: ${objective}` }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0].message.content || "{}");
  } catch (e) {
    throw handleAIError(e);
  }
};

/**
 * EXAM COUNTDOWN TASKS
 */
export const generateStudyCountdown = async (weaknesses: Record<string, number>, program: string) => {
  const groq = getGroqClient();
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Generate a 30-day study schedule JSON array: [{text, priority: 'High'|'Medium'|'Low'}]" },
        { role: "user", content: `Program: ${program}. Weaknesses: ${JSON.stringify(weaknesses)}` }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return result.tasks || result.data || result;
  } catch (e) {
    throw handleAIError(e);
  }
};

/**
 * FLASHCARDS
 */
export const generateFlashcards = async (subjects: string, count: number = 5) => {
  const groq = getGroqClient();
  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "Generate flashcards in JSON array: [{question, answer}]" },
        { role: "user", content: `Subjects: ${subjects}. Count: ${count}` }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });
    const result = JSON.parse(completion.choices[0].message.content || "{}");
    return result.flashcards || result.data || result;
  } catch (e) {
    throw handleAIError(e);
  }
};

export const startLiveVivaSession = async () => { throw new Error("Feature requires Gemini Live API (Disabled)"); };
export const generateAcademicVideo = async () => { throw new Error("Feature requires Veo API (Disabled)"); };
export const checkTechnicalInteraction = async () => { throw new Error("Feature requires Gemini Reasoning (Disabled)"); };
export const generateTechnicalDerivation = async () => { throw new Error("Feature requires Gemini Reasoning (Disabled)"); };
export const generateSolutionMatrix = async () => { throw new Error("Feature requires Gemini Reasoning (Disabled)"); };
export const generateAcademicScenario = async () => { throw new Error("Feature requires Gemini Reasoning (Disabled)"); };
export async function startPatientSimulation() { throw new Error("Feature Disabled"); }
export async function sendPatientMessage() { throw new Error("Feature Disabled"); }
