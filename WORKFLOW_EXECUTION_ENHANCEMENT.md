# Enhanced Workflow Execution System

## Overview

This document describes the enhanced workflow execution system with real-time visualization capabilities. The system provides:

- **Real-time execution tracking** via WebSocket connections
- **Enhanced state management** for workflow executions
- **Scalable worker pool** architecture (optional, for future parallel execution)
- **Animated UI components** with status indicators
- **Backward compatibility** with existing execution system

## Architecture

### Core Components

1. **ExecutionStateManager** (`execution-state-manager.ts`)
   - Tracks real-time state of all active workflow executions
   - Manages node-level execution states
   - Provides subscription mechanism for state updates
   - Calculates execution progress and overall status

2. **VisualizationService** (`visualization-service.ts`)
   - WebSocket server for real-time UI updates
   - Broadcasts execution state changes to connected clients
   - Generates visual configurations (colors, icons, animations)
   - Manages client connections and subscriptions

3. **WorkflowOrchestrator** (`workflow-orchestrator.ts`)
   - Coordinates workflow execution
   - Integrates with ExecutionStateManager for real-time updates
   - Handles node execution sequencing
   - Manages execution context and state propagation

4. **WorkflowWorkerPool** (`worker-pool.ts`)
   - Optional: Manages Node.js worker threads for parallel execution
   - Task queue with priority scheduling
   - Worker lifecycle management
   - Metrics collection

5. **Enhanced Execute Workflow** (`enhanced-execute-workflow.ts`)
   - Drop-in replacement for existing execute-workflow handler
   - Integrates all components
   - Maintains backward compatibility

## Usage

### Backend Integration

#### Option 1: Use Enhanced Handler (Recommended)

```typescript
import { enhancedExecuteWorkflow } from './services/workflow-executor/enhanced-execute-workflow';

// In your route handler
app.post('/api/execute-workflow', async (req, res) => {
  await enhancedExecuteWorkflow(req, res, {
    useRealtime: true,  // Enable WebSocket updates
    useWorkerPool: false, // Disable worker threads for now
  });
});
```

#### Option 2: Use Existing Handler with Real-time Updates

The existing `execute-workflow.ts` handler continues to work. To add real-time updates, you can:

1. Initialize the state manager and visualization service
2. Update node states during execution
3. The WebSocket server will automatically broadcast updates

### Frontend Integration

#### Using RealtimeExecutionVisualizer Component

```tsx
import RealtimeExecutionVisualizer from '@/components/workflow/RealtimeExecutionVisualizer';

function WorkflowBuilder() {
  const [executionId, setExecutionId] = useState<string | null>(null);

  return (
    <div>
      {/* Your workflow canvas */}
      
      {executionId && (
        <RealtimeExecutionVisualizer
          executionId={executionId}
          backendUrl={process.env.VITE_BACKEND_URL}
          onNodeUpdate={(nodeId, status) => {
            // Handle node status updates
            console.log(`Node ${nodeId} status: ${status}`);
          }}
        />
      )}
    </div>
  );
}
```

#### WebSocket Connection

The component automatically:
- Connects to WebSocket server at `/ws/executions?executionId={executionId}`
- Subscribes to execution updates
- Handles reconnection on disconnect
- Updates node statuses in real-time

## Configuration

### Environment Variables

```env
# Worker Configuration
WORKER_CONCURRENCY=5          # Number of worker threads (if using worker pool)
WORKER_TIMEOUT=30000          # Worker task timeout (ms)
WORKER_RETRY_ATTEMPTS=3       # Retry attempts for failed tasks

# UI Configuration
UI_REFRESH_INTERVAL=1000       # UI update interval (ms)
UI_ANIMATION_ENABLED=true      # Enable animations
UI_COLOR_THEME=dynamic         # Color theme (dynamic/static)

# WebSocket Configuration
WS_PATH=/ws/executions         # WebSocket path
WS_HEARTBEAT_INTERVAL=30000    # Heartbeat interval (ms)
```

### Backend Server Setup

The WebSocket server is automatically initialized when the Express server starts. It's available at:

```
ws://localhost:3001/ws/executions?executionId={executionId}
```

