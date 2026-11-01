from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.note import Note
from app.schemas.note import NoteCreate, NoteUpdate


def list_notes(
    db: Session,
    user_id: int,
    *,
    query_text: str | None,
    category: str | None,
    tag: str | None,
    pinned: bool | None,
    limit: int,
    offset: int,
) -> list[Note]:
    query = db.query(Note).filter(Note.user_id == user_id)
    if query_text:
        match = f"%{query_text.strip()}%"
        query = query.filter(or_(Note.title.ilike(match), Note.content.ilike(match)))
    if category:
        query = query.filter(Note.category == category)
    if pinned is not None:
        query = query.filter(Note.pinned.is_(pinned))
    notes = query.order_by(Note.pinned.desc(), Note.updated_at.desc(), Note.id.desc()).all()
    if tag:
        normalized_tag = tag.strip().lower()
        notes = [note for note in notes if normalized_tag in note.tags]
    return notes[offset:offset + limit]


def get_note(db: Session, note_id: int, user_id: int) -> Note | None:
    return db.query(Note).filter(Note.id == note_id, Note.user_id == user_id).first()


def create_note(db: Session, payload: NoteCreate, user_id: int) -> Note:
    note = Note(**payload.model_dump(), user_id=user_id)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


def update_note(db: Session, note_id: int, payload: NoteUpdate, user_id: int) -> Note | None:
    note = get_note(db, note_id, user_id)
    if note is None:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


def delete_note(db: Session, note_id: int, user_id: int) -> bool:
    note = get_note(db, note_id, user_id)
    if note is None:
        return False
    db.delete(note)
    db.commit()
    return True
