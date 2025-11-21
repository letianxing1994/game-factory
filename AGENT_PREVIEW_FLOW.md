# Agent Preview (试运行) Call Flow Documentation

## 🔄 Complete Request Flow

### 1. Frontend Trigger (Agents.tsx)
**Location**: `frontend/src/pages/Agents.tsx:213`

**User Action**: Click "试运行" button on employee agent card

**Function**: `handlePreviewWithDefaults(agent: EmployeeAgent)`

**Payload Construction**:
```typescript
{
  project: {
    projectName: "Agent Name的试运行项目",
    description: "测试Agent工作能力"
  },
  cloudProvider: "aliyun",
  stage: {
    stageId: agentStageMap[agent.type], // planning/art/tech/music/testing
    mode: "llm+kb"
  },
  // Conditional based on stageId:
  userInput: {  // For planning stage
    projectName, gameGenre, dimension, artStyle, gameMode
  }
  // OR
  gdd: { ... }  // For other stages
}
```

### 2. API Request
**Endpoint**: `POST /api/workflows/agents/:agentId/preview`

**Headers**: 
- `Authorization: Bearer <JWT_TOKEN>`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "project": { "projectName": "...", "description": "..." },
  "cloudProvider": "aliyun",
  "stage": { "stageId": "planning", "mode": "llm+kb" },
  "userInput": { ... }
}
```

### 3. Backend Handler (workflows.ts)
**Location**: `backend/src/routes/workflows.ts:258`

**Processing Steps**:
1. **Authentication**: Verify JWT token
2. **Authorization**: Check agent ownership
   ```sql
   SELECT * FROM employee_agents 
   WHERE id = ? AND owner_id = ?
   ```
3. **Stage Config Building**:
   ```typescript
   {
     stageId: stage.stageId || mapAgentTypeToStage(agent.type),
     agentId: `${stageId}-agent`,
     model: stage.model || agent.ai_model,
     mode: stage.mode || "llm+kb",
     knowledgeBase, tools, mcp, resources, expectedArtifacts
   }
   ```
4. **Call my-agent-test service**: `previewAgentStage()`

### 4. my-agent-test Service
**Location**: `backend/src/services/myAgentClient.ts`

**Target URL**: `http://localhost:3000/execute-stage-direct`

**HTTP Request**:
```typescript
POST /execute-stage-direct
Headers: { 
  'x-cloud-provider': 'aliyun',
  'x-execution-id': 'preview-{timestamp}',
  'Content-Type': 'application/json'
}
Body: {
  project, stage, userInput/gdd, cloudProvider
}
```

### 5. Response Flow
**my-agent-test → backend → frontend**

**Success Response**:
```json
{
  "success": true,
  "data": {
    "stageId": "planning",
    "status": "completed",
    "artifacts": [
      {
        "artifactId": "...",
        "type": "game_design_document",
        "format": "markdown",
        "url": "http://..."
      }
    ],
    "metadata": { ... }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "message": "Error description"
}
```

### 6. Frontend Display
**Location**: `Agents.tsx:505-530`

- Show loading state during execution
- Display artifacts (preview for images/code, download links)
- Show stage status and metadata
- Handle errors with message.error()

## 🔧 Key Components

### Agent Type to Stage Mapping
```typescript
const agentStageMap: Record<string, string> = {
  planner: 'planning',
  artist: 'art',
  developer: 'tech', 
  musician: 'music',
  tester: 'testing'
}
```

### Database Tables
- `employee_agents`: Agent metadata (id, name, type, ai_model, owner_id)
- `companies`: Company ownership validation
- `company_employees`: Agent-company associations

### External Services
- **my-agent-test**: Main workflow execution engine (port 3000)
- **OSS Storage**: Artifact storage (Aliyun OSS)
- **Redis**: Session/cache management
- **Kafka**: Event publishing (optional)

## ⚠️ Error Handling

### Common Errors
1. **404**: Agent not found or unauthorized
2. **400**: Missing required fields (project/stage)
3. **500**: my-agent-test service unreachable
4. **Timeout**: Long-running AI model inference

### Frontend Error Display
```typescript
catch (error: any) {
  message.error(error?.response?.data?.message || '试运行失败')
}
```

## 📊 Performance Notes

- Typical execution time: 10-60 seconds (depends on AI model)
- Use loading state to prevent duplicate submissions
- Modal closes on unmount (cleanup in useEffect)
- Artifacts cached in state until modal close

## 🔐 Security

- JWT authentication required
- Agent ownership validation
- Rate limiting (TODO in production)
- CORS configured for localhost:3001

---
**Last Updated**: 2025-11-20
**Status**: ✅ Implemented and tested
