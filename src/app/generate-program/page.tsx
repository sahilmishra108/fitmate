"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useRef, useState } from "react";
import { Send, User, Bot, Mic, MicOff, Volume2, StopCircle, Sparkles } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

// Add type definition for Web Speech API
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitSpeechRecognition: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SpeechRecognition: any;
  }
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUESTIONS = [
  "What is your primary fitness goal? For example, lose weight, build muscle, improve endurance, or general fitness",
  "What is your current fitness level? Beginner, intermediate, or advanced",
  "How many days per week can you commit to working out?",
  "Do you have access to a gym, or will you be working out at home?",
  "What equipment do you have available? For example, dumbbells, resistance bands, or none",
  "Do you have any injuries or physical limitations I should know about?",
  "What is your age and gender? This helps me tailor the program",
  "What are your dietary preferences? For example, vegetarian, vegan, or no restrictions",
];

const GenerateProgramPage = () => {
  const { user } = useUser();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
    }

    // Initialize Speech Recognition
    if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);

        // Auto-submit after voice input
        setTimeout(() => {
          handleVoiceSubmit(transcript);
        }, 500);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setInput("");
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakMessage = (text: string, callback?: () => void) => {
    if (!synthRef.current) {
      callback?.();
      return;
    }

    if (isSpeaking) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      setIsSpeaking(false);
      callback?.();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      callback?.();
    };

    setIsSpeaking(true);
    synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const startQuestionnaire = () => {
    setHasStarted(true);

    const welcomeMessage = "Great! Let's create your personalized fitness program. I'll ask you a few questions to understand your goals and needs better.";
    const firstQuestion = QUESTIONS[0];

    setMessages([
      { role: "assistant", content: welcomeMessage },
      { role: "assistant", content: firstQuestion }
    ]);

    // Speak welcome and first question, then auto-enable mic
    speakMessage(welcomeMessage + " " + firstQuestion, () => {
      // Auto-start listening after AI finishes speaking
      setTimeout(() => {
        if (recognitionRef.current && !isListening) {
          recognitionRef.current.start();
          setIsListening(true);
        }
      }, 500);
    });
  };

  const handleVoiceSubmit = async (transcript: string) => {
    if (!transcript.trim() || !hasStarted) return;

    const userMessage: Message = { role: "user", content: transcript };
    setMessages((prev) => [...prev, userMessage]);

    const newAnswers = [...userAnswers, transcript];
    setUserAnswers(newAnswers);

    setInput("");
    setIsLoading(true);

    // Check if we have more questions
    if (currentQuestionIndex < QUESTIONS.length - 1) {
      setTimeout(() => {
        const nextQuestion = QUESTIONS[currentQuestionIndex + 1];
        setMessages((prev) => [...prev, { role: "assistant", content: nextQuestion }]);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setIsLoading(false);

        // Speak next question and auto-enable mic
        speakMessage(nextQuestion, () => {
          setTimeout(() => {
            if (recognitionRef.current && !isListening) {
              recognitionRef.current.start();
              setIsListening(true);
            }
          }, 500);
        });
      }, 500);
    } else {
      const generatingMsg = "Perfect! I have all the information I need. Let me create your personalized fitness program now.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: generatingMsg
      }]);

      speakMessage(generatingMsg);

      setTimeout(() => {
        generateFinalPlan(newAnswers);
      }, 2000);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !hasStarted) return;
    await handleVoiceSubmit(input);
  };

  const generateFinalPlan = async (answers: string[]) => {
    setIsGeneratingPlan(true);
    setIsLoading(true);

    const prompt = `Based on the following user information, create a comprehensive fitness program with both a workout plan and a diet plan. Format the response as a detailed, structured plan.

User Information:
1. Primary Goal: ${answers[0]}
2. Fitness Level: ${answers[1]}
3. Days per Week: ${answers[2]}
4. Location: ${answers[3]}
5. Equipment: ${answers[4]}
6. Injuries/Limitations: ${answers[5]}
7. Age/Gender: ${answers[6]}
8. Dietary Preferences: ${answers[7]}

Please provide:
1. A detailed workout plan with specific exercises, sets, reps, and weekly schedule
2. A comprehensive diet plan with meal suggestions and macronutrient guidelines
3. Additional tips for success

Format the response clearly with sections for Workout Plan and Diet Plan.`;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const data = await response.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);

        const completionMsg = "I've created your personalized fitness program! Let me save it to your profile.";
        speakMessage(completionMsg);

        await savePlanToProfile(data.content, answers);
      }
    } catch (error) {
      console.error("Error generating plan:", error);
      const errorMsg = "I apologize, but I encountered an error generating your plan. Please try again.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: errorMsg
      }]);
      speakMessage(errorMsg);
    } finally {
      setIsLoading(false);
      setIsGeneratingPlan(false);
    }
  };

  const savePlanToProfile = async (planContent: string, answers: string[]) => {
    if (!user) return;

    try {
      const workoutMatch = planContent.match(/workout plan[:\s]*([\s\S]*?)(?=diet plan|$)/i);
      const dietMatch = planContent.match(/diet plan[:\s]*([\s\S]*?)(?=additional tips|$)/i);

      const workoutPlan = workoutMatch ? workoutMatch[1].trim() : planContent;
      const dietPlan = dietMatch ? dietMatch[1].trim() : "See full plan above";

      const response = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkId: user.id,
          name: `${answers[0]} - ${new Date().toLocaleDateString()}`,
          workoutPlan: { content: workoutPlan, answers },
          dietPlan: { content: dietPlan },
          isActive: true,
        }),
      });

      if (response.ok) {
        const successMsg = "Your personalized fitness program has been saved to your profile! You can view it anytime from your profile page.";
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `✅ ${successMsg}`
        }]);

        speakMessage(successMsg);

        setTimeout(() => {
          router.push("/profile");
        }, 3000);
      }
    } catch (error) {
      console.error("Error saving plan:", error);
      const errorMsg = "Your plan was generated but I couldn't save it to your profile. Please try again.";
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: errorMsg
      }]);
      speakMessage(errorMsg);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-foreground overflow-hidden pb-6 pt-24">
      <div className="container mx-auto px-4 h-full max-w-4xl flex flex-col flex-grow">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold font-mono">
            <span>Generate Your </span>
            <span className="text-primary uppercase">Fitness Program</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Have a voice conversation with AI to create your plan
          </p>
        </div>

        <Card className="flex-grow flex flex-col bg-card/90 backdrop-blur-sm border border-border overflow-hidden h-[600px]">
          <div className="flex-grow overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {!hasStarted ? (
              <div className="text-center py-20">
                <Bot className="h-16 w-16 mx-auto mb-6 text-primary animate-pulse" />
                <h2 className="text-2xl font-bold mb-4">Ready for a Voice Conversation?</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  Click start and I&apos;ll ask you questions. Just speak your answers naturally - it&apos;s like talking to a real person!
                </p>
                <Button
                  onClick={startQuestionnaire}
                  size="lg"
                  className="bg-primary text-primary-foreground px-8 py-6 text-lg font-medium"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Voice Conversation
                </Button>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                        }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1 opacity-70 text-xs">
                        <div className="flex items-center gap-2">
                          {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                          <span>{msg.role === "user" ? "You" : "FitMate AI"}</span>
                        </div>
                        {msg.role === "assistant" && (
                          <button
                            onClick={() => speakMessage(msg.content)}
                            className="hover:text-primary transition-colors"
                            title="Read aloud"
                          >
                            <Volume2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted text-foreground rounded-lg p-3 flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <span className="animate-pulse">
                        {isGeneratingPlan ? "Creating your personalized plan..." : "Thinking..."}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {hasStarted && !isGeneratingPlan && (
            <div className="p-4 border-t border-border bg-background/50">
              <div className="flex gap-2 items-center">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={toggleListening}
                  className={`${isListening ? "bg-green-500/20 text-green-500 border-green-500 animate-pulse" : ""}`}
                  title={isListening ? "Listening..." : "Click to speak"}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>

                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={isListening ? "Listening..." : "Or type your answer..."}
                  className="flex-grow"
                  disabled={isLoading || isListening}
                />

                {isSpeaking && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={stopSpeaking}
                    className="text-red-500 hover:text-red-600 hover:bg-red-100/10"
                  >
                    <StopCircle className="h-4 w-4" />
                  </Button>
                )}

                <Button onClick={handleSendMessage} disabled={isLoading || !input.trim() || isListening}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {isListening ? "🎤 Listening... Speak now!" : `Question ${currentQuestionIndex + 1} of ${QUESTIONS.length}`}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GenerateProgramPage;