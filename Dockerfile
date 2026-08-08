FROM oven/bun:1.3.14

WORKDIR /app
COPY src ./src

USER bun
ENTRYPOINT ["bun", "src/cli.ts"]
CMD ["--help"]
