from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import DATABASE_URL, SQL_ECHO, is_sqlite_url

_engine_options = {"echo": SQL_ECHO, "pool_pre_ping": True}
if is_sqlite_url(DATABASE_URL):
    _engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **_engine_options)


def configure_sqlite_foreign_keys(target_engine) -> None:
    def enable_foreign_keys(connection, _record) -> None:
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    event.listen(target_engine, "connect", enable_foreign_keys)


if is_sqlite_url(DATABASE_URL):
    configure_sqlite_foreign_keys(engine)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
