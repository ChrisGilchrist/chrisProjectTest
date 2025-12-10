# Angular Starter Template

A modern Angular 21 starter template for Quix applications, featuring real-time data streaming with SignalR.

## Features

- **Angular 21** with latest best practices
- **Standalone components** (no NgModules)
- **Signal-based reactivity** for state management
- **Signal inputs** for component communication
- **Real-time data** via SignalR hub connections
- **TypeScript** with strict mode enabled
- **Docker-ready** with nginx for production deployment

## Project Structure

```
src/
├── app/
│   ├── components/          # Feature components
│   │   ├── active-streams/  # Displays active stream list
│   │   ├── events/          # Shows latest events
│   │   └── live-data/       # Displays real-time parameter data
│   ├── models/              # TypeScript interfaces
│   ├── services/            # QuixService for SignalR communication
│   ├── app.component.*      # Root component
│   └── app.config.ts        # Application configuration
├── assets/                  # Static assets
├── index.html               # Entry HTML
├── main.ts                  # Bootstrap file
└── styles.css               # Global styles
```

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

Navigate to `http://localhost:4200/`. The app will automatically reload on file changes.

### Build for Production

```bash
npm run build
```

Build artifacts will be stored in the `dist/` directory.

## Configuration

The application reads configuration from the following endpoints (served by nginx at runtime):

- `bearer_token` - Authentication token
- `workspace_id` - Quix workspace identifier
- `input_topic` - Topic to subscribe to

## Angular 21 Best Practices Used

1. **Standalone Components**: All components are standalone, eliminating NgModule boilerplate
2. **Signals**: Used for reactive state management instead of RxJS for simple state
3. **Signal Inputs**: Components use `input()` for type-safe inputs
4. **inject() Function**: Modern DI pattern using `inject()` instead of constructor injection
5. **Control Flow**: New `@if`, `@for`, `@empty` syntax for template control flow
6. **Strict TypeScript**: Enabled strict mode for better type safety

## Docker Deployment

```bash
# Build the image
docker build -t angular-starter-template .

# Run the container
docker run -p 80:80 angular-starter-template
```

## Environment Variables

When deployed in Quix, the following environment variables are used:

- `bearer_token` - API authentication token
- `input` - Input topic name
- `Quix__Workspace__Id` - Workspace identifier
- `Quix__Portal__Api` - Portal API URL
