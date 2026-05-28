# Використовуємо стабільну версію Linux (Bullseye), де точно є wkhtmltopdf
FROM python:3.10-slim-bullseye

# Оновлюємо систему та встановлюємо wkhtmltopdf
RUN apt-get update && apt-get install -y wkhtmltopdf

# Встановлюємо робочу директорію
WORKDIR /app

# Копіюємо і встановлюємо бібліотеки
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо весь наш код
COPY . .

# Команда для запуску сервера
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]