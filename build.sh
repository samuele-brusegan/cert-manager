#!/bin/bash
docker compose -f docker-compose.yml -f docker-compose.proxy.yml down
docker compose -f docker-compose.yml -f docker-compose.proxy.yml build
docker compose -f docker-compose.yml -f docker-compose.proxy.yml up -d
