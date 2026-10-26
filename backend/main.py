import asyncio, os, io, json, uuid, datetime
from fastapi import FastAPI, UploadFile, File, Form, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
import numpy as np
import pandas as pd

import database as db
import face_engine as fe
import matcher

app = FastAPI(title="SmartAttend AI")
app.add_middleware(CORSMiddleware, allow_origins=["https://smartattend-frontend-ahjd.onrender.com"], allow_methods=["*"],
                   allow_headers=["*"], allow_credentials=True)

db.init_db()

# ---------- WebSocket rooms: laptop waits in room, phone posts into room ----------
class Room:
    def __init__(self):
        self.laptop_ws: WebSocket | None = None
        self.phone_ws: WebSocket | None = None

ROOMS: dict[str, Room] = {}

class ClassIn(BaseModel):
    name: str

@app.get("/api/classes")
def get_classes():
    return db.list_classes()

@app.post("/api/classes")
def add_class(body: ClassIn):
    try:
        c = db.create_class(body.name)
        return {"ok": True, "class": dict(c)}
    except Exception as e:
        raise HTTPException(400, f"Class already exists or invalid: {e}")

@app.get("/api/classes/{class_id}/students")
def get_students(class_id: int):
    return db.list_students(class_id)

class StudentIn(BaseModel):
    class_id: int
    roll_no: str
    full_name: str

@app.post("/api/students")
def add_student(body: StudentIn):
    try:
        s = db.create_student(body.class_id, body.roll_no, body.full_name, consent=True)
        return {"ok": True, "student": dict(s)}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/students/{student_id}/enroll")
async def enroll_face(student_id: int, files: list[UploadFile] = File(...)):
    if len(files) < 1 or len(files) > 3:
        raise HTTPException(400, "Provide 1-3 reference images.")
    stored = 0
    for f in files:
        bgr = fe.decode_image(await f.read())
        if bgr is None:
            raise HTTPException(400, f"{f.filename}: invalid image")
        faces = fe.detect_embeddings(bgr)
        if len(faces) != 1:
            raise HTTPException(400, f"{f.filename}: expected exactly 1 face, found {len(faces)}")
        db.add_embedding(student_id, faces[0]["embedding"].tobytes(), fe.MODEL_VERSION)
        stored += 1
    return {"ok": True, "samples_stored": stored}

# ---------- session + processing ----------
class SessionIn(BaseModel):
    class_id: int
    session_date: str
    subject: str = ""

@app.post("/api/sessions")
def create_session(body: SessionIn):
    s = db.create_session(body.class_id, body.session_date, body.subject)
    return dict(s)

@app.post("/api/process")
async def process_photo(
    session_id: int = Form(...),
    file: UploadFile = File(...),
    threshold: float = Form(matcher.DEFAULT_THRESHOLD),
    margin: float = Form(matcher.DEFAULT_MARGIN),
):
    sess = db.get_session(session_id)
    if not sess:
        raise HTTPException(404, "Session not found")
    refs = db.get_class_embeddings(sess["class_id"])
    # if not refs:
    #     raise HTTPException(400, "No enrolled students in this class.")
    bgr = fe.decode_image(await file.read())
    if bgr is None:
        raise HTTPException(400, "Corrupt or unsupported image.")
    faces = fe.detect_embeddings(bgr)
    if not faces:
        return {"faces": [], "suggestions": [], "annotated_b64": None,
                "message": "No face detected. Try a clearer, front-facing photo."}
    suggestions = matcher.match_faces(faces, refs, threshold=threshold, margin=margin)
    annotated = fe.annotate(bgr, faces, suggestions)
    import base64, cv2 as cv
    _, buf = cv.imencode(".jpg", annotated)
    b64 = base64.b64encode(buf.tobytes()).decode()
    return {"faces": [{"box": f["box"], "score": f["score"]} for f in faces],
            "suggestions": suggestions, "annotated_b64": b64}

class SaveIn(BaseModel):
    session_id: int
    rows: list[dict]   # [{student_id, status, match_score?, source?}]

@app.post("/api/attendance/save")
def save_attendance(body: SaveIn):
    for r in body.rows:
        db.upsert_attendance(body.session_id, r["student_id"],
                             r["status"], r.get("match_score"), r.get("source", "Teacher"))
    db.approve_session(body.session_id)
    return {"ok": True}

@app.get("/api/attendance/{session_id}")
def get_att(session_id: int):
    return db.get_attendance(session_id)

