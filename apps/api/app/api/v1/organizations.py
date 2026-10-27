import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.models import User, Organization, OrganizationMember
from app.schemas.schemas import OrganizationCreate, OrganizationOut, MemberOut, MemberAdd
from app.api.deps import get_current_user, get_current_org_membership

router = APIRouter(prefix="/organizations", tags=["organizations"])

def slugify(text: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", slug)

@router.get("/", response_model=List[OrganizationOut])
def list_organizations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = (
        db.query(OrganizationMember, Organization)
        .join(Organization, OrganizationMember.organization_id == Organization.id)
        .filter(OrganizationMember.user_id == current_user.id)
        .all()
    )
    result = []
    for mem, org in memberships:
        result.append(
            OrganizationOut(
                id=org.id,
                name=org.name,
                slug=org.slug,
                role=mem.role,
                created_at=org.created_at,
            )
        )
    return result

@router.post("/", response_model=OrganizationOut)
def create_organization(
    req: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    base_slug = slugify(req.name) or "org"
    slug = base_slug
    counter = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(name=req.name, slug=slug)
    db.add(org)
    db.commit()
    db.refresh(org)

    member = OrganizationMember(organization_id=org.id, user_id=current_user.id, role="owner")
    db.add(member)
    db.commit()

    return OrganizationOut(
        id=org.id,
        name=org.name,
        slug=org.slug,
        role="owner",
        created_at=org.created_at,
    )

@router.get("/{org_id}/members", response_model=List[MemberOut])
def get_organization_members(
    org_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant member access")

    members = (
        db.query(OrganizationMember, User)
        .join(User, OrganizationMember.user_id == User.id)
        .filter(OrganizationMember.organization_id == org_id)
        .all()
    )
    return [
        MemberOut(
            id=mem.id,
            user_id=usr.id,
            email=usr.email,
            full_name=usr.full_name,
            role=mem.role,
            created_at=mem.created_at,
        )
        for mem, usr in members
    ]

@router.post("/{org_id}/members", response_model=MemberOut)
def add_organization_member(
    org_id: str,
    req: MemberAdd,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.organization_id != org_id:
        raise HTTPException(status_code=403, detail="Forbidden: Cross-tenant member access")

    if membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only owners and admins can invite team members.")

    user = db.query(User).filter(User.email == req.email.lower()).first()
    if not user:
        raise HTTPException(status_code=404, detail="User with this email not found. They must register first.")

    existing = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.organization_id == org_id, OrganizationMember.user_id == user.id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="User is already a member of this organization.")

    new_member = OrganizationMember(
        organization_id=org_id,
        user_id=user.id,
        role=req.role,
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    return MemberOut(
        id=new_member.id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=new_member.role,
        created_at=new_member.created_at,
    )
