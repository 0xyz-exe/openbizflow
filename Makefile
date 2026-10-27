.PHONY: test-api build-web test-all run-docker clean

test-api:
	cd apps/api && .venv/Scripts/python.exe -m pytest -v

build-web:
	cd apps/web && npm run build

test-all: test-api build-web

run-docker:
	docker compose up --build -d

clean:
	rm -rf apps/web/dist apps/api/.pytest_cache
