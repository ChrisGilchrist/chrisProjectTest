import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import * as signalR from '@microsoft/signalr';
import { HubConnection } from '@microsoft/signalr';
import { Stream, QuixEvent, ParameterData, Data } from '../models';
import { firstValueFrom } from 'rxjs';

export type HubType = 'reader' | 'writer';

@Injectable({
  providedIn: 'root'
})
export class QuixService {
  private readonly http = inject(HttpClient);

  private readerHubConnection: HubConnection | null = null;
  private writerHubConnection: HubConnection | null = null;

  private token = '';
  private workspaceId = '';
  private readonly subdomain = 'platform';

  // Reactive signals for connection state
  readonly isConnected = signal(false);
  readonly connectionError = signal<string | null>(null);

  async fetchConfig(configSetting: string): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.http.get(configSetting, { responseType: 'text' })
      );
      return response.replace(/(\r\n|\n|\r)/gm, '');
    } catch (error) {
      console.error('Error fetching config:', error);
      throw error;
    }
  }

  async getWorkspaceIdAndToken(): Promise<void> {
    console.log('Fetching workspace ID and token...');
    this.token = await this.fetchConfig('bearer_token');
    this.workspaceId = await this.fetchConfig('workspace_id');
  }

  async startConnection(): Promise<void> {
    try {
      this.readerHubConnection = await this.connect('reader');
      this.writerHubConnection = await this.connect('writer');
      this.isConnected.set(true);
      this.connectionError.set(null);
      console.log('SignalR connected.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      this.connectionError.set(message);
      throw error;
    }
  }

  private async connect(type: HubType): Promise<HubConnection> {
    const url = `https://${type}-${this.workspaceId}.${this.subdomain}.quix.io/hub`;
    console.log(`Creating SignalR hub connection to: ${url}`);

    const hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(url, { accessTokenFactory: () => this.token })
      .withAutomaticReconnect()
      .build();

    console.log('Starting connection...');
    await hubConnection.start();

    return hubConnection;
  }

  async subscribeToActiveStreams(
    onActiveStreamsChanged: (stream: Stream, actionType: string) => void,
    topic: string
  ): Promise<Stream[]> {
    if (!this.readerHubConnection) {
      throw new Error('Reader hub not connected');
    }

    console.log(`Subscribing to active streams on topic: ${topic}`);
    const streams = await this.readerHubConnection.invoke<Stream[]>(
      'SubscribeToActiveStreams',
      topic
    );

    this.readerHubConnection.on('ActiveStreamsChanged', (stream: Stream, actionType: string) => {
      console.log(`Stream changed: ${stream.name}`);
      onActiveStreamsChanged(stream, actionType);
    });

    return streams;
  }

  async subscribeToEvents(
    onEventReceived: (event: QuixEvent) => void,
    topic: string,
    streamId: string,
    eventId: string
  ): Promise<void> {
    if (!this.readerHubConnection) {
      throw new Error('Reader hub not connected');
    }

    await this.readerHubConnection.invoke('SubscribeToEvent', topic, streamId, eventId);

    this.readerHubConnection.on('EventDataReceived', (payload: QuixEvent) => {
      onEventReceived(payload);
    });
  }

  async subscribeToParameterData(
    onDataReceived: (data: ParameterData) => void,
    topic: string,
    streamId: string,
    parameterId: string
  ): Promise<void> {
    if (!this.readerHubConnection) {
      throw new Error('Reader hub not connected');
    }

    await this.readerHubConnection.invoke('SubscribeToParameter', topic, streamId, parameterId);

    this.readerHubConnection.on('ParameterDataReceived', (payload: ParameterData) => {
      onDataReceived(payload);
    });
  }

  sendParameterData(topic: string, streamId: string, payload: Data): void {
    if (!this.writerHubConnection) {
      throw new Error('Writer hub not connected');
    }

    console.log('Sending parameter data:', topic, streamId, payload);
    this.writerHubConnection.invoke('SendParameterData', topic, streamId, payload);
  }

  unsubscribeFromParameter(topic: string, streamId: string, parameterId: string): void {
    this.readerHubConnection?.invoke('UnsubscribeFromParameter', topic, streamId, parameterId);
  }

  unsubscribeFromEvent(topic: string, streamId: string, eventId: string): void {
    this.readerHubConnection?.invoke('UnsubscribeFromEvent', topic, streamId, eventId);
  }
}
