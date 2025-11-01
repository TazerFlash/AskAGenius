import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Chat } from '@google/genai';
import { Scientist } from '../models/scientist.model';
import { GeniusService } from './genius.service';

/**
 * Defines the structure of a response from the AI chat, which may include
 * a prompt for video generation.
 */
export interface ChatResponse {
  text: string; // The main text response from the AI.
  videoPrompt?: string; // An optional, extracted prompt for video generation.
}

/**
 * A service responsible for all interactions with the Google Gemini API.
 * This includes finding the best scientist, managing chat sessions, and generating videos.
 */
@Injectable({ providedIn: 'root' })
export class GeminiService {
  private ai: GoogleGenAI;
  private geniusService = inject(GeniusService);
  private chat: Chat | null = null; // Holds the active chat session object.

  constructor() {
    // Retrieves the API key from environment variables and initializes the Gemini client.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY environment variable not set');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Uses the Gemini API to determine the most suitable scientist to answer a given question.
   * @param question The user's question.
   * @param scientists The list of available scientists.
   * @returns A promise that resolves to the best Scientist object, or null if none are suitable.
   */
  async findBestScientist(question: string, scientists: Scientist[]): Promise<Scientist | null> {
    const model = 'gemini-2.5-flash';
    // Creates a simplified list of scientists and their specializations for the prompt.
    const scientistList = scientists.map(s => `${s.name}: Specializes in ${s.discoveries}`).join('\n');
    
    // Prompt engineering: Asks the model to act as a router.
    const prompt = `
      Given the user's question, who is the best scientist to answer it from the following list?
      Only respond with the full name of the scientist and nothing else. If no one is a good fit, respond with "None".

      List of Scientists:
      ${scientistList}

      User Question: "${question}"
    `;

    try {
      const response = await this.ai.models.generateContent({ model, contents: prompt });
      const bestScientistName = response.text.trim();
      
      if (bestScientistName.toLowerCase() === 'none') {
        return null;
      }

      // Finds the corresponding scientist object from the response text.
      return scientists.find(s => s.name.toLowerCase() === bestScientistName.toLowerCase()) || null;
    } catch (error) {
      console.error('Error finding best scientist:', error);
      return null;
    }
  }

  /**
   * Initializes a new chat session with the specified scientist's persona.
   * @param scientist The scientist who will be the AI's persona.
   */
  startChat(scientist: Scientist): void {
     this.chat = this.ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            // The knowledgeBase from the scientist object is used as the system instruction.
            systemInstruction: scientist.knowledgeBase,
        },
     });
  }

  /**
   * Sends a message to the currently active chat session.
   * It also parses the response for a special <VIDEO_PROMPT> tag.
   * @param message The user's message text.
   * @returns A promise that resolves to a ChatResponse object.
   */
  async sendMessage(message: string): Promise<ChatResponse> {
    if (!this.chat) {
      throw new Error('Chat not initialized. Call startChat first.');
    }
    try {
      const response = await this.chat.sendMessage({ message });
      const rawText = response.text;
      
      // Regex to find and extract the video prompt from the AI's response.
      const videoPromptRegex = /<VIDEO_PROMPT>(.*?)<\/VIDEO_PROMPT>/s;
      const match = rawText.match(videoPromptRegex);

      if (match && match[1]) {
        const videoPrompt = match[1].trim();
        const text = rawText.replace(videoPromptRegex, '').trim();
        return { text, videoPrompt };
      }

      // If no video prompt is found, return the text as is.
      return { text: rawText };
    } catch (error) {
      console.error('Error sending message:', error);
      return { text: "I apologize, but I've encountered an error and cannot respond at this moment." };
    }
  }

  /**
   * Generates a video based on a text prompt using the Veo model.
   * This handles the long-running operation by polling for completion.
   * @param videoPrompt The text prompt for the video.
   * @returns A promise resolving to an object with either a videoUrl or an error message.
   */
  async generateVideoFromPrompt(videoPrompt: string): Promise<{ videoUrl: string | undefined; error?: string }> {
      try {
          // Starts the video generation process. This returns an operation object immediately.
          let operation = await this.ai.models.generateVideos({
              model: 'veo-2.0-generate-001',
              prompt: videoPrompt,
              config: {
                  numberOfVideos: 1,
              },
          });

          // Polls the operation status until it's 'done'.
          while (!operation.done) {
              await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
              operation = await this.ai.operations.getVideosOperation({ operation: operation });
          }

          // Handle potential errors during generation.
          if (operation.error) {
            console.error('Video generation operation failed:', operation.error);
            const message = (operation.error as any).message;
            return { videoUrl: undefined, error: (message && typeof message === 'string') ? message : 'Video generation failed.' };
          }

          const uri = operation.response?.generatedVideos?.[0]?.video?.uri;
          if (!uri) {
            return { videoUrl: undefined, error: 'Video URI not found in response.' };
          }
          
          const apiKey = process.env.API_KEY;
          if (!apiKey) {
            throw new Error('API_KEY environment variable not set for video download.');
          }
          // The download URL requires the API key to be appended.
          const downloadUrl = `${uri}&key=${apiKey}`;

          // Fetch the video data and create a local blob URL for playback.
          const videoResponse = await fetch(downloadUrl);
          if (!videoResponse.ok) {
              throw new Error(`Failed to download video file: ${videoResponse.statusText}`);
          }
          
          const videoBlob = await videoResponse.blob();
          const videoUrl = URL.createObjectURL(videoBlob);

          return { videoUrl };

      } catch (error) {
          console.error('Error generating video:', error);
          const message = (error as any)?.message;
          return { videoUrl: undefined, error: (message && typeof message === 'string') ? message : 'An unexpected error occurred during video generation.' };
      }
  }
}
