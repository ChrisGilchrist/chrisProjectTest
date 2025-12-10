flowchart LR
    subgraph Frontend
        UI[Chat UI<br/>HTML/JS]
    end

    subgraph Backend
        API[Flask API<br/>+ Socket.IO]
    end

    subgraph Kafka
        T1[chat-messages<br/>Topic]
        T2[chat-replay<br/>Topic]
    end

    subgraph Storage
        DL[(Data Lake<br/>Sink)]
        RP[Replay<br/>Service]
    end

    UI -->|WebSocket| API
    UI -->|HTTP POST| API
    API -->|Produce| T1
    T1 --> DL
    DL --> RP
    RP -->|Replay| T2
    T2 -->|Consume| API
    API -->|Broadcast| UI