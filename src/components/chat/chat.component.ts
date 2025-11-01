import { Component, ChangeDetectionStrategy, inject, signal, OnInit, effect, viewChild, ElementRef, untracked, OnDestroy } from '@angular/core';
import { GeniusService } from '../../services/genius.service';
import { GeminiService } from '../../services/gemini.service';
import { FormsModule } from '@angular/forms';
import { ChatMessage } from '../../models/scientist.model';

/**
 * The main chat component where users interact with the selected scientist AI.
 * It handles message display, sending new messages, audio playback of responses,
 * and displaying generated videos.
 */
@Component({
  selector: 'app-chat',
  imports: [FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent implements OnInit, OnDestroy {
  // Injected services for state and AI interaction.
  geniusService = inject(GeniusService);
  geminiService = inject(GeminiService);

  // Signals for managing component state, derived from the central service.
  scientist = this.geniusService.selectedScientist;
  chatHistory = this.geniusService.chatHistory;
  newMessage = signal(''); // Bound to the user's message input field.
  isLoading = signal(false); // Tracks whether a response from the AI is pending.
  
  // A reference to the chat container div for automatic scrolling.
  chatContainer = viewChild<ElementRef<HTMLDivElement>>('chatContainer');
  
  // Web Speech API for text-to-speech functionality.
  private synth = window.speechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  // State signals for managing audio playback UI.
  audioPlayingIndex = signal<number | null>(null); // Index of the message being played.
  isAudioPaused = signal(false); // Tracks if the audio is paused.

  constructor() {
    // An effect that automatically scrolls the chat container to the bottom
    // whenever the chat history changes.
    effect(() => {
        const container = this.chatContainer();
        if (container) {
            // `untracked` is used to prevent this effect from re-running if the scroll
            // position itself were a signal, avoiding potential infinite loops.
            untracked(() => {
                setTimeout(() => container.nativeElement.scrollTop = container.nativeElement.scrollHeight, 0);
            });
        }
    });
  }

  /**
   * On component initialization, starts the chat with the selected scientist
   * and sends any initial question passed from the home page.
   */
  ngOnInit() {
    const selectedScientist = this.scientist();
    if (selectedScientist) {
      this.geminiService.startChat(selectedScientist);
      const initialQuestion = this.geniusService.initialQuestion();
      if (initialQuestion) {
        this.geniusService.initialQuestion.set(null); // Clear after use
        this.sendMessage(initialQuestion);
      }
    }
  }

  /**
   * On component destruction, cleans up resources to prevent memory leaks.
   * This includes stopping any active speech synthesis and revoking object URLs
   * created for video blobs.
   */
  ngOnDestroy() {
    this.stopAudio();
    // Revoke any video blob URLs to prevent memory leaks.
    this.chatHistory().forEach(message => {
        if (message.videoUrl && message.videoUrl.startsWith('blob:')) {
            URL.revokeObjectURL(message.videoUrl);
        }
    });
  }
  
  /**
   * Stops any ongoing or paused speech synthesis and resets the audio state signals.
   */
  private stopAudio(): void {
    // If there's a current utterance, remove its listeners to prevent it
    // from triggering state changes after we've decided to stop it.
    if (this.currentUtterance) {
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
      this.currentUtterance = null;
    }
    
    // Cancel any ongoing or paused speech synthesis.
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
    }

    // Reset component state signals.
    this.audioPlayingIndex.set(null);
    this.isAudioPaused.set(false);
  }

  /**
   * Handles text-to-speech generation for a given message.
   * It toggles play/pause functionality for the currently active audio
   * or starts playing a new message's audio.
   * @param text The text content of the message to speak.
   * @param index The index of the message in the chat history.
   */
  generateAudio(text: string, index: number): void {
    const isCurrentlyActive = this.audioPlayingIndex() === index;

    if (isCurrentlyActive) {
      // Toggling the state of the currently active audio.
      if (this.synth.paused) {
        this.isAudioPaused.set(false);
        this.synth.resume();
      } else {
        this.isAudioPaused.set(true);
        this.synth.pause();
      }
    } else {
      // A new message has been selected for audio playback.
      this.stopAudio(); // Stop any currently playing audio first.

      // Create and configure a new speech utterance.
      this.currentUtterance = new SpeechSynthesisUtterance(text);
      
      this.currentUtterance.onend = () => {
        // When speech finishes naturally, reset the audio state.
        if (this.audioPlayingIndex() === index) {
            this.audioPlayingIndex.set(null);
            this.isAudioPaused.set(false);
            this.currentUtterance = null;
        }
      };
      
      this.currentUtterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.stopAudio(); // Stop everything on error.
      };
      
      // Update state and start speaking.
      this.audioPlayingIndex.set(index);
      this.isAudioPaused.set(false);
      this.synth.speak(this.currentUtterance);
    }
  }

  /**
   * Sends a message from the user to the AI and handles the response.
   * @param messageOverride An optional string to send instead of the input field value.
   */
  async sendMessage(messageOverride: string | null = null) {
    const messageText = messageOverride ?? this.newMessage().trim();
    if (!messageText || this.isLoading()) return;

    this.isLoading.set(true);
    this.stopAudio(); // Stop any audio before sending a new message.
    
    // Add the user's message to the chat history.
    this.geniusService.addMessage({ sender: 'user', text: messageText });

    if (!messageOverride) {
      this.newMessage.set('');
    }
    
    // Add a temporary "thinking" placeholder for the AI's response.
    const aiMessageIndex = this.chatHistory().length;
    this.geniusService.addMessage({ sender: 'ai', text: '...', videoStatus: 'idle' });

    // Send the message to the Gemini service.
    const response = await this.geminiService.sendMessage(messageText);

    // Update the placeholder message with the actual response text.
    this.updateMessage(aiMessageIndex, { 
        text: response.text,
    });

    // If the response includes a video prompt, start the generation process.
    if (response.videoPrompt) {
        this.updateMessage(aiMessageIndex, {
            videoPrompt: response.videoPrompt,
            videoStatus: 'generating'
        });
        this.generateVideo(aiMessageIndex, response.videoPrompt);
    }
    
    this.isLoading.set(false);
  }

  /**
   * Navigates the user back to the home screen (scientist gallery).
   */
  goBack() {
    this.geniusService.goHome();
  }

  /**
   * Initiates the video generation process for a specific message.
   * @param messageIndex The index of the message to update with video status.
   * @param videoPrompt The prompt to send to the video generation API.
   */
  private async generateVideo(messageIndex: number, videoPrompt: string) {
      try {
        const result = await this.geminiService.generateVideoFromPrompt(videoPrompt);
        
        if (result.videoUrl) {
            this.updateMessage(messageIndex, { videoStatus: 'done', videoUrl: result.videoUrl });
            // Automatically play the audio explanation when the video is ready.
            const message = this.chatHistory()[messageIndex];
            this.generateAudio(message.text, messageIndex);
        } else {
            this.updateMessage(messageIndex, { videoStatus: 'error', errorMessage: result.error || 'Failed to generate video.' });
        }
      } catch (error: any) {
        this.updateMessage(messageIndex, { videoStatus: 'error', errorMessage: error.message || 'An error occurred.' });
      }
  }

  /**
   * A helper function to immutably update a message in the chat history.
   * @param index The index of the message to update.
   * @param update A partial ChatMessage object with the fields to change.
   */
  private updateMessage(index: number, update: Partial<ChatMessage>) {
    this.geniusService.chatHistory.update(history => {
        const newHistory = [...history];
        if (newHistory[index]) {
            newHistory[index] = { ...newHistory[index], ...update };
        }
        return newHistory;
    });
  }
}
