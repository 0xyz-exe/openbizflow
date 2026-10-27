from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.models.models import Workflow, WorkflowVersion, OrganizationMember
from app.schemas.schemas import WorkflowOut
from app.api.deps import get_current_org_membership

router = APIRouter(prefix="/templates", tags=["templates"])

TEMPLATES = [
    {
        "id": "tpl-leave-approval",
        "name": "Employee Leave Approval",
        "description": "Routes leave requests to HR or manager for human review with automated notification.",
        "category": "Human Resources",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "manual_trigger",
                    "data": {"label": "Leave Request Submitted"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "cond_1",
                    "type": "condition",
                    "data": {
                        "label": "Days > 3?",
                        "left_operand": "{{trigger.payload.days}}",
                        "operator": "gt",
                        "right_operand": "3",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "approval_1",
                    "type": "approval",
                    "data": {
                        "label": "Manager Approval Required",
                        "prompt": "Approve leave request for {{trigger.payload.employee_name}} ({{trigger.payload.days}} days)",
                    },
                    "position": {"x": 600, "y": 50},
                },
                {
                    "id": "email_1",
                    "type": "email",
                    "data": {
                        "label": "Notify Employee",
                        "to": "{{trigger.payload.employee_email}}",
                        "subject": "Leave Request Status",
                        "body": "Your leave request has been processed.",
                    },
                    "position": {"x": 850, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "cond_1"},
                {"id": "e2-3", "source": "cond_1", "target": "approval_1", "sourceHandle": "true"},
                {"id": "e3-4", "source": "approval_1", "target": "email_1"},
                {"id": "e2-4", "source": "cond_1", "target": "email_1", "sourceHandle": "false"},
            ],
        },
    },
    {
        "id": "tpl-purchase-request",
        "name": "Purchase Request Approval",
        "description": "Multi-tier approval for corporate procurement over budget thresholds.",
        "category": "Finance",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "webhook_trigger",
                    "data": {"label": "Purchase Form Received"},
                    "position": {"x": 100, "y": 150},
                },
                {
                    "id": "cond_1",
                    "type": "condition",
                    "data": {
                        "label": "Amount > $1000",
                        "left_operand": "{{trigger.payload.amount}}",
                        "operator": "gt",
                        "right_operand": "1000",
                    },
                    "position": {"x": 350, "y": 150},
                },
                {
                    "id": "approval_1",
                    "type": "approval",
                    "data": {
                        "label": "Finance Director Approval",
                        "prompt": "Approve purchase request for {{trigger.payload.item_name}} totaling ${{trigger.payload.amount}}",
                    },
                    "position": {"x": 600, "y": 100},
                },
                {
                    "id": "log_1",
                    "type": "log",
                    "data": {"label": "Audit Purchase Record", "message": "Procurement approved: {{trigger.payload.item_name}}"},
                    "position": {"x": 850, "y": 150},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "cond_1"},
                {"id": "e2-3", "source": "cond_1", "target": "approval_1", "sourceHandle": "true"},
                {"id": "e3-4", "source": "approval_1", "target": "log_1"},
                {"id": "e2-4", "source": "cond_1", "target": "log_1", "sourceHandle": "false"},
            ],
        },
    },
    {
        "id": "tpl-customer-inquiry",
        "name": "Customer Inquiry Routing",
        "description": "Directs customer inquiries based on urgency and priority tags.",
        "category": "Customer Support",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "webhook_trigger",
                    "data": {"label": "Support Ticket Ingest"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "cond_1",
                    "type": "condition",
                    "data": {
                        "label": "Priority == Urgent?",
                        "left_operand": "{{trigger.payload.priority}}",
                        "operator": "eq",
                        "right_operand": "urgent",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "notif_urgent",
                    "type": "notification",
                    "data": {
                        "label": "Alert On-Call Team",
                        "title": "URGENT Customer Issue",
                        "message": "{{trigger.payload.subject}} from {{trigger.payload.customer}}",
                    },
                    "position": {"x": 600, "y": 50},
                },
                {
                    "id": "email_ack",
                    "type": "email",
                    "data": {
                        "label": "Send Receipt",
                        "to": "{{trigger.payload.customer_email}}",
                        "subject": "Ticket Received: {{trigger.payload.subject}}",
                        "body": "Thank you for contacting us. Our team is investigating.",
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "cond_1"},
                {"id": "e2-3", "source": "cond_1", "target": "notif_urgent", "sourceHandle": "true"},
                {"id": "e2-4", "source": "cond_1", "target": "email_ack", "sourceHandle": "false"},
            ],
        },
    },
    {
        "id": "tpl-lead-qualification",
        "name": "Lead Qualification",
        "description": "Scores sales leads and qualifies enterprise opportunities automatically.",
        "category": "Sales",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "manual_trigger",
                    "data": {"label": "New CRM Lead"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "transform_1",
                    "type": "transform",
                    "data": {
                        "label": "Format Lead Record",
                        "mapping": {
                            "company": "{{trigger.payload.company}}",
                            "employees": "{{trigger.payload.employees}}",
                            "contact": "{{trigger.payload.email}}",
                        },
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "log_lead",
                    "type": "log",
                    "data": {"label": "Log Qualified Lead", "message": "Lead ingested: {{nodes.transform_1.output.company}}"},
                    "position": {"x": 600, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "transform_1"},
                {"id": "e2-3", "source": "transform_1", "target": "log_lead"},
            ],
        },
    },
    {
        "id": "tpl-invoice-review",
        "name": "Invoice Review",
        "description": "Reviews supplier invoices against purchase order numbers before payment.",
        "category": "Finance",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "manual_trigger",
                    "data": {"label": "Invoice Uploaded"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "approval_1",
                    "type": "approval",
                    "data": {
                        "label": "Accounting Signoff",
                        "prompt": "Verify Invoice #{{trigger.payload.invoice_no}} from {{trigger.payload.vendor}}",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "notif_paid",
                    "type": "notification",
                    "data": {
                        "label": "Schedule Disbursement",
                        "title": "Invoice Approved for Payment",
                        "message": "Invoice #{{trigger.payload.invoice_no}} cleared for settlement.",
                    },
                    "position": {"x": 600, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "approval_1"},
                {"id": "e2-3", "source": "approval_1", "target": "notif_paid"},
            ],
        },
    },
    {
        "id": "tpl-daily-report",
        "name": "Daily Business Report",
        "description": "Compiles daily transaction volume and sends summary email to stakeholders.",
        "category": "Operations",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "schedule_trigger",
                    "data": {"label": "Daily at 08:00 AM"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "email_report",
                    "type": "email",
                    "data": {
                        "label": "Dispatch Executive Summary",
                        "to": "execs@company.com",
                        "subject": "Daily KPI Briefing",
                        "body": "Daily business operations report ready for review.",
                    },
                    "position": {"x": 350, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "email_report"},
            ],
        },
    },
    {
        "id": "tpl-scheduled-email",
        "name": "Scheduled Email Notification",
        "description": "Periodic email notification sender for customer billing or team status updates.",
        "category": "Communications",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "schedule_trigger",
                    "data": {"label": "Weekly Schedule"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "log_reminder",
                    "type": "log",
                    "data": {"label": "Record Trigger", "message": "Scheduled reminder fired."},
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "email_reminder",
                    "type": "email",
                    "data": {
                        "label": "Send Reminder",
                        "to": "billing@customer.com",
                        "subject": "Account Reminder",
                        "body": "Your scheduled statement is attached.",
                    },
                    "position": {"x": 600, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "log_reminder"},
                {"id": "e2-3", "source": "log_reminder", "target": "email_reminder"},
            ],
        },
    },
    {
        "id": "tpl-contact-form",
        "name": "Website Contact Form Processing",
        "description": "Receives inbound webhook from web forms, validates data, and pings internal chat.",
        "category": "Marketing",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "webhook_trigger",
                    "data": {"label": "Website Form Webhook"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "notif_team",
                    "type": "notification",
                    "data": {
                        "label": "Slack/Teams Alert",
                        "title": "New Inbound Inquiry",
                        "message": "Message from {{trigger.payload.name}} ({{trigger.payload.email}}): {{trigger.payload.message}}",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "email_autoresponder",
                    "type": "email",
                    "data": {
                        "label": "Customer Autoresponder",
                        "to": "{{trigger.payload.email}}",
                        "subject": "Thanks for contacting OpenBizFlow!",
                        "body": "Hello {{trigger.payload.name}}, we have received your request.",
                    },
                    "position": {"x": 600, "y": 100},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "notif_team"},
                {"id": "e2-3", "source": "notif_team", "target": "email_autoresponder"},
            ],
        },
    },
    {
        "id": "tpl-inventory-threshold",
        "name": "Inventory Threshold Notification",
        "description": "Monitors stock levels via webhook and warns supply chain manager when below reorder point.",
        "category": "Operations",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "webhook_trigger",
                    "data": {"label": "Stock Level Changed"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "cond_stock",
                    "type": "condition",
                    "data": {
                        "label": "Stock < 10?",
                        "left_operand": "{{trigger.payload.quantity}}",
                        "operator": "lt",
                        "right_operand": "10",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "notif_low",
                    "type": "notification",
                    "data": {
                        "label": "Low Stock Warning",
                        "title": "Restock Required",
                        "message": "SKU {{trigger.payload.sku}} is down to {{trigger.payload.quantity}} units.",
                    },
                    "position": {"x": 600, "y": 50},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "cond_stock"},
                {"id": "e2-3", "source": "cond_stock", "target": "notif_low", "sourceHandle": "true"},
            ],
        },
    },
    {
        "id": "tpl-employee-onboarding",
        "name": "New Employee Onboarding",
        "description": "Coordinates IT hardware provisioning, email setup, and HR introduction emails.",
        "category": "Human Resources",
        "definition": {
            "nodes": [
                {
                    "id": "trigger_1",
                    "type": "manual_trigger",
                    "data": {"label": "New Hire Created"},
                    "position": {"x": 100, "y": 100},
                },
                {
                    "id": "transform_emp",
                    "type": "transform",
                    "data": {
                        "label": "Prepare Directory Record",
                        "mapping": {
                            "name": "{{trigger.payload.name}}",
                            "department": "{{trigger.payload.department}}",
                            "start_date": "{{trigger.payload.start_date}}",
                        },
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "id": "notif_it",
                    "type": "notification",
                    "data": {
                        "label": "Alert IT Helpdesk",
                        "title": "Provision Laptop & Accounts",
                        "message": "Please set up workstation for {{trigger.payload.name}} starting {{trigger.payload.start_date}}.",
                    },
                    "position": {"x": 600, "y": 50},
                },
                {
                    "id": "email_welcome",
                    "type": "email",
                    "data": {
                        "label": "Send Welcome Packet",
                        "to": "{{trigger.payload.personal_email}}",
                        "subject": "Welcome to the Team!",
                        "body": "Hi {{trigger.payload.name}}, welcome aboard! We are excited to have you join us.",
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "edges": [
                {"id": "e1-2", "source": "trigger_1", "target": "transform_emp"},
                {"id": "e2-3", "source": "transform_emp", "target": "notif_it"},
                {"id": "e2-4", "source": "transform_emp", "target": "email_welcome"},
            ],
        },
    },
]

@router.get("/")
def list_templates():
    return TEMPLATES

@router.post("/{template_id}/import", response_model=WorkflowOut)
def import_template(
    template_id: str,
    membership: OrganizationMember = Depends(get_current_org_membership),
    db: Session = Depends(get_db),
):
    tpl = next((t for t in TEMPLATES if t["id"] == template_id), None)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found.")

    workflow = Workflow(
        organization_id=membership.organization_id,
        name=tpl["name"],
        description=tpl["description"],
        is_active=False,
        version=1,
        definition=tpl["definition"],
        created_by=membership.user_id,
    )
    db.add(workflow)
    db.commit()
    db.refresh(workflow)

    v_rec = WorkflowVersion(
        workflow_id=workflow.id,
        version=1,
        definition=tpl["definition"],
    )
    db.add(v_rec)
    db.commit()
    db.refresh(workflow)

    return workflow
