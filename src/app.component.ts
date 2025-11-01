import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { GeniusService } from './services/genius.service';
import { HomeComponent } from './components/home/home.component';
import { ChatComponent } from './components/chat/chat.component';

/**
 * The root component of the application.
 * It acts as a controller to switch between the 'home' and 'chat' views.
 */
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [HomeComponent, ChatComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  // Injects the central state management service.
  geniusService = inject(GeniusService);
  
  // A signal that determines which view ('home' or 'chat') is currently active.
  currentView = this.geniusService.currentView;
}
