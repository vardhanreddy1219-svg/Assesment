# Document Processing Service

A production-ready, asynchronous document processing service built with FastAPI, Redis Streams, and Google Gemini 2.0 Flash for PDF parsing and summarization.

## Features

- **Asynchronous Processing**: Redis Streams for job queuing and processing
- **Multiple Parsers**: 
  - `pypdf`: Simple text extraction with markdown conversion
  - `gemini`: Google Gemini 2.0 Flash for advanced markdown extraction
  - `mistral`: Stubbed for future implementation
- **AI Summarization**: Google Gemini 2.0 Flash for intelligent document summaries
- **Production Ready**: Docker Compose setup with health checks and auto-restart
- **Scalable**: Multiple worker instances for parallel processing

## Prerequisites

- Docker and Docker Compose
- Google Gemini API key (get from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Quick Start

1. **Clone and setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your GEMINI_API_KEY
   ```

2. **Start the services**:
   ```bash
   docker compose up --build
   ```

3. **Test the API**:
   ```bash
   # Upload a PDF
   curl -F "file=@sample.pdf" -F "parser=pypdf" http://localhost:8000/api/v1/upload
   
   # Check status (replace JOB_ID with returned job_id)
   curl http://localhost:8000/api/v1/status/JOB_ID
   
   # Get results when done
   curl http://localhost:8000/api/v1/result/JOB_ID
   ```

## API Endpoints

### Upload Document
```bash
POST /api/v1/upload
Content-Type: multipart/form-data

# Parameters:
# - file: PDF file (max 25MB)
# - parser: "pypdf" | "gemini" | "mistral" (default: "pypdf")

curl -F "file=@document.pdf" -F "parser=gemini" http://localhost:8000/api/v1/upload
```

### Check Status
```bash
GET /api/v1/status/{job_id}

curl http://localhost:8000/api/v1/status/abc123def456
```

### Get Results
```bash
GET /api/v1/result/{job_id}

curl http://localhost:8000/api/v1/result/abc123def456
```

### Health Check
```bash
GET /health

curl http://localhost:8000/health
```

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *required* | Google Gemini API key |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection URL |
| `STREAM_NAME` | `pdf_jobs` | Redis stream name |
| `STREAM_GROUP` | `pdf_group` | Redis consumer group |
| `GEMINI_MODEL_ID` | `gemini-2.0-flash` | Gemini model identifier |
| `MAX_UPLOAD_MB` | `25` | Maximum file size in MB |
| `KEEP_TMP_FILES` | `false` | Keep temporary files for debugging |

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   FastAPI   │───▶│    Redis    │◀───│   Worker    │
│     API     │    │   Streams   │    │  Consumer   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Upload    │    │ Job Queue   │    │   Process   │
│   Validate  │    │ Job Status  │    │  Summarize  │
│   Enqueue   │    │ Results     │    │    Store    │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Development

### Local Development
```bash
# Install dependencies
pip install -r requirements.txt

# Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# Set environment variables
export GEMINI_API_KEY=your_key_here
export REDIS_URL=redis://localhost:6379/0

# Start API server
uvicorn backend.app:app --reload

# Start worker (in another terminal)
python -m backend.workers.consumer
```

### Testing with Sample PDFs

You can test with any PDF file. Here are some public examples:
- [Sample PDF 1](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)
- [Sample PDF 2](https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf)

## Troubleshooting

### Redis Streams Introspection

```bash
# Connect to Redis container
docker exec -it assessment-redis-1 redis-cli

# Check stream info
XINFO STREAM pdf_jobs

# Check consumer group
XINFO GROUPS pdf_jobs

# View pending messages
XPENDING pdf_jobs pdf_group

# Read stream messages
XRANGE pdf_jobs - +
```

### Common Issues

1. **Gemini API Errors**: Check your API key and quota
2. **File Upload Errors**: Ensure file is valid PDF and under size limit
3. **Worker Not Processing**: Check Redis connection and stream setup
4. **Memory Issues**: Large PDFs may require more memory allocation

### Logs

```bash
# View API logs
docker compose logs -f api

# View worker logs
docker compose logs -f worker

# View Redis logs
docker compose logs -f redis
```

## Production Deployment

For production deployment:

1. **Security**: 
   - Use proper secrets management for API keys
   - Add authentication/authorization
   - Configure CORS appropriately

2. **Scaling**:
   - Increase worker replicas in docker-compose.yml
   - Use Redis Cluster for high availability
   - Add load balancer for API instances

3. **Monitoring**:
   - Add health checks and metrics
   - Monitor Redis memory usage
   - Set up alerting for failed jobs

4. **Storage**:
   - Configure persistent volumes
   - Set appropriate TTL for job data
   - Consider object storage for large files

## License

MIT License - see LICENSE file for details.
