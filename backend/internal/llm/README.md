# LLM Module

This package wraps the OpenAI-compatible chat completion client used by the backend.

## Responsibilities

- Build chat completion and streaming chat completion requests.
- Keep API keys server-side; keys are loaded from `.env` by the config layer and are never exposed to the frontend.
- Provide a non-stream fallback when a compatible provider returns a successful stream with no text deltas.

## How To Modify

- Change provider/model settings in `backend/config.yaml`.
- Change secrets such as `LLM_API_KEY` and `LLM_BASE_URL` in `backend/.env`.
- Add provider-specific request behavior in `client.go`, keeping the public `Client` methods stable for service packages.
