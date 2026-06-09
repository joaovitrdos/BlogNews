FROM golang:1.22-alpine AS builder

RUN apk --no-cache add ca-certificates git

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /api ./cmd/api

FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata curl && \
    addgroup -S app && adduser -S -G app app

WORKDIR /app

COPY --from=builder /api ./api

RUN chown app:app /app/api

USER app

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:3001/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["./api"]
