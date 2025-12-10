import { Component, input, computed } from '@angular/core';
import { KeyValuePipe } from '@angular/common';
import { ParameterData } from '../../models';

@Component({
  selector: 'app-live-data',
  standalone: true,
  imports: [KeyValuePipe],
  template: `
    <div class="panel">
      <h4>Live Data</h4>
      <div class="content">
        @if (data()) {
          <p><strong>Topic ID:</strong> {{ data()?.topicId }}</p>

          @if (hasNumericValues()) {
            <div class="section">
              <h5>Numeric Values</h5>
              @for (item of data()?.numericValues | keyvalue; track item.key) {
                <p>{{ item.key }}: {{ item.value.join(', ') }}</p>
              }
            </div>
          }

          @if (hasStringValues()) {
            <div class="section">
              <h5>String Values</h5>
              @for (item of data()?.stringValues | keyvalue; track item.key) {
                <p>{{ item.key }}: {{ item.value.join(', ') }}</p>
              }
            </div>
          }
        } @else {
          <p class="empty">Waiting for data...</p>
        }
      </div>
    </div>
  `,
  styles: `
    .panel {
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 1rem;
      min-width: 280px;
      max-width: 320px;
      background: rgba(59, 130, 246, 0.1);
    }

    h4 {
      margin: 0 0 1rem 0;
      color: #3b82f6;
    }

    h5 {
      margin: 0.75rem 0 0.5rem 0;
      font-size: 14px;
      color: #93c5fd;
    }

    .content {
      text-align: left;
      font-size: 14px;
    }

    .content p {
      margin: 0.25rem 0;
      word-break: break-word;
    }

    .section {
      margin-top: 0.5rem;
    }

    .empty {
      color: #888;
      font-style: italic;
    }
  `
})
export class LiveDataComponent {
  readonly data = input<ParameterData | null>(null);

  readonly hasNumericValues = computed(() => {
    const d = this.data();
    return d?.numericValues && Object.keys(d.numericValues).length > 0;
  });

  readonly hasStringValues = computed(() => {
    const d = this.data();
    return d?.stringValues && Object.keys(d.stringValues).length > 0;
  });
}
