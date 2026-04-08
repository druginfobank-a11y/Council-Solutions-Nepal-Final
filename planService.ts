
import { GoogleGenAI, Type, Modality, LiveServerMessage, HarmCategory, HarmBlockThreshold, SafetySetting } from "@google/genai";

const safetySettings: SafetySetting[] = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
];

const handleAIError = (error: any) => {
  const errorMsg = String(error?.message || "Connectivity interruption.");
  const msg = errorMsg.toUpperCase();
  
  if (msg.includes("API_KEY") || msg.includes("401")) {
    throw new Error("AUTHORIZATION_REQUIRED");
  }
  if (msg.includes("QUOTA") || msg.includes("429")) {
    throw new Error("Free limit exceed भयो। भोलि फेरि try गर्नुहोस्।");
  }
  throw new Error(`NODE_FAULT: ${errorMsg}`);
};

const getAIClient = () => {
  const key = String(process.env.API_KEY || "");
  if (!key || key.length < 5) throw new Error("AUTHORIZATION_REQUIRED");
  return new GoogleGenAI({ apiKey: key });
};

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeRawPCM(data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length;
  const buffer = ctx.createBuffer(1, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

/** 
 * MCQ SYNTHESIS NODE
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
  const ai = getAIClient();
  try {
    const isEng = council === 'NEC';
    const deptPrompt = isEng 
      ? `Generate ${count} high-yield ENGINEERING MCQs for Nepal Engineering Council (NEC) level: ${program}. Focus on Mathematics, Physics, and ${subject} principles.`
      : `Generate ${count} high-yield ACADEMIC MCQs for ${council} ${program}. Topic: ${topic}.`;

    const prompt = language === 'NEP'
      ? `नेपाल ${council} ${program} level को ${count} वटा उच्चस्तरीय MCQs नेपाली भाषामा बनाऊ। विषय: ${topic}।`
      : `${deptPrompt} Topic: ${topic}. Difficulty: ${difficulty}.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', 
      contents: fileData ? {
        parts: [
          { inlineData: { data: fileData.data.split(',')[1] || fileData.data, mimeType: fileData.mimeType } },
          { text: prompt }
        ]
      } : prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                minItems: 4,
                maxItems: 4
              },
              correctAnswer: { type: Type.INTEGER, description: "Index of correct option (0-3)" },
              explanation: { type: Type.STRING }
            },
            required: ["question", "options", "correctAnswer", "explanation"]
          }
        },
        safetySettings 
      }
    });

    const jsonStr = String(response.text || "").trim();
    if (!jsonStr) throw new Error("Empty response from AI node.");
    return JSON.parse(jsonStr);
  } catch (e) {
    throw handleAIError(e);
  }
};

/** 
 * AI Tutor Response Node
 */
export const getTutorResponse = async (
  query: string, 
  history: { role: 'user' | 'model', content: string }[] = [],
  context?: { program: string, council: string }
) => {
  const ai = getAIClient();
  try {
    const isEng = context?.council === 'NEC';
    const systemInstruction = isEng 
      ? `You are an expert Engineering Tutor for Nepal Engineering Council (NEC) exams. 
         Provide technical engineering data, solve complex mathematical problems step-by-step, 
         and reference standard engineering codes. Your tone is logical, precise, and practical.`
      : `You are a specialized academic tutor for Nepalese Educational Councils (NPC, NMC, NNC, NHPC). 
         Provide technical academic data. Support English and Nepali.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        ...history.map(m => ({ role: m.role, parts: [{ text: String(m.content) }] })),
        { role: 'user', parts: [{ text: String(query) }] }
      ],
      config: { 
        systemInstruction,
        safetySettings 
      }
    });
    return { text: String(response.text || ""), node: isEng ? 'nec-engineering-flash' : 'gemini-3-flash' };
  } catch (e) {
    throw handleAIError(e);
  }
};

export const analyzeAcademicImage = async (base64Image: string, mimeType: string, query: string) => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { 
        parts: [
          { inlineData: { data: base64Image.split(',')[1] || base64Image, mimeType } }, 
          { text: `Academic Analysis Request: ${String(query)}` }
        ] 
      },
      config: { safetySettings }
    });
    return String(response.text || "");
  } catch (e) {
    throw handleAIError(e);
  }
};

export const generateAudioBriefing = async (text: string) => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Academic briefing: ${String(text)}.` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        safetySettings
      }
    });
    return String(response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || "");
  } catch (e) { throw handleAIError(e); }
};

