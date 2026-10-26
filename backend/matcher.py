import numpy as np

DEFAULT_THRESHOLD = 0.363   # OpenCV docs cosine baseline; tune for your set
DEFAULT_MARGIN = 0.05

def cosine(a, b):
    return float(np.dot(a, b))  # already L2 normalized

def match_faces(face_embs, class_refs, threshold=DEFAULT_THRESHOLD, margin=DEFAULT_MARGIN):
    """
    face_embs: list of dicts {embedding, box, score}
    class_refs: list of {student_id, name, roll, vec}
    returns per-face suggestion dict + dedup/conflict handling
    """
    # Score per student = max over their samples
    suggestions = []
    for i, f in enumerate(face_embs):
        per_student = {}
        for ref in class_refs:
            s = cosine(f["embedding"], ref["vec"])
            if ref["student_id"] not in per_student or s > per_student[ref["student_id"]][0]:
                per_student[ref["student_id"]] = (s, ref)
        ranked = sorted(per_student.values(), key=lambda t: t[0], reverse=True)
        if not ranked:
            suggestions.append({"face_index": i, "label": "UNKNOWN",
                                "student_id": None, "name": None, "score": 0.0,
                                "box": f["box"]})
            continue
        top_score, top_ref = ranked[0]
        second = ranked[1][0] if len(ranked) > 1 else 0.0
        if top_score < threshold:
            label, sid, name = "UNKNOWN", None, None
        elif (top_score - second) < margin:
            label, sid, name = "NEEDS_REVIEW", top_ref["student_id"], top_ref["name"]
        else:
            label, sid, name = "SUGGEST_PRESENT", top_ref["student_id"], top_ref["name"]
        suggestions.append({"face_index": i, "label": label, "student_id": sid,
                            "name": name, "score": round(top_score, 4),
                            "box": f["box"]})

    # Duplicate handling: same student chosen by 2 faces → keep best, flag other
    by_student = {}
    for s in suggestions:
        if s["student_id"] is not None:
            by_student.setdefault(s["student_id"], []).append(s)
    for sid, lst in by_student.items():
        if len(lst) > 1:
            lst.sort(key=lambda x: x["score"], reverse=True)
            for dup in lst[1:]:
                dup["label"] = "NEEDS_REVIEW"
                dup["name"] = f"{dup['name']} (duplicate)"
    return suggestions