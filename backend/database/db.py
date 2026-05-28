from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Твій особистий рядок підключення до хмарної бази PostgreSQL на Neon
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://neondb_owner:npg_SMnTez60xfrG@ep-green-king-alajlpp6.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Створюємо двигун підключення
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()