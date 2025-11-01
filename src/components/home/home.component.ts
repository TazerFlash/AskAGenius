import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { GeniusService } from '../../services/genius.service';
import { GeminiService } from '../../services/gemini.service';
import { Scientist } from '../../models/scientist.model';
import { FormsModule } from '@angular/forms';

/**
 * The home component, which serves as the landing page.
 * It displays the list of scientists and allows the user to ask a general question
 * to find the most relevant genius.
 */
@Component({
  selector: 'app-home',
  imports: [FormsModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  geniusService = inject(GeniusService);
  geminiService = inject(GeminiService);
  
  // A signal holding the list of scientists, retrieved from the GeniusService.
  scientists = this.geniusService.scientists;
  // A signal for the user's input in the question search bar.
  question = signal('');
  // A signal to track the loading state when finding the best scientist.
  isLoading = signal(false);
  // A signal to display status messages to the user (e.g., "Finding scientist...").
  statusMessage = signal('');
  
  /**
   * Called when a user clicks on a scientist's card. It starts a chat session
   * with that scientist.
   * @param scientist The scientist object that was clicked.
   */
  selectScientist(scientist: Scientist) {
    const currentQuestion = this.question().trim();
    // If there's a question in the search bar, pass it to the chat view.
    this.geniusService.startChatWithScientist(scientist, currentQuestion ? currentQuestion : null);
    if (currentQuestion) {
      this.question.set('');
    }
  }

  /**
   * Called when the user submits the question form. It uses the GeminiService
   * to find the best scientist to answer the question.
   */
  async submitQuestion() {
    if (!this.question().trim()) return;

    this.isLoading.set(true);
    this.statusMessage.set('Consulting the annals of history...');
    
    // Call the AI to determine the best scientist.
    const bestScientist = await this.geminiService.findBestScientist(this.question(), this.scientists());
    
    if (bestScientist) {
      this.statusMessage.set(`${bestScientist.name}: "I am the best to answer this question."`);
      // Wait a few seconds to show the result before transitioning to the chat.
      setTimeout(() => {
        this.geniusService.startChatWithScientist(bestScientist, this.question());
        this.isLoading.set(false);
        this.statusMessage.set('');
        this.question.set('');
      }, 3000);
    } else {
      // Handle the case where no suitable scientist is found.
      this.statusMessage.set('This topic seems beyond my residents. Please select a genius to learn from their unique style.');
      this.isLoading.set(false);
       setTimeout(() => {
        this.statusMessage.set('');
       }, 5000);
    }
  }
}