export const generateAcademicVideo = async (prompt: string, onProgress: (msg: string) => void) => {
  const ai = getAIClient();
  try {
    onProgress("Initializing Node...");
    let operation = await ai.models.generateVideos({ 
      model: 'veo-3.1-fast-generate-preview', 
      prompt: `Educational visualization: ${String(prompt)}`, 
      config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } 
    });
    
    const key = String(process.env.API_KEY || "");

    while (!operation.done) {
      onProgress("Synthesizing...");
      await new Promise(resolve => setTimeout(resolve, 8000));
      // Fix: Use operation.name to avoid passing circular internal objects back to the SDK
      operation = await ai.operations.getVideosOperation({ operation });
    }
    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("Synthesis Node failed.");
    const fetchResponse = await fetch(`${videoUri}&key=${key}`);
    const blob = await fetchResponse.blob();
    return URL.createObjectURL(blob);
  } catch (e) { throw handleAIError(e); }
};

export const fetchLiveCouncilNews = async () => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({ 
      model: 'gemini-3-flash-preview', 
      contents: `Recent council notices Nepal (NMC, NPC, NNC, NHPC, NEC Engineering).`, 
      config: { tools: [{ googleSearch: {} }], safetySettings } 
    });
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const citations = chunks.map((c: any) => ({ 
      title: String(c.web?.title || "Source"), 
      uri: String(c.web?.uri || "") 
    })).filter((c: any) => c.uri);
    return [{ title: "Latest Council Sync", content: String(response.text || ""), date: new Date().toLocaleDateString(), citations }];
  } catch (e) { throw handleAIError(e); }
};

export const generateTechnicalDerivation = async (query: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide technical derivation or analysis for: ${String(query)}. Return JSON array: [{diagnosis: "Derivation Node", reasoning, nepaleseContext}]`,
    config: { responseMimeType: "application/json" }
  });
  const text = String(response.text || "[]").trim();
  return JSON.parse(text);
};

export const startLiveVivaSession = async (config: any, callbacks: any) => {
  const ai = getAIClient();
  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  let nextStartTime = 0;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-12-2025',
    callbacks: {
      onopen: () => {
        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const int16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
          sessionPromise.then(s => s.sendRealtimeInput({ audio: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
          const bytes = decode(String(base64Audio));
          const audioBuffer = await decodeRawPCM(bytes, outputAudioContext, 24000);
          const source = outputAudioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(outputAudioContext.destination);
          source.start(nextStartTime);
          nextStartTime += audioBuffer.duration;
        }
      },
      onerror: (e) => callbacks.onError(String(e || "Audio node fault")),
      onclose: () => callbacks.onClose(),
    },
    config: { responseModalities: [Modality.AUDIO], systemInstruction: "Technical Viva Node for Nepalese Academic and Engineering Professionals." }
  });
  return { stop: () => { sessionPromise.then(s => s.close()); stream.getTracks().forEach(t => t.stop()); inputAudioContext.close(); outputAudioContext.close(); } };
};

export const checkTechnicalInteraction = async (componentA: string, componentB: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze technical interaction or conflict between ${String(componentA)} and ${String(componentB)}. Return JSON: {severity, mechanism, recommendations: [], isConflict: boolean}`,
    config: { responseMimeType: "application/json" }
  });
  const text = String(response.text || "{}").trim();
  return JSON.parse(text);
};

export const generateSolutionMatrix = async (problem: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Provide top academic/technical solutions for: ${String(problem)}. Return JSON array: [{solution, probability, reasoning, nepaleseContext}]`,
    config: { responseMimeType: "application/json" }
  });
  const text = String(response.text || "[]").trim();
  return JSON.parse(text);
};

export const generateStudyPlan = async (objective: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a comprehensive study plan for: ${String(objective)}. Return JSON: {assessment, academicObjective, interventions: [], expectedOutcome}`,
    config: { responseMimeType: "application/json" }
  });
  const text = String(response.text || "{}").trim();
  return JSON.parse(text);
};

export const generateAcademicScenario = async (program: string, council: string) => {
  const ai = getAIClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a technical academic scenario for a ${String(program)} student under ${String(council)} council. Return JSON: {studentName, academicHistory, tasks: [{id, component, requirement, isErroneous, errorDetail}]}`,
    config: { responseMimeType: "application/json" }
  });
  const text = String(response.text || "{}").trim();
  return JSON.parse(text);
};
