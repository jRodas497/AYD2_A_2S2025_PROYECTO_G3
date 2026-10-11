FROM python:3.12-alpine
WORKDIR /app
COPY server.py .
RUN mkdir /data
EXPOSE 8090
HEALTHCHECK --interval=5s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8090/health', timeout=2)"
CMD ["python", "server.py"]
