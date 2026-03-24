FROM python:3.12-slim
WORKDIR /app
COPY shared/ /app/shared/
COPY api/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY api/ /app/api/
ENV PYTHONPATH="/app"
EXPOSE 8080
CMD ["uvicorn", "api.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
