FROM python:3.12-slim
WORKDIR /app
COPY shared/ /app/shared/
COPY visual_noun/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY visual_noun/ /app/visual_noun/
ENV PYTHONPATH="/app"
EXPOSE 8080
CMD ["uvicorn", "visual_noun.app.main:app", "--host", "0.0.0.0", "--port", "8080"]