## API Reference

### ExecutionStateManager

```typescript
// Initialize execution
stateManager.initializeExecution(executionId, workflowId, totalNodes, input);

// Update node state
stateManager.updateNodeState(executionId, nodeId, nodeName, status, data);

// Get execution state
const state = stateManager.getExecutionState(executionId);

// Subscribe to updates
const unsubscribe = stateManager.subscribe(executionId, (update) => {
  console.log('Execution update:', update);
});
```

### VisualizationService

```typescript
// Initialize (done automatically in server startup)
visualizationService.initialize(server);

// Broadcast node update (done automatically by orchestrator)
visualizationService.broadcastNodeUpdate(executionId, nodeId, nodeState);

// Get connection stats
const stats = visualizationService.getStats();
```

### WorkflowOrchestrator

```typescript
const orchestrator = new WorkflowOrchestrator(stateManager, visualizationService);

const result = await orchestrator.executeWorkflow(
  workflowId,
  input,
  nodes,
  edges,
  executionId,
  userId
);
```

## Visual States

### Node Status Colors

- **Idle**: Gray (`#9ca3af`)
- **Pending**: Gray (`#9ca3af`)
- **Running**: Blue (`#3b82f6`) with pulse animation
- **Success**: Green (`#10b981`)
- **Error**: Red (`#ef4444`) with pulse animation
- **Skipped**: Yellow (`#f59e0b`)

### Animations

- **pulse-running**: Continuous scale animation for running nodes
- **pulse-error**: Pulsing shadow for error nodes
- **flow-animation**: Animated connection lines showing data flow

## Migration Guide

### From Existing System

1. **Install Dependencies**
   ```bash
   cd worker
   npm install ws uuid
   npm install --save-dev @types/ws @types/uuid
   ```

2. **Update Server**
   - WebSocket server is automatically initialized
   - No changes needed to existing routes

3. **Update Frontend**
   - Add `RealtimeExecutionVisualizer` component
   - Import CSS styles: `@/components/workflow/realtime-visualizer.css`
   - Component automatically integrates with existing workflow store

4. **Optional: Enable Enhanced Handler**
   - Replace existing execute-workflow route with enhanced version
   - Or keep existing and add real-time updates manually

### Backward Compatibility

- Existing `execute-workflow` handler continues to work
- Database schema unchanged
- Execution logs format unchanged
- All existing API endpoints remain functional

## Performance Considerations

### WebSocket Connections

- Each execution viewer creates one WebSocket connection
- Connections are automatically cleaned up on disconnect
- Heartbeat mechanism prevents stale connections
- Maximum recommended: 100 concurrent connections per server instance

### State Management

- Execution states are kept in memory
- Old executions are automatically cleaned up after 1 hour
- Memory usage: ~1KB per execution + ~500 bytes per node

### Worker Pool (Future)

- Worker pool is optional and currently not used by default
- Can be enabled for CPU-intensive node executions
- Recommended for: AI processing, image processing, data transformations

## Troubleshooting

### WebSocket Connection Issues

1. **Check Backend URL**
   ```typescript
   // Ensure backend URL is correct
   const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3001';
   ```

2. **Check CORS Settings**
   - WebSocket connections don't use CORS, but ensure server allows WebSocket upgrades

3. **Check Firewall/Proxy**
   - WebSocket requires HTTP upgrade
   - Some proxies may block WebSocket connections

### State Not Updating

1. **Check Execution ID**
   - Ensure executionId is correct and execution exists

2. **Check WebSocket Connection**
   - Look for connection status indicator in UI
   - Check browser console for WebSocket errors

3. **Check Backend Logs**
   - Look for WebSocket connection logs
   - Check for state manager errors

## Future Enhancements

- [ ] Parallel node execution using worker pool
- [ ] Execution replay capability
- [ ] Performance metrics dashboard
- [ ] Distributed execution across multiple servers
- [ ] Execution checkpointing and resumption
- [ ] Advanced visualization (3D graph, timeline view)

## Support

For issues or questions:
1. Check this documentation
2. Review code comments in source files
3. Check browser console and server logs
4. Open an issue with detailed error information
