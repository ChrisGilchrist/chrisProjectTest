import { Component, input } from '@angular/core';
import { QuixEvent } from '../../models';

@Component({
  selector: 'app-events',
  standalone: true,
  template: `
    <div class="panel">
      <h4>Events</h4>
      <div class="content">
        @if (event()) {
          <p><strong>Event ID:</strong> {{ event()?.id }}</p>
          <p><strong>Value:</strong> {{ event()?.value }}</p>
        } @else {
          <p class="empty">Waiting for events...</p>
        }
      </div>
    </div>
  `,
  styles: `
    .panel {
      border: 1px solid #f97316;
      border-radius: 8px;
      padding: 1rem;
      min-width: 280px;
      max-width: 320px;
      background: rgba(249, 115, 22, 0.1);
    }

    h4 {
      margin: 0 0 1rem 0;
      color: #f97316;
    }

    .content {
      text-align: left;
      font-size: 14px;
    }

    .content p {
      margin: 0.5rem 0;
      word-break: break-word;
    }

    .empty {
      color: #888;
      font-style: italic;
    }
  `
})
export class EventsComponent {
  readonly event = input<QuixEvent | null>(null);
}
