import { Component, input } from '@angular/core';
import { Stream } from '../../models';

@Component({
  selector: 'app-active-streams',
  standalone: true,
  template: `
    <div class="panel">
      <h4>Active Streams</h4>
      <div class="content">
        @for (stream of streams(); track stream.streamId) {
          <div class="stream-item">
            <p><strong>Stream ID:</strong> {{ stream.streamId }}</p>
            <p><strong>Name:</strong> {{ stream.name }}</p>
          </div>
        } @empty {
          <p class="empty">No active streams</p>
        }
      </div>
    </div>
  `,
  styles: `
    .panel {
      border: 1px solid #444;
      border-radius: 8px;
      padding: 1rem;
      min-width: 280px;
      max-width: 320px;
      background: rgba(255, 255, 255, 0.05);
    }

    h4 {
      margin: 0 0 1rem 0;
      color: #dd0031;
    }

    .content {
      max-height: 300px;
      overflow-y: auto;
      text-align: left;
    }

    .stream-item {
      font-size: 12px;
      padding: 0.5rem;
      border-bottom: 1px solid #333;
    }

    .stream-item:last-child {
      border-bottom: none;
    }

    .stream-item p {
      margin: 0.25rem 0;
    }

    .empty {
      color: #888;
      font-style: italic;
    }
  `
})
export class ActiveStreamsComponent {
  readonly streams = input<Stream[]>([]);
}
