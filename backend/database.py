import os
import time
from contextlib import contextmanager
import psycopg2
from psycopg2.extras import DictCursor
import numpy as np

# Get the connection string from Render Environment Variables
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set!")

SCHEMA = """
CREATE TABLE IF NOT EXISTS classes(
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  created_at VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS students(
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  roll_no VARCHAR(50) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  consent_at VARCHAR(255) NOT NULL,
  UNIQUE(class_id, roll_no)
);
CREATE TABLE IF NOT EXISTS embeddings(
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  feature_blob BYTEA NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  created_at VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  session_date VARCHAR(50) NOT NULL,
  subject VARCHAR(255),
  created_at VARCHAR(255) NOT NULL,
  approved_at VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS attendance(
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  status VARCHAR(20) NOT NULL CHECK(status IN ('UNMARKED','PRESENT','ABSENT')),
  match_score REAL,
  source VARCHAR(50),
  reviewed_at VARCHAR(255),
  UNIQUE(session_id, student_id)
);
"""

def init_db():
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as c:
            c.execute(SCHEMA)
            conn.commit()

@contextmanager
def db():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    try:
        yield conn
    finally:
        conn.close()

def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")

# ---- classes ----
def create_class(name):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("INSERT INTO classes(name, created_at) VALUES (%s,%s) RETURNING *", (name.strip(), now()))
            return dict(cur.fetchone())

def list_classes():
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM classes ORDER BY id")
            return [dict(r) for r in cur.fetchall()]

# ---- students ----
def create_student(class_id, roll_no, full_name, consent=True):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("""INSERT INTO students(class_id, roll_no, full_name, consent_at)
                           VALUES (%s,%s,%s,%s) RETURNING *""", 
                        (class_id, roll_no.strip(), full_name.strip(), now() if consent else ""))
            return dict(cur.fetchone())

def list_students(class_id):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM students WHERE class_id=%s ORDER BY roll_no", (class_id,))
            return [dict(r) for r in cur.fetchall()]

# ---- embeddings ----
def add_embedding(student_id, blob, model_version):
    with db() as c:
        with c.cursor() as cur:
            cur.execute("""INSERT INTO embeddings(student_id, feature_blob, model_version, created_at)
                           VALUES (%s,%s,%s,%s)""", (student_id, blob, model_version, now()))

def get_class_embeddings(class_id):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("""
                SELECT e.student_id, e.feature_blob, s.full_name, s.roll_no
                FROM embeddings e JOIN students s ON s.id=e.student_id
                WHERE s.class_id=%s
            """, (class_id,))
            out = []
            for r in cur.fetchall():
                vec = np.frombuffer(bytes(r["feature_blob"]), dtype=np.float32)
                out.append({"student_id": r["student_id"], "name": r["full_name"],
                            "roll": r["roll_no"], "vec": vec})
            return out

# ---- sessions + attendance ----
def create_session(class_id, session_date, subject):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("""INSERT INTO sessions(class_id, session_date, subject, created_at)
                           VALUES (%s,%s,%s,%s) RETURNING *""", (class_id, session_date, subject, now()))
            return dict(cur.fetchone())

def get_session(session_id):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("SELECT * FROM sessions WHERE id=%s", (session_id,))
            r = cur.fetchone()
            return dict(r) if r else None

def upsert_attendance(session_id, student_id, status, score=None, source="AI"):
    with db() as c:
        with c.cursor() as cur:
            cur.execute("""INSERT INTO attendance(session_id, student_id, status, match_score, source, reviewed_at)
                           VALUES (%s,%s,%s,%s,%s,%s)
                           ON CONFLICT(session_id, student_id) DO UPDATE SET
                             status=EXCLUDED.status,
                             match_score=COALESCE(EXCLUDED.match_score, attendance.match_score),
                             source=EXCLUDED.source,
                             reviewed_at=EXCLUDED.reviewed_at""",
                        (session_id, student_id, status, score, source, now()))

def approve_session(session_id):
    with db() as c:
        with c.cursor() as cur:
            cur.execute("UPDATE sessions SET approved_at=%s WHERE id=%s", (now(), session_id))

def get_attendance(session_id):
    with db() as c:
        with c.cursor(cursor_factory=DictCursor) as cur:
            cur.execute("""
                SELECT s.id as student_id, s.roll_no, s.full_name,
                       COALESCE(a.status,'UNMARKED') as status,
                       a.match_score, a.source
                FROM students s
                LEFT JOIN attendance a ON a.student_id=s.id AND a.session_id=%s
                JOIN sessions se ON se.class_id=s.class_id AND se.id=%s
                ORDER BY s.roll_no
            """, (session_id, session_id))
            return [dict(r) for r in cur.fetchall()]