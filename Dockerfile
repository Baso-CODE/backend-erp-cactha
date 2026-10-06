FROM oven/bun:latest

WORKDIR /app

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    libstdc++-12-dev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

RUN DATABASE_URL="mysql://dummy:dummy@localhost:3306/dummy" \
    bunx prisma generate

ENV NODE_ENV=production

EXPOSE 8000

CMD ["bun", "src/index.ts"]