import { Component, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuixService } from './services/quix.service';
import { Stream, QuixEvent, ParameterData, Data } from './models';
import { ActiveStreamsComponent } from './components/active-streams/active-streams.component';
import { LiveDataComponent } from './components/live-data/live-data.component';
import { EventsComponent } from './components/events/events.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, ActiveStreamsComponent, LiveDataComponent, EventsComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly quixService = inject(QuixService);

  // Reactive state using signals
  readonly activeStreams = signal<Stream[]>([]);
  readonly latestEvent = signal<QuixEvent | null>(null);
  readonly latestData = signal<ParameterData | null>(null);
  readonly inputTopic = signal('');
  readonly inputValue = signal('');
  readonly isLoading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.initializeQuixConnection();
  }

  private async initializeQuixConnection(): Promise<void> {
    try {
      await this.quixService.getWorkspaceIdAndToken();
      await this.quixService.startConnection();

      const topic = await this.quixService.fetchConfig('input_topic');
      this.inputTopic.set(topic);

      this.setupSubscriptions(topic);
      this.isLoading.set(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      this.error.set(message);
      this.isLoading.set(false);
    }
  }

  private setupSubscriptions(topic: string): void {
    this.quixService.subscribeToActiveStreams(
      (stream) => this.activeStreams.update(streams => [...streams, stream]),
      topic
    );

    this.quixService.subscribeToEvents(
      (event) => this.latestEvent.set(event),
      topic,
      '*',
      '*'
    );

    this.quixService.subscribeToParameterData(
      (data) => this.latestData.set(data),
      topic,
      '*',
      '*'
    );
  }

  async sendData(): Promise<void> {
    const value = this.inputValue();
    if (!value.trim()) return;

    const dataPayload: Data = {
      timestamps: [Date.now() * 1_000_000],
      stringValues: {
        AngularMessage: [value]
      }
    };

    this.quixService.sendParameterData(
      this.inputTopic(),
      'angular-messages-stream',
      dataPayload
    );

    this.inputValue.set('');
  }

  updateInputValue(value: string): void {
    this.inputValue.set(value);
  }
}
