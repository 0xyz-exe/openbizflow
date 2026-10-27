import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import encrypt_secret, decrypt_secret
from app.models.models import Credential, OrganizationMember
from app.schemas.schemas import CredentialCreate, CredentialOut
from app.api.deps import get_current_org_membership

router = APIRouter(prefix="/credentials", tags=["credentials"])

@router.get("/", response_model=List[CredentialOut])
def list_credentials(
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    credentials = (
        db.query(Credential)
        .filter(Credential.organization_id == membership.organization_id)
        .order_by(Credential.created_at.desc())
        .all()
    )
    return [
        CredentialOut(
            id=c.id,
            name=c.name,
            type=c.type,
            created_at=c.created_at,
            is_configured=True,
        )
        for c in credentials
    ]

@router.post("/", response_model=CredentialOut)
def create_credential(
    req: CredentialCreate,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient role to create credentials.")

    # Encrypt secret JSON payload at rest
    json_data = json.dumps(req.data)
    encrypted = encrypt_secret(json_data)

    credential = Credential(
        organization_id=membership.organization_id,
        name=req.name,
        type=req.type,
        encrypted_data=encrypted,
    )
    db.add(credential)
    db.commit()
    db.refresh(credential)

    return CredentialOut(
        id=credential.id,
        name=credential.name,
        type=credential.type,
        created_at=credential.created_at,
        is_configured=True,
    )

@router.delete("/{credential_id}")
def delete_credential(
    credential_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    if membership.role in ("viewer", "operator"):
        raise HTTPException(status_code=403, detail="Insufficient role to delete credentials.")

    cred = (
        db.query(Credential)
        .filter(
            Credential.id == credential_id,
            Credential.organization_id == membership.organization_id,
        )
        .first()
    )
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found.")

    db.delete(cred)
    db.commit()
    return {"success": True, "message": "Credential removed."}
