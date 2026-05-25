# ---- 构建阶段 ----
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /build

# 缓存依赖下载
COPY go.mod go.sum ./
RUN go mod download

# 复制源码并构建
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /build/server ./cmd/server

# ---- 运行阶段 ----
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

# 复制二进制和配置
COPY --from=builder /build/server .
COPY --from=builder /build/config.yaml .

# .env 在运行时挂载，绝不打进镜像
# docker run -v /path/to/.env:/app/.env ghost-backend

EXPOSE 8080

ENTRYPOINT ["./server"]