@app.get("/api/attendance/{session_id}/export")
def export_xlsx(session_id: int):
    sess = db.get_session(session_id)
    rows = db.get_attendance(session_id)
    df = pd.DataFrame([{
        "Date": sess["session_date"], "Class": sess["class_id"],
        "Roll No": r["roll_no"], "Student Name": r["full_name"],
        "Status": r["status"], "Match Score": r["match_score"],
        "Reviewed By": "Teacher", "Source": r["source"],
    } for r in rows])
    out = io.BytesIO()
    with pd.ExcelWriter(out, engine="openpyxl") as w:
        df.to_excel(w, index=False, sheet_name="Attendance")
    out.seek(0)
    fname = f"attendance_session{session_id}.xlsx"
    return StreamingResponse(out,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})

# ---------- Mobile capture WebSocket relay ----------
@app.websocket("/ws/laptop/{room}")
async def ws_laptop(ws: WebSocket, room: str):
    await ws.accept()
    r = ROOMS.setdefault(room, Room())
    r.laptop_ws = ws
    try:
        while True:
            # laptop doesn't need to send; keep alive
            await ws.receive_text()
    except WebSocketDisconnect:
        if r.laptop_ws is ws:
            r.laptop_ws = None

@app.websocket("/ws/phone/{room}")
async def ws_phone(ws: WebSocket, room: str):
    await ws.accept()
    r = ROOMS.setdefault(room, Room())
    r.phone_ws = ws
    try:
        while True:
            data = await ws.receive()
            # handle binary jpeg frames
            if data.get("type") == "websocket.receive":
                if "bytes" in data and data["bytes"]:
                    # forward to laptop
                    if r.laptop_ws:
                        await r.laptop_ws.send_bytes(data["bytes"])
                elif "text" in data and data["text"]:
                    if r.laptop_ws:
                        await r.laptop_ws.send_text(data["text"])
    except WebSocketDisconnect:
        if r.phone_ws is ws:
            r.phone_ws = None

@app.post("/api/room/create")
@app.post("/api/room/create/{room}")
def create_room(room: str | None = None):
    rid = room or uuid.uuid4().hex[:8]
    ROOMS.setdefault(rid, Room())
    return {"room": rid}

@app.get("/api/history/{class_id}")
def get_history(class_id: int):
    with db.db() as c:
        with c.cursor() as cur:
            # Get all sessions for this class
            cur.execute("SELECT id, session_date, subject FROM sessions WHERE class_id=%s ORDER BY id DESC", (class_id,))
            sessions = cur.fetchall()
            
            history = []
            for sess in sessions:
                # Get attendance for each session
                cur.execute("""
                    SELECT s.roll_no, s.full_name, COALESCE(a.status, 'UNMARKED') as status
                    FROM students s
                    LEFT JOIN attendance a ON a.student_id=s.id AND a.session_id=%s
                    WHERE s.class_id=%s
                    ORDER BY s.roll_no
                """, (sess[0], class_id))
                records = cur.fetchall()
                history.append({
                    "session_id": sess[0],
                    "date": sess[1],
                    "subject": sess[2],
                    "records": [{"roll": r[0], "name": r[1], "status": r[2]} for r in records]
                })
            return history

@app.get("/health")
def health():
    return {"ok": True, "time": datetime.datetime.now().isoformat()}


# ---------- Mobile capture WebSocket relay (ENROLLMENT) ----------
@app.websocket("/ws/enroll_laptop/{room}")
async def ws_enroll_laptop(ws: WebSocket, room: str):
    await ws.accept()
    r = ROOMS.setdefault(room, Room())
    r.laptop_ws = ws
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if r.laptop_ws is ws:
            r.laptop_ws = None

@app.websocket("/ws/enroll_phone/{room}")
async def ws_enroll_phone(ws: WebSocket, room: str):
    await ws.accept()
    r = ROOMS.setdefault(room, Room())
    r.phone_ws = ws
    try:
        while True:
            data = await ws.receive()
            if data.get("type") == "websocket.receive":
                if "bytes" in data and data["bytes"]:
                    if r.laptop_ws:
                        await r.laptop_ws.send_bytes(data["bytes"])
                elif "text" in data and data["text"]:
                    if r.laptop_ws:
                        await r.laptop_ws.send_text(data["text"])
    except WebSocketDisconnect:
        if r.phone_ws is ws:
            r.phone_ws = None