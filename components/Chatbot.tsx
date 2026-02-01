import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot, Loader2, Mic } from 'lucide-react';
import { Button } from './Button';
import { GoogleGenAI, Chat } from "@google/genai";
import { MEDICINES } from '../data/medicines';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
}

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hi, I’m Prescriptly AI. How can I help you today?", sender: 'bot' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const recognitionRef = useRef<any>(null);

  // Auth Checks
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen, isLoading]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false; // Stop after one sentence/command
            recognitionRef.current.interimResults = false;
            recognitionRef.current.lang = 'en-IN'; // Set language to English (India)

            recognitionRef.current.onstart = () => {
                setIsListening(true);
                setSpeechError(null);
            };

            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                if (transcript) {
                    setInput(transcript); // Visual feedback of what was heard
                    handleSend(transcript); // Auto-send as per requirements
                }
            };

            recognitionRef.current.onerror = (event: any) => {
                setIsListening(false);
                console.warn("Speech recognition error:", event.error);
                
                if (event.error === 'not-allowed') {
                    setSpeechError("Microphone access is required for voice input.");
                } else if (event.error === 'no-speech') {
                    setSpeechError("I couldn't hear that clearly. Please try again.");
                } else {
                    setSpeechError("Voice input failed. Please try again.");
                }
                
                // Clear error message after 3 seconds
                setTimeout(() => setSpeechError(null), 3000);
            };

            recognitionRef.current.onend = () => {
                setIsListening(false);
            };
        }
    }
  }, []);

  // Toggle Microphone
  const toggleListening = () => {
    if (!currentUser) {
        navigate('/login', { state: { from: location, message: "Please log in to use voice commands" } });
        return;
    }

    if (!recognitionRef.current) {
        setSpeechError("Speech recognition is not supported in this browser.");
        setTimeout(() => setSpeechError(null), 3000);
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
    } else {
        try {
            recognitionRef.current.start();
        } catch (err) {
            console.error("Failed to start speech recognition:", err);
            recognitionRef.current.stop(); 
        }
    }
  };

  const handleSend = async (textOverride?: string) => {
    // Auth Check
    if (!currentUser) {
        navigate('/login', { state: { from: location, message: "Please log in to use the AI Agent" } });
        return;
    }

    const textToSend = typeof textOverride === 'string' ? textOverride : input;
    if (!textToSend.trim()) return;

    const userMessage: Message = { id: Date.now(), text: textToSend, sender: 'user' };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        if (!chatSessionRef.current) {
            // Build detailed inventory for AI with Rx status
            const inventory = MEDICINES.map(m => 
                `- ${m.name} (${m.category}, ₹${m.price}, ${m.requiresPrescription ? 'Rx-Only' : 'OTC'}, ${m.inStock ? 'In Stock' : 'Out of Stock'})`
            ).join('\n');

            const systemInstruction = `You are Prescriptly AI, a professional pharmacy assistant.
            You are NOT a doctor. You help users find medicines from our inventory.

            INVENTORY:
            ${inventory}

            *** STRICT FORMATTING RULES (NON-NEGOTIABLE) ***

            1. LAYOUT:
               - Use short, clear paragraphs (1-2 lines max).
               - Insert a SINGLE BLANK LINE between every paragraph or section.
               - DO NOT use emojis.
               - DO NOT use markdown headings (like ** or ##).

            2. MEDICINE LISTS:
               - Use a bullet point (•) for each medicine.
               - ONE medicine per line.
               - STRICT FORMAT: • [Name] – ₹[Price] ([Availability])
               - Example:
                 • Dolo 650 – ₹30 (In Stock)

            3. RESPONSE FLOW (For Symptoms):
               - Paragraph 1: Empathy sentence.
               - Paragraph 2: Medical caution/advice (e.g., "Since you have symptoms, please consult a doctor...").
               - Paragraph 3: "To help manage symptoms, we have these OTC options:" (If applicable).
               - [Bulleted List of Medicines]
               - Paragraph 4: Mandatory Disclaimer: "Please follow the instructions on the label and consult a doctor if symptoms persist."
               - Paragraph 5: Closing Question: "Would you like me to add any of these to your cart?"

            *** SAFETY PROTOCOLS ***

            1. EMERGENCY (Chest pain, difficulty breathing, severe bleeding, stroke signs):
               - STOP immediately.
               - Say: "I'm really sorry to hear this.
               
               This sounds serious. Please seek immediate medical attention or call emergency services right away.
               
               I cannot provide medication recommendations for this."

            2. GENERAL / MILD SYMPTOMS:
               - Suggest ONLY OTC (Over-The-Counter) medicines from INVENTORY.
               - Do NOT suggest Rx-Only medicines unless explicitly asked by name.

            *** TONE ***
            - Professional, calm, well-spaced, and easy to scan.
            `;

            chatSessionRef.current = ai.chats.create({
                model: 'gemini-3-flash-preview',
                config: { systemInstruction }
            });
        }

        const result = await chatSessionRef.current.sendMessage({ message: textToSend });
        const botText = result.text;
        
        setMessages(prev => [...prev, { id: Date.now() + 1, text: botText, sender: 'bot' }]);

    } catch (error) {
        console.error("AI Error:", error);
        setMessages(prev => [...prev, { id: Date.now() + 1, text: "I'm having trouble connecting to the server. Please try again later.", sender: 'bot' }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <div className="fixed bottom-6 right-6 z-40 print:hidden">
        <Button 
          onClick={() => setIsOpen(!isOpen)}
          className={`rounded-full w-14 h-14 shadow-xl flex items-center justify-center transition-all duration-300 ${isOpen ? 'bg-slate-900 rotate-90' : 'bg-medical-600 hover:scale-105'}`}
        >
          {isOpen ? <X className="h-6 w-6 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
        </Button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 w-[90vw] md:w-[400px] h-[500px] max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-medical-600 p-4 flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
               <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
               <h3 className="font-bold text-white">Prescriptly AI</h3>
               <p className="text-medical-100 text-xs flex items-center gap-1">
                 <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                 Online
               </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => (
               <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                     msg.sender === 'user' 
                     ? 'bg-medical-600 text-white rounded-br-none' 
                     : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none shadow-sm'
                  }`}>
                     {msg.text}
                  </div>
               </div>
            ))}
            {isLoading && (
               <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl rounded-bl-none border border-slate-200 shadow-sm flex items-center gap-2">
                     <Loader2 className="h-4 w-4 text-medical-600 animate-spin" />
                     <span className="text-xs text-slate-400">Thinking...</span>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100 relative">
             {/* Speech Error Feedback Toast */}
             {speechError && (
                 <div className="absolute top-0 left-0 right-0 -mt-12 px-4 flex justify-center pointer-events-none">
                    <div className="bg-slate-900/90 backdrop-blur text-white text-xs py-1.5 px-3 rounded-full shadow-lg flex items-center gap-2 animate-fade-in-up">
                        <span>{speechError}</span>
                    </div>
                 </div>
             )}

             <div className="flex items-center gap-2">
                <div className={`flex-1 flex items-center gap-2 bg-slate-50 border transition-all duration-200 rounded-xl px-3 py-2 ${isListening ? 'border-red-400 ring-2 ring-red-500/10' : 'border-slate-200 focus-within:border-medical-500 focus-within:ring-2 focus-within:ring-medical-500/20'}`}>
                    <input
                        type="text"
                        placeholder={isListening ? "Listening..." : (currentUser ? "Ask anything..." : "Log in to chat...")}
                        className="flex-1 bg-transparent border-none focus:outline-none text-sm placeholder:text-slate-400"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        disabled={isLoading || isListening}
                    />
                    
                    {/* Mic Button */}
                    <button 
                        onClick={toggleListening}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${
                            isListening 
                            ? 'bg-red-500 text-white animate-pulse shadow-md' 
                            : 'text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                        }`}
                        title="Voice Input"
                        aria-label="Voice input"
                    >
                        <Mic className="h-4 w-4" />
                    </button>
                </div>

                <Button 
                    size="sm" 
                    className={`h-[42px] w-[42px] p-0 rounded-xl flex items-center justify-center ${!input.trim() && !isListening ? 'opacity-50' : ''}`}
                    onClick={() => handleSend()}
                    disabled={(!input.trim() && !isListening) || isLoading}
                >
                    <Send className="h-4 w-4" />
                </Button>
             </div>
             
             {/* Listening Visual Indicator */}
             {isListening && (
                 <div className="absolute bottom-1 left-4">
                     <span className="text-[10px] text-red-500 font-bold tracking-wide animate-pulse">● LISTENING</span>
                 </div>
             )}
          </div>
        </div>
      )}
    </>
  );
};