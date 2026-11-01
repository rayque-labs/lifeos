from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.project import Project
from app.models.task import Task
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectStatus


def _with_progress(db: Session, project: Project) -> dict:
    total, completed = db.query(
        func.count(Task.id), func.sum(case((Task.completed.is_(True), 1), else_=0))
    ).filter(Task.project_id == project.id, Task.user_id == project.user_id).one()
    total = total or 0
    completed = completed or 0
    return {
        "id": project.id,
        "title": project.title,
        "description": project.description,
        "objective": project.objective,
        "deadline": project.deadline,
        "status": project.status,
        "priority": project.priority,
        "progress": round(completed / total * 100, 1) if total else 0.0,
        "total_tasks": total,
        "completed_tasks": completed,
        "created_at": project.created_at,
    }


def list_projects(db: Session, user_id: int, status: ProjectStatus | None = None) -> list[dict]:
    query = db.query(Project).filter(Project.user_id == user_id)
    if status:
        query = query.filter(Project.status == status)
    projects = query.order_by(Project.created_at.desc()).all()
    return [_with_progress(db, project) for project in projects]


def get_project(db: Session, project_id: int, user_id: int) -> dict | None:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    return _with_progress(db, project) if project else None


def create_project(db: Session, payload: ProjectCreate, user_id: int) -> dict:
    project = Project(**payload.model_dump(), user_id=user_id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return _with_progress(db, project)


def update_project(db: Session, project_id: int, payload: ProjectUpdate, user_id: int) -> dict | None:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if not project:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return _with_progress(db, project)


def delete_project(db: Session, project_id: int, user_id: int) -> bool:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if not project:
        return False
    db.delete(project)
    db.commit()
    return True
