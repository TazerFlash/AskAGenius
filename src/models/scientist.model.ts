/**
 * Represents the data structure for a single scientist (genius).
 */
export interface Scientist {
  id: string; // Unique identifier for the scientist.
  name: string; // Full name of the scientist.
  image: string; // URL to the scientist's portrait.
  bio: string; // A short, one-sentence biography.
  discoveries: string; // A comma-separated list of key discoveries.
  knowledgeBase: string; // The detailed system prompt for the AI, defining its persona.
  imagePosition?: string; // Optional CSS value for `object-position` to focus the image correctly.
  greeting?: string; // The initial greeting message when a chat starts.
}

/**
 * Represents a single message within a chat conversation.
 */
export interface ChatMessage {
  sender: 'user' | 'ai'; // Who sent the message.
  text: string; // The content of the message.
  videoUrl?: string; // A blob URL for a generated video, if any.
  videoStatus?: 'idle' | 'generating' | 'done' | 'error'; // The current status of video generation.
  errorMessage?: string; // An error message if video generation fails.
  videoPrompt?: string; // The prompt used to generate the video.
}
