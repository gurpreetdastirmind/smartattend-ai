import sqlite3, os, time
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "smartattend.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

SCHEMA = """
CREATE TABLE IF NOT EXISTS classes(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS students(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  roll_no TEXT NOT NULL,
  full_name TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  UNIQUE(class_id, roll_no)
);
CREATE TABLE IF NOT EXISTS embeddings(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id),
  feature_blob BLOB NOT NULL,
  model_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL REFERENCES classes(id),
  session_date TEXT NOT NULL,
  subject TEXT,
  created_at TEXT NOT NULL,
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS attendance(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  student_id INTEGER NOT NULL REFERENCES students(id),
  status TEXT NOT NULL CHECK(status IN ('UNMARKED','PRESENT','ABSENT')),
  match_score REAL,
  source TEXT,
  reviewed_at TEXT,
  UNIQUE(session_id, student_id)
);
"""

def init_db():
    with sqlite3.connect(DB_PATH) as c:
        c.executescript(SCHEMA)
        c.commit()

@contextmanager
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def now():
    return time.strftime("%Y-%m-%dT%H:%M:%S")

# ---- classes ----
def create_class(name):
    with db() as c:
        c.execute("INSERT INTO classes(name, created_at) VALUES (?,?)", (name.strip(), now()))
        c.commit()
        return c.execute("SELECT * FROM classes WHERE name=?", (name.strip(),)).fetchone()

def list_classes():
    with db() as c:
        return [dict(r) for r in c.execute("SELECT * FROM classes ORDER BY id")]

# ---- students ----
def create_student(class_id, roll_no, full_name, consent=True):
    with db() as c:
        c.execute("""INSERT INTO students(class_id, roll_no, full_name, consent_at)
                     VALUES (?,?,?,?)""", (class_id, roll_no.strip(), full_name.strip(), now() if consent else ""))
        c.commit()
        return c.execute("""SELECT * FROM students WHERE class_id=? AND roll_no=?""",
                        (class_id, roll_no.strip())).fetchone()

def list_students(class_id):
    with db() as c:
        return [dict(r) for r in c.execute(
            "SELECT * FROM students WHERE class_id=? ORDER BY roll_no", (class_id,))]

# ---- embeddings ----
def add_embedding(student_id, blob, model_version):
    import numpy as np
    arr = np.frombuffer(blob, dtype=np.float32)
    with db() as c:
        c.execute("""INSERT INTO embeddings(student_id, feature_blob, model_version, created_at)
                     VALUES (?,?,?,?)""", (student_id, arr.tobytes(), model_version, now()))
        c.commit()

def get_class_embeddings(class_id):
    import numpy as np
    with db() as c:
        rows = c.execute("""
            SELECT e.student_id, e.feature_blob, s.full_name, s.roll_no
            FROM embeddings e JOIN students s ON s.id=e.student_id
            WHERE s.class_id=?
        """, (class_id,)).fetchall()
    out = []
    for r in rows:
        vec = np.frombuffer(r["feature_blob"], dtype=np.float32)
        out.append({"student_id": r["student_id"], "name": r["full_name"],
                    "roll": r["roll_no"], "vec": vec})
    return out

# ---- sessions + attendance ----
def create_session(class_id, session_date, subject):
    with db() as c:
        c.execute("""INSERT INTO sessions(class_id, session_date, subject, created_at)
                     VALUES (?,?,?,?)""", (class_id, session_date, subject, now()))
        c.commit()
        return c.execute("SELECT * FROM sessions ORDER BY id DESC LIMIT 1").fetchone()

def get_session(session_id):
    with db() as c:
        r = c.execute("SELECT * FROM sessions WHERE id=?", (session_id,)).fetchone()
        return dict(r) if r else None

def upsert_attendance(session_id, student_id, status, score=None, source="AI"):
    with db() as c:
        c.execute("""INSERT INTO attendance(session_id, student_id, status, match_score, source, reviewed_at)
                     VALUES (?,?,?,?,?,?)
                     ON CONFLICT(session_id, student_id) DO UPDATE SET
                       status=excluded.status,
                       match_score=COALESCE(excluded.match_score, attendance.match_score),
                       source=excluded.source,
                       reviewed_at=excluded.reviewed_at""",
                  (session_id, student_id, status, score, source, now()))
        c.commit()

def approve_session(session_id):
    with db() as c:
        c.execute("UPDATE sessions SET approved_at=? WHERE id=?", (now(), session_id))
        c.commit()

def get_attendance(session_id):
    with db() as c:
        rows = c.execute("""
            SELECT s.id as student_id, s.roll_no, s.full_name,
                   COALESCE(a.status,'UNMARKED') as status,
                   a.match_score, a.source
            FROM students s
            LEFT JOIN attendance a ON a.student_id=s.id AND a.session_id=?
            JOIN sessions se ON se.class_id=s.class_id AND se.id=?
            ORDER BY s.roll_no
        """, (session_id, session_id)).fetchall()
    return [dict(r) for r in rows]